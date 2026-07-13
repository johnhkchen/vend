# Plan — T-081-01-02

## Goal

Complete the ledger unit correction in three independently reviewable source units, then execute the
full repository gate and review against every ticket acceptance clause.

## Preconditions

- Dependency T-081-01-01 is complete on HEAD.
- Its evidence verdict retains executor `num_turns` under a separate honest key.
- Ticket-owned source files are clean before implementation.
- Lisa-owned ticket/provenance modifications remain outside all commits.
- All phase artifacts stay in the private attempt work directory.

## Step 1 — extend the pure run-log schema

Modify `src/log/run-log.ts`.

1. Update `RunRecordInput.turnsUsed` documentation to define the E-081 capped unit.
2. Add the explicit pre-E-081 historical-unit schema note.
3. Add `RunRecordInput.executorReportedTurns?: number`.
4. Update `RunRecord.turnsUsed` documentation symmetrically.
5. Add `RunRecord.executorReportedTurns?: number` next to it.
6. Rename the private numeric helper to `normalizeTurnCount`.
7. Route both build inputs through the shared structural helper.
8. Conditionally spread both fields using `!== undefined`.
9. Route both raw revive fields through the helper independently.
10. Spread both revived fields in canonical order.
11. Ensure no historical value is copied into the new executor field.

Verification:

- TypeScript compiles the new optional field through build and revive.
- Search confirms no stale `normalizeTurnsUsed` references.
- Diff confirms run-log keeps zero-preserving presence checks.

## Step 2 — pin pure schema contracts

Modify `src/log/run-log.test.ts`.

1. Retain and relabel existing `turnsUsed` tests under the new meaning.
2. Add positive build/serialize/revive coverage for `executorReportedTurns`.
3. Add explicit-zero coverage for the executor field.
4. Add absent-field serialized omission coverage.
5. Add invalid build-value coverage.
6. Add malformed revive-value coverage.
7. Add a literal pre-E-081 line with old-unit `turnsUsed`.
8. Assert exact byte identity after revive/serialize.
9. Assert the historical row does not synthesize `executorReportedTurns`.

Focused verification:

```bash
bun test src/log/run-log.test.ts
```

Expected:

- all run-log tests pass;
- zero is present rather than omitted;
- malformed optional values do not reject a row;
- literal historical bytes round-trip exactly.

## Step 3 — inspect and commit schema unit

Run:

```bash
git diff --check -- src/log/run-log.ts src/log/run-log.test.ts
git diff -- src/log/run-log.ts src/log/run-log.test.ts
```

Confirm only intended schema/test changes exist.

Commit with:

```bash
lisa commit-ticket \
  --ticket-id T-081-01-02 \
  --message "fix(log): separate capped and executor turn counts" \
  --include src/log/run-log.ts \
  --include src/log/run-log.test.ts
```

Postcondition:

- both included files are clean;
- no ordinary index state remains;
- Lisa orchestration files may remain modified and are not included.

## Step 4 — correct cast-to-ledger mapping

Modify `src/engine/cast.ts`.

1. Rename the validated terminal result local to `executorReportedTurns`.
2. Derive optional new-write `turnsUsed` from cold-cast `progress.turns`.
3. Keep resume rows absent rather than writing a fabricated zero.
4. Keep early refusal rows unchanged because no dispense was attempted.
5. Pass `executorReportedTurns` to the final summary formatter.
6. Spread `turnsUsed` into append input even when it is zero.
7. Spread `executorReportedTurns` only when known.
8. Update comments so the two values cannot be mistaken for one another.
9. Avoid changes to progress accumulation, cap resolution, or settlement classification.

Verification:

- search shows terminal `num_turns` no longer feeds ledger `turnsUsed`;
- summary still receives progress and terminal facts separately;
- resume path remains able to omit both.

## Step 5 — update the full seam characterization

Modify `src/engine/cast.test.ts`.

1. Rename the T-077 test to state the new ledger separation.
2. Keep the exact 15-versus-23 fixture.
3. Retain exact argv assertion.
4. Retain summary assertion.
5. Retain the negative `23 / 15 cap` assertion.
6. Retain raw transcript terminal assertion.
7. Compare ledger `turnsUsed` with deduplicated transcript assistant IDs.
8. Pin ledger `turnsUsed` to 15 for the fixture.
9. Pin ledger `executorReportedTurns` to 23.
10. Keep effect, outcome, and recovery-draft assertions intact.

Focused verification:

```bash
bun test src/engine/cast.test.ts
```

Expected:

- the stub cast writes one ledger row;
- summary agent turns and ledger `turnsUsed` are equal;
- terminal executor counter survives separately;
- no regression to decompose cap-hit recovery.

## Step 6 — inspect and commit cast unit

Run:

```bash
git diff --check -- src/engine/cast.ts src/engine/cast.test.ts
git diff -- src/engine/cast.ts src/engine/cast.test.ts
```

Commit with:

```bash
lisa commit-ticket \
  --ticket-id T-081-01-02 \
  --message "fix(engine): persist agent turns in capped unit" \
  --include src/engine/cast.ts \
  --include src/engine/cast.test.ts
```

Postcondition:

- cast source and test are clean;
- commit includes no Lisa-owned frontmatter/provenance files.

## Step 7 — update the kitchen gold-master inspection

Modify `examples/templates/kitchen-seed/EXPECTED-OUTCOME.md`.

1. Locate the re-run jq query.
2. Keep its existing play/outcome/envelope/usage projection.
3. Keep `turnsUsed` as the primary turn field.
4. Add `executorReportedTurns` alongside it.
5. Do not rewrite unrelated frozen outcome prose.

Verification:

```bash
rg -n "turnsUsed|executorReportedTurns" examples/templates/kitchen-seed/EXPECTED-OUTCOME.md
git diff --check -- examples/templates/kitchen-seed/EXPECTED-OUTCOME.md
```

## Step 8 — commit documentation unit

Commit with:

```bash
lisa commit-ticket \
  --ticket-id T-081-01-02 \
  --message "docs(kitchen): inspect separate turn counters" \
  --include examples/templates/kitchen-seed/EXPECTED-OUTCOME.md
```

Postcondition:

- kitchen gold-master is clean;
- no ticket-owned source file remains modified.

## Step 9 — run the repository gate

Run:

```bash
bun run check
```

The command is the required project gate and includes BAML codegen, typecheck, and the full test
suite.

If it fails:

1. classify the failure as ticket-owned or unrelated concurrent state;
2. for ticket-owned failure, document the deviation in `progress.md` before changing the plan;
3. fix only ticket-owned files;
4. use another exact-path `lisa commit-ticket` commit for the fix;
5. rerun focused tests as appropriate;
6. rerun `bun run check` until green or honestly blocked.

Do not bypass hooks or weaken tests.

## Step 10 — audit acceptance

Check each criterion explicitly:

- Stub cast ledger `turnsUsed` equals deduplicated summary agent turns.
- `--max-turns` uses the same unit.
- Executor `num_turns` is retained as `executorReportedTurns`.
- Both run-log keys round-trip through build and revive.
- Zero is retained for both.
- Unknown is omitted for both.
- Invalid values are omitted without poisoning the row.
- A literal pre-E-081 row revives and serializes byte-identically.
- Schema note states the old `turnsUsed` unit.
- T-077 characterization is deliberately updated.
- Kitchen jq reads the new executor key.
- `bun run check` is green.

## Step 11 — final worktree audit

Run:

```bash
git status --short --branch
git log --oneline -6
```

Confirm:

- ticket-owned repository files are committed and clean;
- no ticket-owned file is staged, modified, or untracked;
- only expected Lisa orchestration changes remain outside commits;
- meaningful commits are visible on the ticket branch.

## Step 12 — Review phase

Write `review.md` in the private attempt directory.

Include:

- outcome and acceptance matrix;
- commits and exact files changed;
- explanation of new and historical units;
- test coverage and command results;
- any deviations;
- open concerns and honest boundary;
- worktree audit.

Write `review-disposition.json` with exactly:

```json
{"disposition":"pass","reason":null}
```

only if all acceptance criteria and the full gate pass. Otherwise write a blocking disposition with
a non-empty actionable reason.

After both review artifacts exist, stop on this ticket and wait for Lisa to publish/complete it.
