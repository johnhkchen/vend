# Structure — T-068-02-01: over-envelope-record-marker

## Change inventory

### Modified production file

`src/log/run-log.ts`

This remains the sole owner of run-record types, normalization, construction,
serialization, revival, and persistence. The file gains one optional field on each side of
the record boundary, one private normalization helper, and one conditional spread in each
canonical object-construction path.

No imports, exports, constants, outcome labels, schema versions, filesystem functions, or
derivation functions are added.

### Modified test file

`src/log/run-log.test.ts`

This gains a colocated describe block for the one-way marker. It uses the existing `baseInput`,
`buildRunRecord`, `serializeRunRecord`, `reviveRecord`, and `readRuns` helpers already imported.
No new imports, fixtures, test support modules, or filesystem access are needed.

### Added work artifacts

`docs/active/work/T-068-02-01/`

- `research.md`
- `design.md`
- `structure.md`
- `plan.md`
- `progress.md`
- `review.md`

### Files not modified

- `docs/active/tickets/T-068-02-01.md` — Lisa owns phase/status transitions.
- `src/engine/cast-core.ts` and tests — T-068-02-02 owns classification.
- `src/play/decompose-epic-core.ts` and tests — T-068-02-02 owns mirrored classification.
- `src/engine/cast.ts` — T-068-02-03 owns runner wiring.
- decompose effect files — T-068-02-03 owns runner wiring.
- `src/budget/*` and `src/ledger/*` — accounting and recalibration are outside this ticket.
- persisted `.vend/runs.jsonl` data — no history rewrite.

## `src/log/run-log.ts` internal layout

The file's existing order is preserved. Changes slot into the corresponding established
sections rather than creating a separate feature region.

### 1. `RunRecordInput` interface

Add the field after `reducedGrounding` and before timestamps:

```ts
readonly overEnvelope?: boolean;
```

Its documentation defines:

- `true` means the cast cleared while spending over its token envelope;
- only true is meaningful;
- false and absence are both omitted;
- omission retains pre-E-068 bytes;
- the field enables a cleared overshoot to remain countable.

The input type intentionally uses `boolean`, matching caller-friendly optional marker inputs.

### 2. `RunRecord` interface

Add the corresponding normalized field after `reducedGrounding`:

```ts
readonly overEnvelope?: true;
```

Its documentation establishes that presence means warning and that revival preserves it. The
literal type prevents an in-memory normalized record from representing
`overEnvelope: false`.

### 3. Private normalization helper

Add `normalizeOverEnvelope` directly after `normalizeReducedGrounding`:

```ts
function normalizeOverEnvelope(v: boolean | undefined): true | undefined {
  return v === true ? true : undefined;
}
```

The helper stays private. It does not become part of the public module API because callers
should use `buildRunRecord` or `reviveRecord`, the canonical boundaries.

The documentation mirrors the existing one-way helper and distinguishes the warning from
derivation or policy.

### 4. `buildRunRecord`

Normalize the input alongside existing optionals:

```ts
const overEnvelope = normalizeOverEnvelope(input.overEnvelope);
```

Conditionally spread it after `reducedGrounding`:

```ts
...(overEnvelope ? { overEnvelope } : {}),
```

No change is made to validation. The marker does not require `outcome === "success"`, an
envelope, a gate result, or usage at this layer. Downstream policy is trusted in the same way
other observational inputs are trusted.

Update the nearby comment describing optional-field omission so its explanation includes the
new one-way marker where useful. Avoid broad comment rewrites unrelated to this ticket.

### 5. `reviveRecord`

After reduced-grounding revival, normalize the raw marker:

```ts
const overEnvelope = normalizeOverEnvelope(
  typeof r.overEnvelope === "boolean" ? r.overEnvelope : undefined,
);
```

Then conditionally spread it into the frozen return object after `reducedGrounding`.

The reviver continues to accept all prior version-1 lines. A malformed optional marker is
dropped without returning `null` or incrementing `readRuns.skipped`.

### 6. Unchanged serialization

`serializeRunRecord` remains unchanged. JSON property omission is driven by the canonical
record object, so correct builder/reviver spreads are enough to satisfy serialization.

### 7. Unchanged schema and outcomes

`RUN_LOG_SCHEMA_VERSION` remains 1. `RUN_OUTCOMES` remains unchanged. The marker is orthogonal
to terminal state and compatible with optional-field evolution.

## `src/log/run-log.test.ts` internal layout

Place the new describe block immediately after the `reducedGrounding marker` block. The two
features share the one-way pattern, and adjacency makes drift easy to spot during review.

Suggested block title:

```ts
describe("overEnvelope marker — round-trip, byte compatibility, one-way, malformed, legacy (T-068-02-01 AC)", ...)
```

### Test 1 — true round-trip

- Build `baseInput({ runId: "oe1", overEnvelope: true })`.
- Assert the built record property equals true.
- Serialize and JSON-parse it.
- Revive and assert the revived property equals true.

This covers both writer and reader inclusion paths.

### Test 2 — absent omission

- Build an input with no marker.
- Assert `"overEnvelope" in rec` is false.
- Assert property access is undefined.
- Assert serialized bytes do not contain the key.

This covers the usual pre-E-068 shape.

### Test 3 — false one-way and exact bytes

- Create otherwise identical records from absent and explicit-false inputs.
- Use the same run id and all other values so their serializations are comparable.
- Assert false is omitted.
- Assert `serializeRunRecord(falseRecord) === serializeRunRecord(absentRecord)`.

This directly proves explicit false cannot perturb legacy bytes.

### Test 4 — malformed builder input

- Pass a string through a test-only type cast.
- Assert the field is absent.

This proves strict primitive normalization at the write boundary.

### Test 5 — malformed revive input

- Start from a canonical serialized record.
- Override raw `overEnvelope` with a string.
- Revive it.
- Assert the record remains valid, the marker is undefined, and the run id survives.

This proves optional corruption does not discard useful actuals.

### Test 6 — literal legacy line

- Provide a complete version-1 JSON line with no new field.
- Read through `readRuns`.
- Assert `skipped === 0` and revived marker is undefined.

Use an E-068-oriented id/epic to make the fixture purpose obvious. The literal line avoids
accidentally exercising a builder that already knows the new field while claiming legacy
compatibility.

## Public interface after the change

The public module gains no new exported symbol. Existing exported interfaces expand
structurally:

```ts
interface RunRecordInput {
  readonly overEnvelope?: boolean;
}

interface RunRecord {
  readonly overEnvelope?: true;
}
```

All current `RunRecordInput` object literals remain valid because the property is optional.
All current `RunRecord` consumers remain valid because the property is additive. Dependent
tickets can begin passing and reading it without a new import.

## Data flow after the change

```text
later runner boolean
    → RunRecordInput.overEnvelope?: boolean
    → normalizeOverEnvelope
    → RunRecord.overEnvelope?: true
    → serializeRunRecord / JSONL
    → JSON.parse
    → reviveRecord + normalizeOverEnvelope
    → RunRecord.overEnvelope?: true
```

At every canonical boundary, only literal true survives. There is no alternative path that
adds a false key.

## Ordering of implementation

1. Add both interface fields so later implementation references typecheck.
2. Add the private normalizer.
3. Thread it through `buildRunRecord`.
4. Thread it through `reviveRecord`.
5. Add unit tests for the entire contract.
6. Run focused and full gates.
7. Inspect owned diffs and document review.

## Structural invariants

- `src/log/run-log.ts` imports remain unchanged.
- `RUN_LOG_SCHEMA_VERSION` remains unchanged.
- `RUN_OUTCOMES` remains unchanged.
- Frozen record construction remains the only canonical write/read shape.
- Serialization remains exactly one compact JSON object plus one newline.
- Optional malformed data never invalidates an otherwise usable record.
- No stored record created by canonical paths contains `overEnvelope: false`.
- No downstream semantics are implemented ahead of their tickets.
