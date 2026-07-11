import { describe, expect, test } from "bun:test";
import type { Budget } from "../budget/budget.ts";
import { buildRunRecord, type RunOutcome, type RunRecord, type RunRecordInput } from "../log/run-log.ts";
import { MEASUREMENT_HEADROOM, recalibrate } from "../ledger/recalibrate.ts";
import { CHAIN_DEFAULT_TIER, fundedStepDefault, resolveStepBudgets } from "./chain-propose-decompose-core.ts";

// T-025-01: the pure proof of the chain's per-step budget selection (AC#3). Addon-free — imports only
// the pure core + the `Budget` type, so it runs under `bun test` without loading either play's native
// addon (the reason the selection logic lives in the core, not the impure shell). Proves the rung
// order `per-step ?? uniform ?? play default` AND that propose/decompose resolve INDEPENDENTLY — the
// authorization-vs-execution gap the E-024 live sweep diagnosed.

// Stand-in play defaults (the cold-start fallbacks). Distinct values per denomination per step so a
// wrong rung or a crossed step is observable in the assertion.
const PROPOSE_DEFAULT: Budget = { timeMs: 1_800_000, tokens: 150_000 };
const DECOMPOSE_DEFAULT: Budget = { timeMs: 7_200_000, tokens: 120_000 };

describe("resolveStepBudgets — per-step rung order (per-step ?? uniform ?? default)", () => {
  test("no overrides ⇒ each step takes its own play default (back-compat / cold start)", () => {
    const r = resolveStepBudgets({}, PROPOSE_DEFAULT, DECOMPOSE_DEFAULT);
    expect(r.proposeBudget).toEqual(PROPOSE_DEFAULT);
    expect(r.decomposeBudget).toEqual(DECOMPOSE_DEFAULT);
  });

  test("uniform `budget` only ⇒ BOTH steps take it (existing --budget behavior)", () => {
    const uniform: Budget = { timeMs: 3_600_000, tokens: 200_000 };
    const r = resolveStepBudgets({ budget: uniform }, PROPOSE_DEFAULT, DECOMPOSE_DEFAULT);
    expect(r.proposeBudget).toEqual(uniform);
    expect(r.decomposeBudget).toEqual(uniform);
  });

  test("per-step on one step only ⇒ that step takes per-step, the other falls to its default", () => {
    const proposeOnly: Budget = { timeMs: 1_900_000, tokens: 227_000 };
    const r = resolveStepBudgets({ proposeBudget: proposeOnly }, PROPOSE_DEFAULT, DECOMPOSE_DEFAULT);
    expect(r.proposeBudget).toEqual(proposeOnly); // per-step wins
    expect(r.decomposeBudget).toEqual(DECOMPOSE_DEFAULT); // independent: unset ⇒ default
  });

  test("per-step overrides the uniform `budget` where present; uniform fills the unset step", () => {
    const uniform: Budget = { timeMs: 3_600_000, tokens: 200_000 };
    const proposeOver: Budget = { timeMs: 1_900_000, tokens: 227_000 };
    const r = resolveStepBudgets(
      { budget: uniform, proposeBudget: proposeOver },
      PROPOSE_DEFAULT,
      DECOMPOSE_DEFAULT,
    );
    expect(r.proposeBudget).toEqual(proposeOver); // per-step beats uniform
    expect(r.decomposeBudget).toEqual(uniform); // unset per-step ⇒ uniform, not default
  });

  test("both per-step set ⇒ each takes its own, defaults untouched (the `vend work` 227k/227k case)", () => {
    const proposeEnv: Budget = { timeMs: 1_900_000, tokens: 227_000 };
    const decomposeEnv: Budget = { timeMs: 7_300_000, tokens: 227_000 };
    const r = resolveStepBudgets(
      { proposeBudget: proposeEnv, decomposeBudget: decomposeEnv },
      PROPOSE_DEFAULT,
      DECOMPOSE_DEFAULT,
    );
    expect(r.proposeBudget).toEqual(proposeEnv);
    expect(r.decomposeBudget).toEqual(decomposeEnv);
    // both denominations carried, not just tokens
    expect(r.proposeBudget.timeMs).toBe(1_900_000);
    expect(r.decomposeBudget.timeMs).toBe(7_300_000);
  });
});

// T-050-02: the MEASUREMENT-FUNDED default rung. `fundedStepDefault` composes the two pure cores
// (recalibrate → fundingEnvelope) so the bare `vend chain` default that censored the E-049 decompose
// (120k) is funded over its observed lower bound instead. Addon-free — REAL recalibrate output feeds
// fundingEnvelope, exactly as the shell wires it. The headline case is the ticket's deterministic
// E-049-shaped proof (AC#4): no live model, just fabricated RunRecord fixtures.

/** A RunRecord with a chosen token total and outcome (mirrors recalibrate.test.ts's `recordOf`).
 *  Tokens land in `input_tokens`; the default duration encodes a parseable wall-clock. */
const recordOf = (
  over: { tokens?: number; durationMs?: number; outcome?: RunOutcome; play?: string } & Partial<RunRecordInput> = {},
): RunRecord => {
  const { tokens = 1000, durationMs = 60_000, outcome = "success", play = "decompose-epic", ...rest } = over;
  const start = "2026-06-21T00:00:00.000Z";
  const end = new Date(Date.parse(start) + durationMs).toISOString();
  return buildRunRecord({
    runId: "r",
    play,
    epic: "E-050",
    model: "m",
    outcome,
    usage: { input_tokens: tokens },
    startedAt: start,
    endedAt: end,
    ...rest,
  });
};

describe("fundedStepDefault — measurement-funded default rung (T-050-02)", () => {
  // decompose-epic's static play default (decompose-epic.ts:197) — the E-049 "120k prior".
  const DECOMPOSE_PRIOR: Budget = { timeMs: 7_200_000, tokens: 120_000 };

  // A funding band wide enough to never bind, so these cases keep asserting the HEADROOM contract in
  // isolation — the E-053 rational band (which would otherwise floor these sub-350k values) is a
  // separate contract, owned by recalibrate's own band tests + the T-053-02 end-to-end confirmation.
  const WIDE_BAND = { funding: { floorTokens: 1, ceilingTokens: Number.MAX_SAFE_INTEGER } } as const;

  test("E-049 shape: a 120k prior + a censored 265k decompose ⇒ funded over the wall, NOT re-censored (AC#4)", () => {
    const records = [
      recordOf({ tokens: 60_000 }),
      recordOf({ tokens: 60_000 }), // 2 successes < cold-start threshold ⇒ source "prior"
      recordOf({ tokens: 264_866, outcome: "budget-exhausted" }), // the logged lower bound, right-censored
    ];

    // OLD path (what the default rung used to be): recalibrate alone hands back the 120k prior — and
    // the next decompose is funded at 120k again, re-censoring. The ratchet.
    expect(recalibrate("decompose-epic", records, "standard", DECOMPOSE_PRIOR).envelope.tokens).toBe(120_000);

    // NEW path: funded ≥ the observed 264_866 × headroom — room to finish and RECORD a success.
    const funded = fundedStepDefault(records, "decompose-epic", DECOMPOSE_PRIOR, CHAIN_DEFAULT_TIER, WIDE_BAND);
    expect(funded.tokens).toBe(264_866 * MEASUREMENT_HEADROOM);
    expect(funded.tokens).toBeGreaterThanOrEqual(265_000);
  });

  test("price stays honest: the sibling recalibrate envelope is untouched (guard ≠ price, AC#2)", () => {
    const records = [
      recordOf({ tokens: 60_000 }),
      recordOf({ tokens: 60_000 }),
      recordOf({ tokens: 264_866, outcome: "budget-exhausted" }),
    ];
    const priced = recalibrate("decompose-epic", records, "standard", DECOMPOSE_PRIOR).envelope;
    fundedStepDefault(records, "decompose-epic", DECOMPOSE_PRIOR);
    // The quote is whatever recalibrate returns — funding never mutates it.
    expect(recalibrate("decompose-epic", records, "standard", DECOMPOSE_PRIOR).envelope).toEqual(priced);
    expect(priced.tokens).toBe(120_000);
  });

  test("cold-start, no history ⇒ prior × headroom (room for a first run to record, AC#3b)", () => {
    const funded = fundedStepDefault([], "decompose-epic", DECOMPOSE_PRIOR, CHAIN_DEFAULT_TIER, WIDE_BAND);
    expect(funded.tokens).toBe(120_000 * MEASUREMENT_HEADROOM);
    expect(funded.timeMs).toBe(7_200_000 * MEASUREMENT_HEADROOM);
  });

  test("well-calibrated (measured, 0 censored) ⇒ funding == the measured price, no headroom (back-compat, AC#3c)", () => {
    const records = Array.from({ length: 5 }, (_, i) => recordOf({ tokens: 1000 * (i + 1), durationMs: 1000 * (i + 1) }));
    const priced = recalibrate("decompose-epic", records, "standard", DECOMPOSE_PRIOR);
    expect(priced.source).toBe("measured");
    const funded = fundedStepDefault(records, "decompose-epic", DECOMPOSE_PRIOR, CHAIN_DEFAULT_TIER, WIDE_BAND);
    expect(funded).toEqual(priced.envelope); // verbatim — a well-calibrated default is unchanged
  });

  test("an explicit override still WINS over the funded default (rung precedence holds, AC#1)", () => {
    const records = [
      recordOf({ tokens: 60_000 }),
      recordOf({ tokens: 60_000 }),
      recordOf({ tokens: 264_866, outcome: "budget-exhausted" }),
    ];
    const fundedDecompose = fundedStepDefault(records, "decompose-epic", DECOMPOSE_PRIOR);
    const fundedPropose = fundedStepDefault(records, "propose-epic", { timeMs: 1_800_000, tokens: 150_000 });
    const override: Budget = { timeMs: 9_000_000, tokens: 300_000 };
    const r = resolveStepBudgets({ decomposeBudget: override }, fundedPropose, fundedDecompose);
    expect(r.decomposeBudget).toEqual(override); // the human's ceiling wins, not the funded default
    expect(r.proposeBudget).toEqual(fundedPropose); // the unset step still takes its funded default
  });

  test("totality + the documented tier: empty ⇒ valid positive-int Budget; tier is the neutral middle", () => {
    const funded = fundedStepDefault([], "propose-epic", { timeMs: 1, tokens: 1 });
    expect(Number.isInteger(funded.tokens)).toBe(true);
    expect(Number.isInteger(funded.timeMs)).toBe(true);
    expect(funded.tokens).toBeGreaterThan(0);
    expect(funded.timeMs).toBeGreaterThan(0);
    expect(CHAIN_DEFAULT_TIER).toBe("standard");
  });
});
