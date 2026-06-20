// The autonomous spend loop's PURE decision core (T-024-02, story S-024-01, epic E-024) — the
// walk-away engine's judgment (charter P4), the play-generic mirror of cast-core.ts / chain-core.ts.
//
// Two deterministic primitives the impure loop (spend.ts) drives:
//   - `fitNext`       — SELECT the highest-leverage candidate that still fits the wallet, walking
//                       the PRE-RANKED board (IA-1 rank IS the policy; no new optimizer, no re-sort).
//   - `shouldContinue`— the THREE clean stops (IA-9): the wallet can't afford the next cast · the
//                       board is cleared · an andon fired. Each a loud, reasoned stop, never a stall.
//
// PURITY (house pattern, the cast-core.ts / chain-core.ts discipline): every import is a TYPE
// (erased) except `canAfford`, which is itself pure. No fs, clock, network, process, seam, or
// `src/play/`. The whole load-bearing branching of the spend loop lives here so it is unit-tested
// as ordinary pure functions (spend-core.test.ts) — the impure shell only wires real edges.
//
// P7 (no overspend past the wall) is enforced HERE at authorization: `fitNext` only ever returns a
// candidate whose PREDICTED price `canAfford`s the wallet, so the loop never casts an unaffordable
// cast. The detect-after token overshoot (actual > predicted) is IA-8's concern, surfaced by the
// wallet's `debit`, not a P7 violation.

import { canAfford, type Wallet } from "../budget/wallet.ts";
import type { Budget } from "../budget/budget.ts";
import type { RunOutcome } from "../log/run-log.ts";

/** Why a spend session ended — the clean-stop vocabulary (IA-9; a stop is a successful refusal,
 *  not a crash). `wallet-exhausted`: candidates remain but none is affordable; `board-cleared`:
 *  nothing left to pull; `andon`: a cast hit a wall (gate/budget/timeout/collision). */
export type StopReason = "board-cleared" | "wallet-exhausted" | "andon";

/** The decision {@link shouldContinue} returns: keep spending, or stop with a reason + a human
 *  `detail` readout (the remaining wallet at the stop, for the Settle summary). */
export type Continuation =
  | { readonly action: "continue" }
  | { readonly action: "stop"; readonly reason: StopReason; readonly detail: string };

/** The distilled board state {@link shouldContinue} judges — no candidate type leaks in, so the
 *  stop logic stays non-generic and trivially testable. The loop computes both from one
 *  {@link fitNext} call per iteration. */
export interface BoardState {
  /** Candidates left unpulled on the board (0 ⇒ cleared). */
  readonly remaining: number;
  /** Did {@link fitNext} find an affordable next candidate? (`next !== null`). */
  readonly fits: boolean;
}

/** One cleared (or andon'd) cast in the session — the per-step record AND the IA-7 production-line
 *  signal T-024-03 renders. */
export interface SpendStep {
  /** `labelOf(next)` — which pull ran against the wallet burn. */
  readonly candidate: string;
  /** The cast's terminal outcome (`success` or an andon code). */
  readonly outcome: RunOutcome;
  /** What the cast actually cost, debited from the wallet — both denominations (IA-8). */
  readonly cost: Budget;
  /** The IA-8 detect-after overrun the debit surfaced (per denomination; 0 when the cast fit). */
  readonly overshoot: Budget;
  /** The wallet's remaining balance after this step's debit. */
  readonly remainingAfter: Budget;
}

/** The structured session result the loop returns for the Settle summary (ticket AC): what cleared,
 *  each cast's cost, the wallet left, and why it stopped. */
export interface SessionResult {
  /** Per-cast steps in execution order — the production line. */
  readonly steps: readonly SpendStep[];
  /** Why the session ended. */
  readonly stop: StopReason;
  /** Human readout of the stop (remaining wallet, etc.). */
  readonly stopDetail: string;
  /** The wallet remaining at the stop. */
  readonly remaining: Budget;
  /** How many casts cleared with `success`. */
  readonly cleared: number;
}

/** Per-step production-line signal (IA-7) — emitted before (`start`) and after (`done`) each cast,
 *  carrying which pull is running and the wallet burn at that moment. T-024-03 renders it. */
export interface StepSignal {
  readonly phase: "start" | "done";
  readonly candidate: string;
  readonly remaining: Budget;
}

/**
 * SELECT the highest-leverage candidate that still fits the wallet. PURE, TOTAL, generic over the
 * candidate type `C` (it never inspects a candidate — only prices and affords it). `candidates` is
 * the board ALREADY ranked highest-leverage-first (IA-1); `fitNext` walks it IN ORDER and returns
 * the FIRST whose predicted price (`priceOf(c)`, E-013's recalibrated envelope) `canAfford`s the
 * wallet — i.e. the highest-leverage candidate that still fits. It SKIPS an unaffordable head to
 * reach an affordable tail ("spend the wallet down"), and returns `null` only when NOTHING fits
 * (the loop reads that as the wallet-exhausted stop). No re-ranking, no scoring — IA-1 rank is the
 * policy. Returning a candidate is the P7 authorization: only an affordable cast is ever offered.
 */
export function fitNext<C>(
  wallet: Wallet,
  candidates: readonly C[],
  priceOf: (c: C) => Budget,
): C | null {
  for (const c of candidates) {
    if (canAfford(wallet, priceOf(c))) return c;
  }
  return null;
}

/**
 * The clean-stop decision — the THREE conditions that end a spend session (IA-9), each with its
 * reason. PURE, TOTAL. Precedence, checked in order:
 *   1. an ANDON fired — `lastOutcome` is a real, non-success outcome (a gate stop / timeout / budget
 *      exhaustion / id-collision from the just-cast step). A fired wall ends the session even if the
 *      board also happens to be empty — the abnormal stop is the more important signal.
 *   2. the BOARD is CLEARED — no candidates remain (`remaining === 0`).
 *   3. the WALLET is EXHAUSTED — candidates remain but none is affordable (`!fits`).
 *   else CONTINUE.
 * `lastOutcome` is `null` on the first iteration (nothing cast yet). `wallet` is consulted for the
 * stop `detail` readout (the remaining balance), so a stop names what was left when it ended.
 */
export function shouldContinue(
  wallet: Wallet,
  board: BoardState,
  lastOutcome: RunOutcome | null,
): Continuation {
  const left = `${wallet.remaining.tokens} tokens / ${wallet.remaining.timeMs} ms left`;
  if (lastOutcome !== null && lastOutcome !== "success") {
    return { action: "stop", reason: "andon", detail: `andon '${lastOutcome}' — ${left}` };
  }
  if (board.remaining === 0) {
    return { action: "stop", reason: "board-cleared", detail: `board cleared — ${left}` };
  }
  if (!board.fits) {
    return {
      action: "stop",
      reason: "wallet-exhausted",
      detail: `wallet can't afford the next pull (${board.remaining} left on the board) — ${left}`,
    };
  }
  return { action: "continue" };
}
