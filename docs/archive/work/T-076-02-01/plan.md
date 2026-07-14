# Plan — T-076-02-01

## Goal

Turn a provisioned reviewer dispense rejection into an ordinary, countable
`missing-capability` settlement while preserving already-landed work and every successful E-073
review byte/field.

## Step 1 — Pin pure post-effect settlement

Modify `src/engine/cast-core.test.ts` first.

- Import the planned `settleCrossReviewFailure` helper.
- Create a base verdict with materialization, a gate row, and over-envelope evidence.
- Assert the helper relabels only outcome to `missing-capability`.
- Assert the input object is unchanged.

Run:

```bash
bun test src/engine/cast-core.test.ts
```

Expected red before implementation: missing export or missing function behavior.

Then modify `src/engine/cast-core.ts`.

- Add the documented pure helper adjacent to `settleCrossReview`.
- Preserve every field except outcome.

Re-run the focused suite and require green.

Verification criteria:

- outcome relabeled;
- physical materialization retained;
- gate evidence retained;
- over-envelope evidence retained;
- no mutation.

## Step 2 — Add throwing-reviewer integration proof

Modify `src/engine/cast.test.ts`.

- Add a registry fixture with Claude author and throwing OpenAI-compatible reviewer.
- Use the existing real file-writing effect and temporary Git repository.
- Inject a connection-refused `Error` from reviewer dispense.
- Await `castPlay` under `captureStdout`.
- Assert the call resolves and the reviewer was invoked once.
- Assert summary outcome/materialization/diff facts.
- Assert the complete andon surface and absence of stack/gate-failed output.
- Assert exactly one durable record with the new outcome and unchanged cast facts.
- Assert no valid verdict or skipped marker was fabricated.

Run:

```bash
bun test src/engine/cast.test.ts
```

Expected red before implementation: `captureStdout` rethrows the reviewer error and the test fails
at the awaited cast.

Record the red result in `progress.md` before implementing the shell change.

## Step 3 — Implement reviewer failure degradation

Modify `src/engine/cast.ts`.

- Import the pure failure settlement helper.
- Add the private failure presentation type.
- Add a `crossReviewFailure` local beside existing review state.
- Wrap only `dispenseReviewVerdict` and its valid mapping in `try/catch`.
- Convert the thrown value into trusted seat, plain endpoint category, safe cause, and fix hint.
- Branch settlement through `settleCrossReviewFailure` only when that value exists.
- Print one `missing-capability` andon on that arm.
- Preserve the existing valid-fail andon on the valid verdict arm.
- Let ordinary logging and summary assembly proceed unchanged.

Add private total helpers at the bottom of the module.

Implementation constraints:

- no `.stack` access;
- no `console.error`;
- no early return after effect;
- no retry;
- no new ledger field;
- no fabricated review verdict;
- no fabricated cross-review-skipped marker;
- no broad catch over other settlement effects.

Re-run:

```bash
bun test src/engine/cast-core.test.ts src/engine/cast.test.ts
```

Require all existing valid pass, valid fail, inert, primary-executor andon, progress, diff, and
budget cases to remain green.

## Step 4 — Static and diff verification

Run:

```bash
bun run build
git diff --check -- src/engine/cast-core.ts src/engine/cast-core.test.ts src/engine/cast.ts src/engine/cast.test.ts
git diff -- src/engine/cast-core.ts src/engine/cast-core.test.ts src/engine/cast.ts src/engine/cast.test.ts
```

Review for:

- type-only imports where appropriate;
- no widened catch scope;
- no successful-path changes beyond undefined state/branch selection;
- exact endpoint and hint wording;
- no unrelated formatting churn;
- no Lisa-owned file inclusion.

## Step 5 — Full repository gate

Run the canonical gate:

```bash
bun run check
```

This must pass before committing.

If the gate fails:

- distinguish ticket-owned failures from concurrent/shared-worktree failures;
- repair ticket-owned failures within scope;
- do not edit unrelated agent-owned files;
- rerun the focused suite after each repair;
- rerun the complete gate until green.

No test waiver is allowed for ticket-owned failures.

## Step 6 — Commit the source unit

Use Lisa's ticket transaction, never the ordinary Git index:

```bash
lisa commit-ticket \
  --ticket-id T-076-02-01 \
  --message "fix(engine): andon reviewer settlement failures (T-076-02-01)" \
  --include src/engine/cast-core.ts \
  --include src/engine/cast-core.test.ts \
  --include src/engine/cast.ts \
  --include src/engine/cast.test.ts
```

The four paths form one meaningful unit: pure decision, shell wiring, and their proofs.

After commit, verify:

```bash
git status --short
git show --stat --oneline HEAD
```

Expected remaining modifications are Lisa-owned provenance/ticket transition files only.

No ticket-owned source path may remain modified, staged, or untracked.

## Step 7 — Post-commit gate

Run `bun run check` again after the source commit.

This catches hook/codegen or shared-tree changes that could invalidate the committed unit.

Record exact pass/fail counts and any expected skips in `progress.md` and `review.md`.

## Step 8 — Complete workflow artifacts

Write `progress.md` in the attempt-private work directory with:

- completed steps;
- test-first red evidence;
- focused green evidence;
- full gate evidence;
- commit hash/message;
- deviations, if any;
- remaining work (Review only at that point).

Write `review.md` with:

- outcome and acceptance assessment;
- exact source files changed;
- behavior of the caught path;
- successful-path compatibility evidence;
- test coverage and results;
- open concerns and honest boundaries;
- repository hygiene.

Do not edit ticket phase/status. Do not write to the public work path. Stop after private
`review.md` exists and the ticket-owned source is committed/clean.

## Acceptance trace

| Acceptance criterion | Implementation | Verification |
|---|---|---|
| Throwing reviewer is a named andon outcome | catch + pure failure settlement | cast integration summary + record |
| No unhandled rejection | catch and fall through ordinary settlement | awaited `captureStdout` resolves |
| Andon printed with no stack | controlled stdout line using message only | stdout positive/negative assertions |
| Reviewer seat named | trusted `reviewer.seat` | contains `codex` |
| Endpoint category in plain words | executor-ID category mapping | contains `OpenAI-compatible endpoint` |
| Fix hint | category-specific config/reachability + doctor text | contains env variable and `vend doctor` |
| Successful review unchanged | valid path stays on `settleCrossReview` | pre-existing pass/fail tests green |
| Full gate | no repository regression | `bun run check` green |

## Risk controls

- Risk: accidentally treat operational failure as code-review refusal.
  Control: separate failure state and no `CrossVendorVerdict`.
- Risk: lose physical effect truth.
  Control: pure test preserves `materialize`; integration checks true plus diff.
- Risk: leak stack.
  Control: error-message-only helper and explicit stdout negative assertions.
- Risk: change successful records.
  Control: no schema changes and existing pass/fail tests remain unchanged.
- Risk: swallow unrelated settlement defects.
  Control: catch only review dispense/parse await.
- Risk: conflict with next ticket.
  Control: no general finally or arbitrary-settlement catch.
- Risk: commit Lisa-owned changes.
  Control: exact repeated `--include` paths through `lisa commit-ticket`.
