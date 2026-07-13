# Plan — T-082-01-01 run-log cap-window marker

## Goal

Introduce the complete, optional `capWindowExhausted` structured fact on the run
ledger and prove its write/read atomicity and byte compatibility without extending
the ticket into cast classification or capacity learning.

## Preconditions

- Story `S-082-01`, ticket `T-082-01-01`, vision, charter, and RDSPI workflow read.
- Current phase confirmed as Research at assignment start.
- Focused baseline confirmed: `bun test src/log/run-log.test.ts` has 132 passing
  tests and 0 failures.
- Existing unrelated Lisa-managed worktree changes identified and reserved.
- Private artifact path confirmed as
  `.lisa/attempts/T-082-01-01/1/work/`.

## Step 1 — Add the marker data contract

Modify `src/log/run-log.ts`:

1. Add exported `CapWindowExhausted` with required `signal` and `reason` strings.
2. Add `capWindowExhausted?` to `RunRecordInput`.
3. Add `capWindowExhausted?` to `RunRecord`.
4. Document one-way presence semantics, atomicity, and the row facts that remain
   single-sourced outside the marker.

Independent verification:

- Inspect the diff for public naming and field placement.
- Run `bun run build` if the type extension creates compiler feedback before logic
  is complete; otherwise continue within the same cohesive source unit.

Atomicity:

- These declarations alone are not a meaningful shippable source unit; keep them
  together with normalization and tests in the ticket commit.

## Step 2 — Add pure normalization on both faces

Modify `src/log/run-log.ts`:

1. Add `normalizeCapWindowExhausted`.
2. Validate both nested values with `isNonEmptyString`.
3. Rebuild only `{ signal, reason }`.
4. Normalize and conditionally spread the marker in `buildRunRecord`.
5. Guard unknown read-side object data in `reviveRecord`.
6. Reuse the same normalizer and spread in the identical canonical position.

Independent verification:

- Confirm no changes to `serializeRunRecord`, `readRuns`, `appendRunLog`, outcome
  vocabulary, or schema version.
- Confirm build and revive assemble the field in the same order.
- Run `bun run build` to verify the public type and runtime code compile.

## Step 3 — Add focused acceptance tests

Modify `src/log/run-log.test.ts` with one marker-specific test group.

Required branches:

1. Complete marker build→serialize→revive survival.
2. Byte-stable marked reserialization.
3. Absent-marker literal byte compatibility on build.
4. Historical literal read→serialize byte compatibility.
5. Partial build marker atomic omission.
6. Canonical copying / unknown nested-key removal.
7. Malformed nested read metadata omission without row loss.
8. Non-object read metadata omission without row loss.

Independent verification:

```bash
bun test src/log/run-log.test.ts
```

Expected result:

- Existing 132 tests remain green.
- New tests pass.
- No existing expectations are weakened or rewritten.

## Step 4 — Inspect and harden the implementation

Review the exact diff:

```bash
git diff -- src/log/run-log.ts src/log/run-log.test.ts
```

Checklist:

- Public name is `capWindowExhausted` / `CapWindowExhausted` consistently.
- Both marker fields are required at the type and runtime boundaries.
- Empty strings are rejected.
- Extra keys are discarded.
- Partial/malformed markers produce no serialized key.
- Historical row revival does not synthesize the marker.
- Marked build/revive property order matches.
- Existing field order is unchanged.
- No scope creep into engine, heat, budget, wallet, CLI, or provider code.
- No ticket frontmatter edits authored by this attempt.

If a gap is found, update `progress.md` with the deviation before changing the plan.

## Step 5 — Run the repository gate

Run:

```bash
bun run check
```

The command performs BAML code generation, typecheck, and the full test suite.

Verification criteria:

- Exit status 0.
- No type failures in downstream `RunRecord` consumers.
- Full test suite green.
- Generated output does not introduce unintended ticket-owned changes.

If the gate fails:

1. Determine whether the failure is ticket-owned or caused by concurrent/unrelated
   worktree activity.
2. Fix ticket-owned failures within the two-file scope.
3. Record any plan deviation in `progress.md` before expanding the change.
4. Do not mask or soften a red result.

## Step 6 — Commit the meaningful source unit

The marker contract, normalization, and tests form one meaningful source unit
because none is independently complete against acceptance.

Use Lisa's scoped commit mechanism only, with exact repository-relative paths:

```bash
lisa commit-ticket T-082-01-01 \
  --include src/log/run-log.ts \
  --include src/log/run-log.test.ts \
  -m "feat(log): record cap-window exhaustion (T-082-01-01)"
```

Before invoking it:

- confirm both files contain only ticket-owned changes;
- confirm neither is staged through the ordinary index;
- confirm the focused and full gates are green.

After invoking it:

- inspect the resulting commit;
- verify the two ticket-owned source files are no longer modified or untracked;
- leave unrelated worktree state untouched.

Do not use `git add`, `git add -A`, ordinary `git commit`, or a destructive reset.

## Step 7 — Maintain implementation progress

Write `progress.md` in the private attempt directory.

Record:

- the decided marker shape;
- source and test changes completed;
- focused test result;
- full gate result;
- Lisa commit hash/result;
- any deviations from this plan;
- remaining review work.

The attempt artifacts are not included in the ticket source commit because Lisa
publishes admitted artifacts separately.

## Step 8 — Review against acceptance

Assess each acceptance clause directly:

- Complete marker survives build→serialize→revive.
- Partial build marker is atomically omitted.
- Malformed read marker is atomically omitted.
- The containing record survives malformed optional metadata.
- Marker-less build bytes equal the pre-feature literal.
- Revived historical bytes equal their original literal.
- Focused suite is green.
- `bun run check` is green.
- Source changes are committed through Lisa with exact paths.

Also assess story boundaries:

- no cast detection;
- no live provider call;
- no capacity learning;
- no lane heat change;
- no budget/wallet change;
- no historical ledger rewrite;
- no ticket phase/status change by this worker.

## Step 9 — Publish Review disposition privately

Write:

- `.lisa/attempts/T-082-01-01/1/work/review.md`
- `.lisa/attempts/T-082-01-01/1/work/review-disposition.json`

If all acceptance criteria and gates pass, disposition must be exactly:

```json
{"disposition":"pass","reason":null}
```

If blocked, use `block` with a non-empty actionable reason and state the same honest
boundary in `review.md`.

After Review, remain on this ticket and stop. Do not begin `T-082-01-02`; Lisa owns
publication, phase transitions, completion commit, and seat release.

## Risk table

| Risk | Control |
|---|---|
| Marker name implies a broader/narrower event than intended | Use the ticket-title-aligned `capWindowExhausted` event name and document settlement ownership. |
| Partial metadata leaks into the ledger | One shared atomic normalizer on build and revive. |
| Optional bad data discards a useful run | Keep required-record validation unchanged; normalize marker to absence. |
| Historical JSON bytes change | Conditional omission plus a literal read→serialize compatibility test. |
| Marked round-trip changes key order | Insert the field at the same location in build and revive. |
| Ledger imports executor/provider policy | Preserve strings structurally; detector policy remains in the next ticket. |
| Lane/time/burn facts diverge | Keep them single-sourced on the containing record. |
| Scope expands into story ticket 2 or sibling story | Restrict production/test diff to the two run-log files. |
| Concurrent worktree changes get swept into commit | Use `lisa commit-ticket` with exact `--include` paths only. |
| Gate failure is overlooked | Require focused suite and `bun run check`, report honestly in Review. |

## Expected final source diff

- `src/log/run-log.ts`: one exported interface, two optional field declarations, one
  private normalizer, and symmetrical build/revive wiring.
- `src/log/run-log.test.ts`: one focused acceptance test group.
- No other ticket-owned source changes.

## Expected completion state

- Ticket source committed.
- Ticket-owned source paths clean.
- Private RDSPI artifacts complete.
- Review disposition accurately reflects the gate.
- Lisa-managed and unrelated worktree state preserved.
