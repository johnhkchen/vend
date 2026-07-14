# T-062-03 — Plan

Ordered, independently-verifiable steps. Each is small enough to commit atomically. The
gate after every code step is `bun run check` (baml:gen → tsc --noEmit → bun test); the
workflow YAML step is verified by inspection (the gate does not run GitHub Actions).

## Testing strategy

- **Unit (`release-core.test.ts`)** — every pure function: `tagToVersion`,
  `assertTagMatchesVersion`, `tarArgv`, `sha256Line`, plus the **live-pin drift guard**.
  Addon-free, milliseconds. This is the bulk of correctness coverage.
- **Integration (`package.smoke.test.ts`)** — the real `package.ts` shell against a
  fixture binary in a temp dir, then `shasum -a 256 -c` to prove **re-verification** (the
  AC), a negative tamper case, and the tag-mismatch guard. No compile, no network, no real
  release — fast and hermetic.
- **Workflow** — not executable in the gate. Verified by: (a) it references the pin by key,
  (b) every command it runs is either a tested script or a self-checking guard, (c) the one
  `gh release create` line matches lisa's proven form. Optionally lint with `actionlint`.
- **The un-gateable remainder** (an actual tagged release on a runner) is documented as a
  known limitation in review.md — the design pushes everything testable below that line.

## Steps

### Step 1 — `release-core.ts` (pure core)
Write the four pure functions + two constants per structure.md. No imports from the
runtime graph. Verify: `tsc --noEmit` clean (file compiles in isolation).
*Commit:* `feat(T-062-03): pure release-core (tag/version, tar argv, sha line)`

### Step 2 — `release-core.test.ts` (unit tests)
Cover each function's stated cases + the live-pin drift guard reading
`.github/release-target.env`. Verify: `bun test src/release/release-core.test.ts` green;
the drift guard actually asserts the live tarball name.
*Commit:* `test(T-062-03): unit-cover release-core + live-pin drift guard`

### Step 3 — `package.ts` (impure shell)
Implement the 8-step flow from structure.md, reusing `compile-core` constants/parsers and
`VERSION`. `import.meta.main` guard. Exit-code vocabulary 0/1/2.
Verify manually in-repo:
- `bun run compile` then `bun run src/release/package.ts` → writes
  `dist/vend-cli-aarch64-apple-darwin.tar.xz` + `dist/sha256sums.txt`; `shasum -a 256 -c
  dist/sha256sums.txt` from `dist/` says `OK`.
- `bun run src/release/package.ts` with no binary present → exit 2, clear message.
- `… --tag v9.9.9` → exit 1 (version mismatch, since VERSION=0.1.0).
*(The compile is real here but run by hand, not in the gate.)*
*Commit:* `feat(T-062-03): package.ts — tarball + sha256sums release packager`

### Step 4 — `package.smoke.test.ts` (integration round-trip)
Fixture-binary temp dir; run the real shell; assert tarball + sums shape; **`shasum -c`
passes**; tamper → fails; `--tag v9.9.9` → exit 1. `mkdtemp`/`rm` lifecycle. Generous
timeout (tar of a small fixture is fast, but keep margin). Verify: `bun test
src/release/package.smoke.test.ts` green; the negative cases genuinely red the way they
should (confirm by temporarily inverting an assertion during dev, then restore).
*Commit:* `test(T-062-03): package smoke — sha re-verify round-trip + tamper/tag guards`

### Step 5 — wiring (`package.json` + `justfile`)
Add `"package"` npm script; add `package:` and `release-local:` just recipes mirroring
`compile:`. Verify: `bun run package` runs the shell; `just package` works; `bun run
check` still green (no behavior change to the gate).
*Commit:* `chore(T-062-03): wire \`bun run package\` / \`just package\``

### Step 6 — `.github/workflows/release.yml`
Author the single-job pipeline per structure.md. Self-check: runner-equals-`CI_RUNNER`
guard present; bun pinned from `BUN_VERSION`; compile + package steps call the tested
scripts; `gh release create` uploads `dist/$RELEASE_TARBALL` + `dist/sha256sums.txt` with
`permissions: contents: write` and `GH_TOKEN`. Verify: YAML parses; if `actionlint` is
available, run it; otherwise inspect against lisa's release.yml line-by-line.
*Commit:* `ci(T-062-03): tag-triggered release workflow (compile → tarball → sha → release)`

### Step 7 — full gate + review
`bun run check` green end-to-end. Confirm `git status` shows only intended files. Write
review.md. (No code change; review is the handoff.)

## Verification criteria (definition of done)

- `bun run check` passes with the new unit + smoke tests included.
- A by-hand `bun run compile && bun run package` produces the correctly-named `.tar.xz`
  and a `sha256sums.txt` that `shasum -a 256 -c` accepts.
- The smoke test proves the same re-verification automatically (and proves tamper/tag
  guards fire).
- `release.yml` triggers on `v*` tags, runs on the pinned `macos-14`, references the pin by
  key, and ends in a single `gh release create` carrying the tarball + sums.
- No hard-coded triple/tarball literal in any `.ts` (all via the pin by key); the drift
  guard enforces this in the gate.

## Risks & mitigations

- **`Bun.CryptoHasher` digest ≠ `shasum` digest?** Both are SHA-256 of identical bytes —
  identical hex. The smoke test's `shasum -c` round-trip is the empirical proof; if it ever
  diverged, the test reds.
- **`tar -J` member layout** (binary nested under a dir vs. at root) → a formula's
  `bin.install "vend"` would miss it. `-C distDir vend` archives the bare name at root; the
  smoke test can additionally assert `tar -tf` lists exactly `vend`.
- **macOS `tar` vs GNU flag differences** — using long-equivalent short flags
  (`-c -J -f -C`) that bsdtar (runner + dev) and GNU tar both accept.
- **Two-space sha format drift** — owned by `sha256Line` (one place), guarded by the unit
  test's exact-string assertion and the smoke test's real `shasum -c`.
