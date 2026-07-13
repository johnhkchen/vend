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
// cold-start prior. Its value imports stay inside that existing ledger boundary:
// `recalibrate` supplies the result while the ledger-owned threshold/window constants define
// the honest confidence ranges. The module remains addon-free. Nothing imports this back yet —
// T-030-02 (renderShelf + `vend shelf`) is the first consumer.

import type { Budget } from "../budget/budget.ts";
import type { AnyPlay, Rarity } from "../engine/play.ts";
import type { RunRecord } from "../log/run-log.ts";
import {
  COLD_START_MIN_SUCCESSES,
  DEFAULT_WINDOW,
  recalibrate,
  type RecalibrateResult,
} from "../ledger/recalibrate.ts";
import { formatBudget, type ValueTier } from "./menu.ts";

/** Integer literals from zero through `N - 1`. The ledger's finite default window makes
 *  confidence counts a real bounded set rather than an unconstrained `number`. */
type Enumerate<N extends number, Acc extends number[] = []> = Acc["length"] extends N
  ? Acc[number]
  : Enumerate<N, [...Acc, Acc["length"]]>;

/** Integer literals from `From` through `Through`, inclusive. */
type IntegerRange<From extends number, Through extends number> =
  | Exclude<Enumerate<Through>, Enumerate<From>>
  | Through;

/** Real successes that are still too thin to earn a measured percentile (currently 1–2). */
export type ColdStartRunCount = Exclude<Enumerate<typeof COLD_START_MIN_SUCCESSES>, 0>;

/** Successful samples that can back a measured shelf envelope (currently 3–100). */
export type MeasuredRunCount = IntegerRange<typeof COLD_START_MIN_SUCCESSES, typeof DEFAULT_WINDOW>;

/**
 * How trustworthy a row's envelope is — a DISCRIMINATED union, so the E-026 lesson is
 * unrepresentable to violate: measured counts start at the ledger's threshold, while a
 * `default` is either genuinely empty (no `runs` field) or carries a positive sub-threshold
 * count. Zero can therefore never render as measured or as thin-but-real. Mirrors
 * `recalibrate`'s `source: "measured" | "prior"` — `prior` maps to `default` here.
 */
export type ShelfConfidence =
  | { readonly kind: "measured"; readonly runs: MeasuredRunCount }
  | { readonly kind: "default" }
  | { readonly kind: "default"; readonly runs: ColdStartRunCount };

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

/** Narrow a ledger count to real-but-sub-threshold cold-start evidence. PURE. */
function isColdStartRunCount(runs: number): runs is ColdStartRunCount {
  return Number.isInteger(runs) && runs > 0 && runs < COLD_START_MIN_SUCCESSES;
}

/** Narrow a ledger count to the sample range possible through the default ledger window. PURE. */
function isMeasuredRunCount(runs: number): runs is MeasuredRunCount {
  return Number.isInteger(runs) && runs >= COLD_START_MIN_SUCCESSES && runs <= DEFAULT_WINDOW;
}

/**
 * Translate ledger provenance + sample size into the shelf's honest confidence states.
 * `recalibrate` guarantees these ranges when called with its defaults (as {@link shelfRows}
 * does); the invariant error makes future drift fail loudly instead of printing a lie.
 */
function shelfConfidence(result: RecalibrateResult): ShelfConfidence {
  const runs = result.confidence.successes;
  if (result.source === "measured" && isMeasuredRunCount(runs)) return { kind: "measured", runs };
  if (result.source === "prior" && runs === 0) return { kind: "default" };
  if (result.source === "prior" && isColdStartRunCount(runs)) return { kind: "default", runs };
  throw new Error(
    `recalibrate confidence invariant violated: source=${result.source}, successes=${runs}, threshold=${COLD_START_MIN_SUCCESSES}, window=${DEFAULT_WINDOW}`,
  );
}

/**
 * Build one {@link ShelfRow} per play: pair its worth (`summary`) with its WARRANTED
 * envelope. PURE/TOTAL. For each play it recalibrates (E-013) over `records` at the tier
 * derived from `card.rarity`, with the play's authored `budget` as the cold-start prior —
 * so a play WITH history gets a `measured` envelope + its success count, and a play with
 * too little history (cold start) gets its authored `budget` back verbatim, labelled
 * `default` plus its real sub-threshold count (or an honest empty state at zero). It is never
 * called measured — the E-026 confidence contract is inherited from `recalibrate.source`.
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
    const confidence = shelfConfidence(result);
    return { name: play.name, summary: play.summary, envelope: result.envelope, confidence };
  });
}

/**
 * The honest confidence qualifier for a row's envelope. PURE/TOTAL. An exhaustive `switch`
 * over the {@link ShelfConfidence} union (no default branch — `tsc` proves both arms), so the
 * E-026 lie is unconstructable: measured counts begin at the ledger threshold, and default
 * counts are either absent (zero) or positive and sub-threshold. `measured` reads
 * `(measured · N runs)`; `default` reads either `(default — no runs yet)` or the honest
 * `(default — N runs, measured at 3)` cold-start progress label.
 */
function confidenceLabel(c: ShelfConfidence): string {
  switch (c.kind) {
    case "measured":
      return `(measured · ${c.runs} runs)`;
    case "default":
      return "runs" in c
        ? `(default — ${c.runs} run${c.runs === 1 ? "" : "s"}, measured at ${COLD_START_MIN_SUCCESSES})`
        : "(default — no runs yet)";
  }
}

/**
 * Render the supply shelf clean-typographic — the SUPPLY view beside the demand board (DL-6:
 * the shelf serves beneath; here it stands on its own behind `vend shelf`). PURE/TOTAL.
 *
 * DL-9 (card-as-lens, not chrome): a flat NUMBERED LIST, never a grid of boxed cards — the
 * `renderMenu` discipline. DL-3 (hierarchy from the terminal's few levers): WORTH LEADS (name
 * + summary at column 0), the warranted budget + confidence RECEDE to the trailing column;
 * with no color to spend here (no andon applies — DL-5 is silent on the shelf), recession is
 * carried by position + the parenthetical qualifier + a `~` that flags a cold-start envelope.
 *
 * The envelope is formatted by {@link formatBudget} — the SAME formatter the board uses
 * (`menu.ts`) — so the shelf and the board read identically (no data/display drift). A
 * `default` (cold-start) row prefixes its envelope with `~` and is labelled with either no
 * runs or its real sub-threshold progress toward measurement; a `measured` row shows its
 * envelope plainly + `(measured · N runs)`. Columns self-size to the widest name/summary so
 * adding a play needs no hand-tuned width. An empty shelf renders one guidance line instead
 * of erroring (the `renderMenu` precedent). Input order is preserved; nothing is mutated.
 */
export function renderShelf(rows: readonly ShelfRow[]): string {
  if (rows.length === 0) return "(no playbooks)";

  const nameW = Math.max(...rows.map((r) => r.name.length));
  const summaryW = Math.max(...rows.map((r) => r.summary.length));

  const lines = rows.map((r, i) => {
    const env = `${r.confidence.kind === "default" ? "~" : ""}${formatBudget(r.envelope)}`;
    return `  ${i + 1}. ${r.name.padEnd(nameW)}   ${r.summary.padEnd(summaryW)}   ${env} ${confidenceLabel(r.confidence)}`;
  });

  return `shelf — ${rows.length} playbook${rows.length === 1 ? "" : "s"}\n\n${lines.join("\n")}`;
}
