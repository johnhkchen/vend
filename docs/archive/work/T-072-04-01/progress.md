# Progress — T-072-04-01

## Completed

- Read the assignment, AGENTS.md, RDSPI workflow, parent story, ticket, vision, stack, and charter.
- Mapped the cap from `DECOMPOSE_MAX_TURNS` through `resolveMaxTurns`, `Executor.dispense`, Claude argv, terminal result parsing, settlement output, and run-log persistence.
- Inspected the three successful ledger evidence runs:
  - E-068: `run-2026-07-11T17-21-36-240Z`, `turnsUsed: 17`.
  - E-069: `run-2026-07-11T18-44-19-106Z`, `turnsUsed: 16`.
  - E-072: `run-2026-07-13T02-00-52-016Z`, `turnsUsed: 18`.
- Counted corresponding transcript message shapes and established that each terminal `num_turns` equals one plus emitted user/tool-result messages.
- Confirmed the cap is passed correctly and that Claude uses a separate model-loop counter for `--max-turns` enforcement.
- Wrote Research, Design, Structure, and Plan artifacts before implementation.
- Added pure `formatTurnSummary` settlement formatting.
- Wired the cast shell to use distinct assistant/model responses as the cap-comparable numerator.
- Kept terminal `num_turns` unchanged in `turnsUsed` persistence, but labeled it separately as executor conversation events in stdout.
- Added a defensive formatter branch that cannot emit an over-cap same-unit fraction even for an anomalous/custom executor stream.
- Added characterization and invariant tests.

## Verification

Focused command:

`bun test src/engine/cast-core.test.ts src/engine/cast.test.ts`

Result:

- 74 passed.
- 0 failed.
- 229 expectations.

Authoritative command:

`bun run check`

Result:

- BAML generation succeeded.
- TypeScript `tsc --noEmit` succeeded.
- 1,662 tests passed.
- 1 integration test skipped because no `dist/` artifacts were present (the existing declared skip).
- 0 tests failed.
- 5,094 expectations completed.

Diff hygiene:

- `git diff --check` passed for all ticket-owned source paths.
- No ordinary `git add` or `git commit` was used.
- Concurrent changes in CLI/ticket/provenance/work paths were preserved and excluded.

## Commit

Committed through `lisa commit-ticket` with exact includes:

- `src/engine/cast-core.ts`
- `src/engine/cast-core.test.ts`
- `src/engine/cast.ts`

Commit:

`e11d07ff1bc78535158697ab34e876f277003b91`

Message:

`fix(engine): make turn-cap summary compare honest units`

## Deviations from plan

- No impure-shell stdout assertion was added. The requested invariant is directly pinned over the pure summary formatter, while the cast shell performs only plain-value wiring and one write. Existing cast tests exercised that wiring and remained green.
- Lisa published phase artifacts into the shared work path while the attempt continued. All authored writes were made only to the assignment's private attempt directory as required.

## Remaining

- Write the Review artifact.
- Stop on this ticket and wait for Lisa's admission/completion handling.

