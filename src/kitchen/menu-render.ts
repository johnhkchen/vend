// The kitchen seed's menu RENDER spec — the PURE contract `vend work` clears for the menu-render
// slice (T-062-03-03, story S-062-03, epic E-062: kitchen-emdash-dress-rehearsal).
//
// WHAT THIS IS: the menu-render slice is "read the couple's `Dish` content from EmDash's REST API and
// render an appetizing, mobile-first menu at `/` — one card per dish: photo, name, description"
// (the gold-master board Keystone, docs/active/work/T-062-03-01/expected-board.md). The scaffolded
// storefront ships `src/pages/index.astro` as a DELIBERATE STUB; the live `vend work` drive clears
// the slice IN the cook's copy. THIS module is vend's pure SPEC of that render — exactly as
// `dish-seed.ts` is vend's pure spec of the EmDash seed CONTRACT (the `.emdash/seed.json` the cook
// ships). The gold-master reference page (docs/active/work/T-062-03-03/menu-render.index.astro)
// mirrors this spec and is built green offline; a drift guard in menu-render.test.ts pins the two.
//
// PURE (mirrors src/kitchen/dish-seed.ts): every export takes plain values and returns plain values —
// no fs, clock, network, process. It REUSES the REST record shape `dish-seed.ts` already models
// ("what EmDash materializes into the DB and serves via REST"), so the render is, by construction,
// sourced from the same REST model the seed contract is graded against — no second source of truth.
//
// HONEST BOUNDARY: there is no live EmDash / HTTP here. `renderMenu` consumes the REST list SHAPE
// (`EmDashRecord[]`); the live fetch + the request-time fallback to the seeded example dish live in
// the Astro page (the SSR boundary), exactly as the one fs read in dish-seed lives in its test. The
// seeded example dish is what REST serves on a fresh boot, so "matching the example dish" is grounded
// in `dishesFromSeed` over the authored seed.

import type { EmDashRecord, EmDashSeed } from "./dish-seed.ts";
import { dishRecords } from "./dish-seed.ts";

/** The published-status marker EmDash stamps on a live record. The menu shows published dishes only
 *  (REST serves drafts too when `?status` is unset); the seeded example is `status: "published"`. */
export const PUBLISHED_STATUS = "published" as const;

/** The CSS class every dish card carries — shared with the reference page + the drift guard so the
 *  spec and the gold-master `index.astro` cannot silently diverge (menu-render.test.ts block D). */
export const MENU_CARD_CLASS = "dish-card" as const;

/** The honest-empty copy anchor: when the cook has no published dishes yet, the menu says so rather
 *  than rendering a blank page or fabricating demand (IA-4). The reference page reuses this string. */
export const MENU_EMPTY_MARKER = "No dishes on the menu yet" as const;

/** A dish reduced to the three things a menu card shows. PURE view-model. `photo`/`description` are
 *  `string | null` (absence is a rendered state — a card with no image — not an omitted field);
 *  `name` is always a string (`""` only when a malformed record omits it, so the row stays visible
 *  rather than silently vanishing). */
export interface DishCard {
  readonly name: string;
  readonly photo: string | null;
  readonly description: string | null;
}

/** A non-empty string, or `null` — the coercion both optional fields share. PURE. */
function strOrNull(v: unknown): string | null {
  return typeof v === "string" && v.length > 0 ? v : null;
}

/** One REST record → its card view-model. Tolerant: pulls `name`/`photo`/`description` out of
 *  `record.data`, coercing an absent/non-string photo or description to `null` and a missing name to
 *  `""`. Never throws — a torn record is something a menu wants to render visibly, not crash on. PURE. */
export function dishToCard(record: EmDashRecord): DishCard {
  const data = record.data ?? {};
  const name = data.name;
  return {
    name: typeof name === "string" ? name : "",
    photo: strOrNull(data.photo),
    description: strOrNull(data.description),
  };
}

/** The REST records → the ordered cards the menu shows: published only, in REST order, as view-models.
 *  This is the "one card per dish" contract — `menuCards(records).length === <published dish count>`.
 *  PURE. */
export function menuCards(records: readonly EmDashRecord[]): readonly DishCard[] {
  return records.filter((r) => r.status === PUBLISHED_STATUS).map(dishToCard);
}

/** The dishes EmDash's REST list would serve for a seed — `dishRecords` under a render-intent name, so
 *  a caller reads "the dishes to render" off the authored seed (the request-time fallback source the
 *  reference page uses when no live EmDash is reachable). PURE. */
export function dishesFromSeed(seed: EmDashSeed): readonly EmDashRecord[] {
  return dishRecords(seed);
}

/** Escape the five HTML-significant characters so interpolated dish text (a name with `&`, a
 *  description with `<`) can never break out of the markup. PURE. */
function esc(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/** Render one card's inner markup: photo (only when set), name (`<h2>`), description (only when set).
 *  PURE. The class is {@link MENU_CARD_CLASS}; all interpolated text is escaped. */
function renderCard(card: DishCard): string {
  const img = card.photo
    ? `<img class="${MENU_CARD_CLASS}__photo" src="${esc(card.photo)}" alt="${esc(card.name)}" loading="lazy" />`
    : "";
  const desc = card.description
    ? `<p class="${MENU_CARD_CLASS}__desc">${esc(card.description)}</p>`
    : "";
  return `<article class="${MENU_CARD_CLASS}">${img}<h2 class="${MENU_CARD_CLASS}__name">${esc(card.name)}</h2>${desc}</article>`;
}

/** Render the mobile-first menu fragment — one {@link MENU_CARD_CLASS} article per card, or the
 *  honest-empty state ({@link MENU_EMPTY_MARKER}) when there are no dishes. Returns the HTML string the
 *  Astro page drops into `<main>` (the page owns the document frame + the mobile-first CSS). PURE. */
export function renderMenu(cards: readonly DishCard[]): string {
  if (cards.length === 0) {
    return `<p class="menu-empty">${MENU_EMPTY_MARKER} — add dishes in the EmDash admin.</p>`;
  }
  return `<ul class="dish-menu" role="list">${cards
    .map((c) => `<li>${renderCard(c)}</li>`)
    .join("")}</ul>`;
}
