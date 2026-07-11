# Plan — T-068-02-02: classify-warn-not-discard

## Objective

Change both pure classifiers so an explicitly gates-cleared, token-exhausted run is a successful
materializing verdict carrying `overEnvelope: true`, while timeout, gate stop, and exhausted
without clear remain non-materializing.

Keep the runner and durable record wiring for T-068-02-03.

## Acceptance mapping

The ticket's exhausted-plus-clear criterion maps to direct unit assertions in both classifier
test files.

The gate-stop preservation criterion maps to both in-budget and exhausted-plus-stop assertions.

The timeout preservation criterion maps to the existing timeout tests plus warning absence.

The over-envelope warning maps to the new optional literal field on both `Verdict` interfaces.

The “unit tests in both pure cores green” criterion maps to a focused two-file Bun test command.

Repository completion maps to `bun run check`.

## Step 1 — Commit phase artifacts

Stage only:

- `docs/active/work/T-068-02-02/research.md`;
- `docs/active/work/T-068-02-02/design.md`;
- `docs/active/work/T-068-02-02/structure.md`;
- `docs/active/work/T-068-02-02/plan.md`.

Do not stage the Lisa-managed ticket frontmatter or unrelated board changes.

Review the staged diff for phase ordering, scope, and consistency.

Commit the pre-implementation decision record as one documentation unit.

Suggested commit:

```text
docs(T-068-02-02): design warned overshoot classification
```

Verification:

- all four files exist under the ticket work directory;
- design explicitly settles recalibration semantics;
- structure and plan exclude runner wiring;
- `git diff --cached --name-only` contains only the four artifact paths.

## Step 2 — Add generic classifier expectations

Modify `src/engine/cast-core.test.ts` before production code.

Update the exhausted-plus-clear test to expect:

```ts
expect(v.outcome).toBe("success");
expect(v.materialize).toBe(true);
expect(v.overEnvelope).toBe(true);
```

Also assert its gate rows retain the existing clear evidence where the fixture supplies names.

The existing opaque clear fixture may continue to produce an empty gate log.

Add exhausted-plus-stop coverage:

```ts
classify({ timedOut: false, budgetOutcome: exhausted, gateVerdict: stopped })
```

Expected result:

- `gate-failed`;
- no materialization;
- warning absent;
- one failed gate row.

Add exhausted-plus-null coverage:

```ts
classify({ timedOut: false, budgetOutcome: exhausted, gateVerdict: null })
```

Expected result:

- `budget-exhausted`;
- no materialization;
- warning absent;
- no gate rows.

Strengthen timeout and ordinary success tests with warning-absence assertions.

Verification at this step is deferred until both mirror test files are updated so one red command
captures the whole desired contract.

## Step 3 — Add decompose classifier expectations

Modify `src/play/decompose-epic.test.ts` with the equivalent matrix.

Update exhausted-plus-clear to expect:

- `success`;
- materialization;
- `overEnvelope: true`;
- four passed gate rows.

Add exhausted-plus-stop to expect:

- `gate-failed`;
- no materialization;
- warning absent;
- the existing detailed failed row.

Add exhausted-plus-null to expect:

- `budget-exhausted`;
- no materialization;
- warning absent;
- no gate rows.

Strengthen timeout and ordinary clear with warning absence.

Keep all generated BAML imports type-only.

## Step 4 — Capture the focused red proof

Run:

```bash
bun test src/engine/cast-core.test.ts src/play/decompose-epic.test.ts
```

Expected red behavior before production changes:

- TypeScript/test errors or failed expectations show that `Verdict` has no `overEnvelope` field;
- exhausted-plus-clear still returns `budget-exhausted` and no materialization;
- exhausted-plus-stop still returns budget exhaustion under the old priority;
- exhausted-plus-null continues to pass its preserved expectation.

Record the exact result in `progress.md`.

The purpose is to show the new tests detect the missing disposition, not to obtain a green run at
this point.

If failures are unrelated to these expectations, investigate before implementation.

## Step 5 — Implement the generic verdict

Modify `src/engine/cast-core.ts`.

Add:

```ts
readonly overEnvelope?: true;
```

to `Verdict` with a concise invariant comment.

Update `ClassifyInput` comments so exhausted-plus-clear is a valid pure state.

Rewrite `classify` in this order:

1. timeout;
2. gate stop;
3. exhausted plus clear → success/materialize/warning;
4. exhausted without clear → budget-exhausted/no materialize;
5. ordinary success.

Keep `castGateRows` untouched.

Keep every non-warning object free of an `overEnvelope` property.

Update the classification documentation to explain that the warning records a contract breach
and that clear gates are required.

## Step 6 — Implement the decompose verdict mirror

Modify `src/play/decompose-epic-core.ts` in the same implementation unit.

Add the identical optional literal field to its local `Verdict` interface.

Update gate-result comments to admit the new combined state.

Rewrite `classify` with the same semantic precedence.

Use `isStop` for concrete gate narrowing.

Keep `gateRowsFor` untouched.

Review both classifier functions side by side after editing.

Equivalent state combinations must produce equal outcome, materialize, and warning values.

The only expected gate-log difference is the existing opaque-vs-concrete clear representation.

## Step 7 — Run focused verification

Run:

```bash
bun test src/engine/cast-core.test.ts src/play/decompose-epic.test.ts
```

Required result:

- zero failures;
- both exhausted-plus-clear tests pass;
- both stop-preservation tests pass;
- both timeout tests pass;
- both exhausted-null tests pass;
- all unrelated pure-core tests in these files remain green.

Then run a typecheck:

```bash
bun run check:typecheck
```

This catches structural consumers of the extended verdict type without waiting for the full gate.

Record command results and counts in `progress.md`.

## Step 8 — Inspect implementation diff

Use a path-limited diff covering:

- both classifier cores;
- both test files;
- this ticket's work artifacts.

Confirm:

- no runner file changed;
- no run-log or recalibration file changed;
- no ticket frontmatter changed by this work;
- both interfaces use optional literal true;
- gate stop is checked before the special overshoot branch;
- null gates cannot authorize exhausted output;
- comments no longer assert the old exhaustion-first behavior.

Update `progress.md` with completed steps and any deviations before committing.

## Step 9 — Commit implementation and progress

Stage only:

- `src/engine/cast-core.ts`;
- `src/engine/cast-core.test.ts`;
- `src/play/decompose-epic-core.ts`;
- `src/play/decompose-epic.test.ts`;
- `docs/active/work/T-068-02-02/progress.md`.

Review `git diff --cached`.

Commit as one coherent mirror change because either classifier landing alone would create behavior
drift.

Suggested commit:

```text
feat(cast): warn and materialize cleared overshoots (T-068-02-02)
```

The repository pre-commit hook is expected to run tests.

Do not bypass it.

## Step 10 — Run the full repository gate

Run:

```bash
bun run check
```

Required result:

- BAML generation succeeds;
- TypeScript checking succeeds;
- full Bun test suite has zero failures.

Record exact pass/skip/fail counts in `progress.md` or `review.md`.

If the gate fails because of this ticket, fix, rerun focused checks, amend through a new commit, and
rerun the full gate.

If it fails only because of unrelated shared-worktree changes, diagnose and report honestly; do not
discard other agents' work.

## Step 11 — Review acceptance and boundaries

Compare the final implementation against the parent story and ticket.

Verify the matrix directly:

| Case | Expected |
|---|---|
| exhausted + clear | success, materialize, warning |
| exhausted + stop | gate-failed, discard, no warning |
| exhausted + null | budget-exhausted, discard, no warning |
| timed out | timed-out, discard, no warning |
| in-budget + clear | success, materialize, no warning |

Confirm recalibration behavior by code inspection:

- successful warned runs enter the finishing-cost sample;
- no recalibration source edit is needed;
- the durable marker remains available for separate counting.

Confirm the honest boundary:

- pure classification is implemented;
- no live runner can exercise exhausted-plus-clear until T-068-02-03;
- no claim of fixture proof is made by this ticket.

## Step 12 — Write and commit `review.md`

Create `docs/active/work/T-068-02-02/review.md` with:

- change summary;
- commits;
- file-by-file details;
- acceptance assessment;
- focused and full test evidence;
- coverage strengths and gaps;
- architectural assessment;
- recalibration decision;
- open concerns for T-068-02-03.

Stage only `review.md` plus any final `progress.md` update needed to record the full gate.

Commit the handoff artifact without changing ticket frontmatter.

Suggested commit:

```text
docs(T-068-02-02): complete review handoff
```

The pre-commit hook must remain enabled.

After the review artifact is written, committed, and the gate is green, stop.

Lisa handles phase and status transitions.

## Testing strategy summary

Unit coverage is the primary proof because the ticket changes pure decision functions.

The two mirrored suites directly pin every policy branch affected by the new precedence.

Existing tests in the same files provide regression coverage for gate-row translation, tooling,
formatting, normalization, and decompose pure helpers.

Typecheck verifies the additive verdict contract across consumers.

The full gate catches cross-module regressions.

Fixture-level runner proof is intentionally deferred to T-068-02-03, where parsing exhausted
output, running gates, materializing files, stamping the record, and surfacing the warning can be
verified as one effectful path.
