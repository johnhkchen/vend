# Progress — T-079-01-01

## Status

Implementation is complete and verified. The ticket-owned source unit is ready for its Lisa-scoped
commit. Review artifacts remain after commit inspection.

## Completed RDSPI phases

- Research completed in private `research.md`.
- Design completed in private `design.md`.
- Structure completed in private `structure.md`.
- Plan completed in private `plan.md`.
- Implement source and tests completed.
- Review has not yet been written at this progress checkpoint.

## Source created

### `src/settle/settle-core.ts`

Implemented the pure settle domain boundary:

- `LAST_SETTLE_MARKER_PATH` and schema version constants;
- versioned `LastSettleMarker` done-ticket frontier;
- `parseLastSettleMarker` with absence-as-first-settle semantics;
- named `malformed-last-settle-marker` refusal for invalid persisted bytes;
- canonical marker serialization;
- `deriveEpicClearance` over the loaded `WorkGraph`;
- phase-done per-epic counts and global done frontier;
- non-vacuous all-done epic derivation;
- settle-owned gate facts;
- structured review-concern facts;
- copied canonical `SweepVerdict` facts;
- deterministic exception ordering;
- `computeSettleVerdict` aggregate verdict/refusal result;
- next-marker continuation data for the dependent effect shell.

The production file has only type-only imports and contains no filesystem, process, Git, clock,
network, BAML, executor, CLI, or run-log operation.

### `src/settle/settle-core.test.ts`

Created a pure fixture-board suite using canonical `buildGraph`:

- one all-done epic;
- one partial epic;
- one empty epic;
- a phase-done/status-open ticket proving phase authority;
- a status-done/phase-review ticket proving status does not count;
- a prior marker and newly-done delta;
- a first-settle full-board delta;
- an immediately repeated settle empty delta;
- carried gate, presweep, and review concern fields;
- gate -> presweep -> review exception ordering;
- exact nonblank next actions;
- canonical marker round trip;
- invalid JSON, version, keys, types, blanks, duplicates, and sorting refusals.

## Focused verification

Command:

```bash
bun test src/settle
```

Result:

```text
14 pass
0 fail
44 expect() calls
Ran 14 tests across 1 file.
```

Command:

```bash
bun run build
```

Result:

```text
tsc --noEmit
exit 0
```

## Diff verification

Command:

```bash
git diff --check -- src/settle/settle-core.ts src/settle/settle-core.test.ts
```

Result: exit 0, no whitespace errors.

Because both ticket paths are new/untracked before commit, ordinary `git diff` does not display their
contents. They were inspected directly and exercised through focused tests/typecheck. No ordinary
index staging was used.

## Full repository gate

Command:

```bash
bun run check
```

Result:

- BAML client generation: passed; 14 generated files written to ignored `baml_client/`.
- TypeScript `tsc --noEmit`: passed.
- Bun full suite: 1840 passed, 1 expected skip, 0 failed.
- Assertions: 5971 `expect()` calls.
- Test files: 121.
- Exit status: 0.

## Acceptance mapping at Implement

| Criterion | Implementation evidence | Test evidence |
|---|---|---|
| prior marker yields newly-done board delta | done-frontier set difference | aggregate prior-marker test |
| per-epic cleared counts | `deriveEpicClearance` | exact three-epic fixture object |
| all-done set | non-empty all-done derivation | expected `["E-100"]` |
| gate field | `SettleGateResult` copied into verdict | failed gate exact equality |
| presweep field | typed `SweepVerdict` copy | sorted done ids/offenders exact equality |
| review-concern field | sorted structured concerns | exact review concern array |
| ordered exceptions + nextAction | derived gate/presweep/review list | full exact exception array |
| no marker -> full board | null marker first-settle branch | all current done ids asserted |
| malformed marker -> named refusal | parser catches syntax/shape defects | seven malformed cases + aggregate refusal |
| focused test command green | `src/settle` suite | 14 pass, 0 fail |

## Plan adherence

No architectural deviation was required.

One implementation detail was made explicit within the planned boundary: epic summaries deduplicate
containment ticket ids by id before counting. The canonical graph normally contains each child once;
deduplication prevents malformed duplicate listing from inflating a count and does not alter valid
board behavior.

## Worktree/concurrency notes

The shared worktree changed while this ticket ran, as expected under Lisa concurrency. Current
non-ticket paths include Lisa provenance/ticket frontmatter and another T-079-03-01 attempt's work.
Lisa also began publishing this attempt's phase artifacts under `docs/active/work/T-079-01-01/`.

These paths are not ticket-owned source for this commit and will not be included. The exact commit
scope remains:

```text
src/settle/settle-core.ts
src/settle/settle-core.test.ts
```

## Source commit

The meaningful source unit was committed with the required Lisa transaction:

```text
13bbfb6d5622cdf32e43093f52a226335909aa9a
feat(settle): compute pure board verdict
```

Exact committed paths:

```text
src/settle/settle-core.ts
src/settle/settle-core.test.ts
```

Commit statistics: 2 files changed, 598 insertions. Post-commit `git status --short --` over both
ticket-owned paths is empty. No ordinary index command or ordinary Git commit was used.

## Post-commit verification

Focused `bun test src/settle` repeated successfully: 14 pass, 0 fail, 44 assertions.

Full `bun run check` repeated successfully after commit:

- BAML generation passed;
- typecheck passed;
- 1840 tests passed;
- 1 expected integration skip;
- 0 failures;
- 5971 assertions across 121 test files.

## Remaining work

1. Write `review.md` with final evidence and downstream boundary.
2. Write exact `review-disposition.json`.
3. Remain on this ticket for Lisa completion handling.
