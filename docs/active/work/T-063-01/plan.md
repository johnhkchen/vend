# T-063-01 — Plan

Ordered, independently verifiable steps. Each is small enough to commit atomically and
leaves the gate (`bun run check` = `tsc --noEmit` + `bun test`) green. Sequenced so pure
cores land tested before the shell that uses them.

## Testing strategy (what proves what)

- **Pure cores** (`formula-core.ts`, `parseSha256Sums` in `release-core.ts`) → fast unit
  tests for format/spelling. These are the highest-leverage tests: they pin the exact
  formula strings and the url shape with no I/O.
- **Shell** (`formula.ts`) → the `formula.smoke.test.ts` integration test runs the REAL
  process against a temp fixture and `ruby -c`-validates the emitted formula. Hermetic.
- **Drift** → the smoke fixture builds its `sha256sums.txt` line with the real `sha256Line`,
  so the test↔production format can't diverge; `version "0.1.0"` is asserted against the
  live `VERSION`.
- **Not unit-testable** → the `release.yml` tap-publish step (cross-repo push, secret,
  network). Verified by reading + flagged in review; the formula *content* it pushes is
  fully covered by the steps above.

## Acceptance criterion → evidence map

> `brew install johnhkchen/vend/vend` on a fresh arm64-mac installs the binary, the
> formula's sha matches the release asset, and `vend --version` then reports the real semver.

| Clause | Evidence produced by this plan |
|--------|-------------------------------|
| formula selects the arm64-mac asset | `releaseAssetUrl` + the single `if OS.mac? && Hardware::CPU.arm?` branch; unit-asserted url; `ruby -c` valid |
| sha matches the release asset | `formula.ts` reads the sha from the *same* `dist/sha256sums.txt` that `package.smoke.test.ts` proves re-verifies against the tarball → no hand-copy, no drift |
| `vend --version` reports the real semver | formula `version` == `VERSION` (asserted); the `test do` block runs `vend --version` and asserts the version at `brew install`/`brew test` time |
| reaches the tap so `brew install johnhkchen/vend/vend` resolves | `release.yml` generate + publish steps push `Formula/vend.rb` to `johnhkchen/homebrew-vend` |

## Steps

### Step 1 — `parseSha256Sums` in release-core (+ test)
Add the inverse of `sha256Line` to `src/release/release-core.ts`: scan lines, split on the
two-space separator, return the 64-lowercase-hex digest for the matching filename, throw a
named error otherwise. Add unit tests to `release-core.test.ts`: round-trips with
`sha256Line`, returns the digest for the right name when several lines are present, throws
on a missing name and on a non-hex/garbled digest.
**Verify:** `bun test src/release/release-core.test.ts` green; `tsc --noEmit` clean.
**Commit:** `feat(T-063-01): parse a digest back out of sha256sums.txt`.

### Step 2 — `formula-core.ts` (+ test)
Create the pure renderer: constants (`FORMULA_CLASS`, `FORMULA_DESC`, `HOMEPAGE`,
`REPO_SLUG`, `LICENSE_SPDX`), `releaseAssetUrl({version, tarball})`, and
`renderFormula({version, url, sha256})` producing the collapsed arm64-mac formula with a
`test do` block and no livecheck/aliases/pkgshare. Create `formula-core.test.ts`:
`releaseAssetUrl` exact string; rendered text contains class/desc/homepage/version/url/sha/
license/`bin.install "vend"`/`test do`; rendered text does **not** contain `livecheck` or
`BINARY_ALIASES`; exactly one `url`/`sha256` (one platform branch).
**Verify:** `bun test src/release/formula-core.test.ts` green; `tsc --noEmit` clean.
**Commit:** `feat(T-063-01): pure Homebrew-formula renderer + asset-url builder`.

### Step 3 — `formula.ts` shell
Create the impure shell mirroring `package.ts`: resolve repo root; read pin →
`requireKey(RELEASE_TARBALL)`; import `VERSION`; read `<distDir>/sha256sums.txt` →
`parseSha256Sums`; `releaseAssetUrl` + `renderFormula`; `Bun.write` to
`<distDir>/vend.rb` (or `--out`). Exit codes 0/2 with the sibling's stderr voice
("run `bun run package` first" on a missing sums file). `import.meta.main`-guarded.
**Verify:** `tsc --noEmit` clean (behavior proven in Step 4).
**Commit:** `feat(T-063-01): formula shell — read pin+sha, write dist/vend.rb`.

### Step 4 — `formula.smoke.test.ts`
Create the integration test: `mkdtemp`, write a fixture `sha256sums.txt` via the real
`sha256Line`, run the real `formula.ts` against it, assert exit 0 + the `dist/vend.rb`
content (class/version/url/sha/license/`bin.install`/`test do`/no `livecheck`), and
`ruby -c` the output for valid syntax. Add the missing-sums precondition test (exit 2).
`afterAll` cleanup.
**Verify:** `bun test src/release/formula.smoke.test.ts` green.
**Commit:** `test(T-063-01): smoke — real formula render + ruby -c syntax check`.

### Step 5 — wire `package.json` + `justfile`
Add the `"formula"` script; add the `formula:` recipe and extend `release-local: compile
package formula`. 
**Verify:** `bun run formula` (after a `bun run compile && bun run package`, or against an
existing `dist/sha256sums.txt`) writes a `ruby -c`-valid `dist/vend.rb`; `just --list`
shows the recipe.
**Commit:** `chore(T-063-01): wire formula into package.json + justfile`.

### Step 6 — `release.yml` tap-publish steps
After `Create GitHub release`, add: a `bun run formula` step, then a publish step that
clones `johnhkchen/homebrew-vend` with `HOMEBREW_TAP_TOKEN`, copies `dist/vend.rb` →
`Formula/vend.rb`, commits `vend $GITHUB_REF_NAME`, pushes. Keep the block faithful and
minimal; comment the secret prerequisite.
**Verify:** read-through against lisa's own-tap pattern; `set -euo pipefail` present; the
token env is on the publish step only.
**Commit:** `ci(T-063-01): publish vend.rb to the homebrew-vend tap on release`.

### Step 7 — full gate + end-to-end render
Run `bun run check` (typecheck + all tests). Then a real local render:
`bun run compile && bun run package && bun run formula`, and confirm `dist/vend.rb` carries
the real sha (matching `dist/sha256sums.txt`) and passes `ruby -c`. Record the by-hand
result in `progress.md`.
**Verify:** whole gate green; rendered formula's `sha256` == the line in `sha256sums.txt`.

## Risks & mitigations
- **Cross-repo push needs a real tap + token.** The `homebrew-vend` repo and
  `HOMEBREW_TAP_TOKEN` secret don't exist yet — a release-time/manual prerequisite, flagged
  in review. Does not block any of Steps 1–5 (all hermetic).
- **`ruby -c` only checks syntax, not `brew audit` semantics.** A full `brew style`/`audit`
  needs the tap installed + network; syntax + content assertions are the hermetic proxy.
  Flag the gap.
- **`version "0.1.0"` is the current `VERSION`.** The smoke test asserts against the live
  `VERSION` import (not a hard-coded `0.1.0`) so a future bump won't red the test falsely.
