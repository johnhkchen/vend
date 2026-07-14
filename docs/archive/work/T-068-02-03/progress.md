# Progress — T-068-02-03: runner-materialize-and-surface

## Status

Implementation complete.

Focused tests complete.

Adjacent contract tests complete.

Full repository gate complete and green.

Review artifact remains to be written after the implementation commit.

## Completed phase work

### Research

Read and grounded against:

- `AGENTS.md`;
- `docs/knowledge/rdspi-workflow.md`;
- `docs/knowledge/vision.md`;
- `docs/knowledge/charter.md`;
- `docs/active/stories/S-068-02.md`;
- `docs/active/tickets/T-068-02-03.md`;
- predecessor work for T-068-02-01 and T-068-02-02;
- generic runner, pure classifiers, run log, decompose effect, and fixture tests.

Wrote `research.md`.

Primary finding:

The new pure `exhausted + clear` verdict was unreachable because `castPlay` parsed and gated only when budget status was OK.

### Design

Wrote `design.md`.

Selected central runner sequencing:

- meter every returned result;
- parse and gate it even after detect-after token exhaustion;
- let the pure classifier authorize or refuse materialization;
- forward its warning marker unchanged;
- keep timeout and gate-stop behavior intact.

Rejected unconditional exhausted-result materialization and decompose-effect policy.

### Structure

Wrote `structure.md`.

Scoped production code to `src/engine/cast.ts`.

Scoped fixture coverage to `src/engine/cast.test.ts`.

Kept classifier, log schema, concrete decompose effect, CLI, and ticket frontmatter unchanged.

### Plan

Wrote `plan.md`.

Sequenced fixture, runner reachability, warning forwarding, focused tests, adjacent tests, full gate, diff review, progress, and review.

## Implementation changes

### `src/engine/cast.ts`

Extended `RunSummary` with optional literal `overEnvelope?: true`.

The field is one-way and optional, matching `Verdict` and normalized `RunRecord`.

Changed returned-result processing so token checking no longer suppresses parse and gates.

The runner now:

1. receives a terminal executor result;
2. checks its usage against the budget;
3. parses the result;
4. runs gates unless explicitly skipped;
5. classifies using timeout, budget outcome, and gate verdict.

This makes exhausted plus explicit clear live-reachable.

Timeout remains protected by the outer `!timedOut && result` condition.

An exhausted gate-skipped result still has a null gate verdict and remains discarded.

Added a live settlement warning:

```text
· settle warning: over-envelope — spent 22/10 tokens (over by 12); gates cleared, output retained
```

The branch is controlled by `verdict.overEnvelope`.

The numeric detail comes from the exhausted meter outcome.

Added conditional `overEnvelope: true` forwarding to `appendRunLog`.

Added the same conditional marker to the returned `RunSummary`.

No false marker is emitted or serialized.

### `src/engine/cast.test.ts`

Parameterised the existing stub executor with optional returned result text.

Existing echo tests continue to use the default string unchanged.

Added a BAML-free `BoardPlanFixture` with one story and one ticket.

Added a fixture play whose:

- parser reads returned JSON;
- gate explicitly clears `fixture-contract`;
- effect creates standard active story/ticket directories;
- effect writes one markdown file in each directory;
- effect reports successful materialization.

Added the ticket acceptance fixture.

Its executor reports:

- 7 input tokens;
- 3 output tokens;
- cost-weighted spend 22;
- supplied ceiling 10.

The test proves:

- the run settles as `success`;
- it does not settle as `budget-exhausted`;
- `materialized` is true;
- `summary.overEnvelope` is true;
- story content exists on disk;
- ticket content exists on disk;
- exactly one run-log record exists;
- record outcome is success;
- record warning is true;
- the named gate row passed;
- the recorded envelope is 10;
- `totalTokens(record)` exceeds the recorded envelope;
- revival preserves the marker.

Added an assertion that an ordinary in-budget success has no `overEnvelope` property.

## Verification log

### Focused integration suite

Command:

```bash
bun test src/engine/cast.test.ts
```

Final result:

- 5 passed;
- 0 failed;
- 40 expectations;
- live output included the explicit settlement warning.

### Adjacent contracts

Command:

```bash
bun test src/engine/cast-core.test.ts src/play/decompose-epic.test.ts src/log/run-log.test.ts
```

Result:

- 175 passed;
- 0 failed;
- 366 expectations.

This re-proved:

- generic classification matrix;
- mirrored decompose classification matrix;
- log marker normalization, omission, serialization, and revival.

### Full repository gate

Command:

```bash
bun run check
```

Final result after all source/test edits:

- BAML client generation succeeded;
- `tsc --noEmit` succeeded;
- 1,600 tests passed;
- 1 expected integration test skipped because `dist/` artifacts were absent;
- 0 tests failed;
- 4,797 expectations passed;
- exit code 0.

## Plan deviations

No material design deviation.

The final fixture additionally asserts an ordinary in-budget record omits the warning and uses `totalTokens` to prove measured overshoot numerically.

Those additions strengthen the planned compatibility and overshoot checks without expanding production scope.

## Scope audit

Ticket-owned source/test changes:

- `src/engine/cast.ts`;
- `src/engine/cast.test.ts`.

Ticket-owned artifacts:

- `docs/active/work/T-068-02-03/research.md`;
- `docs/active/work/T-068-02-03/design.md`;
- `docs/active/work/T-068-02-03/structure.md`;
- `docs/active/work/T-068-02-03/plan.md`;
- `docs/active/work/T-068-02-03/progress.md`;
- `docs/active/work/T-068-02-03/review.md` remains pending.

Files intentionally not modified by this implementation:

- `src/engine/cast-core.ts`;
- `src/play/decompose-epic-core.ts`;
- `src/play/decompose-epic.ts`;
- `src/log/run-log.ts`;
- `src/cli.ts`;
- `docs/active/tickets/T-068-02-03.md`.

## Shared worktree

The worktree contained pre-existing Lisa hook/config/provenance changes, ticket frontmatter transitions, E-068 board files, and other work artifacts.

They were not cleaned, overwritten, or included in this ticket’s exact-path diff.

Exact-path staging will be used for the implementation commit.

## Commit state

Implementation committed:

- `c96d6f7` — `feat(cast): materialize warned overshoots (T-068-02-03)`.

Exact-path staging included only the two source/test files and this ticket’s pre-review artifacts.

The review artifact and this commit-reference update will be included in the handoff commit.

## Remaining work

1. write `review.md`;
2. exact-path review handoff commit;
3. stop without editing ticket phase/status.
