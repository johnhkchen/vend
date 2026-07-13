# Plan — T-075-03-02 plain-empty-board-line

## Objective

Land one pure copy contract that renders `renderMenu([])` as
`No work on the board yet.`, proves that line both directly and through the Home
composition path, and refuses the legacy `"(no actions)"` output in both tests.

## Scope lock

Repository paths owned by this implementation:

1. `src/shelf/menu.ts`.
2. `src/shelf/menu.test.ts`.
3. `src/shelf/home.test.ts`.
4. `src/shelf/home-shell.ts` (comment only).

Do not edit:

- `src/shelf/shelf-row.ts` or its test; sibling ticket ownership.
- `src/shelf/home.ts`; its pass-through composition is already correct.
- `src/shelf/gather.ts`; it already delegates to `renderMenu`.
- Any ledger/recalibration module.
- CLI routing.
- Cache schema or press selection.
- Ticket phase/status frontmatter.
- Shared work artifact paths.

## Step 1 — Reconfirm clean ownership boundaries

Before source edits:

1. Run `git status --short`.
2. Record unrelated existing changes.
3. Check the four planned paths specifically with `git status --short -- <paths>`.
4. If one planned path has changed concurrently, inspect the diff and preserve any
   non-ticket work rather than overwriting it.
5. Re-read the current empty branches and tests so line numbers or sibling changes
   do not invalidate the patch context.

Verification:

- No ticket-owned path has an unexplained pre-existing change.
- Unrelated `.lisa`, ticket-frontmatter, and sibling work remain outside scope.

No commit: inspection only.

## Step 2 — Strengthen the direct menu test first

Modify only the empty-input test in `src/shelf/menu.test.ts`:

1. Rename it to describe the new plain behavior and legacy exclusion.
2. Store `renderMenu([])` in `out`.
3. Assert exact equality with `No work on the board yet.`.
4. Assert `out` does not contain `"(no actions)"`.
5. Leave the all-hidden test and every other test unchanged.

Run:

```text
bun test src/shelf/menu.test.ts
```

Expected intermediate result:

- The new empty-input assertions fail against the old production literal.
- Neighboring render tests continue to pass.
- The failure demonstrates that the new gate detects the defect.

If the test unexpectedly passes before the source edit, inspect for a concurrent
change rather than assuming the baseline.

No commit yet: the source unit is intentionally incomplete/red.

## Step 3 — Strengthen the Home composition test

Modify only the empty-board test in `src/shelf/home.test.ts`:

1. Keep constructing `boardMenu` via `renderMenu([])`.
2. Keep the existing non-empty shelf and ledger fixtures.
3. Assert the region before the first blank separator is exactly
   `No work on the board yet.`.
4. Assert the entire composed Home output does not contain `"(no actions)"`.
5. Leave all other Home, shelf, and ledger expectations untouched.

Run:

```text
bun test src/shelf/menu.test.ts src/shelf/home.test.ts
```

Expected intermediate result:

- The two new copy contracts fail against the old production string.
- Other direct and composition behavior stays green.
- The Home failure proves the defect reaches the leading Home region.

No commit yet: the same source unit remains red until production changes.

## Step 4 — Change the pure production branch

Modify `src/shelf/menu.ts`:

1. Locate the `shown.length === 0` branch.
2. Preserve the branch predicate.
3. Preserve `actions.length === 0` as the true-empty discriminator.
4. Replace only the true-empty literal with
   `No work on the board yet.`.
5. Preserve the all-hidden literal exactly.
6. Do not add a constant/export/helper.
7. Let the repository formatter determine line wrapping.

Run:

```text
bun test src/shelf/menu.test.ts src/shelf/home.test.ts
```

Expected result:

- Both new tests pass.
- All existing menu and Home tests pass.
- The all-hidden golden test remains unchanged and green.

No commit yet: refresh the now-stale source comment and run full verification first.

## Step 5 — Refresh the shell description

Modify only the relevant module-header comment in `src/shelf/home-shell.ts`:

1. Remove the quoted legacy phrase.
2. Describe the no-demand path as the board's plain empty-state guidance line.
3. Do not change imports, types, options, or executable code.
4. Do not duplicate the exact selected sentence in production comments.

Verification:

```text
git diff -- src/shelf/home-shell.ts
```

Expected result: one comment-only replacement.

## Step 6 — Audit the focused diff

Inspect:

```text
git diff -- \
  src/shelf/menu.ts \
  src/shelf/menu.test.ts \
  src/shelf/home.test.ts \
  src/shelf/home-shell.ts
```

Check each invariant:

- Production diff changes one literal only.
- Shell executable code is untouched.
- Direct test has exact positive and explicit negative assertions.
- Home test has exact leading-region and full-output negative assertions.
- All-hidden behavior is byte-identical.
- No sibling confidence files changed.
- No unrelated formatting churn exists.

Run a literal audit:

```text
rg -n --fixed-strings "(no actions)" \
  src/shelf/menu.ts \
  src/shelf/menu.test.ts \
  src/shelf/home.ts \
  src/shelf/home.test.ts \
  src/shelf/home-shell.ts
```

Expected result:

- No production/comment occurrence.
- Exactly two occurrences remain as explicit `not.toContain` regression checks,
  one in each required test file.

The ticket's own specification and historical documentation may continue quoting
the old phrase because they name the defect and record prior behavior.

## Step 7 — Focused verification

Run:

```text
bun test src/shelf/menu.test.ts src/shelf/home.test.ts
```

Required result:

- Exit code 0.
- 35 existing tests plus no unexpected test-count loss.
- No skipped or todo tests.
- Direct menu and composed Home contracts both pass.

If sibling work changes the total count, record the actual count rather than forcing
the baseline number; the named tests and zero failures are the contract.

## Step 8 — Full repository gate

Run the canonical gate before commit:

```text
bun run check
```

This runs:

1. BAML generation.
2. TypeScript typecheck.
3. Full Bun test suite.

Required result: exit code 0 for all three stages.

After the gate:

1. Run `git status --short`.
2. Inspect whether BAML generation changed any generated files.
3. Do not include unrelated/generated drift unless it was actually caused by this
   ticket; this ticket has no BAML changes, so unexpected generation drift is a
   blocker to inspect.
4. Confirm only the four ticket-owned repository paths carry this unit's changes.

## Step 9 — Write implementation progress before commit

Create/update the private attempt's `progress.md` with:

- Completed plan steps.
- Red/green evidence from focused tests.
- Exact selected line.
- Diff/literal audit result.
- Full gate command and result.
- Any deviations and why.
- The planned exact Lisa commit command.

Do not write `progress.md` to `docs/active/work/`.

## Step 10 — Commit the meaningful source unit through Lisa

Use only:

```text
lisa commit-ticket \
  --path . \
  --ticket-id T-075-03-02 \
  --message "plain empty-board guidance" \
  --include src/shelf/menu.ts \
  --include src/shelf/menu.test.ts \
  --include src/shelf/home.test.ts \
  --include src/shelf/home-shell.ts
```

Rules:

- No `git add`.
- No `git add -A`.
- No `git commit`.
- No ticket frontmatter in the include list.
- No private artifacts in the include list.
- No unrelated Lisa or sibling paths in the include list.

This is one meaningful unit because the production copy, both required gates, and
the accuracy-only comment describe one indivisible user-visible behavior.

## Step 11 — Post-commit ownership verification

After `lisa commit-ticket`:

1. Capture the commit hash and subject.
2. Inspect the commit's name-only path list.
3. Confirm it contains exactly the four included files.
4. Run `git status --short -- <four paths>`.
5. Required result: no output for ticket-owned paths.
6. Run general `git status --short` and distinguish remaining unrelated concurrent
   state from ticket-owned state.
7. Do not clean, stage, revert, or commit other agents' changes.

If the Lisa commit fails:

- Read its diagnostics.
- Correct only the ticket-owned path/lease issue.
- Re-run the full gate if source changes are needed.
- Retry with the same exact include discipline.

## Step 12 — Review phase

Write private `review.md` summarizing:

- Exact user-visible behavior.
- Files modified.
- Pure-core boundary preserved.
- Direct and composed test coverage.
- Focused and full-gate results.
- Commit hash and exact committed paths.
- Literal-audit result.
- Unchanged all-hidden behavior.
- Open concerns or limitations.
- Honest acceptance checklist.

If any acceptance condition is not met, mark it red plainly and stop. If all are
met, state that the ticket is ready for Lisa's publication/completion handling.

## Acceptance-to-proof matrix

| Acceptance clause | Implementation | Proof |
|---|---|---|
| `renderMenu([])` renders new plain line | `menu.ts` true-empty literal | Exact `menu.test.ts` equality |
| Direct output has no old phrase | Same production branch | `menu.test.ts` negative assertion |
| Empty-board Home renders new line | Existing pass-through composition | Exact first-region `home.test.ts` assertion |
| Home output has no old phrase | Same composed fixture | `home.test.ts` negative assertion |
| No unrelated behavior drift | Branch-local copy edit | Existing focused suite + full `bun run check` |
| Hidden actions remain discoverable | All-hidden branch untouched | Existing all-hidden golden test |
| Pure core preserved | No new dependencies/effects | Typecheck + source inspection |
| Done means committed | Lisa exact-path commit | Post-commit path/status audit |

## Completion condition

Implementation is complete only when the new sentence is green in both required
tests, the old phrase is explicitly refused in both outputs, `bun run check` is
green, the four source/test paths are committed through `lisa commit-ticket`, no
ticket-owned repository changes remain, and `progress.md` plus `review.md` exist in
the private attempt directory.
