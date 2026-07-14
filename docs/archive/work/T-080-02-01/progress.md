# Progress — T-080-02-01

## Status

Implementation complete, verified, and committed.

## Completed — pure assembly

Modified `src/sweep/sweep-core.ts`.

- Added canonical `SWEEP_PROVENANCE_PATH` for `.lisa/provenance.jsonl`.
- Added required `provenanceDirty` observation to `ComputeSweepInput`.
- Added explicit nullable `provenancePath` to successful `SweepFlipSet`.
- Kept optional cargo specific to one canonical file rather than introducing generic extra paths.
- Appended provenance after sorted epic paths only when dirty.
- Preserved all refusal shapes and ordering.
- Preserved the existing clearance commit message.
- Kept the core effect-free.

## Completed — pure tests

Modified `src/sweep/sweep-core.test.ts`.

- Updated every core caller to state the provenance observation explicitly.
- Pinned clean assembly to `provenancePath: null` and cards-only pathspec.
- Added dirty assembly proof for the canonical provenance path.
- Pinned provenance after the epic path in the ordered pathspec.
- Pinned the existing commit message across the new dirty branch.
- Retained presweep offender, no-ready-epic, already-done, stale-verdict, impossible verdict, and
  caller-array immutability coverage.

## Completed — shell observation

Modified `src/sweep/sweep.ts`.

- Reused the existing `git status --porcelain` snapshot.
- Reused the shared `parsePorcelainLine` parser.
- Compared parsed paths by exact equality with `SWEEP_PROVENANCE_PATH`.
- Passed only the plain dirty boolean into the pure core.
- Left `classifySweep` and `SWEEP_PREFIXES` unchanged.
- Added no second Git status call.
- Added no broad `.lisa/` policy.

## Completed — commit invariant

Updated `commitSweep` to derive the exact declared path list from:

1. every ordered flip path;
2. the explicit non-null provenance path, if present.

The function still refuses empty flips or any length/value/order mismatch before card reads or
writes.

The existing Git effects continue to consume only `plan.pathspec`:

```text
git add -- <exact paths>
git commit --only -m <message> -- <exact paths>
```

The failure rollback remains scoped to the same pathspec. It restores sweep-authored card bytes but
does not overwrite externally authored provenance bytes.

## Completed — real Git acceptance

Modified `src/sweep/sweep.test.ts`.

Added a disposable Git fixture with:

- one open eligible epic;
- one story;
- one phase-done ticket;
- tracked `.lisa/provenance.jsonl` baseline;
- local fixture Git identity.

Added a dirty tracked-provenance test that:

- modifies the tracked ledger after baseline;
- prepares the real graph and Git snapshot;
- proves the rendered plan lists epic plus provenance;
- commits through the real `commitSweep` effect;
- proves returned SHA equals HEAD;
- proves `git show --stat --oneline HEAD` lists both files;
- proves the exact diff-tree contains only both expected paths;
- proves the epic status flipped to done;
- proves the fixture tree is clean afterward.

Added a clean-provenance test that:

- prepares from an untouched tracked ledger;
- proves `provenancePath` is null;
- proves the exact pathspec is cards-only;
- proves the renderer does not mention provenance.

Added a mismatched-plan test that:

- prepares a valid clean plan;
- fabricates a pathspec with undeclared provenance cargo;
- proves `commitSweep` rejects it;
- proves HEAD, epic bytes, and porcelain remain unchanged.

Every temporary repository is removed in `finally`.

## Focused verification

Command:

```text
bun test src/sweep/sweep-core.test.ts src/sweep/sweep.test.ts
```

Result:

```text
19 pass
0 fail
67 expect() calls
```

The new real Git cases all passed.

## Type verification

Command:

```text
bun run build
```

Result: exit 0 (`tsc --noEmit`).

The required input/plan fields are fully wired; no optional compatibility escape was added.

## Diff hygiene

Command:

```text
git diff --check -- src/sweep/sweep-core.ts src/sweep/sweep-core.test.ts src/sweep/sweep.ts src/sweep/sweep.test.ts
```

Result: exit 0.

Pre-commit source stat:

```text
src/sweep/sweep-core.test.ts |  26 ++++++-
src/sweep/sweep-core.ts      |  21 ++++--
src/sweep/sweep.test.ts      | 162 ++++++++++++++++++++++++++++++++++++++++++-
src/sweep/sweep.ts           |  23 +++++-
4 files changed, 222 insertions(+), 10 deletions(-)
```

## Full repository gate

Command:

```text
bun run check
```

Result:

```text
BAML generation: pass
TypeScript: pass
1922 pass
1 intentional skip
0 fail
6287 expect() calls
exit 0
```

The intentional skip is the established release acceptance test that requires prebuilt `dist/`
artifacts.

## Plan deviations

No functional deviation.

The implementation followed the planned explicit-cargo design, exact porcelain observation, strict
pathspec derivation, and scoped real Git tests.

The fixture test asserts both commit stat visibility and exact diff-tree equality, giving stronger
file-list evidence than stat alone.

## Ticket-owned source unit

The coherent commit includes exactly:

- `src/sweep/sweep-core.ts`;
- `src/sweep/sweep-core.test.ts`;
- `src/sweep/sweep.ts`;
- `src/sweep/sweep.test.ts`.

No CLI, settle, seam, graph, presweep, board, or shared provenance source path is ticket-owned.

## Shared worktree preservation

Concurrent/Lisa-owned changes observed before commit include:

- `docs/active/tickets/T-080-01-01.md`;
- `docs/active/tickets/T-080-02-01.md`;
- sibling seam and settle source/test work;
- Lisa-published `docs/active/work/T-080-01-01/` and `docs/active/work/T-080-02-01/` artifacts.

These were not edited, restored, staged, or included by this ticket.

The shared repository's `.lisa/provenance.jsonl` was not modified for the fixture proof; tests used
only temporary repositories.

## Lisa commit evidence

The source unit was committed with the exact planned `lisa commit-ticket` transaction.

Commit:

```text
cdec0c347bd9018b96a7e577d755e87c15b65a6d
fix(sweep): carry dirty loop provenance
```

Committed file list:

```text
src/sweep/sweep-core.test.ts
src/sweep/sweep-core.ts
src/sweep/sweep.test.ts
src/sweep/sweep.ts
```

No other file appears in the commit.

The ordinary index is empty after the transaction. All four ticket-owned paths are clean.

## Post-commit verification

Command:

```text
bun test src/sweep/sweep-core.test.ts src/sweep/sweep.test.ts
```

Result:

```text
19 pass
0 fail
67 expect() calls
```

Post-commit shared status contains only Lisa-managed ticket transitions and published work artifact
directories. No ticket-owned source/test path is modified, staged, or untracked.

## Remaining action

Complete Review and disposition artifacts, then stop on this ticket for Lisa completion handling.
