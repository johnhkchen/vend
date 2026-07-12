# Review — T-071-01-01

## Outcome

PASS. The ticket acceptance contract is met, the full repository gate is green,
and the meaningful source unit is committed through Lisa as
`e616525edf8d65e224d14be980f89a05220cac2e`.

## Summary of changes

The run ledger now supports optional `seatOfExecution` provenance on both its
write input and durable revived record. A supplied structurally valid seat string
is preserved verbatim. An absent value is omitted from the in-memory record and
serialized JSON, preserving byte compatibility with pre-E-071 records. The read
boundary applies the same structural rule and never consults routing policy.

## Files changed

### `src/log/run-log.ts`

- Added `seatOfExecution?: string` to `RunRecordInput`.
- Added `seatOfExecution?: string` to `RunRecord`.
- Added a private pure `normalizeSeatOfExecution` helper.
- Wired the helper into `buildRunRecord`.
- Conditionally emits the field only when structurally present.
- Wired the same helper into `reviveRecord`.
- Conditionally preserves the field on canonical revival.
- Added no imports and no effectful behavior.

### `src/log/run-log.test.ts`

- Added four focused tests for the new field.
- Proved a raw future/unknown lane survives the `readRuns` boundary verbatim.
- Proved marked record reserialization is stable.
- Proved absent serialization exactly matches a literal pre-E-071 record.
- Proved a historical line remains valid and does not acquire a guessed lane.
- Proved malformed optional metadata is omitted without dropping the record.

No file was deleted. No new runtime file or dependency was added.

## Acceptance review

### Supplied value is written verbatim

PASS.

The test supplies `future-lane/raw`, a value deliberately outside the current
`claude | codex` registry vocabulary. `buildRunRecord` exposes the exact string,
serialization retains it, and `readRuns` returns the exact string.

### Absent value is omitted

PASS.

The test checks both property shape and serialized content:

- `"seatOfExecution" in rec` is false;
- serialized JSON contains no `seatOfExecution` key.

The implementation uses a conditional spread, so it does not rely merely on
`JSON.stringify` dropping an own property whose value is `undefined`.

### Byte-identical to a pre-E-071 record

PASS.

A literal historical JSONL line is compared directly to serialization of the
equivalent newly built record without the field. The byte strings are equal,
including canonical key order and the trailing newline.

### Survives a `readRuns` round-trip

PASS.

The marked record is built, serialized, passed to `readRuns`, and reserialized.
The read reports zero skipped records, returns exactly one record, preserves the
raw seat, and produces the identical marked JSONL line.

The historical line also passes through `readRuns` with zero skipped records and
the field still omitted.

### No `KNOWN_SEATS` policing

PASS.

The production module imports no known-seat registry and performs no membership
lookup. Its only rule is structural non-empty-string validation. The raw future
lane test would fail if current registry membership were enforced.

### `bun run check` green

PASS.

- BAML generation: passed.
- TypeScript typecheck: passed.
- Tests: 1,626 passed, 1 expected skip, 0 failed.
- Expectations: 4,934 passed.

## Test coverage assessment

Coverage is proportionate and directly targets the pure schema seam. The tests
exercise:

- typed input to normalized record;
- normalized record to exact JSONL bytes;
- JSONL parsing through `readRuns` and `reviveRecord`;
- canonical reserialization;
- historical absence;
- malformed optional read data;
- explicit non-coupling to current lane vocabulary.

The focused suite passed 100 tests with 209 expectations. The full suite then
verified that adding the optional property did not break existing consumers or
fixtures.

No filesystem test was added. `appendRunLog` and `loadRunLog` remain thin shells
over the tested pure functions, matching established module test strategy.

No cast integration test was added. That is intentional: this ticket supplies the
schema substrate, while dependent ticket `T-071-01-02` owns stamping the field
from a resolved executor and the story-level stub-executor proof.

## Architecture assessment

The pure-core/impure-shell boundary is preserved. Normalization remains a pure
function over plain data. The log remains decoupled from executor and routing
policy. This is important for forward compatibility: a newer dispatcher can write
a lane an older Vend version does not recognize, and the ledger will retain the
fact rather than erase it.

Absence remains honest unknown. No model-name inference, default seat, or
historical backfill was introduced. That matches the story's countable-substrate
scope and prevents fabricated heat attribution.

## Compatibility assessment

The change is additive and optional. No schema version bump or migration is
needed under the repository's existing version-1 optional-field precedent.
Historical records revive without change. Unstamped new records serialize exactly
as before. Malformed optional metadata cannot blind consumers to otherwise useful
usage records.

## Commit and workspace hygiene

- Commit: `e616525edf8d65e224d14be980f89a05220cac2e`.
- Commit includes exactly `src/log/run-log.ts` and `src/log/run-log.test.ts`.
- Ticket-owned source files are clean after commit.
- Commit was made with `lisa commit-ticket` and exact include paths.
- No ordinary `git add` or `git commit` was used.
- Unrelated Lisa/config/hook changes were preserved and excluded.
- Ticket phase/status frontmatter was not manually edited.
- Phase artifacts were written to the private attempt directory; Lisa handled
  shared-path publication.

## Open concerns and known limitations

No blocking concern remains for this ticket.

The field is not yet populated by the cast loop; that is the explicit next ticket,
`T-071-01-02`, not a gap in this ticket's acceptance. This ticket also does not
read lane heat, select a seat, capture 429/cap signals, or change Lisa dispatch;
all are explicitly outside the parent story slice.

The structural normalizer omits an empty string as malformed optional metadata.
This is consistent with `seatDefaulted` and required-string conventions; it does
not police any non-empty value against routing policy.

## Human review focus

The most load-bearing lines are the shared normalizer and the conditional spreads
in both build and revive paths. Reviewers should confirm that future changes keep
the raw-string/no-registry contract and never turn absence into a default lane.
