# T-062-03 — Progress

Status: **implementation complete, gate-clean (modulo a pre-existing, unrelated board
failure).** All planned files written; the AC discharged end-to-end against the real
compiled binary.

## Steps completed (per plan.md)

- **Step 1 — `src/release/release-core.ts`** ✅ Pure core: `tagToVersion`,
  `assertTagMatchesVersion`, `tarArgv`, `sha256Line`, constants `SHA256SUMS`,
  `TARBALL_KEY`. No I/O, no process, no hard-coded asset name (read by key from the pin).
- **Step 2 — `src/release/release-core.test.ts`** ✅ 5 unit tests incl. the live-pin
  drift guard (asserts `RELEASE_TARBALL == vend-cli-aarch64-apple-darwin.tar.xz` and that
  it equals `${PREFIX}-${TRIPLE}.tar.xz`). Green.
- **Step 3 — `src/release/package.ts`** ✅ Impure shell mirroring `compile.ts`: resolve
  root → read pin by key → optional tag↔version guard → require `dist/vend` → `tar -cJf`
  → `Bun.CryptoHasher` sha256 → write `sha256sums.txt`. Exit codes 0/1/2 as specified.
  Accepts an optional positional `distDir` (test seam) and `--tag` / `GITHUB_REF_NAME`.
- **Step 4 — `src/release/package.smoke.test.ts`** ✅ 7 integration tests: real shell vs.
  a fixture binary; tarball name + non-empty; `tar -tf` lists exactly `vend`; sums-line
  format; **`shasum -a 256 -c` re-verifies (the AC)**; tamper → re-verify FAILS; mismatched
  `--tag v9.9.9` → exit 1; missing binary → exit 2. Green.
- **Step 5 — wiring** ✅ `package.json` gains `"package"`; `justfile` gains `package:` and
  `release-local:` (compile + package). 
- **Step 6 — `.github/workflows/release.yml`** ✅ Single `macos-14` job on `v*` tags:
  load pin → assert runner == `CI_RUNNER` → `setup-bun@v2` (pinned `BUN_VERSION`) →
  `bun install` → `bun run compile` → `bun run package` → one `gh release create` carrying
  `dist/$RELEASE_TARBALL` + `dist/sha256sums.txt`, `permissions: contents: write`.
- **Step 7 — gate + review** ✅ See below; review.md written.

## Verification performed

- `bunx tsc --noEmit` — clean (one `noUncheckedIndexedAccess` error in the argv loop
  found and fixed: capture `const a = argv[i]` and null-check before `.startsWith`).
- `bun test src/release/release-core.test.ts src/release/package.smoke.test.ts` — **12
  pass, 0 fail**.
- **Real end-to-end (by hand, the AC against the actual artifact):**
  `bun run compile` → `dist/vend` (103 MB) → `bun run package` →
  `vend-cli-aarch64-apple-darwin.tar.xz` (24.7 MB) + `sha256sums.txt`; `cd dist && shasum
  -a 256 -c sha256sums.txt` → **`…tar.xz: OK`**; `tar -tf` → exactly `vend`. The full
  compile→tarball→sha→re-verify chain works on the real binary, not just the fixture.

## Deviations from plan

- **No incremental commits.** The working tree currently holds several parallel lisa
  threads' uncommitted changes on `main` (T-061-01/02, T-062-01/02, T-064-01). Per the
  RDSPI concurrency model, commit serialization is lisa's (file-locked) responsibility, so
  this thread leaves its files staged in the working tree rather than committing mid-stream
  on a shared branch. All changes are complete and verified above.
- The `assertTagMatchesVersion` mismatch was classified as **exit 1** (release-correctness
  failure), distinct from precondition exit 2 — a small refinement of the design's wording,
  consistent with `compile.ts`'s "1 = the operation failed" vocabulary.

## Known issue (NOT introduced here)

`bun run check` reports 8 failing tests, ALL in the live-board graph suite
(`src/graph/load.test.ts`, `svg`/`project` board tests). Root cause:
`GraphIntegrityError: story 'S-062'…'S-065' has no epic 'E-062'…'E-065'` — a board
**numbering mismatch** (stories reference epics that were minted under different numbers,
e.g. E-061). **Verified pre-existing**: stashing all T-062-03 changes and re-running the
board test still fails identically. Outside this ticket's scope (it touches no
epic/story/ticket frontmatter or graph code). Flagged for the board owner in review.md.
