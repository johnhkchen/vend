# T-062-02 — Plan

_Phase: Plan. Ordered, independently-verifiable steps + the testing strategy._

## Testing strategy (what proves what)

| Obligation (AC) | Test | Kind |
|-----------------|------|------|
| pin read by key, no hard-coded triple | `compile-core.test.ts` — `parseReleaseTarget`, `requireKey`, live-pin drift guard | pure unit |
| build command is stable/correct | `compile-core.test.ts` — `compileArgv` exact vector | pure unit |
| `vend --version` → real semver from a no-checkout dir | `compile.smoke.test.ts` — `--version` case | heavy integration |
| BAML-backed path proves the native addon loads | `compile.smoke.test.ts` — `doctor` case (`✓ BAML native addon loadable`) | heavy integration |
| producer is wired & usable | `bun run compile` → `dist/vend`; manual empty-dir spot check | manual / commit-time |

The smoke test is the AC, observed; the core tests guard the SSOT + the flag spelling; the
manual `bun run compile` confirms the wired surface. The smoke test doubles as the **canary** for
"Bun stops auto-embedding the addon."

## Step sequence (each step commits atomically)

### Step 1 — Pure core + its units
- Create `src/release/compile-core.ts`: `PIN_PATH`, `REQUIRED_KEY`, `CLI_ENTRY`,
  `DEFAULT_OUTFILE`, `parseReleaseTarget`, `requireKey`, `compileArgv`. No I/O, no BAML.
- Create `src/release/compile-core.test.ts`: parse fixture (comments/blanks/`=`-in-value),
  `requireKey` present/absent, `compileArgv` exact vector, live-pin drift guard
  (`BUN_COMPILE_TARGET === "bun-darwin-arm64"`).
- **Verify:** `bun test src/release/compile-core.test.ts` green; `tsc --noEmit` clean.
- **Commit:** `feat(T-062-02): pin-reading + bun-build argv core`.

### Step 2 — The producer shell + wiring
- Create `src/release/compile.ts`: `import.meta.main` shell — git-root resolve, read pin,
  parse, `requireKey`, mkdir `dist/`, `Bun.spawnSync(compileArgv(...), {stdout/stderr:"inherit"})`,
  success line, documented exit codes (0/1/2). Header in the `check-committed.ts` style.
- Modify `package.json`: add `"compile": "bun run src/release/compile.ts"`.
- Modify `Justfile`: add the `compile` recipe.
- **Verify:** `bun run compile` exits 0 and writes `dist/vend` (~103 MB); `tsc --noEmit` clean.
  Manual: from a fresh empty temp dir, `dist/vend --version` → semver, `dist/vend doctor` →
  `✓ BAML native addon loadable`.
- **Commit:** `feat(T-062-02): compile producer reads pin, emits dist/vend`.

### Step 3 — The AC integration proof
- Create `src/release/compile.smoke.test.ts`: read live pin → target; `beforeAll` compiles real
  `src/cli.ts` via `compileArgv` to a `mkdtemp` binary; `--version` case (semver `=== VERSION`)
  and `doctor` case (`✓ BAML native addon loadable`, no exit-code assert), both with
  `cwd: <empty mkdtemp>`; cleanup in `afterAll`; 60 s timeout.
- **Verify:** `bun test src/release/compile.smoke.test.ts` green (cold + warm).
- **Commit:** `test(T-062-02): compiled binary self-loads BAML from an empty dir`.

### Step 4 — Full-gate + honesty pass
- Run `bun run check` (typecheck + full test). Confirm the new tests pass and **no new**
  failures beyond the ~8 pre-existing reds (T-062-01 review baseline). Reproduce the baseline by
  noting the same failing set, so any *new* red is attributable.
- Confirm `git status` shows only this ticket's files (siblings on the shared branch untouched).
- **Commit (if needed):** any lint/format fixups — `chore(T-062-02): gate green`.

## Verification commands

```bash
bun test src/release/compile-core.test.ts      # Step 1
bun run compile && ls -lh dist/vend            # Step 2 (producer)
D=$(mktemp -d); (cd "$D" && /abs/dist/vend --version && /abs/dist/vend doctor)  # manual AC
bun test src/release/compile.smoke.test.ts     # Step 3 (AC, automated)
bun run check                                  # Step 4 (gate)
```

## Risks & mitigations

- **Cold-compile flake in CI.** The compile reads a 45 MB addon and writes ~103 MB. *Mitigation:*
  60 s timeout; compile once in `beforeAll`, not per-assertion.
- **`doctor` exit code is host-dependent.** lisa/claude may be absent on CI → exit 1.
  *Mitigation:* assert the BAML **line** (`✓ BAML native addon loadable`), never the exit code —
  the line is PATH-independent (`doctor-cli.smoke.test.ts` discipline).
- **Bun version floor.** Pin says `1.3.9`; dev box `1.3.8` compiled fine. *Mitigation:* the CI
  pin (`BUN_VERSION`) is T-062-03's job; nothing here regresses below the working local version.
- **Pin drift.** If `.github/release-target.env` changes shape, the core drift-guard reds
  immediately — caught in the gate, not at release time.
- **Disk in temp.** Two ~103 MB writes during the smoke test; cleaned in `afterAll`/`finally`.
  Acceptable, and consistent with the existing compile test (`version.test.ts`).

## Done means

- `src/release/{compile-core.ts, compile.ts, compile-core.test.ts, compile.smoke.test.ts}` exist.
- `package.json` + `Justfile` expose `compile`.
- `bun run compile` → a working `dist/vend`; the binary self-loads BAML from an empty dir.
- New tests green; no new gate reds; only this ticket's files in the commit set.
- `review.md` written (changes, coverage, open concerns).
