# T-062-01 — Structure

The shape of the change. Three files: one machine-readable pin (SSOT), one CI guard that
references it, one human-readable decision record in the work dir. No code modules, no
`package.json` edits, no release pipeline.

## Files

### CREATE — `.github/release-target.env`  (the SSOT pin)

Shell-sourceable `KEY=value` pin, with a header comment explaining provenance and the
two-naming-scheme rationale. Authoritative for the MVP's single target.

```
# vend release target — pinned by T-062-01 (E-061 / S-062).
# Single source of truth: T-062-02 (compile) and T-062-03 (release CI) read THIS file.
# MVP ships ONE platform first: the cook/dev's machine (arm64-mac). Others later.
#
# Two naming schemes coexist (see work/T-062-01/research.md):
#   BUN_COMPILE_TARGET  -> passed to `bun build --compile --target=...`
#   RELEASE_ASSET_TRIPLE-> Rust/LLVM triple used in the tarball name (mirrors lisa)

BUN_COMPILE_TARGET=bun-darwin-arm64
RELEASE_ASSET_TRIPLE=aarch64-apple-darwin
RELEASE_TARBALL_PREFIX=vend-cli
RELEASE_TARBALL=vend-cli-aarch64-apple-darwin.tar.xz
CI_RUNNER=macos-14
BUN_VERSION=1.3.9
```

- **Public contract:** the six keys above. Downstream tickets reference keys by name; they
  must not hard-code the literals.
- **Extensibility:** future targets are added as a sibling file or an additional row-set
  under a later epic; this file stays the arm64-mac pin.

### CREATE — `.github/workflows/release-target-check.yml`  (references the pin)

A minimal, self-verifying CI guard. Not the release pipeline.

- **Triggers:** `push`, `pull_request`, `workflow_dispatch`.
- **Job `verify-target`:** `runs-on: macos-14`.
  - Step 1 — load the pin: `cat .github/release-target.env >> "$GITHUB_ENV"` (the literal
    *reference* that discharges the AC).
  - Step 2 — assert the runner arch matches: map `uname -m` → expected
    `bun-${os}-${arch}` and fail if it ≠ `$BUN_COMPILE_TARGET`. This encodes the AC clause
    "matches the cook/dev's actual machine arch" as an automated check.
  - Step 3 — sanity-assert the asset triple/tarball are internally consistent
    (`$RELEASE_TARBALL` == `$RELEASE_TARBALL_PREFIX-$RELEASE_ASSET_TRIPLE.tar.xz`).
- **Deliberately absent:** no `setup-bun`, no `--compile`, no tarball, no sha256, no
  release publish — those are T-062-02 / T-062-03. Keeping them out keeps the spike's blast
  radius honest and avoids poaching downstream scope.

### CREATE — `docs/active/work/T-062-01/target.md`  (the work-dir record)

The human-readable "recorded in the epic work dir" artifact required by the AC. Records:
the measured machine facts, the pinned values (same six keys), the provenance (when/how
measured), and a one-line pointer to `.github/release-target.env` as the machine SSOT so the
two never drift in intent. Short (~40 lines), durable, reviewable.

### CREATE — the RDSPI artifacts (this set)

`research.md`, `design.md`, `structure.md`, `plan.md`, `progress.md`, `review.md` under
`docs/active/work/T-062-01/`. Process artifacts, not shipped config.

## Ordering

1. `.github/release-target.env` (the value everything else points at).
2. `docs/active/work/T-062-01/target.md` (record, derived from #1).
3. `.github/workflows/release-target-check.yml` (references #1).
4. Validate locally: source the env file, run the same arch-match assertion the workflow
   runs (the local machine *is* the arm64 runner equivalent), confirm `bun build --compile
   --target=$BUN_COMPILE_TARGET` is accepted.

## Boundaries & ownership

- **This ticket owns:** `.github/release-target.env`, `.github/workflows/release-target-check.yml`,
  and everything under `docs/active/work/T-062-01/`.
- **Does NOT touch:** `package.json` (T-062-02 / E-061 cleanup), `src/cli.ts` (T-062-02
  compile entry), any tap/formula (later), the example template's own
  `examples/.../deploy.yml` (unrelated).
- **Downstream extends, does not rewrite:** T-062-02 adds a compile job that sources the
  same env; T-062-03 adds the tag-triggered release job alongside the check. The check
  workflow can remain as a standing guard.

## Risks in the structure

- A workflow that only runs on `macos-14` consumes CI minutes; mitigated by it being a tiny
  assertion job (seconds) and the guard's value (catches pin/arch drift before a release).
- If GitHub renames/retires `macos-14`, the runner label in the pin must bump — the pin is
  the one place to change it, by design.
