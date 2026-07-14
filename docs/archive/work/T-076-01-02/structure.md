# Structure — T-076-01-02 cross-review-skipped-marker

## Change set

Ticket-owned source changes are limited to four existing files:

1. `src/log/run-log.ts`
2. `src/log/run-log.test.ts`
3. `src/engine/cast.ts`
4. `src/engine/cast.test.ts`

No source files are created or deleted.

Private phase artifacts are created only in:

- `.lisa/attempts/T-076-01-02/1/work/research.md`
- `.lisa/attempts/T-076-01-02/1/work/design.md`
- `.lisa/attempts/T-076-01-02/1/work/structure.md`
- `.lisa/attempts/T-076-01-02/1/work/plan.md`
- `.lisa/attempts/T-076-01-02/1/work/progress.md`
- `.lisa/attempts/T-076-01-02/1/work/review.md`

Lisa publishes admitted artifacts later. None of these private files belongs in the ticket-owned
source commit.

## Dependency direction

The resulting dependency shape remains:

```text
cross-review/resolve-complement.ts
              ↓ result observed by
        engine/cast.ts
              ↓ plain structured data
        log/run-log.ts
```

Actual module imports remain acyclic:

- `cast.ts` imports the resolver and run-log type.
- `run-log.ts` imports neither executor nor cross-review modules.
- `resolve-complement.ts` remains unchanged.

The log owns only a structural durable-data interface. The engine owns when to emit it. The
resolver continues to own which configured capability resolves.

## `src/log/run-log.ts`

### New public interface

Add after `SeatInferred` and before `CrossVendorVerdict`:

```ts
export interface CrossReviewSkipped {
  readonly reason: string;
  readonly bindsWhen: string;
}
```

Documentation must establish:

- it represents a relevant cross-review whose complement resolution was inert;
- `reason` describes why review did not run;
- `bindsWhen` describes the capability condition needed to bind;
- the ledger does not import or re-evaluate resolver policy.

This location groups the marker with structured routing/gate provenance rather than raw diff data.

### `RunRecordInput` extension

Add:

```ts
readonly crossReviewSkipped?: CrossReviewSkipped;
```

Place it after `seatOfExecution` and before `crossVendorVerdict` so the serialized record tells a
coherent sequence:

1. execution lane;
2. relevant review skipped, if applicable;
3. actual review verdict, if one ran;
4. captured patch reference.

The field comment must define absence as no relevant skipped-resolution event or historical
unknown. It must state that malformed input is omitted.

### `RunRecord` extension

Add the same optional structured field in the corresponding position.

The normalized record comment must state:

- only complete markers are present;
- absence preserves ordinary/historical shape;
- `reviveRecord` preserves valid markers and drops malformed optional metadata.

### Normalization helper

Add near the other structured marker normalizers:

```ts
function normalizeCrossReviewSkipped(value: unknown): CrossReviewSkipped | undefined
```

Internal flow:

1. Reject non-object and `null`.
2. Cast to `Record<string, unknown>`.
3. Validate `reason` with `isNonEmptyString`.
4. Validate `bindsWhen` with `isNonEmptyString`.
5. Return a new object containing exactly those keys in that order.
6. Otherwise return `undefined`.

Using `unknown` matches newer optional metadata helpers such as
`normalizeCrossVendorVerdict` and avoids unsafe property access on malformed revive input.

### Write normalization

In `buildRunRecord`:

- compute `const crossReviewSkipped = normalizeCrossReviewSkipped(input.crossReviewSkipped)`;
- conditionally spread it after `seatOfExecution` and before `crossVendorVerdict`.

No assertion is added because malformed optional marker data must not reject the required base
record.

### Read normalization

In `reviveRecord`:

- compute `const crossReviewSkipped = normalizeCrossReviewSkipped(r.crossReviewSkipped)`;
- document that historical absence and malformed metadata are omitted;
- conditionally spread it in the same property position used by `buildRunRecord`.

Matching property order gives valid lines byte-stable build/read serialization.

### Unchanged surfaces

- `RUN_LOG_SCHEMA_VERSION` remains `1`.
- `serializeRunRecord` remains unchanged.
- `readRuns` remains unchanged because it already delegates field recovery to `reviveRecord`.
- `appendRunLog` remains unchanged because it already delegates input normalization to
  `buildRunRecord`.
- No ledger filtering or aggregation API is added.

## `src/log/run-log.test.ts`

### New test group

Add a `describe` block near other cross-review data, preferably between `capturedDiff` and
`crossVendorVerdict` or directly before `capturedDiff`.

Use a fixed marker:

```ts
const marker = {
  reason: "no-complement-reviewer-resolved",
  bindsWhen: "author-and-exactly-one-complement-reviewer-provisioned",
} as const;
```

### Unit cases

1. Build and read-path round trip.
   - Build a record with the marker.
   - Serialize it.
   - Parse through `readRuns`.
   - Assert zero skipped lines.
   - Assert exact marker equality.
   - Assert byte-stable reserialization.

2. Absent marker byte compatibility.
   - Build a record with a fixed run id and no marker.
   - Compare against an exact pre-feature JSONL literal.
   - Assert the key is not present.

3. Historical line compatibility.
   - Read the same literal.
   - Assert record retained and key absent.

4. Partial build input.
   - Supply only `reason` through a deliberate `as never` malformed fixture.
   - Assert the entire marker is omitted.
   - Assert serialization matches the absent-marker literal.

5. Extra nested input.
   - Supply the valid marker plus a `diagnostic` key.
   - Assert only canonical schema keys remain.

6. Malformed revive metadata.
   - Add a non-string `bindsWhen` to an otherwise valid raw line.
   - Assert the base record survives.
   - Assert the marker is absent.

These cases pin schema, normalize, serialize, and ledger read behavior from acceptance.

## `src/engine/cast.ts`

### Import extension

Expand the existing run-log import to include:

```ts
type CrossReviewSkipped
```

No runtime import is needed.

### Settlement state

Declare:

```ts
let crossReviewSkipped: CrossReviewSkipped | undefined;
```

Place it alongside `crossVendorVerdict`, because both are mutually exclusive results of the same
settlement routing decision.

### Resolver branch

Preserve the existing applicability guard and resolver call.

Refactor only the inner result branch:

```text
reviewer non-null
  → existing patch read
  → existing review dispense
  → existing crossVendorVerdict assignment

reviewer null
  → assign fixed crossReviewSkipped object
```

The marker uses the exact two stable strings pinned by the unit/integration tests.

No marker is assigned:

- before effect settlement;
- when gates are skipped;
- when the effect fails;
- when no diff exists;
- when the author lane is unknown;
- when a reviewer resolves.

### Ledger forwarding

Add a conditional spread to the one `appendRunLog` input:

```ts
...(crossReviewSkipped !== undefined ? { crossReviewSkipped } : {}),
```

Place it after execution/captured-diff provenance and before `crossVendorVerdict`, or align exactly
with run-log schema order. The comment must name it as a relevant-but-resolution-inert event and
explain omission for irrelevant or reviewed paths.

No changes are made to:

- `RunSummary`;
- stdout;
- `settleCrossReview`;
- outcome classification;
- gate rows;
- budgets or timeouts.

## `src/engine/cast.test.ts`

### Positive relevant-but-inert case

Update the existing single-seat cross-review test.

Preferred fixture shape:

- known Claude author executor;
- `boardPlanPlay` to land concrete diff bytes;
- omitted `crossReviewRegistry` to exercise the actual default configuration;
- gates enabled.

Assertions:

- outcome remains `success`;
- effect remains materialized;
- ordinary play gate row remains unchanged;
- no `crossVendorVerdict` exists;
- exact `crossReviewSkipped` marker exists;
- revived record preserves the exact marker.

### Lane-less negative case

Extend the captured-diff test whose executor id is `stub`.

Assertions:

- captured diff still exists;
- serialized raw line lacks `crossReviewSkipped`;
- revived record also lacks it.

This fixture proves a diff alone is insufficient.

### Diff-less negative case

Extend the no-op effect test.

Use a known Claude executor id so only the diff condition is missing.

Assertions:

- no captured diff exists;
- serialized raw line lacks `crossReviewSkipped`;
- revived record lacks it.

This fixture proves a lane alone is insufficient.

### Reviewed-path exclusivity

Extend both passing and refusing reviewer tests with:

```ts
expect("crossReviewSkipped" in raw).toBe(false);
```

The existing `calls` and verdict assertions continue to prove the live branch.

## Implementation ordering

1. Add failing run-log tests.
2. Add the run-log interface, normalization, build, and revive wiring.
3. Run focused run-log tests.
4. Add failing cast assertions for positive and negative boundaries.
5. Add the cast import/state/null-branch/ledger forwarding.
6. Run focused cast tests.
7. Run combined focused tests and typecheck.
8. Run `bun run check`.
9. Commit the four exact ticket-owned source paths with Lisa.
10. Re-run the full gate against the committed source state.
11. Complete private progress and review artifacts.

## Commit unit

The schema and engine wiring form one externally meaningful provenance feature. Tests in both
modules pin the same marker contract. Because neither half is useful independently and the full
gate must be green before any commit, use one meaningful source-unit commit containing exactly:

- `src/log/run-log.ts`
- `src/log/run-log.test.ts`
- `src/engine/cast.ts`
- `src/engine/cast.test.ts`

No ticket/story frontmatter or Lisa provenance path is included.

## Structural acceptance map

| Acceptance | Owning structure |
|---|---|
| Marker declared | `CrossReviewSkipped`, `RunRecordInput`, `RunRecord` |
| Schema normalized | `normalizeCrossReviewSkipped`, `buildRunRecord` |
| Ledger read round-trip | `reviveRecord`, `readRuns` unit suite |
| Relevant inert stamp | resolver-null branch in `castPlay` |
| Lane-less omission | captured-diff cast fixture with `stub` lane |
| Diff-less omission | no-op cast fixture with known Claude lane |
| Reviewed exclusivity | passing/refusing cast fixtures |
| Full quality gate | `bun run check` |
