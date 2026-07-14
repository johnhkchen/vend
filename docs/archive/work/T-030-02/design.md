# T-030-02 — Design: vend-shelf-surface

Three decisions, each grounded in Research. Goal: a **pure** `renderShelf(rows)` (DL-6/9/3)
and an **impure** `vend shelf` verb, with the board untouched.

## Decision 1 — `renderShelf` lives in `src/shelf/shelf-row.ts`

**Chosen:** add `renderShelf(rows: readonly ShelfRow[]): string` to `shelf-row.ts`, beside the
`ShelfRow`/`ShelfConfidence` model it renders.

**Why:** `menu.ts` is the exact precedent — it holds the `Action` model **and** `renderMenu`.
shelf-row.ts is already the pure home of the row model, its header already names "renderShelf
… the first consumer", and the new render is pure (no fs/clock), so it belongs with the data
it formats. It already imports `menu.ts` (the `ValueTier` type) — adding a value import of
`formatBudget` is a one-line widening of an existing edge, keeping the single-envelope-formatter
no-drift seam.

**Rejected:**
- *A new `src/shelf/shelf-render.ts`.* Splits a pure model from its pure renderer that menu.ts
  keeps together — needless ceremony for one ~25-line function and one test block.
- *Rendering inside the `vend shelf` shell (cli/gather).* Would make the render impure-by-
  association and untestable. The render is the high-value pure unit; it must be fixture-tested.

## Decision 2 — enumerate the six plays as an explicit literal list in the shell

**Chosen:** the impure shell (`src/shelf/shelf.ts`, Decision 4) imports the six exported play
literals directly and passes them, in a fixed order, to `shelfRows`:

```ts
const SHELF_PLAYS = [
  decomposeEpicPlay, surveyPlay, steerProjectPlay,
  proposeEpicPlay, expandFragmentPlay, captureNotePlay,
];
```

**Why:** the registry exposes `names()`/`get()` but **no `values()`** — enumerating it would
require *both* adding a `values()` method to the engine *and* value-importing all six modules
for their side-effect registration (fragile: order = import order; a forgotten import silently
drops a play). An explicit list of the literals is the same import cost with none of the
engine change, gives a **deterministic display order**, and is typed (`AnyPlay`-assignable).
"Gathers the registry's plays" (the ticket) is honored in substance: these are exactly the six
`registry.register(…)`d plays. The list is the single place a future 7th play is added — the
same maintenance point a registry-import barrel would be.

**Order:** leverage-descending for a sensible read — keystone (`decompose-epic`) leads, the
rares follow, the leaf (`capture-note`) trails. `renderShelf` preserves input order (ranking,
like menu's, is the shell's concern), so order is decided here, once, statically.

**Rejected:**
- *Add `registry.values()` + six side-effect imports.* More moving parts, an engine API change
  for a read surface, and an order that drifts with import order. Noted for a future epic if
  play registration ever becomes dynamic; today the catalog is six known literals.

## Decision 3 — row format: worth leads, envelope · confidence recede; `~` flags default

Per the ticket: `name   summary   envelope · confidence`, worth leading, budget+confidence
receding (DL-3), **no boxed cards** (DL-9), **no color** (no andon applies, DL-5 silent here),
default labelled `~<env> (default — no runs yet)`, measured `<env> (measured · N runs)`.

**Chosen format** (numbered, two-space indent under a `shelf` header; columns aligned by
computed max-width so the receding envelope column lines up):

```
shelf — 6 playbooks

  1. decompose-epic   clear an epic into ready stories and tickets   2h/80k (measured · 9 runs)
  2. survey           read the project into a ranked demand board     ~2h/50k (default — no runs yet)
  ...
```

- **Worth leads, envelope recedes** via *position* (name+summary at the front, envelope+
  confidence trailing). With no color available in a plain return string, DL-3's "dim" lever
  is unavailable, so recession is carried by order + the parenthetical qualifier + the `~`
  marker — the honest plain-text form (the menu.ts precedent uses no color either).
- **`~` only on default** rows: it reads as "approximate / authored, not measured". A measured
  envelope has no `~` (it is a real bound). This makes confidence legible at a glance, before
  the parenthetical.
- **Alignment** is computed from the rows (pad name to max name length, summary to max summary
  length) — pure, total, and self-sizing, so adding a play never needs a hand-tuned width.
- **Empty rows** → a single guidance line `(no playbooks)` (the `renderMenu` empty-list
  precedent), never a throw.
- **Confidence text** is derived by a `switch` on `confidence.kind` — exhaustive over the
  union, so the E-026 "measured (0 runs)" lie is unconstructable (a `default` row has no
  `runs` to print).

**Rejected:**
- *Tier tag `[Keystone]` per row* (as the DL-6 Home mock shows). The ticket's row spec is
  `name · summary · envelope · confidence` — no tier column; the shelf is the *catalog of
  worth*, not the leverage board. Tier still drives the envelope (via recalibrate) — it is
  *expressed* in the budget, not re-printed. Keeps the row uncluttered (DL-1/DL-3).
- *ANSI dim/bold for recession.* No color (ticket); and a colored control-code string is
  harder to test and breaks in pipes/CI. Position + parenthetical carry the hierarchy.

## Decision 4 — the `vend shelf` shell mirrors `vend audit` + `browseShelf`

- **Parser:** `parseShelfArgs` — flags-only, like `parseSurveyArgs`, but **no `--budget`**
  (ticket: "no budget/flags needed (it's a read)"). Any token after `shelf` → a `usage` error.
  Adds `{ cmd: "shelf" }` to `ParsedCommand` and the `argv[0] === "shelf"` branch to `parseArgs`.
- **Gather (impure):** new `src/shelf/shelf.ts` exporting `async shelfText(): Promise<string>`
  — loads the run log (`loadRunLog`), imports the six literals, `shelfRows(plays, records)` →
  `renderShelf(rows)`, returns the string. The untested shell (it value-imports BAML-addon play
  modules), exactly like `gather.ts`/`dispatch.ts`. No persistence, no clock — a pure read.
- **Dispatch arm:** in `cli.ts`, `if (parsed.cmd === "shelf")` lazily imports `shelfText`,
  prints it, exits 0 — the read-only `audit` precedent.
- **Usage line:** add `vend shelf` to `USAGE` (no test depends on it).
- **Board untouched:** no edit to `menu.ts` render, `gather.ts`, or the `browse` arm — this is
  the supply view *beside* the board, not a board change.

## Test strategy (Plan details it)
- `renderShelf` is unit-tested in `shelf-row.test.ts` on fixture rows: a measured row, a
  default row, alignment across mixed names, the empty-list guidance, and that a default row
  never prints "measured".
- `parseShelfArgs` is unit-tested in `cli.test.ts` (the `audit` parser-test precedent): bare
  `shelf` → `{ cmd: "shelf" }`; a stray arg → `usage`.
- The gather shell + dispatch arm are not unit-tested (house rule); proven by the **live
  proof**: `bun run src/cli.ts shelf` lists the six with measured/default per the ledger.
