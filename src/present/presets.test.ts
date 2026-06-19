import { afterAll, describe, expect, test } from "bun:test";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  DEFAULT_PRESETS_DIR,
  defaultPresetForSeat,
  deserializeSpec,
  loadSeatSpec,
  presetByName,
  saveSeatSpec,
  seatSpecPath,
  serializeSpec,
} from "./presets.ts";
import { DESIGNER_PRESET, DEV_PRESET, isValidSpec, PresentationSpecError } from "./spec.ts";
import type { PresentationSpec } from "./spec.ts";

// T-021-03 — role presets save/load + per-seat default. Pure tests (seat table, canonical
// serialize/deserialize) follow the spec.test.ts mould; the byte-equal round-trip and the
// seat-default-via-the-verb tests use a real temp dir, the load.test.ts / materialize.test.ts
// precedent.

const tmpDirs: string[] = [];
async function freshDir(): Promise<string> {
  const d = await mkdtemp(join(tmpdir(), "vend-presets-"));
  tmpDirs.push(d);
  return d;
}
afterAll(async () => {
  for (const d of tmpDirs) await rm(d, { recursive: true, force: true });
});

describe("seat / preset table (pure)", () => {
  test("the designer seat resolves to the designer preset by default (AC clause 3)", () => {
    const spec = defaultPresetForSeat("designer");
    expect(spec).toBe(DESIGNER_PRESET);
    expect(spec.vocabulary).toBe("plain");
    expect(spec.density).toBe("low");
    expect(spec.metaphor).toBe("tree");
  });

  test("the dev seat resolves to the dev preset by default", () => {
    expect(defaultPresetForSeat("dev")).toBe(DEV_PRESET);
  });

  test("loading the 'designer' preset by name returns plain · low · tree (AC clause 1)", () => {
    const spec = presetByName("designer");
    expect(spec).toBe(DESIGNER_PRESET);
    expect(spec?.vocabulary).toBe("plain");
    expect(spec?.density).toBe("low");
    expect(spec?.metaphor).toBe("tree");
  });

  test("named lookup: dev resolves, custom has no built-in", () => {
    expect(presetByName("dev")).toBe(DEV_PRESET);
    expect(presetByName("custom")).toBeNull();
  });
});

describe("serializeSpec / deserializeSpec (pure)", () => {
  test("designer preset round-trips at the value level", () => {
    const r = deserializeSpec(serializeSpec(DESIGNER_PRESET));
    expect(isValidSpec(r)).toBe(true);
    if (r.ok) expect(r.spec).toEqual(DESIGNER_PRESET);
  });

  test("dev preset (empty status map) round-trips at the value level", () => {
    const r = deserializeSpec(serializeSpec(DEV_PRESET));
    expect(isValidSpec(r)).toBe(true);
    if (r.ok) expect(r.spec).toEqual(DEV_PRESET);
  });

  test("serialization is canonical — independent of input key order", () => {
    // A clone with the same values in a deliberately scrambled key order.
    const scrambled: PresentationSpec = {
      colorLanguage: DESIGNER_PRESET.colorLanguage,
      labels: DESIGNER_PRESET.labels,
      metaphor: DESIGNER_PRESET.metaphor,
      groupBy: DESIGNER_PRESET.groupBy,
      details: DESIGNER_PRESET.details,
      face: DESIGNER_PRESET.face,
      density: DESIGNER_PRESET.density,
      vocabulary: DESIGNER_PRESET.vocabulary,
      preset: DESIGNER_PRESET.preset,
    };
    expect(serializeSpec(scrambled)).toBe(serializeSpec(DESIGNER_PRESET));
  });

  test("deserialize is total: malformed YAML → a <yaml> violation, never a throw", () => {
    const r = deserializeSpec(":\n  - not: [valid", "broken.yaml");
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.violations[0]?.field).toBe("<yaml>");
      expect(r.violations[0]?.reason).toContain("broken.yaml");
    }
  });

  test("deserialize delegates to validateSpec: an out-of-set knob is rejected", () => {
    const bad = serializeSpec(DESIGNER_PRESET).replace("density: low", "density: huge");
    const r = deserializeSpec(bad);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.violations.some((v) => v.field === "density")).toBe(true);
  });
});

describe("saveSeatSpec / loadSeatSpec (fs round-trip)", () => {
  test("saving a tuned spec and reloading round-trips byte-equal (AC clause 2)", async () => {
    const dir = await freshDir();
    const tuned: PresentationSpec = {
      ...DESIGNER_PRESET,
      preset: "custom",
      density: "medium",
      vocabulary: "mixed",
    };

    const path = await saveSeatSpec("designer", tuned, dir);
    const bytesA = await readFile(path, "utf8");

    const reloaded = await loadSeatSpec("designer", dir);
    expect(reloaded).toEqual(tuned);

    const path2 = await saveSeatSpec("designer", reloaded, dir);
    const bytesB = await readFile(path2, "utf8");
    expect(bytesB).toBe(bytesA);
  });

  test("an unsaved seat resolves to its preset by default (ENOENT → default)", async () => {
    const dir = await freshDir();
    expect(await loadSeatSpec("designer", dir)).toBe(DESIGNER_PRESET);
    expect(await loadSeatSpec("dev", dir)).toBe(DEV_PRESET);
  });

  test("a present-but-corrupt saved file is a loud refusal", async () => {
    const dir = await freshDir();
    await mkdir(dir, { recursive: true });
    await writeFile(seatSpecPath("designer", dir), "density: huge\nvocabulary: nope\n", "utf8");
    await expect(loadSeatSpec("designer", dir)).rejects.toBeInstanceOf(PresentationSpecError);
  });

  test("seatSpecPath composes dir/seat.yaml and defaults to .vend/presets", () => {
    expect(seatSpecPath("designer", "/tmp/x")).toBe(join("/tmp/x", "designer.yaml"));
    expect(seatSpecPath("dev")).toBe(join(DEFAULT_PRESETS_DIR, "dev.yaml"));
  });
});
