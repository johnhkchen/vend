// Budget control (T-001-03) — the metered-run hard contract (charter P7).
//
// A run is allocated time + tokens up front and is accountable to them both ways.
// This module is PURE: no network, no fs, no clock, no child process. It does not
// import the executor seam (T-001-02) — budget is *composed* by the runner, never
// welded to the seam. Two faces:
//
//   (a) time  — `timeoutMsFor(budget)` derives the wall-clock allowance the runner
//               hands the seam as `timeoutMs`. The seam (not budget) enforces the
//               stop via SIGKILL → ClaudeTimeoutError; budget has no clock.
//   (b) tokens — `check(budget, usage)` compares the run's `result.usage` against
//               the ceiling and returns a typed `ok | exhausted` outcome. Token
//               exhaustion is the *expected* terminal state of a metered run, so it
//               is a returned andon (carrying the overage), not a thrown error.

/** The allocation made at the counter: wall-clock allowance + token ceiling. */
export interface Budget {
  /** Wall-clock allowance in ms; becomes the seam's `timeoutMs`. */
  readonly timeMs: number;
  /** Token ceiling the run's total usage is checked against. */
  readonly tokens: number;
}

/**
 * Structural shape of the dispense `result.usage` (the seam's terminal message).
 * Declared locally — never imported from the executor — so budget stays
 * seam-agnostic; the seam's usage satisfies this by duck-typing. Any field may be
 * absent on a given message, so all are optional and coerced `undefined → 0`.
 */
export interface Usage {
  readonly input_tokens?: number;
  readonly output_tokens?: number;
  readonly cache_read_input_tokens?: number;
  readonly cache_creation_input_tokens?: number;
}

/** Stable andon code for token exhaustion — the token analogue of the seam's
 *  `ETIMEDOUT_CLAUDE`. The runner switches on this to surface the outcome. */
export const BUDGET_EXHAUSTED = "EBUDGET_EXHAUSTED";

/** The verdict of a token check. A value, not an exception: the run completed and
 *  this reports whether it stayed within its allocation, carrying the numbers the
 *  runner needs to log either way. */
export type BudgetOutcome =
  | {
      readonly status: "ok";
      readonly spent: number;
      readonly ceiling: number;
      readonly remaining: number;
    }
  | {
      readonly status: "exhausted";
      readonly code: typeof BUDGET_EXHAUSTED;
      readonly spent: number;
      readonly ceiling: number;
      readonly overage: number;
    };

/** Coerce a possibly-absent token count to a finite number, defaulting to 0. */
function num(v: number | undefined): number {
  return typeof v === "number" && Number.isFinite(v) ? v : 0;
}

/** Guard a budget dimension: a positive, finite integer. A non-positive or
 *  non-finite allocation is a caller error, surfaced loudly at the boundary. */
function assertPositiveInt(n: number, label: string): void {
  if (!Number.isInteger(n) || n <= 0) {
    throw new RangeError(`budget ${label} must be a positive integer, got ${n}`);
  }
}

/**
 * Derive the seam's `timeoutMs` from the budget's wall-clock allowance. Today an
 * identity-with-validation; the named seam gives time-policy one home if it ever
 * grows (e.g. reserving a shutdown margin). Budget cannot measure elapsed time —
 * it only hands the runner the number to give the seam.
 */
export function timeoutMsFor(budget: Budget): number {
  assertPositiveInt(budget.timeMs, "timeMs");
  return budget.timeMs;
}

/**
 * The single definition of "spent": the sum of all four token sub-counts. A hard
 * contract must not undercount — every token in any bucket (incl. cache traffic)
 * is a token the run moved through the model. Exported so the runner/log share one
 * source of truth for the number.
 */
export function countTokens(usage: Usage): number {
  return (
    num(usage.input_tokens) +
    num(usage.output_tokens) +
    num(usage.cache_read_input_tokens) +
    num(usage.cache_creation_input_tokens)
  );
}

/**
 * Check a completed run's usage against the token ceiling. `spent === ceiling` is
 * `ok` (spending exactly the allowance honors the contract); only `spent > ceiling`
 * is `exhausted`, carrying the overage as a typed, named andon the runner surfaces.
 */
export function check(budget: Budget, usage: Usage): BudgetOutcome {
  assertPositiveInt(budget.tokens, "tokens");
  const ceiling = budget.tokens;
  const spent = countTokens(usage);
  if (spent <= ceiling) {
    return { status: "ok", spent, ceiling, remaining: Math.max(0, ceiling - spent) };
  }
  return {
    status: "exhausted",
    code: BUDGET_EXHAUSTED,
    spent,
    ceiling,
    overage: spent - ceiling,
  };
}
