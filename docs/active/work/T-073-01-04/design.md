# T-073-01-04 — Design

## Decision summary

Add an optional atomic `crossVendorVerdict` object to `RunRecordInput` and `RunRecord`.

```ts
interface CrossVendorVerdict {
  readonly authoringSeat: string;
  readonly reviewingSeat: string;
  readonly verdict: "pass" | "fail";
  readonly detail?: string;
}
```

The run log declares this structural contract locally. The field is normalized at both the write
and revive boundaries. It is serialized only when all required members are valid. `detail` is
retained only when it is a non-empty string. An absent or malformed object is omitted atomically.

## Why this shape

The story explicitly names four durable facts: authoring seat, reviewing seat, pass/fail, and
detail. A nested object keeps those related facts atomic and makes the verdict a first-class gate
outcome without overloading general `gateResults` rows.

`verdict: "pass" | "fail"` preserves the settled upstream vocabulary. It avoids translating into
a differently named boolean and allows downstream S-073-02 code to branch exhaustively.

`detail` is optional because T-073-01-03's valid pass result has no reason, while its fail result
always has one. The later composition maps `reason` to `detail` without making the ledger import
cross-review policy.

Both seats are plain non-empty strings. This matches `seatOfExecution`: the ledger records facts
but does not own or import the routing registry. It also preserves future executor compatibility.

## Write behavior

`buildRunRecord` calls one `normalizeCrossVendorVerdict` helper.

The helper:

1. Requires a non-null object.
2. Requires non-empty `authoringSeat`.
3. Requires non-empty `reviewingSeat`.
4. Requires `verdict` to be exactly `pass` or `fail`.
5. Rebuilds a canonical object containing only schema-owned keys.
6. Includes `detail` only when it is a non-empty string.
7. Returns `undefined` for malformed/partial optional values.

The built record conditionally spreads the normalized object. No supplied value means no key.

## Read behavior

`reviveRecord` obtains the raw nested value and passes an object-shaped value through the same
normalizer. A malformed verdict is dropped, but the surrounding run remains readable. A valid
verdict is reconstructed in canonical key order and included in the revived record.

This mirrors `SeatDefaulted` and `SeatInferred`, including their append-only compatibility stance:
assert required top-level record identity, tolerate optional metadata damage.

## JSONL proof

The focused acceptance test constructs two run inputs:

- cross-reviewed: carries both seats, pass/fail, and detail;
- single-seat: carries no `crossVendorVerdict`.

It serializes both into a two-line JSONL string, then:

- parses the raw physical lines to prove the exact persisted key presence/absence;
- calls `readRuns` to prove the field survives the supported read boundary;
- verifies the cross-reviewed record retains every verdict fact;
- verifies the single-seat record has no verdict property.

Additional focused cases cover fail-with-detail and malformed optional metadata so write/read
symmetry cannot silently admit partial provenance.

## Considered alternatives

### A. Add fields directly to the top-level run record

Possible fields would be `authoringSeat`, `reviewingSeat`, `reviewVerdict`, and `reviewDetail`.

Rejected because partial combinations become representable and require scattered atomicity rules.
A nested value is either present as a complete gate outcome or absent.

### B. Reuse `gateResults`

One could append a row like `{ gate: "cross-vendor-review", passed, detail }` and infer seats from
other fields.

Rejected because `GateResult` has nowhere to store reviewing seat and `seatOfExecution` alone does
not prove the authoring/reviewing pair. Extending every generic gate row with seat provenance would
widen an unrelated schema for one specialized gate outcome.

### C. Store the upstream `CrossReviewVerdict` directly

The log could import `CrossReviewVerdict` and add authoring seat separately.

Rejected because the log is deliberately a decoupled sink and currently imports no executor or
cross-review policy. The upstream value also names failure explanation `reason`, while the story's
durable contract names `detail`, and does not contain authoring seat.

### D. Use a boolean `passed`

This would align with `GateResult.passed`.

Viable, but rejected in favor of the already-settled `pass`/`fail` discriminant. The story and
upstream contract both use those words, and downstream enforcement can switch on them directly.

### E. Require detail for both pass and fail

Rejected because a valid upstream pass contains no reason. Manufacturing a generic success detail
would add no evidence and would force callers to invent content.

### F. Require detail only for fail in the ledger type

A discriminated durable union could enforce fail detail at compile time.

Viable, but the append-only reader still needs tolerant runtime validation, and the story describes
one row/field with an optional detail fact. A simple structural interface keeps local normalization
consistent with the rest of `run-log.ts`. Upstream parsing already guarantees fail reasons.

### G. Increment the schema version

Rejected. This repository has repeatedly added optional fields under schema version 1. Older lines
remain valid because the field is additive and omitted by default.

### H. Wire `castPlay` to invoke cross-review in this ticket

Rejected as beyond the explicit round-trip acceptance unit and premature for the next story's
clear-path contract. This ticket settles the durable schema the integration consumes. It neither
changes terminal outcome nor introduces a new executor call.

## Boundary and invariant assessment

- P3 advances because a machine-readable cross-vendor gate outcome becomes durable evidence.
- P4 advances because the verdict is structured for autonomous consumption, not human approval.
- P5 holds because the ledger remains local JSONL.
- P6 holds because the schema uses structural strings and imports no concrete executor policy.
- The verdict remains non-blocking, honoring the story's honest boundary.
- Single-seat behavior is inert through complete omission, not a fabricated pass.

## Chosen verification

1. Focused `bun test src/log/run-log.test.ts`.
2. Exact-path `git diff --check`.
3. Full required `bun run check` before committing.

The implementation will be one meaningful source unit: schema, normalization, and its focused
round-trip proof committed together because neither side is meaningful or green independently.
