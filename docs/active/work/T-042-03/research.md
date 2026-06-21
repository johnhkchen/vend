# T-042-03 — Research: doctor-cli-command

## Ticket in one line

Wire the `doctor` subcommand into the CLI: a pure `parseArgs(['doctor'])` path + a `USAGE`
entry, plus a thin `import.meta.main` dispatch arm that runs the probe, prints the rendered
report, and `process.exit`s with the computed code. Mirrors the existing `init`/`shelf`
dispatch arms and the pure-parse / lazy-import split.

_Advances: P2, P4, P3._ Dependencies **T-042-01** (pure core) and **T-042-02** (probe effect)
are both implemented and committed/uncommitted-present on disk — this ticket is the last wiring
seam before T-042-04 (cast-precondition reuse) consumes the same report.

## What already exists (the two halves this ticket joins)

### The pure core — `src/doctor/doctor-core.ts` (T-042-01, committed)

- `interface Check { name; ok; hint? }` — one dependency-probe result. `passed(name)` /
  `failed(name, hint)` constructors enforce the hint-iff-failure convention.
- `EXIT_OK = 0`, `EXIT_FAILED = 1` — the shared exit-code contract. `2` is reserved for usage
  errors (the CLI already exits `2` on parse failure).
- `interface DoctorReport { ok; exitCode; report }` — `exitCode` derived from `ok`, never a
  parallel field. `report` is the complete human-readable text the CLI prints verbatim.
- `renderDoctorReport(checks): DoctorReport` — PURE/TOTAL. Three shapes: empty → "no checks to
  run" (ok, exit 0); all green → `doctor: ok — N check(s) passed` + `✓` lines (exit 0); any red
  → `doctor: FAILED — K of N check(s) failed` + marked lines incl. `✗ <name> — <hint>` (exit 1).

### The probe effect — `src/doctor/doctor-probe.ts` (T-042-02, on disk)

- `probeDoctor(deps?: Partial<DoctorProbeDeps>): Promise<Check[]>` — the one public entry. Runs
  the four checks (lisa on PATH, claude on PATH, BAML addon loadable, active executor config)
  concurrently via `Promise.all`, FIXED order, **never rejects** (every check wrapped by
  `safeCheck`). Defaults to the real backends (`DEFAULT_PROBE_DEPS`: envinfo `which`, dynamic
  `@boundaryml/baml` import, `process.env`).
- The probe **decides nothing** about exit codes and does **not** print or `process.exit` — by
  its own header comment that is explicitly "the CLI dispatch arm, T-042-03". This ticket.

So the seam is mechanical: `renderDoctorReport(await probeDoctor())` yields a `DoctorReport`;
the dispatch arm prints `.report` and exits `.exitCode`.

## The CLI surface — `src/cli.ts`

The file is a textbook pure-parse / impure-dispatch split:

- **`USAGE`** (lines 16–26): a multi-line banner string, one line per verb. Already lists
  `vend init`, `vend shelf`, `vend work`, etc. A `vend doctor` line must be added.
- **`type ParsedCommand`** (lines 34–85): a discriminated union over `cmd`. The no-arg verbs
  are the model to copy: `{ readonly cmd: "shelf" }` (line 67) and `{ readonly cmd: "init" }`
  (line 68). `doctor` is the same shape — `{ readonly cmd: "doctor" }`.
- **`parseArgs(argv)`** (lines 126–142): the dispatch table. Each verb has an
  `if (argv[0] === "<verb>") return parse<Verb>Args(argv)` line. A `doctor` arm slots between
  `init` (line 138) and `envelope` (line 139) — order is cosmetic, the checks are exclusive.
- **`parseInitArgs`** (lines 163–166) and **`parseShelfArgs`** (lines 151–154) are the exact
  template for `parseDoctorArgs`: a no-subject, no-flag, no-budget verb. `doctor` is read-only
  preflight — there is nothing to type and nothing to fund — so any token after `doctor` is an
  error: `if (argv.length > 1) return { cmd: "usage", error: \`unexpected doctor argument: ${argv[1]}\` }`.
- **The `import.meta.main` block** (lines 541–781): the impure shell. Each verb has an arm
  guarded by `if (parsed.cmd === "<verb>")`. The **`init` arm** (lines 692–711) is the closest
  structural cousin: lazy-import the effect, run it, branch on a typed outcome, print, exit.

### The lazy-import discipline (house rule, every dispatch arm)

Every arm `await import("./…")`s its effect **inside** the `import.meta.main` block, never at
module top. This keeps the impure deps — and crucially their transitive **BAML native addon** —
off the pure-parse path, so `cli.test.ts` can import `parseArgs` without loading the addon. The
doctor arm MUST follow suit: `const { probeDoctor } = await import("./doctor/doctor-probe.ts")`
and `const { renderDoctorReport } = await import("./doctor/doctor-core.ts")` inside the arm.
(`doctor-probe.ts` dynamically imports `@boundaryml/baml` in its default backend, so a top-level
import would defeat the discipline.)

## The test surface — `src/cli.test.ts`

- Imports only `parseArgs, parseBudgetArg, USAGE` from `./cli.ts` (line 2) — pure parsers only;
  the header comment notes the dispatch "does not run on import, so this test never touches the
  runner or the BAML addon."
- **`describe("parseArgs — init …")`** (lines 410–424) is the exact template for a doctor block:
  - bare `init` → `{ cmd: "init" }`
  - `init junk` → `{ cmd: "usage", error: "unexpected init argument: junk" }`
  - `init --force` / `init --budget 1,2` → `.cmd` is `"usage"`
  - `expect(USAGE).toContain("vend init")`
- No dispatch-arm unit test exists — the impure shell is the "thin untested shell" per the file
  header. The AC's live-behaviour clauses ("running `vend doctor` … prints all-green and exits 0
  … a broken dep prints the named failing check + hint and exits non-zero with no stack trace")
  are proven by a **guarded-live smoke** (a `Bun.spawn` of the built CLI), the same way prior
  CLI tickets (init T-040-03/04) proved their dispatch live.

## Constraints & assumptions surfaced

1. **Exit codes are fixed by the core, not re-literaled.** The arm must exit with
   `report.exitCode` (0 green / 1 broken), never a hardcoded number. Usage stays `2`.
2. **No stack trace on a broken dep** (AC). This is already structurally guaranteed: `probeDoctor`
   never rejects, and `renderDoctorReport` never throws — a red dep is data, rendered as a clean
   `✗ … — hint` line. The arm just prints `.report` and exits `.exitCode`; it must NOT wrap the
   probe in anything that could surface a throw.
3. **Read-only verb.** Like `shelf`/`audit`/`envelope`, `doctor` takes no `--budget` (nothing is
   cast). Unlike `audit`, it takes no positional subject and no flags at all — it is the
   `shelf`/`init` no-arg shape exactly.
4. **`process.cwd()` is not needed.** `init` passes `process.cwd()` to its effect; the doctor
   probe reads PATH / addon / `process.env` with no cwd dependency, so the arm calls
   `probeDoctor()` with no args (real backends via `DEFAULT_PROBE_DEPS`).
5. **Ordering of the parse arm** among the `if` ladder is free; placing it next to `init`/`shelf`
   keeps the no-arg verbs together for readers.
6. **`bun run lint` formatting**: the repo uses a formatter (Biome/Prettier-style) — match the
   surrounding two-space indent and the existing JSDoc-banner-per-parser convention.
