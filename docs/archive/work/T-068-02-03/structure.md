# Structure — T-068-02-03: runner-materialize-and-surface

## Change set overview

The implementation is intentionally narrow:

- modify the generic runner and its public settlement shape;
- extend its existing executor-stub integration suite;
- create this ticket’s six workflow artifacts;
- do not modify the concrete decompose play, classifier cores, run-log schema, or ticket frontmatter.

## File inventory

### Modify `src/engine/cast.ts`

This remains the single active impure cast shell.

Four areas change.

#### 1. `RunSummary` interface

Add an optional literal warning marker:

```ts
readonly overEnvelope?: true;
```

Place it beside the core terminal settlement fields, after `materialized` and before produced output.

Document that it is present only for a token-exhausted cast whose gates explicitly cleared.

This is a read-only surfaced fact, not a caller input.

#### 2. Post-executor parse/gate block

Retain these variables:

- `budgetOutcome`;
- `gateVerdict`;
- `output`.

Change the control boundary from “result and budget OK” to “result exists and did not time out.”

The block shape becomes:

```ts
if (!timedOut && result) {
  budgetOutcome = check(...);
  output = play.parse(...);
  gateVerdict = opts.skipGates ? null : play.gates(...);
}
```

The gate-skipped notice remains where the gate decision is made.

Update the nearby comment to describe metering followed by parse/gate for every terminal result.

Do not change timeout exception handling.

Do not call gates when `skipGates` is true.

#### 3. Live settlement warning

After effect/andon handling, conditionally emit the warning when `verdict.overEnvelope` is true.

The warning reads numeric details from the already-populated exhausted `budgetOutcome`.

The type guard checks `budgetOutcome?.status === "exhausted"` for safe field access.

The branch presence is still controlled by `verdict.overEnvelope`, not re-derived from the budget result.

The line names itself as a settlement warning and says gates cleared/output retained.

#### 4. Durable and returned forwarding

In the `appendRunLog` input object, add the conditional one-way spread near other optional markers:

```ts
...(verdict.overEnvelope ? { overEnvelope: true } : {})
```

In the returned `RunSummary`, add the same conditional spread.

Keep `outcome` as the final possibly effect-relabeled outcome.

Keep exactly one end-of-cast append.

### Modify `src/engine/cast.test.ts`

This file remains the BAML-free effect-shell integration suite.

#### Imports

Extend filesystem imports with `mkdir` because the fixture effect creates board directories.

No concrete play import is added.

#### Fixture types and helper

Define a minimal fixture plan shape local to the test file:

- one story `{ id, title }`;
- one ticket `{ id, story, title }`.

Add a `boardPlanPlay` helper returning a `Play` with:

- a plain render string;
- JSON parsing;
- an explicit named clear verdict;
- an effect that creates `docs/active/stories` and `docs/active/tickets`;
- one markdown write per plan element;
- `ok: true` and artifact paths.

The helper is test-only and deliberately simpler than production decompose materialization.
Its purpose is to observe runner authorization, not retest formatting/collision logic.

#### Overshoot fixture test

Use the existing `stubExecutor`, which reports ten total input/output tokens.

Supply a budget with a token ceiling below ten.

The executor’s result text must be parseable by the fixture play.

Either parameterize the stub result or add a dedicated executor so the returned JSON plan is explicit.

Cast into a temporary root with a temporary run-log path.

Read both expected files afterward.

Read and parse the single JSONL record.

Use `reviveRecord` to verify marker survival at the normalized read boundary.

Assert summary, materialization, usage, gates, outcome, and warning.

### Create `docs/active/work/T-068-02-03/research.md`

Descriptive map of current runner, concrete play, classifier, log, and fixture seams.

### Create `docs/active/work/T-068-02-03/design.md`

Options and selected central-classification design.

### Create `docs/active/work/T-068-02-03/structure.md`

This file-level blueprint.

### Create `docs/active/work/T-068-02-03/plan.md`

Ordered implementation and verification steps.

### Create `docs/active/work/T-068-02-03/progress.md`

Implementation ledger, deviations, test results, and commit evidence if applicable.

### Create `docs/active/work/T-068-02-03/review.md`

Final handoff assessing acceptance, coverage, limitations, and shared-worktree concerns.

## Files intentionally unchanged

### `src/engine/cast-core.ts`

The authoritative generic classifier already returns the correct warning-bearing verdict.

### `src/engine/cast-core.test.ts`

The pure state matrix is already pinned by T-068-02-02.

### `src/play/decompose-epic-core.ts`

The mirrored legacy classifier is already correct.

### `src/play/decompose-epic.test.ts`

Its pure classifier coverage is already present.

### `src/play/decompose-epic.ts`

The concrete play already delegates runtime orchestration to `castPlay`.

Its effect already writes stories/tickets when invoked.

No warning or budget policy should enter this concrete module.

### `src/log/run-log.ts`

The input and normalized marker shapes already exist.

### `src/log/run-log.test.ts`

Marker normalization and round-trip behavior are already covered.

### `src/cli.ts`

The runner itself emits the settlement warning and returns the typed marker.

CLI commands already receive the returned summary; no command-specific classification or re-derivation is needed.

### `docs/active/tickets/T-068-02-03.md`

Lisa owns phase and status transitions.

## Boundary diagram

```text
stub/live Executor
      |
      v
terminal ResultMessage + usage
      |
      v
cast.ts: check -> parse -> gates
      |
      v
cast-core.classify
      |
      +-- STOP/timeout/no clear --> no effect, unmarked failure
      |
      `-- exhausted + CLEAR --> success + materialize + overEnvelope
                                  |          |             |
                                  v          v             v
                              play.effect  stdout      appendRunLog
                                  |                        |
                                  v                        v
                          story/ticket files       warning-bearing record
                                  
                                  `--> RunSummary.overEnvelope
```

## Public interface impact

`RunSummary` gains one optional property.

Existing producers that return object literals remain valid.

Existing consumers that ignore unknown optional properties remain unchanged.

Consumers can now inspect `summary.overEnvelope === true` without reading the ledger.

No function signature changes.

No `Play` interface changes.

No executor interface changes.

No record schema version changes.

## Ordering constraints

1. Add the fixture test so the current unreachable branch is represented.
2. Change parse/gate sequencing so the test can reach the classifier’s warned branch.
3. Forward the warning to record and summary.
4. Emit the live warning.
5. Run focused tests.
6. Run the full repository gate.
7. document implementation and review.

The test and source may be edited in one implementation unit because the fixture depends on all three forwarding points.

## Failure containment

If parsing fails, the exception remains a real runner error; no partial effect has run.

If gates stop, no effect runs.

If the effect refuses, its existing relabel behavior remains intact.

If append fails, the existing filesystem error still propagates.

If timeout occurs, result stays null and parse/gates remain unreachable.

No new partial-write mode is introduced by the runner change.

## Structural acceptance mapping

| Acceptance phrase | Structural owner |
|---|---|
| casting through a stub executor | `src/engine/cast.test.ts` |
| gates-passing plan | fixture play `gates` clear |
| overshoots token ceiling | stub usage + small fixture budget |
| writes story/ticket files | fixture play effect under temp board |
| logs a cleared record | `cast.ts` append + JSONL assertion |
| carrying warning | verdict spread + record assertion/revive |
| not discarded budget-exhausted | summary and record outcome assertions |
| live Settle warning | stdout line + `RunSummary.overEnvelope` |

## Structure conclusion

The code delta belongs entirely at the generic runner boundary and its existing integration proof.

Concrete decompose code remains unchanged because it already receives every authorized effect call through `castPlay`.
