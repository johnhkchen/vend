# T-062-01 — Progress

## Completed

- **Step 1 — SSOT pin.** Created `.github/release-target.env` with six pinned keys
  (`BUN_COMPILE_TARGET=bun-darwin-arm64`, `RELEASE_ASSET_TRIPLE=aarch64-apple-darwin`,
  `RELEASE_TARBALL_PREFIX`, `RELEASE_TARBALL`, `CI_RUNNER=macos-14`, `BUN_VERSION=1.3.9`)
  plus a header documenting provenance and the two-naming-scheme rationale.
  ✓ `source`d locally; tarball = prefix-triple.tar.xz holds.
- **Step 2 — target validity.** Re-confirmed `bun build --compile --target=bun-darwin-arm64`
  exits 0 and emits a Mach-O executable on this machine. Arch map `uname -m=arm64` →
  `bun-darwin-arm64` == pinned. ✓
- **Step 3 — work-dir record.** Created `docs/active/work/T-062-01/target.md`: measured
  machine facts, pinned values, provenance, pointer to the env SSOT. ✓ all four canonical
  values (target, triple, tarball, runner) verified byte-present in BOTH the record and the
  pin (no drift).
- **Step 4 — CI guard.** Created `.github/workflows/release-target-check.yml`: on
  push/PR/dispatch, `runs-on: macos-14`, loads the pin into `$GITHUB_ENV` (the literal
  reference discharging "referenced by the CI config"), asserts runner arch == pinned
  target, asserts tarball-name consistency. ✓ YAML parses (ruby); reference line present;
  the arch assertion passes locally and was shown to FAIL on a mutated expected value (the
  guard has teeth).
- **Step 5 — gate.** Ran `bun run check`. See deviation below.

## Deviations from plan

- **Gate is not fully green — pre-existing, not introduced by this ticket.** `bun run check`
  reports 8 failing tests. The board-smoke failure
  (`src/graph/load.test.ts` — "the real docs/active/** board loads clean") was **reproduced
  with all working-tree changes stashed** (committed HEAD), proving it pre-exists this work.
  Cause: stories S-062..S-065 reference epics E-062..E-065 that have not been minted yet
  (only E-061 exists) — expected board state, unrelated to a target-pin spike. The remaining
  failures are executor/SDK smoke tests (`andon: timed-out`, codebase-memory MCP absent),
  i.e. environment-dependent, not touched by static config/doc files.
- This ticket's files (`​.github/release-target.env`, the workflow, and
  `docs/active/work/T-062-01/**`) are **not imported by any test** and touch **no source** —
  they cannot introduce TS/board failures. The board loader reads tickets/stories/epics, not
  `work/` artifacts.
- **Doppler unavailable** in this session (`Unable to retrieve value from system keyring`),
  so the gate ran without it. Acceptable: no secret-backed code path is exercised by a
  config/doc change.
- **Did not author a GitHub Actions run.** The workflow is authored and locally dry-run
  against the real arm64 host (equivalent to the `macos-14` runner); I have not pushed to
  observe a green CI run and do not claim one. Stated as a limitation in review.

## Not touched (other threads / downstream)

`package.json`, `src/cli.ts`, `src/packaging.test.ts`, and `docs/active/work/T-061-01/**`
appear modified/added in the working tree — these belong to **concurrent Lisa threads** on
sibling tickets (same-branch concurrency), not to T-062-01. Left untouched.

## Remaining

None for this spike. Downstream: T-062-02 consumes the pin to compile; T-062-03 adds the
tag-triggered release pipeline alongside the guard.
