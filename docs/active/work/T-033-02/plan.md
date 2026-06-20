# T-033-02 — Plan: precommit-hook-and-guard

Ordered, independently-verifiable steps. One atomic commit for the source slice (mirroring
T-033-01's single commit `c71ae0c`), preceded by local activation + live proof. Each step names its
verification.

## Step 1 — `src/ci/check-precommit.ts` (the test-gate runner)

Create the impure runner per structure §1: resolve repo root, spawn `bun run check:test`, build
`PrecommitRun`, `classifyPrecommit`, print `message`, `exit(block ? 1 : 0)`; whole body in
try/catch → `exit 0` on throw (fail-open). Import only `classifyPrecommit` + `PrecommitRun`.

**Verify.** `bun run check:precommit` on the current green tree → prints "precommit: ok — tests
green", exit 0 (`echo $?`). `bun run check:typecheck` clean.

## Step 2 — `src/ci/install-hooks.ts` (the installer runner)

Create per structure §2: import `HOOKS_DIR`, `git config core.hooksPath HOOKS_DIR`, confirm + exit.

**Verify.** Deferred to Step 6 (it mutates local git config — run once, idempotently, at activation).
`bun run check:typecheck` clean now.

## Step 3 — `src/ci/check-hooks.ts` (the guard runner)

Create per structure §3: read `git config --get core.hooksPath`, `hookInstallState`, print, exit
0/1. Import only `hookInstallState`.

**Verify.** With `core.hooksPath` still unset: `bun run check:hooks` → prints the "not installed —
run `bun run hooks:install`" nudge and exits **1** (`echo $?` → 1). Confirms the guard fails closed
when absent (E-012). `check:typecheck` clean.

## Step 4 — `package.json` scripts

Add `check:precommit`, `hooks:install`, `check:hooks` to the `scripts` block (structure §5). Leave
`check`, `check:committed`, `check:head`, `baml:gen`, `build` untouched.

**Verify.** `bun run` (no args) lists the three new scripts; Steps 1 & 3's `bun run` invocations
resolve through the named scripts (not just file paths).

## Step 5 — `.githooks/pre-commit` (the committed hook)

Create per structure §4 with the fail-open preflight + `case`-based translation. Make it executable
(`chmod +x .githooks/pre-commit`); stage with the exec bit preserved.

**Verify (standalone, before activation).** Run the hook directly: `sh .githooks/pre-commit; echo
$?` on the green tree → exit 0. Temporarily break `bun` on PATH is unnecessary — the fail-open arms
are exercised by reading; the red/green behavior is proven live in Step 7.

## Step 6 — Activate in this repo

`bun run hooks:install` → sets `core.hooksPath = .githooks`.

**Verify (AC).** `git config --get core.hooksPath` → `.githooks`. `bun run check:hooks` → prints
"gate active", exits **0**. Re-run `bun run hooks:install` → still succeeds (idempotent).

## Step 7 — Live proof (AC #4): red blocks, green proceeds

1. **Red.** Write a throwaway always-failing test (e.g. `src/ci/__precommit_proof.test.ts` with
   `expect(true).toBe(false)`). `git add` it, then `git commit -m "proof: should be blocked"`.
   **Expect:** the commit is **BLOCKED** (non-zero), stderr shows `precommit: BLOCK — tests failed
   (exit 1); ...` naming the failure. Confirm with `git log` (no new commit) and the hook's output.
2. **Green.** Remove the throwaway test (`git rm --cached` + delete the file) so the tree is green
   again. `bun run check:test` → green.
3. **Guard.** `bun run check:hooks` → active, exit 0.

This leaves the tree green with no proof artifact committed.

## Step 8 — Commit the source slice

Stage the three runners, the `.githooks/pre-commit` hook (exec bit), the `package.json` change, and
all five RDSPI artifacts (`research/design/structure/plan/progress` + later `review`). Commit.

**Verify (AC, dogfood).** Because the hook is now active, **this very commit** runs `check:test` and
must pass for the commit to land — the gate proves itself on the act of shipping itself. After:
`bun run check:committed` → ok (nothing uncommitted); `bun run check:hooks` → active; `bun run
check:typecheck && bun run check:test` → green.

## Testing strategy (recap)

- **No new unit tests.** The three runners are impure invokers — smoke-only, not unit-tested, the
  same as `check-committed.ts` / `check-head.ts`. Their delegated judgment is fully covered by
  `precommit-core.test.ts` (13 green cases from T-033-01).
- **Live/integration proof** replaces a unit test here (a git pre-commit can only be honestly
  verified by an actual `git commit`): the red-blocks / green-proceeds / guard-active demonstration
  in Step 7, plus the dogfood commit in Step 8.
- **Regression guard.** `bun run check:test` (full suite) must stay green throughout; the existing
  925+ cases plus `precommit-core.test.ts` are the safety net.

## Risk notes

- **Hook gates its own commit.** If the suite is red at Step 8, the source can't commit — but the
  on-stop E-008 gate then blocks the session for uncommitted source. Mitigation: Step 7.2 leaves the
  tree green before Step 8; verify `check:test` green *before* committing.
- **Fail-open correctness is the load-bearing property.** A bug that turns a fail-open path into a
  block would wedge every commit. Mitigation: runner try/catch → exit 0, shell `*` arm → exit 0, and
  the standalone Step 5 verification on a green tree.
- **`git config --get` exit semantics.** Unset key → exit 1, empty stdout; Step 3's mapping to
  `null` is verified directly against the unset state before activation.
- **Exec bit.** A hook committed without `+x` silently won't run on a fresh clone. Mitigation: Step
  5 `chmod +x` and confirm the staged mode is `100755`.
