# T-033-02 — Review: precommit-hook-and-guard

Handoff for a human reviewer. What changed, how it was verified, and the open concerns. The slice
wires T-033-01's pure policy into a live, installable, un-silenceable git pre-commit gate (E-033) —
the third commit-discipline layer beside E-008 (`check:committed`) and E-010 (`check:head`).

## What changed

**Created**

- `src/ci/check-precommit.ts` — impure runner. Resolves repo root, spawns `bun run check:test`,
  builds a `PrecommitRun`, calls `classifyPrecommit`, prints the verdict, exits `0` (allow) / `1`
  (BLOCK). Whole body try/catch → `exit 0` on any throw (fail-open). Imports only from
  `precommit-core.ts`.
- `src/ci/install-hooks.ts` — `bun run hooks:install`. Sets `git config core.hooksPath <HOOKS_DIR>`
  (idempotent, portable). Imports `HOOKS_DIR`.
- `src/ci/check-hooks.ts` — `bun run check:hooks`, the guard. Reads `core.hooksPath`, delegates to
  `hookInstallState`, exits non-zero + names the fix when the gate is absent (E-012). Imports
  `hookInstallState`.
- `.githooks/pre-commit` — fail-open POSIX-sh invoker (mode 100755). Preflight-guards bun + repo,
  runs `bun run check:precommit`, `case`-translates `0→allow / 1→BLOCK / *→fail open`.

**Modified**

- `package.json` — added `check:precommit`, `check:hooks`, `hooks:install` to `scripts`. No existing
  script changed (`check`, `check:committed`, `check:head`, `baml:gen`, `build` untouched).

**Local (not committed)**

- `core.hooksPath = .githooks` set in this repo's git config via `hooks:install`. A fresh clone
  re-runs `bun run hooks:install` once.

## Acceptance criteria — status

- ✅ **Committed `.githooks/pre-commit` runs `check:test`, blocks red, allows green, fails open.**
  Live-proven: a staged failing test caused `git commit` to exit 1 with
  `precommit: BLOCK — tests failed (exit 1) …` naming the failure; a green tree allows the commit;
  fail-open holds at shell (`command -v bun`, `git rev-parse`, `*`-arm) and runner (not-a-repo,
  `exitCode === null`, outer try/catch) layers.
- ✅ **`bun run hooks:install` sets `core.hooksPath` (idempotent, portable); repo activated.**
  `git config --get core.hooksPath` → `.githooks`; re-running `hooks:install` stays exit 0.
- ✅ **`bun run check:hooks` reports active when installed, non-zero + names the fix when not.**
  Verified exit 1 while unset (printed the `hooks:install` nudge), exit 0 once active.
- ✅ **Live proof, tree left green; `bun run check:*` green.** Red blocked, throwaway removed, suite
  **925 pass / 0 fail**, guard active, dogfood commit landed through the now-active hook.

## Test coverage

- **No new unit tests** — the three runners are impure invokers, **smoke-only**, matching the
  established `check-committed.ts` / `check-head.ts` convention. Their delegated judgment is fully
  covered by **`precommit-core.test.ts` (13 green cases)** from T-033-01: `classifyPrecommit`'s
  three reasons + edges, and `hookInstallState`'s active / unset / trailing-slash / wrong-path
  branches.
- **Live/integration proof** stands in where a unit test cannot — a git pre-commit is only honestly
  verifiable by a real `git commit`. The red-blocks / green-proceeds / guard-active / idempotent-
  install demonstrations cover every branch the runners add.
- **Regression net:** the full `check:test` suite (925 pass, 0 fail) stayed green throughout and
  gated the implementing commit itself.

### Coverage gaps (acknowledged, low risk)

- The runners' impure spawn/exit branches have no automated assertion (by convention). The fail-open
  arms (`!ran` from a non-repo, `exitCode === null`, the try/catch) are reasoned + read, and the
  shell's `*`-arm is exercised only by inspection. A future option, if desired, is a thin integration
  test driving the runner against a synthetic repo (the `head-build-core.test.ts` pattern) — out of
  scope for this slice.

## Open concerns / notes for the reviewer

- **Per-commit latency.** The hook runs the **full** `check:test` (~0.7s today, 925 tests) on every
  `git commit`. Deliberate per the ticket (no `baml:gen`, no aggregate `check`); revisit only if the
  suite grows slow. `check:typecheck` was intentionally **not** added (tsc isn't reliably sub-second).
- **Git-hook env leak — the key implementation insight (resolved in the hook).** Git exports
  `GIT_DIR` / `GIT_INDEX_FILE` / `GIT_WORK_TREE` into every hook's environment. Without scrubbing,
  those leak into the child `git` processes the test suite spawns — `head-build-core.test.ts`'s
  `git worktree add` against a *synthetic* repo gets pinned to the real repo/index and fails (3
  cases), so the gate would block every commit even on a green tree. `.githooks/pre-commit` `unset`s
  that env before invoking the gate, so the suite runs exactly as a standalone `bun test`. Verified:
  leaked env → 3 fail; `unset` → green. A reviewer extending the suite with any test that shells out
  to `git` on a throwaway repo should know this scrub is what keeps such tests isolated under the
  hook. (Separately: `head-build-core.test.ts` is itself unsafe if ever run with git env vars
  pointed at a real repo — it will create commits there; out of scope to harden the test here, but
  worth a follow-up note for that test's own isolation.)
- **Fail-open is load-bearing.** The whole design favors letting a commit through over wedging it.
  A reviewer should sanity-check that this is the intended risk posture (a broken toolchain skips the
  gate rather than blocking work) — it mirrors `on-stop.sh` exactly.
- **`HOOKS_DIR` single-source held.** `.githooks` is named only in `precommit-core.ts`; install +
  guard import it, the shell embodies it by location. Renaming the dir is a one-line edit there.
- **Non-goals respected.** No lisa `on-commit` hook (git pre-commit is the seam); `hooks:install`
  not wired into any lisa hook (the script alone satisfies the slice); `check:committed`/`check:head`
  unchanged.

## Verdict

Ready for review. All four ACs met and live-proven; the gate dogfooded itself by gating its own
commit; the tree is green and the repo is activated.
