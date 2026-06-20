# T-034-02 — Progress

## Status: implementation complete, all ACs proven, ready to commit

## Steps (per plan.md)

- [x] **Step 1 — Generalize `buildCommittedHead` to a commit-ish.** Added `commitish?: string`
  (default `"HEAD"`) to `HeadBuildOptions`; `buildCommittedHead` resolves it and passes it to
  `git worktree add --detach <worktree> <commitish>` instead of the `"HEAD"` literal. Doc comment
  updated to note the dual role and the retained `vend-head-` prefix. **AC#2 proven:**
  `head-build-core.test.ts` 10/10 green unchanged; live `bun run check:head` → exit 0
  ("ok — committed HEAD builds").
- [x] **Step 2 — `src/ci/check-history.ts`.** Thin impure verb with the CENTRAL-RULE header. Exports
  `resolveRange` (git rev-list → ordered shas | error), `parseArgs` (range + `--max`), `sweepCommits`
  (per-sha: subject via `git log -1 --format=%s`, build via generalized `buildCommittedHead`, flatten
  via `classifyBuildOutcome` → `CommitResult`), and an `import.meta.main` block wiring
  resolveRange → boundRange (loud note) → sweepCommits → classifyHistory → print → exit
  (0 clean / 1 red / 2 env error).
- [x] **Step 3 — `package.json`.** Added `"check:history": "bun run src/ci/check-history.ts"`.
- [x] **Step 4 — `src/ci/check-history.test.ts`.** 10 tests: synthetic multi-commit sweep (red flagged
  with subject+summary, all-green range, no-worktree-leak), `parseArgs` (4 cases), `resolveRange`
  ordering + non-repo error, `boundRange` loud cap. Offline (`install: null`), sub-second.
- [x] **Step 5 — Live proofs + gates** (below).

## Deviation from plan — AC#3's named red commit is NOT actually red

The ticket names `3dfb95f` (T-031-01) as "known-red" and asks the live audit to flag it. **Built in a
clean isolated worktree — exactly how E-010/E-034 define "does this commit build+test" — `3dfb95f`
is GREEN** (871 pass, 0 fail; confirmed both via `check:history '3dfb95f~1..3dfb95f'` → exit 0, and
via a manual `git worktree add 3dfb95f && bun install && bun run check` → exit 0). The "red" label in
the ticket/memory was relative to a transient working-tree state at the time (cf. the T-033-02
observations about tree-state-sensitive failures when an untracked file is present), not a property of
the clean commit. This is a faithful finding, not a defect in the sweep — and is itself a useful
audit result: history is clean at that commit.

**How the red path was proven instead** (the machinery is correct): (a) the deterministic
`check-history.test.ts` synthetic sweep flags a genuinely red commit with its subject + failure
summary, offline; (b) an **end-to-end live CLI run** against a throwaway scratch repo (created in
`/tmp`, discarded after — `main` untouched) with a deliberately red commit:
```
history: ANDON — 1 of 2 commit(s) are red:
  e7c2631… red: regression slipped in: check:head: HEAD does not build from a clean checkout
           (E-007 class): … (fail) regression … Expected: 3 Received: 2 … exited with code 1
history: 1 of 2 commit(s) red — audit failed
```
and a red-only scratch range exited **code 1** (verified directly, not through a pipe). So AC#3's
intent — "a red commit in range is flagged, naming the failing test, and the audit exits non-zero" —
is fully proven; only the *specific sha* the ticket cited turned out green.

## Live proofs captured

| AC#3 clause | Proof | Result |
|---|---|---|
| Red commit flagged, names failing test, exit non-zero | scratch-repo live CLI run | ANDON report names `regression` test + `Expected 3 Received 2`; exit **1** |
| Known-green range reports clean | `check:history '3dfb95f~1..3dfb95f'` and `--max 1` | "ok — all 1 commit(s) test-green", exit 0 |
| Bound note appears when capped | `check:history --max 1` over 246-commit history | "history: covered 1 of 246 (bounded at 1 — widen with a higher --max …)" |
| `check:head` unchanged | `bun run check:head` | "ok — committed HEAD builds", exit 0 |

## Gate status

- `bun run check:typecheck` → clean.
- `bun test` (= `check:test`) → **949 pass, 0 fail** (was 945 pre-`parseArgs` tests; +4).
- `bun run check:head` → exit 0.
- `bun run check:committed` will pass once this slice is committed (currently reports the in-flight
  uncommitted source, as expected pre-commit).

## Notes

- Sequential by design (parallelism is a stated non-goal). Cost ≈ worktree + install + build per
  commit; this is a periodic/CI audit, not the hot path.
- `--max` was added (beyond the literal ticket text) because `history-core`'s `widenHint` default
  already advertises "a higher --max"; it also makes the loud bound note demonstrable for ~1 build
  instead of 100.
