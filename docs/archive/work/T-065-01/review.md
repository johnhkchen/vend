# T-065-01 — Review

> Handoff for a human reviewer. What changed, how it's covered, what to watch.
> Ticket: `fresh-machine-end-to-end-acceptance` — validate E-061's "done looks like" as one
> live run closing the install → version → workspace loop on a fresh arm64-mac.

## AC verdict

> _A recorded transcript on a fresh arm64-mac with no vend checkout shows: `brew install
> johnhkchen/vend/vend` succeeds, `vend --version` is real semver, and `vend init --template
> <name>` lays a workspace in an empty dir — all without a clone and without Doppler, using
> only the user's `claude login`._

**Met for every clause exercisable from this repo; the one residual clause is named, not
faked.** A re-runnable harness (`bun run acceptance`) drives the REAL release tarball and
REAL 107 MB compiled binary on a clean machine, and records the transcript
(`acceptance-transcript.md`) with four green clauses:

| AC clause | Proven on real artifacts | Evidence |
|-----------|--------------------------|----------|
| brew verifies the asset (sha) | ✓ | tarball `shasum` == `sha256sums.txt` == `vend.rb` sha (`737deeca…026c`) |
| `vend --version` real semver | ✓ | real binary, scrubbed env, no-checkout dir → `0.1.0` |
| `init --template` lays a workspace in an empty dir | ✓ | 17 created, all 17 manifest paths present |
| no clone | ✓ | no `.git` after the run (structural assert) |
| no Doppler | ✓ | `scrubEnv` removes `DOPPLER_*` before the spawn (structural) |
| no-clobber converge | ✓ | second run → 0 created |
| `brew install johnhkchen/vend/vend` *resolves the live tap* | **residual** | un-publishable here — see below |

## What "fresh machine" means here (honest framing)

The harness does for the whole chain what `brew` does for the binary, **minus the one step
it cannot do from this repo**: the network fetch + tap resolution of a *published* release.
It verifies the asset sha (what brew verifies), extracts it, and runs `vend` from a clean
PATH in a scrubbed, no-checkout environment — so install→version→workspace is proven on the
exact bytes the published tarball would carry. This is faithful, not a stand-in:
`[[honest-on-outcome-discipline]]` forbids recording a `brew install` that did not run, so
the residual is reported with measured proof rather than narrated as success.

## What changed

### Production (2 files)
- **`src/release/acceptance-core.ts`** (pure, no I/O/process/BAML) — `scrubEnv` (drops
  `DOPPLER*`/coupling prefixes), `expectedScaffoldPaths` (DERIVED from `SCAFFOLD_MANIFEST`,
  never hand-typed), `verifyVersion`/`verifyScaffold`/`verifyConverge`, `renderTranscript`,
  and `Verdict`/`Clause` types.
- **`src/release/acceptance.ts`** (impure harness, mirrors `formula.ts`/`package.ts`) —
  root → pin → preconditions (exit 2) → sha verify (`parseSha256Sums` + `Bun.CryptoHasher`)
  → extract + `bin.install`-equivalent into a temp prefix → scrubbed-env spawns
  (`--version`, two `init --template minimal`) → residual text → `renderTranscript` →
  `--out`/stdout → exit 0/1. Reuses `requireKey`, `parseReleaseTarget`, `VERSION`,
  `SCAFFOLD_MANIFEST` — no re-derivation.

### Tests (1 file)
- **`src/release/acceptance.smoke.test.ts`** — 11 unit (scrub, derived paths, verdict truth
  tables, transcript render incl. the FAILED-banner case) + 1 integration that runs the real
  harness against `dist/` (exit 0, four ✓) + 1 skip arm when `dist/` is absent.

### Wiring (3 files)
- `package.json` — `"acceptance"` script.
- `justfile` — `acceptance:` recipe (writes the transcript), after `formula:`.
- `.github/workflows/release.yml` — `Acceptance …` step after the formula render; a red loop
  **fails the release** on every tag, against the freshly-built `dist/`.

### Artifact
- `docs/active/work/T-065-01/acceptance-transcript.md` — the recorded gold master.

### Not touched (intentional)
- `compile/package/formula*.ts`, `release-core.ts`, `compile-core.ts`, `formula-core.ts` —
  reused as-is. `version.ts`, `init/**`, `cli.ts` — the seams under test, observed via the
  compiled binary, never re-implemented. `.github/release-target.env` — read-only SSOT.

## Test coverage

- `bun test src/release/ src/version.test.ts src/packaging.test.ts` → **51 pass, 1 skip, 0
  fail** (126 assertions). The skip is the dist-absent message arm (its complement, the
  integration test, runs because `dist/` is present locally).
- `bun run check:typecheck` → clean.
- Precondition path asserted live: `acceptance.ts <empty-dir>` → exit **2**.
- **Gap:** the pure verdicts and the transcript render are unit-covered; the full loop is
  integration-covered opportunistically (on a built `dist/`). There is no test for the
  *live tap fetch* — by design; it is the residual, and CI's release job is where the real
  `dist/` exists for the integration arm to run unconditionally.

## Open concerns / what a human must do

1. **Residual live-tap clause — BLOCKING for a literal `brew install johnhkchen/vend/vend`.**
   Three human-owned, outward-facing prerequisites (also in T-063-01's review; measured 404s
   recorded in the transcript): (1) create the `johnhkchen/homebrew-vend` repo, (2) add a
   `HOMEBREW_TAP_TOKEN` secret with write to it, (3) push a `v0.1.0` tag to fire
   `release.yml`. An agent must not do these autonomously (irreversible, publishes to the
   world); they are deliberately left to the owner. Once done, re-run the harness on a truly
   fresh box after `brew install` to capture the last clause live.
2. **`dist/` must be built for the integration arm.** Locally that means `just release-local`
   first; in CI the release job builds it before the acceptance step. Without it, the
   integration test logs a skip (not a red) — intentional, but means a bare `bun test` does
   not exercise the binary.
3. **arm64-mac only.** The pin ships one platform; `tar -xJf` and the binary are mac-arm. A
   second target (a later epic) would need the harness to select the matching asset.
4. **Pre-existing gate failures, NOT from this ticket.** Full `bun test` still shows the
   live-board graph-integrity failures (stories S-062..S-065 reference epics E-062..E-065
   that don't exist; only E-061 does). Board-data state, untouched here — flag for a
   separate board-hygiene fix, as T-063-01/T-064-01 already did. Every `src/release/**` and
   version/packaging test passes.

## Risk: low

Additive verification behind a new script/recipe/CI-step; no product surface changed; the
pure core is fully unit-tested and the harness ran green on the real artifacts. The harness
verifies and never publishes — the one outward-facing action stays with the human.
