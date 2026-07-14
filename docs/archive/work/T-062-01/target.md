# Confirmed first platform target (T-062-01)

Resolves plan-kitchen-dogfood.md open decision **#5** ("Cook/dev's OS/arch — needed to pick
the first binary target") and E-061's named prerequisite. The MVP binary ships **one**
platform first: the cook/dev's own machine.

## Confirmed target

| Key | Value |
|-----|-------|
| Platform | **arm64 macOS (Apple Silicon)** |
| `bun build --compile` target | **`bun-darwin-arm64`** |
| Release asset triple | **`aarch64-apple-darwin`** |
| Release tarball | **`vend-cli-aarch64-apple-darwin.tar.xz`** |
| CI runner | **`macos-14`** (GitHub-hosted Apple Silicon) |
| Bun version floor | **`1.3.9`** (from `package.json` engines) |

**Machine-readable single source of truth:** [`.github/release-target.env`](../../../../.github/release-target.env).
T-062-02 (compile) and T-062-03 (release CI) read that file; this doc is the human record.

## Provenance (measured directly on the machine, 2026-06-29)

| Fact | Value | Source |
|------|-------|--------|
| `uname -m` | `arm64` | shell |
| `uname -s` | `Darwin` | shell |
| Darwin release | `25.1.0` | `uname -r` |
| CPU | `Apple M5` | `sysctl -n machdep.cpu.brand_string` |
| `hw.optional.arm64` | `1` | `sysctl` |
| Bun | `1.3.8` | `bun --version` |

`bun build --compile --target=bun-darwin-arm64` was probed live and exits 0, producing a
working Mach-O executable — so the pinned target string is valid on this exact machine.

## Notes carried downstream

- **Bun engine mismatch:** the machine runs bun `1.3.8`, one patch below the declared floor
  `1.3.9`. Not a target-decision blocker; flagged for T-062-02 / the CI bun-version pin.
- The pin records **both** naming schemes deliberately: `bun-darwin-arm64` (the bun
  `--compile` target) and `aarch64-apple-darwin` (the lisa-style tarball triple). Pinning
  only one would force downstream tickets to re-derive the other.
- Out of scope here: the 4-target matrix, the compile itself (T-062-02), and
  tarball/sha256/release (T-062-03).
