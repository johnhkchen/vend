# Structure — T-071-02-02

## Change inventory

Two repository source files are ticket-owned:

- Modify `src/log/run-log.ts`.
- Modify `src/log/run-log.test.ts`.

One private implementation artifact will be added during Implement:

- Add `.lisa/attempts/T-071-02-02/1/work/progress.md`.

No source files are created or deleted. No package, generated file, BAML definition, routing
module, effect module, engine module, ticket frontmatter, or shared work artifact is changed.

## `src/log/run-log.ts`

### Public durable marker type

Add `SeatInferred` immediately after `SeatDefaulted`:

```ts
export interface SeatInferred {
  /** Raw routing seat chosen by inference. */
  readonly seat: string;
  /** Stable explanation of the heat evidence that led to the choice. */
  readonly reason: string;
}
```

Boundary ownership:

- The type is declared in run-log because it is a durable ledger contract.
- It does not import `AgentSeat`, `KNOWN_SEATS`, `InferredSeat`, or heat constants.
- `seat` is structurally compatible with the current `AgentSeat` union while remaining raw fact
  data at the persistence boundary.
- `reason` is stored verbatim; no heat parsing or classification occurs here.

### `RunRecordInput`

Add after `seatDefaulted` and before `seatOfExecution`:

```ts
readonly seatInferred?: SeatInferred;
```

Its documentation will state:

- the marker is present only when a default routing seat was inferred from heat;
- both chosen seat and reason are required;
- absence means no inference was recorded or historical unknown;
- malformed/partial values are omitted atomically;
- ordinary records remain byte-identical.

This is the caller-facing pre-normalization contract used by `buildRunRecord` and
`appendRunLog`.

### `RunRecord`

Add after `seatDefaulted` and before `seatOfExecution`:

```ts
readonly seatInferred?: SeatInferred;
```

Its documentation will state:

- only a complete marker is present;
- the negative state is property absence;
- `reviveRecord` retains valid marker details;
- malformed optional metadata is dropped without losing the record.

This is the normalized durable shape seen by readers and JSONL consumers.

### Private normalizer

Add `normalizeSeatInferred` immediately after `normalizeSeatDefaulted` and before
`normalizeSeatOfExecution`:

```ts
function normalizeSeatInferred(
  value: SeatInferred | undefined,
): SeatInferred | undefined
```

Behavior:

- reject absent values;
- reject values whose `seat` is not a non-empty string;
- reject values whose `reason` is not a non-empty string;
- return a new `{ seat, reason }` object in that order;
- drop any extra runtime properties;
- retain accepted string bytes verbatim.

The helper reuses existing `isNonEmptyString`. It does not throw, trim, validate against routing
policy, or freeze the nested object.

### `buildRunRecord`

Add a normalization local after `seatDefaulted`:

```ts
const seatInferred = normalizeSeatInferred(input.seatInferred);
```

Add a conditional spread after `seatDefaulted` and before `seatOfExecution`:

```ts
...(seatInferred ? { seatInferred } : {}),
```

The record remains top-level frozen through the existing `Object.freeze` call. All required-field
validation and other normalization remain unchanged.

### `reviveRecord`

After normalizing `seatDefaulted`, read and normalize the raw inferred marker:

```ts
const rawSeatInferred = r.seatInferred;
const seatInferred = normalizeSeatInferred(
  typeof rawSeatInferred === "object" && rawSeatInferred !== null
    ? (rawSeatInferred as SeatInferred)
    : undefined,
);
```

Add the same conditional spread ordering as the write path:

```ts
...(seatDefaulted ? { seatDefaulted } : {}),
...(seatInferred ? { seatInferred } : {}),
...(seatOfExecution !== undefined ? { seatOfExecution } : {}),
```

The existing read contract remains total: malformed optional metadata is omitted and the
otherwise valid record survives.

### Serialization

`serializeRunRecord` requires no logic change. Its existing `JSON.stringify` behavior will emit
the new property only when it is present in the normalized record.

`readRuns`, `loadRunLog`, derivations, and filtering helpers require no logic change. They consume
the normalized result produced by `reviveRecord`.

### Schema version

`RUN_LOG_SCHEMA_VERSION` remains `1`.

Reason:

- the field is optional and additive;
- historical records remain valid;
- the reviver already tolerates absent newer fields;
- adjacent `seatDefaulted` and `seatOfExecution` additions did not bump the version;
- exact absence compatibility is test-pinned.

## `src/log/run-log.test.ts`

### Test block placement

Insert a new describe block between the existing `seatDefaulted` and `seatOfExecution` blocks:

```ts
describe(
  "seatInferred marker — structured readRuns round-trip, byte compatibility, malformed (T-071-02-02 AC)",
  () => { ... },
);
```

This keeps routing disposition markers grouped and maintains the production field order in the
test narrative.

### Shared marker fixture

Inside the block:

```ts
const marker = {
  seat: "codex",
  reason: "recent cost-weighted burn: claude hotter",
} as const;
```

The content explicitly demonstrates chosen seat plus heat reason without coupling the schema test
to exact output from `lane-heat.ts`.

### Pre-feature literal fixture

Define `preSeatInferredLine` as the exact serialized JSONL line produced by:

```ts
baseInput({ runId: "si2" })
```

The line includes all existing normalized fields in current insertion order and a trailing newline,
but no `seatInferred` key.

This literal is the byte-compatibility oracle for both absent and malformed-marker cases.

### Test 1 — supplied marker survives `readRuns`

Flow:

1. Build `baseInput({ runId: "si1", seatInferred: marker })`.
2. Assert `built.seatInferred` equals `marker`.
3. Serialize to a JSONL line.
4. Pass the line to `readRuns`.
5. Assert `skipped === 0`.
6. Assert exactly one record.
7. Assert the revived marker equals `marker`.
8. Assert reserialization equals the original line.

Coverage:

- `RunRecordInput` contract;
- `buildRunRecord` normalization;
- conditional write spread;
- JSON serialization;
- JSONL parsing;
- `reviveRecord` normalization;
- conditional read spread;
- canonical byte stability.

### Test 2 — absent marker is byte-identical

Flow:

1. Build `baseInput({ runId: "si2" })`.
2. Assert the key is absent via the `in` operator.
3. Assert serialization does not contain `seatInferred`.
4. Assert serialization exactly equals `preSeatInferredLine`.

Coverage:

- historical/ordinary omission;
- exact pre-feature byte shape.

### Test 3 — malformed marker is atomically byte-identical

Flow:

1. Build the same `runId: "si2"` input with a partial marker containing only `seat`.
2. Use `as never` at the fixture boundary to emulate a malformed JavaScript caller.
3. Assert the key is absent.
4. Assert serialization exactly equals the absent baseline literal.

Coverage:

- atomic completeness;
- malformed write omission;
- explicit “absent/malformed byte-identically” acceptance language.

### Test 4 — canonical copy drops extra fields

Flow:

1. Build with `{ ...marker, diagnostic: "do-not-persist" }` under an unsafe fixture cast.
2. Assert `seatInferred` equals only `marker`.

Coverage:

- schema-field selection;
- deterministic nested shape;
- parity with `normalizeSeatDefaulted` discipline.

### Test 5 — malformed revival preserves record

Flow:

1. Build and serialize a valid baseline record with `runId: "si4"`.
2. Parse it and inject `seatInferred: { seat: "codex", reason: 42 }`.
3. Call `reviveRecord`.
4. Assert non-null.
5. Assert the run id survives.
6. Assert the marker property is absent.

Coverage:

- malformed historical metadata;
- read-boundary totality;
- optional-field failure does not discard useful ledger data.

## Unchanged files and interfaces

- `src/play/lane-heat.ts` remains the sole owner of heat computation.
- `src/play/decompose-effect.ts` remains unchanged; injection is downstream ticket work.
- `src/engine/play.ts` remains unchanged; `EffectResult` threading is downstream ticket work.
- `src/engine/cast.ts` remains unchanged; record stamping is downstream ticket work.
- `src/play/agent-seat.ts` remains the sole known-seat registry.
- No public API barrel requires updating because consumers import run-log symbols directly.
- No generated code includes `RunRecord`; TypeScript source is authoritative.

## Dependency direction after change

```text
lane-heat / downstream effect
        |
        | structurally supplies { seat, reason }
        v
run-log RunRecordInput
        |
        | normalize + serialize / revive
        v
local JSONL ledger
```

There is no reverse arrow from run-log into play or executor policy.

## Change ordering

1. Add the public marker type and optional interface properties.
2. Add the shared atomic normalizer.
3. Wire the write path.
4. Wire the read path.
5. Add the five focused tests.
6. Run focused verification.
7. Run full verification.
8. Inspect diff and repository state.
9. Commit the two exact source paths with Lisa.

The production and test edits form one meaningful schema unit. Splitting them into separate commits
would temporarily leave an unproved public schema or tests that cannot typecheck, so they will be
committed together in one Lisa transaction.

## Ticket ownership at commit

Exact include paths:

```text
src/log/run-log.ts
src/log/run-log.test.ts
```

Private phase artifacts are intentionally excluded from the ticket source commit because the
assignment states that Lisa publishes admitted artifacts after lease verification.
