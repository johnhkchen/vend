# Plan — T-003-01 pure-menu-model

Ordered, independently verifiable steps. Testing strategy and verification
criteria. Sized for a single atomic commit at the green bar (the pure module + its
full test land together — house pattern, cf. id-guard).

## Testing strategy

- **Everything is unit-tested.** The whole ticket is the pure side of the
  pure/impure split — there is no impure verb here, so there is nothing
  deliberately left untested (contrast project-context's `assembleInputs`).
- **`bun:test`**, plain fixtures, `toEqual` for exact arrays and **golden strings**
  for renders (membership AND order/format pinned — the id-guard discipline).
- **Purity is a tested property**, not just a claim: a `Object.freeze`d input to
  `rankActions`/`visibleActions` must survive unchanged and the result must be a
  fresh array.
- **Verification gate (AC#4):** `bun run check:typecheck` and `bun run check:test`
  both green. `bun run check:typecheck` proves the unions are exhaustive and the
  `Budget` type-only import resolves.

## Steps

### Step 1 — Types + vocabulary

Create `src/shelf/menu.ts` with the doc header, the `Budget` type-only import, and
the declarations: `ValueTier`, `Readiness`, `Action`, `MenuCache`,
`MENU_CACHE_VERSION`, `RenderOpts`. No logic yet.

- **Verify:** `bun run check:typecheck` green (file compiles; import resolves).

### Step 2 — `rankActions` + tests

Add `TIER_RANK`/`READINESS_RANK` and `rankActions` (sort a copy; comparator tier
→ readiness → 0). Create `src/shelf/menu.test.ts` with the `rankActions` suite:
tier order, readiness-within-tier, tier-dominates-readiness, **stability on full
ties**, frozen-input purity, empty → `[]`.

- **Verify:** `bun test src/shelf/menu.test.ts` green; the stability fixture proves
  input order is preserved for equal entries.

### Step 3 — `visibleActions` + tests

Add `visibleActions(actions, all=false)` (filter `blocked ∨ leaf-tier` unless
`all`; fresh array; order preserved). Add its suite: default hides blocked; default
hides ready-leaf; `all=true` keeps all in order; input not mutated.

- **Verify:** `bun test src/shelf/menu.test.ts` green; default vs `all` counts pinned.

### Step 4 — `formatBudget` (+ private time/token helpers) + tests

Add private `humanTime`/`humanTokens` and exported `formatBudget`. Add its suite:
hour/minute/second selection, token `k` vs raw, the `2h/50k` golden case, and a
sub-1000-token case.

- **Verify:** `bun test src/shelf/menu.test.ts` green; golden `formatBudget`
  strings exact.

### Step 5 — `renderMenu` + tests

Add private `tierLabel` and `renderMenu` (visibleActions → numbered rows → footer
→ empty-state). Add its suite: golden render of a ready mixed-tier fixture; hidden
default + `(+K hidden …)` footer; `opts.all` reveals + renumbers + no footer;
empty / all-hidden empty-state line; a row asserts tier + budget + state all
present.

- **Verify:** full `bun run check:test` and `bun run check:typecheck` green.

## Commit

One commit at the end of Step 5's green bar:

```
T-003-01: pure menu model — rankActions, renderMenu, MenuCache/Action types
```

Stage only `src/shelf/menu.ts`, `src/shelf/menu.test.ts`, and
`docs/active/work/T-003-01/*`. Do **not** stage the pre-existing modifications to
`docs/active/tickets/T-003-01.md` / `T-003-03.md` (Lisa owns ticket frontmatter).

## Verification criteria (maps to Acceptance Criteria)

- **AC#1** `src/shelf/menu.ts` exports all-pure `rankActions`, `renderMenu`, the
  `MenuCache`/`Action` types (+ `visibleActions`, `formatBudget` supporting the
  index contract and render) — Steps 1–5.
- **AC#2** Fully unit-tested with fixtures: ranking order, hidden-row behavior,
  render — Steps 2–5.
- **AC#3** No dependency on gather/CLI — verified by the import list (only
  `type Budget`) and the absence of any fs/process/clock reference; composed by
  T-003-02.
- **AC#4** `bun run check:test` / `check:typecheck` green — verified at Step 5.

## Risks / deviations protocol

- **Stable-sort assumption.** If Bun's sort were not stable the stability fixture
  would fail; the fallback (decorate-sort-undecorate with the input index) is
  documented in design D4 and would be applied, recording the deviation in
  `progress.md`. (Bun/V8 sort *is* stable — expected no-op.)
- **`Budget` import cycle.** None expected — `budget.ts` imports nothing from
  `shelf/`. If a cycle surfaced, inline a local structural `Budget` type and note
  the deviation. (Not expected.)
- Any deviation from this plan is recorded in `progress.md` before proceeding
  (RDSPI rule).
