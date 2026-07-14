# Design — T-071-01-01

## Decision

Add `seatOfExecution` as optional locally typed string metadata on both
`RunRecordInput` and `RunRecord`. Normalize it only as a structurally usable,
non-empty string and otherwise omit it. Preserve a valid supplied string exactly,
without importing or consulting `KNOWN_SEATS`. Apply the same normalization in
`buildRunRecord` and `reviveRecord`, and conditionally spread the property into the
canonical record immediately after `seatDefaulted`.

## Goals

- Persist which lane burned a run's metered usage when a caller supplies it.
- Preserve the raw supplied value verbatim.
- Keep historical and unstamped records byte-identical.
- Preserve the field across the complete JSONL read boundary.
- Keep the run log independent from seat-routing policy.
- Keep malformed optional metadata from invalidating useful run records.
- Remain compatible with the existing schema version and append-only ledger.

## Non-goals

- Do not determine the executor lane in this ticket.
- Do not edit the cast loop.
- Do not infer a seat from model names, environment variables, or defaults.
- Do not validate against `KNOWN_SEATS`.
- Do not add lane heat calculation or lane selection.
- Do not migrate or rewrite historical records.
- Do not alter Lisa dispatch or executor implementations.

## Option 1 — policy-typed `AgentSeat`

Import `AgentSeat` or `KNOWN_SEATS` from `src/play/agent-seat.ts` and type the field
as `AgentSeat`.

Advantages:

- Compile-time callers would see the currently known lane union.
- Runtime policy checks could reject misspelled seats.

Disadvantages:

- Directly violates acceptance's raw-seat preservation requirement.
- Couples the durable sink to mutable routing policy.
- A future lane could be discarded by an older reader.
- Conflicts with the documented zero-policy-coupling precedent.
- Turns the log into a classifier rather than a recorder.

Decision: rejected.

## Option 2 — required field with a default

Make `seatOfExecution` required and synthesize a default such as `claude` when no
value is supplied or present historically.

Advantages:

- Every in-memory record would have a lane.
- Downstream grouping would not need an unknown branch.

Disadvantages:

- Falsifies historical data by converting unknown into a lane.
- Changes every newly serialized record.
- Cannot produce byte-identical pre-E-071 output.
- Violates the story's explicit honest boundary.
- Hides the difference between measured provenance and inference.

Decision: rejected.

## Option 3 — optional raw string, no structural normalization

Copy any present property directly into the record and cast it to string on read.

Advantages:

- Very small implementation.
- Values are not checked against current seat policy.

Disadvantages:

- Torn or externally edited JSON could admit numbers/objects as seats.
- A type cast would not provide runtime safety.
- It departs from the tolerant-but-canonical optional metadata pattern.
- Malformed metadata could leak into downstream heat grouping.

Decision: rejected.

## Option 4 — optional structurally valid raw string

Use a small `normalizeSeatOfExecution` helper that returns a non-empty string
unchanged and returns `undefined` for absence or malformed values.

Advantages:

- Satisfies verbatim preservation without seat-policy enforcement.
- Matches the `seatDefaulted` structural precedent.
- Keeps old records and unmarked new records shape- and byte-compatible.
- Allows future lane names to survive older readers.
- Keeps malformed optional metadata local rather than dropping whole records.
- Reuses the same rule at write and read boundaries.

Disadvantages:

- Downstream consumers must treat absence as unknown.
- Compile-time callers can supply any string.
- Empty strings are treated as malformed/absent rather than a durable lane.

Decision: selected.

## Data contract

`RunRecordInput` receives:

```ts
readonly seatOfExecution?: string;
```

`RunRecord` exposes the same optional property:

```ts
readonly seatOfExecution?: string;
```

Meaning:

- Present: the exact raw executor lane reported by the caller.
- Absent: no execution seat was recorded; historical/unknown.
- No default is implied.
- No membership in `KNOWN_SEATS` is implied or enforced by the ledger.

## Normalization contract

`normalizeSeatOfExecution(value)` will:

- Return `value` unchanged when it is a non-empty string.
- Return `undefined` for absence.
- Return `undefined` for malformed runtime values.
- Perform no trimming.
- Perform no lowercasing.
- Perform no aliasing.
- Perform no lookup against `KNOWN_SEATS`.

The no-trimming choice is important to “verbatim”: structural validity is the
only ledger concern. The caller owns classification and the exact fact it reports.

## Write behavior

`buildRunRecord` computes the normalized seat alongside other optional metadata.
It conditionally spreads `{ seatOfExecution }` only when present. Therefore:

- supplied raw strings become own properties and JSON keys;
- absent fields are not own properties;
- absent fields do not appear in JSON;
- old unmarked serialization remains byte-identical;
- record freezing behavior remains unchanged.

## Read behavior

`reviveRecord` reads the raw property from the parsed object and passes it through
the same structural normalizer. It then conditionally spreads it into the rebuilt
record. Therefore:

- marked JSONL records preserve their raw seat;
- pre-E-071 records remain valid with the property omitted;
- malformed optional seat metadata is dropped without losing actual usage;
- reconstructed serialization is canonical and stable.

## Test design

Add a focused `seatOfExecution` describe block near `seatDefaulted`.

Evidence 1: raw/policy-independent round-trip.

- Build with a value outside `KNOWN_SEATS`, such as `future-lane/raw`.
- Assert `buildRunRecord` exposes that exact string.
- Serialize and feed the JSONL text through `readRuns`.
- Assert zero skipped and the same exact string on the revived record.
- Assert reserialization equals the original marked line.

Evidence 2: byte compatibility.

- Define a literal pre-E-071 JSONL line.
- Build the equivalent input without `seatOfExecution`.
- Assert the property is not present with the `in` operator.
- Assert serialized output equals the literal byte-for-byte.
- Pass the literal through `readRuns`.
- Assert it remains valid and does not gain the property.

Evidence 3: malformed optional input.

- Revive a valid base record carrying a non-string seat.
- Assert the record remains valid and omits the seat.
- This pins tolerant read behavior without expanding acceptance scope.

## Compatibility and schema version

No schema-version bump is needed. The repository consistently treats additive,
optional, omission-preserving metadata as compatible within version 1. Old readers
ignore unknown JSON properties; this reader tolerates their absence. No on-disk
migration is required.

## Risk assessment

The main risk is accidentally importing seat policy and rejecting future/raw lane
names. The unknown-seat test guards that boundary. The second risk is accidentally
emitting an absent key or changing field order; the literal exact-line assertion
guards serialized compatibility. The third risk is only testing direct revival;
the `readRuns` test explicitly covers the complete pure JSONL round-trip requested
by acceptance.
