# T-042-03 — Review: doctor-cli-command

Handoff document for a human reviewer. The work wires the `doctor` subcommand into the CLI,
joining two already-finished modules (`doctor-core.ts` T-042-01, `doctor-probe.ts` T-042-02) at
the CLI seam. Pure glue — no new abstractions.

## What changed

| File | Change | Summary |
|------|--------|---------|
| `src/cli.ts` | modify | +USAGE line `vend doctor`; +`{ cmd: "doctor" }` union member; +`parseDoctorArgs` helper; +`if (argv[0]==="doctor")` parse-table entry; +`doctor` dispatch arm in `import.meta.main`. |
| `src/cli.test.ts` | modify | +`describe("parseArgs — doctor …")`, 4 pure parser tests. |
| `src/doctor/doctor-cli.smoke.test.ts` | create | Guarded-live `Bun.spawnSync` smoke, 2 cases (wired invariant + injected fault). |

No changes to `doctor-core.ts` / `doctor-probe.ts` — consumed as-is. No files deleted.

### The dispatch arm (the heart of the change)

```ts
if (parsed.cmd === "doctor") {
  const { probeDoctor } = await import("./doctor/doctor-probe.ts");
  const { renderDoctorReport } = await import("./doctor/doctor-core.ts");
  const report = renderDoctorReport(await probeDoctor());
  process.stdout.write(`${report.report}\n`);
  process.exit(report.exitCode);
}
```

Five lines: lazy-import (keeps the BAML addon off the pure-parse path), compose
probe→render, print, exit with the **core-computed** code. The number is never re-literaled — it
comes from `report.exitCode` (0 all-green / 1 any-broken), with `2` still reserved for usage.

## Acceptance criteria — evidence

> `parseArgs(['doctor'])` unit tests pass (bare `doctor` + unknown-flag→usage) and USAGE lists the
> doctor line

✅ `cli.test.ts` `doctor` block: bare→`{cmd:"doctor"}`; `doctor junk`→`{cmd:"usage", error:
"unexpected doctor argument: junk"}`; `doctor --json` / `doctor --budget 1,2`→usage; `USAGE`
contains `"vend doctor"`. 84 pass in that file.

> running `vend doctor` in a correctly-wired project prints all-green and exits 0

✅ Manual + smoke Case A. On this dev host: `doctor: ok — 4 check(s) passed` + four `✓` lines,
exit 0. Smoke asserts the host-robust invariant `exit 0 ⇔ "doctor: ok"`.

> in a project with any broken dep it prints the named failing check + fix-it hint and exits
> non-zero with no stack trace

✅ Manual + smoke Case B (`VEND_EXECUTOR=bogus`): `doctor: FAILED — 1 of 4 check(s) failed`,
`✗ active executor config: bogus — unknown VEND_EXECUTOR "bogus" — set it to "claude" or
"openai-compat"`, exit 1, no `\n    at ` stack frame in stdout or stderr.

## Test coverage

- **Parse half** — fully unit-covered (4 tests), addon-free, deterministic. Covers the command
  shape, both rejection paths (positional + flag, via the single `argv.length > 1` guard), and the
  USAGE listing.
- **Runtime half** — guarded-live smoke (2 spawns). Case A is non-flaky by construction (asserts an
  invariant, not a forced green, so it survives a host missing `claude`/`lisa`). Case B uses a
  host-independent fault (`VEND_EXECUTOR=bogus`) so the failure-path proof — exit code, named line,
  fix-it hint, no stack trace — is deterministic on any box.
- **Underlying composition** — already exhaustively unit-tested upstream: `doctor-core.test.ts`
  (renderer shapes + exit codes) and `doctor-probe.test.ts` (every check branch via injected
  facts). This ticket adds only the wired-CLI dimension, so the smoke is thin by design.
- **Full gate**: `bun run check` → **1067 pass / 0 fail**; `tsc --noEmit` clean.

### Coverage gaps (intentional)
- The `import.meta.main` dispatch arm is not unit-tested in isolation — it is the house "thin
  untested shell"; its behaviour is proven by the spawn smoke. Consistent with every other CLI verb
  (`init`, `work`, `shelf` are all proven the same way).
- No test for the `openai-compat`-with-missing-endpoint or addon-unloadable failure renders at the
  *CLI* layer — those branches are covered at the probe layer (`doctor-probe.test.ts`); re-proving
  them through a spawn would be redundant. Case B proves the CLI faithfully surfaces *a* red check;
  which check is the probe's concern.

## Open concerns / notes for the reviewer

1. **`bun run lint` does not exist.** CLAUDE.md lists it as an intended convention, but
   `package.json` has no `lint` script and no formatter is configured. The live gate is
   `bun run check`. Code was hand-matched to the file's two-space / JSDoc-banner style. If a linter
   is added later (a separate epic), this file should pass it unchanged — nothing exotic was used.
2. **Two spawns add ~80ms** to the suite (isolated to the smoke file; the fast pure suite is
   untouched). Acceptable, and the only honest way to prove exit-code behaviour.
3. **No `--json` / machine-readable output.** Deliberately out of scope (Design option B, rejected
   as YAGNI). The core emits a single human `report` string; a JSON shape can be added when a
   consumer needs it.
4. **Forward reuse (T-042-04).** That ticket reuses the same `probeDoctor`→`renderDoctorReport`
   `DoctorReport` as a *cast precondition* (refuse a cast at the door when `!report.ok`). This
   ticket touched nothing that would block it — the report object is already the shared currency;
   T-042-04 consumes `report.ok` rather than printing+exiting.

## Risk assessment

**Low.** Additive-only change over two finished, independently-tested modules. The new union
variant typechecks; the dispatch ladder has no `default` arm to desync. No existing behaviour is
altered — every prior verb parses and dispatches exactly as before (1067/1067 still green). The
no-stack-trace guarantee is structural (probe never rejects, renderer never throws), not defensive
code that could rot.

## Suggested commits (per Plan; commit handled by Lisa)
1. `feat(doctor): wire \`vend doctor\` CLI command (T-042-03)` — `cli.ts` + `cli.test.ts`.
2. `test(doctor): guarded-live smoke for \`vend doctor\` exit + report (T-042-03)` — smoke file.
