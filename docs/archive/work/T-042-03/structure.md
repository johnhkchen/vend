# T-042-03 — Structure: doctor-cli-command

The blueprint — exact file-level edits, in dependency order. No new files; this is a pure wiring
ticket over two existing modules plus their CLI seam.

## Files touched

| File | Change | Why |
|------|--------|-----|
| `src/cli.ts` | **modify** | Add the `doctor` parse path, union member, USAGE line, dispatch arm |
| `src/cli.test.ts` | **modify** | Add the `parseArgs — doctor` describe block (pure parser tests) |
| `src/doctor/doctor-cli.smoke.test.ts` | **create** | Guarded-live smoke proving the AC's runtime half |

No files deleted. No changes to `doctor-core.ts` or `doctor-probe.ts` — they are consumed as-is.

## `src/cli.ts` — four edits

All four are additive; nothing existing is rewritten.

### Edit 1 — `USAGE` banner (after the `vend init` line, ~line 24)

Insert one line so the read-only verbs stay grouped:

```
"       vend doctor\n" +
```

Placed immediately after `"       vend init\n"`. AC: "USAGE lists the doctor line."

### Edit 2 — `ParsedCommand` union (adjacent to `init`, ~line 68)

Add the no-payload member next to its template sibling:

```ts
| { readonly cmd: "doctor" }
```

Mirrors `{ readonly cmd: "shelf" }` / `{ readonly cmd: "init" }` — no fields; the verb carries no
subject, flag, or budget.

### Edit 3 — `parseArgs` dispatch table + `parseDoctorArgs` helper

In `parseArgs`, add between the `init` and `envelope` lines (~line 139):

```ts
if (argv[0] === "doctor") return parseDoctorArgs(argv);
```

Add the helper next to `parseInitArgs` (~after line 166), with a JSDoc banner matching the
house convention:

```ts
/**
 * Parse the read-only `doctor` preflight path (T-042-03) — probe the vend-specific deps and
 * report. PURE. Like `shelf`/`init`, doctor takes NO arguments AT ALL: there is no subject to
 * type (the host environment is the implicit, only target) and nothing is cast, so there is no
 * `--budget` to fund. Any token after `doctor` — a positional or a flag — is therefore an error.
 * The probe, render, print, and exit are the dispatch arm's composition over `probeDoctor`
 * (doctor-probe.ts) and `renderDoctorReport` (doctor-core.ts).
 */
function parseDoctorArgs(argv: readonly string[]): ParsedCommand {
  if (argv.length > 1) return { cmd: "usage", error: `unexpected doctor argument: ${argv[1]}` };
  return { cmd: "doctor" };
}
```

### Edit 4 — dispatch arm (inside `import.meta.main`, beside the `init` arm, ~line 711)

```ts
if (parsed.cmd === "doctor") {
  // The preflight gate (T-042-03): probe the vend-specific deps (lisa & claude on PATH, the BAML
  // addon loadable, the active executor's config), render the verdict, print it, and exit with
  // the CORE-computed code (0 all-green / 1 any-broken). A broken dep is DATA — a clean
  // `✗ <check> — <fix-it>` line, never a stack trace: probeDoctor never rejects and
  // renderDoctorReport never throws. Read-only — nothing is cast. Lazy import keeps the probe
  // (and its transitive BAML addon) off the pure-parse path, exactly as the other arms do.
  const { probeDoctor } = await import("./doctor/doctor-probe.ts");
  const { renderDoctorReport } = await import("./doctor/doctor-core.ts");
  const report = renderDoctorReport(await probeDoctor());
  process.stdout.write(`${report.report}\n`);
  process.exit(report.exitCode);
}
```

## Public interface delta

- **`ParsedCommand`** gains one variant `{ cmd: "doctor" }`. This is the only exported-type
  change; every existing consumer's exhaustiveness is unaffected (the union is open to the
  dispatch `if`-ladder, which has no `default` that would now mis-handle it — each arm is an
  independent guard ending in `process.exit`).
- No new exported functions. `parseDoctorArgs` is module-private, like every other `parse*Args`.
- `USAGE` string content grows by one line; its type (a `const string`) is unchanged.

## `src/cli.test.ts` — one describe block

Append after the `init` describe block (~line 424):

```ts
describe("parseArgs — doctor (T-042-03 preflight command)", () => {
  test("bare `doctor` parses to the no-arg doctor command", () => {
    expect(parseArgs(["doctor"])).toEqual({ cmd: "doctor" });
  });
  test("doctor takes no arguments — an unexpected positional is usage", () => {
    expect(parseArgs(["doctor", "junk"])).toEqual({ cmd: "usage", error: "unexpected doctor argument: junk" });
  });
  test("doctor takes no flags — an unknown flag is usage", () => {
    expect(parseArgs(["doctor", "--json"]).cmd).toBe("usage");
    expect(parseArgs(["doctor", "--budget", "1,2"]).cmd).toBe("usage");
  });
  test("USAGE lists the doctor line", () => {
    expect(USAGE).toContain("vend doctor");
  });
});
```

Imports are already present (`parseArgs`, `USAGE`). No addon is loaded — pure parsers only.

## `src/doctor/doctor-cli.smoke.test.ts` — guarded-live proof of the AC runtime half

A separate smoke file (kept out of `cli.test.ts` so the pure parser test stays addon-free).
Spawns the real CLI via `Bun.spawn`. Two cases:

1. **Wired env → exit 0, `doctor: ok`.** Spawn `bun run src/cli.ts doctor` with the inherited
   env. **Guard**: if the host's own preflight is red (e.g. CI without `claude` on PATH), assert
   the *failed-shape* contract instead of forcing green — never a flaky hard-green assertion.
   The robust invariant asserted unconditionally: stdout starts with `doctor:` and the exit code
   equals `0` iff stdout contains `doctor: ok`.
2. **Fault-injected env → non-zero exit, named `✗` line, no stack trace.** Spawn with a broken
   env that guarantees ≥1 red check (e.g. `VEND_EXECUTOR=bogus`, which the executor-config check
   reds deterministically regardless of host PATH). Assert: exit code `1`; stdout contains
   `doctor: FAILED` and `✗ active executor config`; stdout/stderr contain **no** `\n    at ` stack
   frame and no `Unhandled`/`rejection` text.

`VEND_EXECUTOR=bogus` is the chosen fault because it is host-independent and exercises the exact
`✗ <name> — <hint>` render path the AC names, without depending on mutating `PATH` (which could
break `bun` itself).

## Ordering of changes

1. Edit `cli.ts` (union → parser → table → USAGE → arm) — compiles standalone.
2. Add the `doctor` describe block to `cli.test.ts` — green immediately (pure).
3. Add `doctor-cli.smoke.test.ts` — green on the wired dev host.
4. `bun test` (full suite) + `bun run lint` + `bun run build` (typecheck) — gate.

Each step is independently verifiable; steps 1–2 form one atomic commit, steps 3 a second (or one
combined commit — see Plan).
