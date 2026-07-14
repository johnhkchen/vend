# T-073-01-04 — Plan

## Step 1 — Add the durable verdict contract

Modify `src/log/run-log.ts`.

- Define `CrossVendorVerdict` locally.
- Use string seats to preserve the sink's executor independence.
- Use the literal union `"pass" | "fail"`.
- Keep `detail` optional.
- Add the optional property to `RunRecordInput`.
- Add the optional property to `RunRecord`.

Verification:

- TypeScript accepts both pass and fail values.
- Existing callers require no changes because the property is optional.

## Step 2 — Normalize on the write boundary

In `src/log/run-log.ts`:

- Add `normalizeCrossVendorVerdict`.
- Validate both required seats as non-empty strings.
- Validate the discriminant against the two allowed values.
- Preserve only a non-empty detail.
- Rebuild a canonical nested object.
- Return `undefined` for partial/malformed optional input.
- Call the helper in `buildRunRecord`.
- Conditionally spread it into the returned frozen record.

Verification:

- A complete value appears in the serialized JSON line.
- Absence and malformed required values produce no key.
- Extra nested keys are not copied.

## Step 3 — Normalize on the read boundary

In `src/log/run-log.ts`:

- Read the raw optional field in `reviveRecord`.
- Pass it through the same normalizer.
- Conditionally spread valid output into the revived record.
- Keep the surrounding run valid when optional verdict metadata is malformed.

Verification:

- A valid serialized verdict survives `readRuns` unchanged.
- Historical/ordinary lines remain readable with no field.
- Malformed optional metadata is omitted, not counted as a skipped run.

## Step 4 — Add the acceptance round-trip test

Modify `src/log/run-log.test.ts`.

- Construct a cross-reviewed run with both seats and a pass/fail discriminant.
- Construct a single-seat run with no verdict.
- Serialize them as the exact JSONL format.
- Inspect raw parsed lines for key presence/absence.
- Read the JSONL through `readRuns`.
- Assert the complete cross-vendor verdict survives.
- Assert the single-seat record has no verdict property.

This is the primary ticket acceptance proof.

## Step 5 — Add defensive schema cases

In the same describe block:

- Prove fail detail survives.
- Prove optional detail is omitted when absent.
- Prove a partial value is atomically omitted on write.
- Prove malformed optional data is dropped on revive without losing the record.

These tests pin the append-only compatibility behavior established by adjacent structured fields.

## Step 6 — Focused verification

Run:

```bash
bun test src/log/run-log.test.ts
git diff --check -- src/log/run-log.ts src/log/run-log.test.ts
```

If a focused test fails, correct the production/test mismatch and rerun before the full gate.

## Step 7 — Required full verification

Run:

```bash
bun run check
```

This must complete BAML generation, TypeScript, and the full test suite successfully before commit.
No hook bypass is permitted.

## Step 8 — Commit the source unit

Use only:

```bash
lisa commit-ticket \
  --ticket-id T-073-01-04 \
  --message "feat(run-log): record cross-vendor verdict" \
  --include src/log/run-log.ts \
  --include src/log/run-log.test.ts
```

Do not stage with ordinary Git. Do not include Lisa-owned ticket/provenance modifications or phase
artifacts. Confirm the two source paths are clean afterward.

## Step 9 — Record implementation progress

Write `progress.md` in the attempt-private directory with:

- completed source changes;
- focused verification result;
- full gate result;
- commit hash/message;
- deviations or corrections;
- remaining review artifact only.

## Step 10 — Review

Write `review.md` in the attempt-private directory.

Evaluate:

- exact files changed;
- acceptance criterion evidence;
- test coverage and gaps;
- append-only compatibility;
- pure-core/impure-shell boundary;
- repository hygiene;
- open concerns and explicit out-of-slice work.

Stop on this ticket after review. Lisa owns publication, phase advancement, completion commit, and
seat release.
