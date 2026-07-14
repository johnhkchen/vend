# T-076-02-02 Plan — ledger line and artifact survive settlement throw

## Execution contract

- Work continuously through Implement and Review.
- Keep phase artifacts private to this attempt.
- Do not edit ticket phase/status.
- Do not stage ticket work in the ordinary Git index.
- Use `lisa commit-ticket` with exact paths only.
- Preserve Lisa-owned worktree changes.
- Stop on this ticket after `review.md` is complete.

## Step 1 — pin the discrepancy record schema

Files:

- `src/log/run-log.test.ts`
- `src/log/run-log.ts`

Test first:

1. Add a complete `artifactDiscrepancy` fixture.
2. Assert build and revive round trip.
3. Assert unknown nested fields are removed.
4. Assert partial and malformed markers are omitted.
5. Assert an ordinary historical row does not synthesize the field.

Implement:

1. Export `ArtifactDiscrepancy` beside other optional structured markers.
2. Add optional fields to `RunRecordInput` and `RunRecord`.
3. Add `normalizeArtifactDiscrepancy`.
4. Thread it through `buildRunRecord`.
5. Thread it through `reviveRecord`.

Focused verification:

```bash
bun test src/log/run-log.test.ts
```

Pass condition: complete data survives and malformed data does not poison the base row.

## Step 2 — make final diff publication atomic

File: `src/engine/cast-diff.ts`.

1. Import `randomUUID`, `rename`, and `rm`.
2. Keep patch calculation unchanged.
3. Generate a unique temporary sibling path.
4. Write patch bytes to the temporary path.
5. Rename it to the final `.diff` destination.
6. Best-effort remove the temporary path on failure.
7. Rethrow the original failure.
8. Return the reference only after rename.

Static pass conditions:

- no direct final-path `writeFile` remains;
- no staging or Git index mutation exists;
- cleanup cannot replace the primary error.

## Step 3 — add the general settlement failure proof

File: `src/engine/cast.test.ts`.

1. Import `rmSync`.
2. Add a complement registry whose reviewer factory removes the expected diff.
3. Return a valid reviewer executor and track any dispense call.
4. Create a temp Git repository with a real HEAD.
5. Use `boardPlanPlay`, stable run id, and a primary `claude` stub.
6. Assert the cast rejects with an `ENOENT`-class error.
7. Assert reviewer dispense did not run.
8. Assert exactly one run-log row exists.
9. Assert outcome `errored`, primary usage/cost, and base gate evidence.
10. Assert no `capturedDiff` key.
11. Assert exact `artifactDiscrepancy` reference and reason.
12. Assert revive round trip preserves the marker.
13. Assert no false review verdict or skipped marker.
14. Assert the final artifact is absent.

Pre-implementation red check:

```bash
bun test src/engine/cast.test.ts --test-name-pattern "non-reviewer settlement throw"
```

Expected red: cast rejects and no row exists. Record the observation in `progress.md`.

## Step 4 — guard settlement and append in `finally`

File: `src/engine/cast.ts`.

1. Import `access` and `ArtifactDiscrepancy` type.
2. Derive logged model, turns, usage, and cost after the base verdict.
3. Keep the `play.effect` await outside the new guard.
4. Store the resolved effect report for post-effect processing.
5. Initialize `settledVerdict` to the base verdict.
6. Initialize optional settlement-error and discrepancy state.
7. Move diff capture and all later settlement work into `try`.
8. Keep reviewer-specific catch behavior nested and unchanged.
9. On outer catch, preserve the thrown value and set row outcome to `errored`.
10. Retain already-settled gate evidence.
11. In `finally`, reconcile the captured diff through the availability helper.
12. Stamp `endedAt` once.
13. Append the existing terminal row exactly once.
14. Add optional discrepancy beside captured diff.
15. After finally, rethrow the original settlement error when present.
16. Otherwise return the existing summary with reconciled diff data.

Review the diff immediately for:

- no append before or after the guard;
- no catch around `play.effect`;
- named reviewer failure still resolves as `missing-capability`;
- `errored` appears only on unexpected tail failure;
- primary usage/cost are always in scope;
- no unavailable path survives as `capturedDiff`.

## Step 5 — focused verification

Run:

```bash
bun test src/log/run-log.test.ts src/engine/cast.test.ts
```

Required green behaviors:

- new discrepancy schema tests;
- new non-reviewer settlement throw test;
- existing successful and empty diff paths;
- existing throwing reviewer settlement;
- existing cross-vendor pass/fail paths;
- existing inert complement resolution;
- existing timeout and ordinary cast paths.

If a focused failure appears, fix only ticket-owned settlement ordering or schema behavior and
document any deviation before proceeding.

## Step 6 — static verification

Run:

```bash
bun run build
git diff --check -- src/engine/cast.ts src/engine/cast.test.ts src/engine/cast-diff.ts src/log/run-log.ts src/log/run-log.test.ts
git diff -- src/engine/cast.ts src/engine/cast.test.ts src/engine/cast-diff.ts src/log/run-log.ts src/log/run-log.test.ts
```

Inspect for:

- type-safe marker threading;
- deterministic record key order;
- preserved successful row bytes;
- no accidental Lisa-owned edits;
- no ordinary-index staging;
- comments matching behavior.

## Step 7 — full repository gate

Run `bun run check`.

Pass condition:

- exit code 0;
- no new skip or failure attributable to this ticket;
- acceptance is executable, not prose-only.

On failure, repair ticket-owned issues and rerun focused tests plus the full gate. Do not soften a
red result or claim completion around an unresolved external failure.

## Step 8 — write implementation progress

Write `.lisa/attempts/T-076-02-02/1/work/progress.md` with:

- source files changed;
- red test observation;
- implementation behavior;
- focused and full commands/results;
- deviations;
- repository hygiene;
- planned Lisa commit command.

Do not place the artifact under `docs/active/work/`.

## Step 9 — commit the ticket source unit

Confirm `git status --short` and `lisa commit-ticket --help`, then run:

```bash
lisa commit-ticket \
  --ticket-id T-076-02-02 \
  --message "fix(engine): preserve ledger across settlement errors (T-076-02-02)" \
  --include src/engine/cast.ts \
  --include src/engine/cast.test.ts \
  --include src/engine/cast-diff.ts \
  --include src/log/run-log.ts \
  --include src/log/run-log.test.ts
```

Do not run `git add`, `git add -A`, or ordinary `git commit`.

Post-commit checks:

```bash
git show --stat --oneline HEAD
git status --short
git diff --cached --name-only
```

Pass condition: commit contains exactly five included paths, those paths are clean, and the
ordinary index is empty.

## Step 10 — final gate after commit

Run `bun run check` again. This satisfies the house rule that the committed state is green.

## Step 11 — Review artifact

Write `.lisa/attempts/T-076-02-02/1/work/review.md` with:

- outcome-first summary;
- commit id/message;
- exact files changed;
- behavior and data-shape explanation;
- test coverage and commands;
- acceptance mapping;
- compatibility assessment;
- honest boundary and open concerns;
- repository hygiene;
- confirmation all six private artifacts exist.

Do not update ticket frontmatter and do not start `T-076-02-03`.

## Acceptance checklist

- [ ] A real non-reviewer settlement operation throws after effect and diff capture.
- [ ] The cast still rejects with the original error class.
- [ ] Exactly one run record is written.
- [ ] The record outcome is `errored`.
- [ ] Primary usage, cost, and gate evidence survive.
- [ ] An unavailable artifact is not falsely referenced.
- [ ] Its expected reference is recorded as `artifactDiscrepancy`.
- [ ] Failed diff publication cannot leave a partial final `.diff` name.
- [ ] Reviewer-specific failure remains `missing-capability` and resolves.
- [ ] Existing review pass/fail/inert behavior stays green.
- [ ] `bun run check` is green before and after source commit.
- [ ] Exact source unit is committed through Lisa.
- [ ] `progress.md` and `review.md` exist privately.

## Risk checklist

- [ ] No pre-effect behavior is accidentally caught.
- [ ] No original settlement error is swallowed.
- [ ] No append happens twice.
- [ ] No success row is written for an unexpected tail exception.
- [ ] No missing artifact remains under `capturedDiff`.
- [ ] No ordinary record gains a discrepancy field.
- [ ] No run-log dependency on filesystem or engine is introduced.
- [ ] No Lisa-owned file enters the source commit.

## Done signal

The ticket is ready for Lisa Review when the real-Git settlement failure test proves one `errored`
ledger row with primary actuals and an explicit missing-diff discrepancy, all existing settlement
tests remain green, the full repository gate passes on the committed state, and Review honestly
records any remaining storage-level limitation.
