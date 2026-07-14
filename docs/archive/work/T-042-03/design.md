# T-042-03 — Design: doctor-cli-command

## The decision in one line

Add `doctor` as a no-arg verb following the **`init`/`shelf` template exactly**: a
`{ cmd: "doctor" }` union member, a `parseDoctorArgs` that rejects any trailing token, a `USAGE`
line, and an `import.meta.main` dispatch arm that lazy-imports `probeDoctor` + `renderDoctorReport`,
prints `report.report`, and `process.exit(report.exitCode)`. No new abstractions; the two
dependency halves already compose mechanically.

## Forces

- **AC parse half**: `parseArgs(['doctor'])` must parse cleanly; an unknown flag must route to
  usage; `USAGE` must list the doctor line.
- **AC live half**: `vend doctor` green-everywhere → all-green report, exit 0; any broken dep →
  named failing check + fix-it hint, exit non-zero, **no stack trace**.
- **House rules**: pure-parse path stays addon-free (lazy import); exit codes come from the core
  (`report.exitCode`), never re-literaled; an offending outcome is returned data, never thrown.

## Options considered

### A. No-arg verb mirroring `init`/`shelf` (CHOSEN)

`parseDoctorArgs` is a 3-line copy of `parseShelfArgs`/`parseInitArgs`: reject `argv.length > 1`,
else `{ cmd: "doctor" }`. The dispatch arm is a copy of the `shelf` arm's shape (read-only, always
prints then exits) but exits with the **core-computed** code instead of a literal 0.

- **Pros**: zero new concepts; the reader who knows `init` knows `doctor` instantly. The probe and
  core already do all the work — the arm is pure glue. Smallest possible diff. The no-stack-trace
  guarantee falls out for free (probe never rejects, render never throws).
- **Cons**: none material. `doctor` shares no parser code with `shelf` (the house "copy the five
  lines rather than couple two commands' parsers" idiom is deliberate — see `parseSteerArgs`'s
  comment), so there is intentional, idiomatic duplication.

### B. Add flags now (`--json`, `--quiet`, `--executor <id>`)

Anticipate machine-readable output or executor override at parse time.

- **Pros**: future-proofs the verb.
- **Cons**: **rejected** — out of AC scope (AC names only bare `doctor` + unknown-flag→usage). The
  core renders a single human-readable `report` string; there is no JSON shape to emit yet, and
  `--executor` overrides belong to the probe's `resolveExecutorId({}, env)` seam, not the CLI.
  Adding speculative flags violates the "smallest honest size" framing in `cli.ts`'s own header.
  YAGNI; T-042-04 and later can extend.

### C. Catch around the probe in the dispatch arm

Wrap `probeDoctor()` in `try/catch` to defend the no-stack-trace AC.

- **Pros**: belt-and-suspenders against an unexpected throw.
- **Cons**: **rejected** — redundant and misleading. `probeDoctor` is contractually
  never-rejecting (every check goes through `safeCheck`), and `renderDoctorReport` is
  PURE/TOTAL with zero throws. A `try/catch` here would imply the seam can throw (it cannot) and
  would risk swallowing a genuine programmer error (e.g. a bad import path) behind a fake
  "doctor: FAILED" — exactly the cryptic outcome the design avoids. Trust the contracts the two
  dependencies were built to honour; if they regress, their own tests catch it, not a defensive
  CLI wrapper.

### D. Eagerly import the core/probe at module top

Skip the lazy `await import`.

- **Pros**: marginally simpler arm.
- **Cons**: **rejected** — `doctor-probe.ts`'s default `bamlLoadable` backend dynamically imports
  `@boundaryml/baml`; while that specific import is itself lazy, a top-level `import` of the probe
  module pulls `envinfo` and the executor seam onto the pure-parse path and breaks the
  "`cli.test.ts` never touches the addon" invariant the whole file is organised around. Every
  other arm lazy-imports; consistency is the point.

## Chosen design — detail

### Parser (`parseDoctorArgs`)

```ts
function parseDoctorArgs(argv: readonly string[]): ParsedCommand {
  if (argv.length > 1) return { cmd: "usage", error: `unexpected doctor argument: ${argv[1]}` };
  return { cmd: "doctor" };
}
```

Identical shape to `parseShelfArgs`. Because the check is `argv.length > 1`, **both** a stray
positional (`doctor junk`) and an unknown flag (`doctor --json`) and even `doctor --budget 1,2`
all trip the same clean usage error — matching how `init` rejects `--force`. This satisfies the
AC's "bare `doctor` + unknown-flag→usage" with one guard.

### Union + table + USAGE

- `ParsedCommand`: add `| { readonly cmd: "doctor" }` adjacent to `init`.
- `parseArgs`: add `if (argv[0] === "doctor") return parseDoctorArgs(argv);` between the `init`
  and `envelope` arms.
- `USAGE`: add `"       vend doctor\n"` after the `vend init` line (read-only verbs grouped).

### Dispatch arm (inside `import.meta.main`)

```ts
if (parsed.cmd === "doctor") {
  // The preflight gate (T-042-03): probe the ~4 vend-specific deps (lisa & claude on PATH, the
  // BAML addon loadable, the active executor's config), render the verdict, print it, and exit
  // with the CORE-computed code (0 all-green / 1 any-broken). A broken dep is DATA — a clean
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

Placed beside the `init` arm. Prints to **stdout** (the report is the deliverable, green or red —
a checklist, not an error stream; matches how `work` prints its receipt to stdout even on an
amber andon). Exits with `report.exitCode` — the only place the number is decided is the core.

## Why this is grounded in the research

- The probe's own header explicitly assigns "print or `process.exit`" to **T-042-03** — this arm
  is the named consumer, nothing more.
- The `init` arm (cli.ts:692–711) already demonstrates the lazy-import + typed-outcome + print +
  exit shape; `doctor` is a simpler instance (no refusal branch — the report IS the branch).
- `cli.test.ts`'s `init` describe block (410–424) gives the exact parser-test template.

## Verification strategy (preview of Plan)

- **Unit (pure)**: extend `cli.test.ts` with a `doctor` describe block — bare→`{cmd:"doctor"}`,
  `doctor junk`→usage, `doctor --json`/`--budget`→usage, `USAGE` contains `"vend doctor"`.
- **Live (guarded smoke)**: `Bun.spawn(["bun","run","src/cli.ts","doctor"])` on the real repo —
  assert exit 0 + `doctor: ok` when the dev env is wired; assert a non-zero exit + a named `✗`
  line + **no `at ` stack frame** under a fault-injected env (e.g. `PATH=""`). This proves the
  AC's live half without coupling the pure test to the addon.
