# T-002-01-02 — Progress: test-gate-subclass-and-router

## Status: complete

The `test` gate's **code** is authored, compiles in the `/ci` toolchain, leaves
the app build untouched, and is committed to `main` (`36dbdc6`). Behavioural
proof (`dagger call test run` agrees + can-fail) is T-002-01-03's job, by design.

## Steps executed (against plan.md)

| Step | Plan item | Result |
|------|-----------|--------|
| 1 | Write `ci/src/test.ts` + route in `ci/src/index.ts` | ✅ Test sub-class + one `@func() test(): Test` |
| 2 | Generate `sdk/` via one deliberate `dagger develop` (guarded) | ✅ sdk/ created; engine stayed `v0.21.4` (no bump); no tracked config mutated |
| 3 | Compile in `/ci` toolchain | ✅ `bunx tsc --noEmit -p tsconfig.json` → exit 0 |
| 4 | Prove app build untouched | ✅ `check:typecheck` exit 0; `check:test` 229 pass / 0 fail |
| 5 | Commit atomically | ✅ `36dbdc6` — `ci/src/test.ts`, `ci/src/index.ts`, `ci/yarn.lock` |
| 6 | Write progress + review | ✅ this file + `review.md` |

## What was built

```
ci/src/test.ts   (new)  @object() Test · @func() run(source) → Bun container:
                        from oven/bun:1.3.9-slim · mount source (defaultPath "/",
                        ignore node_modules/baml_client/.git) · bun install
                        --frozen-lockfile · bun run baml:gen · bun run check:test
ci/src/index.ts  (mod)  + import { Test } · + func · @func() test(): Test {
                        return new Test() } · header updated. Still a thin router.
ci/yarn.lock     (new)  pins the module's deps (typescript@5.9.3).
ci/sdk/**     (gen, gitignored)  Dagger TS client — NOT committed.
```

## Verification evidence (run on the machine)

- `grep -RnE "from \"\.\.|/src/|@boundaryml" ci/src` → empty: `/ci` imports
  nothing from the app. `index.ts` has exactly **one** real `@func()` decorator.
- `dagger develop -m ci` → success; `cat ci/dagger.json` still `"v0.21.4"`;
  `git diff -- ci/dagger.json ci/package.json ci/tsconfig.json ci/.gitignore
  ci/.gitattributes` → **empty** (codegen mutated no tracked config).
- `git check-ignore ci/sdk` → `ci/sdk` (gitignored, excluded from the commit).
- `cd ci && bunx tsc --noEmit -p tsconfig.json` → **exit 0** (AC4).
- root `bun run check:typecheck` → exit 0; `bun run check:test` → **229 pass /
  0 fail** (identical to the pre-change baseline).
- `@dagger.io/dagger` is in **no** `package.json` deps — resolves via `sdk/`
  path-mapping (predecessor handoff honored).

## Deviations from plan

**Two recorded decisions, no deviation from the deliverable.**

1. **`dagger develop` was run — deliberately, and it was safe.** The plan's
   Decision 2 reconciled the apparent conflict (AC3 "not run *casually*" + ticket
   note "no Docker needed to build it" vs. AC4 "compiles in its own toolchain" +
   the predecessor handoff "first populate `sdk/` via codegen"). The andon guard
   fired clean: CLI `v0.21.4` == pin, so **no bump** (the tool *did* print a
   v0.21.7-available notice — noted, not acted on); only gitignored `sdk/` (and
   `ci/yarn.lock`) appeared; **zero** tracked config files changed. Engine was
   already warm (connect 0.3s), so the ~18s cold-start did not bite this run.

2. **`ci/yarn.lock` is committed (new, not gitignored).** It appeared from
   `dagger develop` and is the module's dependency lockfile. T-002-01-01's
   structure had grouped it with codegen artifacts ("absent until first
   developed — a reviewed step downstream"); this ticket is that reviewed step.
   **Decision: track it.** Rule applied — *generated code* is gitignored
   (`sdk/`, like the app's `baml_client/`); *lockfiles are committed* (the repo
   already tracks the app's `bun.lock`). It is 8 lines (pins `typescript@5.9.3`),
   deterministic, no machine-specific paths. Pinning the module's deps fits the
   project's pin-everything ethos (engine pinned, Bun pinned, `bun.lock` tracked).
   Flagged here so a reviewer can object; `git rm --cached ci/yarn.lock` +
   a `/yarn.lock` gitignore line reverses it cheaply if preferred.

## Commit

- `36dbdc6` — `T-002-01-02: /ci test gate — Test sub-class invokes
  bun run check:test` (`ci/src/test.ts`, `ci/src/index.ts`, `ci/yarn.lock`).

## Handoff to T-002-01-03 (verify-no-drift)

- **Invocation:** the router uses the sub-object pattern, so the leaf is
  `dagger call test run` (chained), not bare `dagger call test`. Source binds via
  `@argument({ defaultPath: "/" })`; override with `--source=.` from the repo
  root if needed.
- **Verify the surfaced assumption:** that `defaultPath: "/"` resolves to the
  **git repo root** (the app), not `/ci`. If the default mounts the wrong root,
  pass `--source=.` explicitly. This ticket could not exercise it (no run).
- **Validate the prep in-container at runtime:** `bun install --frozen-lockfile`
  → `bun run baml:gen` → `bun run check:test`. Confirm the linux `baml` native
  binary generates `baml_client/` cleanly inside `oven/bun:1.3.9-slim`; if it
  needs more libs, that is prep tuning T-003 owns, not a change to the *check*.
- **Cold-start:** the engine may be cold for T-003 (~18s `connect`); record the
  run time and the standalone-vs-container agreement + the deliberately-broken
  can-fail proof, per its ACs.
