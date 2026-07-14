# T-033-01 — Research: precommit-policy-core

*Descriptive map of the codebase territory this ticket lands in. What exists, where, and
how it connects. No solutions proposed here — that is Design.*

## The ticket in one line

Create `src/ci/precommit-core.ts` holding two **pure** functions — `classifyPrecommit(runResult)`
(the block/allow decision for a per-commit test gate) and `hookInstallState(hooksPath)` (the guard
that tells whether the committed git hook is wired) — plus a unit test mirroring
`committed-core.test.ts`. No I/O, no spawning. The impure invoker is T-033-02's job.

## Where this sits: the E-033 lineage

E-033 (`per-commit-green-gate`) closes a structural gap surfaced by T-031-01: a mid-ticket **red
commit** (`3dfb95f`) survived history undetected. The existing gate frame has two layers, both
already shipped:

- **E-008** (`check:committed`, on-stop hook): source must be committed before a session ends.
- **E-010** (`check:head`, on-clear hook): committed HEAD must build when a ticket clears.

Neither enforces **tests green per commit**. A red commit between those two checkpoints is invisible.
E-033 adds a third layer at the **git pre-commit** seam — the one place lisa's loop has no hook of its
own (it commits via plain `git commit`). The story S-033-01 splits the work T-008-style:

- **T-033-01 (this ticket)** — the pure policy core: the decision, no I/O.
- **T-033-02** — the impure wiring: `.githooks/pre-commit` invoker, `hooks:install` script,
  `check:hooks` guard, in-repo activation, live proof.

## The precedent to mirror exactly: the `src/ci/` pure-core / thin-invoker split

`src/ci/` contains exactly two gates today, each built on the SAME shape. This shape is the
**central rule** of `docs/knowledge/ci-strategy.md`: *the trigger invokes, the core decides.*

```
src/ci/
  committed-core.ts        ← PURE classifier (E-008): porcelain text → offending paths
  committed-core.test.ts   ← ordinary pure-function test (no git, no process)
  check-committed.ts       ← thin IMPURE verb: runs git, writes stderr, exits the process
  head-build-core.ts       ← PURE classifier (E-010): BuildOutcome → HeadVerdict {exitCode,ok,message}
  head-build-core.test.ts  ← pure-function test
  check-head.ts            ← thin IMPURE verb
```

The split is load-bearing because the host working tree can't be read from inside a Dagger container
(`ci-strategy.md` §"Why Dagger"): so these gates run on the host as lisa hooks, not as `/ci`
sub-classes, but the **logic still lives behind a `bun run check:*` surface** so it never drifts.

### `committed-core.ts` — the structural precedent

- Pure exports only: every function takes a plain string and returns fresh values. No fs, clock,
  network, process, git. Documented as a HOUSE RULE in the file header.
- A malformed *call* is a programmer error (TS `strict` forbids it at compile time) → **no runtime
  assert**. An offending result is **returned data, never thrown**. "Source is dirty" is an expected
  outcome, not an exception. (lines 16–19)
- The R12 SHARED CONTRACT (`SOURCE_PREFIXES`) is a single exported `as const` — every consumer derives
  from it, no re-listing.

### `head-build-core.ts` — the verdict-shape precedent (closest analog)

This is the closer analog because, like our `classifyPrecommit`, it **maps a raw run outcome to a
decision with a message**:

- `BuildOutcome` (input DATA the impure verb reports — `{ failedStep, detail }`) is deliberately
  *just data*; the verb "never decides what exit code that maps to." (lines 27–33)
- `HeadVerdict` (output) = `{ exitCode: 0|1|2; ok: boolean; message: string }`. Note `ok` is
  **derived** from `exitCode` ("No separate boolean to desync — it is derived.", line 41).
- `classifyBuildOutcome` is PURE/TOTAL and resolves cases via an **if/return chain that narrows the
  union** — `failedStep === null` → ok; `=== "build"` → andon; else (preflight|worktree) → env error.
  There is no `switch`/`default`; the final branch handles the remaining narrowed cases and tsc
  accepts it. (lines 59–77) **This is the idiom the codebase uses to "prove every case is handled."**

### `check-committed.ts` — the invoker that consumes the core (T-033-02's analog, not ours)

- Guarded by `if (import.meta.main)`; smoke-only, never unit-tested.
- Exit vocabulary: **0** = pass, **1** = ANDON (found a problem), **2** = environment error (git
  missing / not a repo) — kept DISTINCT from a found-problem so the hook can tell "couldn't check"
  from "found a problem." (lines 11–13)

### `on-stop.sh` — the fail-open discipline this ticket must encode as policy

The on-stop hook (lines 41, 64–66) **fails open**: any inability to run the check (no bun, not a repo,
env error → exit code other than 0/1) lets the stop proceed. "A broken checker must never wedge the
loop." Our `classifyPrecommit`'s **`could-not-run` → `{ block:false }`** case is the in-core encoding
of exactly this discipline, so T-033-02's pre-commit hook inherits it as data rather than re-deriving
it in shell.

## Test precedent: `committed-core.test.ts`

- `import { describe, expect, test } from "bun:test";` — the standard harness.
- Imports ONLY the core module; no git, no process → an ordinary pure-function test.
- Structure: one `describe` per exported function; AC fixtures called out with `// AC:` comments;
  edge cases grouped under banner comments. Asserts exact values (`toEqual`, `toBe`), never frozen
  hashes — "press-core asserting real values."

## Package / toolchain wiring

`package.json` `scripts` (lines 9–17): `check:test`, `check:typecheck`, `check:committed`,
`check:head`, and the composite `check`. The AC requires `bun run check:*` green — i.e. `check:test`
(this new test passes) and `check:typecheck` (tsc proves exhaustiveness). T-033-02 will add a
`check:hooks` script that consumes `hookInstallState`; **this ticket does not touch package.json** —
it only provides the pure function `check:hooks` will later call.

## What `classifyPrecommit` receives (the input contract)

The ticket models the test-run outcome as `{ ran: boolean; exitCode: number | null; stderr?: string }`
(or an equivalent tagged shape). This mirrors `BuildOutcome`: the impure runner in T-033-02 will run
`bun run check:test` (or `bun test`) and report only the raw facts — did it spawn (`ran`), what exit
code, captured stderr — leaving ALL judgment to this core. `exitCode` is `number | null` because a
process that never ran (spawn failure) has no exit code.

## The three decision cases (from the ticket, restated as found-territory)

| Input | reason | block | discipline |
|---|---|---|---|
| `ran && exitCode === 0` | `green` | `false` | allow — tests pass |
| `ran && exitCode !== 0` | `tests-failed` | `true` | **fail-closed** — the gate's whole job; message names the failure |
| `!ran` | `could-not-run` | `false` | **fail-open** — mirrors on-stop; never wedge the loop, but leave a visible note |

`hookInstallState(hooksPath)` is simpler: `active` iff the configured `core.hooksPath` points at the
committed hooks dir (the ticket names `.githooks`); else a message telling the reader to run
`bun run hooks:install`. This is the E-012 spirit — the gate must not be **silently absent**.

## Constraints & assumptions surfaced

- **Purity is the hard contract.** No `Bun.spawn`, no `readFile`, no git. tsc under `strict` is the
  enforcer; the test is an ordinary pure-function test.
- **Exhaustiveness without a `default`.** The ticket explicitly forbids a `default` branch on `reason`
  so adding a fourth reason later breaks the build loudly. The codebase idiom (head-build-core) is a
  narrowing if/return chain; an explicit `never` exhaustiveness guard is the alternative — Design
  decides which.
- **`.githooks` is named but not yet authoritative.** T-033-02 creates `.githooks/pre-commit` and runs
  `git config core.hooksPath .githooks`. This ticket must encode the expected path as the contract that
  `hookInstallState` checks against — the analog of `SOURCE_PREFIXES` as a single source of truth.
- **No I/O means no path normalization via fs.** `hookInstallState` compares strings only; git may
  report `core.hooksPath` with or without a trailing slash, and relative vs. as-configured. Design must
  decide how lenient the match is (descriptive note: git stores the value verbatim as configured).
- **Naming.** Follow the `*-core.ts` + `*-core.test.ts` convention precisely so lisa's `check:committed`
  scope (`src/`) and the team's mental model both hold.
