# Progress — T-075-03-02 plain-empty-board-line

## Status

Implementation is complete, verified, and committed through Lisa. Review is the
only remaining phase.

Selected user-visible line:

```text
No work on the board yet.
```

## Completed phase work

- Read the assignment.
- Read `AGENTS.md`.
- Read the parent story before starting Research.
- Read the ticket, RDSPI workflow, vision, charter, and epic context.
- Mapped the pure menu and Home composition paths.
- Wrote private `research.md`.
- Evaluated copy/implementation alternatives in private `design.md`.
- Defined exact file/module boundaries in private `structure.md`.
- Sequenced tests, implementation, verification, and commit in private `plan.md`.
- Implemented the planned source/test unit.
- Ran focused red/green proof.
- Audited the literal footprint and diff.
- Ran the full canonical repository gate successfully.

## Step 1 — Ownership boundary check

Command:

```text
git status --short -- \
  src/shelf/menu.ts \
  src/shelf/menu.test.ts \
  src/shelf/home.test.ts \
  src/shelf/home-shell.ts
```

Initial result: no output. All four planned ticket-owned paths were clean.

Unrelated concurrent state was present elsewhere:

- `.lisa/provenance.jsonl`.
- Lisa-managed active ticket frontmatter.
- Sibling `T-075-03-01` artifacts.

During the run, Lisa also materialized `docs/active/work/T-075-03-02/`; this worker
continued writing phase artifacts only to the private attempt directory and did not
include the shared path in source commits.

No unrelated path was edited, staged, reverted, or adopted.

## Step 2/3 — Test-first contract

Modified `src/shelf/menu.test.ts`:

- Renamed the empty-input case to describe plain output and legacy exclusion.
- Captured `renderMenu([])` in `out`.
- Added exact equality with `No work on the board yet.`.
- Added `not.toContain("(no actions)")`.
- Kept the all-hidden golden test unchanged.

Modified `src/shelf/home.test.ts`:

- Kept the real `renderMenu([])` → `renderHome(...)` path.
- Asserted the first Home region exactly equals the selected sentence.
- Added whole-output `not.toContain("(no actions)")`.
- Kept populated shelf and ledger fixtures, isolating only the board state.

## Red proof

Command:

```text
bun test src/shelf/menu.test.ts src/shelf/home.test.ts
```

Result before production change:

- 33 passed.
- 2 failed.
- 62 assertions.
- Direct failure: expected `No work on the board yet.`, received `(no actions)`.
- Home failure: expected the first region to be the new sentence, received
  `(no actions)`.
- Every neighboring menu/Home behavior passed.

This demonstrates that both new gates detect the named defect independently.

## Step 4 — Pure production change

Modified `src/shelf/menu.ts` at the existing zero-visible branch.

Before:

```ts
return actions.length === 0 ? "(no actions)" : "(no salient actions — vend --all)";
```

After:

```ts
return actions.length === 0 ? "No work on the board yet." : "(no salient actions — vend --all)";
```

Preserved:

- `shown.length === 0` predicate.
- `actions.length === 0` true-empty discriminator.
- All-hidden guidance and its `vend --all` next move.
- Ranking.
- Visibility filtering.
- Numbering.
- Budget formatting.
- Cache schema.
- Press-selection semantics.
- Function signature and exports.
- Pure/total module boundary.

No helper, constant, type, import, or dependency was added.

## Step 5 — Comment accuracy

Modified only the degradation description in `src/shelf/home-shell.ts`.

- Removed the quoted legacy output.
- Described the missing-demand branch as the board's plain empty-state guidance
  line.
- Did not change executable code.
- Did not duplicate the new exact sentence in another production owner.

## Green focused proof

Command:

```text
bun test src/shelf/menu.test.ts src/shelf/home.test.ts
```

Result after production change:

- 35 passed.
- 0 failed.
- 64 assertions.
- 2 test files.
- Direct empty-input case green.
- Composed Home empty-board case green.
- All-hidden guidance case green.
- All other Home composition and ledger cases green.

## Diff audit

Command:

```text
git diff --check -- \
  src/shelf/menu.ts \
  src/shelf/menu.test.ts \
  src/shelf/home.test.ts \
  src/shelf/home-shell.ts
```

Result: exit 0, no whitespace errors.

Diff statistic before commit:

```text
src/shelf/home-shell.ts | 6 +++---
src/shelf/home.test.ts  | 5 +++--
src/shelf/menu.test.ts  | 6 ++++--
src/shelf/menu.ts       | 2 +-
4 files changed, 11 insertions(+), 8 deletions(-)
```

Inspection confirmed:

- One executable production literal changed.
- The shell change is comment-only.
- Both required tests have positive exact and negative legacy assertions.
- The all-hidden string is byte-identical.
- No sibling confidence source/test file changed.

## Legacy-literal audit

Command scoped to the current menu/Home source surface:

```text
rg -n --fixed-strings "(no actions)" \
  src/shelf/menu.ts \
  src/shelf/menu.test.ts \
  src/shelf/home.ts \
  src/shelf/home.test.ts \
  src/shelf/home-shell.ts
```

Result: exactly two occurrences remain:

- `src/shelf/menu.test.ts` explicit negative assertion.
- `src/shelf/home.test.ts` explicit negative assertion.

There is no positive expectation, production output, or current source comment
that emits/describes the legacy phrase. Historic artifacts and the ticket/story
continue quoting it because they define or record the defect.

## Full repository gate

Command:

```text
bun run check
```

Result: exit 0.

Stages:

- BAML generation completed with CLI 0.223.0 and wrote the normal 14 generated
  client files without leaving generated diffs.
- `tsc --noEmit` passed.
- Full `bun test` passed.

Test totals:

- 1,749 passed.
- 1 skipped (existing release acceptance integration skip because `dist/` is
  absent).
- 0 failed.
- 5,512 assertions.
- 1,750 tests across 116 files.

The skip is pre-existing/environmental and unrelated to this ticket; the canonical
gate exits successfully with it.

## Plan deviations

One minor execution-order deviation:

- Plan Steps 2 and 3 proposed running the menu-only red test before adding the Home
  test, then running both.
- Both tests were patched first and a single combined red command was run.
- The output showed two distinct failures with exact received/expected values, so
  it supplied the same independent red evidence without an extra redundant test
  process.

No scope, architecture, wording, file-ownership, verification, or commit deviation.

## Commit operation

The verified meaningful unit was committed with only:

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

No ordinary Git staging or commit command was used.

Result:

```text
1e5d9aabec9f42c8c6995ab4e392ed88669dccb1
```

Commit subject:

```text
plain empty-board guidance
```

Committed path list, verified with `git show --format= --name-only`:

1. `src/shelf/home-shell.ts`.
2. `src/shelf/home.test.ts`.
3. `src/shelf/menu.test.ts`.
4. `src/shelf/menu.ts`.

Commit statistic:

```text
4 files changed, 11 insertions(+), 8 deletions(-)
```

Post-commit command:

```text
git status --short -- \
  src/shelf/menu.ts \
  src/shelf/menu.test.ts \
  src/shelf/home.test.ts \
  src/shelf/home-shell.ts
```

Result: no output. No ticket-owned repository file is staged, modified, or
untracked.

General status still reports only Lisa/sibling-managed paths:

- `.lisa/provenance.jsonl`.
- `docs/active/tickets/T-075-03-01.md`.
- `docs/active/tickets/T-075-03-02.md`.
- `docs/active/work/T-075-03-01/`.
- `docs/active/work/T-075-03-02/`.

Those paths were not included in the commit and were left untouched by the source
implementation.

## Remaining implementation work

None. Write `review.md` and stop on this ticket for Lisa's completion handling.
