# Structure — T-072-02-01

## Change inventory

| File | Action | Responsibility |
|---|---|---|
| `src/engine/cast-core.ts` | modify | progress state, reducer, and humane formatter |
| `src/engine/cast-core.test.ts` | modify | fixture proof and defensive edge cases |
| attempt `progress.md` | create later | implementation and verification record |
| attempt `review.md` | create later | final handoff |

No production file is created or deleted. No impure shell file changes.

## Dependency direction

```text
budget/budget.ts
  Usage + countTokens
          ↓
engine/cast-core.ts
  CastProgress
  EMPTY_CAST_PROGRESS
  accumulateCastProgress
  formatCastProgress
          ↓ (next ticket only)
engine/cast.ts
  clock + funded Budget + stdout refresh
```

The core depends on budget policy. Budget does not depend on engine or executor.
The executor message dependency remains type-only and erased at runtime.

## Import changes

Current `cast-core.ts` imports `BudgetOutcome` as a type from `budget.ts`.
Change that import to:

```ts
import { countTokens, type BudgetOutcome, type Usage } from "../budget/budget.ts";
```

`countTokens` is the sole new runtime dependency. It is pure and has no effects.
No import from `menu.ts` is added.

## Public state interface

Add near the existing stream-formatting functions:

```ts
export interface CastProgress {
  readonly weightedTokens: number;
  readonly turns: number;
  readonly seenMessageIds: readonly string[];
}
```

The field names make units explicit. `weightedTokens` cannot be mistaken for raw
throughput. `seenMessageIds` names the transport identity being tracked.

## Empty state

Export:

```ts
export const EMPTY_CAST_PROGRESS: CastProgress
```

Shape:

```ts
{
  weightedTokens: 0,
  turns: 0,
  seenMessageIds: []
}
```

Freeze both the array and object. Callers may safely reuse this seed for every
cast because reducer transitions never mutate it.

## Internal structural helpers

Add one private record predicate:

```ts
function isRecord(value: unknown): value is Record<string, unknown>
```

It accepts non-null objects and rejects arrays. This supports safe descent into
the open stream payload without exceptions.

A private assistant-turn extractor may return:

```ts
interface AssistantTurn {
  readonly id: string;
  readonly usage: Usage;
}
```

or `null` when the accepted-message rule fails. Keeping extraction separate from
transition logic makes external JSON validation readable.

## Reducer interface

Export:

```ts
export function accumulateCastProgress(
  state: CastProgress,
  msg: StreamMessage,
): CastProgress
```

Transition order:

1. Extract an identifiable assistant turn.
2. Return `state` if extraction fails.
3. Return `state` if `seenMessageIds` contains the ID.
4. Call `countTokens(turn.usage)`.
5. Return a new frozen state with spend added and turns incremented.
6. Append the ID to a new frozen seen-ID array.

This function performs no clock reads, output, or message mutation.

## Formatter input

Export a named options interface:

```ts
export interface CastProgressFormat {
  readonly elapsedMs: number;
  readonly tokenEnvelope: number;
  readonly maxTurns?: number;
}
```

The name distinguishes display inputs from accumulator state. `tokenEnvelope`
avoids importing or accepting the broader `Budget` object.

## Formatter interface

Export:

```ts
export function formatCastProgress(
  state: CastProgress,
  opts: CastProgressFormat,
): string
```

Composition:

```text
elapsed <human elapsed> · <human spend>/<human envelope> · turn <used>[/<max>]
```

The formatter does not alter state.

## Private formatting helpers

`humanProgressTokens(number)` mirrors menu behavior:

- round values at/above 1000 to thousands;
- otherwise render the integer value.

`humanElapsed(number)`:

- normalize to non-negative complete seconds;
- render seconds only below 60;
- render minutes and zero-padded seconds below 3600;
- render hours with zero-padded minutes and seconds at/above 3600.

Helpers stay private so only the line contract becomes public.

## Placement in `cast-core.ts`

Place the new progress section immediately before `formatMessage`.

Reasons:

- Both features project `StreamMessage` for the live surface.
- The new reducer conceptually supersedes per-event live labels downstream.
- Existing decision, tool, and outcome sections remain undisturbed.
- `makeStreamSink` can remain below both display projections.

## Test imports

Extend the existing named import from `cast-core.ts` with:

- `accumulateCastProgress`;
- `EMPTY_CAST_PROGRESS`;
- `formatCastProgress`.

No test imports from `cast.ts`, BAML, filesystem, or clock modules.

## Fixture structure

Define a local `PROGRESS_STREAM` array of `StreamMessage` values. It contains:

- system initialization without usage;
- seven distinct assistant `message.id` values;
- repeated events sharing at least one message ID;
- usage using input/output/cache buckets so weighting is observable;
- user/system events between assistant events;
- a terminal result with aggregate usage;
- an unknown event with nested ID/usage lookalikes.

Use values totaling 210,000 under `countTokens`, not raw parity.

## Main acceptance test

Reduce the fixture from `EMPTY_CAST_PROGRESS` with
`accumulateCastProgress` and assert:

```ts
state.weightedTokens === 210_000
state.turns === 7
formatCastProgress(state, {
  elapsedMs: 252_000,
  tokenEnvelope: 500_000,
  maxTurns: 15,
}) === "elapsed 4m12s · 210k/500k · turn 7/15"
```

This pins extraction, deduplication, weighting, and complete rendering together.

## Defensive tests

Add a separate test that feeds:

- `{}` cast as a stream message;
- assistant without `message`;
- assistant with array `message`;
- assistant without an ID;
- assistant without usage;
- unknown type with valid-looking nested message data;
- repeated valid assistant ID.

Assert no throw and no unintended state movement.

Add formatter boundary assertions for:

- seconds-only elapsed;
- hour-scale elapsed;
- sub-thousand token values;
- absence of max-turn denominator.

## Non-changes guaranteed

- `formatMessage` behavior remains byte-identical.
- `makeStreamSink` behavior remains byte-identical.
- Existing cast tests require no updates.
- `cast.ts` continues printing event lines until its dependent ticket.
- Transcript JSON remains untouched.
- Result settlement continues using authoritative final usage.
- No ticket phase/status frontmatter is edited.

## Implementation order

1. Add runtime/type budget imports.
2. Add state and structural extraction helpers.
3. Add reducer.
4. Add humane formatting helpers and public formatter.
5. Add fixture and focused tests.
6. Run focused test and typecheck/full gate.
7. Commit only both ticket-owned source paths through Lisa.
