# T-034-01 — Progress: history-audit-core

*Phase: Implement. What landed, against the Plan. Updated as steps complete.*

## Status: implementation complete, all checks green, committed.

| Plan step | Status | Notes |
|-----------|--------|-------|
| 1 — `classifyHistory` + types | ✅ done | `CommitResult`, `HistoryVerdict`, `summarySuffix`, three-branch ladder. |
| 2 — `boundRange` + bound consts | ✅ done | `DEFAULT_HISTORY_MAX=100`, `BoundOpts`, `RangeBound`, loud/quiet note. |
| 3 — `history-core.test.ts` | ✅ done | 14 tests, 2 `describe` blocks; all four AC cases + edges. |
| 4 — full check + atomic commit | ✅ done | `bun run check` green (939 pass); committed through the live E-033 gate. |

## What was built

- **`src/ci/history-core.ts`** (pure/total, zero imports):
  - `classifyHistory(results)` → `{ anyRed, redCount, report }`. Three exhaustive report shapes:
    honest-empty (`"no commits in range — nothing to audit"`), all-green tally, and a some-red ANDON
    report that names each red commit (`<sha> <subject>: <summary>`) in input order + a tally footer.
    `anyRed` is derived (`redCount > 0`), never tracked.
  - `boundRange(allShas, opts?)` → `{ covered, droppedCount, note }`. `covered` is a fresh prefix slice;
    the note is LOUD (`covered N of M (bounded at K — widen with <hint>)`) when commits are dropped,
    quiet-but-truthful otherwise. `DEFAULT_HISTORY_MAX = 100` is the single-source default (R12).
  - `summarySuffix` collapses a multi-line summary to one line and never leaks `"undefined"`.
- **`src/ci/history-core.test.ts`** — 14 pure tests.

## Verification

- `bun test src/ci/history-core.test.ts` → 14 pass / 0 fail / 46 expect calls.
- `bun run check` (baml:gen → `tsc --noEmit` → full `bun test`) → **939 pass / 0 fail** across 61 files.
  No sibling regressions; the new module typechecks and adds no `package.json` script (per the DAG,
  `check:history` is T-034-02).

## Deviations from the plan

- **None of substance.** Two small additions beyond the Plan's enumerated cases, both within the
  Design's stated intent:
  - Added a `multi-line summary collapses to one report line` test (exercises `summarySuffix`'s
    whitespace collapse — Design D4).
  - Added an `empty input under any bound` test for `boundRange` (confirms `droppedCount:0` + honest
    quiet note on `[]`, complementing the `classifyHistory([])` honest-empty case).
- The over-bound note format settled as `covered N of M (bounded at K — widen with <hint>)`; the
  default hint when no `widenHint` is supplied is `"a higher --max"`. Tests assert substrings, so the
  exact wording stayed flexible.

## Out of scope (untouched, per DAG)

`check-history.ts`, the `check:history` script, `git rev-list`, worktree building, and the
`buildCommittedHead` commit-ish generalization — all T-034-02. No `package.json` or sibling-core edits.
