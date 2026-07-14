# T-033-02 — Progress: precommit-hook-and-guard

Execution log against `plan.md`. All eight steps complete; no deviations from the plan's shape.

## Completed

- **Step 1 — `src/ci/check-precommit.ts`** ✅ Impure runner: preflight repo-root resolve → spawn
  `bun run check:test` → build `PrecommitRun` → `classifyPrecommit` → print message → `exit(block?1:0)`,
  whole body in try/catch → `exit 0` on throw (fail-open). Imports only `classifyPrecommit` +
  `PrecommitRun`. **Verified:** `bun run check:precommit` on green tree → "precommit: ok — tests
  green", exit 0. `check:typecheck` clean.

- **Step 2 — `src/ci/install-hooks.ts`** ✅ Imports `HOOKS_DIR`, `git config core.hooksPath HOOKS_DIR`,
  confirms + exits. **Verified at Step 6.**

- **Step 3 — `src/ci/check-hooks.ts`** ✅ Reads `git config --get core.hooksPath` (exit 1 / empty →
  `null`), `hookInstallState`, prints, `exit(active?0:1)`. **Verified (unset state):** printed
  "git hook not installed … run `bun run hooks:install`", exit **1** — guard fails closed (E-012).

- **Step 4 — `package.json` scripts** ✅ Added `check:precommit`, `check:hooks`, `hooks:install`
  beside the existing `check:*` keys. `check` / `check:committed` / `check:head` / `baml:gen` /
  `build` untouched. **Verified:** all three resolve via `bun run <name>`.

- **Step 5 — `.githooks/pre-commit`** ✅ Fail-open POSIX-sh invoker (`command -v bun || exit 0`;
  `git rev-parse --show-toplevel || exit 0`; `cd "$ROOT"`), runs `bun run check:precommit`, `case`
  translates `0→allow`, `1→BLOCK`, `*→fail open`. `chmod +x` applied (mode 100755).

- **Step 6 — Activation** ✅ `bun run hooks:install` → `core.hooksPath = .githooks`. **Verified:**
  `git config --get core.hooksPath` → `.githooks`; `bun run check:hooks` → "gate active", exit 0;
  re-running `hooks:install` still exit 0 (**idempotent**).

- **Step 7 — Live proof** ✅
  - **Red:** staged a throwaway always-failing test, `git commit` was **BLOCKED** — the hook printed
    `precommit: BLOCK — tests failed (exit 1); fix before committing: …expect(received).toBe(expected)…`
    naming the failure; `git commit` exited 1; `git log` showed HEAD still `c71ae0c` (no commit made).
  - **Green:** removed the throwaway; `bun run check:test` → **925 pass, 0 fail**.
  - **Guard:** `bun run check:hooks` → active, exit 0.

- **Step 8 — Commit the slice** ✅ Three runners + `.githooks/pre-commit` (exec bit) + `package.json`
  + all RDSPI artifacts committed atomically. The now-active hook gated this very commit
  (dogfood: `check:test` ran green as part of landing it).

## Deviations

**One material deviation — the git-hook env leak (load-bearing; the hook gained an env scrub).**
The first attempt to run the gate inside a real `git commit` BLOCKED on 3 failures in
`head-build-core.test.ts` ("Expected build, Received worktree") even though `bun run check:test`
was green standalone. Root cause: **git exports `GIT_DIR` / `GIT_INDEX_FILE` / `GIT_WORK_TREE` into
the hook environment**, and those leak into the child `git` processes the integration test spawns
(`git worktree add` on a *synthetic* repo) — pinning them to THIS commit's repo/index and breaking
their isolation. Reproduced deterministically:
`GIT_DIR=… GIT_INDEX_FILE=… bun test head-build-core.test.ts` → 3 fail; same run with those vars
`unset` → 10 pass. **Fix:** `.githooks/pre-commit` now `unset`s the git hook env before invoking the
gate, so the suite runs as a plain `bun test` would. With the scrub, the dogfood commit (`ab9d541`)
ran the full suite green inside its own pre-commit hook.

⚠️ **Repo-recovery note (for the record).** While *diagnosing* the leak I ran
`GIT_DIR=… GIT_INDEX_FILE=… bun test head-build-core.test.ts` directly — which let the test's git
operations create real commits on `main` (`1ef1f78` "partial: app without its dep", `2e595fd`
"complete: app with its dep") and clobber the index. No data lost: `git reset --mixed c71ae0c`
discarded the stray commits and restored the tree; the clean T-033-02 commit was then made through
the now-scrubbed hook. Lesson reinforced: never run that test with git env vars pointing at a real
repo — exactly what the hook's scrub prevents at the commit seam.

## Notes / observations

- The Step 7 red proof correctly BLOCKED a real `git commit`, naming the planted failure; the gate
  behaved per contract (red → BLOCK, green → allow). Final tree: **925 pass / 0 fail**.
- Fail-open is enforced at three layers: the shell's `command -v bun` / `git rev-parse` guards and
  `*`-arm, the runner's not-a-repo / `exitCode === null` branches, and the runner's outer try/catch.
- `HOOKS_DIR` remains named in exactly one place (`precommit-core.ts`); install + guard import it,
  the shell embodies it by location — no re-listed `.githooks` string in TS.
