# Progress — T-081-01-02

## Status

Implementation is complete in three ticket-owned commits. Focused run-log coverage is green and the
updated T-077 seam test passes. The first full `bun run check` completed code generation and
typecheck, then reported five test expectation failures caused by concurrent, uncommitted
`T-081-02-01` changes in `src/engine/cast-core.ts`. That sibling-owned file is intentionally
untouched. Final green-gate verification remains pending its atomic source/test settlement.

## Completed phases

- Research: complete (`research.md`).
- Design: complete (`design.md`).
- Structure: complete (`structure.md`).
- Plan: complete (`plan.md`).
- Implement: source changes complete; final shared-worktree gate rerun pending.
- Review: pending final gate.

## Step 1 — run-log schema

Completed in `src/log/run-log.ts`.

- Redefined new-write `turnsUsed` as distinct deduplicated agent turns.
- Documented that this is the same unit the summary prints and `--max-turns` caps.
- Added the explicit schema note for pre-E-081 rows.
- The note states historical `turnsUsed` values came from terminal `result.num_turns`.
- The note states revival preserves those old numbers rather than migrating their unit.
- Added optional `executorReportedTurns` to `RunRecordInput`.
- Added optional `executorReportedTurns` to `RunRecord`.
- Documented that the new field is terminal executor telemetry and is not cap-comparable.
- Renamed the shared structural helper to `normalizeTurnCount`.
- Both turn fields accept finite non-negative integers.
- Both retain zero.
- Both omit absence and malformed values.
- Build normalizes and spreads both independently.
- Revive normalizes and spreads both independently.
- Revive never infers the executor field from historical `turnsUsed`.

## Step 2 — run-log tests

Completed in `src/log/run-log.test.ts`.

- Retained `turnsUsed` positive round-trip coverage.
- Retained `turnsUsed: 0` value coverage.
- Retained absent-field omission coverage.
- Retained invalid-build normalization coverage.
- Retained malformed-revive tolerance coverage.
- Added positive `executorReportedTurns` build/serialize/revive coverage.
- Added `executorReportedTurns: 0` presence and round-trip coverage.
- Added absent executor-field omission coverage.
- Added invalid executor-field build coverage.
- Added malformed executor-field revive coverage.
- Added a literal pre-E-081 JSONL row with `turnsUsed: 23`.
- Proved it revives with the old numeric value unchanged.
- Proved it does not synthesize `executorReportedTurns`.
- Proved serialization after revive is byte-identical to the literal line.
- Extended the pre-T-015 line assertion to cover absence of both keys.

Focused command:

```text
bun test src/log/run-log.test.ts
```

Result:

```text
132 pass
0 fail
306 expect() calls
```

Whitespace verification:

```text
git diff --check -- src/log/run-log.ts src/log/run-log.test.ts
```

Result: pass.

## Commit 1

```text
c175c10 fix(log): separate capped and executor turn counts
```

Committed through `lisa commit-ticket` with exact includes:

- `src/log/run-log.ts`
- `src/log/run-log.test.ts`

## Step 3 — cast ledger mapping

Completed in `src/engine/cast.ts`.

- New-write `turnsUsed` comes from `progress.turns`.
- A cold cast retains known zero rather than omitting it.
- A timed-out cold cast retains the streamed observed count.
- A resume omits `turnsUsed` because it performs no new executor dispense.
- Early pre-dispense missing-capability rows remain unchanged and omit turn facts.
- Terminal `result.num_turns` remains validated through `resolveTurnsUsed`.
- Its local is now honestly named `executorReportedTurns`.
- The final summary continues to receive `progress.turns` as agent turns.
- The final summary receives terminal telemetry under `executorReportedTurns`.
- The ledger append spreads both facts independently.
- Zero-preserving `!== undefined` checks are used.
- No fold, cap-resolution, usage, classification, or settlement policy changed.

## Step 4 — T-077 seam characterization

Completed in `src/engine/cast.test.ts`.

- Renamed the test to state the E-081 separated-unit contract.
- Retained the 15 distinct assistant IDs and one repeated stream block.
- Retained terminal `num_turns: 23` and `error_max_turns`.
- Retained exact `--max-turns 15` argv assertion.
- Retained summary `agent turns: 15 / 15 cap; executor conversation events: 23`.
- Retained the negative assertion that 23 is never rendered against the 15 cap.
- Retained transcript, effect, outcome, and recovery assertions.
- Changed the ledger assertion deliberately from old `turnsUsed: 23`.
- The ledger now asserts `turnsUsed` equals the deduplicated transcript ID set size.
- The ledger pins that size at 15.
- The ledger separately pins `executorReportedTurns: 23`.

Focused command:

```text
bun test src/engine/cast.test.ts
```

Observed result:

- Updated E-081/T-077 seam test: pass.
- 24 tests passed in the file.
- One T-072 progress golden failed because the concurrently edited sibling `cast-core.ts` now
  renders `weighted tokens` and terminal-reconciled spend while its sibling-owned test update had
  not yet landed.
- This ticket did not edit the failing progress golden or sibling core.

Whitespace verification:

```text
git diff --check -- src/engine/cast.ts src/engine/cast.test.ts
```

Result: pass.

## Commit 2

```text
544d2d2 fix(engine): persist agent turns in capped unit
```

Committed through `lisa commit-ticket` with exact includes:

- `src/engine/cast.ts`
- `src/engine/cast.test.ts`

## Step 5 — kitchen gold-master query

Completed in `examples/templates/kitchen-seed/EXPECTED-OUTCOME.md`.

- Preserved the success-row projection.
- Preserved play, outcome, envelope, usage, and primary `turnsUsed` fields.
- Added `executorReportedTurns` beside the corrected primary field.
- Did not rewrite unrelated frozen-outcome prose.

Verification:

```text
169: ... {play,outcome,env:.envelope,usage,turnsUsed,executorReportedTurns} ...
```

`git diff --check` passed.

## Commit 3

```text
b575911 docs(kitchen): inspect separate turn counters
```

Committed through `lisa commit-ticket` with exact include:

- `examples/templates/kitchen-seed/EXPECTED-OUTCOME.md`

## Full gate — first run

Command:

```text
bun run check
```

Completed stages:

- BAML client generation: pass.
- TypeScript `tsc --noEmit`: pass.
- Full tests: 1,942 pass, 1 skip, 5 fail.

All five failures are progress-output expectations affected by the concurrent sibling edit:

- one in `src/engine/cast.test.ts` at the T-072 refreshing-line golden;
- four in `src/engine/cast-core.test.ts` under cast progress.

The observed received output includes the sibling ticket's new `weighted tokens` label and terminal
reconciliation, while the expectations still describe the pre-change fold. The shared worktree at
the time showed:

```text
M src/engine/cast-core.ts
```

and did not yet show its matching sibling test update. This is a transient cross-ticket worktree
state, not a reason to absorb the sibling files into this ticket.

## Plan deviation

The plan expected focused cast tests to be wholly green before Commit 2. One unrelated golden was
red because a sibling ticket was mid-unit in the shared worktree. The E-081 seam test itself passed,
the ticket-owned diff was clean, and exact-path Lisa commit isolation was available, so the ticket
unit was committed without touching or staging sibling work.

This deviation preserves the story DAG's file ownership:

- this ticket owns `cast.ts` ledger mapping;
- `T-081-02-01` owns `cast-core.ts` fold/formatter changes.

Final review cannot pass until `bun run check` is rerun green after the sibling settles.

## Worktree audit after ticket commits

Ticket-owned repository files are committed and clean.

Remaining visible changes are orchestration/sibling owned:

- `.lisa/provenance.jsonl` — Lisa;
- `docs/active/tickets/T-081-01-02.md` — Lisa phase/lease state;
- `docs/active/tickets/T-081-02-01.md` — Lisa sibling phase/lease state;
- `src/engine/cast-core.ts` — concurrent sibling ticket;
- shared `docs/active/work/T-081-01-02/` publication — Lisa;
- shared `docs/active/work/T-081-02-01/` publication — Lisa.

No ticket-owned file is staged, modified, or untracked.

## Remaining

Completed after the first gate observation:

1. The sibling ticket atomically committed its fold, fixture, and golden updates as
   `e0c2bcd fix(cast): reconcile live weighted spend`.
2. The shared worktree then contained no modified source or test files.
3. `bun run check` was rerun against that settled combined state.
4. BAML generation passed.
5. TypeScript `tsc --noEmit` passed.
6. Full tests passed: 1,949 pass, 1 skip, 0 fail, 6,419 expectations across 126 files.
7. The skip is the existing dist-only integration test, which names `just release-local` as its
   opt-in condition; it is unrelated to this ticket.
8. `git diff --check` passed on the final worktree.
9. Ticket-owned repository files remain committed and clean.

## Final gate

```text
bun run check

1949 pass
1 skip
0 fail
6419 expect() calls
Ran 1950 tests across 126 files.
```

## Final acceptance audit

- Stub cast ledger `turnsUsed` equals deduplicated transcript assistant IDs: pass.
- Stub cast ledger `turnsUsed` equals the summary/cap agent-turn figure 15: pass.
- Terminal executor `num_turns: 23` is retained as `executorReportedTurns: 23`: pass.
- `turnsUsed` build/revive positive round-trip: pass.
- `turnsUsed: 0` is a value: pass.
- Unknown/malformed `turnsUsed` is omitted: pass.
- `executorReportedTurns` build/revive positive round-trip: pass.
- `executorReportedTurns: 0` is a value: pass.
- Unknown/malformed `executorReportedTurns` is omitted: pass.
- Literal pre-E-081 old-unit row revives and serializes byte-identically: pass.
- Historical revival does not synthesize the new executor key: pass.
- Schema note documents the old unit and no-rewrite policy: pass.
- T-077 characterization changed deliberately to the new two-key contract: pass.
- Kitchen seed jq projection reads `executorReportedTurns`: pass.
- `bun run check`: pass.

## Implement outcome

Complete. No implementation step remains. Proceeding to Review.
