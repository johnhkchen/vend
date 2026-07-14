# T-075-04-03 — Progress: grouping documentation branch

## Outcome

Implementation is complete and verified. The expected homogeneous status collapse is now
documented directly at the `groupKeyFor` status branch in `src/present/project.ts`.

No runtime behavior changed. The designer preset still groups by normalized status, a board with
one distinct normalized state still produces one truthful group, and richer multi-lane grouping
remains separately designed scope.

## Completed contract work

- Read the complete Lisa assignment.
- Read `AGENTS.md` and the RDSPI workflow.
- Read the canonical vision and charter.
- Read parent story `S-075-04` before implementing the ticket.
- Read ticket `T-075-04-03` and preserved its fix-or-document boundary.
- Read all published predecessor artifacts for `T-075-04-02`.
- Kept all authored phase artifacts in the private attempt directory.
- Did not edit ticket phase or status frontmatter.

## Predecessor decision consumed

The prior diagnosis established:

- the reported board snapshot was commit `30a80db`;
- it contained 198 tickets;
- all 198 tickets had `phase: done`;
- `stateKey` therefore normalized all 198 to done;
- `DESIGNER_PRESET.groupBy` was status;
- equal status keys correctly formed one done bucket;
- the renderer did not drop or merge groups;
- the result was expected homogeneous-partition behavior;
- the bounded downstream branch was documentation;
- structural compound/nested/adaptive grouping was outside the story.

This ticket did not repeat or override that verdict.

## Source change

Modified:

```text
src/present/project.ts
```

Added a three-line comment immediately above the status return in `groupKeyFor`. The note records:

1. status is a true partition over normalized state;
2. if all tickets have the same `stateKey`, one group is expected;
3. stable subgroups require a separately designed compound/secondary grouping policy;
4. status grouping must not invent keys to create visual variety.

The executable branch remains:

```ts
return stateKey(ticket);
```

No other production source or test file was edited.

## Runtime and interface impact

- No function signature changed.
- No type changed.
- No exported API changed.
- No preset changed.
- No grouping key changed.
- No group order changed.
- No card or link projection changed.
- No SVG output changed.
- No filesystem behavior changed.
- No source of nondeterminism was introduced.
- No graph authority or mutation behavior changed.

## Targeted verification

Command:

```bash
bun test src/present/project.test.ts src/present/presets.test.ts src/present/svg-file.test.ts
```

Result:

- 43 tests passed;
- 0 tests failed;
- 102 expectations;
- 3 files.

Coverage exercised:

- every supported grouping axis;
- mixed normalized status grouping and ordering;
- one-group honest role behavior;
- deterministic, deeply frozen projection;
- one-way graph authority;
- designer status preset selection;
- SVG file-seam group and card counts;
- live-board read-only behavior.

## Full repository gate

Command:

```bash
bun run check
```

Result:

- BAML client generation passed;
- TypeScript `tsc --noEmit` passed;
- 1,751 tests passed;
- 1 test intentionally skipped;
- 0 tests failed;
- 5,514 expectations across 116 files.

The single skip is the existing optional real-`dist/` release-acceptance test and is unrelated to
this ticket.

## Testing decision

No new test was added because this is the story's documentation branch, not its behavior-change
branch. Existing tests already prove:

- different normalized status values yield distinct groups;
- a valid axis can yield one group;
- projection cardinality follows actual grouping keys;
- the designer default is status;
- the projection and file seam remain deterministic.

A new `>1` assertion would contradict the chosen branch. A new one-group-only fixture would repeat
the map-partition contract without increasing confidence in a comment-only change.

## Structural boundary preserved

This ticket did not introduce:

- raw-status grouping;
- leverage fallback;
- adaptive axes;
- minimum group counts;
- secondary grouping fields;
- nested projection groups;
- epic/story subdivisions inside status;
- SVG layout redesign.

The source note makes the boundary discoverable: stable subgroups on homogeneous status data need
a separately designed compound or secondary policy. The predecessor found that work unnecessary
to resolve the current correctness question, so no speculative epic was created in this ticket.

## Commit discipline

The sole ticket-owned production path is `src/present/project.ts`.

It is scheduled for the required Lisa transaction with an exact include after all gates passed:

```bash
lisa commit-ticket \
  --ticket-id T-075-04-03 \
  --message "docs(present): explain homogeneous status grouping (T-075-04-03)" \
  --include src/present/project.ts
```

No ordinary `git add`, `git add -A`, or `git commit` command has been used.

## Shared-worktree preservation

Pre-existing Lisa-owned modifications include `.lisa` state/configuration files and active ticket
frontmatter. They were not edited, staged, or included by this implementation. BAML generation
completed normally; final status inspection will confirm it did not leave ticket-external source
changes.

## Deviations from plan

None affecting scope, behavior, or verification.

The full gate emitted more output than the tool display budget, but the process completed with exit
zero and its final test summary was captured.

## Commit result

The exact-path Lisa transaction completed successfully:

```text
8202feca43205ffe51a90cbe44c85d31c0362fab
```

Commit subject:

```text
docs(present): explain homogeneous status grouping (T-075-04-03)
```

Committed file list:

```text
src/present/project.ts | 3 +++
```

Post-commit inspection confirmed `src/present/project.ts` is clean and no ticket-owned source file
is staged, modified, or untracked. Remaining shared changes are Lisa-managed state, ticket
frontmatter, and Lisa-published work-artifact copies.

## Remaining work

- Write `review.md`.
- Write `review-disposition.json` with the final honest disposition.
