# Progress — T-071-01-01

## Status

Implementation is complete and committed. All ticket acceptance checks are green.
Only the Review phase remains at the time this artifact is written.

## Completed work

### Research

- Read the parent story before the ticket implementation work.
- Read the project vision, charter, stack, and RDSPI workflow.
- Mapped the run-log pure write/read boundaries.
- Identified `seatDefaulted` as the closest schema precedent.
- Confirmed `KNOWN_SEATS` lives outside the log in `src/play/agent-seat.ts`.
- Confirmed cast stamping belongs to dependent ticket `T-071-01-02`.
- Recorded findings in private-attempt `research.md`.

### Design

- Evaluated policy-typed, defaulted, unchecked, and structurally checked options.
- Selected an optional raw string with structural-only normalization.
- Defined absence as historical/unknown rather than a default lane.
- Defined non-empty supplied strings as verbatim durable facts.
- Rejected any import or lookup against `KNOWN_SEATS`.
- Recorded decisions in private-attempt `design.md`.

### Structure

- Limited production scope to `src/log/run-log.ts`.
- Limited test scope to `src/log/run-log.test.ts`.
- Defined matching optional properties on input and durable record types.
- Defined one shared private normalizer for write/read symmetry.
- Defined test coverage for marked, absent, historical, and malformed cases.
- Recorded the blueprint in private-attempt `structure.md`.

### Plan

- Sequenced type, normalization, write, read, and test changes.
- Defined focused and full-gate verification.
- Defined the exact Lisa include paths and commit message.
- Preserved the scope guard against editing cast/executor/seat-policy modules.
- Recorded the execution plan in private-attempt `plan.md`.

### Implementation: `src/log/run-log.ts`

- Added optional `seatOfExecution?: string` to `RunRecordInput`.
- Added optional `seatOfExecution?: string` to `RunRecord`.
- Documented that absence is unknown and omitted.
- Documented that supplied values are raw facts, not routing classifications.
- Added `normalizeSeatOfExecution(value: unknown)`.
- The helper accepts a non-empty string and returns it unchanged.
- The helper omits absence and malformed runtime values.
- The helper does not trim, alias, default, or consult `KNOWN_SEATS`.
- Wired normalization into `buildRunRecord`.
- Conditionally spread the field so absent records have no property/key.
- Wired the same normalization into `reviveRecord`.
- Conditionally spread the revived field in matching canonical order.
- Added no new import or dependency.

### Implementation: `src/log/run-log.test.ts`

- Added a dedicated T-071 acceptance describe block.
- Used raw value `future-lane/raw`, outside the current registry vocabulary.
- Asserted the built record contains that exact value.
- Serialized the record and passed it through `readRuns`.
- Asserted zero skipped, one revived record, and exact raw preservation.
- Asserted marked reserialization is byte-stable.
- Added a literal pre-E-071 JSONL line.
- Asserted an absent field is not present on the built record.
- Asserted absent serialization contains no field key.
- Asserted absent serialization exactly equals the historical literal.
- Asserted the historical line survives `readRuns` without a defaulted field.
- Asserted malformed non-string metadata is dropped without losing the record.

## Verification evidence

### Focused tests

Command:

```bash
bun test src/log/run-log.test.ts
```

Result:

- 100 passed.
- 0 failed.
- 209 expectations.
- New acceptance tests all passed.

### Diff hygiene

Commands included:

```bash
git diff --check -- src/log/run-log.ts src/log/run-log.test.ts
git diff -- src/log/run-log.ts src/log/run-log.test.ts
rg -n "seatOfExecution|KNOWN_SEATS" src/log/run-log.ts src/log/run-log.test.ts
```

Result:

- `git diff --check` reported no whitespace errors.
- Diff contained only the planned production and unit-test changes.
- No `KNOWN_SEATS` import or runtime policy lookup was introduced.
- References to `KNOWN_SEATS` are explanatory comments/test naming only.

### Full repository gate

Command:

```bash
bun run check
```

Result:

- BAML client generation succeeded.
- TypeScript `tsc --noEmit` succeeded.
- 1,626 tests passed.
- 1 release-artifact integration test skipped as expected because `dist/` is absent.
- 0 tests failed.
- 4,934 expectations passed.

## Commit

Command:

```bash
lisa commit-ticket \
  --ticket-id T-071-01-01 \
  --message "feat(log): record seat of execution (T-071-01-01)" \
  --include src/log/run-log.ts \
  --include src/log/run-log.test.ts
```

Result:

- Commit: `e616525edf8d65e224d14be980f89a05220cac2e`.
- Subject: `feat(log): record seat of execution (T-071-01-01)`.
- Commit contains exactly two files.
- `src/log/run-log.ts`: 24 inserted lines.
- `src/log/run-log.test.ts`: 46 inserted lines.
- Ticket-owned source files are clean after the commit.

## Deviations

No implementation deviation from the plan was required.

The private phase artifacts were automatically published by Lisa to
`docs/active/work/T-071-01-01/` as phases advanced. Those shared-path writes and
the ticket frontmatter phase change are Lisa-owned and were not included in the
ticket source commit.

## Unrelated working-tree state preserved

Pre-existing Lisa/config/hook modifications remain outside the ticket commit.
The Lisa-created lock and shared work publication also remain outside it. No
ordinary index staging, `git add`, or ordinary `git commit` was used.

## Remaining

- Complete the Review phase.
- Write private-attempt `review.md`.
- Stop on this ticket and await Lisa completion handling.
