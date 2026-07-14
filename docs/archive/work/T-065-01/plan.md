# T-065-01 — Plan

Ordered, independently-verifiable steps to build Option D. Each step ends green
(`bun run check:typecheck` + the relevant test) and is committable atomically.

## Testing strategy

- **Pure core → unit tests** (`acceptance-core.ts`): `scrubEnv`, `expectedScaffoldPaths`,
  the three verdict helpers, `renderTranscript`. Fast, hermetic, no spawn. These are the
  drift guards.
- **Impure shell → integration (smoke)**: run the real `acceptance.ts` against a built
  `dist/`. Opportunistic in `bun test` (skip-with-`log` when `dist/` absent), unconditional
  in CI (release job builds `dist/` first). Mirrors how `package.smoke`/`formula.smoke`
  treat the un-gateable boundary.
- **The AC itself → the recorded transcript**: the gold-master artifact, produced by an
  actual run on the real 107 MB binary. The transcript IS the AC's "recorded transcript",
  honest about the one residual gap.
- **Verification criterion per step**: typecheck clean + named test green; final criterion:
  `bun run acceptance` exits 0 with four green clauses on real `dist/`.

## Steps

### Step 1 — Pure core (`acceptance-core.ts`) + unit tests
Write `acceptance-core.ts`: `REPO_COUPLING_PREFIXES`, `scrubEnv`, `expectedScaffoldPaths`
(import `SCAFFOLD_MANIFEST` from `../init/init-core`), `verifyVersion`, `verifyScaffold`,
`verifyConverge`, `renderTranscript`, and the `Verdict`/`Clause` types. Write the unit
block in `acceptance.smoke.test.ts` (pure section): scrub drops `DOPPLER_*`, keeps
`PATH`/`HOME`; `expectedScaffoldPaths` equals the manifest's paths; verdict truth tables;
`renderTranscript` contains the banner, the residual section, and every clause id.
**Verify:** `bun test src/release/acceptance.smoke.test.ts` (unit block) green;
`bun run check:typecheck` clean. **Commit:** `feat(T-065-01): pure acceptance core + verdicts`.

### Step 2 — The harness shell (`acceptance.ts`)
Write the `import.meta.main` shell per Structure §2: argv parse → root → pin → preconditions
(exit 2) → sha verify (real bytes, `parseSha256Sums` + `Bun.CryptoHasher`) → extract +
`bin.install` into a temp prefix → scrubbed-env spawns (`--version`, two `init --template
minimal`) → residual-gap text → `renderTranscript` → `--out`/stdout → exit 0/1; always rm
the temp root.
**Verify:** `bun run check:typecheck` clean; `bun run acceptance` against the existing
`dist/` prints a transcript and exits 0 (manual run). **Commit:** `feat(T-065-01):
clean-machine acceptance harness`.

### Step 3 — Record the transcript (the gold master)
Run `bun run acceptance --out docs/active/work/T-065-01/acceptance-transcript.md` on the
real `dist/`. Confirm the four clauses are ✓ and the residual section carries the measured
tap/asset 404s + the three human prerequisites. This is the AC's recorded transcript.
**Verify:** the file exists, all clauses ✓, exit 0. **Commit:** `docs(T-065-01): record the
fresh-machine acceptance transcript`.

### Step 4 — Integration arm of the smoke test
Add the opportunistic integration block to `acceptance.smoke.test.ts`: if `dist/<tarball>`
+ `dist/vend` exist, run `acceptance.ts --out <tmp>`, assert exit 0 + all-clear banner +
four clause ✓; else `log` a clear skip. Generous timeout (the spawn extracts 26 MB + runs
the 107 MB binary three times).
**Verify:** `bun test src/release/acceptance.smoke.test.ts` green (integration runs locally
because `dist/` is present). **Commit:** `test(T-065-01): integration arm on real dist/`.

### Step 5 — Wire scripts/recipe/CI
- `package.json`: `"acceptance": "bun run src/release/acceptance.ts"`.
- `justfile`: `acceptance:` recipe after `formula:` (writes the transcript), noting it
  follows `release-local`.
- `.github/workflows/release.yml`: a step after "Render the Homebrew formula" →
  `bun run acceptance` (asserts the loop on every tag's fresh `dist/`).
**Verify:** `just --summary` lists `acceptance`; `bun run check:typecheck` clean; release.yml
parses (yaml lint / eyeball). **Commit:** `chore(T-065-01): wire acceptance into scripts, just, release CI`.

### Step 6 — Full gate + review
Run `bun test src/release/ src/version.test.ts src/packaging.test.ts` (the E-061 surface)
and `bun run check:typecheck`. Confirm only the known pre-existing live-board failures
remain (S-062..S-065 → absent E-062..E-065), unrelated to this ticket. Write `review.md`.
**Verify:** all `src/release/**` + version/packaging tests green; typecheck clean.

## Risks & mitigations
- **107 MB binary is slow / heavy in CI.** The integration test gates on `dist/` presence,
  so local `bun test` without a build skips it; CI runs it once on the already-built `dist/`.
  Generous per-test timeout.
- **`tar -xJf` portability.** macOS `tar` (the pinned target is mac-only) handles `xz`
  natively — same `tar` the package step's tarball was built with. arm64-mac only by design.
- **Over-claiming.** The transcript's RESIDUAL section is mandatory and explicit; the
  harness verifies but never publishes — Option B's owner actions stay with the human.
- **Drift.** `expectedScaffoldPaths` derives from `SCAFFOLD_MANIFEST`; the sha is parsed,
  never typed — both follow the chain's no-drift rule.

## Definition of done
`bun run acceptance` exits 0 with four green clauses on real `dist/`; the recorded
transcript is committed; the smoke test (unit always, integration on `dist/`) is green; the
harness is wired into `package.json`/`justfile`/`release.yml`; the residual live-tap gap is
documented as the human handoff. No tap published, no release cut by this ticket.
