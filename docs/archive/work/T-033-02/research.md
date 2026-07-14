# T-033-02 — Research: precommit-hook-and-guard

Descriptive map of the codebase territory T-033-02 touches. T-033-01 already landed the **pure
policy** (`src/ci/precommit-core.ts`, commit `c71ae0c`). This ticket wires that policy into a real
git `pre-commit` hook, makes it installable + un-silenceable, and activates it here. No solutions
proposed — only what exists, where, and how it connects.

## The pure core this ticket consumes (T-033-01, already committed)

`src/ci/precommit-core.ts` exports four things, all PURE (plain data in, fresh values out):

- `classifyPrecommit(run: PrecommitRun): PrecommitVerdict` — the whole judgment. `ran` is checked
  first: `!ran → allow/could-not-run` (fail-open), `ran && exit 0 → allow/green`, `ran && exit !== 0
  → BLOCK/tests-failed` (fail-closed; message names the failure). `block` is `true` only for
  `tests-failed`.
- `PrecommitRun { ran: boolean; exitCode: number | null; stderr?: string }` — the RAW result the
  impure verb reports. `ran` = the test process actually spawned and completed; `exitCode` = its
  code (`null` when it never ran); `stderr` = captured tail for the andon message.
- `PrecommitVerdict { block: boolean; reason: PrecommitReason; message: string }` — `message` is
  always set, so the invoker never synthesizes text.
- `hookInstallState(hooksPath: string | null | undefined): HookState` — decides whether the
  configured `core.hooksPath` activates the gate. Normalizes one trailing slash; `null`/unset →
  not active with the "run `bun run hooks:install`" nudge; exact `.githooks` → active; anything
  else → not active (fails safe — never falsely claims active).
- `HOOKS_DIR = ".githooks"` — the **R12 shared contract**. Its own doc-comment is explicit: the
  T-033-02 `.githooks/pre-commit` script, the `git config core.hooksPath` install step, and the
  `check:hooks` guard **all derive the path from this export and never re-list it**. The shell
  script embodies the path by its own location; the install + guard runners import it.

Test coverage already exists: `src/ci/precommit-core.test.ts` (13 cases, green) asserts the three
AC fixtures plus edges. This is an ordinary pure-function test (no spawn/git/process).

## The invoker precedent to mirror — `src/ci/check-committed.ts`

The "thin IMPURE verb" pattern, established at E-008 and repeated at E-010:

- `if (import.meta.main) { ... }` guard; **smoke-only, not unit-tested** (its own header says so).
- Resolves repo root via `Bun.spawnSync(["git", "rev-parse", "--show-toplevel"])` so the gate is
  correct regardless of invocation cwd; exits `2` on env error (not a repo / git missing).
- Does the side effects (spawn, write stderr, `process.exit`) and delegates **all judgment** to the
  pure core (`classifyPorcelain`). Exit codes are meaningful: `0` ok, `1` andon, `2` env error.

`src/ci/check-head.ts` (E-010) is the second instance and the closer structural match for the
final shape: it builds an outcome, calls `classifyBuildOutcome`, then
`(verdict.ok ? stdout : stderr).write(msg); process.exit(verdict.exitCode)`. T-033-02's runner will
take this exact final shape against `classifyPrecommit`.

## The fail-open POSIX-sh hook to mirror — `.lisa/hooks/on-stop.sh`

The shell discipline this ticket's `.githooks/pre-commit` mirrors:

- `#!/bin/sh`, POSIX-only.
- **Fail open on its own errors**: `command -v bun >/dev/null 2>&1 || exit 0`; `ROOT="$(git
  rev-parse --show-toplevel 2>/dev/null)" || exit 0`; `[ -n "$ROOT" ] || exit 0`. Inability to run
  the check is never the same as finding a problem.
- Runs the gate from `$ROOT` (cwd-robust), captures output.
- **Translates** the gate's exit code into hook behavior via a `case` — it never blindly propagates
  (on-stop maps script-exit-2 "env error" to hook-allow, script-exit-1 "andon" to hook-block-2).
  The lesson: the shell owns the allow/block/fail-open translation explicitly.
- Only INVOKES; the definition of "good" lives in `src/ci/*-core.ts`, never in the hook (the
  ci-strategy.md Central Rule).

## The package.json script surface

`package.json` `scripts` block (the seam to extend):

```
check:test       bun test
check:typecheck  tsc --noEmit
check:committed  bun run src/ci/check-committed.ts
check:head       bun run src/ci/check-head.ts
baml:gen         baml-cli generate --from baml_src
check            bun run baml:gen && bun run check:typecheck && bun run check:test
build            tsc --noEmit
```

Pattern: each `check:*` is `bun run src/ci/<file>.ts`. T-033-02 adds `hooks:install` and
`check:hooks` (per the ticket) and — for symmetry with the on-stop precedent — a `check:precommit`
the hook invokes. `check:committed` / `check:head` / `check` are **not** to be changed (this is a
third, independent layer beside them).

## The git pre-commit seam & current repo state

- `git config --get core.hooksPath` → **unset** (verified). A fresh clone needs the installer once;
  `core.hooksPath` is local config, not committed.
- `.githooks/` does **not** exist yet (verified) — created by this ticket.
- The full suite is green at HEAD (T-033-01 noted 925 pass). The pre-commit gate will run the full
  `check:test` on each commit, so the implementing commit must itself be green (dogfooding).

## The commit-discipline frame (the three layers)

| Layer | Epic | Trigger | Question answered |
|---|---|---|---|
| `check:committed` | E-008 | lisa on-stop (per turn) | Is all source committed? |
| `check:head` | E-010 | lisa on-clear (per ticket) | Does the committed HEAD build? |
| **precommit gate** | **E-033** | **git pre-commit (per commit)** | **Do the tests pass at THIS commit?** |

`docs/active/epic/E-012.md` is the "police the gate" precedent: a guard that exits non-zero when the
gate is silently absent. `check:hooks` is the E-012 move applied to this layer.

## Constraints / assumptions surfaced

- The hook runs the **full `check:test`** suite per commit — accepted latency (the ticket forbids
  the full `check` and `baml:gen` per commit). `check:typecheck` is optional only if sub-second.
- Fail-open is non-negotiable: a broken toolchain must never wedge a developer's `git commit`.
- The runner must emit **only** allow/block exit codes so the shell's translation stays simple; any
  other code from the wrapper must be treated by the shell as env-error → fail open.
- `hooks:install` wiring into a lisa hook is an explicit **non-goal** — the script alone satisfies
  the slice. No `on-commit` lisa hook (git pre-commit IS the seam).
