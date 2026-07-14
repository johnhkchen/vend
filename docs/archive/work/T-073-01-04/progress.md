# T-073-01-04 — Progress

## Status

Implementation complete. Required source changes are committed and the full repository gate is
green. Only the Review phase artifact remains at the time this progress record is written.

## Completed work

### Durable schema

Modified `src/log/run-log.ts`.

- Added exported local `CrossVendorVerdict` interface.
- Added required `authoringSeat` string.
- Added required `reviewingSeat` string.
- Added exact `verdict: "pass" | "fail"` discriminant.
- Added optional `detail` string.
- Added optional `crossVendorVerdict` to `RunRecordInput`.
- Added optional `crossVendorVerdict` to `RunRecord`.
- Kept the schema structurally local to the log module.
- Added no cross-review, executor, routing, or budget imports.
- Left `RUN_LOG_SCHEMA_VERSION` unchanged because the field is additive and optional.

### Write normalization

Added pure `normalizeCrossVendorVerdict`.

- Rejects non-object/null values.
- Requires both seat strings to be non-empty.
- Requires verdict to be exactly `pass` or `fail`.
- Includes detail only when it is a non-empty string.
- Rebuilds the object with only schema-owned keys.
- Omits the complete optional object when required members are malformed or partial.
- Does not police seat values against routing policy.

Threaded the normalized value through `buildRunRecord` with a conditional spread. Ordinary and
single-seat inputs therefore emit no `crossVendorVerdict` key.

### Read normalization

Threaded raw `crossVendorVerdict` through the same normalizer in `reviveRecord`.

- Valid verdicts survive the supported read boundary.
- Malformed optional verdict metadata is dropped.
- The surrounding valid run is retained.
- Historical records with no field remain readable.

### Acceptance and defensive tests

Modified `src/log/run-log.test.ts` with five focused tests.

Primary acceptance proof:

- Builds one cross-reviewed record with Claude authoring and Codex reviewing.
- Builds one single-seat record with no verdict.
- Serializes both into the exact two-line JSONL shape.
- Parses raw physical lines and proves key presence on only the reviewed line.
- Reads through `readRuns` with zero skipped lines.
- Proves both seats, pass verdict, and detail survive.
- Proves the single-seat revived record has no verdict property.

Supporting coverage:

- Fail plus detail survives a byte-stable round trip.
- Pass can omit detail without a synthesized value.
- Partial provenance is omitted atomically on build.
- Malformed optional metadata is dropped on revive without losing the run.

## Verification

Focused command:

```text
bun test src/log/run-log.test.ts
```

Focused result:

- 113 tests passed.
- 0 tests failed.
- 245 assertions.
- 1 file.

Whitespace command:

```text
git diff --check -- src/log/run-log.ts src/log/run-log.test.ts
```

Result: passed with no output.

Required full gate:

```text
bun run check
```

Full result:

- BAML client generation completed.
- TypeScript `tsc --noEmit` passed.
- 1,686 tests passed.
- 1 existing intentional release-artifact integration test skipped.
- 0 tests failed.
- 5,199 assertions across 113 files.

## Commit

Created with `lisa commit-ticket` and exact include paths only:

```text
e560ee62f21211c771c84e98693d3a0d459d097d
feat(run-log): record cross-vendor verdict
```

Included paths:

- `src/log/run-log.ts`
- `src/log/run-log.test.ts`

No ordinary `git add` or `git commit` command was used. The ordinary Git index is empty and both
source paths are clean after the commit.

## Deviations and corrections

No scope or design deviation occurred.

During implementation, the single-seat test fixture initially passed the input value directly to
`serializeRunRecord` instead of first calling `buildRunRecord`. This was noticed immediately while
reviewing the patch and corrected before the first focused verification run. No failed gate or
committed intermediate state resulted.

## Repository coordination

Lisa-owned files remain outside the source commit:

- `.lisa/provenance.jsonl`
- `docs/active/tickets/T-073-01-04.md`
- `docs/active/work/T-073-01-04/` materialized by Lisa while observing private artifacts

The required phase artifacts were authored only at the attempt-private assignment path. None of
the Lisa-owned/publication paths was staged or included by this implementation.

## Remaining

- Write the attempt-private `review.md`.
- Stop on T-073-01-04 for Lisa completion publication and seat release.
