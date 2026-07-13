// The funding counter's PURE underfunding decision (T-074-02-01) — given the budget
// actually funded and a play's measured envelope floor, decide whether the mismatch is
// severe enough to name before dispatch. The caller owns provenance: it invokes this only
// for a measured floor; cold-start suppression, printing, and warn-don't-block dispatch
// belong to T-074-02-02.
//
// PURE/addon-free: plain budgets in, optional text out; no fs, clock, process, network, or
// executor import. `Budget` is type-only, so this module has no runtime dependency edge.

import type { Budget } from "../budget/budget.ts";

/** A funded token ceiling is materially under the measured floor only when it is less
 * than half that floor. Two is the repository's existing warranted class-level headroom
 * magnitude; using it here catches severe misallocation without warning on modest,
 * deliberate overrides near the floor. */
export const UNDERFUNDING_FACTOR = 2;

/** Render tokens human-scale while preserving the field-report's meaningful half-thousand
 * (`12_500` → `12.5k`, `400_000` → `400k`). Format path only; decisions use raw values. */
function formatTokens(tokens: number): string {
  if (tokens < 1000) return String(tokens);
  const thousands = tokens / 1000;
  return `${Number.isInteger(thousands) ? thousands : Number(thousands.toFixed(1))}k`;
}

/**
 * Return a ready-to-print advisory warning iff `funded.tokens` is less than the measured
 * token floor by {@link UNDERFUNDING_FACTOR}. Exactly half, nearer-to-floor, at-floor, and
 * above-floor allocations are silent. Wall-clock is deliberately not compared: this
 * ticket's contract is the token misallocation reported at the counter.
 *
 * The warning says the funded budget will proceed, preserving E-068's warn-don't-block
 * ruling. The caller may print it before dispatch; this core performs no I/O.
 */
export function underfundingWarning(funded: Budget, floor: Budget): string | null {
  if (funded.tokens >= floor.tokens / UNDERFUNDING_FACTOR) return null;

  return `⚠ underfunded: ${formatTokens(funded.tokens)} tokens funded vs ${formatTokens(floor.tokens)} measured floor; proceeding with funded budget`;
}
