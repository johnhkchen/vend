# Design — T-072-02-01

## Decision summary

Add an immutable progress state, a pure stream-message reducer, and a pure line
formatter to `cast-core.ts`. Count only structurally valid `assistant` messages
with a previously unseen nested `message.id` and nested `message.usage`. Price
each accepted turn with `countTokens`. The shell supplies elapsed milliseconds,
the funded token envelope, and the optional effective maximum turn count.

## Forces

- Stream messages are untrusted open JSON records.
- Claude repeats one logical assistant message for multiple content blocks.
- Final result usage is cumulative and must not be accumulated again.
- Spend must share the settlement path's cost weighting.
- The implementation must remain clock-free and effect-free.
- The later wiring ticket needs an ergonomic stateful loop surface.
- Existing stream formatting and transcript fan-out must remain unchanged here.

## Option A — Mutable closure accumulator

Shape:

```ts
const progress = makeCastProgress(opts);
progress(message, elapsedMs); // returns a line
```

Advantages:

- Very compact wiring in `cast.ts`.
- The closure can hide seen-ID bookkeeping.
- Each event directly produces a display line.

Costs:

- State mutation is implicit.
- Tests observe behavior but cannot inspect transition state directly.
- The function's result depends on call history, not only explicit arguments.
- That weakens the repository's pure-core convention.
- Funding/clock configuration becomes captured policy.

Decision: reject. The ticket calls for a pure accumulator, and the codebase's
core modules favor explicit plain-value transitions.

## Option B — Class with an `accept` method

Shape:

```ts
const progress = new CastProgress(envelope, maxTurns);
progress.accept(message, elapsedMs);
```

Advantages:

- Encapsulates state and formatting.
- Familiar accumulator abstraction.
- Can expose read-only getters.

Costs:

- Still mutable and history-dependent.
- Introduces object identity and constructor behavior unnecessarily.
- Plain fixture equality becomes less direct.
- Does not match the existing plain-value core style.

Decision: reject for the same purity and simplicity reasons as Option A.

## Option C — Immutable reducer plus formatter

Shape:

```ts
let state = EMPTY_CAST_PROGRESS;
state = accumulateCastProgress(state, message);
const line = formatCastProgress(state, displayInputs);
```

Advantages:

- Every transition is explicit and deterministic.
- State can be asserted directly in tests.
- The shell owns mutation of its local state variable, not the core.
- Clock and funding remain injected display inputs.
- The reducer and formatter can evolve independently.
- Unknown-message no-op behavior is easy to prove.

Costs:

- Wiring takes two calls rather than one.
- The state exposes seen IDs needed only for deduplication.
- Immutable copying of seen IDs is linear in turn count.

Assessment:

- Casts are capped at small turn counts in normal use.
- Even an uncapped cast has negligible ID-copy cost beside model execution.
- Exposing read-only state is acceptable for a pure-core contract.

Decision: choose Option C.

## Turn identity alternatives

### Outer event UUID

Reject. Live transcripts show each repeated content block gets a distinct outer
UUID, so this would double-count one assistant turn.

### Usage-object fingerprint

Reject. Identical usage across separate turns is possible. The fingerprint is a
measurement, not identity.

### Consecutive identical usage suppression

Reject. Interleaved user/system events break adjacency, and equal adjacent turns
would be collapsed incorrectly.

### Nested assistant `message.id`

Choose. Live stream evidence shows it is stable across repeated blocks and
changes for the next assistant message. It is the transport's own message-level
identity.

## Accepted-message rule

A message advances progress only when all are true:

1. `msg.type === "assistant"`.
2. `msg.message` is a non-null, non-array object.
3. `msg.message.id` is a non-empty string.
4. `msg.message.usage` is a non-null, non-array object.
5. The ID has not already been seen.

This strict rule prevents lookalike fields on unknown event types from changing
the meter. Missing identity makes safe deduplication impossible, so such a
message is ignored rather than guessed.

## Usage validation

The reducer passes the structurally verified usage record to `countTokens` as a
`Usage`. `countTokens` already defines total behavior for optional and invalid
numeric buckets. No second weight vector or token sanitizer is introduced.

An empty usage object is technically usable and costs zero. It still identifies
one assistant turn. This reflects the event stream: turn observation and spend
observation are related but distinct facts.

## State contract

`CastProgress` contains:

- `weightedTokens`: accumulated fresh-input-token-equivalent spend.
- `turns`: number of distinct accepted assistant message IDs.
- `seenMessageIds`: read-only IDs used to reject repeat blocks.

The exported empty state is frozen and reusable. Successful transitions return a
new frozen state and a fresh frozen ID array. Ignored messages return the same
state reference, making a no-op observable without changing semantics.

## Formatting contract

`formatCastProgress` accepts:

- state;
- `elapsedMs` supplied by the shell;
- `tokenEnvelope` supplied from funded `Budget.tokens`;
- optional `maxTurns` supplied from `resolveMaxTurns`.

It returns:

```text
elapsed 4m12s · 210k/500k · turn 7/15
```

If `maxTurns` is absent, the final segment is `turn 7`. This is truthful for
plays with no cap and avoids displaying a fabricated denominator.

## Humane token formatting

Mirror `menu.ts`'s established rule:

- values below 1000 render as an integer;
- values at least 1000 render as a rounded whole number of thousands plus `k`.

The helper stays private because the public requirement is the completed line.
Extracting a cross-module formatting library would expand this ticket's scope.

## Humane elapsed formatting

Normalize supplied elapsed milliseconds to a non-negative whole-second count.
Render compact compound units:

- under a minute: `12s`;
- under an hour: `4m12s`;
- at least an hour: `1h02m03s`.

Milliseconds are rounded down because elapsed time should not claim a second
before it has passed. Non-finite or negative input degrades to zero.

## Rejected broader changes

- Do not export menu's private helpers; that is unrelated API reshaping.
- Do not replace `formatMessage` or `makeStreamSink`; wiring is downstream.
- Do not read `Date.now()` in core; the shell owns the clock.
- Do not reconcile against terminal result usage; this line is explicitly an
  approximation that converges to authoritative final accounting.
- Do not mutate transcript messages or attach accumulator metadata to them.
- Do not add executor events; existing messages contain sufficient evidence.

## Verification design

Use one fixture sequence with seven unique assistant message IDs. Include repeated
assistant events for at least one ID, usage-less system/user events, a result with
aggregate usage, and an unknown message with a lookalike nested usage. Choose
per-turn usage values whose cost-weighted total is exactly 210,000. Format with
252,000 elapsed milliseconds, a 500,000 envelope, and max turns 15.

Additional focused assertions cover:

- repeated IDs do not change state;
- result usage does not change state;
- unknown-type lookalikes do not change state;
- malformed/missing nested fields do not throw;
- no max-turn cap omits only the denominator;
- elapsed and small-token boundaries remain humane.

## Decision outcome

The chosen design is additive, pure, executor-event-driven, and narrowly usable
by `T-072-02-02`. It makes price-true progress visible without claiming terminal
authority and without touching the durable transcript path.
