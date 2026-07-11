import { describe, expect, test } from "bun:test";
import { buildRunRecord, type RunRecord, type RunRecordInput } from "../log/run-log.ts";
import { auditWalkAway, formatWalkAwayFindings, TIER_ANDON_BUDGET } from "./walk-away.ts";

// T-014-01 walk-away audit: the PURE E1 trust readout, covered to the branch with fabricated
// records (no fs, no clock). Records are built through `buildRunRecord` so the `intervened`
// omit-when-absent idiom is exercised end-to-end — fixtures with AND without the bit (AC #2).

/** A valid record; tests override one field at a time. `intervened` left out ⇒ unrecorded. */
const rec = (over: Partial<RunRecordInput> = {}): RunRecord =>
  buildRunRecord({
    runId: "r",
    play: "decompose-epic",
    epic: "E-001",
    model: "claude-opus-4-8",
    outcome: "success",
    usage: { input_tokens: 100, output_tokens: 100 },
    costUsd: 0.1,
    startedAt: "2026-06-18T12:00:00.000Z",
    endedAt: "2026-06-18T12:05:00.000Z",
    ...over,
  });

describe("auditWalkAway — outcome mix and andon rate", () => {
  test("an empty slice degrades to zeros, never throws", () => {
    const r = auditWalkAway([]);
    expect(r.total).toBe(0);
    expect(r.andonRate).toBe(0);
    expect(r.outcomeMix.success).toBe(0);
    expect(r.cost.tokens).toBeNull();
    expect(r.intervention.rate).toBeNull();
    expect(r.withinBudget).toBe(true); // 0 ≤ budget
  });

  test("all-success ⇒ andon rate 0, full mix totals", () => {
    const r = auditWalkAway([rec(), rec(), rec()]);
    expect(r.total).toBe(3);
    expect(r.outcomeMix.success).toBe(3);
    expect(r.outcomeMix.censored).toBe(0);
    expect(r.andonRate).toBe(0);
  });

  test("non-success outcomes count toward the andon rate; censored is the IA-13 subset", () => {
    const r = auditWalkAway([
      rec({ outcome: "success" }),
      rec({ outcome: "budget-exhausted" }),
      rec({ outcome: "timed-out" }),
      rec({ outcome: "gate-failed" }),
    ]);
    expect(r.andonRate).toBe(3 / 4); // any non-success
    expect(r.outcomeMix.censored).toBe(2); // budget-exhausted + timed-out only
    expect(r.outcomeMix["gate-failed"]).toBe(1);
  });

  test("andon rate is read against the tier budget (within vs over)", () => {
    // 1 stop in 10 = 10%. standard budget is 10% → within; keystone 5% → over.
    const runs = [...Array(9)].map(() => rec()).concat(rec({ outcome: "gate-failed" }));
    expect(auditWalkAway(runs, { tier: "standard" }).withinBudget).toBe(true);
    expect(auditWalkAway(runs, { tier: "keystone" }).withinBudget).toBe(false);
    expect(auditWalkAway(runs).andonBudget).toBe(TIER_ANDON_BUDGET.standard);
  });
});

describe("auditWalkAway — cost vs envelope", () => {
  test("median actual/allocated ratio over envelope-carrying successes", () => {
    // tokens actual are now COST-WEIGHTED (T-068-01-03): 100·1 input + 100·5 output = 600 each;
    // envelopes 400 and 800 → ratios 1.5 and 0.75 → median 1.125.
    const r = auditWalkAway([
      rec({ envelope: { timeMs: 1000, tokens: 400 } }),
      rec({ envelope: { timeMs: 1000, tokens: 800 } }),
    ]);
    expect(r.cost.n).toBe(2);
    expect(r.cost.tokens).toBeCloseTo(1.125, 5);
    // wall-clock is 5 min = 300000 ms vs 1000 ms envelope → ratio 300 each → median 300.
    expect(r.cost.timeMs).toBeCloseTo(300, 5);
  });

  test("censored and envelope-less runs contribute no cost pair", () => {
    const r = auditWalkAway([
      rec({ outcome: "budget-exhausted", envelope: { timeMs: 1000, tokens: 400 } }), // censored → skip
      rec({ envelope: { timeMs: 1000, tokens: 0 } }), // zero allocation → skip
      rec(), // success, no envelope → skip
    ]);
    expect(r.cost.n).toBe(0);
    expect(r.cost.tokens).toBeNull();
    expect(r.cost.timeMs).toBeNull();
  });
});

describe("auditWalkAway — intervention rate and trend", () => {
  test("rate is over REPORTED records only; absent-bit records are excluded", () => {
    const r = auditWalkAway([
      rec({ intervened: true }),
      rec({ intervened: false }),
      rec({ intervened: false }),
      rec(), // unrecorded → not in the sample
    ]);
    expect(r.total).toBe(4);
    expect(r.intervention.reported).toBe(3);
    expect(r.intervention.intervened).toBe(1);
    expect(r.intervention.rate).toBeCloseTo(1 / 3, 5);
  });

  test("no self-reports ⇒ rate null (never a fabricated 0)", () => {
    const r = auditWalkAway([rec(), rec()]);
    expect(r.intervention.reported).toBe(0);
    expect(r.intervention.rate).toBeNull();
    expect(r.intervention.trend.earlier).toBeNull();
    expect(r.intervention.trend.recent).toBeNull();
  });

  test("trend splits the reports in half — a falling intervention rate shows earlier > recent", () => {
    // earlier half intervened, recent half clean → trend 1.0 → 0.0 (toward walk-away).
    const r = auditWalkAway([
      rec({ intervened: true }),
      rec({ intervened: true }),
      rec({ intervened: false }),
      rec({ intervened: false }),
    ]);
    expect(r.intervention.trend.earlier).toBeCloseTo(1, 5);
    expect(r.intervention.trend.recent).toBeCloseTo(0, 5);
  });
});

describe("auditWalkAway — play filter and window", () => {
  test("the play filter scopes the slice", () => {
    const r = auditWalkAway([rec({ play: "a" }), rec({ play: "a" }), rec({ play: "b" })], { play: "a" });
    expect(r.total).toBe(2);
    expect(r.play).toBe("a");
  });

  test("the window keeps only the most recent N", () => {
    const runs = [rec({ outcome: "gate-failed" }), rec(), rec()]; // oldest is the stop
    const r = auditWalkAway(runs, { window: 2 });
    expect(r.total).toBe(2);
    expect(r.andonRate).toBe(0); // the old stop fell outside the window
  });
});

describe("formatWalkAwayFindings — the E1 fragment (AC #3)", () => {
  test("reports the walk-away rate, andon-vs-budget, and cost when data exists", () => {
    const r = auditWalkAway([
      rec({ intervened: false, envelope: { timeMs: 1000, tokens: 400 } }),
      rec({ intervened: false, envelope: { timeMs: 1000, tokens: 400 } }),
      rec({ intervened: true, outcome: "gate-failed" }),
    ]);
    const out = formatWalkAwayFindings(r);
    expect(out).toContain("walk-away rate:");
    expect(out).toContain("andon rate:");
    expect(out).toContain("budget");
    expect(out).toContain("cost vs envelope:");
    expect(out).toContain("outcome mix:");
  });

  test("honest fallbacks: no self-reports, no envelope data", () => {
    const out = formatWalkAwayFindings(auditWalkAway([rec(), rec()]));
    expect(out).toContain("no self-reports yet");
    expect(out).toContain("no envelope data");
  });
});

describe("auditWalkAway — intervention provenance split (T-028-01 AC #2)", () => {
  // Mirrors the real ledger shape: attested back-fill all walk-away, forward 1-intervened.
  const mixed = () => [
    rec({ runId: "a1", intervened: false, intervenedAttested: true }),
    rec({ runId: "a2", intervened: false, intervenedAttested: true }),
    rec({ runId: "a3", intervened: false, intervenedAttested: true }),
    rec({ runId: "f1", intervened: true }), // forward, intervened
    rec({ runId: "f2", intervened: false }), // forward, walk-away
  ];

  test("forward and attested partition on intervenedAttested; combined is unchanged", () => {
    const r = auditWalkAway(mixed());
    // combined (back-compat) — pooled exactly as before the split
    expect(r.intervention.reported).toBe(5);
    expect(r.intervention.intervened).toBe(1);
    expect(r.intervention.rate).toBeCloseTo(1 / 5, 5);
    // attested: 3 back-fill, all walk-away
    expect(r.intervention.attested).toEqual({ reported: 3, intervened: 0, rate: 0 });
    // forward (live): the road a verdict cites — distinct from the combined rate
    expect(r.intervention.forward).toEqual({ reported: 2, intervened: 1, rate: 0.5 });
  });

  test("a forward-only slice leaves attested empty (rate null, never a fabricated 0)", () => {
    const r = auditWalkAway([rec({ intervened: true }), rec({ intervened: false })]);
    expect(r.intervention.forward.reported).toBe(2);
    expect(r.intervention.attested).toEqual({ reported: 0, intervened: 0, rate: null });
  });

  test("the fragment renders the forward vs attested split beside the combined rate", () => {
    const out = formatWalkAwayFindings(auditWalkAway(mixed()));
    expect(out).toContain("forward (live): 50% (1/2 untouched)");
    expect(out).toContain("attested back-fill: 100% (3/3 untouched)");
  });

  test("the split sub-line shows 'none yet' for an empty partition", () => {
    const out = formatWalkAwayFindings(auditWalkAway([rec({ intervened: true }), rec({ intervened: false })]));
    expect(out).toContain("attested back-fill: none yet");
  });
});
