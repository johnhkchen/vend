# Review — T-068-02-03: runner-materialize-and-surface

## Final assessment

T-068-02-03 meets its acceptance criterion.

A gates-cleared plan returned by a stub executor after exceeding its token ceiling now:

- reaches parse and gates;
- receives the classifier’s warning-bearing success verdict;
- invokes the play effect;
- writes a story file and ticket file;
- settles as materialized success;
- emits a live over-envelope settlement warning;
- returns `overEnvelope: true` in its summary;
- appends one success record carrying `overEnvelope: true`;
- preserves the marker through run-log revival.

It is not logged or returned as `budget-exhausted`.

The full repository gate is green.

## Commit

- `c96d6f7` — `feat(cast): materialize warned overshoots (T-068-02-03)`.

The review handoff is committed separately after this artifact is written.

## Files changed

### `src/engine/cast.ts`

The active generic cast shell now parses and gates every returned non-timeout result, even when the token meter reports exhaustion.

This makes T-068-02-02’s pure `exhausted + clear` branch reachable in production orchestration.

The runner still delegates disposition to `classify`.

It does not locally decide that an overshoot may materialize.

`RunSummary` now carries optional literal `overEnvelope?: true`.

The runner conditionally forwards the same verdict marker to:

- live stdout as a settlement warning;
- the append-only run record;
- the returned settlement summary.

The warning line includes measured spend, ceiling, and overage and states that gates cleared/output was retained.

### `src/engine/cast.test.ts`

The executor stub now accepts optional result text while preserving its old default.

A BAML-free board-plan fixture parses one story and one ticket, explicitly clears a named gate, and writes one markdown file of each type under a temporary project root.

The fixture reports cost-weighted usage 22 against a ceiling of 10.

Assertions cover summary, files, record count, record disposition, gate evidence, marker, numerical overshoot, and revival.

The ordinary in-budget cast also asserts that no warning field is present.

### Workflow artifacts

Created:

- `research.md`;
- `design.md`;
- `structure.md`;
- `plan.md`;
- `progress.md`;
- `review.md`.

No file was deleted.

## Runtime behavior review

### Returned overshoot with gate clear

Sequence:

1. executor returns result and usage;
2. budget check reports exhausted;
3. runner parses the returned result;
4. play gates explicitly clear;
5. classifier returns success/materialize/warning;
6. effect writes output;
7. runner prints warning;
8. record is appended as success with warning;
9. summary returns success/materialized/warning.

This is the ticket’s required path.

### Returned overshoot with gate stop

The parser and gates now run.

The pure classifier prioritizes gate stop over token exhaustion.

The effect remains unreachable and the result is `gate-failed` without warning.

This branch is pinned in both pure classifier suites.

### Returned overshoot without an explicit clear

When gates are skipped, `gateVerdict` remains null.

The pure classifier keeps this as `budget-exhausted`, non-materializing, and unmarked.

The change therefore does not turn the experimental `--no-gates` path into a way to retain an overshoot.

### Timeout

Timeout produces no terminal result.

The outer `!timedOut && result` guard still prevents parse and gates.

The existing integration test confirms `timed-out` and no materialization.

### Ordinary clear

In-budget parse/gate/effect behavior is unchanged.

The fixture suite confirms ordinary success remains unmarked.

## Acceptance mapping

> casting a gates-passing plan that overshoots its token ceiling through a stub executor

The new stub result reports 7 input plus 3 output tokens.

Under the repository’s cost-weighted meter this is 22 units against a supplied ceiling of 10.

The fixture gate explicitly clears `fixture-contract`.

> writes the story/ticket files

The test reads and verifies:

- `docs/active/stories/S-068-99.md`;
- `docs/active/tickets/T-068-99-01.md`.

Both are under a temporary project root and removed after the test.

> logs a cleared record carrying the over-envelope warning

The single JSONL record has:

- `outcome: "success"`;
- `overEnvelope: true`;
- one passed `fixture-contract` gate row;
- envelope token ceiling 10;
- usage whose `totalTokens` is greater than 10.

`reviveRecord` retains the warning.

> not a discarded budget-exhausted

Both returned summary and record are asserted not to be `budget-exhausted`.

`summary.materialized` is asserted true and both files are observable.

## Test coverage

### Focused effect-shell test

```bash
bun test src/engine/cast.test.ts
```

Result:

- 5 passed;
- 0 failed;
- 40 expectations.

The test output visibly includes:

```text
· settle warning: over-envelope — spent 22/10 tokens (over by 12); gates cleared, output retained
```

### Adjacent contract suites

```bash
bun test src/engine/cast-core.test.ts src/play/decompose-epic.test.ts src/log/run-log.test.ts
```

Result:

- 175 passed;
- 0 failed;
- 366 expectations.

Coverage includes timeout, exhausted-clear, exhausted-stop, exhausted-null, ordinary clear/stop, one-way marker omission, malformed marker handling, byte compatibility, serialization, and revival.

### Full gate

```bash
bun run check
```

Final result:

- BAML generation passed;
- TypeScript passed;
- 1,600 tests passed;
- 1 expected integration test skipped because no `dist/` artifacts were present;
- 0 tests failed;
- 4,797 expectations passed.

## Architecture review

Pure core and impure shell remain separated.

The pure classifier still owns the authorization and warning decision.

The impure runner only sequences validation, invokes the authorized effect, displays the decision, and persists it.

The engine remains play-agnostic and imports no concrete play or BAML module.

The concrete decompose effect remains responsible only for plan canonicalization, materialization guards, writes, and validation.

The run log remains a passive normalized sink and does not classify.

No duplicated budget/gate predicate was introduced for marker presence.

## Compatibility review

No new run outcome was added.

No run-log schema version changed.

No budget accounting changed.

No timeout behavior changed.

No `Play` or executor interface changed.

`RunSummary.overEnvelope` is optional, so existing constructed summaries and consumers remain valid.

Ordinary records omit the key rather than serializing false.

## Open concerns and limitations

### Detect-after remains detect-after

This change does not prevent token overshoot.

The executor has already spent and returned usage before the runner can classify it.

The implementation changes disposition of completed output only.

### Exhausted malformed output now parses

Previously an exhausted result was classified without parsing.

Now parsing is required to reach gates.

A malformed exhausted response can therefore throw at the parser boundary rather than settle as a clean `budget-exhausted` record.

That is consistent with the runner’s existing treatment of genuine parse failures, but it is a behavioral consequence worth noting.

### Fixture uses a minimal effect

The acceptance fixture writes representative story/ticket files with a test-local effect instead of loading the BAML-backed concrete decompose module.

This avoids the known native-addon test constraint and isolates runner behavior.

Production `materialize`, real decompose gates, and decompose-shaped cast fixtures are covered elsewhere in the suite.

### Warning rendering is runner-owned

The live warning is emitted inside `castPlay`, and the returned summary also carries the marker.

Existing CLI final summary lines do not duplicate the warning text; the warning has already appeared live during settlement.

## Shared worktree

The worktree contained unrelated Lisa configuration/hooks/provenance changes, ticket transitions, E-068 board files, and other work artifacts.

Exact-path staging excluded them from the implementation commit.

This review claims only the files listed above.

The ticket’s phase and status frontmatter were not edited by this work.

## Critical issues

None identified within ticket scope.

## Handoff conclusion

The story’s runner seam is now live: a paid-for overshoot can settle only after its gates clear, and its budget breach remains visible and countable.

Acceptance is fixture-proven, the full gate is green, and no open concern blocks Lisa’s next transition.
