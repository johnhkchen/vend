# T-065-01 — Progress

Implementation of Option D (the re-runnable clean-machine acceptance harness). Tracks what
landed against `plan.md`, with deviations.

## Status: COMPLETE — all six steps done, all clauses green on the real artifacts.

| Step | What | State | Verify |
|------|------|-------|--------|
| 1 | `acceptance-core.ts` (pure) + unit tests | ✅ | unit block green; typecheck clean |
| 2 | `acceptance.ts` (impure harness) | ✅ | `bun run acceptance` → 4 ✓, exit 0 |
| 3 | record `acceptance-transcript.md` | ✅ | committed gold master, all ✓ |
| 4 | integration arm of the smoke test | ✅ | runs on real dist/, exit 0 |
| 5 | wire script / just / release.yml | ✅ | `just --summary` lists `acceptance` |
| 6 | full gate + review | ✅ | 51 pass / 1 skip / 0 fail; this doc + review.md |

## Files created
- `src/release/acceptance-core.ts` — pure: `scrubEnv`, `expectedScaffoldPaths`,
  `verifyVersion`/`verifyScaffold`/`verifyConverge`, `renderTranscript`, `Verdict`/`Clause`.
- `src/release/acceptance.ts` — impure harness; `import.meta.main`; `--out`/distDir;
  exit 0/1/2.
- `src/release/acceptance.smoke.test.ts` — 11 unit + 1 integration (on dist/) + 1 skip arm.
- `docs/active/work/T-065-01/acceptance-transcript.md` — the recorded gold master.

## Files modified
- `package.json` — `"acceptance"` script.
- `justfile` — `acceptance:` recipe (writes the transcript), after `formula:`.
- `.github/workflows/release.yml` — `Acceptance …` step after the formula render.

## Verification evidence (measured this session)
- `bun run check:typecheck` → clean.
- `bun test src/release/ src/version.test.ts src/packaging.test.ts` → **51 pass, 1 skip
  (the dist-absent message arm), 0 fail**, 126 assertions.
- `bun run acceptance` / `just acceptance` → all four clauses ✓, exit 0:
  - sha: tarball `737deeca…026c` == sha256sums.txt == vend.rb.
  - `vend --version` → `0.1.0` (scrubbed env, no-checkout dir).
  - `vend init --template minimal` → 17 created, all 17 manifest paths present, no `.git`.
  - second run → 0 created (no-clobber converge).
- Precondition path: `acceptance.ts <empty-dir>` → exit **2**, "run `just release-local`".
- Live-tap gap (measured, recorded in the transcript, NOT faked): `homebrew-vend` git
  ls-remote → not found; release asset url → HTTP 404; no `v0.1.0` tag.

## Deviations from plan
1. **Direct `process.exit(2)` in the tarball-resolve catch** instead of the `fail2` helper —
   TS's definite-assignment analysis does not trace `never` through the helper for `let
   tarball`, so the `formula.ts` idiom (inline exit in the catch) was used there. `fail2` is
   still used for the other preconditions (no assignment dependency). Documented inline.
2. **`tar -xJf` via `Bun.spawnSync`** (not `tarArgv`, which is for *writing* the asset) —
   extraction is a distinct direct spawn; noted in a code comment. arm64-mac `tar` handles
   `xz` natively (the only target).
3. **`Bun.CryptoHasher`** for the digest rather than shelling `shasum` — pure in-process,
   no dependency on the host's `shasum`; the value is asserted == the `shasum`-written
   `sha256sums.txt`, so the formats are cross-checked anyway.

No deviations changed scope: the harness verifies the assembled chain and records the
transcript; it publishes nothing. The residual live-tap step stays human-owned, exactly as
T-063-01 specified.

## Commits (incremental, per plan)
Working tree carries the change as cohesive units (core+tests, harness, transcript,
integration arm, wiring). Repo discipline is commit-only-when-asked; Lisa's flow picks them
up. No tag pushed, no release cut, no tap published by this ticket.
