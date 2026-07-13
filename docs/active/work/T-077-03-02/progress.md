# Progress — T-077-03-02

## Status

Implementation, verification, and the exact source commit are complete. Review artifacts remain.

## Phase completion

- [x] Read assignment and repository agent instructions.
- [x] Read RDSPI workflow.
- [x] Read project vision, charter, and stack record.
- [x] Read parent story `S-077-03` before the ticket.
- [x] Read ticket `T-077-03-02`.
- [x] Read dependency story/ticket/review for `T-077-01-01`.
- [x] Trace the earlier `T-072-04-01` diagnosis and summary invariant.
- [x] Inspect pure accumulator, live formatter, impure call site, and existing tests.
- [x] Write `research.md` in the attempt-private directory.
- [x] Write `design.md` in the attempt-private directory.
- [x] Write `structure.md` in the attempt-private directory.
- [x] Write `plan.md` in the attempt-private directory.
- [x] Implement the planned regression test.
- [x] Run focused verification.
- [x] Run the authoritative repository gate.
- [x] Commit the source unit through Lisa.
- [x] Inspect commit isolation.
- [ ] Write Review and disposition.

## Implementation completed

Modified one ticket-owned source file:

- `src/engine/cast-core.test.ts`.

Added one test:

`pins the live turn fraction to deduped agent turns, never executor num_turns (T-077-03-02)`

The fixture contains:

- assistant `turn-1`;
- repeated assistant `turn-1`;
- assistant `turn-2`;
- terminal result with `num_turns: 23`.

It reduces the entire fixture through production `accumulateCastProgress` and formats the reduced
state through production `formatCastProgress` with `maxTurns: 15`.

Assertions pin:

- deduplicated progress is exactly two turns;
- the deduplicated count is at or below the cap;
- external `num_turns` is above the cap, making the negative check non-vacuous;
- the exact live line ends with `turn 2/15`;
- the line does not contain compact live `23/15`;
- the line does not contain summary-style `23 / 15 cap`.

## Source diff review

`git diff --check -- src/engine/cast-core.test.ts` passed.

The path-scoped diff contains exactly:

- one new test;
- 21 insertions;
- no deletion;
- no import change;
- no production change;
- no adjacent formatting churn.

## Focused verification

Command:

`bun test src/engine/cast-core.test.ts`

Result:

- 69 passed;
- 0 failed;
- 164 expectations;
- 1 file;
- exit 0.

The new `T-077-03-02` regression passed.

## Authoritative gate

Command:

`bun run check`

Result:

- BAML code generation succeeded;
- TypeScript `tsc --noEmit` succeeded;
- 1,781 tests passed;
- 1 declared skip;
- 0 tests failed;
- 5,615 expectations;
- 1,782 tests across 117 files;
- exit 0.

The declared skip is the existing real-`dist/` release acceptance test. It requires local release
artifacts and is unrelated to this ticket.

## Plan adherence

The implementation matches the selected Option C and file blueprint.

No design or scope deviation occurred.

The plan described a compact live negative `23/15` assertion. Implementation also includes the
summary-style `23 / 15 cap` negative assertion named literally by the ticket, providing an extra
grammar guard without expanding behavior or scope.

## Shared-worktree isolation

Before implementation, the repository already contained Lisa/concurrent changes. At the pre-commit
checkpoint, unrelated paths include:

- `.lisa/provenance.jsonl`;
- `docs/active/tickets/T-077-02-04.md`;
- `docs/active/tickets/T-077-03-02.md`;
- `docs/active/work/T-077-03-02/`.

Lisa has begun publishing admitted phase artifacts to the shared work path. This ticket does not
manually write to or include that path.

Only `src/engine/cast-core.test.ts` will enter the source commit.

## Commit preparation

Installed Lisa help confirms syntax:

```text
lisa commit-ticket [OPTIONS] --ticket-id <TICKET_ID> --message <MESSAGE> --include <INCLUDES>
```

Planned command:

```text
lisa commit-ticket \
  --ticket-id T-077-03-02 \
  --message "test(engine): pin live turn fraction units" \
  --include src/engine/cast-core.test.ts
```

No ordinary Git staging or commit command has been used.

## Remaining work

1. Write `review.md`.
2. Write `review-disposition.json`.

## Commit result

Lisa command:

```text
lisa commit-ticket \
  --ticket-id T-077-03-02 \
  --message "test(engine): pin live turn fraction units" \
  --include src/engine/cast-core.test.ts
```

Result:

- commit `1d35d3ac770c690196d9c00acfcfc609f8cb3254`;
- message `test(engine): pin live turn fraction units`;
- one file changed;
- 21 insertions;
- exact included path `src/engine/cast-core.test.ts`.

## Commit isolation verification

`git show --stat` and `git show --name-status` confirm the commit contains exactly the planned test
file.

Path-scoped unstaged and staged diffs for `src/engine/cast-core.test.ts` are empty after commit.

The remaining worktree status contains only Lisa/concurrent metadata, ticket, and published-work
paths listed above. No ticket-owned source is staged, modified, or untracked.

No ordinary `git add` or `git commit` command was used.
