// The pure menu model (T-003-01) — the addon-free heart of the shelf.
//
// Bare `vend` shows a ranked menu of the salient, high-leverage actions available
// right now; `vend <sel>` runs them. "Salient" = high-leverage AND ready; blocked
// and leaf rows are hidden behind `--all`. This module ranks actions by LEVERAGE
// (not effort) and renders them as a numbered menu, and defines the `MenuCache`
// shape persisted to `.vend/menu.json` so `vend <sel>` resolves indices against the
// SAME list shown. It encodes demand.md's value ranking (Keystone > High > Standard
// > Leaf); it does not redefine it.
//
// PURITY (house pattern, cf. id-guard.ts / project-context's buildProjectSnapshot):
// no fs, network, clock, process, LLM, or native addon — every export takes plain
// values and returns fresh ones, never mutating its input and never throwing
// (TOTAL). The impure verbs — read demand.md + `lisa status`, stamp the timestamp /
// state-hash, write `.vend/menu.json`, print for bare `vend` — belong to T-003-02;
// resolve + dispatch to T-003-04. This is the DETERMINISTIC side of E-003's
// precompute fork: `.vend/menu.json` is the seam a later LLM-salience precompute
// hooks into with the same interface.

import type { Budget } from "../budget/budget.ts";

/** Leverage tier (demand.md value ranking) — ranked, never an effort estimate. */
export type ValueTier = "keystone" | "high" | "standard" | "leaf";

/** Readiness from `lisa status`: shown vs hidden. ("leaf" is a {@link ValueTier},
 *  not a readiness — the default-hidden set is `blocked` OR leaf-tier.) */
export type Readiness = "ready" | "blocked";

/** One shelf entry: a board action the press gesture (`vend <sel>`) can dispatch. */
export interface Action {
  /** Board id the press gesture dispatches on, e.g. "E-002". */
  readonly id: string;
  /** Kebab title, e.g. "ci-backstop". */
  readonly title: string;
  /** Leverage tier (demand.md). Drives ranking and default visibility. */
  readonly tier: ValueTier;
  /** Ready (shown) or blocked (hidden unless `--all`). */
  readonly readiness: Readiness;
  /** Warranted envelope — the default budget for `vend <sel>` (overridable via --budget). */
  readonly budget: Budget;
}

/** Schema version of the persisted menu — bumped if `.vend/menu.json` shape changes
 *  (the seam is also the future LLM-precompute hook, so the format must migrate). */
export const MENU_CACHE_VERSION = 1 as const;

/**
 * The shape persisted to `.vend/menu.json` — the seam between the browse gesture
 * (`vend`) and the press gesture (`vend <sel>`). `actions` is stored in DISPLAY
 * ORDER so resolution is a direct `actions[i - 1]` (menu numbers are 1-indexed).
 *
 * `generatedAt` and `stateHash` are the freshness marker so a materially-stale menu
 * can warn "re-run vend" instead of acting on stale indices. They are populated
 * IMPURELY by T-003-02 (clock) / checked by T-003-04 — this pure model only
 * declares their shape, never fills them.
 */
export interface MenuCache {
  /** Schema version (see {@link MENU_CACHE_VERSION}). */
  readonly version: typeof MENU_CACHE_VERSION;
  /** ISO-8601 stamp of when the menu was computed (impurely stamped by T-003-02). */
  readonly generatedAt: string;
  /** Hash of the board state the menu was computed from (impurely computed). */
  readonly stateHash: string;
  /** Whether hidden (blocked/leaf) rows were included when this menu was shown. */
  readonly all: boolean;
  /** The displayed actions, in display order: menu number `i` ⇒ `actions[i - 1]`. */
  readonly actions: readonly Action[];
}

/** Options for {@link renderMenu}. */
export interface RenderOpts {
  /** Reveal blocked/leaf rows that are hidden by default. */
  readonly all?: boolean;
}

/** Sort precedence for leverage tiers — lower ranks first. Private: the ordinal is
 *  a sort detail, not part of the model (demand.md: "don't freeze a number"). */
const TIER_RANK: Record<ValueTier, number> = { keystone: 0, high: 1, standard: 2, leaf: 3 };

/** Sort precedence for readiness within a tier — ready before blocked. */
const READINESS_RANK: Record<Readiness, number> = { ready: 0, blocked: 1 };

/**
 * Rank actions by LEVERAGE tier, then readiness; STABLE within full ties. PURE and
 * TOTAL. Sorts a COPY (input never mutated) and relies on the stable
 * `Array.prototype.sort`, so equal-tier-equal-readiness entries keep their input
 * order — the caller's signal order, which is the correct tiebreak (demand.md: pull
 * order is "value + readiness, NOT id order"). Tier dominates readiness: a blocked
 * keystone outranks a ready standard (it is simply hidden under the default filter).
 */
export function rankActions(actions: readonly Action[]): Action[] {
  return [...actions].sort((a, b) => {
    const byTier = TIER_RANK[a.tier] - TIER_RANK[b.tier];
    if (byTier !== 0) return byTier;
    return READINESS_RANK[a.readiness] - READINESS_RANK[b.readiness];
  });
}

/**
 * The displayed subset: everything when `all`, else only the salient rows
 * (readiness "ready" AND tier not "leaf"). PURE and TOTAL — a fresh array,
 * input order preserved (so `rankActions` → `visibleActions` stays ranked). This is
 * the SINGLE filter shared by {@link renderMenu} and T-003-02's persistence, so the
 * rendered numbering and the persisted `MenuCache.actions` can never disagree.
 */
export function visibleActions(actions: readonly Action[], all = false): Action[] {
  if (all) return [...actions];
  return actions.filter((a) => a.readiness !== "blocked" && a.tier !== "leaf");
}

/** Render a token count human-scale: whole thousands as `<k>k` (≥1000), else the
 *  integer. Private helper for {@link formatBudget}. */
function humanTokens(n: number): string {
  return n >= 1000 ? `${Math.round(n / 1000)}k` : `${n}`;
}

/** Render a wall-clock allowance (ms) as the largest whole unit: `h`, then `m`,
 *  then `s`. Private helper for {@link formatBudget}; deterministic, total. */
function humanTime(ms: number): string {
  const s = Math.round(ms / 1000);
  if (s >= 3600 && s % 3600 === 0) return `${s / 3600}h`;
  if (s >= 60 && s % 60 === 0) return `${s / 60}m`;
  return `${s}s`;
}

/**
 * Format a warranted {@link Budget} envelope human-scale as `"<time>/<tokens>"`,
 * e.g. `2h/50k`, `30m/8k`, `45s/500`. PURE/TOTAL — mirrors demand.md's human-scale
 * envelopes and the `--budget 2h,50k` CLI surface.
 */
export function formatBudget(budget: Budget): string {
  return `${humanTime(budget.timeMs)}/${humanTokens(budget.tokens)}`;
}

/** Title-case a tier for display (`high` → `High`). Private. */
function tierLabel(tier: ValueTier): string {
  return tier.charAt(0).toUpperCase() + tier.slice(1);
}

/**
 * Render the shelf as a numbered menu. PURE and TOTAL. Numbers the VISIBLE rows
 * 1..N (each row carries value tier + budget + state); `opts.all` reveals the
 * blocked/leaf rows otherwise hidden. When rows are hidden, a `(+K hidden — vend
 * --all)` footer makes the omission visible rather than silent. An empty visible
 * list renders a single guidance line instead of erroring.
 *
 * Pass an already-{@link rankActions | ranked} list to get a ranked menu; the
 * caller (T-003-02) persists `visibleActions(actions, all)` so the numbers shown
 * match `MenuCache.actions` exactly.
 */
export function renderMenu(actions: readonly Action[], opts?: RenderOpts): string {
  const all = opts?.all ?? false;
  const shown = visibleActions(actions, all);

  if (shown.length === 0) {
    return actions.length === 0 ? "(no actions)" : "(no salient actions — vend --all)";
  }

  const rows = shown.map(
    (a, i) => `${i + 1}. ${a.id} ${a.title}  [${tierLabel(a.tier)}] · ${formatBudget(a.budget)} · ${a.readiness}`,
  );

  const hidden = actions.length - shown.length;
  if (!all && hidden > 0) rows.push(`(+${hidden} hidden — vend --all)`);

  return rows.join("\n");
}
