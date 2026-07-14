# T-042-04 — Progress: doctor-cast-precondition-guard

## Status: Implementation complete — all steps done, full gate green.

## Steps (per plan.md)

- [x] **Step 1 — guard + proof.** Created `src/doctor/preflight.ts` (`castPreflight(deps?) →
  renderDoctorReport(await probeDoctor(deps))`) and `src/doctor/preflight.test.ts` (4 tests:
  broken-dep refusal, wired-env proceed, never-throws, guarded-live). `bun test
  src/doctor/preflight.test.ts` → **4 pass, 16 expect()**.
- [x] **Step 2 — wire into the cast.** `src/play/work.ts`: imported `castPreflight` + `DoctorReport`
  (type-only); added the `unfit-env` arm to `WorkResult` (first arm); added the preflight call as
  `castWork`'s first statement after `const root` (before `readBoard`/`allocate`/`spendDown`) —
  returns `{ kind: "unfit-env", report }` when `!preflight.ok`.
- [x] **Step 3 — render in the CLI.** `src/cli.ts` `work` arm: added the `result.kind === "unfit-env"`
  branch (first branch) — writes `result.report.report` to stderr, exits `result.report.exitCode`;
  updated the arm's header comment to name the new precondition.

## Verification

- `bunx tsc --noEmit` → **exit 0** (the new `WorkResult` kind typechecks; CLI handles it).
- `bun test` (full) → **1071 pass, 0 fail, 2835 expect()** across 73 files. No regressions.
- `bun run lint` → **no such script**; the project gate is `check:typecheck` + `check:test` (both
  green). `package.json` has no lint script (confirmed) — nothing skipped.
- **Live smoke (the work.ts untested-shell discipline):**
  - broken env: `VEND_EXECUTOR=bogus bun run src/cli.ts work --budget 1000,1000` → **exit 1**,
    stderr is the `doctor: FAILED — 1 of 4 check(s) failed` report naming
    `active executor config: bogus` + its fix-it hint; **stdout empty (no receipt, no metered run).**
  - wired env: `bun run src/cli.ts work --budget 1000,1000 --board /tmp/does-not-exist-xyz.md` →
    **exit 1** with the `no-board` message — i.e. it PROCEEDED PAST the preflight (the gate is
    transparent on a wired env), reaching the existing board-precondition path unchanged.

## Deviations from plan

- **None functional.** One environmental note: a concurrent thread landed `vend doctor` (T-042-03,
  observation 22918) into `src/cli.ts` mid-implementation. My Step-3 edit re-applied cleanly against
  the updated file (the `work` arm was untouched by that change); I also folded the new precondition
  into the `work` arm's header comment. The smoke's usage block now lists `vend doctor`, confirming
  the two changes coexist.
- The budget flag is comma-separated (`--budget <ms>,<tokens>`), not colon — corrected in the smoke.

## Notes for Review

- `castWork` itself remains unit-untested by the house rule (work.ts eagerly loads BAML through the
  chain); the LOGIC under test is `castPreflight`, proven directly + live. Structural guarantee for
  "no partial metered run": the `unfit-env` return precedes `allocate`/`spendDown`.
- `castPreflight` is reusable by `vend doctor` (T-042-03) — the same probe→render compose.
