# T-042-03 — Plan: doctor-cli-command

Ordered, independently-verifiable steps. The work is small and low-risk (pure glue over two
finished modules); the plan front-loads the parse path (testable instantly, addon-free) and ends
with the guarded-live smoke that proves the AC's runtime half.

## Testing strategy

- **Unit / pure** (`cli.test.ts`): the `parseDoctorArgs` behaviour — bare→command, trailing
  token→usage, unknown flag→usage, USAGE contains the line. Runs without the BAML addon, like
  every other parser test. This is the bulk of the AC's first sentence.
- **Guarded-live smoke** (`doctor/doctor-cli.smoke.test.ts`): spawns the real CLI to prove
  exit-code + report-shape + no-stack-trace. The dispatch arm itself is "the thin untested shell"
  by house convention, so its proof is behavioural (spawn), not a unit test of `import.meta.main`.
- **Gate**: `bun test` (full suite must stay green — currently ~1061 tests), `bun run lint`,
  `bun run build` (typecheck the new union member + arm).

## Steps

### Step 1 — Parse path in `cli.ts` (union + helper + table + USAGE)

Four additive edits (see Structure):
1. `ParsedCommand`: add `| { readonly cmd: "doctor" }` next to `init`.
2. `parseArgs`: add `if (argv[0] === "doctor") return parseDoctorArgs(argv);`.
3. Add `parseDoctorArgs` (3-line body, JSDoc banner) next to `parseInitArgs`.
4. `USAGE`: add `"       vend doctor\n"` after the init line.

**Verify**: `bun run build` typechecks (the new union variant is handled — every dispatch arm is
an independent guard, no `default` to update). Does not yet wire the dispatch arm, so a real
`vend doctor` would fall through to the `run` tail — acceptable mid-step, fixed in Step 3.

### Step 2 — Pure parser tests in `cli.test.ts`

Append the `describe("parseArgs — doctor …")` block (four tests, verbatim from Structure).

**Verify**: `bun test src/cli.test.ts` green. This locks the AC's parse half:
`parseArgs(['doctor'])` passes, unknown-flag→usage, USAGE lists doctor.

### Step 3 — Dispatch arm in `cli.ts`

Add the `if (parsed.cmd === "doctor") { … }` arm inside `import.meta.main`, beside the `init` arm:
lazy-import `probeDoctor` + `renderDoctorReport`, `renderDoctorReport(await probeDoctor())`, print
`report.report` to stdout, `process.exit(report.exitCode)`.

**Verify (manual)**: `bun run src/cli.ts doctor` on the dev host prints the report and exits 0 (or
names a real broken dep). `echo $?` confirms the code. `VEND_EXECUTOR=bogus bun run src/cli.ts
doctor; echo $?` prints `doctor: FAILED`, a `✗ active executor config: bogus` line + hint, and
exits 1, with no stack trace.

### Step 4 — Guarded-live smoke `src/doctor/doctor-cli.smoke.test.ts`

Two cases (see Structure):
- **Case A (wired)**: spawn `bun run src/cli.ts doctor`; assert stdout starts with `doctor:` and
  `exitCode === 0` **iff** stdout contains `doctor: ok` (no flaky hard-green — adapts to the host).
- **Case B (fault-injected)**: spawn with `env: { ...process.env, VEND_EXECUTOR: "bogus" }`;
  assert `exitCode === 1`, stdout contains `doctor: FAILED` + `✗ active executor config`, and
  neither stdout nor stderr contains a `    at ` stack frame.

**Verify**: `bun test src/doctor/doctor-cli.smoke.test.ts` green.

### Step 5 — Full gate

`bun test` (whole suite green, no regression), `bun run lint` (format/lint clean), `bun run build`
(typecheck). Update `progress.md` with the outcome and any deviation.

## Risks & mitigations

| Risk | Likelihood | Mitigation |
|------|-----------|------------|
| Smoke Case A hard-asserts green and flakes on a host missing `claude`/`lisa` | med | Assert the *invariant* (`exit 0 ⇔ "doctor: ok"`), never force green. The fault case (B) carries the real failure-path proof deterministically. |
| `VEND_EXECUTOR=bogus` doesn't red the check (env not read) | low | The probe's `executorConfigCheck` reads injected `env` defaulting to `process.env`; a spawned child inherits the set var. Verified manually in Step 3 before writing the test. |
| Top-level import of the probe leaks the addon onto the pure path | low | Arm uses `await import(...)` inside `import.meta.main`, exactly like every other arm; `cli.test.ts` import set is unchanged (no probe import). |
| Stack-trace assertion too strict (matches a legit substring) | low | Match the specific `"\n    at "` Node frame prefix, not the bare word "at". |
| Spawn smoke slow / addon load cost | low | Two spawns only; acceptable, and isolated to the smoke file so the fast pure suite is untouched. |

## Commit plan

- **Commit 1** — `feat(doctor): wire \`vend doctor\` CLI command (T-042-03)`: Steps 1–3
  (`cli.ts` + `cli.test.ts` parse block + dispatch arm). Compiles, pure tests green.
- **Commit 2** — `test(doctor): guarded-live smoke for \`vend doctor\` exit + report (T-042-03)`:
  Step 4 (`doctor-cli.smoke.test.ts`).

(May land as a single commit if the gate is run once at the end; two commits keep the pure-wiring
and the live-proof separable for review, matching the T-040-03/04 precedent.)

## Done looks like

- `parseArgs(['doctor'])` → `{ cmd: "doctor" }`; `doctor junk` / `doctor --json` → usage; USAGE
  lists `vend doctor`. ✅ unit.
- `vend doctor` in a wired project → all-green report, exit 0. ✅ smoke A + manual.
- `vend doctor` with a broken dep → named `✗` check + fix-it hint, exit 1, no stack trace.
  ✅ smoke B + manual.
- Full suite green, lint clean, build typechecks. ✅ gate.
