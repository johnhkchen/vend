// Macro-wallet core (T-024-01) — the founding gesture made literal (E-024, charter P7).
//
// A *macro* budget: fund a feature-block allowance once, then spend it down across many
// casts. Where `budget.ts` is the PER-CAST contract, the wallet is the depleting envelope
// the autonomous spend loop (T-024-02) draws against and the `vend work` gesture
// (T-024-03) funds. This module is the depleting-budget ALGEBRA and only that.
//
// PURE (house pattern, mirrors budget.ts / recalibrate.ts): every export takes plain
// values and returns fresh ones — no fs, clock, network, or process; it does not import
// the executor seam. It cannot measure elapsed time (no clock) — it only subtracts the
// actual wall-clock it is TOLD a cast cost. The loop/seam measures; the wallet does math.
//
// IA-8 — THE METER MUST NOT LIE ABOUT ITS TWO DENOMINATIONS. The wallet honors both,
// independently, NEVER conflated:
//   ⏱ wall-clock ms — a HARD WALL (a cast that overruns halts mid-flight, no partial
//      value), so `canAfford` refuses a cast that does not fit on time even if it fits on
//      tokens; and
//   ◇ tokens — DETECT-AFTER (a cleared cast's actual burn can overshoot what remained;
//      the cast already ran, the burn is sunk), so `debit` FLOORS remaining at zero and
//      SURFACES the overshoot rather than going negative-silently or throwing.
//
// Under CONCURRENCY (E-048) the two denominations DIVERGE: `debitWave` folds a settled wave by SUMMING
// tokens (every branch's burn is real) but taking the MAX wall-clock (overlapping branches cost ~the
// longest, not their sum) — a single-element wave equals the sequential `debit`.
//
// Reuses `Budget` / `Usage` / `countTokens` from budget.ts (the same two-denomination
// types and the single definition of "spent") — NOT duplicated here. The ONE deliberate
// divergence from budget.ts: `allocate` guards each funded dimension as a positive integer
// (a fund of 0 is a caller error), but a DEBITED `remaining` floors at 0 — a spent wallet
// is legitimately empty (IA-9/10: depletion is a successful terminal state, not a failure).
// So the wallet keeps a local positive-int guard for `allocate` and a separate
// non-negative floor for `debit`, rather than reusing budget's `assertPositiveInt`
// everywhere.

import { type Budget, type Usage, countTokens } from "./budget.ts";

/**
 * A funded, depleting macro-budget. `funded` is the allocation made once at the counter
 * (immutable record, kept so the readout can show spent-of-funded); `remaining` is the
 * live balance that depletes per denomination and floors at zero. Both denominations are
 * carried separately and never conflated (IA-8).
 */
export interface Wallet {
  /** The macro allocation, set once by {@link allocate}; never mutated. */
  readonly funded: Budget;
  /** What is left to spend, per denomination; floors at 0 (never negative). */
  readonly remaining: Budget;
}

/**
 * The outcome of a {@link debit}: the new wallet (remaining floored at zero on both
 * denominations) plus the per-denomination overshoot — the amount by which the actual
 * cost exceeded what remained (0 when the cast fit). For tokens this is the IA-8
 * detect-after andon (the run overshot its remaining envelope and we caught it after);
 * for wall-clock it is a defensive symmetry (the hard wall should keep it at 0). Reported
 * as a `Budget`-shaped pair so the two denominations stay separate — never one bar.
 */
export interface DebitResult {
  readonly wallet: Wallet;
  readonly overshoot: Budget;
}

/** Guard a funded dimension: a positive, finite integer. Local copy of budget.ts's
 *  contract (budget does not export it) — keeps the wallet self-contained. Applies ONLY
 *  to {@link allocate}; a debited remaining is allowed to reach 0 (see {@link floorNonNeg}). */
function assertPositiveInt(n: number, label: string): void {
  if (!Number.isInteger(n) || n <= 0) {
    throw new RangeError(`wallet ${label} must be a positive integer, got ${n}`);
  }
}

/** The debited-remaining coercion: floor at zero (0 is a legitimate spent-wallet state,
 *  the deliberate divergence from {@link assertPositiveInt}). */
function floorNonNeg(n: number): number {
  return Math.max(0, n);
}

/** The per-denomination overshoot: how much `actual` exceeded `remaining` (0 if it fit). */
function overBy(actual: number, remaining: number): number {
  return Math.max(0, actual - remaining);
}

/**
 * Normalize a debit input to a per-denomination delta. A `Budget` actual
 * (`{ timeMs, tokens }`) debits both denominations directly; a `Usage` actual (the seam's
 * `result.usage` duck-type) carries only tokens — its cost is `countTokens` (one source
 * of truth) and it debits tokens only, leaving wall-clock untouched (Usage has no time).
 * Discriminated on the presence of a numeric `timeMs` (only `Budget` has one).
 */
function actualToBudget(actual: Usage | Budget): { tokens: number; timeMs: number } {
  if (typeof (actual as Budget).timeMs === "number") {
    const b = actual as Budget;
    return { tokens: b.tokens, timeMs: b.timeMs };
  }
  return { tokens: countTokens(actual as Usage), timeMs: 0 };
}

/**
 * Fund the wallet once with the feature-block macro budget. Validates each dimension as a
 * positive finite integer (a non-positive or non-finite fund is a caller error, surfaced
 * loudly as `RangeError`). Returns a fresh wallet whose `remaining` starts equal to
 * `funded`. PURE.
 */
export function allocate(macro: Budget): Wallet {
  assertPositiveInt(macro.timeMs, "timeMs");
  assertPositiveInt(macro.tokens, "tokens");
  return { funded: macro, remaining: macro };
}

/**
 * Does the next cast's MEASURED price (E-013's predicted envelope, passed in) fit in what
 * remains? Honest PER DENOMINATION (IA-8): a cast fits only if it fits on BOTH tokens and
 * wall-clock — one that fits on tokens but not on time does NOT fit. `<=` (spending
 * exactly what remains is affordable, mirroring budget's `spent === ceiling` is `ok`). A
 * non-finite predicted naturally fails the comparison → `false` (safe-refuse). PURE.
 */
export function canAfford(wallet: Wallet, predicted: Budget): boolean {
  return (
    predicted.tokens <= wallet.remaining.tokens &&
    predicted.timeMs <= wallet.remaining.timeMs
  );
}

/**
 * Subtract a cleared cast's ACTUAL cost, returning a NEW wallet (immutable — the input is
 * never mutated; a spent wallet is spent). Each denomination floors at zero and the
 * overshoot is surfaced separately (IA-8): for tokens the detect-after overrun, for
 * wall-clock a defensive symmetry. `funded` is carried through unchanged. PURE.
 */
export function debit(wallet: Wallet, actual: Usage | Budget): DebitResult {
  const delta = actualToBudget(actual);
  const rem = wallet.remaining;
  return {
    wallet: {
      funded: wallet.funded,
      remaining: {
        tokens: floorNonNeg(rem.tokens - delta.tokens),
        timeMs: floorNonNeg(rem.timeMs - delta.timeMs),
      },
    },
    overshoot: {
      tokens: overBy(delta.tokens, rem.tokens),
      timeMs: overBy(delta.timeMs, rem.timeMs),
    },
  };
}

/**
 * Fold a CONCURRENT wave's settled actuals into the one wallet, returning a NEW wallet (E-048). The two
 * IA-8 denominations DIVERGE under concurrency: **tokens are SUMMED** (every branch's burn is real —
 * detect-after, IA-8), but **wall-clock is the MAX** of the wave's actual times (overlapping branches
 * cost ~the longest, not their sum — summing would over-charge the wall-clock envelope, the bug this
 * fixes). The combined delta is debited through the single {@link debit} path, so the floor + the
 * per-denomination overshoot are computed exactly ONCE (the collective token overshoot, not per branch).
 * A SINGLE-element wave equals `debit(wallet, actual)` (max-of-one = that one, sum-of-one = that one —
 * back-compat for the linear path), and an EMPTY wave is a no-op (delta `{0,0}`). A `Usage` actual carries
 * no time, contributing `timeMs: 0` that `Math.max` harmlessly ignores. PURE / TOTAL.
 */
export function debitWave(wallet: Wallet, actuals: readonly (Usage | Budget)[]): DebitResult {
  let tokens = 0;
  let timeMs = 0;
  for (const actual of actuals) {
    const delta = actualToBudget(actual);
    tokens += delta.tokens; // SUM — every branch's tokens are real
    timeMs = Math.max(timeMs, delta.timeMs); // MAX — concurrent elapsed ≈ the longest branch
  }
  return debit(wallet, { tokens, timeMs });
}

/** What is left to spend, per denomination. A stable accessor so callers never reach into
 *  the wallet struct. PURE. */
export function remaining(wallet: Wallet): Budget {
  return wallet.remaining;
}

/** Render a token count terse-but-truthful: k-suffixed at ≥ 1000 (e.g. `60k`, `1.2k`),
 *  raw below. Format path only — the algebra keeps integers. */
function fmtTokens(n: number): string {
  if (n < 1000) return String(n);
  const k = n / 1000;
  return `${Number.isInteger(k) ? k : k.toFixed(1)}k`;
}

/** Render a duration in ms as a human span: `45s` / `30m` / `1h30m` / `0s`. Format path
 *  only. Conservative — whole units, biased to the coarsest that stays truthful. */
function fmtMs(ms: number): string {
  if (ms === 0) return "0s";
  if (ms < 1000) return `${ms}ms`;
  const totalSec = Math.round(ms / 1000);
  if (totalSec < 60) return `${totalSec}s`;
  const totalMin = Math.floor(totalSec / 60);
  if (totalMin < 60) return `${totalMin}m`;
  const h = Math.floor(totalMin / 60);
  const m = totalMin % 60;
  return m === 0 ? `${h}h` : `${h}h${m}m`;
}

/**
 * An honest one-line readout of the wallet (IA-8 — the meter must not lie). Shows BOTH
 * denominations, each as `spent/funded · remaining left`, NEVER collapsed to one bar.
 * `spent = funded − remaining` per denomination. PURE.
 */
export function formatWallet(wallet: Wallet): string {
  const f = wallet.funded;
  const r = wallet.remaining;
  const tokensSpent = f.tokens - r.tokens;
  const timeSpent = f.timeMs - r.timeMs;
  const tok = `◇ ${fmtTokens(tokensSpent)}/${fmtTokens(f.tokens)} · ${fmtTokens(r.tokens)} left`;
  const time = `⏱ ${fmtMs(timeSpent)}/${fmtMs(f.timeMs)} · ${fmtMs(r.timeMs)} left`;
  return `${tok}   ${time}`;
}
