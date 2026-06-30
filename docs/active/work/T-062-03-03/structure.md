# T-062-03-03 — Structure

**Phase:** Structure. File-level changes, module boundaries, public interfaces, ordering. The shape of
the code, not the code.

## File inventory

### Created — production (gated)

**`src/kitchen/menu-render.ts`** — PURE. vend's spec of the menu render (mirrors `dish-seed.ts`). Imports
the REST shape from `dish-seed.ts` (reuse, no re-declaration). Public surface:

```ts
import type { EmDashRecord, EmDashSeed } from "./dish-seed.ts";
import { dishRecords } from "./dish-seed.ts";

/** A dish reduced to the three things a menu card shows. PURE view-model. */
export interface DishCard {
  readonly name: string;          // required field; "" only if the record is malformed
  readonly photo: string | null;  // image ref, or null when unset (photo is optional)
  readonly description: string | null; // short line, or null when unset
}

/** One REST record → a card view-model. Tolerant: pulls name/photo/description out of
 *  `record.data`, coercing absent/non-string to null (name → "" so a malformed row is
 *  visible, never thrown). PURE. */
export function dishToCard(record: EmDashRecord): DishCard;

/** The REST records → the ordered cards a menu shows (published only, in REST order). PURE. */
export function menuCards(records: readonly EmDashRecord[]): readonly DishCard[];

/** Render the mobile-first menu fragment: one <article class="dish-card"> per card
 *  (photo / name / description), or an honest-empty state when there are no dishes. Returns an
 *  HTML string (the fragment the Astro page drops into <main>). PURE — escapes interpolated text. */
export function renderMenu(cards: readonly DishCard[]): string;

/** The dishes EmDash's REST list would serve for a given seed — `dishRecords` re-exported under a
 *  render-intent name so a caller reads "the dishes to render" off the seed (the offline fallback
 *  source). PURE. */
export function dishesFromSeed(seed: EmDashSeed): readonly EmDashRecord[];

/** Stable class/marker constants the reference page and the test share (anti-drift, D4). */
export const MENU_CARD_CLASS = "dish-card" as const;
export const MENU_EMPTY_MARKER = "menu is empty" as const; // honest-empty copy anchor
```

Boundaries: no fs / clock / network / process (purity doctrine, like `dish-seed.ts` line 12). HTML
escaping is a small private `esc()` (the only non-trivial helper). `published`-status filter lives in
`menuCards` (REST serves drafts too when `?status` is unset; the menu shows published).

### Created — test (gated)

**`src/kitchen/menu-render.test.ts`** — addon-free, the `dish-seed.test.ts` idiom. Blocks:
- **A — pure contract (fabricated rows):** `menuCards`/`dishToCard` map name/photo/description; absent
  photo/description → null; non-`published` dropped; order preserved.
- **B — `renderMenu` shape:** one `dish-card` article per card; the three fields appear; HTML special
  chars escaped; zero cards → the honest-empty marker, **no** card article.
- **C — matches the real example dish (clause 1):** read
  `examples/templates/kitchen-seed/.emdash/seed.json` off disk → `parseKitchenSeed` → `dishesFromSeed`
  → `renderMenu`; assert exactly **one** card carrying the seeded example's `name` /
  `photo` (`/media/sample-dish.jpg`) / `description` substring. This is "matching the example dish".
- **D — drift guard (D4):** read the reference `docs/active/work/T-062-03-03/menu-render.index.astro`
  off disk; assert it contains `MENU_CARD_CLASS`, the mobile-first `viewport` meta line, and an import
  or inline of the same card structure — so the gold-master page can't silently diverge from the spec.

### Created — work artifacts (not gated; the gold-master + the proof + the RDSPI trail)

- **`docs/active/work/T-062-03-03/menu-render.index.astro`** — the **reference / gold-master** SSR page
  (D3): request-time EmDash REST `fetch` (env `EMDASH_API_URL`, absent ⇒ skip), fallback to the seeded
  example dish, mobile-first one-card-per-dish menu. Self-contained (inlines the card render — a
  scaffolded page can't import vend's `src/`); structurally mirrors `menu-render.ts`. **Not** committed
  into the template.
- **`docs/active/work/T-062-03-03/build.proof.txt`** — captured `astro build` stdout/stderr + exit code
  from building the reference page in a copy of the seed dir (clause 2, real).
- **`docs/active/work/T-062-03-03/EXPECTED-OUTCOME.menu-render.md`** — the gold-master record:
  deterministic half CAPTURED (contract + build), metered half PENDING (`⟪…⟫`), re-run block.
- **`research.md` / `design.md` / `structure.md` / `plan.md` / `progress.md` / `review.md`** — the trail.

### Modified

- **None in `examples/templates/kitchen-seed/`** — the stub is preserved (D1). The build proof mutates
  only a *copy* / backs-up-and-restores, leaving the committed tree byte-identical.
- **None** in engine / CLI / BAML / `run-log.ts`.

### Deleted

- None.

## Module boundary map

```
dish-seed.ts  ──(EmDashRecord, dishRecords, EmDashSeed, parseKitchenSeed)──►  menu-render.ts
   (REST model, T-062-01-01)                                                    (render spec, this ticket)
                                                                                      │
                                                          mirrors (anti-drift, D4)    ▼
                                          docs/.../menu-render.index.astro  ──build──►  build.proof.txt
   (the gold-master page; gold-master record references it)                            (clause 2, real)

menu-render.test.ts ──asserts──► menu-render.ts (A,B), real seed.json (C), reference .astro (D)
```

`menu-render.ts` depends **only** on `dish-seed.ts` (one intra-kitchen edge — the REST shape). No new
edge into engine/CLI. The reference page depends on nothing in `src/` (self-contained, by D1's
scaffold constraint).

## Public-interface notes

- `renderMenu` returns a **string** (an HTML fragment), not a DOM/Astro node — keeps it pure + testable
  and lets the Astro page inject it with `set:html`. The fragment is the `<main>` inner content; the
  page owns `<html>/<head>/<body>` + the mobile-first frame (carried over from the stub, which is
  already mobile-first).
- `DishCard.photo`/`description` are `string | null` (not `?`) — absence is a rendered state (a card
  with no photo), so it's an explicit value, not an omitted field.
- No change to `RunRecord` / the ledger: clause 3 reads the *existing* `outcome` / `usage` / `envelope`
  fields; this ticket records expectations against them, it does not add a field.

## Ordering of changes

1. `menu-render.ts` (the spec) — nothing depends on it yet.
2. `menu-render.index.astro` (the reference) — mirrors (1).
3. `build.proof.txt` — build (2) in a seed-dir copy; capture.
4. `menu-render.test.ts` — asserts (1), the real seed, and (2). Run `bun run check` green.
5. `EXPECTED-OUTCOME.menu-render.md` — record deterministic-captured + metered-pending.
6. `progress.md` / `review.md`.

Steps 1–2 and 4 are the gated change; 3 + 5 are recorded fact + honest pending. Each is independently
committable, but commits are **left to Lisa** (the working tree carries sibling-thread work — same as
03-01's open concern #1).
