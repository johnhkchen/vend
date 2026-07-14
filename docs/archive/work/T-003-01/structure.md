# Structure — T-003-01 pure-menu-model

The blueprint: file-level changes, public interface, internal organization, and
ordering. Not code — the shape of the code.

## Files

| File | Action | Why |
|---|---|---|
| `src/shelf/menu.ts` | **create** | The pure menu model: types + `rankActions` + `visibleActions` + `renderMenu` + `formatBudget`. |
| `src/shelf/menu.test.ts` | **create** | Co-located `bun:test` suite covering every export and branch + purity. |

No other files change. `src/shelf/` is a new directory (first E-003 file). Nothing
reads/writes the filesystem; `.vend/` is untouched (T-003-02). The existing
`.gitkeep`-style placeholders in `src/play`/`src/gate` are not mirrored — the real
file makes the directory.

## `src/shelf/menu.ts` — public interface

Ordered top-to-bottom as the file will read:

1. **Doc header** — job, ticket id (T-003-01), explicit PURITY note (no fs /
   network / clock / process / LLM / addon), and the precompute-fork framing
   (`.vend/menu.json` seam, deterministic-first).

2. **Imports** — `import type { Budget } from "../budget/budget.ts";` (type-only;
   keeps the module pure and the budget denomination single-sourced).

3. **Tier / readiness vocabulary**
   - `export type ValueTier = "keystone" | "high" | "standard" | "leaf";`
   - `export type Readiness = "ready" | "blocked";`

4. **`Action`** — `{ id, title, tier, readiness, budget }`, all `readonly`
   (shape from design D2).

5. **`MenuCache`** — `{ version, generatedAt, stateHash, all, actions }` +
   `export const MENU_CACHE_VERSION = 1 as const;` (shape from design D3). JSDoc
   marks `generatedAt`/`stateHash` as **impurely populated by T-003-02/04** — the
   pure model only declares them.

6. **`RenderOpts`** — `export interface RenderOpts { readonly all?: boolean; }`.

7. **Private precedence maps** — `TIER_RANK`, `READINESS_RANK`
   (`Record<…, number>`), not exported (internal sort detail, design D4).

8. **`rankActions(actions: readonly Action[]): Action[]`** — PURE/TOTAL. Sorts a
   copy by tier then readiness; stable on full ties. Returns a fresh array.

9. **`visibleActions(actions: readonly Action[], all = false): Action[]`** —
   PURE/TOTAL. Filters out `blocked ∨ leaf-tier` unless `all`. The single filter
   shared by render and (later) persistence, guaranteeing identical numbering vs
   `MenuCache.actions`. Returns a fresh array; preserves input order (so
   `rankActions` → `visibleActions` stays ranked).

10. **`formatBudget(budget: Budget): string`** — PURE/TOTAL. `timeMs` → largest
    whole `h`/`m`/`s`; `tokens` → `k` when ≥1000, else the integer. Joined `"<t>/<tok>"`.

11. **`renderMenu(actions: readonly Action[], opts?: RenderOpts): string`** —
    PURE/TOTAL. Computes `visibleActions`, numbers 1..N, formats each row as
    `${n}. ${id} ${title}  [${Tier}] · ${formatBudget} · ${readiness}`, appends the
    hidden-count footer when `!all` and rows were hidden, and returns an empty-state
    line when nothing is visible. Internal `titleCase(tier)` helper (private).

### Internal helpers (not exported)

- `tierLabel(tier: ValueTier): string` — title-case for display (`high → "High"`).
- `humanTime(ms: number): string` — ms → `h`/`m`/`s` (largest whole unit; `0` and
  sub-second handled deterministically).
- `humanTokens(n: number): string` — `≥1000 → "<k>k"` (whole thousands; integer
  otherwise).

`humanTime`/`humanTokens` are composed by `formatBudget`; kept private to keep the
export surface to exactly what AC + the index contract need.

## `src/shelf/menu.test.ts` — coverage map

`bun:test` (`describe/test/expect`), plain fixtures, `toEqual` for exact
arrays/strings — mirroring `id-guard.test.ts`.

- **`rankActions`**
  - tier order: keystone < high < standard < leaf regardless of input order.
  - readiness within a tier: ready before blocked.
  - tier dominates readiness (blocked keystone outranks ready standard).
  - **stable** on full ties: two equal-tier-equal-readiness entries keep input order.
  - purity: `Object.freeze`d input survives unchanged; result is a new array.
  - empty input → `[]`.
- **`visibleActions`**
  - default hides `blocked`; default hides `leaf` tier even when ready.
  - `all=true` keeps everything, order preserved.
  - returns a fresh array; input not mutated.
- **`formatBudget`**
  - hours/minutes/seconds selection; tokens `k` vs raw; the `2h/50k` golden case.
- **`renderMenu`**
  - golden numbered render of a ready, mixed-tier fixture (exact string).
  - hidden-row behavior: blocked/leaf absent by default; footer `(+K hidden …)`.
  - `opts.all` reveals hidden rows and renumbers; no footer.
  - empty / all-hidden → the empty-state line.
  - row contains value tier + budget + state (the AC's three facets).

## Ordering of changes (for Plan)

1. Types + vocabulary (compiles, no logic).
2. `rankActions` + its tests.
3. `visibleActions` + its tests.
4. `formatBudget` (+ private `humanTime`/`humanTokens`) + its tests.
5. `renderMenu` + its tests.

Each step is independently typecheckable; tests are added alongside each so the
suite grows green. One atomic commit at the end of a green bar (house pattern —
the pure module + its full test land together).

## What this enables downstream (not built here)

- **T-003-02** imports `Action`, `MenuCache`, `MENU_CACHE_VERSION`, `rankActions`,
  `visibleActions`, `renderMenu`; gathers `Action[]` from `demand.md` + `lisa
  status`, stamps `generatedAt`/`stateHash`, persists `.vend/menu.json`, prints the
  render for bare `vend`.
- **T-003-04** reads `MenuCache`, resolves a parsed selection (T-003-03) against
  `actions[i-1]`, checks freshness via `generatedAt`/`stateHash`, dispatches with
  `budget` as the default envelope.
