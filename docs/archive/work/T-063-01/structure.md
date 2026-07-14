# T-063-01 — Structure

The file-level blueprint for Option B. Shape, not code. Mirrors the T-062-02/03 split
(pure core + impure shell + smoke test + script + recipe + CI step) so vend.rb is a
*derived* artifact whose sha is read, never typed.

## Files at a glance

**Created**
- `src/release/formula-core.ts` — PURE renderer + url builder + formula constants.
- `src/release/formula-core.test.ts` — unit tests for the renderer/url.
- `src/release/formula.ts` — impure shell: reads pin + VERSION + sha, writes `dist/vend.rb`.
- `src/release/formula.smoke.test.ts` — runs the real shell vs. a fixture, `ruby -c` checks.

**Modified**
- `src/release/release-core.ts` — add `parseSha256Sums` (inverse of `sha256Line`).
- `src/release/release-core.test.ts` — add `parseSha256Sums` unit tests.
- `package.json` — add `"formula": "bun run src/release/formula.ts"`.
- `justfile` — add `formula:` recipe; extend `release-local` to `compile package formula`.
- `.github/workflows/release.yml` — add formula-generate + tap-publish steps.

**Untouched (intentional):** `.github/release-target.env` (SSOT, read-only — already
carries every key the url/tarball need); `src/release/compile*.ts` and `package*.ts`
(reused as-is); `src/version.ts` (the version SSOT — imported, not changed).

## `src/release/formula-core.ts` (PURE — owns every formula string)

No I/O, no process, no BAML. The single owner of the formula's spelling.

```
// constants (the formula's fixed strings)
FORMULA_CLASS   = "Vend"
FORMULA_DESC    = "Local-first runner for repeatable, gated AI-agent playbooks"
HOMEPAGE        = "https://github.com/johnhkchen/vend"
REPO_SLUG       = "johnhkchen/vend"   // owner of the releases-download host path
LICENSE_SPDX    = "MIT"

// releaseAssetUrl({ version, tarball }): string
//   → `https://github.com/${REPO_SLUG}/releases/download/v${version}/${tarball}`
//   PURE; the single owner of the release-asset URL spelling. Mirrors lisa's url form.

// renderFormula({ version, url, sha256 }): string
//   → the full Ruby formula text, collapsed to the one arm64-mac branch.
//   Structure: class < Formula; desc/homepage/version; `if OS.mac? && Hardware::CPU.arm?`
//   { url; sha256 }; license; `def install` → `bin.install "vend"`; `test do` asserting
//   `version` against `#{bin}/vend --version`. NO livecheck, NO BINARY_ALIASES, NO pkgshare.
```

Public interface: `renderFormula`, `releaseAssetUrl`, and the constants (exported so the
tests assert against the same spelling the renderer uses — no duplicated literals in tests).

## `src/release/release-core.ts` (MODIFIED — add the sha-line inverse)

Add beside `sha256Line` (same owner of the two-space format):

```
// parseSha256Sums(text, filename): string
//   Scan the lines of a sha256sums.txt body for the entry whose filename matches, and
//   return its 64-hex digest. PURE. Throws a typed, message-bearing error if no line
//   matches `filename` or the digest is not 64 lowercase hex. The exact inverse of
//   sha256Line(hash, filename) — split each line on the two-space separator.
```

No other change to the module; existing exports stay put.

## `src/release/formula.ts` (impure shell — mirrors `package.ts` exactly)

`import.meta.main`-guarded. Argv: `bun run src/release/formula.ts [distDir] [--out <path>]`
(default distDir `<repo>/dist`; default out `<distDir>/vend.rb`). Steps, in order:

1. `git rev-parse --show-toplevel` → repo root; non-repo → stderr + **exit 2**.
2. Read `.github/release-target.env`; missing file → exit 2. `requireKey(pin,
   "RELEASE_TARBALL")` for the tarball; missing key → exit 2.
3. `VERSION` imported from `../version.ts`.
4. Read `<distDir>/sha256sums.txt`; missing → stderr ("run `bun run package` first") +
   exit 2. `parseSha256Sums(text, tarball)`; no matching line → exit 2.
5. `url = releaseAssetUrl({ version: VERSION, tarball })`;
   `text = renderFormula({ version: VERSION, url, sha256 })`.
6. `Bun.write(outPath, text)`; print `formula: ok — wrote <out>` to stdout; **exit 0**.

Exit codes match the siblings: **0 = wrote the formula / 1 = (reserved — no
operation-failure path here, kept for parity) / 2 = precondition error**. There is no
network and no tag↔version guard here — the tag check already happened in `package.ts`
upstream; the sha file's existence is the precondition that the asset was packaged.

## `src/release/formula.smoke.test.ts` (real shell vs. fixture, hermetic)

- `beforeAll`: `mkdtemp`; write a fixture `<tmp>/sha256sums.txt` containing
  `sha256Line("<known 64-hex>", "vend-cli-aarch64-apple-darwin.tar.xz")` (built via the
  real `sha256Line` so the fixture format can't drift). Run
  `bun run src/release/formula.ts <tmp>` from repo root; assert exit 0.
- Tests:
  - `dist/vend.rb` exists and is non-empty.
  - content contains `class Vend < Formula`, `version "0.1.0"`, the exact url, the known
    sha, `license "MIT"`, `bin.install "vend"`, a `test do`; and **no `livecheck`**.
  - `ruby -c <out>` exits 0 (valid Ruby syntax) — uses the available `/usr/bin/ruby`.
  - precondition: running against an empty dir (no `sha256sums.txt`) → **exit 2**, stderr
    names `bun run package`.
- `afterAll`: `rm` the temp dir.

## `package.json` (MODIFIED)

Add one script alongside `compile`/`package`:
```
"formula": "bun run src/release/formula.ts"
```

## `justfile` (MODIFIED)

Add a recipe with a header in the existing voice, and extend the local chain:
```
# Generate the Homebrew formula dist/vend.rb from the pinned tarball + the sha in
# dist/sha256sums.txt (run after `package`). Published to the tap by release.yml. (T-063-01)
formula:
    bun run src/release/formula.ts

# Local end-to-end release artifact build: compile, package, then render the formula.
release-local: compile package formula
```

## `.github/workflows/release.yml` (MODIFIED)

After the existing `Create GitHub release` step, append two steps:

1. **Generate the Homebrew formula (T-063-01)** — `run: bun run formula` (reads the
   `dist/sha256sums.txt` just produced by `package`).
2. **Publish vend.rb to the homebrew-vend tap** — `env: GH_TOKEN:
   ${{ secrets.HOMEBREW_TAP_TOKEN }}`; a faithful block: clone
   `https://x-access-token:$GH_TOKEN@github.com/johnhkchen/homebrew-vend.git`, copy
   `dist/vend.rb` → `Formula/vend.rb`, set the actions bot git identity, `git add`/`commit
   -m "vend $GITHUB_REF_NAME"`/`push`. The cross-repo push needs `HOMEBREW_TAP_TOKEN`
   because the default `github.token` cannot write another repo. This is the un-gateable
   final line (cf. `gh release create`), kept minimal and faithful.

## Ordering of changes (so the gate stays green at each step)

1. `release-core.ts` + its test (`parseSha256Sums`) — pure, independently green.
2. `formula-core.ts` + its test — pure, independently green.
3. `formula.ts` shell.
4. `formula.smoke.test.ts` — exercises the shell end-to-end.
5. `package.json` + `justfile` wiring.
6. `release.yml` CI steps (YAML; not gate-tested, verified by reading).

## Boundaries preserved

- **engine ⊥ release:** all new code stays under `src/release/`, BAML-free, so the
  compiled-binary test and the gate never drag the executor graph through it.
- **SSOT-by-key:** no literal tarball/triple in the new code — the tarball is `requireKey`,
  the version is `VERSION`, the sha is parsed. The only hard-coded strings are the formula's
  own fixed text (class/desc/homepage/license/repo slug), which the formula-core *is* the
  owner of.
