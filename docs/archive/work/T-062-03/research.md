# T-062-03 — Research

**Ticket:** task — `release-ci-tarball-sha` (story S-062, epic E-061)
**Goal:** add the absent release CI (`.github/workflows`) that, on a tag, compiles the
binary, tarballs it, computes a sha256, and publishes a GitHub release — mirroring
lisa's verified release mechanism.

Descriptive only — what exists, where, how it connects, and the constraints the
implementation must honor. No solution proposed here.

## The acceptance criterion, read closely

> A tagged run produces a GitHub release whose asset is the arm64-mac tarball plus a
> sha256 that re-verifies against the downloaded tarball.

Three observable clauses:
1. **Trigger:** a *tag* push starts the run (not every push).
2. **Asset:** the release carries the **arm64-mac tarball** — named per the pin's
   `RELEASE_TARBALL` (`vend-cli-aarch64-apple-darwin.tar.xz`).
3. **Verifiable integrity:** a sha256 ships alongside it and **re-verifies** against the
   downloaded tarball — i.e. `shasum -a 256 -c` must pass against the published sums file.

Clause 3 is the substance: the sha must be in the exact format a downloader's
`shasum -c` consumes, computed over the exact bytes that get uploaded.

## What already exists (the foundation this ticket builds on)

This ticket is the **last** of S-062; its two upstream siblings are `done`:

- **T-062-01** (`confirm-first-platform-target`, done) authored the SSOT pin
  `.github/release-target.env`. It already carries **every key this ticket needs**:
  - `BUN_COMPILE_TARGET=bun-darwin-arm64` — the `bun build --compile` triple.
  - `RELEASE_ASSET_TRIPLE=aarch64-apple-darwin` — the Rust/LLVM triple for the asset name.
  - `RELEASE_TARBALL_PREFIX=vend-cli`
  - `RELEASE_TARBALL=vend-cli-aarch64-apple-darwin.tar.xz` — the **final asset name**.
  - `CI_RUNNER=macos-14` — the pinned Apple-Silicon runner.
  - `BUN_VERSION=1.3.9` — the bun to install in CI.
- **T-062-02** (`compile-self-contained-binary`, done) authored `src/release/`:
  - `compile-core.ts` — **pure**: `parseReleaseTarget`, `requireKey`, `compileArgv`,
    and constants `PIN_PATH`, `REQUIRED_KEY`, `CLI_ENTRY`, `DEFAULT_OUTFILE` (`dist/vend`).
  - `compile.ts` — **impure shell**: resolves git root, reads the pin by key, runs
    `bun build --compile`, writes `dist/vend`. Exit codes: 0 built, 1 build failed, 2
    precondition (not a repo / no pin / missing key).
  - `compile-core.test.ts` — unit tests for the pure core + a **live-pin drift guard**.
  - `compile.smoke.test.ts` — compiles the REAL binary and runs it from an empty dir.
  - Exposed as `bun run compile` (package.json script) and `just compile`.
- **T-061-02** authored `src/version.ts` → `VERSION` (build-embedded `package.json`
  semver, currently `0.1.0`). `vend --version` reports it.
- **T-061-01** made `package.json` shippable: `version: 0.1.0`, no `private`, `bin.vend`.
  Invariants asserted by the untracked `src/packaging.test.ts`.

## The existing CI surface

`.github/workflows/` currently holds exactly one file:

- **`release-target-check.yml`** (T-062-01) — a *standing guard*, NOT the pipeline. On
  every push/PR it runs on `macos-14`, `cat`s the pin into `$GITHUB_ENV`, and asserts
  (a) the runner arch resolves to `BUN_COMPILE_TARGET` and (b) `RELEASE_TARBALL ==
  ${PREFIX}-${TRIPLE}.tar.xz`. Its header explicitly says: *"T-062-02/03 add
  compile/release jobs alongside it."* So the release workflow is a **new, separate file**.

The `cat .github/release-target.env >> "$GITHUB_ENV"` idiom is the established way to
load the pin into a workflow — this ticket reuses it verbatim.

## The pattern this epic mirrors — lisa's `release.yml`

`/Users/johnchen/swe/repos/lisa/.github/workflows/release.yml` (the proven mechanism):

- **Trigger:** `on: push: tags: ["v*"]`.
- **`permissions: contents: write`** (required for `gh release create`).
- Verifies **tag matches the manifest version** (`Cargo.toml`) before building —
  fails loud on mismatch.
- Builds a matrix of 4 targets, strips, **tarballs** each
  (`tar czf lisa-<arch>-<os>.tar.gz`).
- A final `release` job: downloads artifacts, `sha256sum *.tar.gz > sha256sums.txt`,
  then `gh release create "$GITHUB_REF_NAME" --title --generate-notes <tarballs>
  sha256sums.txt`.

What vend mirrors vs. diverges:
- **Mirror:** tag trigger, `contents: write`, tag↔version guard, tarball + sha256sums
  file, `gh release create … --generate-notes`.
- **Diverge (per scope):** vend ships **ONE** target (arm64-mac), so **no matrix and no
  separate WASM/download-artifact dance** — a single job on `macos-14` compiles, packages,
  and releases. vend uses `.tar.xz` (the pin's `RELEASE_TARBALL`), lisa uses `.tar.gz`.
  vend has no Rust; the build is `bun run compile`.
- **sha tooling:** lisa uses Linux `sha256sum`; vend's job runs on **macOS**, where the
  tool is `shasum -a 256` (sha256sum is absent by default). The output format is the same
  (`<hex>␣␣<filename>`), and `shasum -a 256 -c` consumes it identically.

## Repo conventions this ticket must obey

The `src/ci/*` and `src/release/*` modules establish a firm idiom (CLAUDE.md
engine⊥play discipline carried into tooling):
- **Pure core + thin impure shell + smoke test.** All judgment (parsing, argv assembly,
  format strings) lives in a `*-core.ts` with unit tests; the shell does I/O and `process`
  only and is "smoke-only, not unit-tested" (compile.ts's own words).
- **SSOT by key, never a literal.** Downstream code reads the pin by key name
  (`requireKey`) and hard-codes no triple/tarball string. A live-pin drift guard test
  reds in the gate if the pin shape changes.
- **Exit-code vocabulary** (cli.ts / check-committed.ts / compile.ts): `0` ok, `1` the
  operation failed, `2` environment/precondition error.
- **The gate is `bun run check`** = `baml:gen → tsc --noEmit → bun test`. Anything this
  ticket adds must pass it. Tests are Bun (`bun:test`), `*.test.ts` beside the source.

## Tooling reality (measured this session)

- `bsdtar 3.5.3` with `liblzma 5.4.3` — macOS `tar` **supports `-J`/`--xz`** for `.tar.xz`.
  Available both on the dev machine and on GitHub's `macos-14` image.
- `shasum -a 256` and `shasum -a 256 -c` are present on macOS; `Bun.CryptoHasher("sha256")`
  computes the same digest in-process (a portable alternative to shelling out).
- `gh` CLI is preinstalled on GitHub runners with `GH_TOKEN: ${{ github.token }}`.

## Constraints & open questions carried into Design

- **A real tagged GitHub release cannot be exercised in `bun test`.** The AC's
  "produces a GitHub release" is structural (encoded in YAML); the *testable substance* is
  the **package → sha256 → re-verify** round-trip and the **tag↔version** guard. Design
  must decide how much logic to lift out of YAML into tested code so the gate covers it.
- **Where does packaging logic live** — inline bash in the workflow (untestable, lisa's
  approach) or a tested `src/release/` script the workflow calls (the repo's idiom)? The
  repo's pure-core discipline strongly favors the latter.
- **Single job vs. compile-then-package steps** within one `macos-14` job.
- **`.tar.xz` member layout:** the tarball should contain the bare `vend` binary at the
  archive root (lisa tars `-C <dir> lisa`), so `tar xf … && ./vend` works and a Homebrew
  formula's `bin.install "vend"` finds it.
