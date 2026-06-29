# T-062-01 — Research

**Ticket:** spike — `confirm-first-platform-target`
**Goal:** resolve the named prerequisite (the cook/dev's OS/arch) and pin the single
`bun build --compile` target triple the MVP binary ships first.

Descriptive only — what exists, what is true about the machine, what the downstream
tickets need from this spike. No solution proposed here.

## What this spike must resolve

The epic (E-061) and the upstream plan (`docs/active/pm/plan-kitchen-dogfood.md`) both
carry the same open prerequisite:

- E-061 intent: *"vend's binary bundles BAML (~108 MB native addon … cross-compiling all
  four targets is risky; the MVP ships the cook/dev's own platform first (arm64-mac),
  others later."*
- plan-kitchen-dogfood.md, Open decision **#5**: *"Cook/dev's OS/arch — needed to pick the
  first binary target. [need input]"*

So the single unknown is: **what platform does the cook/dev actually run**, and **what is
the exact `bun build --compile` target string** for it. Everything else in S-062 is
downstream of this answer (T-062-02 compiles for the pinned target; T-062-03 ships a
release whose asset is named for it).

## Ground truth — the cook/dev's machine (measured, this session)

The cook/dev is the repo owner. Measured directly on the machine:

| Fact | Value | Source |
|------|-------|--------|
| `uname -m` | `arm64` | shell |
| `uname -s` | `Darwin` | shell |
| Darwin release | `25.1.0` | `uname -r` |
| CPU | `Apple M5` | `sysctl -n machdep.cpu.brand_string` |
| `hw.optional.arm64` | `1` | `sysctl` |
| Bun | `1.3.8` | `bun --version` |

Conclusion (factual, not yet a decision): the cook/dev runs **Apple-Silicon macOS
(arm64 / aarch64-apple-darwin)**. This matches the epic's "likely arm64-mac" assumption —
the prerequisite is resolved in the affirmative.

## Bun's compile-target surface (measured)

`bun build --compile` accepts a `--target=bun-<os>-<arch>` triple for cross-/self-compile.
Probed live this session:

- `bun build --compile --target=bun-darwin-arm64 …` → **exit 0**, produced a working
  Mach-O executable (trivial script compiled to ~60 MB; this is the bun runtime baseline —
  the real vend binary will be larger once BAML's native addon is bundled, ~108 MB per the
  epic).
- `bun build --compile --target=bun-bogus-bogus …` → error, pointing to
  `https://bun.com/docs/bundler/executables` for the supported list.

So the valid bun target string for this machine is **`bun-darwin-arm64`**. Bun's full
self-/cross-compile set (for the deferred matrix) is `bun-{darwin,linux,windows}-{arm64,x64}`
plus musl/baseline variants — out of scope here, recorded only as context for "others later".

## lisa's mechanism (the pattern this epic mirrors) — from the plan doc

`docs/active/pm/plan-kitchen-dogfood.md` pins lisa's verified release mechanism
(`johnhkchen/homebrew-lisa/Formula/lisa.rb`, lisa 0.3.0):

- Compiled per-platform binary via `bun build --compile`; **4 targets**
  `{aarch64,x86_64} × {apple-darwin, unknown-linux-gnu}`.
- Tarballs named **`lisa-cli-<arch>-<os>.tar.xz`** — i.e. the Rust/LLVM triple style
  (`aarch64-apple-darwin`), NOT bun's `bun-darwin-arm64` style.
- GitHub release assets on the main repo; **sha256 per variant**; an own-tap formula
  selects by platform, verifies sha, extracts, `bin.install`.

This surfaces an important distinction for the pin (carried into Design): **two naming
schemes coexist** —
1. the **bun build target** (`bun-darwin-arm64`) passed to `--compile`, and
2. the **release asset triple** (`aarch64-apple-darwin`) used in the tarball name,
   mirroring lisa's `lisa-cli-…` convention → vend's would be
   `vend-cli-aarch64-apple-darwin.tar.xz`.

A pin that records only one of these would force the downstream tickets to re-derive the
other. The pin must carry both.

## Repo reality relevant to "referenced by the CI config"

- **No `.github/workflows` exists at repo root.** The only workflow in the tree is
  `examples/templates/hackathon-seed/.github/workflows/deploy.yml`, which is an *example
  template's* inert Cloudflare deploy — unrelated to vend's own release CI. Vend's release
  CI is genuinely absent (consistent with E-061 / the plan).
- `package.json`: `private: true`, `version: 0.0.0`, **no `bin`**, `engines.bun: ">=1.3.9"`.
  (Note the **engine mismatch**: the machine runs bun `1.3.8`, one patch below the declared
  floor — a finding for Design / a CI pin, not a blocker for the target decision.)
- Build scripts are bun-based (`bun run check`, `tsc --noEmit`); no compile/release script
  exists yet.
- `Justfile` runs the CLI via `bun run src/cli.ts` and explicitly notes "No global `vend`
  binary is installed" — the compiled binary this epic introduces does not exist yet.
- CLI entrypoint is `src/cli.ts` (the eventual `--compile` entry, owned by T-062-02).

## Sibling tickets (what consumes this pin)

- **T-062-02** (`compile-self-contained-binary`, depends_on `[T-061-02, T-062-01]`) —
  produces the binary via `bun build --compile` **for the pinned target**.
- **T-062-03** (`release-ci-tarball-sha`, depends_on `[T-062-02]`) — adds the release CI
  under `.github/workflows` that compiles, tarballs, sha256s, and publishes a release whose
  asset is the **arm64-mac tarball**.

T-062-01 is the **upstream root** of both. Per the RDSPI concurrency rule, files this spike
creates may be safely extended by the downstream tickets (the dependency edges, not the
lock, model the ordering) — so a pin file authored here is the natural single source of
truth those tickets read.

## Constraints & assumptions

- **Single platform only.** Epic scope (PE-7 right-size) is explicitly *one* platform
  first; the 4-target matrix is OUT OF SCOPE (BAML native-addon cross-compile risk). This
  spike must not pin the matrix.
- **The pin must match the real machine arch** (AC). Verified: `arm64` ⇒ `aarch64` ⇒
  `bun-darwin-arm64`. The CI reference must self-check this rather than asserting it blind.
- **GitHub-hosted arm64 macOS runner** is `macos-14`/`macos-15` (Apple Silicon); `macos-13`
  is x86_64 — relevant when the pin is referenced by CI, since the binary must be built on
  an arm64 runner to match the target.
- The decision is reversible/extensible: adding targets later appends to the pin; it does
  not invalidate this one.
