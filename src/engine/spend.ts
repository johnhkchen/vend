// The autonomous spend loop's IMPURE shell (T-024-02, story S-024-01, epic E-024) — the walk-away
// engine made real (charter P4): fund a wallet once, then spend it down across casts until a clean
// stop. The impure verb over the tested pure core (spend-core.ts), exactly as `castChain` is the
// impure shell over the pure `runChain`.
//
// THE LOOP: select (`fitNext`) → check the clean stops (`shouldContinue`) → cast (the injected
// `castOne`, a `castChain` pull→clear) → DEBIT the wallet by the cast's ACTUALS → drop the pulled
// candidate → repeat. It returns a structured `SessionResult` (what cleared, per-cast cost, wallet
// remaining, stop reason) for the Settle summary, and emits the IA-7 production-line signal per step.
//
// ENGINE ⊥ PLAY (E-007 keystone): the real pull→clear chain (`castProposeDecomposeChain`) lives in
// `src/play/`, which the engine must NEVER import. So the cast is INJECTED — `spendDown` takes a
// `castOne` thunk (and a `priceOf`/`labelOf`), precisely as `castChain` takes injected `cast`
// thunks. T-024-03 (the `vend work` gesture, at the composition layer) injects the real chain +
// `recalibrate`. `ChainResult` is imported TYPE-ONLY, so this module pulls no executor seam into a
// caller's graph (the chain-core.ts discipline).
//
// P7 (no overspend past the wall): the ONLY cast authorized is a `fitNext` result, which is
// affordable on its predicted price — so the loop never authorizes a cast the wallet can't afford.
// An andon'd cast still burned cost, so it is DEBITED too (detect-after tokens / hard-wall time,
// IA-8), and `shouldContinue` then ends the session as a successful refusal (IA-9), never a crash.
//
// PURITY: IMPURE (awaits `castOne`; the fallback reads the ledger). NOT unit-tested — its decision
// logic is the tested core, its debit is the tested wallet (wallet.test.ts), its cast is the tested
// chain. Proven live when T-024-03 wires it, the `castChain` / chain-propose-decompose.ts stance.

import { debit, remaining, type Wallet } from "../budget/wallet.ts";
import { countTokens, type Budget } from "../budget/budget.ts";
import type { RunOutcome, ReadResult } from "../log/run-log.ts";
import type { ChainResult } from "./chain.ts";
import { fitNext, shouldContinue, type SessionResult, type SpendStep, type StepSignal } from "./spend-core.ts";

// One engine entry for the whole spend surface — re-export the pure core (the cast.ts / chain.ts
// re-export idiom), so a caller has a single import for `spendDown` + `fitNext`/`shouldContinue`/types.
export * from "./spend-core.ts";

/** The inputs to {@link spendDown} — the wallet, the pre-ranked board, and the injected edges that
 *  keep the engine decoupled from the board's concrete shape and the play layer. Generic over the
 *  candidate type `C`; the loop never inspects a candidate, only prices / casts / labels it. */
export interface SpendLoopParams<C> {
  /** The funded macro-wallet to spend down (T-024-01). */
  readonly wallet: Wallet;
  /** The board's work, ALREADY ranked highest-leverage-first (IA-1). The loop never re-sorts. */
  readonly candidates: readonly C[];
  /** The predicted price of a pull — E-013's recalibrated envelope (injected; not built here). */
  readonly priceOf: (c: C) => Budget;
  /** Cast one candidate end to end — the `castChain` pull→clear (injected; engine ⊥ play). */
  readonly castOne: (c: C) => Promise<ChainResult>;
  /** A stable label for a candidate — the production-line signal + session record. */
  readonly labelOf: (c: C) => string;
  /** Optional IA-7 production-line emit, called before (`start`) and after (`done`) each cast. */
  readonly onStep?: (s: StepSignal) => void;
}

/**
 * Spend the wallet down. The walk-away loop: while the clean stops permit, pull the highest-leverage
 * AFFORDABLE candidate, cast it, debit the wallet by the cast's actuals, and drop it from the board.
 * Returns the structured {@link SessionResult} for the Settle summary. IMPURE (awaits `castOne`);
 * NOT unit-tested (its logic is the tested core + wallet). See the module header for the contract.
 */
export async function spendDown<C>(params: SpendLoopParams<C>): Promise<SessionResult> {
  const { priceOf, castOne, labelOf, onStep } = params;
  let wallet = params.wallet;
  let board: readonly C[] = params.candidates;
  let lastOutcome: RunOutcome | null = null;
  const steps: SpendStep[] = [];

  for (;;) {
    // SELECT the highest-leverage candidate that still fits (P7 authorization), then decide whether
    // any of the three clean stops has been reached. Both derive from this one selection.
    const next = fitNext(wallet, board, priceOf);
    const cont = shouldContinue(wallet, { remaining: board.length, fits: next !== null }, lastOutcome);
    if (cont.action === "stop") {
      return {
        steps,
        stop: cont.reason,
        stopDetail: cont.detail,
        remaining: remaining(wallet),
        cleared: steps.filter((s) => s.outcome === "success").length,
      };
    }
    // `cont.action === "continue"` ⇒ `fits` was true ⇒ `next` is non-null. The cast below is the
    // single authorized, affordable cast.
    const candidate = next as C;
    const label = labelOf(candidate);

    onStep?.({ phase: "start", candidate: label, remaining: remaining(wallet) });

    const result = await castOne(candidate);
    lastOutcome = result.outcome;

    // DEBIT by what the cast ACTUALLY cost (not its predicted envelope) — even an andon'd cast
    // burned cost. `debit` floors at zero and surfaces the IA-8 detect-after token overshoot.
    const cost = await sumActuals(result);
    const debited = debit(wallet, cost);
    wallet = debited.wallet;

    steps.push({
      candidate: label,
      outcome: result.outcome,
      cost,
      overshoot: debited.overshoot,
      remainingAfter: remaining(wallet),
    });

    // Drop the pulled candidate from the board (fresh array; the input is never mutated). A pulled
    // candidate is consumed whether it cleared or andon'd — an andon ends the session next iteration.
    board = board.filter((c) => c !== candidate);

    onStep?.({ phase: "done", candidate: label, remaining: remaining(wallet) });
  }
}

/**
 * Sum a chain's per-step actuals into one {@link Budget} the wallet debits by. A `castChain` is one
 * pull→clear; its cost is the SUM of its steps. Tokens come from each step's `actuals.usage` (via
 * `countTokens`, the one definition of "spent"); wall-clock from `actuals.wallMs`. Both
 * denominations summed INDEPENDENTLY (IA-8, never conflated).
 *
 * FALLBACK (the ticket's "log read is the fallback if a cast surfaces none"): a step that surfaced
 * no `actuals` — a future executor, not today's `castPlay`, which always populates it — is recovered
 * from the ledger by `runId` (`totalTokens` + `wallClockMs`). The ledger read is lazy (imported only
 * when needed) so the common path stays off fs. A step recoverable by neither contributes 0 — honest
 * (the wallet simply doesn't move on what we couldn't measure), never a phantom charge.
 */
async function sumActuals(result: ChainResult): Promise<Budget> {
  let tokens = 0;
  let timeMs = 0;
  let fallback: ReadResult | null = null;

  for (const step of result.steps) {
    if (step.actuals) {
      tokens += countTokens(step.actuals.usage);
      timeMs += step.actuals.wallMs;
      continue;
    }
    // No actuals on the summary — recover from the ledger record for this runId.
    const { loadRunLog, totalTokens, wallClockMs } = await import("../log/run-log.ts");
    fallback ??= await loadRunLog();
    const record = fallback.records.find((r) => r.runId === step.runId);
    if (record) {
      tokens += totalTokens(record);
      timeMs += wallClockMs(record) ?? 0;
    }
  }

  return { tokens, timeMs };
}
