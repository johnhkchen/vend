# Structure — T-070-01-01: run-log seat-defaulted marker schema

## Change boundary

Modify:

```text
src/log/run-log.ts
src/log/run-log.test.ts
```

Create the six artifacts under `docs/active/work/T-070-01-01/`. Delete nothing.

Do not edit seat registry, materialization, effect, cast, BAML, story/epic/ticket frontmatter,
`RUN_OUTCOMES`, or schema version.

## `src/log/run-log.ts` public type

Add near other local structural record types, after `GateResult`:

```ts
export interface SeatDefaulted {
  readonly requested: string;
  readonly applied: string;
  readonly reason: string;
}
```

The type belongs to run-log so the ledger remains self-contained. Downstream callers can satisfy
it structurally without a runtime dependency on play or executor modules.

## Input extension

Add after `overEnvelope` and before timestamps:

```ts
readonly seatDefaulted?: SeatDefaulted;
```

Documentation states that property presence means a seat request degraded to a default, all three
values are required, absence is normal/historical unknown, and omission preserves pre-E-070 bytes.

## Record extension

Add in the matching position:

```ts
readonly seatDefaulted?: SeatDefaulted;
```

The normalized contract permits the field only as a complete canonical object. The interface is
readonly and additive.

## Shared helper placement

`isNonEmptyString` currently sits immediately before `reviveRecord`. Move its unchanged definition
into the shared normalization-helper section so both writer and reader can reuse it. Remove the old
declaration; do not duplicate it.

```text
isNonEmptyString
  -> normalizeSeatDefaulted
      -> buildRunRecord
      -> reviveRecord
```

## New private normalizer

Add after `normalizeOverEnvelope`:

```ts
function normalizeSeatDefaulted(value: SeatDefaulted | undefined): SeatDefaulted | undefined {
  if (!value) return undefined;
  if (
    !isNonEmptyString(value.requested) ||
    !isNonEmptyString(value.applied) ||
    !isNonEmptyString(value.reason)
  ) return undefined;
  return {
    requested: value.requested,
    applied: value.applied,
    reason: value.reason,
  };
}
```

The helper is pure, returns a fresh canonical object, drops extra caller keys, and establishes
nested key order. It validates shape only, never seat policy.

## Builder threading

In `buildRunRecord`, normalize once:

```ts
const seatDefaulted = normalizeSeatDefaulted(input.seatDefaulted);
```

Conditionally spread after `overEnvelope`:

```ts
...(seatDefaulted ? { seatDefaulted } : {}),
```

When absent, every existing property and ordering remains unchanged. When present, the marker is
immediately before `startedAt` and `endedAt`.

## Reviver threading

After over-envelope normalization, narrow the raw value:

```ts
const rawSeatDefaulted = r.seatDefaulted;
const seatDefaulted = normalizeSeatDefaulted(
  typeof rawSeatDefaulted === "object" && rawSeatDefaulted !== null
    ? (rawSeatDefaulted as SeatDefaulted)
    : undefined,
);
```

Arrays pass the outer object check but fail required named strings. Scalars, null, partial objects,
and wrong-typed values become undefined. Spread a valid result after `overEnvelope` in the revived
record, matching builder order.

## Unchanged functions

- `serializeRunRecord` remains JSON stringify plus newline.
- `readRuns` continues delegating normalization to `reviveRecord`.
- `appendRunLog` continues composing builder and serializer.
- `loadRunLog`, filters, and token/time derivations remain unchanged.

## `src/log/run-log.test.ts` placement

Add one describe block after `overEnvelope` and before `forPlay`:

```ts
describe("seatDefaulted marker — structured round-trip, byte compatibility, malformed, legacy (T-070-01-01 AC)", () => {
  // tests
});
```

No new import is required because `baseInput` accepts `Partial<RunRecordInput>`.

## Canonical marker fixture

```ts
const marker = {
  requested: "kodex",
  applied: "claude",
  reason: "unknown-seat",
};
```

This demonstrates raw requested-value preservation, explicit applied default, and stable reason.

## Test 1 — marked byte-stable round-trip

- Build with `runId: "sd1"` and the marker.
- Assert the built marker equals the canonical object.
- Serialize to `line`.
- Parse and revive.
- Assert the revived marker equals the object.
- Assert `serializeRunRecord(revived!) === line`.

This covers every ticket-owned pure transformation.

## Test 2 — exact pre-E-070 bytes

- Build a fixed minimal canonical input with no new marker.
- Define the exact expected JSONL literal in historical property order.
- Assert no own marker property and no serialized key.
- Assert full serialized output equals the literal, including final newline.

The literal is stronger than comparing two outputs from new code.

## Test 3 — legacy revival

- Pass the pre-E-070 literal to `readRuns`.
- Assert zero skipped, one record, and undefined marker.

## Test 4 — malformed writer marker

- Type-escape a partial marker missing one required key.
- Assert builder omits the entire marker and serializer emits no key.

This pins atomicity of the three facts.

## Test 5 — extra nested metadata

- Supply a valid marker with an extra key through a type escape.
- Assert the stored object contains exactly requested, applied, and reason.

This pins defensive selection and deterministic nested bytes.

## Test 6 — malformed reader marker

- Inject partial/wrong-typed marker metadata into a parsed valid base record.
- Assert revival remains non-null, the run id survives, and the marker is undefined.

This follows the read boundary's degrade-not-discard behavior.

## Pure-core boundary

All logic lives in a pure normalizer plus the existing pure builder/reviver. Tests use plain values
only. No filesystem integration test is needed because the impure append/load functions already
compose the tested pure functions without marker-specific logic.

## Implementation order

1. Add contract tests.
2. Run focused suite for red evidence.
3. Add public type and optional fields.
4. move/reuse the shared string predicate.
5. Add structured normalizer.
6. Thread builder and reviver.
7. Run focused tests and typecheck.
8. Run full repository gate.
9. Audit diff/status and write review.

## Compatibility invariants

- Schema version remains 1.
- Outcome vocabulary, including `unknown-seat`, is unchanged.
- Absent or malformed marker adds no property.
- Valid marker contains all three string keys in deterministic order.
- Existing record key order is unchanged when absent.
- Old lines revive without migration.
- Optional marker corruption cannot discard the base record.

## Expected diff shape

Production: one interface, two optional fields, one moved helper, one normalizer, one builder local
and spread, one reviver local and spread, plus documentation. Tests: one colocated describe block.
No broad refactor is warranted.
