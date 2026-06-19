import { describe, expect, test } from "bun:test";
import {
  classifyEquivalence,
  formatEquivalenceReport,
  EQUIVALENCE_CLASSES,
  type EquivalenceVerdict,
} from "./equivalence.ts";

// T-022-01 (E-022, the semantic-equivalence judge): the PURE aggregation core, covered to the
// branch with fabricated per-pair verdicts. No fs / clock / addon / live `claude` cast — an
// ordinary pure-function test, the consistency.test.ts / variance.test.ts discipline. The live
// judge cast over the N collected outputs is the impure harness (./run-equivalence-judge.ts), NOT
// tested here (house rule for impure verbs); only this judgment is.

/** Tiny constructor to keep the fixtures legible. */
const v = (i: number, j: number, equivalent: boolean): EquivalenceVerdict => ({ i, j, equivalent });

/** The three unordered pairs over 3 outputs — the AC#1 fixture size. */
const equiv3 = [v(0, 1, true), v(0, 2, true), v(1, 2, true)];
const diff3 = [v(0, 1, false), v(0, 2, false), v(1, 2, false)];
const mix3 = [v(0, 1, true), v(0, 2, false), v(1, 2, false)];

describe("classifyEquivalence — the three AC#1 fixtures", () => {
  test("all-equivalent ⇒ equivalent-diversity, score 1", () => {
    const r = classifyEquivalence(equiv3, 3);
    expect(r.classification).toBe("equivalent-diversity");
    expect(r.score).toBe(1);
    expect(r.totalPairs).toBe(3);
    expect(r.equivalentPairs).toBe(3);
    expect(r.divergentPairs).toBe(0);
    expect(r.verdictsSeen).toBe(3);
  });

  test("all-different ⇒ genuine-disagreement, score 0", () => {
    const r = classifyEquivalence(diff3, 3);
    expect(r.classification).toBe("genuine-disagreement");
    expect(r.score).toBe(0);
    expect(r.equivalentPairs).toBe(0);
    expect(r.divergentPairs).toBe(3);
  });

  test("a mix ⇒ mixed, score = e/P", () => {
    const r = classifyEquivalence(mix3, 3);
    expect(r.classification).toBe("mixed");
    expect(r.score).toBeCloseTo(1 / 3, 10);
    expect(r.equivalentPairs).toBe(1);
    expect(r.divergentPairs).toBe(2);
  });
});

describe("classifyEquivalence — honesty edges (IA-8)", () => {
  test("fewer than 2 outputs ⇒ vacuous equivalent-diversity, 0 pairs, score 1 (never NaN)", () => {
    const r = classifyEquivalence([], 1);
    expect(r.classification).toBe("equivalent-diversity");
    expect(r.totalPairs).toBe(0);
    expect(r.score).toBe(1);
    expect(Number.isNaN(r.score)).toBe(false);
  });

  test("zero outputs ⇒ same vacuous read, no divide-by-zero", () => {
    const r = classifyEquivalence([], 0);
    expect(r.totalPairs).toBe(0);
    expect(r.score).toBe(1);
  });

  test("all-equivalent verdicts but SHORT of full coverage ⇒ mixed, not a clean diversity", () => {
    // 3 outputs ⇒ 3 expected pairs, but the judge only scored 2 (both equivalent).
    const r = classifyEquivalence([v(0, 1, true), v(0, 2, true)], 3);
    expect(r.totalPairs).toBe(3);
    expect(r.verdictsSeen).toBe(2);
    expect(r.equivalentPairs).toBe(2);
    expect(r.classification).toBe("mixed"); // missing evidence is not agreement
    expect(r.score).toBeCloseTo(2 / 3, 10); // denominator is expected pairs, not verdicts seen
  });

  test("a single pair, equivalent ⇒ full coverage at n=2 ⇒ equivalent-diversity", () => {
    const r = classifyEquivalence([v(0, 1, true)], 2);
    expect(r.totalPairs).toBe(1);
    expect(r.classification).toBe("equivalent-diversity");
    expect(r.score).toBe(1);
  });
});

describe("formatEquivalenceReport", () => {
  test("clean line: classification + score + pair tally, no ⚠", () => {
    const line = formatEquivalenceReport(classifyEquivalence(equiv3, 3));
    expect(line).toContain("semantic equivalence: equivalent-diversity (score 1.00)");
    expect(line).toContain("3 equivalent · 0 divergent of 3 pairs over 3 outputs");
    expect(line).not.toContain("⚠");
  });

  test("genuine-disagreement line reads its class + score 0.00", () => {
    const line = formatEquivalenceReport(classifyEquivalence(diff3, 3));
    expect(line).toContain("semantic equivalence: genuine-disagreement (score 0.00)");
  });

  test("vacuous caveat when fewer than 2 outputs", () => {
    const line = formatEquivalenceReport(classifyEquivalence([], 1));
    expect(line).toContain("⚠ fewer than 2 outputs — classification vacuous");
  });

  test("under-coverage caveat when the judge returned fewer verdicts than expected pairs", () => {
    const line = formatEquivalenceReport(classifyEquivalence([v(0, 1, true), v(0, 2, true)], 3));
    expect(line).toContain("⚠ judge returned 2 of 3 pair verdicts");
  });
});

describe("EQUIVALENCE_CLASSES", () => {
  test("is the closed set the classification only ever draws from", () => {
    expect(EQUIVALENCE_CLASSES).toEqual(["equivalent-diversity", "genuine-disagreement", "mixed"]);
    for (const fixture of [equiv3, diff3, mix3]) {
      const r = classifyEquivalence(fixture, 3);
      expect(EQUIVALENCE_CLASSES).toContain(r.classification);
    }
  });
});
