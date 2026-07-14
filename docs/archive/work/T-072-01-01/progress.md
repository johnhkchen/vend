# Progress — T-072-01-01

## Status

Implementation and verification are complete. The ticket-owned source unit is ready
for its Lisa-managed exact-path commit.

## Completed phases

- Research completed in `research.md`.
- Design completed in `design.md`.
- Structure completed in `structure.md`.
- Plan completed in `plan.md`.
- Implementation completed in `src/cli.ts` and `src/cli.test.ts`.
- Focused and full verification completed successfully.

## Baseline

Before source edits:

```text
bun test src/cli.test.ts
104 pass
0 fail
145 expect() calls
```

This established a green focused baseline.

## Production changes completed

### `src/cli.ts` — grouped complete banner

- Replaced the flat usage list with an explicit synopsis and two sections.
- Added `free (no tokens):`.
- Added `metered (uses tokens):`.
- Preserved detailed syntax/options for every previously advertised named command.
- Added the existing `vend <selection> [--all] [--budget ...]` gesture, which had
  routing but no banner line.
- Preserved the existing `new here? vend user-guide` hint.
- Classified help itself as free so the newly introduced real route is not omitted
  from the complete command list.

Free entries now rendered:

1. `vend help | vend --help`
2. `vend shelf`
3. `vend doctor`
4. `vend user-guide`
5. `vend --version`
6. `vend envelope`
7. `vend audit`
8. `vend svg`
9. `vend init`

Metered entries now rendered:

1. `vend run`
2. `vend chain`
3. `vend expand`
4. `vend annotate`
5. `vend survey`
6. `vend steer`
7. `vend <selection>`

### `src/cli.ts` — pure help routing

- Added `{ readonly cmd: "help" }` to `ParsedCommand`.
- Added a first-token intercept for `--help` and `help` before selection parsing.
- Both spellings return exactly `{ cmd: "help" }`.
- The intercept follows `--version`'s informational short-circuit convention: any
  trailing tokens are ignored.
- The unknown-command parser path was not edited.

### `src/cli.ts` — dispatch shell

- Added a `help` arm immediately after usage-error handling.
- It writes `${USAGE}\n` to stdout.
- It exits with status 0.
- It performs no imports, filesystem reads, executor work, or token-consuming cast.
- Existing usage failures still write to stderr and exit 2.

## Test changes completed

### Pure parser proof

Added exact assertions:

```ts
parseArgs(["--help"]) === { cmd: "help" }
parseArgs(["help"]) === { cmd: "help" }
```

### Complete grouped inventory proof

Added a test that:

- locates both group headings in order;
- isolates group slices from the exported banner;
- checks all nine free markers are present only in the free slice;
- checks all seven metered markers are present only in the metered slice;
- checks the combined sixteen-entry inventory is unique.

### Shell proof

Added a subprocess test for both public spellings. Each run asserts:

- exit code is 0;
- stdout is exactly the exported grouped banner plus one newline;
- stderr is empty.

The subprocess returns before any lazy application imports, keeping the proof local,
deterministic, and BAML-addon independent.

## Focused verification

After implementation:

```text
bun test src/cli.test.ts
107 pass
0 fail
190 expect() calls
```

Manual shell observations:

- `bun src/cli.ts --help`: 23 stdout lines, zero stderr lines, exit 0.
- `bun src/cli.ts frobnicate`: zero stdout lines, error + banner on stderr,
  exit 2.
- The printed banner visibly contains the free and metered headings and all intended
  entries.

Static diff verification:

```text
git diff --check -- src/cli.ts src/cli.test.ts
# clean
```

Ticket-owned diff size before commit:

```text
src/cli.test.ts | 71 insertions
src/cli.ts      | 48 lines changed
2 files changed, 104 insertions(+), 15 deletions(-)
```

## Full repository gate

```text
bun run check
```

Result:

- BAML codegen succeeded with CLI 0.223.0.
- `tsc --noEmit` succeeded.
- Full test suite: 1654 pass, 1 skip, 0 fail.
- 5063 expectations across 111 files.
- The single skip is the repository's existing real-dist acceptance integration,
  skipped because no `dist/` artifacts exist.

## Deviations from plan

One deliberate clarification was made while implementing. The initial design text
treated help as only the catalog entry point and counted eight free entries. During
implementation, `help` became a real parsed verb by contract, so omitting it from a
“complete” grouped catalog would violate the same completeness principle the ticket
introduces. The final banner and acceptance test therefore include
`vend help | vend --help` as a ninth free entry. Design, structure, and plan artifacts
were updated to reflect this decision before the full gate.

No production-scope deviation occurred: only `src/cli.ts` and `src/cli.test.ts` were
edited for this ticket.

## Concurrent/shared worktree observations

The worktree contains changes not owned by this ticket:

- Lisa-managed ticket phase frontmatter for T-072 tickets;
- `src/engine/cast-core.ts` and its test from another active unit;
- `docs/active/work/T-072-01-01/` and `T-072-01-02/`, materialized by Lisa while
  this worker wrote only to its required private attempt path.

These files are not included in this ticket's commit. Exact `--include` paths protect
the transaction from concurrent work.

## Remaining implementation work

None for ticket acceptance.

## Commit action

Commit the single meaningful unit with `lisa commit-ticket` including exactly:

- `src/cli.ts`
- `src/cli.test.ts`

Afterward verify both paths are clean, record the commit result, and complete
`review.md`. Unknown-command suggestions remain intentionally deferred to dependent
ticket T-072-01-02.

## Commit result

The exact-path Lisa transaction succeeded:

```text
f7888717e40c1d3b3f4cec9bb30f3f12aea14411
feat(cli): add grouped help command (T-072-01-01)
```

`git show` confirms the commit contains exactly:

- `src/cli.ts`
- `src/cli.test.ts`

Post-commit verification confirms both ticket-owned paths have no unstaged diff and
the ordinary Git index is empty. Remaining status entries are Lisa-owned ticket phase
frontmatter and published work directories; no ticket-owned source remains dirty.
