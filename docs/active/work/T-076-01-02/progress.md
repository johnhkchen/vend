# Progress — T-076-01-02 cross-review-skipped-marker

## Status

Implementation, source commit, and post-commit verification are complete. Review remains.

## Completed phases

- Research completed in `research.md`.
- Design completed in `design.md`.
- Structure completed in `structure.md`.
- Plan completed in `plan.md`.
- Implementation followed the planned test-first sequence.
- No ticket phase or status frontmatter was edited by this worker.
- No artifact was written directly to the shared publication directory by this worker.

## Implemented source changes

### `src/log/run-log.ts`

- Added local exported `CrossReviewSkipped` durable-data interface.
- Added required marker fields:
  - `reason`;
  - `bindsWhen`.
- Added optional `crossReviewSkipped` to `RunRecordInput`.
- Added optional `crossReviewSkipped` to normalized `RunRecord`.
- Added `normalizeCrossReviewSkipped(unknown)`.
- Normalization requires both values to be non-empty strings.
- Normalization rebuilds the object in deterministic `reason`, `bindsWhen` key order.
- Partial or malformed optional marker data is omitted.
- Extra nested fields are not persisted.
- `buildRunRecord` now preserves a valid marker.
- `reviveRecord` now preserves a valid marker through the ledger read boundary.
- Both build and revive omit the key entirely when no valid marker exists.
- `RUN_LOG_SCHEMA_VERSION` remains `1`, matching nearby additive optional fields.
- No executor or cross-review policy module was imported into the log.

### `src/log/run-log.test.ts`

- Added six marker-focused unit tests.
- Pinned the emitted marker values:
  - `reason: "no-complement-reviewer-resolved"`;
  - `bindsWhen: "author-and-exactly-one-complement-reviewer-provisioned"`.
- Covered build and `readRuns` round trip.
- Covered byte-stable reserialization.
- Covered exact pre-feature serialization when absent.
- Covered historical read without synthesis.
- Covered partial build input omission.
- Covered canonical removal of extra nested fields.
- Covered malformed revive metadata without loss of the base run.

### `src/engine/cast.ts`

- Imported `CrossReviewSkipped` as a type.
- Added optional marker state beside `crossVendorVerdict`.
- Preserved the existing review applicability guard:
  - gates enabled;
  - effect successful;
  - captured diff present;
  - execution lane known.
- Preserved the existing non-null reviewer path without outcome or timeout changes.
- Added the marker only in the `reviewer === null` branch.
- Forwarded it to the single `appendRunLog` call through a conditional spread.
- Updated nearby comments so a relevant null resolution is no longer described as byte-identical
  silence.
- Did not change `RunSummary`, stdout, gate rows, settlement classification, resolver semantics,
  budgets, or timeouts.

### `src/engine/cast.test.ts`

- Converted the inert single-seat fixture into the exact default-config positive proof.
- The positive fixture has a known Claude lane and concrete captured diff.
- It omits `crossReviewRegistry`, exercising the shipped inert default.
- It asserts exact marker values and ledger revival.
- It asserts the outcome remains `success` and existing gate rows remain unchanged.
- Added marker absence assertions to the lane-less diff-producing fixture.
- Changed the diff-less fixture to a known Claude lane and asserted marker absence.
- Added marker absence assertions to both passing and refusing reviewer paths.
- Marker and reviewer verdict are therefore pinned as mutually exclusive.

## Test-first evidence

### Run-log red

Command:

```bash
bun test src/log/run-log.test.ts
```

Before schema implementation:

- 117 passed;
- 2 failed;
- both failures showed `crossReviewSkipped` was `undefined` for a valid marker.

This established that the new tests exercised missing behavior rather than passing accidentally.

### Run-log green

Same command after schema implementation:

- 119 passed;
- 0 failed;
- 261 expectations.

### Cast red

Command:

```bash
bun test src/engine/cast.test.ts
```

Before settlement wiring:

- 17 passed;
- 1 failed;
- the default relevant-but-inert run lacked `crossReviewSkipped`.

Negative lane-less/diff-less and reviewed-path assertions already passed.

### Cast green

Same command after settlement wiring:

- 18 passed;
- 0 failed;
- 154 expectations.

## Focused verification

Command:

```bash
bun test src/log/run-log.test.ts src/engine/cast.test.ts
```

Result:

- 137 passed;
- 0 failed;
- 415 expectations.

Adjacent boundary command:

```bash
bun test src/cross-review/resolve-complement.test.ts src/engine/cast-core.test.ts
```

Result:

- 72 passed;
- 0 failed;
- 161 expectations.

Static verification:

```bash
bun run build
git diff --check -- src/log/run-log.ts src/log/run-log.test.ts src/engine/cast.ts src/engine/cast.test.ts
```

Result:

- `tsc --noEmit` passed.
- Diff whitespace check passed.

## Full-gate evidence

### First attempt: shared transient red

The first `bun run check` reached the full test suite and reported:

- 1726 passed;
- 1 skipped;
- 8 failed.

All eight failures were isolated to concurrent ticket `T-076-03-01`'s uncommitted
`src/doctor/doctor-probe.test.ts`. That ticket had added a sixth doctor check while legacy
expectations still asserted a count of five.

No ticket-owned test failed, and this worker made no edits to the doctor files.

### Shared state convergence

After the concurrent worker completed its expectation updates:

```bash
bun test src/doctor/doctor-probe.test.ts
```

Result:

- 23 passed;
- 0 failed;
- 109 expectations.

### Authoritative green rerun

Command:

```bash
bun run check
```

Result:

- BAML generation passed.
- Typecheck passed.
- 1735 tests passed.
- 1 integration test skipped because no `dist/` artifact was present, as expected by the suite.
- 0 tests failed.
- 5381 expectations passed.

## Deviations from plan

### Shared-gate retry

The plan expected a direct green full gate. A concurrent serialized ticket temporarily changed the
doctor result cardinality before updating its tests. The implementation did not expand scope or
modify those files. Verification paused, identified the exact external cause, then reran after the
shared worktree converged.

### Artifact publication observation

Lisa created/published a shared `docs/active/work/T-076-01-02/` directory while private artifacts
were being completed. This worker continued to write only the assignment-mandated private attempt
path and did not include shared artifacts in source work.

No implementation design deviation was required.

## Workspace ownership

Ticket-owned source paths:

- `src/log/run-log.ts`
- `src/log/run-log.test.ts`
- `src/engine/cast.ts`
- `src/engine/cast.test.ts`

Known non-owned concurrent/Lisa paths include:

- `.lisa/provenance.jsonl`
- ticket frontmatter files;
- `docs/active/work/` publication directories;
- `src/doctor/doctor-probe.ts`;
- `src/doctor/doctor-probe.test.ts`.

They were preserved and excluded from this ticket's source unit.

## Remaining implementation actions

- Write `review.md`.

## Source commit

Command:

```bash
lisa commit-ticket \
  --ticket-id T-076-01-02 \
  --message "feat(cross-review): record skipped complement review (T-076-01-02)" \
  --include src/log/run-log.ts \
  --include src/log/run-log.test.ts \
  --include src/engine/cast.ts \
  --include src/engine/cast.test.ts
```

Result:

- Commit: `562613b073cc2af5f79f102b19109c2b3cb88766`.
- Subject: `feat(cross-review): record skipped complement review (T-076-01-02)`.
- Exactly four files committed.
- 158 insertions and 10 deletions.
- All four ticket-owned paths are clean after commit.
- The ordinary Git index is empty.

## Post-commit full gate

Command:

```bash
bun run check
```

Result against committed ticket source:

- BAML generation passed.
- Typecheck passed.
- 1735 tests passed.
- 1 expected release-artifact integration test skipped.
- 0 tests failed.
- 5384 expectations passed.

The expectation count is three higher than the pre-commit run because concurrent
`T-076-03-01` added its planned thrown-reviewer-probe containment assertion. The shared suite is
green, and no ticket-owned file changed after commit.
