# T-042-04 — Plan: doctor-cast-precondition-guard

Ordered, independently-verifiable steps. Three atomic commits.

## Step 1 — The guard + its proof (`src/doctor/preflight.ts`, `preflight.test.ts`)

- Write `preflight.ts`: header + `castPreflight(deps = {}) → renderDoctorReport(await
  probeDoctor(deps))`. Imports only `doctor-core` (pure) + `doctor-probe` (addon-safe).
- Write `preflight.test.ts`: the four blocks from Structure (broken-dep refusal, wired-env proceed,
  never-throws, guarded-live).
- **Verify**: `bun test src/doctor/preflight.test.ts` green; `bun test src/doctor/` green (no
  regression in doctor-core/doctor-probe). `bunx tsc --noEmit` clean for the new module.
- **Commit**: `feat(doctor): castPreflight cast precondition guard (T-042-04)`.
- This step is the AC test: it proves the reusable doctor-check precondition refuses on a broken dep
  (same named-check + hint, non-zero) and is transparent on a wired env — independent of `castWork`,
  because the guard IS the precondition (and `castWork` is BAML-bound, untestable by house rule).

## Step 2 — Wire the guard into the cast (`src/play/work.ts`)

- Add the `castPreflight` import + the `DoctorReport` type import.
- Add the `unfit-env` arm to `WorkResult` (first arm).
- Add the preflight call as `castWork`'s first statement after `const root`, before `readBoard` —
  return `{ kind: "unfit-env", report }` when `!preflight.ok`.
- **Verify**: `bunx tsc --noEmit` clean (the new `WorkResult` kind is exhaustively handled once the
  CLI step lands; until then the CLI's `switch`/`if` chain simply won't match it — confirm no TS
  error from the union widening). `bun test` full suite green (work.ts is not value-imported by any
  test, so this is a typecheck + no-regression check).
- **Commit**: `feat(work): doctor preflight refuses a cast against a broken env (T-042-04)`.

## Step 3 — Render the refusal in the CLI (`src/cli.ts`)

- Add the `result.kind === "unfit-env"` branch to the `work` arm (first branch): write
  `result.report.report` to stderr, `process.exit(result.report.exitCode)`.
- **Verify**: `bunx tsc --noEmit` clean; `bun test` full suite green; `bun run lint` clean.
- **Live smoke** (the work.ts untested-shell discipline): force a broken dep and confirm `vend work`
  refuses at the door with the doctor report + non-zero exit, BEFORE any board read / metering, e.g.
  `VEND_EXECUTOR=bogus bun run src/cli.ts work` (an unknown executor is a red executor-config check)
  — expect the `doctor: FAILED …` report on stderr and a non-zero exit, no receipt, no run-log
  append. Then confirm a wired invocation still reaches its normal `no-board`/board path unchanged.
- **Commit**: `feat(cli): render doctor-preflight refusal in vend work (T-042-04)`.

## Testing strategy summary

- **Unit (the AC)**: `preflight.test.ts` — injected-deps matrix, deterministic, addon-free.
- **Typecheck**: `tsc --noEmit` after each step — the union widening + exhaustive CLI handling.
- **No-regression**: full `bun test` after steps 2 and 3.
- **Live**: the broken-env + wired-env `vend work` smoke (step 3) — proves the wiring the house
  rule keeps out of `bun test`.

## Verification criteria (maps to the AC)

- broken dep ⇒ `castWork` returns `unfit-env` BEFORE `allocate`/`spendDown` (no metered run); the
  CLI emits the same named-check + hint doctor report and exits non-zero. ✔ Step 1 (logic) + Step 3
  (surface) + structural ordering (Step 2).
- wired env ⇒ `castPreflight().ok` true; `castWork` falls through unchanged. ✔ Step 1 + Step 2.

## Risks & mitigations

- **R1: importing `preflight.ts` pulls in BAML** → would break the addon-free test. Mitigation:
  `doctor-probe.ts`'s BAML import is dynamic (inside `bamlAddonLoadable`), confirmed in Research;
  the guarded-live block would surface any eager load. Assert the test runs addon-free.
- **R2: exhaustiveness** — a `WorkResult` consumer that `switch`es without a `default` could TS-error
  on the new kind. Mitigation: the only consumer is the CLI `work` arm (an `if`-chain, not an
  exhaustive switch); Step 3 adds its branch. `tsc --noEmit` confirms.
- **R3: ordering** — placing the preflight after the board read would read the board on a broken env
  (not "at the door"). Mitigation: it is `castWork`'s FIRST statement after `root`.
