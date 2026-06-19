import { describe, expect, test } from "bun:test";
import {
  DESIGNER_PRESET,
  DEV_PRESET,
  isValidSpec,
  parseSpec,
  PresentationSpecError,
  validateSpec,
  type PresentationSpec,
} from "./spec.ts";

// T-021-02 — the PURE presentation-spec validator, covered to every branch with plain-record
// fixtures (no fs, no BAML), the model.test.ts / gates.test.ts mould.

// A plain untyped object in the canonical camelCase shape, equivalent to DESIGNER_PRESET — what
// a caller (or a YAML loader, after it maps §2b's snake keys) hands validateSpec.
const validInput = (): Record<string, unknown> => ({
  preset: "designer",
  vocabulary: "plain",
  density: "low",
  face: ["plain_title", "why", "state", "breakdown"],
  details: ["charter_codes", "file_cites", "baml_internals", "raw_acceptance_criteria"],
  groupBy: "story",
  metaphor: "tree",
  labels: { status: { open: "To do", in_progress: "In progress", done: "Done" } },
  colorLanguage: "leverage",
});

describe("validateSpec — valid (the AC accept case)", () => {
  test("the exported presets validate", () => {
    expect(validateSpec(DESIGNER_PRESET).ok).toBe(true);
    expect(validateSpec(DEV_PRESET).ok).toBe(true);
  });

  test("an untyped object validates into the typed, frozen shape", () => {
    const r = validateSpec(validInput());
    expect(r.ok).toBe(true);
    if (!r.ok) throw new Error("expected ok");
    expect(r.spec.groupBy).toBe("story");
    expect(r.spec.colorLanguage).toBe("leverage");
    expect(r.spec.labels.status["open"]).toBe("To do");
    expect(r.spec.face).toEqual(["plain_title", "why", "state", "breakdown"]);
  });
});

describe("validateSpec — the AC reject case (density: 'huge')", () => {
  const r = validateSpec({ ...validInput(), density: "huge" });

  test("rejected", () => {
    expect(r.ok).toBe(false);
  });
  test("exactly one violation, on density, naming the value and allowed set", () => {
    if (r.ok) throw new Error("expected not ok");
    expect(r.violations).toHaveLength(1);
    expect(r.violations[0]!.field).toBe("density");
    expect(r.violations[0]!.reason).toContain("huge");
    expect(r.violations[0]!.reason).toContain("low | medium | full");
  });
});

describe("validateSpec — every knob rejects an out-of-set value", () => {
  const cases: Array<[string, Record<string, unknown>, string]> = [
    ["vocabulary", { vocabulary: "loud" }, "vocabulary"],
    ["density", { density: "huge" }, "density"],
    ["groupBy", { groupBy: "phase" }, "groupBy"],
    ["metaphor", { metaphor: "spreadsheet" }, "metaphor"],
    ["colorLanguage", { colorLanguage: "mood" }, "colorLanguage"],
    ["preset", { preset: "founder" }, "preset"],
  ];
  for (const [name, patch, field] of cases) {
    test(`${name} out of set → violation on ${field}`, () => {
      const r = validateSpec({ ...validInput(), ...patch });
      expect(r.ok).toBe(false);
      if (r.ok) throw new Error("expected not ok");
      expect(r.violations.some((v) => v.field === field)).toBe(true);
    });
  }
});

describe("validateSpec — collects ALL violations", () => {
  test("two bad knobs → at least two violations", () => {
    const r = validateSpec({ ...validInput(), density: "huge", metaphor: "spreadsheet" });
    expect(r.ok).toBe(false);
    if (r.ok) throw new Error("expected not ok");
    expect(r.violations.length).toBeGreaterThanOrEqual(2);
  });
});

describe("validateSpec — field-visibility token arrays", () => {
  test("unknown token in face → violation", () => {
    const r = validateSpec({ ...validInput(), face: ["plain_title", "bogus"] });
    expect(r.ok).toBe(false);
    if (r.ok) throw new Error("expected not ok");
    expect(r.violations.some((v) => v.field === "face")).toBe(true);
  });
  test("duplicate token in details → violation", () => {
    const r = validateSpec({ ...validInput(), details: ["file_cites", "file_cites"] });
    expect(r.ok).toBe(false);
    if (r.ok) throw new Error("expected not ok");
    expect(r.violations.some((v) => v.reason.includes("duplicate"))).toBe(true);
  });
  test("non-array face → violation", () => {
    const r = validateSpec({ ...validInput(), face: "plain_title" });
    expect(r.ok).toBe(false);
  });
  test("empty face/details arrays are valid (a deliberately bare card)", () => {
    const r = validateSpec({ ...validInput(), face: [], details: [] });
    expect(r.ok).toBe(true);
  });
});

describe("validateSpec — labels", () => {
  test("non-object labels → violation", () => {
    const r = validateSpec({ ...validInput(), labels: "nope" });
    expect(r.ok).toBe(false);
  });
  test("missing status sub-map → violation", () => {
    const r = validateSpec({ ...validInput(), labels: {} });
    expect(r.ok).toBe(false);
  });
  test("non-string status value → violation on labels.status", () => {
    const r = validateSpec({ ...validInput(), labels: { status: { open: 1 } } });
    expect(r.ok).toBe(false);
    if (r.ok) throw new Error("expected not ok");
    expect(r.violations.some((v) => v.field === "labels.status")).toBe(true);
  });
  test("empty status map is valid (show raw statuses)", () => {
    const r = validateSpec({ ...validInput(), labels: { status: {} } });
    expect(r.ok).toBe(true);
  });
});

describe("validateSpec — non-object input", () => {
  for (const bad of [null, 42, "spec", [1, 2]]) {
    test(`${JSON.stringify(bad)} → one <spec> violation`, () => {
      const r = validateSpec(bad);
      expect(r.ok).toBe(false);
      if (r.ok) throw new Error("expected not ok");
      expect(r.violations).toHaveLength(1);
      expect(r.violations[0]!.field).toBe("<spec>");
    });
  }
});

describe("parseSpec — the throwing seam", () => {
  test("throws PresentationSpecError carrying violations on a bad spec", () => {
    expect(() => parseSpec({ ...validInput(), density: "huge" })).toThrow(PresentationSpecError);
    try {
      parseSpec({ ...validInput(), density: "huge", metaphor: "spreadsheet" });
      throw new Error("expected throw");
    } catch (e) {
      expect(e).toBeInstanceOf(PresentationSpecError);
      expect((e as PresentationSpecError).violations.length).toBeGreaterThanOrEqual(2);
    }
  });
  test("returns the typed spec on a valid input", () => {
    const spec: PresentationSpec = parseSpec(validInput());
    expect(spec.groupBy).toBe("story");
  });
});

describe("read-only / immutability (the model.ts idiom)", () => {
  const r = validateSpec(validInput());
  if (!r.ok) throw new Error("expected ok");
  const spec = r.spec;

  test("mutating a knob throws", () => {
    expect(() => {
      (spec as { density: string }).density = "full";
    }).toThrow();
  });
  test("mutating the labels.status sub-map throws", () => {
    expect(() => {
      (spec.labels.status as Record<string, string>)["open"] = "hacked";
    }).toThrow();
  });
  test("the exported presets are frozen", () => {
    expect(Object.isFrozen(DESIGNER_PRESET)).toBe(true);
    expect(() => {
      (DESIGNER_PRESET as { density: string }).density = "full";
    }).toThrow();
  });
});

describe("isValidSpec — the narrower", () => {
  test("narrows both branches", () => {
    const good = validateSpec(validInput());
    const bad = validateSpec({ ...validInput(), density: "huge" });
    expect(isValidSpec(good)).toBe(true);
    expect(isValidSpec(bad)).toBe(false);
    if (isValidSpec(good)) expect(good.spec.metaphor).toBe("tree");
  });
});
