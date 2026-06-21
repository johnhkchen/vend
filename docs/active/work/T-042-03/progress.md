# T-042-03 — Progress: doctor-cli-command

## Status: IMPLEMENT COMPLETE — full gate green

All plan steps executed. `bun run check` (baml:gen + typecheck + full test suite) passes:
**1067 pass, 0 fail**. No regressions.

## Steps completed

### Step 1 — Parse path in `cli.ts` ✅
Four additive edits:
- `USAGE`: added `"       vend doctor\n"` after the `vend init` line.
- `ParsedCommand`: added `| { readonly cmd: "doctor" }` next to `init`/`shelf`.
- `parseArgs`: added `if (argv[0] === "doctor") return parseDoctorArgs(argv);` between the `init`
  and `envelope` arms.
- Added the `parseDoctorArgs` helper (3-line body + JSDoc banner) next to `parseInitArgs`.

### Step 2 — Pure parser tests in `cli.test.ts` ✅
Appended `describe("parseArgs — doctor (T-042-03 preflight command)")` (4 tests):
bare→`{cmd:"doctor"}`, `doctor junk`→usage with the named error, `doctor --json`/`--budget`→usage,
`USAGE` contains `"vend doctor"`. `bun test src/cli.test.ts` → 84 pass.

### Step 3 — Dispatch arm in `cli.ts` ✅
Added `if (parsed.cmd === "doctor") { … }` inside `import.meta.main`, beside the `init` arm:
lazy-import `probeDoctor` + `renderDoctorReport`, `renderDoctorReport(await probeDoctor())`, print
`report.report` to stdout, `process.exit(report.exitCode)`. Manual verification:

```
$ bun run src/cli.ts doctor                       → "doctor: ok — 4 check(s) passed" + 4 ✓ lines; exit 0
$ VEND_EXECUTOR=bogus bun run src/cli.ts doctor    → "doctor: FAILED — 1 of 4 …"
                                                       ✗ active executor config: bogus — unknown … ; exit 1
```

Both clean — no stack trace on the fault path.

### Step 4 — Guarded-live smoke `src/doctor/doctor-cli.smoke.test.ts` ✅
Two `Bun.spawnSync` cases:
- **Case A (wired)**: asserts the invariant `exit 0 ⇔ stdout includes "doctor: ok"` (never a forced
  green) + report leads with `doctor:` + no stack frame.
- **Case B (fault `VEND_EXECUTOR=bogus`)**: asserts exit 1, `doctor: FAILED`,
  `✗ active executor config: bogus`, the `set it to` fix-it hint, and no `\n    at ` stack frame in
  stdout or stderr.

`bun test src/doctor/doctor-cli.smoke.test.ts` → 2 pass.

### Step 5 — Full gate ✅
`bun run check` → 1067 pass / 0 fail. `tsc --noEmit` clean (the new union variant typechecks; the
dispatch ladder has no `default` to update — each arm is an independent guard ending in
`process.exit`).

## Deviations from plan

1. **No `bun run lint` script exists.** CLAUDE.md lists `bun run lint` as an *intended* convention,
   but `package.json` has no `lint` script — the live gate is `bun run check`
   (`baml:gen` + `check:typecheck` + `check:test`). Ran that instead. The repo has no separate
   formatter; code was hand-matched to the surrounding two-space / JSDoc-banner style.
2. **Smoke file location/name.** Plan named it `doctor-cli.smoke.test.ts`; created exactly there
   under `src/doctor/`. (Noting it because the file is a *new* artifact beyond the two modify
   targets — it is the third file in the change set, as the Structure blueprint anticipated.)

No deviations to the design or the public interface. The probe and core were consumed exactly
as-is; no edits to `doctor-core.ts` or `doctor-probe.ts`.

## Files changed
- `src/cli.ts` (modify) — USAGE line, union member, parse arm, `parseDoctorArgs`, dispatch arm.
- `src/cli.test.ts` (modify) — `doctor` describe block (4 tests).
- `src/doctor/doctor-cli.smoke.test.ts` (create) — guarded-live smoke (2 tests).

## Remaining
Nothing for implementation. Review artifact next. (Commit is handled outside this RDSPI pass per
the session instructions — Lisa drives transitions.)
