// The pure DL-6 Home composite (T-031-01) — the addon-free heart of the fused Home screen.
//
// Home leads with DEMAND and lets SUPPLY serve beneath (DL-6 / IA-1): the board (ranked pull) at the
// top, the shelf (authored inventory) receding under it, and a one-line ledger trust foot at the
// bottom. This module is the PURE composer of those three regions. It closes the one honest gap the
// design language names by hand: "there is no single `renderHome` composite emitter today" (DL-6,
// design-language.md). Two parts:
//
//   1. `homeLedgerLine(report)` — the FOOT (DL-6 / DL-8 / E-028). The compact one-line glance of the
//      trust report: the provenance-split E-028 already computes (recorded at the time · filled in
//      later), NOT a single
//      conflated rate. The full multi-line readout stays `vend audit` (`formatWalkAwayFindings`); this
//      is the glance. Honest-empty — "no runs yet" / "not recorded yet" — never a fabricated trust
//      number (the read-never-invent discipline, E-026 / IA-8). Percentages are rendered through the
//      SAME `pct` the audit readout uses, so Home and `vend audit` can never round differently.
//   2. `renderHome({ boardMenu, shelfRows, ledger })` — the COMPOSER (DL-6 / DL-1 / DL-9). A pure
//      layout-composer: board (already-rendered `renderMenu` string, leads at column 0) · shelf
//      (`ShelfRow[]` rendered receding beneath via `renderShelf`) · ledger (the `homeLedgerLine`
//      string at the foot). Whitespace divides the three regions — no boxes, no rules, no card chrome.
//
// PURITY (house pattern, cf. menu.ts / shelf-row.ts / walk-away.ts): every export takes plain values
// and returns fresh strings — no fs, clock, network, process, or addon; never mutates input; never
// throws (TOTAL). The impure gather (read the run log, rank + persist `.vend/menu.json`, print) is the
// T-031-02 shell — this module never reads files, gathers, or recalibrates.
//
// BOUNDARIES: it COMPOSES `renderShelf` (shelf-row.ts, E-030) and reuses `pct` (walk-away.ts, E-014/
// E-028) — it changes NEITHER. The board's `renderMenu` is consumed pre-rendered (string in), so the
// board owns its own `--all`/cache coordination upstream. Nothing imports this back yet — T-031-02
// (wire bare `vend` to `renderHome`) is the first consumer.

import { renderShelf, type ShelfRow } from "./shelf-row.ts";
import { pct, type WalkAwayReport, type InterventionSubStat } from "../ledger/walk-away.ts";

/**
 * The three DL-6 Home regions {@link renderHome} composes. ASYMMETRIC by design: `boardMenu` and
 * `ledger` arrive ALREADY RENDERED (the board needs `--all`/cache coordination upstream; the ledger
 * is a trivial one-liner), while the shelf arrives STRUCTURED as {@link ShelfRow}[] so `renderHome`
 * owns its receding-beneath presentation (rendered via `renderShelf`).
 */
export interface HomeRegions {
  /** Board region: the already-rendered `renderMenu` string. Leads at column 0, unchanged. */
  readonly boardMenu: string;
  /** Shelf region: the structured supply rows (T-030-01); rendered receding beneath the board. */
  readonly shelfRows: readonly ShelfRow[];
  /** Ledger region: the already-rendered {@link homeLedgerLine} string. The foot. */
  readonly ledger: string;
}

/**
 * Render one provenance sub-stat (T-028-01) as its compact WALK-AWAY percent (`1 − intervention
 * rate`), or `"none yet"` when the partition is empty — an honest label (IA-8), never a fabricated
 * 0%. PURE/TOTAL. Mirrors `walk-away.ts`'s private `subWalk`, but percent-only for the one-line
 * glance (the untouched fraction stays in the full `vend audit` readout). Reuses the shared {@link
 * pct} so the foot and the audit round identically.
 */
function subPct(s: InterventionSubStat): string {
  return s.reported === 0 ? "none yet" : pct(s.rate === null ? null : 1 - s.rate);
}

/**
 * Render a {@link WalkAwayReport} as the compact DL-6 ledger FOOT — the trust line at the bottom of
 * Home. PURE/TOTAL. "Finished without help" is `1 − intervention rate` (finished untouched), shown
 * with the E-028 provenance split (recorded at the time · filled in later), NOT a single conflated
 * rate — mirroring the labels `formatWalkAwayFindings` (DL-8) uses, just on one line, so Home and
 * `vend audit` read identically.
 *
 * Honest-empty (read-never-invent, E-026 / IA-8): with no runs at all it says "no runs yet"; with
 * runs but no recorded answer it says the runs did not say whether anyone stepped in — NEVER a
 * fabricated trust percentage. A populated line reads, e.g.:
 *   `ledger   finished without help 87% (13/15)   └ recorded at the time 50% · filled in later 92%`
 */
export function homeLedgerLine(report: WalkAwayReport): string {
  const iv = report.intervention;

  if (report.total === 0) return "ledger   finished without help — no runs yet";
  if (iv.reported === 0) {
    return `ledger   finished without help — not recorded yet (${report.total} run${report.total === 1 ? "" : "s"} did not say whether anyone stepped in)`;
  }

  const walkAway = iv.rate === null ? null : 1 - iv.rate;
  return (
    `ledger   finished without help ${pct(walkAway)} (${iv.reported - iv.intervened}/${iv.reported})` +
    `   └ recorded at the time ${subPct(iv.forward)} · filled in later ${subPct(iv.attested)}`
  );
}

/**
 * Compose the three DL-6 Home regions into one screen. PURE/TOTAL. Board leads (column 0, the
 * `renderMenu` string verbatim), shelf recedes beneath (rendered via {@link renderShelf} — the same
 * clean-typographic key `vend shelf` uses, so the two never drift), ledger at the foot. Whitespace
 * divides the three regions — NO boxes, NO rules, NO card chrome (DL-1 / DL-9).
 *
 * Honest-empty passes through by construction (this only concatenates): an empty board keeps its
 * `renderMenu` guidance line, an empty shelf renders `renderShelf`'s `(no playbooks)`, and an empty
 * ledger carries `homeLedgerLine`'s honest foot — never an error, never a fabricated number.
 */
export function renderHome(regions: HomeRegions): string {
  return `${regions.boardMenu}\n\n${renderShelf(regions.shelfRows)}\n\n${regions.ledger}`;
}
