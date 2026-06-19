# T-010-01 — Research: check-head-isolated-build

*Descriptive map of the ground this ticket touches. What exists, where, how it
connects. No solutions proposed here.*

## The gate to build

`bun run check:head` must build the **committed HEAD in isolation from the
working tree** and report pass/fail. The masked-defect it exists to catch is
E-007's class: `cast.ts` was committed without its `play.ts`; HEAD was broken,
but the in-place `check` stayed green because the dirty working tree still held
the uncommitted `play.ts`. An isolated checkout of HEAD has no working-tree
files to mask the gap, so the broken commit surfaces.

## The sibling gate — the pattern to mirror (E-008)

`src/ci/check-committed.ts` + `src/ci/committed-core.ts` + `committed-core.test.ts`
are the template. The split is doctrinal:

- **`committed-core.ts` — PURE.** Every export takes a plain string, returns
  fresh values; no fs, clock, network, process, or git. It is the single source
  of "what counts as a problem." `classifyPorcelain(text) -> string[]`. Unit
  tested as ordinary pure functions.
- **`check-committed.ts` — IMPURE verb.** Guarded by `if (import.meta.main)`.
  Does the side effects only: spawns `git`, writes stderr, `process.exit`. It
  delegates ALL judgment to the pure core. It is **smoke-only, not unit-tested**
  (like `press.ts` / the cli dispatch block).

The exit-code vocabulary is the contract to copy exactly:

| code | meaning (check:committed) |
|------|---------------------------|
| `0`  | clean — all source committed |
| `1`  | ANDON — found a problem (uncommitted source, the D-005 class) |
| `2`  | environment error — git missing / not a repo — "couldn't check" |

The `1` vs `2` distinction is load-bearing: the trigger (a lisa hook) must tell
"found a problem" from "couldn't run the check." `check:head` inherits this.

## package.json — the script surface

```jsonc
"check:test":      "bun test",
"check:typecheck": "tsc --noEmit",
"check:committed": "bun run src/ci/check-committed.ts",   // E-008 entry
"baml:gen":        "baml-cli generate --from baml_src",
"check":           "bun run baml:gen && bun run check:typecheck && bun run check:test",
"build":           "tsc --noEmit"
```

- `check` is the composite the worktree build must run: **baml:gen → typecheck →
  test**. The ticket names exactly this chain.
- `check:committed` (E-008) is wired into the lisa **on-stop** hook (T-008-02)
  and must stay untouched.
- A new `check:head` script will sit alongside `check:committed`, invoking a new
  entry under `src/ci/`.

## The Central Rule (ci-strategy.md) — the boundary that governs placement

> **Check *logic* lives in the app repo as `bun run check:*` scripts.** The
> trigger (Dagger module, or a lisa hook) is a thin shell that only *invokes*.
> Neither the trigger nor Dagger owns the definition of "good" — the scripts do.

`check:head` is a `check:*` script → its logic belongs in `src/ci/`, behind the
script, exactly like `check:committed`. The trigger (T-010-02, wiring to
`on-clear`) is a *separate* ticket and out of scope here. This ticket builds the
logic only.

Also material: the gate runs on the **host** (it needs the real `.git`), never
inside a Dagger container — same reason E-008 is a host-side script, not a `/ci`
sub-class.

## E-010 settled boundaries (from epic/E-010.md, hand-cleared at decompose)

1. **git worktree / temp checkout, NOT Docker.** Adopts the card's own P5
   (local-first) recommendation over the signal's literal "container." A
   single-machine offline tool must not require Docker.
2. **on-clear (ticket boundary), NOT on-stop** — but that is T-010-02's concern.
   T-010-01 builds the isolated-build verb only; it does not wire a trigger.
3. OUT OF SCOPE: it detects, it does not auto-repair; it does not replace
   `check:committed` (different defect class).

## git worktree — the mechanism named by the ticket

`git worktree add --detach <tmp> HEAD` materializes the committed HEAD tree at
`<tmp>` as a second working tree sharing the repo's object store — no re-clone,
no network. In `<tmp>`: `bun install` then `bun run check`. Capture the exit
code. `git worktree remove --force <tmp>` **in all paths** (success / fail /
error) so no worktree leaks. Verified available: `git worktree list` works in
this repo (git ≥ 2.x).

Note: `git worktree add <path>` requires `<path>` to **not already exist** (git
creates it). A `mkdtemp` parent + a non-existent child subpath is the safe idiom.

## Existing process-spawning + temp-dir test precedents

- **`check-committed.ts`** uses `Bun.spawnSync(["git", ...], { cwd })` and reads
  `.stdout/.stderr/.exitCode` — the spawn idiom to reuse.
- **`propose-effect.test.ts`** uses `mkdtemp(join(tmpdir(), "vend-..."))` +
  `writeFile` + `rm` to build a throwaway dir on a real fs, then asserts. This is
  the precedent for an **integration test that builds a synthetic repo** on disk.
- No existing test drives `git worktree`; this ticket introduces the first.

## Source layout facts

- CI gates live in `src/ci/` (`SOURCE_PREFIXES = ["src/", "baml_src/", "ci/"]`).
- `tsconfig.json`: `strict`, `noUncheckedIndexedAccess`, `verbatimModuleSyntax`,
  `allowImportingTsExtensions` → imports use the `.ts` suffix.
- Tests are `bun:test` (`describe/expect/test`), colocated as `*.test.ts`.
- `.gitignore` ignores `node_modules/`, `baml_client/`, `.vend/*` — none of which
  appear in a HEAD checkout's tracked tree (baml_client is regenerated by
  `baml:gen` inside the worktree).

## Constraints & assumptions surfaced

- A full real-repo `check:head` run does `bun install` + `baml:gen` (loads the
  BAML native addon) + `tsc` + `bun test` — **heavy and slow** (~tens of seconds
  to minutes). It must NOT run inside the ordinary `bun test` suite, or it makes
  `check:test` recursive and slow. The integration test therefore needs a
  **cheap synthetic repo**, not the real one.
- The pure classifier must be exercisable without spawning anything; the impure
  verb must be parameterizable enough that a test can point it at a synthetic
  repo with a cheap `check` command (no `bun install`, no BAML addon).
- `Math.random`/`Date.now` are fine in *source* (the prohibition is workflow
  scripts only) — usable for temp-dir uniqueness, though `mkdtemp` already
  guarantees it.
