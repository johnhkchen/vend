# Progress — T-072-02-01

## Status

Implementation is complete. The focused suite and full repository gate are green.
The ticket-owned source unit is ready for its exact-path Lisa commit.

## Completed steps

### 1. Added the pure accumulator state

- Added `CastProgress` to `src/engine/cast-core.ts`.
- State records weighted token spend, turn count, and seen assistant message IDs.
- Added frozen `EMPTY_CAST_PROGRESS` as the reusable reducer seed.
- State transitions return new frozen values.
- No clock, filesystem, process, network, or stdout edge was added.

### 2. Added safe per-turn extraction

- Added guarded traversal of the open `StreamMessage` transport shape.
- Only `type: "assistant"` messages are eligible.
- Eligible messages require a nested non-empty `message.id`.
- Eligible messages require nested object-shaped `message.usage`.
- Missing/malformed records return a no-op rather than throwing.
- Unknown types remain no-ops even with assistant-shaped lookalike fields.
- Terminal result usage remains excluded because it is cumulative.

### 3. Added price-true accumulation

- Imported canonical `countTokens` from `src/budget/budget.ts`.
- Each unique assistant message ID is charged exactly once.
- Repeated thinking/text/tool-use events for one nested message ID are idempotent.
- Turn count advances with each distinct accepted assistant message.
- No duplicate cost-weight vector was introduced.

### 4. Added humane progress formatting

- Added `CastProgressFormat` for explicit display inputs.
- The impure caller will supply elapsed milliseconds.
- The impure caller will supply funded `Budget.tokens`.
- The impure caller may supply the effective maximum turn count.
- Token formatting mirrors menu's rounded whole-thousands idiom.
- Elapsed formatting retains moving seconds in seconds/minutes/hours forms.
- An absent turn cap renders `turn N` without a fabricated denominator.

### 5. Added fixture and edge tests

- Added a seven-turn `StreamMessage` fixture.
- Each unique turn contributes 30,000 weighted units.
- The fixture total is exactly 210,000 weighted units.
- The fixture repeats one assistant message ID.
- The fixture includes system, user, rate-limit, result, and unknown events.
- The exact target line is pinned:

```text
elapsed 4m12s · 210k/500k · turn 7/15
```

- Defensive coverage includes absent/null/array nested records.
- Defensive coverage includes missing ID and missing usage.
- Defensive coverage includes duplicate ID identity preservation.
- Formatter coverage includes seconds, hours, small tokens, and no turn cap.

## Verification

### Focused test

Command:

```bash
bun test src/engine/cast-core.test.ts
```

Result:

- 59 passed;
- 0 failed;
- 131 expectations;
- completed in approximately 20 ms.

### Full repository gate

Command:

```bash
bun run check
```

Result:

- BAML client generation succeeded;
- `tsc --noEmit` succeeded;
- 1,654 tests passed;
- 1 test skipped by its existing dist-artifact condition;
- 0 tests failed;
- 5,063 expectations;
- full test phase completed in 8.32 seconds.

## Deviations from plan

No material design deviation.

The plan's illustrative commit invocation used positional ticket syntax before
checking help. The installed Lisa CLI requires `--ticket-id`; the commit uses the
documented installed syntax and exact repeated `--include` paths.

## Scope confirmation

- `src/engine/cast.ts` was not changed.
- `src/engine/cast.test.ts` was not changed.
- `formatMessage` was not changed.
- `makeStreamSink` was not changed.
- Transcript behavior was not changed.
- No live cast or metered model call was run.
- The active ticket frontmatter was not edited by this worker.

## Concurrent/unrelated tree state

The worktree also contains Lisa-owned ticket transitions and concurrent
`T-072-01-01` CLI source/artifacts. They are outside this ticket. The Lisa commit
will include only:

- `src/engine/cast-core.ts`;
- `src/engine/cast-core.test.ts`.

## Remaining

1. Commit the exact ticket-owned source paths through `lisa commit-ticket`.
2. Confirm those paths are clean afterward.
3. Write `review.md` with the final commit and handoff concerns.
4. Stop on this ticket for Lisa publication/completion handling.
