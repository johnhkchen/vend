# Progress — T-001-04 countable-run-log

Tracking against `plan.md`. All steps complete; `bun run check` green.

| Step | Description | Status |
|------|-------------|--------|
| 1 | Delete `src/log/.gitkeep` | ✅ done |
| 2 | Types, constants, pure helpers (`run-log.ts` §1–§3) | ✅ done |
| 3 | Pure `buildRunRecord` + `serializeRunRecord` (§4) | ✅ done |
| 4 | Thin impure `appendRunLog` (§5) | ✅ done |
| 5 | Verify failure path needs no special handling | ✅ done (structural, no branch) |
| 6 | Unit tests `run-log.test.ts` | ✅ done |
| 7 | Full gate + decoupling audit | ✅ done |

## What was built

- `src/log/run-log.ts` — module with:
  - constants `DEFAULT_RUN_LOG_PATH` (`.vend/runs.jsonl`), `RUN_OUTCOMES`,
    `RUN_LOG_SCHEMA_VERSION`;
  - types `RunOutcome`, `UsageInput`, `NormalizedUsage`, `GateResult`,
    `RunRecordInput`, `RunRecord`, `AppendRunLogOptions`;
  - pure helpers `num`, `assertNonEmpty`, `assertOutcome`, `normalizeUsage`,
    `normalizeGates` (not exported);
  - pure `buildRunRecord` (validate → normalize → freeze) and `serializeRunRecord`
    (`JSON.stringify + "\n"`);
  - impure `appendRunLog` (`mkdir -p` + `appendFile`), the one untested fs verb.
- `src/log/run-log.test.ts` — 19 tests over the two pure functions.
- `src/log/.gitkeep` — deleted.

## Verification

- `bun run check` → `tsc --noEmit` clean; `bun test` **65 pass / 0 fail** across 4
  files (19 new run-log tests + existing budget/claude/smoke suites still green).
- Decoupling grep: `run-log.ts` imports only `node:fs/promises` and `node:path`;
  no import from `src/executor/` or `src/budget/` (AC #4). Remaining grep hits are
  comment text only.
- Live append smoke (temp path): two `appendRunLog` calls → `wc -l` = 2,
  `jq -r '.outcome'` → `success` / `timed-out`; the failed `timed-out` run wrote a
  full record with usage zeroed and `gateResults: []` (AC #2).

## Deviations from plan

- **One:** `test.each(RUN_OUTCOMES)` failed `tsc` — a `readonly` tuple is not
  assignable to `test.each`'s mutable-array overloads. Fixed by spreading:
  `test.each([...RUN_OUTCOMES])`. No design impact; the source `RUN_OUTCOMES` stays
  `as const`. Everything else followed the plan exactly.

## Commit

Per CLAUDE.md and prior tickets' practice, the agent leaves the new files
untracked/staged; **Lisa owns the `git commit`**. Implement ends at a green
`bun run check`.
