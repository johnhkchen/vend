# Progress — T-003-01 pure-menu-model

Implementation log against `plan.md`. All five steps complete, zero deviations.

## Status: complete — green bar

- `bun test src/shelf/menu.test.ts` → **22 pass / 0 fail**.
- `bun run check:typecheck` → **clean (exit 0)**.
- `bun test` (full suite) → **185 pass / 0 fail** across 13 files.

## Steps

- **Step 1 — types + vocabulary** ✅ `src/shelf/menu.ts` created with the doc
  header, `import type { Budget }`, and `ValueTier`, `Readiness`, `Action`,
  `MenuCache`, `MENU_CACHE_VERSION`, `RenderOpts`. Compiles clean.
- **Step 2 — `rankActions`** ✅ `TIER_RANK`/`READINESS_RANK` + stable copy-sort.
  Tests: tier order, readiness-within-tier, tier-dominates-readiness, stability on
  full ties, frozen-input purity, empty → `[]`.
- **Step 3 — `visibleActions`** ✅ default filters `blocked ∨ leaf-tier`; `all`
  keeps everything in order; fresh array. Tests: drops blocked, drops ready-leaf,
  `all=true` keeps all, purity.
- **Step 4 — `formatBudget`** ✅ private `humanTime`/`humanTokens` + exported
  `formatBudget`. Tests: `2h/50k`, `30m/8k`, `45s/500`, sub-1000 `1m/999`.
- **Step 5 — `renderMenu`** ✅ private `tierLabel` + numbered rows + hidden-count
  footer + empty-state. Tests: golden render, tier+budget+state present,
  hidden-default + `(+2 hidden …)` footer, `all` reveals+renumbers+no footer,
  empty `(no actions)`, all-hidden guidance line. Plus a `MenuCache` shape test
  pinning the `actions[i-1]` resolution contract.

## Deviations

None. The stable-sort assumption (design D4 risk) held — the stability fixture
passes with the plain comparator; no decorate-sort-undecorate fallback needed.

## Notes for downstream

- Exports beyond the literal AC list: `visibleActions` (the single filter shared by
  render + T-003-02 persistence, guaranteeing identical numbering) and
  `formatBudget` (render helper + reusable by `vend <sel>`'s budget echo). Both
  pure; both justified by the index/render contract in design D5.
- The pure model declares `MenuCache.generatedAt`/`stateHash` but never fills them —
  clock + board-state hashing are impure and belong to T-003-02 (stamp) / T-003-04
  (freshness check).

## Commit

`T-003-01: pure menu model — rankActions, renderMenu, MenuCache/Action types`
(staged: `src/shelf/menu.ts`, `src/shelf/menu.test.ts`,
`docs/active/work/T-003-01/*`). The pre-existing `docs/active/tickets/*.md`
modifications were deliberately left unstaged — Lisa owns ticket frontmatter.
