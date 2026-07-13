# T-073-01-04 — Structure

## File changes

### Modify `src/log/run-log.ts`

This remains the only production module changed.

Add the public local structural type:

```ts
export interface CrossVendorVerdict {
  readonly authoringSeat: string;
  readonly reviewingSeat: string;
  readonly verdict: "pass" | "fail";
  readonly detail?: string;
}
```

Add an optional `crossVendorVerdict?: CrossVendorVerdict` member to both:

- `RunRecordInput`, the writer-facing contract;
- `RunRecord`, the normalized/read-facing contract.

Place it adjacent to `seatOfExecution` and `capturedDiff`, because all three are S-071/S-073
routing/review provenance facts. Document that absence is inert/historical and that the run log
does not enforce routing policy.

Add private pure helper:

```ts
function normalizeCrossVendorVerdict(value: unknown): CrossVendorVerdict | undefined
```

The helper is responsible for:

- object presence;
- both non-empty seat strings;
- exact pass/fail discriminant;
- optional non-empty detail;
- canonical field selection/order;
- atomic omission on malformed required members.

Call the helper in `buildRunRecord` and conditionally spread its output into the frozen record.

Call the same helper in `reviveRecord` and conditionally spread its output into the frozen record.

No changes to:

- `RUN_LOG_SCHEMA_VERSION`;
- `RUN_OUTCOMES`;
- `GateResult`;
- `serializeRunRecord`;
- `readRuns`;
- `appendRunLog`;
- ledger derivations such as `totalTokens` or `forPlay`.

### Modify `src/log/run-log.test.ts`

Add one new describe block near the existing `capturedDiff`/seat provenance sections.

Primary acceptance test:

1. Build a record with an authoring seat, reviewing seat, pass verdict, and detail.
2. Build a record without the field, representing a single-seat run.
3. Serialize the records into a two-line JSONL value.
4. Parse the raw lines and assert exact key presence/absence.
5. Read through `readRuns` and assert no lines skipped.
6. Assert full verdict equality on the cross-reviewed record.
7. Assert property absence on the single-seat record.

Supporting tests:

- fail plus detail round-trips;
- partial required provenance is omitted atomically;
- malformed read-side metadata is dropped without losing the run;
- optional detail is omitted rather than synthesized.

The tests use existing `baseInput`, `buildRunRecord`, `serializeRunRecord`, and `readRuns` helpers.
No new imports beyond current run-log exports are required unless a type annotation materially
improves clarity.

## Module boundaries

```text
cross-review/review-core.ts
  CrossReviewVerdict (runtime workflow value)
           |
           | future composition maps authoring seat + reason/detail
           v
log/run-log.ts
  CrossVendorVerdict (durable structural fact)
  build -> serialize -> JSONL -> read -> revive
           ^
           |
log/run-log.test.ts
  fabricated free round-trip proof
```

There is intentionally no import edge from `log/run-log.ts` to `cross-review/` or `play/`.

## Public interface impact

Existing callers remain source-compatible because the new input property is optional.

Existing readers remain data-compatible because historical records lack the optional property.

New callers can provide:

```ts
crossVendorVerdict: {
  authoringSeat: "claude",
  reviewingSeat: "codex",
  verdict: "pass",
}
```

or a failure with `detail`.

Consumers receive the same normalized structure from both newly built and revived records.

## Data invariants

- The two seats and verdict discriminant are atomic.
- No partial cross-vendor provenance is persisted.
- Verdict is exactly `pass` or `fail`.
- Detail is optional and non-empty when present.
- Unknown nested keys are not persisted.
- A malformed optional verdict never makes a valid run unreadable.
- Absence creates no JSON key.
- Single-seat runs remain byte-shape compatible with pre-feature records.
- The run's existing `outcome` remains unchanged in this story.

## Ordering

1. Add contracts and normalization to production code.
2. Thread normalized value through build and revive returns.
3. Add acceptance and defensive tests.
4. Run focused test and typecheck/full gate.
5. Commit both exact paths in one ticket-owned source unit.

## Deliberate exclusions

- No cast orchestration changes.
- No review artifact loading.
- No complement resolution changes.
- No reviewer prompt or parser changes.
- No gate classification or `gate-failed` enforcement.
- No UI/stdout changes.
- No live or metered calls.
- No public work artifact writes.
- No ticket frontmatter changes.

## Expected diff shape

The production diff is additive: one interface, two optional properties, one normalizer, and two
conditional spreads. The test diff is one cohesive describe block. No generated code or dependency
metadata changes are expected.
