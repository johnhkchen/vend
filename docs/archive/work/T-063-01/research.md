# T-063-01 — Research

**Ticket:** `vend-rb-own-tap-formula` (task, story S-063, epic E-061).
**Goal of this phase:** map what exists so the formula can be authored to mirror lisa,
without proposing the solution yet. Descriptive only.

## What the ticket asks for

Author `vend.rb` in its own tap (`johnhkchen/homebrew-vend`), mirroring `lisa.rb`:
compiled-binary, sha-per-variant, MIT, **no livecheck** — so
`brew install johnhkchen/vend/vend` on a fresh arm64-mac selects, verifies (sha matches
the release asset), and installs the released tarball, after which `vend --version`
reports the real semver.

This is the **last link** in E-061's distribution chain. The upstream links already exist:

- **T-062-01** pinned the single first target (arm64-mac) in `.github/release-target.env`.
- **T-062-02** compiles the self-contained `dist/vend` binary for that pin (`bun run compile`).
- **T-062-03** tarballs + sha256s it and publishes a GitHub release (`bun run package`,
  `.github/workflows/release.yml`). Status: `done`.

So the binary, tarball, sha, and GitHub release **already ship**. What is missing is the
Homebrew **formula** that points a `brew install` at that release asset and verifies it.

## The reference: lisa.rb (read from the installed tap)

Read live at `/opt/homebrew/Library/Taps/johnhkchen/homebrew-lisa/Formula/lisa.rb`
(lisa 0.3.0). Its shape:

- `class Lisa < Formula` with `desc`, `homepage`, `version "0.3.0"`, `license "MIT"`.
- **No `livecheck` block** — matches the ticket's "no livecheck".
- Per-platform `if OS.mac? / OS.linux?` × `Hardware::CPU.arm? / intel?` branches, each
  setting `url` (a `releases/download/v0.3.0/lisa-cli-<triple>.tar.xz`) + a **static
  `sha256`** pasted per variant ("sha-per-variant").
- A `BINARY_ALIASES` map + `target_triple`/`install_binary_aliases!` helpers (cargo-dist
  scaffolding for symlink aliases — all empty for lisa).
- `def install` → `bin.install "lisa"` per platform, then sweeps leftover files into
  `pkgshare`. **No `test do` block.**

lisa's formula is **generated and pushed by cargo-dist** on release; the shas are computed
by that tool and committed into the tap repo. vend does **not** use cargo-dist — its
pipeline is hand-rolled (T-062-02/03), so vend must produce and publish its own formula.

## vend's release infrastructure (what the formula plugs into)

**SSOT pin — `.github/release-target.env`** (T-062-01). Machine-readable `KEY=VALUE`:

| Key | Value |
|-----|-------|
| `BUN_COMPILE_TARGET` | `bun-darwin-arm64` |
| `RELEASE_ASSET_TRIPLE` | `aarch64-apple-darwin` |
| `RELEASE_TARBALL_PREFIX` | `vend-cli` |
| `RELEASE_TARBALL` | `vend-cli-aarch64-apple-darwin.tar.xz` |
| `CI_RUNNER` | `macos-14` |
| `BUN_VERSION` | `1.3.9` |

The iron rule stated in the pin's header and enforced across the release code: **read the
pin BY KEY, never hard-code the literals.** `compile-core.ts` exposes the readers:
`PIN_PATH`, `parseReleaseTarget(text)`, `requireKey(pin, key)` (throws on a missing key —
never silently defaults).

**Version SSOT — `src/version.ts`.** `export const VERSION: string = pkg.version` — the
`package.json` semver (`0.1.0`), embedded into the compiled binary. `vend --version`
reports THIS. The formula's `version` and the release tag must equal it.

**Packaging core — `src/release/release-core.ts`** (T-062-03, PURE, no I/O). Owns the
release strings/argv:
- `SHA256SUMS = "sha256sums.txt"` — the checksum filename the release carries.
- `TARBALL_KEY = "RELEASE_TARBALL"`.
- `tagToVersion(ref)` / `assertTagMatchesVersion(tag, version)` — the tag↔version invariant.
- `tarArgv(...)` — the xz-tar flag vector.
- `sha256Line(hash, filename)` → `"<64-hex>␣␣<filename>"` (exactly two spaces; the
  `shasum -a 256 -c` consumable format). **This module is the single owner of that sha-line
  spelling — the inverse (parsing a digest back out) has no home yet.**

**Packaging shell — `src/release/package.ts`** (impure, mirrors `compile.ts`). Produces
`dist/<RELEASE_TARBALL>` + `dist/sha256sums.txt`. The smoke test confirms the sha256
**re-verifies** against the tarball via `shasum -a 256 -c` (`…tar.xz: OK`) and that a
tampered tarball fails. So the exact sha the formula needs is already written to
`dist/sha256sums.txt` at release time, in a known one-line format.

**Release CI — `.github/workflows/release.yml`** (T-062-03). On a `v*` tag, on pinned
`macos-14`: load pin → assert runner == `CI_RUNNER` → setup Bun → `bun install` →
`bun run compile` → `bun run package` → `gh release create "$GITHUB_REF_NAME" … dist/<tarball>
dist/sha256sums.txt`. The release asset URL it produces is therefore:
`https://github.com/johnhkchen/vend/releases/download/<tag>/vend-cli-aarch64-apple-darwin.tar.xz`.

## The house pattern these tickets follow (must be matched)

Every release/CI unit is a **pure tested core + thin impure shell + smoke test**, with a
final un-gateable CI line kept faithful:
- `*-core.ts` — PURE, owns every string/argv, unit-tested for format/drift.
- the shell (`compile.ts`, `package.ts`) — resolves repo root via `git rev-parse
  --show-toplevel`, reads the pin by key, shells out, writes stdout/stderr, exits with
  **0 = ok / 1 = operation failed / 2 = precondition error**, all under `import.meta.main`.
- `*.smoke.test.ts` — runs the REAL shell against a temp fixture, hermetic (no network).
- `package.json` script + `justfile` recipe per shell; `release-local` chains them.
- Drift guard test: a unit test reads the LIVE pin and asserts it still carries the names
  this ticket depends on, so a pin reshape reds in the gate, not at tag-cutting time.

## Repo facts the formula needs

- **Homepage / repo slug:** `https://github.com/johnhkchen/vend` (git remote `origin`).
- **License:** `LICENSE` file present at repo root; project is MIT (matches the ticket).
- **Tarball layout:** `tar -tf` over the asset lists exactly `vend` at the archive root
  (proven in `package.smoke.test.ts`) → a formula's `bin.install "vend"` finds it.
- **Toolchain available here:** `ruby 2.6` (`/usr/bin/ruby`) and `brew`
  (`/opt/homebrew/bin/brew`) — so a `ruby -c` syntax check of a generated formula is
  runnable in a hermetic smoke test.

## Constraints & open assumptions (no solutions here)

- **MVP is one platform.** The pin ships arm64-mac only; the release has exactly one
  tarball + one sha. So vend.rb has **one** url/sha branch, not lisa's four. A non-arm64-mac
  user must get a clean "unavailable", not a wrong binary.
- **The tap is a separate repo** (`johnhkchen/homebrew-vend`) that does **not exist yet**
  and is not in this working tree. Whatever this ticket builds in the `vend` repo, the
  formula ultimately has to land in that tap; publishing across repos needs a token with
  write access. This is an environment/secret prerequisite, not code.
- **The sha is only known post-build.** Unlike lisa (cargo-dist pastes static shas), vend's
  sha is computed at release time into `dist/sha256sums.txt`. Hand-copying a sha would
  drift; the honest path reads the computed sha.
- **The full `brew install` AC cannot run in `bun test`** (needs the tag, the published
  release, the live tap, network). As with T-062-03's `gh release create`, the testable
  substance is everything upstream of the live install; the install itself is verified by
  syntax-checking the generated formula and by-hand/at-release.
