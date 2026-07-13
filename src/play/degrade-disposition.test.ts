import { describe, expect, test } from "bun:test";
import {
  classifyCharterCite,
  materializationDisposition,
  type CharterCite,
  type CharterCiteClassification,
} from "./degrade-disposition.ts";

// Pure, addon-free proof for the shared T-077-02 disposition seam. Snapshot parsing is already
// gold-pinned in charter-snapshot.test.ts; these fixtures start at its ReadonlyMap contract so this
// suite isolates classification and aggregation.

const SNAPSHOT: ReadonlyMap<string, string> = new Map([
  ["P3", "Gates are the contract"],
  ["N4", "Not an executor"],
]);

describe("classifyCharterCite — resolvable", () => {
  test("a known code returns its snapshotted title and no degradation record", () => {
    expect(classifyCharterCite(
      { code: "P3", location: "T-077-02-01.advances", action: "strip" },
      SNAPSHOT,
    )).toEqual({
      classification: "resolvable",
      code: "P3",
      location: "T-077-02-01.advances",
      title: "Gates are the contract",
    });
  });

  test("surrounding code and location whitespace is canonicalized", () => {
    expect(classifyCharterCite(
      { code: "  N4\t", location: "  S-077-02.scope  ", action: "annotate" },
      SNAPSHOT,
    )).toEqual({
      classification: "resolvable",
      code: "N4",
      location: "S-077-02.scope",
      title: "Not an executor",
    });
  });
});

describe("classifyCharterCite — degradable", () => {
  test("an unresolved cite records an exact strip disposition", () => {
    expect(classifyCharterCite(
      { code: "N2", location: "T-077-02-03.advances", action: "strip" },
      SNAPSHOT,
    )).toEqual({
      classification: "degradable",
      disposition: { code: "N2", location: "T-077-02-03.advances", action: "strip" },
    });
  });

  test("an unresolved cite records an exact annotate disposition", () => {
    expect(classifyCharterCite(
      { code: "P9", location: "T-077-02-02.purpose", action: "annotate" },
      SNAPSHOT,
    )).toEqual({
      classification: "degradable",
      disposition: { code: "P9", location: "T-077-02-02.purpose", action: "annotate" },
    });
  });

  test("a valid prefix-generic cite degrades against an empty snapshot", () => {
    expect(classifyCharterCite(
      { code: " K7 ", location: " kitchen-ticket.doneSignal ", action: "strip" },
      new Map(),
    )).toEqual({
      classification: "degradable",
      disposition: { code: "K7", location: "kitchen-ticket.doneSignal", action: "strip" },
    });
  });
});

describe("classifyCharterCite — structural", () => {
  test.each(["", "   ", "p3", "P-three", "P3!"])("an invalid code %p is structural", (code) => {
    expect(classifyCharterCite(
      { code, location: "T-077-02-01.purpose", action: "annotate" },
      SNAPSHOT,
    )).toEqual({
      classification: "structural",
      code: code.trim(),
      location: "T-077-02-01.purpose",
      reason: "invalid-code",
    });
  });

  test("a blank location is structural", () => {
    expect(classifyCharterCite({ code: "P3", location: " \t ", action: "strip" }, SNAPSHOT)).toEqual({
      classification: "structural",
      code: "P3",
      location: "",
      reason: "missing-location",
    });
  });

  test("invalid code wins deterministically when code and location are both invalid", () => {
    expect(classifyCharterCite({ code: "bad", location: "", action: "strip" }, SNAPSHOT)).toEqual({
      classification: "structural",
      code: "bad",
      location: "",
      reason: "invalid-code",
    });
  });
});

describe("materializationDisposition — clean, degraded, or structural", () => {
  const resolvable = classifyCharterCite(
    { code: "P3", location: "T-077-02-01.advances", action: "strip" },
    SNAPSHOT,
  );
  const strip = classifyCharterCite(
    { code: "N2", location: "T-077-02-03.advances", action: "strip" },
    SNAPSHOT,
  );
  const annotate = classifyCharterCite(
    { code: "P9", location: "T-077-02-02.purpose", action: "annotate" },
    SNAPSHOT,
  );

  test("empty and all-resolvable inputs are clean materializations", () => {
    expect(materializationDisposition([])).toEqual({ status: "materialized", degrades: [] });
    expect(materializationDisposition([resolvable])).toEqual({ status: "materialized", degrades: [] });
  });

  test("one or more degradations are a materialized-with-degrades result in caller order", () => {
    expect(materializationDisposition([resolvable, strip, annotate])).toEqual({
      status: "materialized-with-degrades",
      degrades: [
        { code: "N2", location: "T-077-02-03.advances", action: "strip" },
        { code: "P9", location: "T-077-02-02.purpose", action: "annotate" },
      ],
    });
  });

  test("the first structural finding refuses even after a prior degradation", () => {
    const structural = classifyCharterCite(
      { code: "bad", location: "T-077-02-02.purpose", action: "annotate" },
      SNAPSHOT,
    );
    expect(materializationDisposition([strip, structural, annotate])).toEqual({
      status: "structural-refusal",
      finding: {
        classification: "structural",
        code: "bad",
        location: "T-077-02-02.purpose",
        reason: "invalid-code",
      },
    });
  });
});

describe("purity", () => {
  test("frozen inputs and snapshot remain unchanged and the fold returns a fresh array", () => {
    const cite = Object.freeze({
      code: "N2",
      location: "T-077-02-03.advances",
      action: "strip",
    } as const satisfies CharterCite);
    const snapshot = new Map(SNAPSHOT);
    const before = [...snapshot];
    const classification = classifyCharterCite(cite, snapshot);
    const classifications = Object.freeze([classification]) as readonly CharterCiteClassification[];
    const result = materializationDisposition(classifications);

    expect(cite).toEqual({ code: "N2", location: "T-077-02-03.advances", action: "strip" });
    expect([...snapshot]).toEqual(before);
    expect(classifications).toEqual([classification]);
    expect(result.status).toBe("materialized-with-degrades");
    if (result.status === "materialized-with-degrades") {
      expect(result.degrades).not.toBe(classifications);
      expect(result.degrades).toEqual([
        { code: "N2", location: "T-077-02-03.advances", action: "strip" },
      ]);
    }
  });
});
