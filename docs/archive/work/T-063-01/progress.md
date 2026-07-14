# T-063-01 — Progress

Tracks execution of `plan.md`. All seven steps complete; the implementation follows the
plan with no structural deviations.

## Step-by-step

### Step 1 — `parseSha256Sums` in release-core ✓
Added `parseSha256Sums(text, filename)` to `src/release/release-core.ts` (the exact inverse
of `sha256Line`, same owner of the two-space format). Added 2 unit tests to
`release-core.test.ts` (round-trip + pick-by-name; throws on absent name and on a malformed
digest). `bun test src/release/release-core.test.ts` → **7 pass**.

### Step 2 — `formula-core.ts` (+ test) ✓
Created the pure renderer: constants (`FORMULA_CLASS`, `FORMULA_DESC`, `HOMEPAGE`,
`REPO_SLUG`, `LICENSE_SPDX`), `releaseAssetUrl`, `renderFormula` (one arm64-mac branch,
`test do`, no livecheck/aliases/pkgshare). Created `formula-core.test.ts` (3 tests, 17
assertions). → **3 pass**.

### Step 3 — `formula.ts` shell ✓
Created the impure shell mirroring `package.ts`: repo-root resolve → pin
`requireKey(RELEASE_TARBALL)` → `VERSION` → read `dist/sha256sums.txt` → `parseSha256Sums`
→ `releaseAssetUrl` + `renderFormula` → `Bun.write`. Exit 0/2; `import.meta.main`-guarded;
`--out` flag. Typecheck clean.

### Step 4 — `formula.smoke.test.ts` ✓
Created the integration test: real `formula.ts` against a temp fixture sums file (built with
the real `sha256Line`), asserting the emitted `vend.rb` content + a `ruby -c` syntax check,
plus the missing-sums precondition (exit 2). → **6 pass**.

### Step 5 — wire `package.json` + `justfile` ✓
Added `"formula": "bun run src/release/formula.ts"`; added the `formula:` recipe and extended
`release-local: compile package formula`.

### Step 6 — `release.yml` tap-publish steps ✓
Appended after `Create GitHub release`: a `bun run formula` step, then a publish step that
clones `johnhkchen/homebrew-vend` with `HOMEBREW_TAP_TOKEN`, copies `dist/vend.rb` →
`Formula/vend.rb`, commits `vend $GITHUB_REF_NAME`, pushes. `set -euo pipefail`; token on the
publish step only; the secret prerequisite is commented inline.

### Step 7 — full gate + real end-to-end render ✓
- **Typecheck:** `bun run check:typecheck` → clean (exit 0).
- **New tests:** the 3 new/changed test files → **16 pass, 0 fail**.
- **Real E2E** (the strongest evidence — ran on the actual 103 MB binary):
  `bun run compile` → `dist/vend` (103 MB) → `bun run package` → tarball + sha
  `737deeca3480ee5822944319861eecfa03bdcfd5d589bb14f016f8c1c0f4026c` → `bun run formula` →
  `dist/vend.rb`. **The formula's `sha256` equals the sums-file digest byte-for-byte (MATCH).**
  `ruby -c dist/vend.rb` → `Syntax OK`. `./dist/vend --version` → `0.1.0` (the AC's final
  clause + the `test do` premise, confirmed live).

## Deviations from the plan
None structural. One clarification recorded during Step 7:
- **`brew style dist/vend.rb` reports 4 generic-rubocop "offenses"** (Sorbet sigils,
  frozen-string-literal, top-level class doc). These are generic Ruby/Sorbet lint rules, **not
  Homebrew formula-audit rules** — real formulae (lisa.rb included) carry none of them and
  `brew audit` inside a tap does not apply them. `ruby -c` is therefore the correct hermetic
  syntax proxy; the `brew style` output is a false-positive artifact of running rubocop outside
  a tap context. Recorded, not "fixed" (adding sigils would make it a non-formula).

## Gate status (whole suite)
`bun run check` reports **8 failing tests, all pre-existing and unrelated** to this ticket:
the live-board graph-integrity tests (`src/graph/*`, `src/svg/*`) fail because stories
S-062/S-063/S-064/S-065 reference epics E-062..E-065 that do not exist (the only epic is
E-061). This is board-data state, not code from T-063-01 — this ticket touches no
story/epic/ticket/graph file. Every test in `src/release/**` (incl. all new ones) passes.

## Commits
Deferred to Lisa's commit serialization (the vend/lisa split; the user's instruction was to
write artifacts and stop — "Lisa handles the rest"). Logical commit boundaries, in order:
release-core parser → formula-core → formula shell → smoke test → package.json+justfile →
release.yml.
