# Progress — T-068-02-01: over-envelope-record-marker

## Status

Implementation complete. Focused tests, typecheck, and the full repository gate are green.
Review remains to be written after the implementation commit.

## Completed phase work

- Read the ticket and parent story `S-068-02`.
- Read `docs/knowledge/rdspi-workflow.md` and the relevant vision principles.
- Attempted to read the requested `AGENTS.md`; no such file exists in the repository or parent
  path. Used the repository's `CLAUDE.md` as the available local guidance fallback.
- Mapped the run-log write/read boundaries and the exact `reducedGrounding` precedent.
- Wrote and committed Research, Design, Structure, and Plan artifacts.
- Documentation/design commit: `8d98572` (`docs(T-068-02-01): define over-envelope marker contract`).

## Step 1 — acceptance tests

Added a dedicated `overEnvelope marker` describe block to `src/log/run-log.test.ts`, adjacent
to the structurally identical `reducedGrounding` block.

Coverage added:

1. literal true survives build → serialize → JSON.parse → revive;
2. absence creates no property and no serialized key;
3. explicit false is omitted and serializes exactly equal to an otherwise identical absent
   record;
4. malformed builder input is coerced to absence;
5. malformed raw revived input is dropped without invalidating the record;
6. a literal pre-E-068 version-1 line parses with no marker and no skipped record.

Red proof:

```text
bun test src/log/run-log.test.ts
87 pass / 1 fail
```

The sole failure was the new true round-trip assertion: expected true, received undefined.
All compatibility cases already passed because the pre-change builder ignored the unknown
field. This isolated the missing behavior to positive marker preservation.

## Step 2 — record interfaces

Extended `RunRecordInput` with:

```ts
readonly overEnvelope?: boolean;
```

Extended normalized `RunRecord` with:

```ts
readonly overEnvelope?: true;
```

The asymmetric types let later runners forward a normal boolean while making canonical record
presence equivalent to a true warning. Documentation identifies the field as one-way,
countable, and byte-compatible when absent.

## Step 3 — normalization and write path

Added private `normalizeOverEnvelope`, which returns true only for the primitive boolean true.
False, absence, and malformed values normalize to undefined.

`buildRunRecord` now normalizes `input.overEnvelope` alongside the other optional observations
and conditionally spreads it after `reducedGrounding`. No validation or classification rule was
added; the run log remains a sink.

## Step 4 — tolerant read path

`reviveRecord` now accepts only a raw primitive boolean, passes it through the shared one-way
normalizer, and conditionally spreads it into the frozen canonical record.

This preserves true across JSONL while dropping false/absent/malformed values. Optional marker
corruption does not reject the rest of a usable historical record.

## Step 5 — focused verification

```text
bun test src/log/run-log.test.ts
88 pass / 0 fail / 177 expect() calls
```

All existing run-log coverage and six new marker tests pass.

## Step 6 — type verification

```text
bun run check:typecheck
exit 0
```

The additive optional field introduced no structural consumer errors. The normalized literal
type is accepted across the codebase.

## Step 7 — full repository gate

```text
bun run check
1591 pass / 1 skip / 0 fail / 4733 expect() calls
1592 tests across 107 files
```

The gate successfully completed BAML generation, TypeScript checking, and the complete Bun test
suite. The one skipped test is the existing release acceptance integration that requires local
`dist/` artifacts; it is unrelated to this ticket.

## Step 8 — diff and invariant review

Owned implementation diff before progress/review:

```text
src/log/run-log.ts      +27
src/log/run-log.test.ts +50
```

Confirmed:

- `RUN_LOG_SCHEMA_VERSION` remains 1;
- `RUN_OUTCOMES` is unchanged;
- `serializeRunRecord` is unchanged;
- run-log imports are unchanged and retain zero coupling to budget/executor;
- builder and reviver both use `normalizeOverEnvelope`;
- canonical false/absent values are omitted;
- no classifier, runner, recalibration, wallet, or presentation file was edited by this ticket;
- ticket phase/status frontmatter was not manually edited.

## Deviations from plan

No implementation-scope deviation.

The planned red phase expected either a type/runtime failure. Bun transpiled the tests and the
positive runtime assertion failed cleanly; the later explicit TypeScript gate supplied the
static proof.

The repository-wide gate ran while other tickets were active in the shared worktree. Additional
unrelated modifications appeared in `src/ledger/`, `src/shelf/`, and play tests. They were not
needed for this implementation and will not be staged. Their presence did not prevent the full
gate from passing.

## Remaining

- Stage exact owned paths only.
- Commit the implementation and this progress artifact atomically.
- Write `review.md` with final commit/test evidence and open concerns.
- Stop without changing ticket metadata; Lisa handles phase/status transitions.
