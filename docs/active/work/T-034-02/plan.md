# T-034-02 — Plan: `check-history` sweep

Ordered, independently-verifiable steps. Each is a clean commit boundary; the suite stays green
throughout (E-033's pre-commit gate is live and will block any red commit).

## Step 1 — Generalize `buildCommittedHead` to a commit-ish

**Change** `src/ci/check-head.ts`:
- Add `commitish?: string` to `HeadBuildOptions` with a doc comment ("Default `\"HEAD\"` — keeps
  check:head unchanged").
- In `buildCommittedHead`: `const commitish = opts.commitish ?? "HEAD";`, and use `commitish` in the
  `git … worktree add --detach <worktree> <commitish>` invocation instead of the literal `"HEAD"`.
- Note in the function comment that the `vend-head-` temp prefix is retained for any commit-ish.

**Verify:** `bun test src/ci/head-build-core.test.ts` — all existing cases green (default `commitish`
preserves behaviour). This is the proof for **AC#2**.

**Testing strategy:** no new test needed yet for the parameter itself — Step 4's synthetic
multi-commit sweep exercises non-HEAD commit-ishes end-to-end, which is the meaningful coverage.

## Step 2 — Create `src/ci/check-history.ts`

Write the thin verb with the full header comment, then three parts:

- `resolveRange(root: string, range?: string): { shas: string[] } | { error: string }`
  - `git -C <root> rev-list <range ?? "HEAD">`; on non-zero exit, return `{ error: tail(stderr) }`.
  - Split stdout on newlines, drop blanks → ordered shas (newest-first).
- `interface HistorySweepOptions { root; shas; install?; check? }` and
  `sweepCommits(opts): Promise<CommitResult[]>`
  - For each sha (sequential `for…of`): `git log -1 --format=%s <sha>` → subject; call
    `buildCommittedHead({ root, commitish: sha, install, check })`; `classifyBuildOutcome(outcome)` →
    `{ sha, subject, green: verdict.ok, summary: verdict.ok ? undefined : verdict.message }`.
- `import.meta.main`:
  - Resolve repo top via `git rev-parse --show-toplevel` (exit 2 on failure, sibling-consistent).
  - `const rangeArg = process.argv[2];` → `resolveRange`; on `error`, stderr + exit 2.
  - `boundRange(shas, { widenHint: "check:history <wider-range>" })` → print `note` (always).
  - `sweepCommits({ root, shas: bound.covered })` → `classifyHistory` → print `report`.
  - `process.exit(verdict.anyRed ? 1 : 0)`.

**Verify:** `bun run check:typecheck` clean; manual smoke deferred to Step 5.

## Step 3 — Register the `check:history` script

**Change** `package.json`: add `"check:history": "bun run src/ci/check-history.ts"` in the `check:*`
block. **Verify:** `bun run check:history --help`-style smoke not needed; `bun run check:history
<empty-range>` exercised in Step 5.

## Step 4 — Integration test `src/ci/check-history.test.ts`

Mirror `head-build-core.test.ts`'s synthetic-repo harness (reuse the `git()` helper + `afterEach`
cleanup pattern). Build a repo with a `check` script that runs pure Bun (no install), then make a
sequence of commits:
- Cases:
  1. **Red commit flagged:** commit a green state, then a commit whose `check` exits non-zero (e.g. a
     test file that throws). `sweepCommits({ install: null, check: [...] })` over both shas →
     `classifyHistory` → `anyRed === true`, `redCount === 1`, report names the red sha + subject.
  2. **All-green range reports clean:** a range of only green commits → `anyRed === false`, report
     contains "all N commit(s) test-green".
  3. **Subject + summary populated:** the red `CommitResult` carries the right subject and a non-empty
     `summary` (the failure tail), confirming the `classifyBuildOutcome` flatten.
  4. (light) **`resolveRange` ordering:** rev-list over the synthetic repo returns the shas
     newest-first and `boundRange` caps correctly — small, no worktree cost.

`install: null` keeps it offline; pure-Bun `check` keeps it sub-second. **Verify:** `bun test
src/ci/check-history.test.ts` green; full `bun test` green.

## Step 5 — Live proof (AC#3) + final gate

Free, no cast. Against the real repo:
- **Red flagged:** `bun run check:history <range-containing-3dfb95f>` (e.g.
  `3dfb95f~1..3dfb95f`) → exit 1, report names `3dfb95f` and the failing test. Capture output to
  `progress.md`. *(Cost: builds 1 commit ≈ worktree + install + check.)*
- **Green clean:** a range known green (e.g. a recent green span or `HEAD~1..HEAD`) → exit 0, "all …
  test-green".
- **Bound note:** a range wider than a small `--max`/default shows the `covered N of M (bounded …)`
  line — demonstrated by pointing the default at the full history (246 commits > 100 bound) via a
  dry `boundRange` check, or noting the note text from a capped run.
- **Final:** `bun run check:committed`, `check:head`, `check:typecheck`, `check:test` all green;
  commit through the E-033 pre-commit gate.

## Testing strategy summary

| Concern | Where covered |
|---|---|
| Pure verdict logic (`classifyHistory`, `boundRange`) | `history-core.test.ts` (T-034-01) — unchanged |
| Commit-ish worktree build | `check-history.test.ts` synthetic sweep (Step 4) |
| `check:head` back-compat | `head-build-core.test.ts` unchanged green (Step 1) |
| End-to-end real-repo audit | Live AC#3 proof (Step 5) |

## Risks / watch-items

- **Cost of the live proof:** each commit is a full isolated build. Keep the proof ranges tiny
  (1–2 commits). The audit is periodic/CI, not per-turn — acceptable by design.
- **`3dfb95f` redness depends on the suite at that commit** — if a fresh checkout there is green, the
  proof needs a different known-red sha; documented in `progress.md` if it deviates.
- **Worktree env leakage** (the T-033-02 git-hook lesson): `buildCommittedHead` already spawns clean
  child processes with `cwd` set; we don't run under a git hook here, so no `GIT_DIR` scrub needed.
