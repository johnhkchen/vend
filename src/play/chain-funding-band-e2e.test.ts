import { describe, expect, test } from "bun:test";
import type { Budget } from "../budget/budget.ts";
import { buildRunRecord, type RunOutcome, type RunRecord, type RunRecordInput } from "../log/run-log.ts";
import {
  formatEnvelopeLabel,
  FUNDING_CEILING_TOKENS,
  FUNDING_FLOOR_TOKENS,
  MEASUREMENT_HEADROOM,
  recalibrate,
} from "../ledger/recalibrate.ts";
import { fundedStepDefault, resolveStepBudgets } from "./chain-propose-decompose-core.ts";
import { allocate, canAfford } from "../budget/wallet.ts";
import { fitNext } from "../engine/spend-core.ts";

// T-053-02: confirm the rational funding band [350k, 700k] (T-053-01) makes the budget rational
// END-TO-END — through the real cast-funding path (`fundedStepDefault` / `resolveStepBudgets`, the rung
// a bare `vend chain` step RUNS under) AND that the price/authorization path stays UNBANDED (the
// macro-wallet AUTHORIZES on the honest p90 sum, never the band — GUARD ≠ PRICE, IA-8 / P7).
//
// T-053-01 proved the band on the UNIT (`fundingEnvelope` directly). This file proves it on the
// COMPOSITION, reconstructing exactly what `work.ts:202-218` does from the pure cores — it is addon-free
// (no value-import of the BAML chain shell), so it runs under `bun test`. No live model: deterministic
// fabricated RunRecord fixtures only (a stub ledger — the real input shape).

/** A RunRecord with a chosen token total / duration / outcome / play — byte-identical to the writer in
 *  recalibrate.test.ts:31 and chain-propose-decompose-core.test.ts:75, so fixture semantics match the
 *  proven unit tests. `tokens` lands in `input_tokens`; `durationMs` is encoded as endedAt − startedAt. */
const recordOf = (
  over: { tokens?: number; durationMs?: number; outcome?: RunOutcome; play?: string } & Partial<RunRecordInput> = {},
): RunRecord => {
  const { tokens = 1000, durationMs = 60_000, outcome = "success", play = "p", ...rest } = over;
  const start = "2026-06-21T00:00:00.000Z";
  const end = new Date(Date.parse(start) + durationMs).toISOString();
  return buildRunRecord({
    runId: "r",
    play,
    epic: "E-053",
    model: "m",
    outcome,
    usage: { input_tokens: tokens },
    startedAt: start,
    endedAt: end,
    ...rest,
  });
};

/** Test-only mirror of work.ts's private `sumBudgets` (work.ts:99-101) — the chain's predicted PRICE is
 *  the per-denomination sum of its two plays' recalibrate envelopes (it casts both). This is the "stub
 *  ledger" price-path driver the ticket scopes in; it reconstructs the work.ts price seam, not new logic. */
const sumPrice = (a: Budget, b: Budget): Budget => ({ timeMs: a.timeMs + b.timeMs, tokens: a.tokens + b.tokens });

// The two plays' static cold-start defaults (propose-epic.ts / decompose-epic.ts) — the `prior` slot.
const PROPOSE_PRIOR: Budget = { timeMs: 1_800_000, tokens: 150_000 };
const DECOMPOSE_PRIOR: Budget = { timeMs: 7_200_000, tokens: 120_000 };

// The real numbers the epic exists for:
const PROPOSE_P90 = 169_873; // the well-calibrated propose envelope that budget-exhausted on a tail draw
const PROPOSE_EXHAUSTED_ACTUAL = 176_101; // the 3.6% tail draw that halted the `vend chain` at the 170k guard
const DECOMPOSE_CENSORED = 366_500; // an E-051 censored actual; × MEASUREMENT_HEADROOM(2) = 733_000 self-fund

/** 10 ascending successes, 0 censored ⇒ `source: "measured"`; the 9th value (nearest-rank p90 at
 *  idx = ceil(0.9·10)−1 = 8) is exactly PROPOSE_P90, so the priced envelope is the bare ~170k p90. */
const proposeRecords = (): RunRecord[] => {
  const tokens = [1_000, 2_000, 3_000, 4_000, 5_000, 6_000, 7_000, 8_000, PROPOSE_P90, 200_000];
  return tokens.map((t) => recordOf({ play: "propose-epic", tokens: t }));
};

/** 2 successes (< cold-start threshold ⇒ `source: "prior"`) + 1 censored run logging DECOMPOSE_CENSORED
 *  — the under-calibrated shape whose funding computes ~733k (capped by the 700k ceiling). */
const decomposeRecords = (): RunRecord[] => [
  recordOf({ play: "decompose-epic", tokens: 60_000 }),
  recordOf({ play: "decompose-epic", tokens: 60_000 }),
  recordOf({ play: "decompose-epic", tokens: DECOMPOSE_CENSORED, outcome: "budget-exhausted" }),
];

describe("T-053-02 — rational band, end-to-end through the cast-funding path", () => {
  describe("AC#1 — the floor fixes the `vend chain` halt", () => {
    test("well-calibrated propose p90 ~170k funds at the 350k floor through fundedStepDefault", () => {
      const records = proposeRecords();

      // The PRICE is the bare measured p90 — too tight: a tail draw exceeds it (the halt).
      const priced = recalibrate("propose-epic", records, "standard", PROPOSE_PRIOR);
      expect(priced.source).toBe("measured");
      expect(priced.envelope.tokens).toBe(PROPOSE_P90);
      expect(PROPOSE_EXHAUSTED_ACTUAL).toBeGreaterThan(priced.envelope.tokens); // 176k > the 170k guard

      // The FUNDING (default band, the real cast path) floors it so the tail draw never starves the cast.
      const funded = fundedStepDefault(records, "propose-epic", PROPOSE_PRIOR);
      expect(funded.tokens).toBe(FUNDING_FLOOR_TOKENS); // 350k
      expect(funded.tokens).toBeGreaterThanOrEqual(350_000);
      expect(PROPOSE_EXHAUSTED_ACTUAL).toBeLessThan(funded.tokens); // 176k now FITS — the halt cannot recur
      expect(funded.timeMs).toBe(priced.envelope.timeMs); // wall-clock untouched (tokens-only band)
    });

    test("the banded funded default is what resolveStepBudgets casts the step under (the path, not just the helper)", () => {
      const fundedPropose = fundedStepDefault(proposeRecords(), "propose-epic", PROPOSE_PRIOR);
      const fundedDecompose = fundedStepDefault(decomposeRecords(), "decompose-epic", DECOMPOSE_PRIOR);

      // No override ⇒ each step casts under its funded default. The band rode the rung, not a side path.
      const resolved = resolveStepBudgets({}, fundedPropose, fundedDecompose);
      expect(resolved.proposeBudget).toEqual(fundedPropose);
      expect(resolved.proposeBudget.tokens).toBe(FUNDING_FLOOR_TOKENS);
    });
  });

  describe("AC#2 — the ceiling caps the runaway", () => {
    test("under-calibrated decompose funding ~733k is capped at exactly the 700k ceiling", () => {
      const records = decomposeRecords();

      const priced = recalibrate("decompose-epic", records, "standard", DECOMPOSE_PRIOR);
      expect(priced.source).toBe("prior"); // 2 successes < cold-start threshold

      // Funding would compute max(120k, 366_500 × 2 = 733_000) = 733_000 → capped at the hard P7 wall.
      const funded = fundedStepDefault(records, "decompose-epic", DECOMPOSE_PRIOR);
      expect(funded.tokens).toBe(FUNDING_CEILING_TOKENS); // 700k, not 733k
      expect(funded.tokens).toBeLessThan(DECOMPOSE_CENSORED * MEASUREMENT_HEADROOM); // strictly capped
    });
  });

  describe("AC#3 — GUARD ≠ PRICE: authorize on the honest price, not the banded funding", () => {
    // Reconstruct work.ts:202-218: recalibrate each step → sum the PRICE → gate the wallet on it.
    const proposeResult = recalibrate("propose-epic", proposeRecords(), "standard", PROPOSE_PRIOR);
    const decomposeResult = recalibrate("decompose-epic", decomposeRecords(), "standard", DECOMPOSE_PRIOR);
    const price = sumPrice(proposeResult.envelope, decomposeResult.envelope);

    const BANDED_FUNDING_SUM = FUNDING_FLOOR_TOKENS + FUNDING_CEILING_TOKENS; // 1_050_000 — NOT the gate base
    const ampleTime = Number.MAX_SAFE_INTEGER; // keep time out of the way so only tokens decide canAfford

    test("the authorization PRICE is the unbanded p90 sum, never the banded funding sum", () => {
      expect(price.tokens).toBe(PROPOSE_P90 + DECOMPOSE_PRIOR.tokens); // 289_873 — the honest p90 sum
      expect(price.tokens).toBeLessThan(BANDED_FUNDING_SUM); // the band never leaked into the gate base
    });

    test("a wallet sized BETWEEN price and banded funding still affords (gates on price)", () => {
      const wallet = allocate({ timeMs: ampleTime, tokens: 300_000 }); // 289_873 < 300k < 1_050_000
      expect(canAfford(wallet, price)).toBe(true);
      expect(fitNext(wallet, ["signal"], () => price)).toBe("signal"); // authorized — banded funding would refuse
    });

    test("a wallet BELOW price is refused (gates on the real price magnitude, not the 350k floor)", () => {
      const wallet = allocate({ timeMs: ampleTime, tokens: 250_000 }); // 250k < 289_873
      expect(canAfford(wallet, price)).toBe(false);
      expect(fitNext(wallet, ["signal"], () => price)).toBeNull();
    });

    test("the shelf quote / `formatEnvelopeLabel` is untouched by funding (IA-8)", () => {
      const labelBefore = formatEnvelopeLabel(proposeResult);
      const envelopeBefore = { ...proposeResult.envelope };

      // Running the FUNDING path (both steps) must not move the quoted estimate or its honest label.
      fundedStepDefault(proposeRecords(), "propose-epic", PROPOSE_PRIOR);
      fundedStepDefault(decomposeRecords(), "decompose-epic", DECOMPOSE_PRIOR);

      expect(formatEnvelopeLabel(proposeResult)).toBe(labelBefore);
      expect(proposeResult.envelope).toEqual(envelopeBefore);
    });
  });
});
