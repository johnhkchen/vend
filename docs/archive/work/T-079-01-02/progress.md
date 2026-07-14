# Progress — T-079-01-02

## Status

Implementation, verification, and the ticket source commit are complete. Focused settle + CLI tests
pass from committed HEAD, typecheck is clean, exact-path diff checks are clean, and the full
repository gate is green. Review remains.

## Baseline

Before editing, exact status/diff inspection showed no preexisting changes in:

- `src/settle/settle.ts`;
- `src/settle/settle.test.ts`;
- `src/cli.ts`;
- `src/cli.test.ts`.

The shared worktree already contained unrelated Lisa/T-079-03 changes:

- `.lisa/hooks/on-notify`;
- `.lisa/provenance.jsonl`;
- board frontmatter for this and T-079-03;
- `docs/active/work/T-079-03-01/`;
- `docs/knowledge/lisa-loop-settled-contract.md`;
- `src/seam/`.

Those paths have not been edited or included by this ticket.

Dependency baseline:

```text
bun test src/settle/settle-core.test.ts
14 pass, 0 fail, 44 assertions
```

## Step 2 — settle effect shell

Created `src/settle/settle.ts`.

Implemented:

- strict, pure `reviewConcernFromDisposition`;
- present malformed artifact -> named repair concern;
- deterministic work-directory discovery;
- current `bun run check` observation and summary;
- canonical presweep through `donePhaseIds` + `classifySweep`;
- optional marker read;
- atomic marker publication via exclusive temp + rename;
- `runSettle({ root? })` orchestration;
- pure `renderSettleResult` with ANSI-red exceptions.

The module has no imports from play, executor, budget, funding, or run-log paths.

## Step 3 — one-screen rendering

The renderer prints:

- first/repeat delta;
- one clearance line per epic;
- sweep-ready suffix for all-done epics;
- repository gate result;
- canonical presweep result;
- named review concerns or explicit none;
- ordered red exceptions with exact core actions;
- typed marker refusal and exact repair action.

A valid verdict remains exit-0 data even when exceptions exist. Typed refusal is red and exit 1 in
the CLI. The renderer itself is pure and newline-terminated.

## Step 4 — effect ordering

`runSettle` performs board/marker/review reads, then runs the repository gate, then runs Git status.
The sequential gate -> Git order avoids observing gate-generated transient changes. The pure core is
called exactly once and marker bytes are published only for its `verdict` variant.

No deviation from the planned mutation boundary: `.vend/last-settle.json` is the only write target.

## Step 5 — focused settle tests

Created `src/settle/settle.test.ts`.

Coverage includes:

- canonical pass disposition;
- trimmed reasoned block;
- invalid JSON;
- blank block reason;
- invalid pass reason;
- extra keys and array root;
- complete multi-exception rendering;
- three red exception/reset pairs;
- exact next-action preservation;
- immediate-repeat empty delta;
- explicit empty review/exception lines;
- malformed marker refusal.

Initial focused result:

```text
bun test src/settle
24 pass, 0 fail, 78 assertions
```

## Step 6 — CLI grammar/help

Modified `src/cli.ts` to add:

- `vend settle` under `free (no tokens)`;
- the `{ cmd: "settle" }` union member;
- `settle` in the typo-suggestion command list;
- parser-table routing;
- a dedicated no-argument parser.

Modified `src/cli.test.ts` to prove:

- bare settle parses;
- positional and unknown flag reject;
- `--budget` rejects;
- settle is in the free help section;
- complete help inventory now contains 18 entries.

## Step 7 — CLI dispatch

Added a lazy settle dispatch arm before generic executor-bearing run dispatch.

Behavior:

- verdict -> stdout and exit 0;
- typed marker refusal -> stderr and exit 1;
- operational observation error -> one concise stderr line and exit 1.

No funding line, play registry lookup, executor selection, or run summary occurs.

## Step 8 — fixture acceptance

Added a real subprocess acceptance test in `src/cli.test.ts`.

Fixture facts:

- isolated temporary Git repository;
- canonical E-900 -> S-900-01 -> T-900-01/T-900-02 board;
- one phase-done and one active ticket;
- committed blocked review disposition named `missing release proof`;
- local deterministic gate printing `7 pass`;
- executable Claude sentinel;
- preexisting `.vend/runs.jsonl` sentinel bytes.

The test proves on first invocation:

- exit 0 and empty stderr;
- first delta names T-900-01;
- E-900 reports 1/2 cleared;
- gate reports green/7 tests;
- presweep reports green/one done ticket;
- review concern is named;
- exception is ANSI red;
- exact next action is visible;
- marker bytes become the canonical T-900-01 frontier;
- run ledger bytes are unchanged;
- executor sentinel is absent.

It then invokes settle immediately again and proves:

- exit 0;
- `delta: none since last settle`;
- run ledger still byte-identical;
- executor sentinel still absent.

## Step 9 — focused verification

Combined focused result:

```text
bun test src/settle src/cli.test.ts
153 pass, 0 fail, 460 assertions across 3 files
```

Typecheck:

```text
bun run check:typecheck
exit 0
```

Whitespace/path check:

```text
git diff --check -- src/settle/settle.ts src/settle/settle.test.ts src/cli.ts src/cli.test.ts
exit 0
```

Exact ticket-owned status at this point:

```text
M  src/cli.test.ts
M  src/cli.ts
?? src/settle/settle.test.ts
?? src/settle/settle.ts
```

## Plan deviations

None material.

The fixture initializes and stages its own temporary Git repository during test setup. This does not
touch the Vend repository ordinary index and is required to prove a green real presweep. Ticket source
will still be committed exclusively through `lisa commit-ticket`.

## Remaining

## Step 10 — full repository gate

```text
bun run check
exit 0
```

Results:

- BAML generation: 14 files generated, no ticket-external generated diff;
- TypeScript: clean;
- Bun suite: 1,886 pass, 1 pre-existing integration skip, 0 fail;
- 6,089 assertions across 124 files.

Post-gate exact-path `git diff --check` remains clean. Ticket paths remain exactly the two modified CLI
files plus the two new settle files. Ambient Lisa state advanced during the gate (the shared ticket
frontmatter/work publication changed), but no such path is ticket-owned source or included in the
planned commit.

## Remaining

## Step 11 — ticket source commit

Created through `lisa commit-ticket` with the four exact planned includes:

```text
7ad2089abadb759b262d061c4cb7108183f95176
feat(settle): add free one-screen verdict command
```

Committed paths:

```text
src/cli.test.ts
src/cli.ts
src/settle/settle.test.ts
src/settle/settle.ts
```

Commit stat: 4 files changed, 700 insertions, 1 deletion. No ordinary index command was used for
ticket source. Lisa-owned attempt/publication/board paths were not included.

Exact ticket-owned status after commit is empty.

## Step 12 — post-commit verification

```text
bun test src/settle src/cli.test.ts
153 pass, 0 fail, 460 assertions across 3 files
```

This re-proved the fixture's first-settle/empty-repeat behavior, run-ledger preservation, and executor
non-invocation from committed HEAD.

## Remaining

1. Complete Review artifacts and pass/block disposition.
