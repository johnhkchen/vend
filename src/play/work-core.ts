// [RETIRED GESTURE] `vend work` was retired (the fund-once-walk-away macro-drain was incompatible
// with the real driving loop and automated the cheap clearing half — honey-kitchen field feedback).
// work.ts (the impure shell) is deleted and the command is gone. This pure module is KEPT for ONE
// still-wired export: `parseBoardSignals`, the single source of board→signals truth, reused by
// graph-real-play-core.ts. The retired receipt/budget-plan/staleness renderers were GC'd in the
// 2026-07-13 board-maintenance pass (they had no production callers; see git history for the
// originals: T-024-03 receipt/production-line surface, T-027-01 stale-board andon, T-060-02-02
// calibrated work budget).
//
// PURITY (house pattern): every export takes plain values and returns plain values — no fs, clock,
// network, process, seam, or addon.

/** Match a staged board's `vend chain "<signal>"` line — the `## Pull these` gesture every board
 *  emits (steer-effect / survey-core), already ranked highest-leverage-first (IA-1). The inner text
 *  never contains a literal `"` (boards use backticks + single quotes), so the greedy `(.*)"` lands
 *  on the closing quote; an optional ` # comment` tail (the recommended-pull marker) is dropped. */
const CHAIN_LINE = /^vend chain "(.*)"(?:\s+#.*)?$/;

/**
 * Parse the staged board markdown into the ranked list of demand signals to spend down. PURE/TOTAL.
 * Scans every line for the `vend chain "<signal>"` gesture (the `## Pull these` block both steer and
 * survey emit), returning the quoted signal strings IN FILE ORDER — which is already ranked
 * highest-leverage-first (IA-1; the loop never re-sorts). A board with no such lines (an honest-empty
 * steer, or a non-board file) returns `[]`. The signal string is exactly `castProposeDecomposeChain`'s
 * input.
 */
export function parseBoardSignals(md: string): string[] {
  const signals: string[] = [];
  for (const raw of md.split("\n")) {
    const m = CHAIN_LINE.exec(raw.trim());
    if (m) signals.push(m[1]!);
  }
  return signals;
}
