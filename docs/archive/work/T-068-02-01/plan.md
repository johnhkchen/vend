# Plan — T-068-02-01: over-envelope-record-marker

## Objective

Extend the version-1 run-log record with an optional `overEnvelope` one-way marker that
survives serialize/revive and is completely absent from pre-E-068-shaped records. Complete the
change without modifying the ticket frontmatter or implementing successor-ticket behavior.

## Step 1 — Add acceptance tests

Modify `src/log/run-log.test.ts` with a describe block adjacent to `reducedGrounding`.

Add six tests:

1. `overEnvelope: true` survives build → serialize → parse → revive.
2. An absent marker creates no property and no serialized key.
3. Explicit false is omitted and serializes byte-for-byte equal to the otherwise identical
   absent-marker input.
4. A malformed builder value is coerced to absence.
5. A malformed raw revived value is dropped without rejecting the record.
6. A literal pre-E-068 version-1 line parses with no marker and no skipped record.

Verification after this step:

```sh
bun test src/log/run-log.test.ts
```

Expected result before production changes: TypeScript/runtime failure because
`RunRecordInput` and `RunRecord` do not yet expose `overEnvelope`, or round-trip assertions fail.
This is the red proof that the new tests exercise missing behavior.

## Step 2 — Extend the record interfaces

Modify `src/log/run-log.ts`:

- Add `RunRecordInput.overEnvelope?: boolean` after `reducedGrounding`.
- Add `RunRecord.overEnvelope?: true` after `reducedGrounding`.
- Document one-way semantics, countability purpose, and byte-compatible omission.

Verification criterion:

- Existing input literals still typecheck because the field is optional.
- The normalized record type cannot represent a canonical stored false value.

## Step 3 — Add normalization and write threading

Add the private helper:

```ts
function normalizeOverEnvelope(v: boolean | undefined): true | undefined {
  return v === true ? true : undefined;
}
```

In `buildRunRecord`:

- normalize `input.overEnvelope` with the helper;
- conditionally spread `{ overEnvelope }` only for true;
- leave all validation, outcomes, schema version, and serializer behavior unchanged.

Verification criterion:

- true is present on a built record;
- false/absent/malformed values create no property;
- absent and false records serialize identically.

## Step 4 — Add tolerant read threading

In `reviveRecord`:

- accept only a raw primitive boolean before normalization;
- normalize with `normalizeOverEnvelope`;
- conditionally spread the marker only for true.

Verification criterion:

- a serialized true marker survives revival;
- false/absent/malformed values disappear;
- malformed optional data does not make revival return null;
- literal legacy records remain accepted.

## Step 5 — Run focused tests

Run:

```sh
bun test src/log/run-log.test.ts
```

Required result: all run-log tests pass with zero failures.

If a test fails, adjust only the record contract or its tests. Do not broaden into classifier,
runner, or ledger behavior. Document any plan deviation in `progress.md` before making it.

## Step 6 — Run static checking

Run:

```sh
bun run check:typecheck
```

Required result: zero TypeScript errors. This catches structural consumers that construct
explicit `RunRecord` shapes and validates the literal-true normalized type.

## Step 7 — Run the full repository gate

Run:

```sh
bun run check
```

This regenerates BAML, typechecks, and runs the complete test suite. Required result: zero
failures attributable to this ticket. If unrelated concurrent work causes a failure, isolate it
with focused tests and record exact evidence rather than changing sibling-owned files.

## Step 8 — Inspect compatibility and scope

Review exact diffs for `src/log/run-log.ts` and `src/log/run-log.test.ts`.

Confirm:

- no import was added to run-log;
- schema version remains 1;
- outcomes remain unchanged;
- serializer remains unchanged;
- builder and reviver use the same one-way normalization;
- no false marker can be serialized through canonical paths;
- no classifier/runner/recalibration behavior was modified;
- ticket phase/status fields were not edited by this work.

Run a status check and stage only ticket-owned paths.

## Step 9 — Track implementation progress

Create `docs/active/work/T-068-02-01/progress.md` recording:

- each completed implementation step;
- focused and full test results;
- files changed;
- any deviations and their rationale;
- confirmation that unrelated shared-worktree changes were not staged.

## Step 10 — Commit the implementation atomically

Commit production code, unit tests, and implementation progress as one coherent record-contract
unit. Use exact-path staging. Suggested subject:

```text
feat(log): add over-envelope run marker (T-068-02-01)
```

The design/structure/plan artifacts may be committed as a preceding documentation unit. Review
is a final handoff artifact after verification.

## Step 11 — Review and handoff

Create `review.md` summarizing:

- all created and modified files;
- the chosen one-way field contract;
- acceptance-criterion evidence;
- focused and full test coverage;
- explicit gaps and deferred successor-ticket work;
- open concerns, including compatibility semantics;
- commit identifiers.

Do not update ticket phase or status. Stop after `review.md` is written, as Lisa handles the
remaining transition.

## Atomicity map

### Documentation/design unit

- `research.md`
- `design.md`
- `structure.md`
- `plan.md`

This unit captures the complete pre-implementation rationale and blueprint.

### Record-contract implementation unit

- `src/log/run-log.ts`
- `src/log/run-log.test.ts`
- `progress.md`

This unit is independently coherent and verified by the focused run-log suite and full gate.

### Review handoff unit

- `review.md`

This unit records final evidence after the implementation commit. It must not introduce code
changes.

## Risk controls

- **Accidental legacy byte change:** exact absent-versus-false serialized equality test.
- **Write/read asymmetry:** true round-trip test traverses both canonical paths.
- **Malformed marker admits truthy junk:** explicit malformed tests on both boundaries.
- **Schema expansion leaks false values:** normalized field type is `true | undefined`.
- **Scope creep into disposition:** no edits outside run-log and its test.
- **Shared-worktree contamination:** exact-path staging and pre-commit diff inspection.
- **Lisa-owned metadata conflict:** never manually edit ticket frontmatter.

## Definition of done

- All six RDSPI artifacts exist in the ticket work directory.
- A true `overEnvelope` marker survives serialize/revive.
- Absent and explicit-false inputs emit pre-E-068-compatible bytes.
- Legacy and malformed cases are covered.
- Focused run-log tests pass.
- Typecheck passes.
- Full repository gate passes, or any unrelated external failure is precisely documented.
- Owned changes are committed without staging concurrent work.
- `review.md` provides the final handoff and no ticket metadata was manually changed.
