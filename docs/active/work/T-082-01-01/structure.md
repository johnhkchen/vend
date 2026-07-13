# Structure — T-082-01-01 run-log cap-window marker

## Change inventory

Ticket-owned source files:

- Modify `src/log/run-log.ts`.
- Modify `src/log/run-log.test.ts`.

Private attempt artifacts:

- `research.md`
- `design.md`
- `structure.md`
- `plan.md`
- `progress.md`
- `review.md`
- `review-disposition.json`

No production or test file is created or deleted. No shared
`docs/active/work/T-082-01-01/` artifact is written by this attempt; Lisa publishes
the private artifacts after lease verification.

## Production module boundary

`src/log/run-log.ts` remains the only production module changed.

It continues to expose:

- local structural data contracts;
- pure required-field validation;
- pure optional-field normalization;
- pure record build, serialize, and revive functions;
- pure JSONL parsing and ledger derivations;
- one thin append filesystem effect;
- one thin load filesystem effect.

The new marker is data only. No executor, routing, provider, heat, budget, or wallet
module is imported.

## New public interface

Place the interface after `SeatInferred`, alongside other routing/capacity provenance
facts:

```ts
export interface CapWindowExhausted {
  /** Stable category of the provider-cap evidence observed at settlement. */
  readonly signal: string;
  /** Stable explanation for classifying that signal as reset-window exhaustion. */
  readonly reason: string;
}
```

The interface is deliberately structural and provider-neutral.

### Public semantics

- Presence: settlement observed and classified a provider cap/reset-window
  exhaustion event.
- Absence: no event was recorded, or this historical row predates the marker.
- `signal`: stable category supplied by the settlement classifier.
- `reason`: stable classifier explanation.
- Both strings are required and non-empty at the runtime ledger boundary.
- Extra properties are not part of the durable contract.

## `RunRecordInput` extension

Add immediately after `seatOfExecution`:

```ts
readonly capWindowExhausted?: CapWindowExhausted;
```

Documentation will state:

- it is a one-way occurrence marker;
- both payload fields are atomic;
- lane, burn, and event time are read from the containing row;
- absence/malformed input is omitted for byte compatibility;
- the ledger preserves classification evidence but does not classify failures.

`RunRecordInput` remains the shape consumed by both `buildRunRecord` and
`appendRunLog`, so the later cast ticket can stamp the marker without another log
API change.

## `RunRecord` extension

Add immediately after `seatOfExecution`:

```ts
readonly capWindowExhausted?: CapWindowExhausted;
```

Documentation will state:

- only a complete marker is present;
- invalid optional metadata cannot invalidate the containing row;
- revival preserves complete marker data;
- historical rows remain marker-less.

This makes the field available to the later capacity learner through the existing
`RunRecord` type.

## Private normalizer

Add `normalizeCapWindowExhausted` adjacent to `normalizeSeatInferred` and
`normalizeSeatOfExecution`:

```ts
function normalizeCapWindowExhausted(
  value: CapWindowExhausted | undefined,
): CapWindowExhausted | undefined
```

Internal behavior:

1. Reject a missing value.
2. Reject a missing, empty, or non-string `signal`.
3. Reject a missing, empty, or non-string `reason`.
4. Return a new `{ signal, reason }` object for a complete marker.

The helper uses existing `isNonEmptyString`; no new generic validation abstraction
is introduced for one field.

## `buildRunRecord` integration

Add one local normalization:

```ts
const capWindowExhausted = normalizeCapWindowExhausted(input.capWindowExhausted);
```

Place it after execution-seat normalization, matching the declared field order.

Add one conditional spread:

```ts
...(capWindowExhausted ? { capWindowExhausted } : {}),
```

Place it immediately after the `seatOfExecution` spread. This produces canonical
JSON order and keeps all prior fields in their existing relative order.

No other build validation changes.

## `reviveRecord` integration

After normalizing `seatOfExecution`:

1. Store `r.capWindowExhausted` as an unknown raw value.
2. Check for a non-null object.
3. Cast only that guarded object to `CapWindowExhausted` for the structural
   normalizer.
4. Normalize to either a canonical two-field object or `undefined`.

Add the same conditional spread after `seatOfExecution` in the revived frozen
record.

The top-level required-record guard remains unchanged, so malformed marker metadata
cannot increment `readRuns.skipped` or discard a useful run.

## Serialization boundary

`serializeRunRecord` is unchanged.

Its current implementation remains sufficient because:

- valid marker data is already canonicalized before serialization;
- marker-less records contain no new key;
- JSON escapes any newlines in reason text;
- the result still has exactly one terminal newline.

## Schema-version boundary

`RUN_LOG_SCHEMA_VERSION` stays `1`.

The field is additive, optional, and follows multiple existing v1 optional-marker
extensions. No migration or alternate decoder is required.

## Test module structure

Modify `src/log/run-log.test.ts` only.

Add a new `describe` block after the `seatOfExecution` block, placing the event next
to the lane fact it qualifies.

### Shared fixture

Define one constant marker:

```ts
const marker = {
  signal: "http-429",
  reason: "provider reset-window capacity exhausted",
} as const;
```

Define one literal historical JSONL line with deterministic values matching a
`baseInput` call and containing no cap marker.

### Test cases

1. `complete marker survives build → serialize → revive byte-stably`
   - Build with the marker.
   - Assert the built marker equals the fixture.
   - Serialize and revive.
   - Assert the revived marker equals the fixture.
   - Assert reserialization equals the marked line.

2. `absent marker emits byte-identical historical bytes`
   - Build matching the literal fixture.
   - Assert the property is not present.
   - Assert serialization exactly equals the literal line.

3. `historical line revives and reserializes byte-identically`
   - Read the literal line.
   - Assert one record and zero skipped.
   - Assert the property is absent.
   - Assert serialization exactly equals the original literal.

4. `partial build marker is omitted atomically`
   - Supply `signal` without `reason` under `as never`.
   - Assert no marker key.
   - Assert bytes equal the same marker-less fixture.

5. `canonical copy drops unknown nested fields`
   - Supply a complete marker plus `diagnostic`.
   - Assert only `signal` and `reason` survive.

6. `malformed revived marker is omitted without losing the row`
   - Replace `reason` with a number on a valid raw record.
   - Assert revival is non-null and keeps the run id.
   - Assert the marker is absent.

7. `non-object revived marker is omitted without losing the row`
   - Replace the marker with a string.
   - Assert the row survives and marker is absent.

## File ordering and review surface

Implementation order inside `run-log.ts`:

1. Public interface.
2. Input field.
3. Normalized record field.
4. Private normalizer.
5. Write-side normalization and spread.
6. Read-side normalization and spread.

Then add all focused tests as one cohesive test unit.

The final diff should remain limited to these two source files plus private attempt
artifacts. Ticket source will be committed with exact include paths through
`lisa commit-ticket`, never ordinary `git add`/`git commit`.

## Explicitly unchanged files and modules

- `src/engine/cast.ts`
- `src/engine/cast-core.ts`
- `src/play/lane-heat.ts`
- all capacity-learning modules (not yet created)
- `src/budget/budget.ts`
- `src/budget/wallet.ts`
- executor modules
- CLI modules
- ticket phase and status frontmatter
- existing ledger data under `.vend/`

## Architectural invariants preserved

- Pure core, impure shell.
- Append-only, one physical JSON line per run.
- Lenient optional metadata, strict required record identity.
- Deterministic normalized object order.
- No provider or executor coupling in the ledger.
- No invented quota or reset-window numeric facts.
- Old rows remain readable and byte-stable.
- One invalid optional marker cannot erase a run record.
