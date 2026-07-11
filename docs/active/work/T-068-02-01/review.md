# Review — T-068-02-01: over-envelope-record-marker

## Handoff summary

The run-log schema now supports an optional, one-way `overEnvelope` warning marker. A record
built with `overEnvelope: true` serializes the marker and preserves it through JSON parse and
`reviveRecord`. A false, absent, or malformed value is omitted, so an unmarked canonical record
has the same bytes it had before E-068.

This ticket establishes only the durable record contract. It does not change classification,
materialization, runner logging, settle output, or recalibration. Those behaviors remain assigned
to dependent tickets T-068-02-02 and T-068-02-03.

## Commits

- `8d98572` — `docs(T-068-02-01): define over-envelope marker contract`
- `03d585b` — `feat(log): add over-envelope run marker (T-068-02-01)`

The final `review.md` is the Lisa-detected handoff artifact. Ticket phase and status fields were
not manually changed.

## Files created

### RDSPI artifacts

- `docs/active/work/T-068-02-01/research.md`
- `docs/active/work/T-068-02-01/design.md`
- `docs/active/work/T-068-02-01/structure.md`
- `docs/active/work/T-068-02-01/plan.md`
- `docs/active/work/T-068-02-01/progress.md`
- `docs/active/work/T-068-02-01/review.md`

## Files modified

### `src/log/run-log.ts`

Added `RunRecordInput.overEnvelope?: boolean` as the caller-facing structural input. Runners can
eventually forward a normal boolean without importing a new type or helper.

Added `RunRecord.overEnvelope?: true` as the normalized stored shape. The literal type makes the
canonical invariant explicit: if the property exists, it is true. A normalized record cannot
represent a stored false warning.

Added private `normalizeOverEnvelope`:

```ts
function normalizeOverEnvelope(v: boolean | undefined): true | undefined {
  return v === true ? true : undefined;
}
```

Threaded the normalizer through `buildRunRecord` and `reviveRecord`. Each path conditionally
spreads the property only when it is true. Both paths therefore enforce identical one-way
semantics.

Documentation explains that the marker means a cast cleared its gates but spent over its token
envelope, and that run-log preserves rather than derives/classifies the fact.

No imports were added. `RUN_LOG_SCHEMA_VERSION` remains 1, `RUN_OUTCOMES` is unchanged, and
`serializeRunRecord` is unchanged.

### `src/log/run-log.test.ts`

Added six unit tests in a new describe block adjacent to the `reducedGrounding` one-way marker
tests:

1. true marker survives build → serialize → JSON.parse → revive;
2. absent marker creates no object property or serialized key;
3. explicit false is omitted and serializes byte-for-byte equal to an otherwise identical absent
   record;
4. malformed builder input is coerced to absence;
5. malformed revived input is dropped while the record remains usable;
6. a literal pre-E-068 version-1 line parses without being skipped and has no marker.

## Files deleted

None.

## Acceptance criterion assessment

Ticket criterion:

> a record carrying the over-envelope marker survives serialize→revive round-trip; an absent
> marker keeps the record byte-identical to a pre-E-068 one (back-compat test in
> run-log.test.ts, mirroring the reducedGrounding one-way flag).

Status: met.

### Marked round-trip

The positive test builds with `overEnvelope: true`, verifies the canonical built record, passes
it through the real serializer and `JSON.parse`, revives it through the tolerant read boundary,
and verifies the revived marker is still true.

This covers every ticket-owned transformation:

```text
RunRecordInput
  → normalizeOverEnvelope
  → buildRunRecord
  → serializeRunRecord
  → JSON.parse
  → reviveRecord
  → normalizeOverEnvelope
  → RunRecord
```

### Byte compatibility

The explicit-false test builds two records with identical values and run ids. One omits the new
input field; the other supplies `overEnvelope: false`. Their complete serialized strings are
asserted equal. This demonstrates that the canonical writer adds no false key, null, empty
container, reordered suffix, or other byte difference.

The separate absence test confirms both object-property omission and serialized-key omission.
The literal legacy test confirms a pre-E-068 line remains accepted by the read boundary.

### Mirrored one-way semantics

The implementation follows the named `reducedGrounding` pattern:

- input accepts optional boolean;
- stored record accepts optional literal true;
- private normalizer retains exactly true;
- builder conditionally spreads true;
- reviver conditionally spreads true;
- false/absent/malformed values disappear;
- old records remain valid.

## Test evidence

### Planned red proof

Before production plumbing:

```text
bun test src/log/run-log.test.ts
87 pass / 1 fail
```

The only failure was the new positive test: expected true, received undefined. This confirmed
that the suite detected the missing marker behavior rather than relying only on already-passing
absence cases.

### Focused run-log suite

After implementation:

```text
bun test src/log/run-log.test.ts
88 pass / 0 fail
177 expect() calls
```

This exercises the new marker contract plus all existing run-log normalization, compatibility,
serialization, reading, filtering, and derivation coverage.

### Typecheck

```text
bun run check:typecheck
exit 0
```

This verifies the additive interface field and normalized literal type across all structural
consumers in the repository.

### Full repository gate

```text
bun run check
1591 pass / 1 skip / 0 fail
4733 expect() calls
1592 tests across 107 files
```

The full gate completed BAML generation, TypeScript checking, and all Bun tests. The single skip
is the existing release acceptance integration that requires local `dist/` artifacts; it is
unrelated to this change.

## Coverage assessment

Coverage is strong for this ticket's record seam.

- Positive write/read persistence is directly tested end to end through the pure boundaries.
- Property omission and full serialized-byte equality cover backward compatibility.
- False and malformed values cover the one-way invariant on both write and read.
- A literal legacy line avoids claiming compatibility through a fixture built by new code.
- Existing generic tests continue to cover freezing, one-line JSONL, malformed lines, and schema
  normalization.
- Full-suite coverage checks that additive interface evolution did not disturb downstream ledger,
  shelf, engine, play, budget, and presentation consumers.

No filesystem integration test was added. `appendRunLog` merely composes the tested builder and
serializer before append, and `loadRunLog` composes file reading with the tested `readRuns`; the
repository's established run-log boundary keeps those thin verbs outside this unit scope.

## Architectural assessment

The implementation preserves the run-log zero-coupling invariant. The module does not import
the budget, executor, classifier, or runner. `overEnvelope` is structural data supplied by a
caller, just like `reducedGrounding`.

The marker remains orthogonal to `RunOutcome`. No new outcome was introduced, so existing
success filtering and exhaustive switches do not need premature modification. Later tickets can
stamp a successful clearing run and let existing success-based recalibration observe its actual
finishing cost.

Keeping schema version 1 is consistent with this repository's additive optional-field history.
The reader already tolerates missing newer fields, and canonical omission makes the change
backward compatible without migration.

## Open concerns and known limitations

### 1. No runner stamps the marker yet

This ticket makes the field available but does not produce it in a live or stub cast. Until
T-068-02-02 and T-068-02-03 land, runtime records will remain unmarked and current
budget-exhausted disposition remains unchanged. This is intentional DAG sequencing, not an
unimplemented part of this ticket.

### 2. The run log does not validate semantic consistency

`buildRunRecord` permits a caller to provide `overEnvelope: true` with any outcome, gates, usage,
or envelope shape. That is consistent with the log's sink boundary and existing marker pattern.
The classifier/runner must uphold the story contract that only a gates-cleared overshoot is
materialized and stamped.

Adding cross-field validation here would duplicate policy, couple the log to budget derivation,
and preempt successor tickets. Reviewers should verify that T-068-02-03 stamps the marker from
the T-068-02-02 verdict rather than from an unrelated heuristic.

### 3. Absence combines “not warned” and historical unknown

Like every one-way additive marker, undefined means no warning was recorded. For pre-E-068
history, that does not prove the run stayed within its envelope. Consumers must count positive
markers rather than interpret absence as historical proof of no overshoot.

This ambiguity is required for byte-compatible evolution and is documented on the field.

### 4. Magnitude is not persisted

The marker records only the warning fact. It does not store token overage, ratio, or time
overshoot. Existing envelope and usage fields permit relevant derivation, and persisting another
calculation would risk drift. Quantitative warning reporting was not requested by this ticket.

### 5. Timeout semantics remain outside this field

The story distinguishes token detect-after from wall-clock timeout. This record contract does
not encode a denomination and does not alter timeout handling. T-068-02-02 must preserve timeout
discard behavior while using this marker for the gates-cleared token-overshoot case.

### 6. Shared worktree contained concurrent changes

Other ticket work was present before and during implementation, including Lisa metadata and
changes under ledger, shelf, play, graph, and other work directories. Exact-path staging kept
those changes out of this ticket's commits. The full test gate passed with the combined working
tree state, but this review claims only the two source/test files and this work directory.

### 7. Requested `AGENTS.md` was absent

No `AGENTS.md` exists in the repository or its parent path. The available repository guidance
was `CLAUDE.md`, supplemented by the explicitly requested RDSPI workflow, parent story, and
vision document. No hidden instruction file was inferred or created.

## Deferred successor checks

For T-068-02-02 review:

- both mirrored classifiers must agree;
- gates-cleared token overshoot must choose materialization and warning;
- gate-failed and timed-out runs must remain no-materialize;
- success/censoring semantics should match the story notes.

For T-068-02-03 review:

- the plan must actually be written for the warned clear;
- the run record must carry `overEnvelope: true` and a clearing outcome;
- the live Settle summary must surface the warning;
- a stub-executor fixture must prove files-written plus warning-logged;
- unmarked normal clears must retain their old record bytes.

## Final assessment

The ticket is complete and ready for Lisa's transition. The implementation is small, symmetric,
fully compatible with existing version-1 records, and directly covered at both canonical record
boundaries. No critical issue requires human intervention before the dependent classifier and
runner tickets proceed.
