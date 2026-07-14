# T-062-01 — Design

Decision: how to record the confirmed target triple so it is (a) a single source of truth
the downstream tickets read, (b) literally **referenced by a CI config**, and (c)
self-verifying that it matches the cook/dev's actual machine arch — without building the
release pipeline that is T-062-03's job.

## The decision (what gets pinned)

| Key | Value | Why |
|-----|-------|-----|
| Platform | **arm64 macOS (Apple Silicon)** | measured: `uname -m=arm64`, `Darwin`, Apple M5 |
| `bun build --compile` target | **`bun-darwin-arm64`** | the string passed to `--compile`; probed valid this session |
| Release asset triple | **`aarch64-apple-darwin`** | mirrors lisa's `lisa-cli-<arch>-<os>` (Rust/LLVM style) |
| Release tarball | **`vend-cli-aarch64-apple-darwin.tar.xz`** | `vend-cli-${triple}.tar.xz`, lisa-exact pattern |
| CI runner | **`macos-14`** | GitHub-hosted Apple-Silicon runner (arm64); `macos-13` is x86_64 |
| Bun version floor | **`1.3.9`** | from `package.json` engines; CI must pin a satisfying version |

Both naming schemes are pinned because the build (bun target) and the release asset (lisa
triple) use different conventions and Research showed pinning only one forces re-derivation.

## Options considered

### Where to record the machine-readable pin

**Option A — a `.env`-style pin file under `.github/` (CHOSEN).**
`.github/release-target.env`: shell-sourceable `KEY=value` lines. A GitHub Actions workflow
reads it with a one-line `source` / `>> $GITHUB_ENV`; T-062-02's compile step and T-062-03's
release job both consume the same file. Lives under `.github/` so it is unambiguously "CI
config" and the AC's "referenced by the CI config" is satisfied by a real reference.
- *Pro:* single source of truth; trivially machine-readable from bash with zero deps;
  natural home next to the workflows that consume it; extensible (append rows for future
  targets) without breaking this pin.
- *Con:* a bespoke file rather than a standard manifest — mitigated by a header comment.

**Option B — put the pin in `package.json` (e.g. a `vend.releaseTargets` block).**
- *Pro:* one canonical project file; already parsed by tooling.
- *Con:* `package.json` cleanup (drop `private`, real semver, add `bin`) is explicitly
  E-061/T-062-02 scope — editing it here collides with a downstream ticket's file ownership
  and muddies the spike's blast radius. Shell access in CI needs `jq`/node to read it.
  Rejected: wrong file to touch from a spike, heavier to consume in bash.

**Option C — record only in `docs/active/work/T-062-01/` (no CI artifact).**
- *Pro:* minimal; pure spike.
- *Con:* fails the AC's second clause ("referenced by the CI config"); leaves the pin as
  prose the downstream tickets must transcribe by hand — exactly the re-derivation risk
  Research flagged. Rejected.

### How to make the CI reference real + honest

The release pipeline (compile → tarball → sha256 → publish) is **T-062-03's** deliverable
and must not be built here (PE-7 right-size; honest-on-outcome — I will not stand up a
release workflow I cannot exercise). But the AC requires the pin be *referenced by a CI
config* and *match the actual machine arch*. Options:

**Option D — minimal "release-target check" workflow (CHOSEN).**
A small `.github/workflows/release-target-check.yml` that, on push/PR/dispatch, runs on the
pinned `macos-14` runner, sources `release-target.env`, and **asserts the runner's real arch
maps to the pinned `bun-darwin-arm64`** — failing loudly on mismatch. It also asserts the
target string is one bun accepts.
- *Pro:* makes "referenced by the CI config" literally true; encodes the AC's own
  "matches the actual machine arch" requirement as an automated, re-runnable guard; gives
  T-062-02/03 a working foundation to extend (they add build/release jobs alongside);
  contains zero release/publish logic, so it does not poach T-062-03's scope.
- *Con:* a second small file. Acceptable — it is the thing that discharges the AC.

**Option E — a stub of the full release workflow.**
Rejected: building a tag-triggered compile/tarball/release stub is T-062-03's job, can't be
verified from this spike, and would be dishonest to land as "done".

## Why this is right-sized for a spike

A spike resolves uncertainty and pins a decision durably. The uncertainty ("cook/dev's
OS/arch") is resolved by measurement; the decision (`bun-darwin-arm64` + the lisa asset
triple) is pinned in one machine-readable SSOT under `.github/`; and the AC's two clauses
are each discharged by a concrete artifact: the work-dir record (`target.md`) and the CI
guard that references the pin and proves it matches the host. No release machinery, no
`package.json` edits, no matrix — those belong to T-062-02 / T-062-03 / a later epic.

## Self-verification strategy (the AC's "matches the actual machine arch")

Two layers, both honest:
1. **Local, now:** this session measured `uname -m=arm64` and compiled a `bun-darwin-arm64`
   binary successfully — the pin is grounded in a real build on the real machine.
2. **In CI, ongoing:** the check workflow re-derives the arch on every run and asserts it
   equals the pinned target, so drift (e.g. someone editing the pin, or a runner-image
   change) fails fast rather than silently shipping the wrong asset.

## Open items handed downstream (not decided here)

- **Bun engine mismatch** (machine `1.3.8` < declared floor `1.3.9`): flagged for T-062-02 /
  the CI bun-version pin. Not a target-decision blocker.
- Tap layout (one vs two), `package.json` cleanup, sha256/publish — all downstream.
- Additional targets (linux/x64, etc.) — a later epic; the pin file is structured to append
  them without invalidating this one.
