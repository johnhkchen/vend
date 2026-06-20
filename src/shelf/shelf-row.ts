// The supply shelf's pure core (T-030-01) — worth + warranted budget per playbook. The
// SUPPLY half of Home (IA-2): where menu.ts is the DEMAND surface (a ranked board of what
// to pull), this is the SHELF surface (a row of authored playbooks you can grab and run).
// Each row pairs a play's WORTH (`summary` — its role, off the Play contract) with its
// WARRANTED BUDGET (a recalibrated envelope from the play's own measured past, E-013) and
// an honest CONFIDENCE read (measured-with-N vs cold-start default — never a guess dressed
// as measured, the E-026 lesson).
//
// PURITY (house pattern, cf. menu.ts / recalibrate.ts): every export takes plain values and
// returns fresh ones — no fs, clock, network, process, or addon. `shelfRows` takes the
// ALREADY-READ records (the impure `loadRunLog` belongs to the T-030-02 shell); it never
// reads the registry singleton either — `plays` is passed in. So shelf-row.test.ts is an
// ordinary pure test that never loads the BAML addon (the menu.test.ts discipline).
//
// BOUNDARIES: this module CALLS `recalibrate` (E-013 owns the percentile/cold-start/
// confidence math — we never re-derive it) with the play's authored `budget` as the
// cold-start prior. The one value import is `recalibrate`; everything else is type-only,
// so the zero-coupling, addon-free discipline holds. Nothing imports this back yet —
// T-030-02 (renderShelf + `vend shelf`) is the first consumer.

import type { Budget } from "../budget/budget.ts";
import type { AnyPlay, Rarity } from "../engine/play.ts";
import type { RunRecord } from "../log/run-log.ts";
import { recalibrate } from "../ledger/recalibrate.ts";
import type { ValueTier } from "./menu.ts";

/**
 * How trustworthy a row's envelope is — a DISCRIMINATED union, so the E-026 lesson is
 * unrepresentable to violate: a `default` row carries NO `runs` field, so a renderer
 * literally cannot print "measured (0 runs)". `measured` always carries a real `runs ≥ 1`
 * (the successful sample the percentile was bound over). Mirrors `recalibrate`'s
 * `source: "measured" | "prior"` — `prior` (cold-start) maps to `default` here.
 */
export type ShelfConfidence =
  | { readonly kind: "measured"; readonly runs: number }
  | { readonly kind: "default" };

/**
 * One supply-shelf entry — what T-030-02 renders (name · summary · envelope · confidence).
 * Carries STRUCTURED fields, never pre-formatted strings: rendering (`formatBudget`, the
 * DL-6…DL-9 surface) is the render shell's job, so the data layer and the display layer
 * can't drift. `name` is the play's stable id + the ledger join key; `summary` is its worth
 * verbatim; `envelope` is the warranted (or cold-start) budget; `confidence` qualifies it.
 */
export interface ShelfRow {
  readonly name: string;
  readonly summary: string;
  readonly envelope: Budget;
  readonly confidence: ShelfConfidence;
}

/**
 * The `Rarity → ValueTier` translation play.ts documents as "wired at the shelf boundary"
 * (play.ts:36–41): the engine contract stays MTG-native (`Rarity`), and the shelf — which
 * owns `ValueTier` (menu.ts) — owns the mapping. An order-preserving bijection: rarity IS
 * the play's intrinsic leverage, so it is the honest source of the tier the percentile is
 * picked at (recalibrate's TIER_PERCENTILE: keystone p95 … leaf p75). Total — every
 * {@link Rarity} member is a key, so `tsc` proves exhaustiveness (no default branch).
 */
export const RARITY_TIER: Record<Rarity, ValueTier> = {
  mythic: "keystone",
  rare: "high",
  uncommon: "standard",
  common: "leaf",
};

/** The leverage tier a play recalibrates at, derived from its card rarity. PURE/TOTAL. */
export function tierForRarity(rarity: Rarity): ValueTier {
  return RARITY_TIER[rarity];
}

/**
 * Build one {@link ShelfRow} per play: pair its worth (`summary`) with its WARRANTED
 * envelope. PURE/TOTAL. For each play it recalibrates (E-013) over `records` at the tier
 * derived from `card.rarity`, with the play's authored `budget` as the cold-start prior —
 * so a play WITH history gets a `measured` envelope + its success count, and a play with
 * too little history (cold start) gets its authored `budget` back verbatim, labelled
 * `default` (never measured — the E-026 honest-confidence contract, inherited from
 * `recalibrate.source`, not re-implemented here).
 *
 * `records` are the ALREADY-READ ledger lines (no I/O here); `recalibrate` does its own
 * per-play `forPlay` filtering, so the WHOLE array is passed through per play — one play's
 * runs never bleed into another's row. Input order is preserved (ranking, like rendering,
 * is the render shell's concern); a fresh array is returned and the inputs are never mutated.
 */
export function shelfRows(plays: readonly AnyPlay[], records: readonly RunRecord[]): ShelfRow[] {
  return plays.map((play) => {
    const tier = tierForRarity(play.card.rarity);
    const result = recalibrate(play.name, records, tier, play.budget);
    const confidence: ShelfConfidence =
      result.source === "measured" ? { kind: "measured", runs: result.confidence.successes } : { kind: "default" };
    return { name: play.name, summary: play.summary, envelope: result.envelope, confidence };
  });
}
