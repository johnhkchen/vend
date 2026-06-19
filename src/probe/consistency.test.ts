import { describe, expect, test } from "bun:test";
import {
  consistencyReport,
  formatConsistencyReport,
  outcomeMix,
  PROBE_OUTCOMES,
  type ProbeResult,
} from "./consistency.ts";

// T-019-01 (E-019, the any-play consistency probe): the PURE tally + variance core, covered to the
// branch with fabricated `ProbeResult[]`. No fs / clock / addon — an ordinary pure-function test,
// the variance.test.ts discipline. The live N×cast is the impure sweep harness
// (./run-consistency-probe.ts), NOT tested here (house rule for impure verbs); only this judgment is.

/** Tiny constructor to keep the fixtures legible. */
const r = (outcome: ProbeResult["outcome"], output: string | null): ProbeResult => ({ outcome, output });

describe("outcomeMix", () => {
  test("empty input ⇒ every bucket 0, rates 0 (no divide-by-zero)", () => {
    const m = outcomeMix([]);
    expect(m.total).toBe(0);
    for (const o of PROBE_OUTCOMES) {
      expect(m.counts[o]).toBe(0);
      expect(m.rates[o]).toBe(0); // not NaN
    }
  });

  test("mixed outcomes are counted, every bucket present", () => {
    const m = outcomeMix([
      r("signal", "a"),
      r("signal", "b"),
      r("honest-empty", null),
      r("budget-exhausted", null),
    ]);
    expect(m.total).toBe(4);
    expect(m.counts).toEqual({ signal: 2, "honest-empty": 1, "budget-exhausted": 1 });
  });

  test("rates are count/total and sum to 1 over a non-empty set", () => {
    const m = outcomeMix([r("signal", "a"), r("honest-empty", null), r("honest-empty", null), r("budget-exhausted", null)]);
    expect(m.rates.signal).toBeCloseTo(0.25, 10);
    expect(m.rates["honest-empty"]).toBeCloseTo(0.5, 10); // the over-eagerness/abstention signal
    expect(m.rates["budget-exhausted"]).toBeCloseTo(0.25, 10);
    const sum = PROBE_OUTCOMES.reduce((s, o) => s + m.rates[o], 0);
    expect(sum).toBeCloseTo(1, 10);
  });
});

describe("consistencyReport — variance over the signal arm only", () => {
  test("all-same signal outputs ⇒ variance 0", () => {
    const rep = consistencyReport([r("signal", "a\nb"), r("signal", "a\nb"), r("signal", "a\nb")]);
    expect(rep.variance.dispersion).toBe(0);
    expect(rep.variance.n).toBe(3);
    expect(rep.mix.counts.signal).toBe(3);
  });

  test("disagreeing signals ⇒ non-zero dispersion (the inconsistency the gates bound)", () => {
    const rep = consistencyReport([r("signal", "a\nb"), r("signal", "c\nd")]);
    expect(rep.variance.dispersion).toBe(1); // disjoint line sets
    expect(rep.variance.n).toBe(2);
  });

  test("honest-empty / budget-exhausted runs do not perturb the signal dispersion", () => {
    const withoutNoise = consistencyReport([r("signal", "a\nb"), r("signal", "b\nc")]);
    const withNoise = consistencyReport([
      r("signal", "a\nb"),
      r("honest-empty", null),
      r("signal", "b\nc"),
      r("budget-exhausted", null),
    ]);
    expect(withNoise.variance).toEqual(withoutNoise.variance); // same signal arm ⇒ same variance
    expect(withNoise.mix.total).toBe(4);
    expect(withNoise.mix.counts).toEqual({ signal: 2, "honest-empty": 1, "budget-exhausted": 1 });
  });

  test("a signal with null output is dropped from dispersion but kept in the mix count", () => {
    const rep = consistencyReport([r("signal", "a\nb"), r("signal", null), r("signal", "a\nb")]);
    expect(rep.variance.n).toBe(2); // the null-output signal is not dispersed
    expect(rep.variance.dispersion).toBe(0);
    expect(rep.mix.counts.signal).toBe(3); // but still counted
  });

  test("all-censored / all-abstained ⇒ empty signal arm ⇒ dispersion 0, n 0 (never NaN)", () => {
    const rep = consistencyReport([r("budget-exhausted", null), r("honest-empty", null)]);
    expect(rep.variance.n).toBe(0);
    expect(rep.variance.dispersion).toBe(0);
    expect(rep.mix.rates["honest-empty"]).toBeCloseTo(0.5, 10);
  });
});

describe("formatConsistencyReport", () => {
  test("one honest line: dispersion + mix + honest-empty rate", () => {
    const line = formatConsistencyReport(
      consistencyReport([r("signal", "a\nb"), r("signal", "a\nb"), r("honest-empty", null), r("budget-exhausted", null)]),
    );
    expect(line).toContain("run-to-run signal dispersion: 0.00 over 2");
    expect(line).toContain("signal 2 · honest-empty 1 · budget-exhausted 1 (of 4)");
    expect(line).toContain("honest-empty rate 25%");
    expect(line).not.toContain("⚠");
  });

  test("caveats when the signal arm is too small to disperse (n < 2)", () => {
    const line = formatConsistencyReport(consistencyReport([r("signal", "a"), r("honest-empty", null)]));
    expect(line).toContain("⚠ signal arm too small to disperse");
  });
});
