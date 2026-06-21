import { describe, expect, test } from "bun:test";
import { buildRunRecord, type RunOutcome, type RunRecord, type RunRecordInput } from "../log/run-log.ts";
import type { Budget } from "../budget/budget.ts";
import {
  type BiasPrior,
  calibrate,
  CENSORED_WIDEN_RATE,
  COLD_START_MIN_SUCCESSES,
  DEFAULT_SHRINKAGE,
  formatCorrectionLabel,
  formatEnvelopeLabel,
  fundingEnvelope,
  IDENTITY_FACTOR,
  learnBiasFactor,
  MEASUREMENT_HEADROOM,
  percentile,
  recalibrate,
  TIER_PERCENTILE,
} from "./recalibrate.ts";

// T-013-02 recalibrate core: the PURE percentile math, censoring semantics, cold-start
// fallback, and the honest confidence label — all on fabricated RunRecord fixtures, no
// fs/clock/spawn (mirrors run-log.test.ts / budget.test.ts). The cli dispatch shell and
// `loadRunLog` are NOT exercised here (proven by smoke), per the house pattern.

/** A success record with a chosen token total and wall-clock duration (ms). Builds a real
 *  frozen RunRecord via the exported pure writer, so fixtures match production shape.
 *  `tokens` lands in `input_tokens`; `durationMs` is encoded as endedAt − startedAt. */
const recordOf = (
  over: { tokens?: number; durationMs?: number; outcome?: RunOutcome; play?: string } & Partial<RunRecordInput> = {},
): RunRecord => {
  const { tokens = 1000, durationMs = 60_000, outcome = "success", play = "p", ...rest } = over;
  const start = "2026-06-18T00:00:00.000Z";
  const end = new Date(Date.parse(start) + durationMs).toISOString();
  return buildRunRecord({
    runId: "r",
    play,
    epic: "E-001",
    model: "m",
    outcome,
    usage: { input_tokens: tokens },
    startedAt: start,
    endedAt: end,
    ...rest,
  });
};

const PRIOR: Budget = { timeMs: 999, tokens: 888 };

describe("percentile — nearest-rank ceil, exact", () => {
  test("n=1 returns the single value for any p", () => {
    expect(percentile([10], 0.95)).toBe(10);
    expect(percentile([10], 0)).toBe(10);
    expect(percentile([10], 1)).toBe(10);
  });
  test("ascending 1..10: tier percentiles land on the expected ranks", () => {
    const xs = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
    expect(percentile(xs, 0.95)).toBe(10); // ceil(9.5)-1 = 9 → max (conservative on the tail)
    expect(percentile(xs, 0.9)).toBe(9); //  ceil(9)-1   = 8
    expect(percentile(xs, 0.75)).toBe(8); // ceil(7.5)-1 = 7
  });
  test("p=0 is the min, p=1 is the max", () => {
    expect(percentile([1, 2, 3, 4, 5], 0)).toBe(1);
    expect(percentile([1, 2, 3, 4, 5], 1)).toBe(5);
  });
});

describe("recalibrate — per-tier percentile over successes (AC #3a)", () => {
  // 10 successes, tokens 1000·k and durations 1000·k ms for k=1..10.
  const records = Array.from({ length: 10 }, (_, i) => recordOf({ tokens: 1000 * (i + 1), durationMs: 1000 * (i + 1) }));

  test("keystone → p95 → the measured max", () => {
    const r = recalibrate("p", records, "keystone", PRIOR);
    expect(r.source).toBe("measured");
    expect(r.envelope.tokens).toBe(10_000);
    expect(r.envelope.timeMs).toBe(10_000);
    expect(r.confidence).toEqual({ successes: 10, censored: 0, percentile: 0.95 });
  });
  test("standard → p90", () => {
    expect(recalibrate("p", records, "standard", PRIOR).envelope.tokens).toBe(9000);
  });
  test("leaf → p75", () => {
    expect(recalibrate("p", records, "leaf", PRIOR).envelope.tokens).toBe(8000);
  });
  test("high → p92 (between keystone and standard)", () => {
    expect(TIER_PERCENTILE.high).toBe(0.92);
    // ceil(0.92*10)-1 = ceil(9.2)-1 = 10-1 = 9 → max
    expect(recalibrate("p", records, "high", PRIOR).envelope.tokens).toBe(10_000);
  });
});

describe("recalibrate — censored excluded from the percentile but counted (AC #3b)", () => {
  const records = [
    recordOf({ tokens: 1000 }),
    recordOf({ tokens: 2000 }),
    recordOf({ tokens: 3000 }),
    recordOf({ tokens: 999_999, outcome: "budget-exhausted" }),
    recordOf({ tokens: 999_999, outcome: "timed-out" }),
    recordOf({ tokens: 999_999, outcome: "gate-failed" }), // counted in NEITHER
  ];

  test("the huge censored tokens never inflate the percentile", () => {
    const r = recalibrate("p", records, "standard", PRIOR, { minSuccesses: 3 });
    expect(r.source).toBe("measured");
    // p90 over [1000,2000,3000] → ceil(0.9*3)-1 = ceil(2.7)-1 = 3-1 = 2 → 3000
    expect(r.envelope.tokens).toBe(3000);
  });
  test("censored counts the two andon'd-at-envelope runs; gate-failed is neither", () => {
    const r = recalibrate("p", records, "standard", PRIOR, { minSuccesses: 3 });
    expect(r.confidence.successes).toBe(3);
    expect(r.confidence.censored).toBe(2);
  });
});

describe("recalibrate — cold-start fallback to the prior (AC #3c)", () => {
  test("fewer than the threshold successes returns the prior verbatim", () => {
    const r = recalibrate("p", [recordOf(), recordOf()], "standard", PRIOR);
    expect(r.source).toBe("prior");
    expect(r.envelope).toEqual(PRIOR);
    expect(r.confidence.successes).toBe(2);
  });
  test("no records at all → prior, zero successes", () => {
    const r = recalibrate("p", [], "keystone", PRIOR);
    expect(r.source).toBe("prior");
    expect(r.envelope).toEqual(PRIOR);
    expect(r.confidence).toEqual({ successes: 0, censored: 0, percentile: 0.95 });
  });
  test("default threshold is a handful", () => {
    expect(COLD_START_MIN_SUCCESSES).toBe(3);
  });
});

describe("recalibrate — tokens and wall-clock bounded independently (AC #3d)", () => {
  test("token order and duration order are decorrelated; each percentile is its own", () => {
    // tokens ascending 1000..5000, but durations REVERSED 5000..1000 ms.
    const records = [
      recordOf({ tokens: 1000, durationMs: 5000 }),
      recordOf({ tokens: 2000, durationMs: 4000 }),
      recordOf({ tokens: 3000, durationMs: 3000 }),
      recordOf({ tokens: 4000, durationMs: 2000 }),
      recordOf({ tokens: 5000, durationMs: 1000 }),
    ];
    const r = recalibrate("p", records, "leaf", PRIOR); // p75 of 5 → ceil(3.75)-1 = 3 → 4th sorted
    // tokens sorted [1000..5000] → idx3 → 4000; times sorted [1000..5000] → idx3 → 4000
    expect(r.envelope.tokens).toBe(4000);
    expect(r.envelope.timeMs).toBe(4000);
  });
  test("unparseable stamps drop from the TIME sample only; tokens stay measured", () => {
    const records = [
      recordOf({ tokens: 1000, startedAt: "not-a-date", endedAt: "also-not" }),
      recordOf({ tokens: 2000, startedAt: "nope", endedAt: "nope" }),
      recordOf({ tokens: 3000, startedAt: "bad", endedAt: "bad" }),
    ];
    const r = recalibrate("p", records, "standard", PRIOR, { minSuccesses: 3 });
    expect(r.source).toBe("measured");
    expect(r.envelope.tokens).toBe(3000); // tokens measured
    expect(r.envelope.timeMs).toBe(PRIOR.timeMs); // time falls back — no parseable durations
  });
});

describe("recalibrate — recency window", () => {
  test("only the last `window` records feed the percentile", () => {
    // Three ancient huge-token successes, then three recent small ones.
    const records = [
      recordOf({ tokens: 900_000 }),
      recordOf({ tokens: 900_000 }),
      recordOf({ tokens: 900_000 }),
      recordOf({ tokens: 1000 }),
      recordOf({ tokens: 2000 }),
      recordOf({ tokens: 3000 }),
    ];
    const r = recalibrate("p", records, "standard", PRIOR, { minSuccesses: 3, window: 3 });
    expect(r.envelope.tokens).toBe(3000); // ancient records out of window
    expect(r.confidence.successes).toBe(3);
  });
});

describe("recalibrate — filters by play and emits a valid budget", () => {
  test("only the requested play's records are considered", () => {
    const records = [
      recordOf({ play: "other", tokens: 999_999 }),
      recordOf({ play: "p", tokens: 1000 }),
      recordOf({ play: "p", tokens: 2000 }),
      recordOf({ play: "p", tokens: 3000 }),
    ];
    const r = recalibrate("p", records, "standard", PRIOR, { minSuccesses: 3 });
    expect(r.confidence.successes).toBe(3);
    expect(r.envelope.tokens).toBe(3000);
  });
  test("emitted dimensions are positive integers (budget contract)", () => {
    // A fractional/odd sample still yields ceil'd positive integers.
    const records = [recordOf({ tokens: 1, durationMs: 1 }), recordOf({ tokens: 2, durationMs: 2 }), recordOf({ tokens: 3, durationMs: 3 })];
    const r = recalibrate("p", records, "standard", PRIOR, { minSuccesses: 3 });
    expect(Number.isInteger(r.envelope.tokens)).toBe(true);
    expect(Number.isInteger(r.envelope.timeMs)).toBe(true);
    expect(r.envelope.tokens).toBeGreaterThan(0);
    expect(r.envelope.timeMs).toBeGreaterThan(0);
  });
});

describe("formatEnvelopeLabel — honest confidence (AC #2)", () => {
  test("measured reads 'measured · N casts · pXX'", () => {
    const records = Array.from({ length: 10 }, () => recordOf({ tokens: 1000 }));
    const label = formatEnvelopeLabel(recalibrate("p", records, "keystone", PRIOR));
    expect(label).toBe("measured · 10 casts · p95");
  });
  test("measured surfaces the andon count when the window saw censored runs", () => {
    const records = [
      recordOf({ tokens: 1000 }),
      recordOf({ tokens: 2000 }),
      recordOf({ tokens: 3000 }),
      recordOf({ tokens: 9, outcome: "budget-exhausted" }),
      recordOf({ tokens: 9, outcome: "timed-out" }),
    ];
    const label = formatEnvelopeLabel(recalibrate("p", records, "standard", PRIOR, { minSuccesses: 3 }));
    expect(label).toBe("measured · 3 casts · p90 · 2 andon'd");
  });
  test("cold start with no data reads 'estimate (no data)'", () => {
    expect(formatEnvelopeLabel(recalibrate("p", [], "standard", PRIOR))).toBe("estimate (no data)");
  });
  test("cold start with some-but-too-few casts names the count", () => {
    const label = formatEnvelopeLabel(recalibrate("p", [recordOf(), recordOf()], "standard", PRIOR));
    expect(label).toBe("estimate (2 casts)");
  });
});

// ── T-013-03: reference-class bias correction (calibrate / learnBiasFactor) ──────────────
// The (allocated, actual) pair: `allocated` is the logged envelope, `actual` is totalTokens /
// wallClockMs. A `paired` fixture sets both so the ratio is exact. Ratio < 1 ⇒ overestimate.

/** A SUCCESSFUL record with an explicit allocated envelope and actual cost, so the
 *  actual/allocated ratio is exactly `actualTokens/allocTokens` (and the time ratio
 *  `durationMs/allocMs`). Builds a real frozen record through the pure writer. */
const paired = (over: {
  allocTokens: number;
  actualTokens: number;
  allocMs?: number;
  durationMs?: number;
  project?: string;
  play?: string;
}): RunRecord => {
  const { allocTokens, actualTokens, allocMs = 60_000, durationMs = 60_000, project, play = "p" } = over;
  return recordOf({
    tokens: actualTokens,
    durationMs,
    play,
    envelope: { timeMs: allocMs, tokens: allocTokens },
    ...(project ? { project } : {}),
  });
};

describe("learnBiasFactor — median actual/allocated ratio per dim (AC #2)", () => {
  test("token factor is the median per-run ratio; n counts the pairs", () => {
    const recs = [
      paired({ allocTokens: 1000, actualTokens: 200 }), // 0.2
      paired({ allocTokens: 1000, actualTokens: 300 }), // 0.3
      paired({ allocTokens: 1000, actualTokens: 400 }), // 0.4
    ];
    const { factor, n } = learnBiasFactor(recs);
    expect(factor.tokens).toBeCloseTo(0.3, 10); // median of [0.2,0.3,0.4]
    expect(n).toBe(3);
  });

  test("a success with NO envelope contributes no pair; a censored run is excluded", () => {
    const recs = [
      paired({ allocTokens: 1000, actualTokens: 200 }),
      paired({ allocTokens: 1000, actualTokens: 400 }),
      recordOf({ tokens: 999, outcome: "success" }), // no envelope → skipped
      recordOf({ tokens: 999, outcome: "budget-exhausted", envelope: { timeMs: 1, tokens: 1 } }), // censored → skipped
    ];
    const { factor, n } = learnBiasFactor(recs);
    expect(n).toBe(2);
    expect(factor.tokens).toBeCloseTo(0.3, 10); // median of [0.2,0.4]
  });

  test("an unparseable duration drops from the TIME factor only; tokens intact", () => {
    const recs = [
      recordOf({ tokens: 200, play: "p", envelope: { timeMs: 1000, tokens: 1000 }, startedAt: "bad", endedAt: "bad" }),
      recordOf({ tokens: 400, play: "p", envelope: { timeMs: 1000, tokens: 1000 }, startedAt: "bad", endedAt: "bad" }),
    ];
    const { factor, n } = learnBiasFactor(recs);
    expect(n).toBe(2); // token pairs
    expect(factor.tokens).toBeCloseTo(0.3, 10);
    expect(factor.timeMs).toBe(1); // no parseable durations → no bias
  });

  test("an empty / all-envelope-less sample learns the identity factor, n=0", () => {
    expect(learnBiasFactor([])).toEqual({ factor: IDENTITY_FACTOR, n: 0 });
    expect(learnBiasFactor([recordOf(), recordOf()])).toEqual({ factor: IDENTITY_FACTOR, n: 0 });
  });

  test("direction is data-driven: ratios > 1 learn an UNDER-estimate factor > 1", () => {
    const recs = [
      paired({ allocTokens: 1000, actualTokens: 1500 }), // 1.5
      paired({ allocTokens: 1000, actualTokens: 2000 }), // 2.0
      paired({ allocTokens: 1000, actualTokens: 2500 }), // 2.5
    ];
    expect(learnBiasFactor(recs).factor.tokens).toBeCloseTo(2.0, 10);
  });
});

describe("calibrate — partial pooling across three regimes (AC #3)", () => {
  const ESTIMATE: Budget = { timeMs: 10_000, tokens: 10_000 };
  const KEY = { play: "p", project: "alpha" };
  // Generic prior: factor 0.5, well-backed (n=40). Project ratio (when present) is 0.2.
  const GENERIC: BiasPrior = { factor: { tokens: 0.5, timeMs: 0.5 }, n: 40 };
  const projectPairs = (count: number): RunRecord[] =>
    Array.from({ length: count }, () => paired({ allocTokens: 1000, actualTokens: 200, project: "alpha" }));

  test("N=0 project pairs → pure generic prior (w=0)", () => {
    const r = calibrate(ESTIMATE, KEY, [], GENERIC);
    expect(r.confidence).toEqual({ projectN: 0, genericN: 40 });
    expect(r.factor.tokens).toBeCloseTo(0.5, 10);
    expect(r.corrected.tokens).toBe(5000); // 10000 × 0.5
  });

  test("small-N → shrunk toward generic, between the two factors", () => {
    const r = calibrate(ESTIMATE, KEY, projectPairs(2), GENERIC); // w = 2/(2+5) ≈ 0.286
    expect(r.confidence.projectN).toBe(2);
    // pooled = 0.286·0.2 + 0.714·0.5 ≈ 0.414 — strictly between project 0.2 and generic 0.5
    expect(r.factor.tokens).toBeGreaterThan(0.2);
    expect(r.factor.tokens).toBeLessThan(0.5);
  });

  test("large-N → project-dominant (pooled ≈ the project factor)", () => {
    const r = calibrate(ESTIMATE, KEY, projectPairs(95), GENERIC); // w = 95/100 = 0.95
    expect(r.factor.tokens).toBeCloseTo(0.95 * 0.2 + 0.05 * 0.5, 6); // ≈ 0.215
    expect(r.corrected.tokens).toBeLessThan(2500); // close to project's 2000
  });

  test("the corrected estimate moves MONOTONICALLY from prior to project as N grows", () => {
    // Fixed project ratio 0.2 (below generic 0.5): more project data ⇒ smaller correction.
    const corrected = [0, 1, 5, 20, 100].map((n) => calibrate(ESTIMATE, KEY, projectPairs(n), GENERIC).corrected.tokens);
    for (let i = 1; i < corrected.length; i++) {
      expect(corrected[i]!).toBeLessThan(corrected[i - 1]!);
    }
    expect(corrected[0]).toBe(5000); // pure generic
  });

  test("shrinkage K is tunable — a larger K leans harder on the prior", () => {
    const tight = calibrate(ESTIMATE, KEY, projectPairs(5), GENERIC, { shrinkage: 1 });
    const loose = calibrate(ESTIMATE, KEY, projectPairs(5), GENERIC, { shrinkage: 50 });
    expect(tight.factor.tokens).toBeLessThan(loose.factor.tokens); // tight → closer to project 0.2
  });
});

describe("calibrate — authored default, direction, budget contract (AC #2/#4)", () => {
  const ESTIMATE: Budget = { timeMs: 7_200_000, tokens: 5000 };
  const KEY = { play: "p", project: "alpha" };
  const EMPTY: BiasPrior = { factor: IDENTITY_FACTOR, n: 0 };

  test("both levels empty → authored default: estimate passes through uncorrected", () => {
    const r = calibrate(ESTIMATE, KEY, [], EMPTY);
    expect(r.confidence).toEqual({ projectN: 0, genericN: 0 });
    expect(r.corrected).toEqual(ESTIMATE);
  });

  test("an under-estimate factor grows the estimate (direction data-driven)", () => {
    const under: BiasPrior = { factor: { tokens: 2, timeMs: 2 }, n: 30 };
    const r = calibrate(ESTIMATE, KEY, [], under);
    expect(r.corrected.tokens).toBe(10_000); // 5000 × 2
    expect(r.corrected.timeMs).toBe(14_400_000);
  });

  test("only the requested {play, project}'s records feed the project factor", () => {
    const recs = [
      paired({ allocTokens: 1000, actualTokens: 900, project: "alpha", play: "p" }),
      paired({ allocTokens: 1000, actualTokens: 100, project: "beta", play: "p" }), // other project
      paired({ allocTokens: 1000, actualTokens: 100, project: "alpha", play: "other" }), // other play
    ];
    const r = calibrate(ESTIMATE, KEY, recs, EMPTY);
    expect(r.confidence.projectN).toBe(1); // only the alpha/p pair (beta + other-play excluded)
    // 1 pair (ratio 0.9) pooled with the empty/identity prior: w = 1/(1+5) ⇒ 0.1667·0.9 + 0.8333·1.0.
    expect(r.factor.tokens).toBeCloseTo((0.9 + 5) / 6, 6); // ≈ 0.9833 — proves 0.9 entered, not beta's 0.1
  });

  test("corrected dimensions are positive integers (budget contract)", () => {
    const tiny: BiasPrior = { factor: { tokens: 0.00001, timeMs: 0.00001 }, n: 10 };
    const r = calibrate({ timeMs: 1, tokens: 1 }, KEY, [], tiny);
    expect(Number.isInteger(r.corrected.tokens)).toBe(true);
    expect(r.corrected.tokens).toBeGreaterThan(0);
    expect(r.corrected.timeMs).toBeGreaterThan(0);
  });

  test("DEFAULT_SHRINKAGE is the documented handful", () => {
    expect(DEFAULT_SHRINKAGE).toBe(5);
  });
});

describe("formatCorrectionLabel — honest correction (AC #4)", () => {
  const KEY = { play: "p", project: "alpha" };

  test("a backed correction reads '× t.. / m.. · N project / M generic'", () => {
    const generic: BiasPrior = { factor: { tokens: 0.5, timeMs: 0.5 }, n: 40 };
    const recs = Array.from({ length: 8 }, () => paired({ allocTokens: 1000, actualTokens: 300, project: "alpha" }));
    const label = formatCorrectionLabel(calibrate({ timeMs: 10_000, tokens: 10_000 }, KEY, recs, generic));
    expect(label).toMatch(/^× t0\.\d{2} \/ m0\.\d{2} · 8 project \/ 40 generic$/);
  });

  test("no data at either level reads 'uncorrected (no data)'", () => {
    const empty: BiasPrior = { factor: IDENTITY_FACTOR, n: 0 };
    expect(formatCorrectionLabel(calibrate({ timeMs: 1, tokens: 1 }, KEY, [], empty))).toBe("uncorrected (no data)");
  });
});

// ── T-050-01: measurement-funding headroom (fundingEnvelope) ─────────────────────────────
// The FUNDING guard a cast runs under, distinct from the PRICE the shelf quotes. Every case
// feeds REAL recalibrate(...) output into fundingEnvelope (never a hand-faked RecalibrateResult),
// so the price→funding seam is exercised exactly as production wires it. Pure — fabricated
// RunRecord fixtures via the existing `recordOf` writer, no fs/clock/spawn.

describe("fundingEnvelope — measurement-funding guard (T-050-01)", () => {
  test("E-049 shape: 120k prior + a censored run logging ~265k ⇒ funding ≥ 265k × headroom (AC #1/#3a)", () => {
    const prior: Budget = { timeMs: 120_000, tokens: 120_000 };
    const records = [
      recordOf({ tokens: 60_000 }),
      recordOf({ tokens: 60_000 }), // 2 successes < cold-start threshold ⇒ source "prior"
      recordOf({ tokens: 264_866, outcome: "budget-exhausted" }), // logged lower bound, right-censored
    ];
    const result = recalibrate("p", records, "standard", prior);
    expect(result.source).toBe("prior");
    expect(result.envelope.tokens).toBe(120_000); // the price is the prior, untouched

    const { envelope, widened } = fundingEnvelope("p", records, result);
    expect(widened).toBe(true);
    expect(envelope.tokens).toBe(264_866 * MEASUREMENT_HEADROOM); // clears the observed wall
    expect(envelope.tokens).toBeGreaterThanOrEqual(265_000); // room to finish and RECORD
  });

  test("pure cold-start, no censored history ⇒ price × headroom both dims (AC #3b)", () => {
    const result = recalibrate("p", [], "leaf", PRIOR); // no data ⇒ source "prior", envelope == PRIOR
    expect(result.source).toBe("prior");
    const { envelope, widened } = fundingEnvelope("p", [], result);
    expect(envelope.tokens).toBe(PRIOR.tokens * MEASUREMENT_HEADROOM);
    expect(envelope.timeMs).toBe(PRIOR.timeMs * MEASUREMENT_HEADROOM);
    expect(widened).toBe(true);
  });

  test("trusted-measured + clean ⇒ funding == price, no headroom (back-compat, AC #3c)", () => {
    const records = Array.from({ length: 5 }, (_, i) => recordOf({ tokens: 1000 * (i + 1), durationMs: 1000 * (i + 1) }));
    const result = recalibrate("p", records, "standard", PRIOR); // measured, 0 censored
    expect(result.source).toBe("measured");
    const { envelope, widened } = fundingEnvelope("p", records, result);
    expect(envelope).toEqual(result.envelope); // verbatim
    expect(widened).toBe(false);
  });

  test("high censored rate auto-widens a MEASURED source (the IA-14 actuation, AC #3d)", () => {
    const records = [
      recordOf({ tokens: 1000 }),
      recordOf({ tokens: 2000 }),
      recordOf({ tokens: 3000 }), // 3 successes ⇒ source stays "measured"
      recordOf({ tokens: 500_000, outcome: "budget-exhausted" }),
      recordOf({ tokens: 500_000, outcome: "budget-exhausted" }),
      recordOf({ tokens: 500_000, outcome: "timed-out" }), // censored rate 3/6 = 0.5 ≥ 1/3
    ];
    const result = recalibrate("p", records, "standard", PRIOR, { minSuccesses: 3 });
    expect(result.source).toBe("measured"); // the PRICE is still the honest measured p90
    expect(result.confidence.censored).toBe(3);

    const { envelope, widened } = fundingEnvelope("p", records, result);
    expect(widened).toBe(true);
    expect(envelope.tokens).toBeGreaterThan(result.envelope.tokens); // funded above the price
    expect(envelope.tokens).toBe(500_000 * MEASUREMENT_HEADROOM);
  });

  test("per-dimension independence: tokens widen while time does not (AC #1)", () => {
    const prior: Budget = { timeMs: 1_000_000, tokens: 100 }; // huge time prior, tiny token prior
    const records = [
      recordOf({ tokens: 100 }),
      recordOf({ tokens: 100 }), // cold-start ⇒ source "prior"
      recordOf({ tokens: 50_000, durationMs: 60_000, outcome: "budget-exhausted" }),
    ];
    const result = recalibrate("p", records, "standard", prior);
    const { envelope, widened } = fundingEnvelope("p", records, result);
    expect(widened).toBe(true);
    // tokens: max(100, 50_000 × 2) = 100_000 — widened
    expect(envelope.tokens).toBe(50_000 * MEASUREMENT_HEADROOM);
    // time: max(1_000_000, 60_000 × 2 = 120_000) = 1_000_000 — NOT widened (price already dominates)
    expect(envelope.timeMs).toBe(1_000_000);
  });

  test("does NOT mutate recalibrate's envelope, percentile, or label (guard ≠ price, AC #2)", () => {
    const records = [
      recordOf({ tokens: 1000 }),
      recordOf({ tokens: 2000 }),
      recordOf({ tokens: 3000 }),
      recordOf({ tokens: 999_999, outcome: "budget-exhausted" }),
      recordOf({ tokens: 999_999, outcome: "timed-out" }), // rate 2/5 = 0.4 ≥ 1/3 ⇒ widens
    ];
    const result = recalibrate("p", records, "standard", PRIOR, { minSuccesses: 3 });
    const envelopeSnapshot = { ...result.envelope };
    const labelBefore = formatEnvelopeLabel(result);

    const funded = fundingEnvelope("p", records, result);
    expect(funded.widened).toBe(true);
    expect(result.envelope).toEqual(envelopeSnapshot); // the priced envelope is untouched
    expect(formatEnvelopeLabel(result)).toBe(labelBefore); // the honest label is untouched
  });

  test("totality: empty and degenerate inputs return a valid positive-int Budget, no throw (AC #1)", () => {
    const coldEmpty = fundingEnvelope("p", [], recalibrate("p", [], "leaf", PRIOR));
    expect(Number.isInteger(coldEmpty.envelope.tokens)).toBe(true);
    expect(Number.isInteger(coldEmpty.envelope.timeMs)).toBe(true);
    expect(coldEmpty.envelope.tokens).toBeGreaterThan(0);
    expect(coldEmpty.envelope.timeMs).toBeGreaterThan(0);

    // A degenerate censored run logging zero tokens with unparseable stamps: still positive, ≥ price.
    const prior: Budget = { timeMs: 10, tokens: 10 };
    const records = [recordOf({ tokens: 0, outcome: "budget-exhausted", startedAt: "bad", endedAt: "bad" })];
    const result = recalibrate("p", records, "leaf", prior);
    const { envelope } = fundingEnvelope("p", records, result);
    expect(envelope.tokens).toBeGreaterThanOrEqual(prior.tokens);
    expect(envelope.timeMs).toBeGreaterThan(0);
  });

  test("constants are the documented bounded values", () => {
    expect(MEASUREMENT_HEADROOM).toBeGreaterThanOrEqual(2);
    expect(Number.isFinite(MEASUREMENT_HEADROOM)).toBe(true);
    expect(CENSORED_WIDEN_RATE).toBeCloseTo(1 / 3, 10);
  });
});
