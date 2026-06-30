# T-065-01 — Fresh-machine acceptance transcript

> ALL CLAUSES GREEN — install → version → workspace loop cleared on the real artifacts.

- **vend**: `0.1.0`
- **asset**: `vend-cli-aarch64-apple-darwin.tar.xz`
- **sha256**: `737deeca3480ee5822944319861eecfa03bdcfd5d589bb14f016f8c1c0f4026c` (tarball == sha256sums.txt == vend.rb)

## Clauses (real binary, clean machine, scrubbed env)

- ✓ **brew verifies the asset (sha256 matches)** — tarball sha 737deeca3480… == sha256sums.txt == vend.rb
- ✓ **vend --version is real semver** — vend --version → 0.1.0 (== embedded VERSION)
- ✓ **vend init --template minimal lays a workspace (empty dir, no clone, no Doppler)** — 17 created, all 17 workspace paths present, no .git
- ✓ **second run is a no-clobber converge** — second run → 0 created (idempotent no-clobber converge)

## Residual gap — the live tap (human-owned)

`brew install johnhkchen/vend/vend` resolves a PUBLISHED release through a live tap.
That cannot run from this repo — and is NOT faked here. As of this run:

- the `johnhkchen/homebrew-vend` tap repo does not yet exist (git ls-remote → not found),
- the formula's release-asset url 404s (no `v0.1.0` release is published),
- no `v0.1.0` tag exists to fire `.github/workflows/release.yml`.

Three human-owned prerequisites close it (T-063-01 review): (1) create the
`johnhkchen/homebrew-vend` repo, (2) add a `HOMEBREW_TAP_TOKEN` secret with write access
to it, (3) push a `v0.1.0` tag. The harness above proves the install→version→workspace
loop on the exact bytes that tag would serve — it verifies, it does not publish.
