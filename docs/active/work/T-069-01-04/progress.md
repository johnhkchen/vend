# Progress — T-069-01-04

## Current state

- Phase: Implement.
- Research complete: `research.md`.
- Design complete: `design.md`.
- Structure complete: `structure.md`.
- Plan complete: `plan.md`.
- Implementation is complete and fully gated.
- Review has not yet run.

## Selected implementation

- Add optional `agent` to the direct decompose `RunOptions`.
- Route it through a pure source adapter and `assembleInputs`.
- Extract the real decompose effect into an addon-free module.
- Pass `ctx.inputs.agent` into the dependency-provided materializer seat parameter.
- Relabel `UnknownSeatError` to `unknown-seat` effect data.
- Add `unknown-seat` to the run-log vocabulary.
- Test the real effect with known and unknown seats using temp filesystem fixtures.

## Completed implementation steps

1. Added `unknown-seat` to `RUN_OUTCOMES` and explicit run-log coverage.
2. Added the pure addon-free `contextSourcesForRun` direct-run adapter.
3. Added optional `agent` to `RunOptions`.
4. Switched `assembleAndCast` to transport `after` and `agent` through the adapter.
5. Extracted the real effect and Lisa validator into `decompose-effect.ts`.
6. Preserved `lisaValidate` and `ValidateResult` as re-exports from `decompose-epic.ts`.
7. Passed `ctx.inputs.agent` to `materialize`.
8. Relabeled only `UnknownSeatError` as `unknown-seat` effect data.
9. Added an injected validator seam whose production default remains the Lisa subprocess.
10. Added an addon-free test that drives the actual effect with `codex` and `gpt`.
11. Proved known-seat ticket bytes and unknown-seat zero-output behavior.
12. Ran typecheck, focused tests, diff checks, and the full repository gate.

## Remaining implementation steps

1. Commit the implementation unit and phase artifacts.
2. Perform final Review and write `review.md`.
3. Commit the review handoff.

## Worktree note

The worktree already contains Lisa-managed changes under `.lisa/`, active tickets, and newly
materialized epic/story files. They predate this implementation and are not owned by this ticket.
They will remain unstaged. The ticket's phase/status frontmatter will not be edited manually.

## Deviations

- The implementation followed the design and structure without behavioral deviations.
- The full repository gate was run before the implementation commit, rather than after it, to
  satisfy the repository rule that `bun run check` must be green before any commit.

## Verification log

- `bun run build` — PASS.
- Focused command — PASS, 163 tests, 0 failures:

```bash
bun test src/play/decompose-effect.test.ts src/play/agent-seat.test.ts \
  src/play/materialize.test.ts src/play/decompose-epic.test.ts src/log/run-log.test.ts
```

- `git diff --check` — PASS.
- `bun run check` — PASS.
- Full gate details: BAML generation PASS, TypeScript typecheck PASS, 1611 tests PASS,
  1 integration test skipped because no `dist/` artifacts exist, 0 failures.

## Acceptance status

- `RunOutcome` includes `unknown-seat`: met.
- Direct decompose run options accept `agent`: met.
- `agent: "codex"` reaches assembled `DecomposeInputs`: met.
- The real effect writes `agent: codex` on the ticket: met.
- The story remains unstamped: met.
- Unknown `gpt` returns `ok:false`, `outcome:"unknown-seat"`: met.
- Unknown seat creates neither output directory and invokes no validator: met.
