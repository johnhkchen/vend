# Plan — T-069-01-04

## Objective

Complete the direct decompose run's optional agent-routing path and its expected refusal contract.
A known `codex` seat must reach every materialized ticket. An unknown seat must be translated into
the named `unknown-seat` outcome before any file is written.

## Scope guard

- Modify the direct run option/input adapter.
- Modify the production decompose effect wiring.
- Extend the run-log outcome vocabulary.
- Add addon-free production-effect coverage.
- Do not parse CLI flags.
- Do not modify chain behavior.
- Do not add or rename seats.
- Do not modify Lisa dispatch.
- Do not edit ticket phase/status frontmatter.
- Do not stage unrelated board/provenance changes.

## Step 1 — establish implementation progress artifact

Create `docs/active/work/T-069-01-04/progress.md` before code changes.

Record:

- research/design/structure/plan completion;
- the selected addon-free effect extraction;
- remaining implementation steps;
- current unrelated worktree state.

Verification:

- The artifact exists.
- It does not claim implementation is complete.

## Step 2 — extend the run-log outcome vocabulary

Modify `src/log/run-log.ts`.

Actions:

1. Add `unknown-seat` to `RUN_OUTCOMES`.
2. Place it beside expected materializer refusals.
3. Extend the tuple documentation with the pre-write seat-guard meaning.
4. Keep `RUN_LOG_SCHEMA_VERSION` unchanged.

Modify `src/log/run-log.test.ts`.

Actions:

1. Add an explicit test that the tuple contains `unknown-seat`.
2. Rely on the existing tuple-driven acceptance test for full record construction.

Focused verification:

```bash
bun test src/log/run-log.test.ts
```

Expected result:

- The new literal is recognized by `buildRunRecord`.
- Unknown arbitrary literals still throw.

## Step 3 — add the pure direct-run source adapter

Modify `src/play/project-context.ts`.

Actions:

1. Add `RunContextSourceOptions`.
2. Add `contextSourcesForRun`.
3. Always copy `epicPath` and `projectRoot`.
4. Conditionally copy `after` when supplied.
5. Conditionally copy `agent` when supplied.
6. Do not validate seat membership here.
7. Document this as the pure adapter for direct run options.

Verification criteria:

- Supplied `agent: "codex"` is an own property on the result.
- Omitted `agent` is not an own property.
- Existing `assembleInputs` behavior remains unchanged.

The assertions will be included in the effect-level test so the tested adapter is also the one used
by production `assembleAndCast`.

## Step 4 — extract the decompose effect

Create `src/play/decompose-effect.ts`.

Actions:

1. Move `ValidateResult` from `decompose-epic.ts`.
2. Move `lisaValidate` without semantic changes.
3. Move `decomposeEffect` without changing graph/after behavior.
4. Export `decomposeEffect`.
5. Define and export `LisaValidator`.
6. Accept an optional validator argument defaulting to `lisaValidate`.
7. Preserve the validator failure behavior.
8. Preserve collision and bare-code relabel detail exactly.
9. Keep unexpected errors rethrown.
10. Use type-only imports for generated BAML and engine contracts.

Intermediate verification:

```bash
bun run build
```

This may not pass until the old module is rewired; use it after Step 5 if imports are temporarily
incomplete.

## Step 5 — add seat materialization and relabeling

Within `src/play/decompose-effect.ts`:

1. Import `UnknownSeatError`.
2. Pass `ctx.inputs.agent` as the fourth `materialize` argument.
3. Catch only `UnknownSeatError` for seat refusal.
4. Return `ok: false`.
5. Return `outcome: "unknown-seat"`.
6. Include the offending seat in `detail`.
7. Do not run the validator on rejection.
8. Do not perform cleanup because no target was created.

Verification criteria:

- A known seat goes through normal materialization and validation.
- An unknown seat is not rethrown.
- A filesystem failure still is rethrown.
- Existing expected errors retain their original outcomes.

## Step 6 — rewire the concrete play and run surface

Modify `src/play/decompose-epic.ts`.

Actions:

1. Remove effect-only `join` import.
2. Remove effect-only `WorkPlan` use only if still available through the play definition; the play
   continues to require its type.
3. Remove direct materializer/error imports.
4. Import `decomposeEffect` from the new module.
5. Re-export `lisaValidate` and `ValidateResult` from the new module.
6. Delete the old `ValidateResult`, `lisaValidate`, and `decomposeEffect` bodies.
7. Add `readonly agent?: string` to `RunOptions` with routing-seat documentation.
8. Import `contextSourcesForRun`.
9. Use it in `assembleAndCast`.
10. Pass `opts.after` and `opts.agent` into the adapter.
11. Leave the `castPlay` option object unchanged.

Verification:

```bash
bun run build
```

Expected result:

- `decomposeEffect` is assignable to the play effect signature.
- All existing imports resolve.
- `RunOptions` remains compatible at all call sites.

## Step 7 — add the real effect acceptance test

Create `src/play/decompose-effect.test.ts`.

Fixture steps:

1. Create isolated temp roots.
2. Write a minimal `docs/knowledge/charter.md`.
3. Write a minimal epic document at a temp path.
4. Use a graph-valid one-story/one-ticket plan.
5. Keep every BAML import type-only.
6. Assemble inputs through `contextSourcesForRun` and `assembleInputs`.
7. Inject a successful validator stub.

Known-seat test steps:

1. Construct run-shaped source options with `agent: "codex"`.
2. Assert the pure adapter owns `agent` with the correct value.
3. Assemble inputs.
4. Assert assembled inputs own `agent` with the correct value.
5. Call the real `decomposeEffect`.
6. Assert `{ ok: true }` and validator invocation.
7. Read the ticket file.
8. Assert the exact priority/agent/phase adjacency.
9. Assert exactly one `agent: codex` line.
10. Assert the story file has no agent line.

Unknown-seat test steps:

1. Construct source options with `agent: "gpt"`.
2. Assemble inputs.
3. Call the real effect with a validator spy.
4. Assert `ok === false`.
5. Assert `outcome === "unknown-seat"`.
6. Assert detail contains `gpt`.
7. Assert validator call count is zero.
8. Assert stories target does not exist.
9. Assert tickets target does not exist.

Optional omission assertion:

- Build adapter input without `agent`.
- Assert no own `agent` property before and after assembly.
- This pins the new direct-run adapter's compatibility behavior.

Focused verification:

```bash
bun test src/play/decompose-effect.test.ts
```

## Step 8 — run focused regression tests

Run:

```bash
bun test \
  src/play/decompose-effect.test.ts \
  src/play/agent-seat.test.ts \
  src/play/materialize.test.ts \
  src/play/decompose-epic.test.ts \
  src/log/run-log.test.ts
```

Verification criteria:

- Seat contract remains green.
- Direct materializer guard and stamping remain green.
- Decompose pure core remains green after extraction.
- Run-log validation remains green.
- New effect test is green.

If Bun's test runner exposes the documented BAML native issue, confirm the new test has no runtime
generated-client import before changing test execution strategy.

## Step 9 — inspect and update progress

Inspect:

```bash
git diff --check
git diff -- src/play src/log docs/active/work/T-069-01-04
git status --short
```

Record in `progress.md`:

- exact files changed;
- focused test results;
- any design deviations;
- remaining full-gate and commit work.

Do not include Lisa-managed ticket or provenance changes in the implementation commit.

## Step 10 — commit the implementation unit

Stage only:

- `src/play/decompose-effect.ts`;
- `src/play/decompose-effect.test.ts`;
- `src/play/decompose-epic.ts`;
- `src/play/project-context.ts`;
- `src/log/run-log.ts`;
- `src/log/run-log.test.ts`;
- phase artifacts through `progress.md` as appropriate.

Commit message:

```text
feat(play): relabel unknown decompose agent seats (T-069-01-04)
```

The pre-commit hook must run; do not bypass it.

## Step 11 — run the full repository gate

Run:

```bash
bun run check
```

This includes:

- BAML code generation;
- TypeScript typecheck;
- the full Bun test suite.

Verification criteria:

- Exit code 0.
- No generated unintended diff remains.
- All outcome-map consumers accept `unknown-seat`.
- No BAML reactor hang is introduced.

If the gate changes generated files, inspect whether they are legitimate before staging anything.

## Step 12 — finalize implementation progress

Update `progress.md` with:

- implementation commit hash;
- full gate command and result;
- final acceptance checklist;
- deviations, if any;
- confirmation that ticket frontmatter was not edited.

If this update changes the artifact after the implementation commit, commit it with the review
handoff rather than amending unrelated code history.

## Step 13 — review the completed diff

Review:

```bash
git show --stat --oneline HEAD
git diff HEAD -- docs/active/work/T-069-01-04
git status --short
```

Check manually:

- `agent` is optional at every transport boundary.
- raw unknown values reach the write guard.
- only `UnknownSeatError` becomes `unknown-seat`.
- zero-write refusal is tested against both directories.
- known-seat effect success is tested against actual bytes.
- validator is not called for refusal.
- outcome documentation is updated.
- unrelated board files are not in the ticket commit.

## Step 14 — write review artifact

Create `docs/active/work/T-069-01-04/review.md`.

Include:

- outcome and acceptance result;
- files created/modified/deleted;
- behavior summary;
- test coverage and exact commands;
- full-gate result;
- commits;
- compatibility notes;
- open concerns and honest boundary;
- unrelated worktree state preserved.

If acceptance is not met or the gate is red, say so plainly and stop without claiming completion.

## Step 15 — commit the handoff artifact

Stage only updated `progress.md` and new `review.md`.

Commit message:

```text
docs(T-069-01-04): complete review handoff
```

Allow the pre-commit hook to run.

After this commit, verify repository status and stop. Lisa handles phase/status transitions.

## Acceptance traceability

| Acceptance clause | Implementation | Proof |
|---|---|---|
| `RunOutcome` includes `unknown-seat` | `RUN_OUTCOMES` tuple | run-log explicit + tuple-driven tests |
| run option carries `agent` | `RunOptions` + `contextSourcesForRun` | adapter/input assertions |
| `ctx.inputs.agent:"codex"` reaches materialize | fourth materialize argument | real effect success test |
| tickets carry `agent: codex` | dependency materializer behavior | read actual ticket bytes |
| unknown seat returns `ok:false` | typed catch arm | real effect refusal test |
| outcome is `unknown-seat` | catch arm + tuple | exact result assertion |
| zero files written | materializer first guard | both output dirs remain absent |
| no hand editing | runtime data path | fixture assembles input and drives effect |

## Stop conditions

- Stop and report red if `bun run check` fails due to this change and cannot be repaired in scope.
- Stop and report a dependency mismatch if `UnknownSeatError` or the optional materializer argument
  is absent; current research confirms both are present.
- Do not broaden into CLI work if downstream compile errors merely show the CLI has not threaded the
  option yet; optional fields should avoid that dependency.
- Do not modify Lisa-managed board state to clean the worktree.

## Planned commit units

1. Implementation, tests, and pre-review work artifacts.
2. Final progress and review handoff.

This is small enough to remain reviewable while satisfying the workflow's requirement that done
means committed and the implementation is gated before handoff.
