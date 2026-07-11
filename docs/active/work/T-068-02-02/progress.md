# Progress — T-068-02-02: classify-warn-not-discard

## Current state

Research, Design, Structure, Plan, and implementation are complete.

Focused tests and TypeScript checking are green.

The implementation commit and full repository gate remain before Review.

## Research completed

Read the parent story before the ticket as required by the repository workflow.

Mapped both mirrored classifiers, their test suites, the budget outcome, the landed run-log marker,
the current runner control flow, and recalibration's outcome filters.

Confirmed that T-068-02-01 established `RunRecord.overEnvelope?: true` without adding a new
`RunOutcome`.

Confirmed that T-068-02-03 owns parsing/gating exhausted output, effect execution, record stamping,
live warning text, and fixture proof.

Confirmed that successful records are completed-cost observations while `budget-exhausted` and
`timed-out` records are right-censored.

## Design completed

Selected a successful materializing verdict with `overEnvelope: true` for explicit clear plus token
exhaustion.

Settled recalibration treatment: the completed overshoot is a success sample because its finishing
cost is observed; the marker separately preserves the budget-contract breach.

Selected timeout → stop → exhausted-clear → exhausted-null → ordinary-success precedence.

Required explicit clear for the special path so a null/ungated exhausted cast remains discarded.

Rejected a materializing `budget-exhausted` result because it would falsely remain right-censored.

Rejected a new outcome because the dependency deliberately established an orthogonal marker.

Rejected runner-side warning derivation because disposition belongs in the pure classifier.

## Structure and Plan completed

Defined modifications to:

- `src/engine/cast-core.ts`;
- `src/engine/cast-core.test.ts`;
- `src/play/decompose-epic-core.ts`;
- `src/play/decompose-epic.test.ts`.

Explicitly kept runner, run-log, budget, recalibration, story, and ticket files outside the change.

Committed the four pre-implementation artifacts:

```text
ec34f9d docs(T-068-02-02): design warned overshoot classification
```

The commit contained only `research.md`, `design.md`, `structure.md`, and `plan.md`.

## Test-first red proof

Updated both classifier suites before production code.

Added/changed assertions for:

- exhausted plus explicit clear;
- exhausted plus stop;
- exhausted plus null gate;
- timeout warning absence;
- in-budget stop warning absence;
- in-budget clear warning absence.

Ran:

```text
bun test src/engine/cast-core.test.ts src/play/decompose-epic.test.ts
```

Pre-implementation result:

```text
83 pass
4 fail
176 expect() calls
87 tests across 2 files
```

The four failures were exactly the two changed policy branches in each mirror:

1. exhausted plus clear still returned `budget-exhausted` instead of `success`;
2. exhausted plus stop still returned `budget-exhausted` instead of `gate-failed`.

The exhausted-plus-null preservation tests passed under the old implementation.

No unrelated test failed.

## Generic classifier implemented

Extended local `Verdict` with:

```ts
readonly overEnvelope?: true;
```

Reordered classification so timeout returns first and explicit stop returns second.

Added the exhausted branch's explicit clear check.

An exhausted clear now returns:

```ts
{ outcome: "success", materialize: true, gateLog, overEnvelope: true }
```

An exhausted null verdict retains:

```ts
{ outcome: "budget-exhausted", materialize: false, gateLog }
```

Updated comments to remove the old assumption that exhaustion always means gating was skipped.

Kept `castGateRows` unchanged.

## Decompose classifier implemented

Added the identical optional literal field to the local concrete `Verdict`.

Applied the same semantic branch ordering using `isStop` for the concrete gate union.

After the stop branch narrows away gate failures, a non-null result inside the exhausted branch is
an explicit clear and returns the warned success.

Kept null exhausted results censored and non-materializing.

Updated documentation symmetrically.

Kept `gateRowsFor` unchanged.

## Focused green proof

Ran:

```text
bun test src/engine/cast-core.test.ts src/play/decompose-epic.test.ts
```

Post-implementation result:

```text
87 pass
0 fail
189 expect() calls
87 tests across 2 files
```

This covers the new matrix in both classifier mirrors and retains all existing tests in the two
pure-core files.

## Typecheck proof

Ran:

```text
bun run check:typecheck
```

Result:

```text
$ tsc --noEmit
exit 0
```

The optional literal field and all current consumers typecheck without runner changes.

## Deviations

No implementation deviation from Design or Structure.

The tests explicitly cover exhausted-plus-null in addition to the ticket's named combinations.

This was planned to preserve the story's explicit-clear boundary and protect generic no-gates
behavior from accidentally authorizing an exhausted cast.

No runner or recalibration test was added because those effects and integration proof belong to
T-068-02-03.

## Remaining

1. Inspect the path-limited implementation diff.
2. Commit production changes, tests, and this progress artifact.
3. Run `bun run check`.
4. Write `review.md` with final evidence and successor concerns.
5. Commit the Review artifact without changing ticket frontmatter.
