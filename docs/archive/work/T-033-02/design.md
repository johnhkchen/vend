# T-033-02 — Design: precommit-hook-and-guard

Decisions for wiring T-033-01's pure policy into a live, installable, un-silenceable git pre-commit
gate. Each decision is grounded in the research; rejected alternatives are recorded.

## D1 — Where the spawn lives: a TS runner, not the shell

**Decision.** The `.githooks/pre-commit` shell stays minimal (fail-open preflight + one invocation);
a tiny TS runner `src/ci/check-precommit.ts` does the `Bun.spawnSync(["bun","run","check:test"])`,
builds a `PrecommitRun`, calls `classifyPrecommit`, prints `verdict.message`, and exits.

**Why.** This is the `check:committed` / `check:head` shape the codebase already uses twice (the
"thin invoker delegates to pure core" pattern). It keeps the andon *logic* in TS where it is typed
and the pure core is already tested, and keeps the shell to the fail-open concern only — exactly the
`.lisa/hooks/on-stop.sh` division. The ticket explicitly green-lights "a tiny `src/ci/check-precommit.ts`
runner that does the spawn + delegates to the pure core."

**Rejected.** Doing the spawn + exit-code parsing in POSIX sh. It would re-derive in the shell the
judgment that `classifyPrecommit` already owns (violating the Central Rule: hooks invoke, cores
define), and shell exit-code handling of `bun test` output is brittle vs. the typed `PrecommitRun`.

## D2 — The runner emits ONLY 0 (allow) or 1 (block); the shell translates

**Decision.** `check-precommit.ts` exits `0` for allow (both `green` and `could-not-run`) and `1`
for block (`tests-failed`). The shell maps the runner's code with an explicit `case`: `0 → exit 0`,
`1 → exit 1` (BLOCK), `* → exit 0` (the runner could not even start → fail open).

**Why.** `classifyPrecommit.block` is already a clean boolean, so the runner needs only two codes.
on-stop.sh's lesson is that the shell must *translate*, never blindly propagate — so a `bun run`
wrapper failure (e.g. exit 127, script-not-found, bun crash) is caught by the `*` arm and fails
open, never falsely blocking a commit. The runner additionally wraps its body in try/catch and exits
`0` on any unexpected throw, so fail-open holds at both layers.

**Rejected.** Propagating the runner's exit code verbatim (`exit $?`). A non-0/1 code from the
wrapper would falsely block — the opposite of fail-open. Rejected for safety.

**Rejected.** Reusing `check:committed`'s 3-code scheme (0/1/2 with 2 = env error). Unnecessary here:
fail-open collapses env-error into allow, so a single block-or-allow boolean is the honest model and
matches `classifyPrecommit`'s own shape (no third reason maps to a distinct *exit*).

## D3 — `ran` vs `could-not-run` detection inside the runner

**Decision.** Resolve the repo root first (`git rev-parse --show-toplevel`); if that fails →
`{ ran: false, ... }` (could-not-run). Otherwise spawn `bun run check:test` in the root; if the
spawn throws or yields `exitCode === null` → `ran: false`; else `ran: true` with that exit code.
Capture a bounded tail of `stderr + stdout` for the message.

**Why.** Mirrors check-committed.ts's root-resolution preflight (cwd-robust) and maps cleanly onto
`PrecommitRun`'s contract (`ran` false ⇒ `exitCode` null/meaningless). The shell already guards
`bun` presence, so this is belt-and-suspenders; the runner stays correct even if invoked directly.

**Rejected.** Trusting `Bun.spawnSync` never to throw. It throws when the executable is absent;
catching it and reporting `ran:false` keeps the fail-open promise inside the runner too.

## D4 — Which gate the hook runs: `check:test` only (full suite, per commit)

**Decision.** Run **`check:test`** (the full `bun test` suite). Do **not** add `check:typecheck`
(tsc is not reliably sub-second), do **not** run `baml:gen` or the aggregate `check`.

**Why.** The ticket names `check:test` the headline and gates `check:typecheck` on a sub-second
budget it does not meet; `baml:gen` is slow and `check:head` already owns the full build at clear.
The per-commit question is precisely "do the tests pass at THIS commit?" — `check:test` answers
exactly that. Accepting full-suite latency per commit is the deliberate cost of the gate (the suite
runs in a few seconds today).

**Rejected.** Running only changed-file tests. Adds selection logic and a failure mode (missed
coverage) for a suite that is currently fast enough; over-building past the slice.

## D5 — Install + guard derive `.githooks` from `HOOKS_DIR` via tiny runners

**Decision.** `hooks:install` → `src/ci/install-hooks.ts` (imports `HOOKS_DIR`, runs `git config
core.hooksPath <HOOKS_DIR>`, idempotent, prints confirmation). `check:hooks` →
`src/ci/check-hooks.ts` (reads `git config --get core.hooksPath`, passes to `hookInstallState`,
prints the state message, exits `0` active / `1` not).

**Why.** `precommit-core.ts`'s own doc-comment mandates that the install step and guard *derive the
path from `HOOKS_DIR` and never re-list it* — so a literal `.githooks` in `package.json` would
duplicate the R12 contract. A one-line TS runner importing the constant honors single-source-of-
truth and matches the `check:committed` script shape (`bun run src/ci/<file>.ts`). `git config` set
to the same value twice is inherently idempotent; relative `HOOKS_DIR` keeps it portable (no
absolute paths). The guard exiting non-zero when absent is the E-012 "police the gate" move — the
gate can't be silently missing.

**Rejected.** A bare `"hooks:install": "git config core.hooksPath .githooks"` in `package.json`.
Simpler, but re-lists the contract string the core explicitly says must not be re-listed; rejected
to keep `HOOKS_DIR` the only place the path is named.

## D6 — Hook invokes via `bun run check:precommit` (a new script)

**Decision.** Add `check:precommit` (`bun run src/ci/check-precommit.ts`) to `package.json`; the
shell calls `bun run check:precommit`. `check:committed` / `check:head` / `check` are untouched.

**Why.** on-stop.sh invokes its gate as `bun run check:committed`, not by file path — symmetry keeps
the script surface the single discovery point for every gate. The new script is additive and changes
no existing gate, satisfying "don't change `check:committed`/`check:head`."

## Testing strategy

Following the established convention, the three impure runners (`check-precommit.ts`,
`install-hooks.ts`, `check-hooks.ts`) are **smoke-only, not unit-tested** — exactly as
`check-committed.ts` / `check-head.ts`'s `import.meta.main` blocks are. All judgment they delegate to
is already covered by `precommit-core.test.ts` (13 green cases). Verification is the AC's **live
proof**: install the hook here, stage a deliberately-failing test, confirm `git commit` is BLOCKED
with the named failure, remove it, confirm a green tree commits, and confirm `check:hooks` reports
active — leaving the tree green and `bun run check:*` passing.

## Net shape

Two new package scripts the ticket names (`hooks:install`, `check:hooks`) + one symmetry script
(`check:precommit`); one committed shell hook; three tiny TS runners; one local `git config`
activation. The third commit-discipline layer stands beside E-008/E-010, sharing nothing but the
`check:*` surface and the `HOOKS_DIR` contract.
