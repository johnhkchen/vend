# T-065-01 — Structure

The blueprint for Option D: a re-runnable clean-machine acceptance harness. File-level
changes, module boundaries, public interfaces, ordering. Not code.

## Files

### Created

#### `src/release/acceptance-core.ts` — PURE (no I/O, no process, no BAML)
The judgment the harness defers to, so it is unit-testable. Exports:
- `const REPO_COUPLING_PREFIXES: readonly string[]` — `["DOPPLER", "VEND_", …]`: env var
  name prefixes a fresh-machine run must NOT carry. (Doppler is the AC's named one;
  others guard against accidental repo coupling leaking into the spawn.)
- `scrubEnv(env: Record<string, string|undefined>): Record<string,string>` — return a copy
  with every key whose name starts with a coupling prefix removed, and `undefined` values
  dropped. The structural proof of "no Doppler" — the spawn cannot read what isn't there.
- `expectedScaffoldPaths(manifest = SCAFFOLD_MANIFEST): readonly string[]` — derive the
  workspace paths a `minimal` run must lay (import `SCAFFOLD_MANIFEST` from `init-core`, so
  the expectation cannot drift from what `init` actually writes). `minimal`'s overlay is
  empty, so the expected set IS the base manifest's paths.
- `verifyVersion(stdout: string, expected: string): Verdict` — trim-compare.
- `verifyScaffold(opts: {created: number; presentPaths: readonly string[]; hasGit: boolean;
  expected: readonly string[]}): Verdict` — created > 0, every expected path present, no
  `.git`.
- `verifyConverge(stdout: string): Verdict` — the second run reports "0 created".
- `type Verdict = { ok: boolean; detail: string }`; `type Clause = { id: string; title:
  string; verdict: Verdict }`.
- `renderTranscript(opts: {version: string; sha: string; tarball: string; clauses:
  readonly Clause[]; residual: string}): string` — the markdown transcript text (pure
  string assembly), including the all-clear/failed banner and the RESIDUAL-GAP section.
  Keeping render pure means the smoke test can assert the transcript without running a
  spawn.

#### `src/release/acceptance.ts` — IMPURE shell (mirrors `formula.ts`/`package.ts`)
`import.meta.main`-guarded. Order of operations:
1. Parse argv: optional positional `distDir`, optional `--out <path>` (the inline two-flag
   parse, the `formula.ts` idiom — no tested core for two flags).
2. `git rev-parse --show-toplevel` → `root`; `distDir ??= <root>/dist`.
3. Read the pin (`PIN_PATH`, `parseReleaseTarget`, `requireKey(TARBALL_KEY)`) → `tarball`.
4. **Preconditions** (each → exit `2` with a "run `just release-local` first" message):
   `dist/<tarball>`, `dist/<SHA256SUMS>`, `dist/vend.rb`, and the extracted `vend` member
   exist.
5. **Verify (brew's sha gate, on real bytes):** `expectedSha = parseSha256Sums(sums,
   tarball)`; `actualSha = sha256(tarball bytes)`; `formulaSha = /[0-9a-f]{64}/.exec(vend.rb)`.
   All three equal → clause `sha`. (Reuse Bun's `crypto`/`Bun.CryptoHasher` for the digest.)
6. **Install like brew:** `mkdtemp` a machine root; `tar -xJf <tarball> -C <prefix>`; copy
   `<prefix>/vend` → `<bin>/vend`, `chmod +x`. (`tarArgv` is for *writing*; extraction is a
   direct `tar -xJf` spawn — documented inline.)
7. **Clean-machine spawns** with `env = scrubEnv(process.env)`, `PATH = <bin>:/usr/bin:/bin`,
   `cwd = <empty workdir>`:
   - `vend --version` → `verifyVersion` → clause `version`.
   - `vend init --template minimal` → read workdir tree → `verifyScaffold` → clause `init`.
   - `vend init --template minimal` again → `verifyConverge` → clause `converge`.
8. **Residual gap:** compose the live-tap text (the three prerequisites + that the harness
   cannot publish). NOT a clause (not pass/fail here) — an explicit handoff section.
9. `renderTranscript(...)`; if `--out`, `Bun.write` it; else print to stdout. Exit `0` if
   every clause `ok`, else `1`. Always clean up the temp machine root.

#### `src/release/acceptance.smoke.test.ts`
- **Unit (always):** `scrubEnv` drops `DOPPLER_*`/coupling, keeps `PATH`/`HOME`;
  `expectedScaffoldPaths` equals the `SCAFFOLD_MANIFEST` paths; `verifyVersion`/
  `verifyScaffold`/`verifyConverge` truth tables; `renderTranscript` contains the banner +
  residual section + every clause id.
- **Integration (opportunistic):** if `dist/<tarball>` AND `dist/vend` exist, run
  `acceptance.ts --out <tmp>` and assert exit `0` + the transcript's all-clear banner + the
  four clause ✓. Else `log()` a clear skip ("no dist/ — run `just release-local`"); CI's
  release job builds `dist/` first, so CI always runs the integration arm.

#### `docs/active/work/T-065-01/acceptance-transcript.md`
The recorded artifact — the real harness output captured during Implement (the gold
master). Carries the four green clauses + the residual live-tap section with the measured
404s.

### Modified

- `package.json` — add `"acceptance": "bun run src/release/acceptance.ts"` to `scripts`
  (beside `formula`).
- `justfile` — add an `acceptance:` recipe (runs the harness against `dist/`, writes the
  transcript) after the `formula:` recipe; note it follows `release-local`.
- `.github/workflows/release.yml` — add one step after "Render the Homebrew formula":
  **"Acceptance — fresh-machine install→version→workspace loop (T-065-01)"** →
  `bun run acceptance`. Runs on the just-built `dist/`; a red loop fails the release.

### Not touched (intentional)
- `src/release/{compile,package,formula}*.ts`, `release-core.ts`, `compile-core.ts`,
  `formula-core.ts` — reused as-is; the harness imports their pure exports.
- `src/version.ts`, `src/init/**`, `src/cli.ts` — the seams under test; observed via the
  compiled binary, never re-implemented.
- `.github/release-target.env` — read-only SSOT.

## Module boundaries & ordering

```
acceptance-core.ts  (pure: scrub, expectedPaths, verdicts, renderTranscript)
        ▲
        │ imports                       imports SCAFFOLD_MANIFEST ← init-core.ts
acceptance.ts  (impure: spawn binary, fs, transcript) ── reuses ──▶ release-core, compile-core, version
        ▲
        │ runs / asserts
acceptance.smoke.test.ts
```

Build order: (1) `acceptance-core.ts` + its unit tests green; (2) `acceptance.ts` shell;
(3) run it against the live `dist/` → capture `acceptance-transcript.md`; (4) integration
arm of the smoke test; (5) wire `package.json` / `justfile` / `release.yml`. Each step is
independently committable and verifiable.

## Public-interface invariants
- `acceptance-core.ts` stays I/O-free and BAML-free (so `bun --compile` and fast unit runs
  never drag the executor graph) — the `version.ts`/`*-core.ts` rule.
- `expectedScaffoldPaths` derives from `SCAFFOLD_MANIFEST` — never a hand-typed path list
  (the no-drift rule the whole release chain follows).
- The harness VERIFIES; it never publishes a tap or cuts a release (the human boundary).
