# Structure — T-077-03-02

## Change summary

This ticket adds one pure regression test and no production behavior.

The ticket-owned source unit is:

- modify `src/engine/cast-core.test.ts`.

Attempt-private workflow artifacts are:

- `research.md`;
- `design.md`;
- `structure.md`;
- `plan.md`;
- `progress.md`;
- `review.md`;
- `review-disposition.json`.

Lisa owns publication of those artifacts and the ticket's phase/status transitions.

## Files modified

### `src/engine/cast-core.test.ts`

Add one test inside the existing live progress describe block.

The test reuses the block-local fixtures:

- `perTurnUsage`;
- `assistant(id)`.

It also reuses existing imports already present in the file:

- `EMPTY_CAST_PROGRESS`;
- `accumulateCastProgress`;
- `formatCastProgress`;
- `StreamMessage`.

No import change should be required.

The new test owns four stages:

1. define the effective cap and executor terminal counter;
2. build and reduce a stream fixture through the production accumulator;
3. render the production live formatter;
4. assert the positive and negative unit contracts.

## Files not modified

### `src/engine/cast-core.ts`

No change. Its existing public boundary already exposes the needed behavior:

- `accumulateCastProgress(state, message)`;
- `formatCastProgress(state, options)`.

The formatter intentionally has no executor-counter input.

### `src/engine/cast.ts`

No change. The current call site already folds stream messages and passes the resulting progress
plus the effective cap to the live formatter.

### `src/engine/cast.test.ts`

No change. `T-077-01-01` already supplies the broad impure-shell seam characterization.

### `src/executor/claude.ts`

No change. `buildArgs` and its `--max-turns` behavior are dependency evidence, not part of this
ticket's owned surface.

### `src/play/decompose-epic-core.ts`

No change. `DECOMPOSE_MAX_TURNS` remains the authored default characterized by the dependency.

### Ticket and shared work metadata

Do not modify:

- `docs/active/tickets/T-077-03-02.md`;
- `.lisa/provenance.jsonl`;
- `docs/active/work/T-077-03-02/`.

Lisa owns these surfaces during the attempt.

## Test internal organization

The test belongs after the existing primary fixture test because both concern the accumulator-to-
formatter path. It may appear before the malformed-input and formatting-edge tests so the core
contract stays near the acceptance-line fixture.

### Constants

Use local constants:

```ts
const maxTurns = 15;
const executorNumTurns = 23;
```

These names encode the unit distinction. `executorNumTurns` intentionally mirrors Claude's external
field name without adding it to production formatter inputs.

### Fixture

Use an explicitly typed `StreamMessage[]`:

```ts
const fixture: StreamMessage[] = [
  assistant("turn-1"),
  assistant("turn-1"),
  assistant("turn-2"),
  { type: "result", subtype: "success", num_turns: executorNumTurns },
];
```

The repeated `turn-1` record makes deduplication material. The result record puts the unlike
external count in the same stream while production accumulation correctly ignores it.

### Reduction

Use the same production fold pattern as the existing acceptance fixture:

```ts
const progress = fixture.reduce(accumulateCastProgress, EMPTY_CAST_PROGRESS);
```

No bespoke test accumulator or mutation should be introduced.

### Formatting

Use deterministic plain inputs:

```ts
const line = formatCastProgress(progress, {
  elapsedMs: 252_000,
  tokenEnvelope: 500_000,
  maxTurns,
});
```

The expected non-turn segments match existing formatter coverage and are not dependent on a clock.

### Assertions

Organize assertions from facts to presentation:

1. `progress.turns` equals two.
2. `progress.seenMessageIds` equals `turn-1`, `turn-2` if additional clarity is useful.
3. `progress.turns <= maxTurns` is true.
4. `executorNumTurns > maxTurns` is true.
5. the full live line equals the expected text with `turn 2/15`.
6. the line does not contain `` `${executorNumTurns}/${maxTurns}` ``.

The seen-ID assertion is optional because the adjacent fixture already tests the complete list. The
turn-count assertion is the ticket's essential deduplication oracle.

## Public interfaces

No public type, function, module, CLI, persistence schema, or display grammar changes.

The ticket consumes current interfaces exactly as users of the pure core do. This makes the test a
compatibility constraint on:

- the semantic meaning of `CastProgress.turns`;
- deduplication by nested assistant `message.id`;
- the numerator selected by `formatCastProgress`;
- the denominator selected from `CastProgressFormat.maxTurns`.

## Pure-core boundary

All test inputs are plain in-memory values. No shell effects are added.

The test validates the pure side of an existing boundary:

```text
stream messages
  -> accumulateCastProgress
  -> CastProgress.turns (deduped agent-turn unit)
  -> formatCastProgress + maxTurns (same unit)
  -> live line
```

Claude terminal `num_turns` travels through the fixture only as a negative-control fact. It does not
enter the formatter interface.

## Ordering of changes

1. Complete and save Research.
2. Complete and save Design.
3. Complete and save this Structure blueprint.
4. Write the implementation Plan.
5. Add the single test to `src/engine/cast-core.test.ts`.
6. Run the focused test file.
7. Run `bun run check`.
8. Record final progress.
9. Commit the exact source file through Lisa.
10. Inspect the commit and worktree isolation.
11. Write Review and the required disposition JSON.

## Commit boundary

The one meaningful source unit is the regression test file. Use one commit with a test-scoped
message such as:

`test(engine): pin live turn fraction units`

The exact include set is:

- `src/engine/cast-core.test.ts`.

Attempt-private phase artifacts are not added through ordinary Git and are not part of the source
commit. Lisa publishes admitted artifacts separately.

## Verification boundaries

### Focused verification

`bun test src/engine/cast-core.test.ts`

This should exercise the entire changed source file without loading the BAML native addon.

### Repository verification

`bun run check`

This is the required gate and includes BAML code generation, typecheck, and the full test suite.

### Commit verification

Inspect:

- `git show --stat --oneline HEAD`;
- `git show --name-only --format= HEAD`;
- `git status --short` for the owned test path.

The expected commit contains exactly one path and the owned test path is clean afterward. Existing
unrelated changes may remain in the shared worktree.

## Failure boundaries

If the new test reveals the current live line can render executor `num_turns` over the cap, this
ticket cannot honestly remain test-only. Record the mismatch as a plan deviation before considering
production work, and reassess against the story's honest boundary.

If unrelated concurrent changes break the full gate, distinguish them with focused verification and
report the actionable blocker. Do not modify unrelated ticket files to force green.

If Lisa refuses the exact-path commit, preserve the verified source change, record the command and
error in `progress.md`, and do not fall back to ordinary Git staging.
