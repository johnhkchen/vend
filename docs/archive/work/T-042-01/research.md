# T-042-01 — Research: doctor-check-report-model

_Ticket: T-042-01 · Story: S-042-01 (doctor-check-engine) · Epic: E-042 (vend-doctor-preflight)_

Descriptive map of the codebase reality this ticket lands in. No solutions here — just
what exists, where, and the boundaries that constrain the pure check/report model.

## What this ticket is (and is NOT)

The **pure check/report model only**: a `Check` (name, ok, fix-it hint) plus a pure
renderer mapping a set of probe results → a human-readable report + an exit code (0 when
all green, non-zero when any check fails). It performs **no probing and no IO** — it
mirrors the established `*-core` split. The actual `envinfo`-backed probing is the sibling
T-042-02 (`doctor-probe-effect`); the CLI wiring is T-042-03; the cast-precondition reuse
is T-042-04. This ticket is the addon-free heart all three lean on.

## The `*-core` split — the house pattern this must mirror

Every world-touching capability in this repo is factored into a **pure core** (plain data
in, plain data out, no fs/spawn/clock/network/process/addon) and a thin **impure
shell/effect** that gathers raw facts and applies decisions. Confirmed instances:

- `src/ci/precommit-core.ts` ↔ `src/ci/check-precommit.ts` — `classifyPrecommit(run)` returns
  a verdict `{ block, reason, message }`; the runner spawns the test gate and feeds the raw
  `PrecommitRun` in.
- `src/ci/history-core.ts` ↔ `src/ci/check-history.ts` — `classifyHistory(results)` aggregates
  many per-commit outcomes into `{ anyRed, redCount, report }`.
- `src/ci/committed-core.ts`, `src/ci/head-build-core.ts` — same shape.
- `src/init/init-core.ts` ↔ `src/init/init-effect.ts` — `planInit(existing)` is the pure
  converge planner; `applyInitScaffold` is the fs write effect (E-040, just-cleared sibling).
- `src/play/*-core.ts` ↔ `src/play/*-effect.ts` — work, propose, expand, steer, survey, note.

The doctor check/report model is the `*-core` half. Its impure twin is T-042-02.

## House conventions the core must follow (read off the existing cores)

1. **PURE/TOTAL.** Every export takes plain data and returns fresh values. No `Bun.spawn`,
   no `node:fs`, no clock, no `process`, no BAML addon. This is what keeps the test an
   ordinary `bun test` pure-function test (precommit-core.test.ts imports ONLY its core).
2. **Returned data, never thrown** (committed-core / budget.ts house rule). An offending
   outcome — "a check failed" — is RETURNED data, not an exception. The only `throw`
   permitted is a programmer-error `assertNever` guard the compiler proves unreachable on
   valid data (precommit-core.ts:157).
3. **Name the failure (E-008 style).** A failing verdict's message NAMES the offender and,
   here, its fix-it hint — so the human/agent sees the andon and knows the exact fix.
4. **R12 shared contract constants.** Cross-module literals (exit codes, dir names) are
   exported `as const` from the core and never re-literaled by the shell — cf.
   `HOOKS_DIR` (precommit-core), `DEFAULT_HISTORY_MAX` (history-core), `LISA_MARKERS`
   (init-core). The CLI (T-042-03) must derive its exit code from this core, not hardcode it.
5. **Exhaustive switch + `assertNever`** for any closed union, so adding a case fails `tsc`
   at the unhandled site (precommit-core `verdictMessage`).
6. **Whitespace-collapse helper for embedded text** — `tail`/`summarySuffix` collapse a
   multi-line captured string to one line and guard against a literal `"undefined"`.
7. **Rich header comment** placing the module in its epic/frame, naming its impure twin.

## Exit-code conventions already in the tree

`src/cli.ts` dispatch (the shell T-042-03 extends) uses: **0 = success**, **1 = andon /
operational failure**, **2 = usage error**. The `select`/`chain`/`work` arms all
`process.exit(outcome === "success" ? 0 : 1)`. So doctor's report should compute **0 when
all green, 1 when any check fails** — matching the established non-zero-is-1 convention. The
CLI owns the `process.exit`; the core owns the *number*.

## What the probe will eventually feed in (T-042-02 / E-042 card) — context only

The epic names ~3 vend-specific checks the probe will run (NOT this ticket's job, but they
define the `Check` shape this ticket must carry):
- **lisa on PATH** and **claude on PATH** (the `envinfo` binary-presence checks).
- **BAML native addon loadable** (the `@boundaryml/baml` addon — package.json dep).
- **active-executor config present** — default-Claude needs none; the open-model
  (`openai-compat`) path needs its endpoint vars. The executor seam is
  `src/executor/select.ts` (`resolveExecutorId`, `EXECUTOR_ENV = "VEND_EXECUTOR"`,
  ids `claude` / `openai-compat`). Scope-guard (T-042-02 AC): a basic presence check only.

Each of these becomes a `Check { name, ok, hint }`. The renderer must not care WHICH checks
it got — it takes an arbitrary ordered set and renders/tallies them. That keeps the core
decoupled from the probe's check list (the probe can grow checks without touching the core).

## Report shape the AC + epic demand

- **AC:** an all-green set "renders each dep green and yields exit code 0"; a set with any
  single failing check "renders that check's name plus its fix-it hint and yields a non-zero
  code". So — UNLIKE the audit cores (history/committed surface only offenders) — doctor
  **lists every check, green and red**. The epic "Done looks like" confirms: "reports each
  dep green and exits 0". Doctor is a *status checklist*, not an offenders-only audit.
- The failing line must carry the **named check + its fix-it hint** (E-008 "name the fix").

## Test discipline observed

`precommit-core.test.ts` imports only the core, asserts exact/contained values per AC,
covers the three classification fixtures plus edges (missing stderr → no `"undefined"`,
ordering, non-1 exit codes). The doctor test mirrors this: all-green → exit 0 + each dep
rendered; one-failing → named check + hint + non-zero; purity asserted structurally (the
test file imports nothing impure).

## Constraints & assumptions

- TypeScript on Bun; `noUncheckedIndexedAccess` is on (select.ts comment confirms) — index
  lookups are `T | undefined`, guard accordingly.
- New module lives in a new `src/doctor/` dir (mirrors `src/init/` for E-040). No existing
  `src/doctor/` yet — this ticket creates it.
- No new npm dependency in THIS ticket (`envinfo` is added by T-042-02, the probe). The pure
  core has zero imports beyond TypeScript itself.
- The renderer takes the check set as a parameter (injectable) — same discipline as
  `planInit(existing, manifest)` and `executorFor(opts, env, registry)`: testable today,
  before the real probe exists.
