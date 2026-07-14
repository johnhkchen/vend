# Design — T-070-01-01: run-log seat-defaulted marker schema

## Decision summary

Add an optional structured `seatDefaulted` marker to `RunRecordInput` and `RunRecord`:

```ts
export interface SeatDefaulted {
  readonly requested: string;
  readonly applied: string;
  readonly reason: string;
}
```

A private normalizer accepts the object only when all three values are non-empty strings and
returns a fresh canonical object. `buildRunRecord` and `reviveRecord` both use it and conditionally
include the field. Absence or malformed input produces no property.

Keep schema version 1 and `RUN_OUTCOMES` unchanged. Do not import `KNOWN_SEATS`, infer a default,
validate seat membership, or change downstream behavior.

## Goals

1. Preserve the requested raw seat exactly.
2. Preserve the applied default exactly.
3. Preserve a durable reason.
4. Make the degradation countable after a ledger round-trip.
5. Keep an unmarked record byte-identical to pre-E-070 output.
6. Keep malformed optional metadata from invalidating the record.
7. Keep run-log executor-agnostic and policy-free.
8. Give T-070-01-03 a small structural field to forward.

## Option A — optional structured marker

Use one optional object on both input and normalized record.

Advantages:

- maps directly to the three acceptance facts;
- property presence is the one-way degradation predicate;
- absence serializes with zero new bytes;
- avoids partial top-level marker states;
- provides a stable downstream structural contract;
- follows both optional-object and optional-marker precedents;
- needs no executor or policy imports.

Costs:

- absence combines normal runs with pre-E-070 historical unknown;
- consumers inspect a nested object for detail;
- there is intentionally no stored false state.

Those costs are the required compatibility contract.

## Option B — three optional top-level fields

Example: `requestedSeat?`, `appliedSeat?`, `seatDefaultReason?`.

This avoids nesting but permits partial and contradictory states. It also loses one clear
property-presence predicate. The ticket names one marker carrying three facts, so this is rejected.

## Option C — boolean marker plus metadata

Example: `seatDefaulted?: true` plus `seatDefault?: {...}`.

This mirrors scalar flags, but the two fields can disagree. The structured object's presence is
already countable, so duplication adds invalid combinations and bytes. Rejected.

## Option D — tuple marker

Example: `[requested, applied, reason]`.

A tuple is compact and fixed-arity, but append-only JSON should remain self-describing. Named keys
are easier for humans and tools and match existing structured record fields. Rejected.

## Option E — required object with sentinels

Writing empty strings or identical seats for normal runs would give every record one shape, but it
would change every ordinary line and invent facts. It violates byte compatibility. Rejected.

## Option F — new `seat-defaulted` outcome

The fallback is orthogonal to terminal outcome. The story calls for a successful materialization
with degradation metadata, not a new terminal state. `unknown-seat` remains only for reading old
records. Rejected.

## Option G — derive inside run-log

Importing `KNOWN_SEATS` and synthesizing fallback metadata would make the ledger a seat policy
engine. T-070-01-02 owns classification and T-070-01-03 owns forwarding. Rejected.

## Naming

Use exported `SeatDefaulted` and property `seatDefaulted`, matching ticket/story vocabulary and
existing camelCase. Nested keys are:

- `requested`: raw caller value;
- `applied`: default actually used;
- `reason`: stable explanation.

The keys stay short because the containing property provides context. The marker records facts,
not warning prose or routing commands.

## Input and normalized types

Use the same interface for input and stored output. A scalar one-way flag needs a `true` literal
type, but this object has no useful false form: valid object presence is the degraded state and
property absence is the negative state.

The normalizer returns a new object containing only supported keys. This drops extra caller data,
provides deterministic nested key order (`requested`, `applied`, `reason`), and prevents later
mutation of the input object from altering the record's nested value.

## Normalization

Add a pure `normalizeSeatDefaulted` helper. It returns undefined when the value is absent or any
required component is not a non-empty string. It returns a canonical copy otherwise.

Reuse `isNonEmptyString`. Because that helper currently lives in the reader section, move its
unchanged declaration earlier into shared normalization helpers.

Do not trim values. “Requested raw seat” requires verbatim preservation. Do not accept partial
objects. Do not validate requested/applied inequality or known-seat membership; those are upstream
policy concerns.

## Write boundary

`buildRunRecord` normalizes `input.seatDefaulted` with other optional values and conditionally
spreads it after `overEnvelope`, before timestamps. This groups warning/degradation metadata,
leaves old key order untouched when absent, and gives marked records stable order.

`serializeRunRecord` remains unchanged. The builder does not validate relationships among marker,
outcome, agent registry, or gates. It preserves the supplied well-formed fact.

## Read boundary

`reviveRecord` accepts a non-null object candidate and applies the same normalizer. Absent, null,
scalar, array, partial, and wrong-typed values normalize to undefined. The final record spreads a
valid marker in the same position as the writer.

Malformed optional metadata does not make an otherwise valid record unreadable. No legacy alias
or inference from `unknown-seat` is introduced; old records revive without the property.

## Schema version

Retain version 1. This is additive and omission-compatible, and version-1 readers already tolerate
absent optional fields. A bump adds no migration value and conflicts with the existing schema
evolution convention.

## Tests

Add a dedicated marker block adjacent to `overEnvelope`.

Positive case:

1. build with `{ requested: "kodex", applied: "claude", reason: "unknown-seat" }`;
2. serialize;
3. parse and revive;
4. assert the complete object before and after;
5. assert serializing the revived record equals the first bytes.

Absence case:

1. build a fixed record without the marker;
2. assert no own property or JSON key;
3. compare output to an explicit literal pre-E-070 line;
4. revive that literal and verify undefined.

Boundary cases:

- partial/malformed writer marker is omitted;
- extra nested keys are dropped;
- malformed raw read marker is omitted while the record survives.

The explicit literal is stronger than comparing two records both produced by new code. It pins
historical bytes directly. The positive reserialization comparison pins structured-object order.

## Verification

Run:

```sh
bun test src/log/run-log.test.ts
bun run check:typecheck
bun run check
```

Inspect the final diff to ensure only the owned files/artifacts changed and ticket frontmatter,
outcomes, schema version, cast, materialization, executor, and BAML files remain untouched.

## Chosen design

Option A directly represents the three required facts, preserves the one-way absence contract,
fits the pure run-log boundary, and gives downstream tickets an executor-neutral record shape
without preempting their behavior.
