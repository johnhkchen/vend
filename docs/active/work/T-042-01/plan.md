# T-042-01 — Plan: doctor-check-report-model

_Ordered, independently verifiable steps. Testing strategy. Atomic-commit boundary._

## Testing strategy

- **Unit only.** The module is pure, so the entire AC is covered by ordinary `bun test`
  pure-function tests (no integration/guarded-live — there's nothing to probe or write).
  Integration lands in the downstream tickets: T-042-02 (mocked/guarded-live probe),
  T-042-03 (CLI end-to-end), T-042-04 (cast-precondition).
- **AC → test mapping** (the three AC clauses):
  1. *All-green renders each dep green + exit 0* → `renderDoctorReport([passed, passed,
     passed])` asserts `ok`, `exitCode === EXIT_OK` (0), and each dep name + a `✓` present.
  2. *Any single failing check renders that check's name + its fix-it hint + non-zero code* →
     `renderDoctorReport([passed, failed(name, hint), passed])` asserts `!ok`, `exitCode ===
     EXIT_FAILED` (non-zero), report contains `name`, `hint`, and a `✗`.
  3. *No probing or IO (pure, mirrors the *-core split)* → structural: the test imports ONLY
     the core; repeated calls are deterministic and identical; no fs/spawn touched.
- **Edges** (mirroring precommit-core.test.ts's edge discipline): empty set honest-empty;
  multiple failures tally `K of N`; multi-line hint collapsed; hintless-failure robustness;
  all-green report contains no `✗`; constants are 0 / non-zero.
- **Green gate:** `tsc --noEmit` (the project `build`) + `bun test` both pass with zero
  regressions across the existing suite (~1024 tests per the last sweep).

## Steps

### Step 1 — Author `src/doctor/doctor-core.ts`
Create the dir + module per structure.md: header comment, `Check`, `passed`/`failed`,
`DoctorReport`, `EXIT_OK`/`EXIT_FAILED`, internal `hintSuffix`/`line`, and
`renderDoctorReport`. Zero imports beyond TypeScript. Zero `throw`s.

**Verify:** `tsc --noEmit` clean; the public surface matches the frozen signature in
design.md/structure.md.

### Step 2 — Author `src/doctor/doctor-core.test.ts`
Write the test map from structure.md: the three AC fixtures, the edges, the constructor
tests, the constant tests. Import only `./doctor-core.ts`.

**Verify:** `bun test src/doctor/doctor-core.test.ts` green; assertions cover every AC clause.

### Step 3 — Full gate + commit
Run the full `tsc --noEmit` + `bun test` (whole suite) to confirm no regression. Write
`progress.md`. Commit the source + the RDSPI artifacts as one atomic commit through the
E-033 pre-commit gate.

**Verify:** whole suite green; tree clean after commit (D-005); commit message names T-042-01.

## Verification criteria (done = all true)

- [ ] `renderDoctorReport` exists, pure, returns `{ ok, exitCode, report }`.
- [ ] All-green input → `ok` true, `exitCode` 0, every dep rendered green.
- [ ] Any single failing input → `ok` false, `exitCode` non-zero, failing check's name + hint
      rendered.
- [ ] Module performs no probing/IO — imports nothing impure; tests are pure-function tests.
- [ ] `EXIT_OK`/`EXIT_FAILED` exported as the R12 exit-code contract the CLI will derive from.
- [ ] `passed`/`failed` constructors mint canonical checks; `failed` requires a hint.
- [ ] `tsc --noEmit` + full `bun test` green, no regressions.

## Risks / notes

- **Scope creep into probing** — the single live risk. The probe (envinfo, PATH lookups,
  addon load, env vars) is explicitly T-042-02. This ticket must NOT import `envinfo`,
  `node:fs`, `node:child_process`, or `process.env`. Guard: the module's only imports are
  none (pure TS). If a test needs `process`, the design is wrong.
- **Exit-code number** — keep failure at `1` (operational andon), not `2` (usage), to match
  `cli.ts`. The CLI derives it; the core just supplies it.
- **Greens-listed vs offenders-only** — doctor lists ALL checks (D2); do not copy
  history-core's offenders-only rendering. The AC's "renders each dep green" is the guard.
