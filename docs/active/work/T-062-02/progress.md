# T-062-02 — Progress

_Phase: Implement. What was completed, what remains, deviations._

## Completed (all plan steps)

### Step 1 — Pure core + units ✓
- `src/release/compile-core.ts`: `PIN_PATH`, `REQUIRED_KEY`, `CLI_ENTRY`, `DEFAULT_OUTFILE`,
  `parseReleaseTarget`, `requireKey` (throws on missing — the SSOT contract), `compileArgv`.
- `src/release/compile-core.test.ts`: 5 tests — parse (comments/blanks/`=`-in-value), empty
  blob, `requireKey` present/absent/blank, `compileArgv` exact vector, **live-pin drift guard**
  (`BUN_COMPILE_TARGET === "bun-darwin-arm64"` + `CLI_ENTRY` exists).
- **Verified:** `bun test src/release/compile-core.test.ts` → 5 pass; `tsc --noEmit` → exit 0.

### Step 2 — Producer shell + wiring ✓
- `src/release/compile.ts`: the `import.meta.main` shell — git-root resolve, read+parse the pin,
  `requireKey`, mkdir `dist/`, `Bun.spawnSync(compileArgv(...))` with inherited stdio, success
  line, documented exit codes (0 built / 1 build-failed / 2 precondition).
- `package.json`: added `"compile": "bun run src/release/compile.ts"`.
- `justfile`: added the `compile` recipe.
- **Verified:** `bun run compile` → exit 0, wrote `dist/vend` (**103 MB**) for `bun-darwin-arm64`
  (bundle 85 modules, ~0.15 s). Manual empty-temp-dir spot check:
  - `dist/vend --version` → `0.1.0`, exit 0.
  - `dist/vend doctor` → `✓ BAML native addon loadable`, exit 0.

### Step 3 — AC integration proof ✓
- `src/release/compile.smoke.test.ts`: `beforeAll` compiles the **real `src/cli.ts`** for the
  pin-read target to a `mkdtemp` binary; two cases run it with `cwd:` a separate empty `mkdtemp`
  dir — `--version` (semver `=== VERSION`, `!== "0.0.0"`) and `doctor` (`✓ BAML native addon
  loadable`, no exit-code assert). 90 s `beforeAll` timeout; `afterAll` cleans both temp dirs.
- **Verified:** `bun test src/release/compile.smoke.test.ts` → 2 pass (~1.4 s).

### Step 4 — Full gate + honesty pass ✓
- `bun test` → **1365 pass / 9 fail** across 85 files. All 9 failures are in files this ticket
  did NOT author (see Review §open concerns):
  - 7 = the documented pre-existing graph-corruption cascade (stories `S-062..S-065` reference
    not-yet-minted epics `E-062..E-065`): `loadWorkGraph` live smoke, `T-021-05/06/08`,
    `one-way authority` ×2, `writeBoardSvg` ×2.
  - 1 = `runInit — template overlay (T-058-01)` — a **sibling thread's** in-flight change to
    `src/init/` (shown as `M src/init/init-core.ts` in the shared working tree), not mine.
  - The 9th vs T-062-01's "8" baseline is exactly that sibling `runInit` delta.
- My 7 new tests (5 core + 2 smoke) all pass. **No new failures attributable to T-062-02.**

## Deviations from plan

- **No git commit performed.** Plan Step n had per-step commits, but the working tree is shared
  with concurrent Lisa threads (`package.json`, `src/cli.ts`, `justfile`, `src/init/*` all carry
  *other* threads' uncommitted changes). A clean "own-files-only" commit of the shared
  `package.json` hunk isn't safely separable from siblings' interleaved hunks. Per the user's
  instruction ("simply stop — Lisa handles the rest") and the RDSPI concurrency model (commit
  serialization via Lisa's file locking), commits are deferred to the orchestrator. My own new
  files (`src/release/**`, `docs/active/work/T-062-02/**`) and additive edits (the `compile`
  script line; the `compile` recipe) are isolated and gate-verified.

## Artifacts produced

| File | Action |
|------|--------|
| `src/release/compile-core.ts` | created |
| `src/release/compile-core.test.ts` | created |
| `src/release/compile.ts` | created |
| `src/release/compile.smoke.test.ts` | created |
| `package.json` | modified (+`compile` script) |
| `justfile` | modified (+`compile` recipe) |
| `dist/vend` | produced (gitignored build artifact, 103 MB) |
