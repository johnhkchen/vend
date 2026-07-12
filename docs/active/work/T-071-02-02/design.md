# Design — T-071-02-02

## Decision summary

Add a local durable `SeatInferred` marker to `src/log/run-log.ts` with two required fields:

```ts
export interface SeatInferred {
  readonly seat: string;
  readonly reason: string;
}
```

Expose it as optional `seatInferred?: SeatInferred` properties on `RunRecordInput` and
`RunRecord`. Normalize it through one shared `normalizeSeatInferred` helper used by both
`buildRunRecord` and `reviveRecord`. Admit the marker only when both fields are non-empty strings,
copy only the schema fields in stable order, and otherwise omit the property entirely.

Place the marker after `seatDefaulted` and before `seatOfExecution` in types, normalization, and
record construction. Test it in `src/log/run-log.test.ts` through the full pure
build/serialize/`readRuns` path plus focused absence and malformed cases.

## Why the shape is `{ seat, reason }`

The story calls for the chosen seat and a heat reason. The completed sibling lane-heat reader
exports:

```ts
export interface InferredSeat {
  readonly seat: AgentSeat;
  readonly reason: string;
}
```

Using the same property names allows the downstream effect result to satisfy `SeatInferred`
structurally without translation or duplicated field naming. The durable marker widens `seat` to
`string`, matching the ledger’s existing stance that it records raw provenance facts rather than
importing and enforcing the routing registry.

The reason remains a string rather than being decomposed into burn totals or a reason enum. The
reader already produces a stable evidence string containing the window, lane totals, and relative
comparison. This ticket records that supplied explanation; it does not reinterpret heat policy.

## Options considered

### Option A — Local `SeatInferred { seat: string; reason: string }`

Advantages:

- Exactly matches the sibling reader’s returned field names.
- Preserves structural compatibility with `InferredSeat`.
- Keeps run-log independent of `src/play/` and `AgentSeat` policy.
- Mirrors the local `SeatDefaulted` durable-type precedent.
- Makes both facts atomic and independently inspectable in JSONL.
- Allows future raw seat values to remain durable if routing vocabulary expands.

Costs:

- The domain concept has two structurally compatible named interfaces in two layers.
- The durable seat property is wider than the current routing union.

Decision: choose this option. The duplicate named interface is intentional boundary ownership, not
accidental duplication: the reader owns current routing inference, while run-log owns durable data.

### Option B — Import `InferredSeat` from `src/play/lane-heat.ts`

Advantages:

- One named TypeScript type.
- Compile-time synchronization with the reader’s exact return type.

Costs:

- Introduces a log-to-play dependency against the module’s documented sink boundary.
- Transitively imports routing vocabulary and makes durable schema depend on current policy.
- Risks a runtime import unless carefully made type-only.
- Makes future reader refactors look like durable ledger schema changes.
- Reverses the natural dependency direction: play/effect code should feed the log, not define it.

Decision: reject. Executor/routing agnosticism is a stronger constraint than deduplicating a
two-field structural type.

### Option C — Reuse or extend `SeatDefaulted`

Possible variants include mapping chosen seat to `applied`, inventing a sentinel `requested`, or
creating a union marker that covers both defaulting and inference.

Advantages:

- Reuses existing normalization code or one generalized type.
- Keeps routing provenance under one broad concept.

Costs:

- `seatDefaulted` means an explicit unknown request degraded to a default.
- `seatInferred` means no explicit request existed and heat led to an automatic choice.
- A fabricated `requested` value would be false provenance.
- A union complicates JSON consumers and weakens countability of the distinct decisions.
- Existing downstream and audit semantics already distinguish the two marker names.

Decision: reject. They are analogous normalization problems but distinct durable events.

### Option D — Store `seatInferred` as a string

Examples: the seat only, or a combined string such as `codex: recent burn...`.

Advantages:

- Smallest schema addition.
- Simple normalization.

Costs:

- Loses either the chosen seat or the rationale, violating acceptance.
- Combined text makes seat counting dependent on parsing prose.
- Does not follow the atomic structured-marker precedent.

Decision: reject. Countability requires a first-class seat field and auditability requires a
separate reason.

### Option E — Store structured heat metrics instead of the reason

Possible fields include hot seat, cool seat, window size, per-seat burns, and ratio.

Advantages:

- Enables richer future analysis.
- Avoids depending on reason prose.

Costs:

- Expands beyond the ticket’s chosen-seat-plus-reason contract.
- Duplicates the heat reader’s policy and representation in the ledger layer.
- Creates a larger durable schema before its consumers are established.
- Makes the log classifier-like rather than a provenance sink.

Decision: reject for this slice. The supplied evidence string is the contract named by the story.

## Atomic normalization

`normalizeSeatInferred` will accept the statically declared optional marker while remaining robust
to runtime-invalid input. It will:

1. Return `undefined` when the value is absent or falsy.
2. Require `seat` to be a non-empty string.
3. Require `reason` to be a non-empty string.
4. Return a fresh object containing only `seat` then `reason`.

This matches `normalizeSeatDefaulted` exactly in stance:

- completeness is atomic;
- malformed optional metadata does not invalidate the record;
- extra nested properties do not persist;
- strings are retained verbatim rather than trimmed or policy-checked;
- stable construction order makes marked serialization deterministic.

Whitespace-only strings remain technically non-empty because `isNonEmptyString` and the existing
seat marker use length rather than trim semantics. Matching the established helper is more
important than silently introducing a stricter policy for one analogous marker.

## Write behavior

`buildRunRecord` will normalize `input.seatInferred` alongside the other seat provenance fields.
The returned frozen object will conditionally spread `{ seatInferred }` only when normalization
succeeds.

Consequences:

- Valid input is serialized as a structured marker.
- Absent input produces no key.
- Partial, empty-string, primitive, or otherwise malformed runtime input produces no key.
- An absent input and malformed input with otherwise identical data serialize to identical bytes.
- Extra nested keys are removed.
- No required-field error or record rejection is introduced.

## Read behavior

`reviveRecord` will inspect the raw `seatInferred` property. Only a non-null object is passed to
the shared normalizer. The normalized value is conditionally spread into the revived record.

Consequences:

- Valid historical markers survive.
- Absent pre-feature records remain readable with no marker.
- Partial or malformed marker metadata is omitted.
- A malformed marker does not increment `readRuns.skipped` or lose the surrounding record.
- Reserializing a canonical marked record after `readRuns` yields identical bytes.

## Property placement and byte compatibility

Place `seatInferred` between the two existing seat-related fields:

1. `seatDefaulted`
2. `seatInferred`
3. `seatOfExecution`

This groups routing disposition markers before actual execution-lane provenance. The same order
will be used in interfaces, normalization locals, build spreads, and revive spreads.

Absent conditional spreads add no property and therefore do not alter any existing serialized
record. The exact pre-feature line in the test will prove this rather than relying only on an
`includes` assertion.

No schema-version bump is needed. The ledger’s established compatibility strategy for optional
additive fields retains version 1, and both `seatDefaulted` and `seatOfExecution` followed it.

## Type-boundary rationale

`SeatInferred.seat` will be `string`, not `AgentSeat`.

- The routing reader returns an `AgentSeat`, which is assignable to `string`.
- The run-log must remain able to preserve raw future values.
- The run-log must not import `KNOWN_SEATS` or `AgentSeat`.
- Structural normalization is sufficient for an append-only fact record.
- Current known-seat correctness is tested where inference is made, not where it is serialized.

The marker type is exported because `RunRecordInput` publicly exposes it and downstream code may
use it directly. This follows the exported `SeatDefaulted` precedent.

## Test design

Add a focused `seatInferred` describe block after `seatDefaulted` and before `seatOfExecution`.

### Valid `readRuns` round-trip

- Use `{ seat: "codex", reason: "recent cost-weighted burn: claude hotter" }`.
- Build a record with the marker.
- Assert the built marker equals the supplied schema object.
- Serialize it.
- Feed the JSONL line to `readRuns`.
- Assert zero skipped and one record.
- Assert the revived marker equals the supplied object.
- Reserialize and assert byte equality with the original marked line.

### Absent byte compatibility

- Define a literal pre-feature line for a stable base input/run id.
- Build the same input without `seatInferred`.
- Assert the property is not present.
- Assert the string does not contain the key.
- Assert exact equality with the literal line.

### Malformed build compatibility

- Build the same stable input with a partial marker missing `reason`.
- Use a deliberate unsafe cast to model a torn JavaScript caller.
- Assert the property is absent.
- Assert serialization is exactly equal to the absent baseline, proving malformed omission is
  byte-identical rather than merely non-throwing.

### Canonical copy

- Supply a valid marker plus an extra nested diagnostic field.
- Assert only `seat` and `reason` remain.

### Malformed revive

- Inject a marker with a non-string `reason` into an otherwise valid parsed record.
- Call `reviveRecord` directly to pin its optional-metadata behavior.
- Assert the record survives and the marker is absent.

The valid test uses `readRuns` to meet the explicit round-trip clause. Direct revival remains useful
for the malformed branch because it proves malformed optional metadata does not reject the record.

## Verification and commit

- Run the focused test file first: `bun test src/log/run-log.test.ts`.
- Run the authoritative project gate: `bun run check`.
- Inspect the exact diff for only `src/log/run-log.ts` and `src/log/run-log.test.ts`.
- Commit those two exact ticket-owned source paths with `lisa commit-ticket`.
- Do not include private attempt artifacts in the source commit; Lisa publishes admitted artifacts.
- Do not touch unrelated dirty worktree files or ticket frontmatter.

## Expected downstream use

The integration ticket can thread the lane reader’s `InferredSeat` value through its effect result
and into `RunRecordInput.seatInferred`. TypeScript structural compatibility makes this direct:

```ts
const inferred = inferDefaultSeat(records);
// inferred: { seat: AgentSeat; reason: string } | null
// when present, it satisfies SeatInferred without run-log importing play policy
```

This ticket does not perform that threading. Its result is the durable, tested sink contract the
integration ticket depends upon.
