# T-062-03 — Review

**Ticket:** `release-ci-tarball-sha` (task, story S-062, epic E-061). The handoff: what
changed, how it's covered, and what a human reviewer should know.

## What this delivers

The previously-absent vend **release pipeline**. On a `v*` tag it compiles the pinned
arm64-mac binary, tars it (xz) under the SSOT asset name, sha256s it, and publishes a
GitHub release carrying the tarball + a `shasum -c`-verifiable `sha256sums.txt` — mirroring
lisa's verified mechanism, collapsed to one platform per epic scope.

## Files changed

**Created**
- `src/release/release-core.ts` — pure packaging core (no I/O/process/BAML). Owns:
  `tagToVersion`, `assertTagMatchesVersion` (the tag↔version invariant), `tarArgv` (the
  xz-tar flag vector, one owner), `sha256Line` (the exact two-space `shasum -c` format),
  and constants `SHA256SUMS`, `TARBALL_KEY`. Hard-codes **no** asset name — read by key.
- `src/release/release-core.test.ts` — 5 unit tests + live-pin drift guard.
- `src/release/package.ts` — impure shell (mirrors `compile.ts`): reads the pin by key,
  optional tag↔version guard, requires `dist/vend`, tars + hashes + writes the sums file.
  Exit codes 0 (ok) / 1 (tar or tag-mismatch) / 2 (precondition). `import.meta.main`-guarded.
- `src/release/package.smoke.test.ts` — 7 integration tests, incl. the AC round-trip.
- `.github/workflows/release.yml` — single-job tag-triggered pipeline on pinned `macos-14`.

**Modified**
- `package.json` — `"package": "bun run src/release/package.ts"`.
- `justfile` — `package:` recipe + `release-local:` (compile + package).

**Not touched** (intentional): `release-target-check.yml` (its header reserves the release
job for a separate file), `.github/release-target.env` (SSOT, read-only — already carried
every key), `src/release/compile*.ts` (reused as-is).

## How the acceptance criterion is met

> A tagged run produces a GitHub release whose asset is the arm64-mac tarball plus a
> sha256 that re-verifies against the downloaded tarball.

| Clause | Evidence |
|--------|----------|
| tag-triggered | `release.yml` `on: push: tags: ["v*"]` |
| arm64-mac tarball asset | `tarArgv` over `dist/vend` → pinned `RELEASE_TARBALL`; uploaded by `gh release create`. Drift guard keeps the name correct in the gate. |
| sha256 re-verifies | `package.smoke.test.ts`: package a fixture, then `shasum -a 256 -c` **passes** (`…tar.xz: OK`); a tampered tarball **fails**. Proven by-hand on the **real 103 MB binary** too: 24.7 MB tarball, `shasum -c` → OK, `tar -tf` → `vend`. |
| tag ↔ version | `assertTagMatchesVersion` (unit-tested) invoked in the shell; mismatched `--tag v9.9.9` → exit 1. |

The only step not exercisable in `bun test` is the literal `gh release create` (needs a
runner token + network). Everything upstream of it is a tested script or a self-checking
guard; the release line itself is a single faithful mirror of lisa's proven form.

## Test coverage

- **Unit (release-core):** every pure function + the live-pin drift guard. Milliseconds.
- **Integration (package.smoke):** real shell vs. fixture — tarball name/non-empty,
  member layout (`vend` at root), sums format, **`shasum -c` re-verify**, tamper-fails,
  tag-mismatch exit 1, missing-binary exit 2. Hermetic (no compile, no network).
- **By-hand E2E:** compile → package → re-verify on the actual binary (recorded in
  progress.md). 12/12 new tests green; `tsc --noEmit` clean.

**Gaps (acknowledged):**
- The actual GitHub release (runner-only) is not automated-tested — inherent; mitigated by
  keeping all testable logic below that line and mirroring lisa's working invocation.
- `Bun.CryptoHasher` produces the sum; `shasum -c` consumes it. Their agreement is proven
  empirically by the round-trip test (both are SHA-256 over identical bytes).
- The smoke test packages a *fixture* binary (fast/hermetic); the real-binary path is
  covered only by the by-hand run, not the gate (compiling in-gate is `compile.smoke`'s job).

## Open concerns / flags for human attention

1. **PRE-EXISTING board failure (NOT this ticket).** `bun run check` shows 8 failing
   live-board tests, all from one root cause: `GraphIntegrityError: story 'S-062'…'S-065'
   has no epic 'E-062'…'E-065'`. The stories reference epics by a number that doesn't exist
   (the relevant epic is **E-061**). Verified pre-existing by stashing all T-062-03 changes
   and re-running — fails identically. This ticket touches no epic/story frontmatter or
   graph code. **Action for the board owner:** reconcile the S-06x → E-06x edges (likely a
   renumber to E-061, or mint the missing epics). It will otherwise keep the gate red
   independent of this work.
2. **`engines.bun: ">=1.3.9"` vs. dev machine `1.3.8`.** Noted in T-062-01 research; the
   workflow pins bun via `BUN_VERSION=1.3.9` (the pin), so CI satisfies the floor. The dev
   machine is one patch below — not a blocker (local compile succeeded), but worth a bump.
3. **Single platform by design.** Only arm64-mac ships; the 4-target matrix is deferred
   (BAML native-addon cross-compile risk). Adding targets later is a pin append + a matrix
   on this workflow — no redesign.
4. **First real tag is the true end-to-end.** Recommend cutting a throwaway pre-release tag
   (e.g. `v0.1.0-rc.1`) once merged to confirm the runner path (`setup-bun`, `gh release
   create`) before announcing — the one thing the gate cannot prove.

## Risk assessment

Low. New code is additive (no existing behavior changed), follows the established
pure-core/thin-shell/smoke idiom, and the SSOT pin keeps machine specifics out of the
TypeScript. The one un-gateable step is minimal and mirrors a mechanism already proven in
lisa.
