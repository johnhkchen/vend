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
 * Headroom the per-cast wall-clock kill-switch gets ABOVE the measured price. The price
 * (`budget.timeMs`, the value-tier p90 from `recalibrate.ts`) is what affordability
 * (`canAfford`/`fitNext`) and the shelf/envelope surfaces read — IA-8, the meter must not
 * lie, so the price is untouched. The kill-switch is only a runaway-guard, so it runs at
 * `price × this factor`. Set to 2 (double the envelope) from E-037's censored-margin data:
 * the censored `propose-epic` runs were within ~1% of their 72,785 ms p90, so even small
 * slack clears THOSE — but 2× is chosen so the next heavier signal isn't immediately
 * re-censored (one warranted factor for the class, not a patch for two data points).
 *
 * WHY THIS EXISTS — the censoring ratchet. The price is the tier percentile over SUCCESSFUL
 * runs (`recalibrate`); a `timed-out` run is right-CENSORED (`CENSORED_OUTCOMES`,
 * `recalibrate.ts`) — counted, but EXCLUDED from the percentile sample. So a cast killed AT
 * the envelope can never enter the sample that would RAISE the envelope: p90-as-timeout caps
 * itself and prevents the very data that would lift it. Raising `TIER_PERCENTILE` alone
 * CANNOT fix this — the tail is censored out of its own sample (E-037's successes sit at
 * 66.9–72.8 s, the killed runs at ~72–73 s), so a higher percentile only re-reads the same
 * truncated sample with no observation above the wall to bind to. Giving the kill-switch
 * headroom lets a heavy cast FINISH and land a SUCCESS that enters the sample honestly.
 *
 * DEFERRED (IA-14, the fuller rung this surgical fix sits beneath): auto-widen the envelope
 * when the censored RATE is high (data-driven, possibly per-tier) instead of one constant.
 */
export const TIMEOUT_HEADROOM = 2;

/**
 * Derive the seam's `timeoutMs` from the budget's wall-clock allowance: the measured price
 * (`budget.timeMs`) × {@link TIMEOUT_HEADROOM}. This is the per-cast runaway-guard, NOT the
 * price — see TIMEOUT_HEADROOM for why the guard gets headroom (the censoring ratchet) while
 * the price stays the honest p90. `assertPositiveInt` validates the PRICE (an invalid
 * allocation is a caller error, surfaced loudly); `Math.ceil` keeps the headroomed result a
 * positive integer (the budget-dimension contract) for any future fractional factor. Budget
 * cannot measure elapsed time — it only hands the runner the number to give the seam.
 */
export function timeoutMsFor(budget: Budget): number {
  assertPositiveInt(budget.timeMs, "timeMs");
  return Math.ceil(budget.timeMs * TIMEOUT_HEADROOM);
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
