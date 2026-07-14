# T-034-02 — Review: `check-history` sweep

## What changed

The impure verb that turns T-034-01's pure core into a runnable backward audit — E-034's post-hoc
"every commit was test-green" check, the complement to E-033's forward pre-commit gate. Committed at
`5f03484` through the E-033 pre-commit gate ("precommit: ok — tests green").

### Created
- **`src/ci/check-history.ts`** (160 lines) — thin impure verb. Exports:
  - `resolveRange(root, range?)` → `{shas}` | `{error}`: `git rev-list <range ?? HEAD>` → ordered
    (newest-first) sha list, or an environment error (returned data, never thrown).
  - `parseArgs(argv)` → `{range?, max?}`: pure CLI parse for `[<range>] [--max <n>]` (`--max=<n>` too).
  - `sweepCommits(opts)` → `Promise<CommitResult[]>`: the integration seam. Per sha, sequentially:
    subject via `git log -1 --format=%s`, build+test via the generalized `buildCommittedHead`, flatten
    via `classifyBuildOutcome` (`green = verdict.ok`, `summary = message` on failure).
  - `import.meta.main`: resolveRange → boundRange (loud note) → sweepCommits → classifyHistory →
    print → exit (0 clean / 1 any-red / 2 env error). Smoke-only, proven by the live run.
- **`src/ci/check-history.test.ts`** (163 lines) — 10 integration tests, offline (`install: null`),
  sub-second: synthetic multi-commit sweep (red flagged with subject+summary; all-green range;
  no worktree leak), `parseArgs` (4), `resolveRange` ordering + non-repo error, `boundRange` loud cap.

### Modified
- **`src/ci/check-head.ts`** — `buildCommittedHead` generalized: new `commitish?: string` option
  (default `"HEAD"`) threaded into `git worktree add --detach <worktree> <commitish>`. Doc comments
  updated. With the default it is the E-010 builder byte-for-byte; with a sha it is the per-commit
  audit builder. The `vend-head-` temp prefix is intentionally retained.
- **`package.json`** — added `"check:history": "bun run src/ci/check-history.ts"`.

## Acceptance criteria

- **AC#1 — sweep resolves range, bounds loudly, builds+tests each commit in an isolated worktree,
  reports via `classifyHistory`, exits non-zero on red.** ✅ Implemented end-to-end; live red run
  exited 1 with an ANDON report; bound note shown loudly under `--max 1`.
- **AC#2 — `buildCommittedHead` generalized to a commit-ish (default HEAD); `check:head` unchanged,
  tests stay green.** ✅ `head-build-core.test.ts` 10/10 unchanged green; `bun run check:head` → exit
  0. Back-compat holds by construction (defaulted optional param).
- **AC#3 — live proof: red flagged (naming the test), green clean, bound note appears; `check:*`
  green.** ✅ with one substantive caveat (below).

## ⚠️ Caveat needing reviewer attention — AC#3's named commit is not red

The ticket cites `3dfb95f` (T-031-01) as "known-red" and expects the audit to flag it. **Built in a
clean isolated worktree — the very definition the audit uses — `3dfb95f` is GREEN** (871 pass, 0 fail;
confirmed two independent ways: `check:history '3dfb95f~1..3dfb95f'` → exit 0, and a manual
`git worktree add 3dfb95f && bun install && bun run check` → exit 0). The "red" label was relative to
a transient working-tree state, not a property of the clean commit (cf. T-033-02's tree-state-sensitive
failure notes).

This is reported faithfully rather than worked around. The audit *machinery* is proven correct two
ways: (1) the deterministic synthetic sweep in `check-history.test.ts` flags a genuinely red commit
with its failing-test summary; (2) an **end-to-end live CLI run** against a throwaway `/tmp` scratch
repo with a real red commit produced the ANDON report (naming the `regression` test, `Expected 3
Received 2`) and exited **code 1** (verified directly). `main` was untouched. So AC#3's *intent* is
fully met; only the specific sha turned out green — which is itself a valid audit result (history is
clean there). **No action needed unless a reviewer wants a different, genuinely-red historical sha
substituted into the ticket's example.**

## Test coverage

- Pure verdict/bound logic: `history-core.test.ts` (T-034-01), unchanged.
- Commit-ish worktree build + flatten: `check-history.test.ts` synthetic sweep.
- CLI arg parsing: `parseArgs` unit tests.
- `check:head` back-compat: `head-build-core.test.ts` unchanged green.
- End-to-end CLI (exit codes, ANDON report): live scratch-repo runs (documented in `progress.md`).
- Full suite: **949 pass, 0 fail** (+4 from new `parseArgs` tests).

**Gaps (acceptable):** the `import.meta.main` wiring is covered by live runs, not an automated test
(spawning the real CLI with full `bun install` per commit is too costly for CI — the same tradeoff
`check-head.ts`'s main block makes). `resolveRange`'s `git log` subject-fallback ("(unknown subject)")
is defensive and not unit-exercised.

## Open concerns / limitations

- **Cost:** each commit ≈ worktree + `bun install` + full `check`. A default-bound (100-commit) sweep
  is minutes-scale — by design a periodic/CI audit, not a per-turn hook. Parallelism is a stated
  non-goal of this slice and a natural follow-up if cost bites.
- **Env error vs red conflation:** a commit whose worktree/preflight step fails (not a test failure)
  is currently counted as not-green (`verdict.ok === false`) and surfaces in the red list with its
  message. This is intentional for v1 (a commit that can't even be built is an audit failure) but a
  future refinement could separate "couldn't build" from "tests red", mirroring head-build's 2-vs-1.
- **Default range `HEAD`:** chosen over `main..HEAD` (which is empty on `main`); last-N via the bound
  is the sensible default. Callers wanting a span pass it explicitly.

## Suggested follow-ups (not in scope)

1. Wire `check:history` into a periodic CI/lisa trigger (the natural E-034 closing slice).
2. Consider correcting the ticket's AC#3 example sha (or noting `3dfb95f` is green) for the record.
