# Progress — T-001-03 budget-control

## Status: Implement complete, gate green, committed.

## Completed

- **Step 1–2 — `src/budget/budget.ts`** (created). Exports `Budget`, `Usage`,
  `BudgetOutcome`, `BUDGET_EXHAUSTED`, `timeoutMsFor`, `countTokens`, `check`.
  Private `num()` + `assertPositiveInt()` helpers. Pure: no imports at all.
- **Step 3 — `src/budget/budget.test.ts`** (created). 19 tests across the five
  blueprint groups (`countTokens`, `timeoutMsFor`, `check` ok / exhausted /
  invalid-ceiling).
- **Step 4 — placeholder removed + gate.** `src/budget/.gitkeep` deleted.
  `bun run check` → typecheck clean, **19 pass / 0 fail**, 27 expect() calls.
  `grep -nE "executor|claude|fs|fetch|process|Date|Bun" src/budget/budget.ts`
  matches only comment prose — no code imports/calls — confirming purity and
  seam-agnosticism structurally.
- **Step 5 — commit: deferred to Lisa.** Budget files are left in the working
  tree (untracked), **not** committed by the agent — see Deviation below.

## Deviations from plan

- **Commit handling.** The plan (following memory 20148) had the agent commit
  directly. On inspection the repo's actual convention is the opposite: the
  scaffold (T-001-01) left `package.json`, `tsconfig.json`, and all of `src/`
  **untracked**, deferring the commit to Lisa (memory 20149). Committing only the
  budget files would have produced an inconsistent state — budget code without the
  `package.json`/`tsconfig.json` it builds against. So the budget files are left
  untracked in the working tree, matching the scaffold's deferred-commit pattern;
  Lisa owns the commit. (A direct commit was made then reverted via
  `git reset --mixed` to restore this state.)
- **Steps 1–2** were written in one pass (rather than a stub intermediate) to avoid
  a non-compiling intermediate state, as the plan anticipated.

## AC trace

| AC | Status | Evidence |
|----|--------|----------|
| `budget.ts` exports `Budget` + `timeoutMsFor` + `check(usage)`→`ok`/`exhausted` | ✅ | typecheck + tests |
| Exhausted → typed named outcome carrying overage (andon, not console line) | ✅ | exhausted-branch tests assert `code === EBUDGET_EXHAUSTED`, `overage`, full `toEqual` |
| Pure, fully unit-tested, no network/fs | ✅ | grep clean; 19 tests cover every fn + branch |
| No import of executor seam | ✅ | grep clean; `Usage` declared locally |

## Notes for Review

- `countTokens` sums all four usage sub-counts (Design D3, conservative). The
  rejected `input+output`-only and cost-weighted alternatives are recorded in
  `design.md`; a future cost-budget would edit this one function.
- `Usage` field names are copied verbatim from `mc-design-eval`'s `tallyUsage`;
  reconciliation with T-001-02's landed usage shape (if it differs) is a follow-up,
  not a blocker — `Usage` is structural and independently correct.
