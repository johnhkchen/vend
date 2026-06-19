import { describe, expect, test } from "bun:test";
import {
  dispersion,
  formatVarianceReport,
  lineJaccardDistance,
  lineSet,
  varianceReduction,
} from "./variance.ts";

// T-014-02 (PRD KR3, E2 arm): the PURE diff/variance core, covered to the branch with
// fabricated fixture outputs. No fs / clock / addon — an ordinary pure-function test, exactly
// the discipline gates.test.ts / recalibrate.test.ts follow. The live 5×2 casting is the
// impure sweep harness (./run-probe.ts), which is NOT tested here (house rule for impure
// verbs); only this judgment is.

describe("lineSet", () => {
  test("trims, drops blank lines, dedupes — order-insensitive content", () => {
    expect([...lineSet("  a \n\nb\n a")].sort()).toEqual(["a", "b"]);
  });
  test("whitespace-only text ⇒ empty set", () => {
    expect(lineSet("   \n\n\t").size).toBe(0);
  });
});

describe("lineJaccardDistance", () => {
  test("identical content ⇒ 0 (whitespace/blank-line insensitive)", () => {
    expect(lineJaccardDistance("a\nb\nc", "  a\n\nb\nc ")).toBe(0);
  });
  test("disjoint content ⇒ 1", () => {
    expect(lineJaccardDistance("a\nb", "c\nd")).toBe(1);
  });
  test("half-shared ⇒ the Jaccard ratio", () => {
    // sets {a,b} and {b,c}: ∩ = {b} (1), ∪ = {a,b,c} (3) ⇒ 1 − 1/3 = 2/3
    expect(lineJaccardDistance("a\nb", "b\nc")).toBeCloseTo(2 / 3, 10);
  });
  test("both empty ⇒ 0 (no divide-by-zero on the empty union)", () => {
    expect(lineJaccardDistance("", "   ")).toBe(0);
  });
  test("one empty, one not ⇒ 1", () => {
    expect(lineJaccardDistance("", "a\nb")).toBe(1);
  });
});

describe("dispersion", () => {
  test("n=0 and n=1 ⇒ dispersion 0, no pairs", () => {
    expect(dispersion([])).toEqual({ n: 0, dispersion: 0, pairs: [] });
    expect(dispersion(["a\nb"])).toEqual({ n: 1, dispersion: 0, pairs: [] });
  });
  test("three identical outputs ⇒ dispersion 0 over C(3,2)=3 pairs", () => {
    const d = dispersion(["a\nb", "a\nb", "a\nb"]);
    expect(d.dispersion).toBe(0);
    expect(d.pairs).toHaveLength(3);
  });
  test("mixed set ⇒ the hand-computed mean pairwise distance", () => {
    // outputs {a,b}, {b,c}, {a,b}:
    //  (0,1): {a,b}/{b,c} = 2/3 ; (0,2): identical = 0 ; (1,2): {b,c}/{a,b} = 2/3
    //  mean = (2/3 + 0 + 2/3) / 3 = 4/9
    const d = dispersion(["a\nb", "b\nc", "a\nb"]);
    expect(d.dispersion).toBeCloseTo(4 / 9, 10);
    expect(d.pairs).toHaveLength(3);
    expect(d.pairs.map((p) => `${p.i}-${p.j}`)).toEqual(["0-1", "0-2", "1-2"]);
  });
});

describe("varianceReduction", () => {
  test("ungated varies, gated identical ⇒ reduction 1, no censoring", () => {
    const r = varianceReduction(["x\ny", "x\ny", "x\ny"], ["a", "b", "c\nd"]);
    expect(r.gated.dispersion).toBe(0);
    expect(r.ungated.dispersion).toBeGreaterThan(0);
    expect(r.reduction).toBe(1);
    expect(r.censoredGated).toBe(0);
    expect(r.censoredUngated).toBe(0);
  });
  test("both arms identical ⇒ reduction 0", () => {
    const r = varianceReduction(["a\nb", "a\nb"], ["c\nd", "c\nd"]);
    expect(r.reduction).toBe(0);
  });
  test("ungated baseline has no variance ⇒ reduction 0, never NaN", () => {
    const r = varianceReduction(["a", "b"], ["same", "same"]);
    expect(r.ungated.dispersion).toBe(0);
    expect(Number.isNaN(r.reduction)).toBe(false);
    expect(r.reduction).toBe(0);
  });
  test("gates INCREASE dispersion ⇒ negative reduction", () => {
    const r = varianceReduction(["a", "b\nc"], ["same", "same\nx"]);
    // gated more dispersed than ungated ⇒ (u − g)/u < 0
    expect(r.reduction).toBeLessThan(0);
  });
  test("null gated runs are counted as censored and excluded from dispersion", () => {
    // 4 gated runs, 3 censored ⇒ 1 survivor (dispersion 0), censoredGated 3
    const r = varianceReduction([null, "a\nb", null, null], ["a", "b", "c", "d"]);
    expect(r.censoredGated).toBe(3);
    expect(r.gated.n).toBe(1);
    expect(r.gated.dispersion).toBe(0);
    // reduction reads as a "win" here ONLY because censoring left one survivor — the report
    // carries censoredGated/n so the formatter can caveat it (see below).
    expect(r.reduction).toBe(1);
  });
  test("empty arms total cleanly", () => {
    const r = varianceReduction([], []);
    expect(r).toEqual({
      gated: { n: 0, dispersion: 0, pairs: [] },
      ungated: { n: 0, dispersion: 0, pairs: [] },
      reduction: 0,
      censoredGated: 0,
      censoredUngated: 0,
    });
  });
});

describe("formatVarianceReport", () => {
  test("leads with the percentage and both raw dispersions", () => {
    const r = varianceReduction(["x", "x", "x"], ["a", "b", "c"]);
    const s = formatVarianceReport(r);
    expect(s).toContain("gate-driven variance reduction: 100%");
    expect(s).toContain("ungated dispersion");
    expect(s).toContain("gated");
  });
  test("caveats a reduction inflated by censoring", () => {
    const r = varianceReduction([null, "a\nb", null, null], ["a", "b", "c", "d"]);
    const s = formatVarianceReport(r);
    expect(s).toContain("⚠");
    expect(s).toContain("3 gated censored");
    expect(s).toContain("gated arm too small to disperse");
  });
  test("caveats an absent ungated baseline", () => {
    const r = varianceReduction(["a", "b"], ["same", "same"]);
    expect(formatVarianceReport(r)).toContain("no ungated baseline variance");
  });
  test("no caveat when both arms are healthy", () => {
    const r = varianceReduction(["x", "x", "x"], ["a", "b", "c"]);
    expect(formatVarianceReport(r)).not.toContain("⚠");
  });
});
