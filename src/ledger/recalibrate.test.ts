import { describe, expect, test } from "bun:test";
import { buildRunRecord, type RunOutcome, type RunRecord, type RunRecordInput } from "../log/run-log.ts";
import type { Budget } from "../budget/budget.ts";
import {
  COLD_START_MIN_SUCCESSES,
  formatEnvelopeLabel,
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
