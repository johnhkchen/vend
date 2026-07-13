# Design — T-082-01-01 run-log cap-window marker

## Decision summary

Add one optional structured ledger field:

```ts
export interface CapWindowExhausted {
  readonly signal: string;
  readonly reason: string;
}

readonly capWindowExhausted?: CapWindowExhausted;
```

The marker is complete only when both `signal` and `reason` are non-empty strings.
The same pure normalizer will serve `buildRunRecord` and `reviveRecord`. Invalid or
partial optional data is omitted as a whole; it never invalidates the containing run.

## Naming decision

The field is named `capWindowExhausted`, not `rateLimited`, `providerError`, or
`quotaExceeded`.

- `capWindowExhausted` names the durable event the epic intends to learn from.
- `rateLimited` is broader and can describe transient concurrency throttling without
  proving a reset-window capacity event.
- `providerError` is too broad to be countable as capacity evidence.
- `quotaExceeded` risks implying a known quota denomination or numeric provider
  limit, which this epic explicitly refuses to invent.
- The past-tense event name makes the one-way semantics clear: presence says the
  event was observed; absence remains no recorded event / historical unknown.

The exported interface is named `CapWindowExhausted` to match the public field and
the repository's `SeatDefaulted`, `SeatInferred`, and `ArtifactDiscrepancy` naming
style.

## Payload decision

The payload contains two required strings in deterministic order:

1. `signal` — the stable evidence category recognized at settlement, such as a
   status-429-shaped or rate-limit-shaped signal.
2. `reason` — a stable explanation of why that evidence was classified as provider
   reset-window exhaustion.

The ledger validates only non-empty string structure. It does not enumerate signal
values or decide which executor errors qualify. That classification belongs to
`T-082-01-02` in the engine core/shell.

This split is useful for auditability: consumers can count all complete markers,
while a reviewer can distinguish the recognized signal from the classifier's
explanation. It also gives the next ticket a provider-neutral contract without
requiring this ledger module to import executor error types.

## Facts deliberately not duplicated

- The lane is already `seatOfExecution` on the same `RunRecord`.
- Burn is already recoverable from `usage` through `totalTokens`.
- Event time is already the row's `endedAt` settlement timestamp.
- Model/provider context is already represented by `model` and execution seat.
- The terminal result remains the existing `outcome`; this ticket does not add a
  `rate-limited` outcome.
- A numeric quota, reset duration, or retry-after value is not sourced in-repo and
  must not be invented.

Keeping these facts single-sourced makes the marker small, avoids contradictory
copies, and leaves the downstream learner to compose existing ledger columns.

## Options considered

### Option A — Boolean one-way flag

```ts
readonly capWindowExhausted?: true;
```

Advantages:

- Smallest serialized representation.
- Mirrors `overEnvelope` and `reducedGrounding`.

Rejected because:

- The ticket and story explicitly call for a marker interface and partial-marker
  atomicity, which implies a structured value.
- A boolean loses the evidence category and explanation needed to audit settlement
  classification.
- It gives the next ticket no structured seam for provider-neutral detection output.

### Option B — Status code plus reason

```ts
readonly statusCode: number;
readonly reason: string;
```

Advantages:

- Represents HTTP 429 directly.
- Easy to query numerically.

Rejected because:

- The story requires recognition of both 429-shaped and rate-limit-shaped failures.
- Some executor seams may surface only a typed name/message and no numeric HTTP
  status.
- Requiring a number would force the detector to fabricate `429` for non-HTTP-shaped
  evidence, weakening honesty and executor neutrality.

### Option C — Seat plus reason

```ts
readonly seat: string;
readonly reason: string;
```

Advantages:

- Each marker would be self-contained for lane grouping.

Rejected because:

- `seatOfExecution` is already the canonical raw lane fact on the containing row.
- Duplicate seat fields can disagree.
- Story acceptance explicitly expects the marker *alongside* `seatOfExecution`, not
  a seat nested inside it.

### Option D — Signal plus reason (chosen)

```ts
readonly signal: string;
readonly reason: string;
```

Advantages:

- Represents either numeric-status-shaped or textual/typed rate-limit evidence.
- Keeps classification policy out of the ledger.
- Is provider- and executor-neutral.
- Carries an auditable stable explanation.
- Fits the existing two-required-string atomic marker pattern.

Tradeoff:

- Signal vocabulary is not enforced by this module.
- This is intentional: the next ticket owns the classifier and can expose stable
  constants without coupling the ledger sink to engine policy.

## Normalization design

Add a private `normalizeCapWindowExhausted` helper adjacent to other structured
marker normalizers.

Behavior:

- `undefined`, `null`, and non-object read values normalize to absence.
- Missing `signal` or `reason` normalizes to absence.
- Empty strings and non-string values normalize to absence.
- A complete value is rebuilt as `{ signal, reason }`.
- Extra nested fields are discarded.
- Values are preserved verbatim; normalization is structural, not classificatory.

The typed helper accepts `CapWindowExhausted | undefined`, matching existing
normalizers. `reviveRecord` performs the unknown-object guard before the cast into
the helper.

## Write-side integration

1. Declare `capWindowExhausted?: CapWindowExhausted` on `RunRecordInput` after
   `seatOfExecution`, where the marker sits beside the lane it describes.
2. Declare the same optional field on normalized `RunRecord`.
3. Normalize once in `buildRunRecord`.
4. Conditionally spread the marker immediately after `seatOfExecution`.
5. Leave `serializeRunRecord` unchanged.

The conditional spread ensures an absent or malformed marker contributes no key,
so all existing build-side serialized rows remain unchanged.

## Read-side integration

1. Read `r.capWindowExhausted` after `seatOfExecution` handling.
2. Guard for non-null object data.
3. Pass the guarded value through `normalizeCapWindowExhausted`.
4. Conditionally spread it in the same canonical location used by the build path.

Using the same field order on both paths makes a marked build→serialize→revive
round-trip byte-stable. Omitting the conditional spread for invalid data keeps the
otherwise-valid historical row.

## Compatibility design

- Keep `RUN_LOG_SCHEMA_VERSION` at `1`, consistent with prior additive optional
  markers.
- Do not synthesize `null`, `false`, an empty object, or a default marker.
- Do not mutate or rewrite historical ledger files.
- Do not change any existing field's validation or ordering.
- Do not add a new `RunOutcome`.
- Do not alter `readRuns`, `loadRunLog`, or `appendRunLog`.

A literal historical JSON line will be revived and serialized to the exact original
bytes. The same literal will also be the expected output of a newly built marker-less
record with matching values.

## Test design

Add a focused `describe` block to `src/log/run-log.test.ts` covering:

1. A complete marker survives build → serialize → revive and marked reserialization
   is byte-stable.
2. A marker-less build emits an exact literal pre-feature JSONL line.
3. A historical pre-feature line revives and reserializes byte-identically without
   synthesizing a marker.
4. A partial build marker is omitted atomically and produces the same bytes as the
   absent marker.
5. A valid marker is canonically copied and drops extra nested fields.
6. A malformed revived marker is omitted while the run id and containing record
   survive.
7. Non-object marker data on revival is omitted without losing the row.

The focused run-log suite is the direct acceptance gate. The full `bun run check`
then detects type and behavior regressions throughout ledger consumers.

## Scope control

This design does not:

- classify executor failures;
- edit `src/engine/cast.ts` or `src/engine/cast-core.ts`;
- add provider-specific error knowledge;
- calculate capacity or quota fractions;
- edit lane heat, budgets, or wallets;
- intercept or reroute in-flight work;
- fetch provider quota data;
- backfill historical records;
- update ticket phase/status frontmatter.

## Decision consequences

- `T-082-01-02` receives a small, stable, provider-neutral settlement payload.
- `T-082-02-01` can treat complete marker presence as an occurrence and compose it
  with `seatOfExecution`, usage, and timestamps.
- Old ledgers remain valid and byte-stable.
- Bad optional metadata remains observable only as omission; this matches the
  existing append-only reader's lenient compatibility posture.
- The ledger remains a fact sink rather than an executor classifier or capacity
  policy module.
