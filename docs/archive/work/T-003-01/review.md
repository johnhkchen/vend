# Review — T-003-01 pure-menu-model

Handoff document. What changed, test coverage, open concerns. Enough to review
without reading every diff.

## Summary

Delivered the deterministic, addon-free core of the E-003 shelf: a pure module that
ranks salient actions by leverage and renders them as a numbered menu, plus the
`MenuCache` shape persisted to `.vend/menu.json`. No filesystem, clock, network, or
LLM — the impure verbs (gather, persist, CLI entry) are T-003-02; selection parsing
is T-003-03; resolve + dispatch is T-003-04. This is the deterministic side of
E-003's precompute fork; `.vend/menu.json` is the seam a later LLM-salience
precompute slots into with the same interface.

Committed at **`a204459`** (one atomic commit, green bar).

## Files changed

| File | Δ | Notes |
|---|---|---|
| `src/shelf/menu.ts` | **new** (~150 ln) | The pure model. First file under the new `src/shelf/` area. |
| `src/shelf/menu.test.ts` | **new** (~180 ln) | 22 fixture tests; mirrors the id-guard discipline. |
| `docs/active/work/T-003-01/{research,design,structure,plan,progress,review}.md` | **new** | RDSPI artifacts. |

Deliberately **not** changed: `docs/active/tickets/T-003-01.md` /
`T-003-03.md` carried pre-existing working-tree edits (Lisa owns ticket
frontmatter) and were left unstaged.

## Public surface (`src/shelf/menu.ts`)

- `type ValueTier = "keystone" | "high" | "standard" | "leaf"` — demand.md's
  leverage ranking.
- `type Readiness = "ready" | "blocked"`.
- `interface Action { id, title, tier, readiness, budget }` — `budget` reuses
  `src/budget/budget.ts`'s `Budget` (type-only import; single-sourced denomination).
- `interface MenuCache { version, generatedAt, stateHash, all, actions }` +
  `const MENU_CACHE_VERSION = 1`.
- `interface RenderOpts { all? }`.
- `rankActions(actions) -> Action[]` — stable sort, tier then readiness, copy (AC#1).
- `visibleActions(actions, all?) -> Action[]` — the single shared filter (index
  contract).
- `formatBudget(budget) -> string` — `2h/50k`-style human envelope.
- `renderMenu(actions, opts?) -> string` — numbered rows + hidden footer +
  empty-state (AC#1).

## Acceptance criteria

- **AC#1** menu.ts exports the pure `rankActions`, `renderMenu`, and the
  `MenuCache`/`Action` types — ✅ (plus `visibleActions`/`formatBudget` supporting
  the index + render contracts; all pure).
- **AC#2** fully unit-tested with fixtures — ranking order, hidden-row behavior,
  render — ✅ (22 tests, see below).
- **AC#3** no dependency on gather/CLI — ✅ (sole import is `type Budget`; no
  fs/process/clock/network reference). Composed by T-003-02.
- **AC#4** `bun run check:test` / `check:typecheck` green — ✅ (185 pass / 0 fail;
  typecheck exit 0). Advances **P2**.

## Test coverage

22 tests across `rankActions` (6), `visibleActions` (4), `formatBudget` (4),
`renderMenu` (7), `MenuCache` (2 — overlapping `describe`s). Notable:

- **Ranking:** tier order, ready-before-blocked within tier, tier-dominates-readiness,
  **stability on full ties** (input order preserved), empty input, frozen-input
  purity (fresh array, input untouched).
- **Visibility:** default drops blocked, default drops ready-leaf, `all=true` keeps
  all in order, purity.
- **Budget:** `2h/50k`, `30m/8k`, `45s/500`, sub-1000 raw.
- **Render:** golden numbered render; row carries tier + budget + state; hidden
  default + `(+2 hidden …)` footer; `all` reveals/renumbers/no footer; `(no
  actions)`; all-hidden guidance line.
- **MenuCache:** version pin; the `actions[i-1]` resolution contract round-trips.

**Gaps (intentional):** the impure population of `generatedAt`/`stateHash` and the
freshness/staleness check are out of scope (T-003-02/04). No property-based test for
sort stability — a fixture pins it and Bun/V8 sort is stable; acceptable for a
4-tier finite domain.

## Open concerns / notes for the next ticket

1. **Index contract is a shared-discipline, not enforced by a type.** Numbering is
   correct only if T-003-02 persists `visibleActions(actions, all)` (the same
   filter `renderMenu` uses) into `MenuCache.actions`, with the same `all`. The
   exported `visibleActions` exists precisely so both call one filter — T-003-02
   must use it rather than re-deriving the visible set. T-003-04 resolves selections
   against `MenuCache.actions` (a direct `actions[i-1]`), **not** by re-filtering.
2. **Numbering differs between `vend` and `vend --all`** by design (the cache
   records `all` + the displayed list). T-003-04 must read indices against the
   persisted list/mode, never recompute — flagged so the press gesture doesn't
   resolve a `--all` selection against a default-mode cache.
3. **`formatBudget` is display-only and lossy** (`90s` → `2m` via rounding;
   non-whole minutes fall to seconds). It is not a parser and must not be used to
   round-trip a budget; `--budget` parsing stays in `cli.ts parseBudgetArg`.
4. **Readiness is two-state** (`ready | blocked`). If `lisa status` later surfaces
   finer states (e.g. `in-progress`), extend `Readiness` and the default-hidden
   predicate together; `tsc`'s exhaustiveness over the union will flag the call
   sites.

## Risk assessment

Low. Pure, total, fully tested, no I/O, single type-only dependency on an existing
pure module. No runtime behavior touches the live board or `.vend/`. Nothing here
can clobber state; the only consumers are downstream E-003 tickets not yet built.
