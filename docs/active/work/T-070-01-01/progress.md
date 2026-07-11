# Progress — T-070-01-01: run-log seat-defaulted marker schema

## Status

Implementation is complete through focused tests and typecheck.
The full repository gate and final Review artifact remain.

## Completed phases

- Research: mapped story scope, run-log boundaries, marker precedents, and compatibility constraints.
- Design: selected one optional structured marker with canonical normalization.
- Structure: specified the two-file code/test change and pure boundaries.
- Plan: sequenced test-first implementation, verification, commits, and review.

Artifacts were committed in:

- `70a9cb0` — `docs(T-070-01-01): define seat-default marker contract`

Ticket phase/status were not edited.

## Step 1 — positive test contract

Added a `seatDefaulted` test block to `src/log/run-log.test.ts` adjacent to existing
`reducedGrounding` and `overEnvelope` marker blocks.

The canonical fixture is:

```ts
{
  requested: "kodex",
  applied: "claude",
  reason: "unknown-seat",
}
```

The positive test exercises:

```text
RunRecordInput
 -> buildRunRecord
 -> serializeRunRecord
 -> JSON.parse
 -> reviveRecord
 -> serializeRunRecord
```

It asserts the complete marker before and after revival and exact equality between first and
second serialized bytes.

## Red proof

Before production plumbing:

```text
bun test src/log/run-log.test.ts
94 pass / 2 fail
192 expect() calls
96 tests across 1 file
```

The only failures were the two new positive/canonical marker assertions:

- requested/applied/reason expected, received undefined;
- canonical copied marker expected, received undefined.

The absence, legacy, partial, and malformed-reader tests already passed because dropping an unknown
field matched old behavior. The two positive failures proved the new suite detected the missing
schema rather than relying only on backward-compatible cases.

## Step 2 — absence and legacy bytes

Added an explicit pre-E-070 JSONL literal for a fixed `sd2` record.

The absent test asserts:

- `seatDefaulted` is not an own property;
- serialized text contains no marker key;
- the complete serialized line equals the historical literal, including final newline.

The legacy test passes the same literal through `readRuns` and asserts:

- zero skipped lines;
- exactly one revived record;
- no marker property.

This directly pins both old-writer bytes and new-reader compatibility.

## Step 3 — boundary tests

Added three boundary tests:

- a partial writer object is omitted atomically;
- a valid marker with an extra nested diagnostic is copied with only schema keys;
- a malformed raw marker is dropped on revive without losing the run record.

These tests guard the complete three-fact contract and prevent arbitrary caller metadata from
entering the append-only schema.

## Step 4 — public schema

Added exported `SeatDefaulted` in `src/log/run-log.ts` with readonly fields:

```ts
requested: string;
applied: string;
reason: string;
```

Added optional `seatDefaulted?: SeatDefaulted` to:

- `RunRecordInput`;
- normalized `RunRecord`.

Comments document property-presence semantics, historical unknown, atomic completeness, and
pre-E-070 byte compatibility.

`RUN_LOG_SCHEMA_VERSION` remains 1.
`RUN_OUTCOMES` remains unchanged, including `unknown-seat`.
No imports were added.

## Step 5 — pure normalization

Moved the unchanged `isNonEmptyString` helper from the reader section into shared helper placement.

Added `normalizeSeatDefaulted`, which:

- returns undefined for absence;
- requires all three values to be non-empty strings;
- returns undefined for partial or malformed metadata;
- creates a fresh object with exactly requested, applied, and reason;
- retains values verbatim;
- performs no known-seat/default-policy lookup.

The canonical copy fixes nested property order and drops extra keys.

## Step 6 — writer

`buildRunRecord` now normalizes `input.seatDefaulted` once and conditionally spreads the valid
object after `overEnvelope` and before timestamps.

When absent, no property is created and all old property ordering remains unchanged.
`serializeRunRecord` was not modified.

## Step 7 — reader

`reviveRecord` now narrows a raw non-null object candidate, uses the same normalizer, and
conditionally spreads a valid marker in writer-matching order.

Absent, scalar, null, array, partial, or wrong-typed marker data is omitted. The rest of an
otherwise valid ledger record remains available.

No inference from `outcome`, `agent`, or known seats was added.

## Focused verification

After implementation:

```text
bun test src/log/run-log.test.ts
96 pass / 0 fail
195 expect() calls
96 tests across 1 file
```

This covers the new six-test marker block and all existing run-log schema, serialization, read,
compatibility, filtering, and derivation tests.

## Typecheck

```text
bun run check:typecheck
exit 0
```

The additive public types compile across all current structural consumers.

## Concurrent-story compatibility check

T-070-01-02 is being implemented concurrently in its disjoint owned files. Its report shape is:

```ts
{
  requested: string;
  applied: "claude";
  reason: string;
}
```

That type is structurally assignable to the run-log marker (`"claude"` is a subtype of `string`).
The materializer uses `reason: "unknown-seat"`, matching this schema fixture. Run-log deliberately
does not import the engine type, preserving its established decoupled sink boundary.

## Deviations from plan

No scope deviation.

The tests temporarily used type escapes for the pre-schema red run so Bun could execute and show
runtime failure. After the public field landed, the positive acceptance test was changed to pass a
normally typed `RunRecordInput`, satisfying the ticket wording directly. Type escapes remain only
in intentionally malformed/extra-key boundary fixtures.

The plan described arrays as malformed object candidates; no separate array test was added because
the partial/wrong-typed fixtures already pin atomic validation and the helper's named-string checks
necessarily reject arrays. This does not reduce acceptance coverage.

## Remaining work

1. Stage and commit ticket-owned implementation/test/progress files only.
2. Run full `bun run check` against the shared current worktree.
3. Audit final scope and commit state.
4. Write `review.md` with acceptance, coverage, and concerns.
5. Commit the final review artifact if the gate remains green.

## Current concerns

- No cast producer stamps the marker until T-070-01-03; this ticket only creates the ledger seam.
- Run-log intentionally does not validate known seats or cross-field disposition consistency.
- Absence means either no fallback was recorded or the record predates E-070.
- The old `unknown-seat` outcome stays readable by story contract.
