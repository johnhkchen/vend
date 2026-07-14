# T-062-02-02 — Structure: doctor-green-on-kitchen-workspace

## Files

### CREATE `src/kitchen/kitchen-doctor.ts` (the impure kitchen probe)

The kitchen analogue of `src/doctor/doctor-probe.ts`. Impure but narrow; injectable deps;
never throws; reuses the pure `Check`/`passed`/`failed` from `doctor-core.ts` and the pure
`parseKitchenSeed`/`validateDishSeed` from `dish-seed.ts`. Module header in the house style
(what this is, the central rule = pure-core-renders / impure-probe-here, never-throws,
name-the-failure, testable-today via injected deps).

Exports:

```
// Check names + fix-it hints — single source of truth (asserted by tests).
export const BUN_CHECK   = "bun on PATH";
export const BUN_HINT    = "install bun (https://bun.sh) and ensure `bun` is on your PATH";
export const ASTRO_CHECK = "Astro storefront config present";
export const ASTRO_HINT  = "re-run `vend init --template kitchen` to restore the Astro/Cloudflare storefront config";
export const SEED_CHECK  = "EmDash Dish seed valid";
export const SEED_HINT   = "re-run `vend init --template kitchen` to restore a valid Dish seed";

// Top-level seed signatures used for detection + the files each check reads.
export const KITCHEN_SIGNATURE = [".emdash", "astro.config.mjs"] as const;

// Pure detector — mirrors isLisaProject(existing).
export function isKitchenWorkspace(entries: Iterable<string>): boolean;

// Injectable world-fact backends (the planInit/probeDoctor discipline).
export interface KitchenProbeDeps {
  readonly onPath: (binary: string) => Promise<boolean>;        // default: envinfo which
  readonly readFile: (path: string) => Promise<string>;          // default: node:fs/promises readFile utf8
}
export const DEFAULT_KITCHEN_PROBE_DEPS: KitchenProbeDeps;

// The three check verbs (each total over its injected fact), exported for unit tests.
export async function bunCheck(onPath: KitchenProbeDeps["onPath"]): Promise<Check>;
export async function astroConfigCheck(readFile: KitchenProbeDeps["readFile"], dir: string): Promise<Check>;
export async function dishSeedCheck(readFile: KitchenProbeDeps["readFile"], dir: string): Promise<Check>;

// The one public entry — ordered [bun, astro, seed]; NEVER rejects.
export async function probeKitchen(dir: string, deps?: Partial<KitchenProbeDeps>): Promise<Check[]>;
```

Internal helpers (not exported): `whichOnPath(binary)` (try/catch→false, copied idiom — or
reuse via a small shared move; see note below), `messageOf(e)`, `safeCheck(name, run)` (the
never-throw wrapper, same as doctor-probe). `astroConfigCheck` reads `astro.config.mjs` +
`package.json`; greens iff config text contains `adapter` and `cloudflare`, and the parsed
package.json `dependencies` has both `astro` and `@astrojs/cloudflare`. `dishSeedCheck` reads
`.emdash/seed.json`, runs `parseKitchenSeed` then `validateDishSeed`; on violations the hint
is `<first violation> — <SEED_HINT>`; a parse/read throw is degraded by `safeCheck` to a red
check carrying the message.

Note on `whichOnPath`: doctor-probe's `whichOnPath` is module-private. Rather than export it
(widening doctor-probe's surface) or duplicate envinfo plumbing, `kitchen-doctor.ts` defines
its own tiny private `whichOnPath` — same 4-line try/catch→Boolean idiom. The duplication is
trivial and keeps the two probes independent (no cross-import for a one-liner). Documented in
a comment.

### CREATE `src/kitchen/kitchen-doctor.test.ts` (unit, pure-ish with injected facts)

Mirrors `doctor-probe.test.ts`. Cases:
- all-green: injected `onPath→true`, `readFile` returning the authored seed/config bytes →
  three green checks, no hints, fixed order `[BUN, ASTRO, SEED]`.
- bun missing: `onPath` false for "bun" → bun check red with `BUN_HINT`; probe RETURNS.
- astro config absent/garbled: `readFile` throws or returns config missing the adapter / a
  package.json without the deps → astro check red with `ASTRO_HINT`.
- seed invalid: `readFile` returns a seed failing `validateDishSeed` (e.g. zero records) →
  seed check red, hint names the violation; malformed JSON → red via safeCheck (message).
- `isKitchenWorkspace`: true for `[".emdash","astro.config.mjs", ...]`, false when either is
  missing.
- guarded-live: `probeKitchen(<some dir>)` with REAL defaults resolves (never rejects),
  returns 3 checks in order — proves the default backends compose without throwing.

Test feeds the authored bytes by reading `examples/templates/kitchen-seed/...` for the
all-green case (the init-kitchen.test.ts idiom — grade against authored source, not a
restated literal).

### CREATE `src/kitchen/kitchen-doctor.smoke.test.ts` (guarded-live, the AC)

Mirrors `doctor-cli.smoke.test.ts`. One scaffold-then-run case:
- `mkdtemp` → `runInit(tmp, "kitchen")` (reuse the real init effect, as init-kitchen.test does)
  → `Bun.spawnSync(["bun","run", CLI, "doctor"], { cwd: tmp, env: process.env })`.
- Assert `exitCode === 0`; `stdout.startsWith("doctor:")`; `stdout` contains `doctor: ok`;
  contains `✓ bun on PATH`, `✓ Astro storefront config present`, `✓ EmDash Dish seed valid`;
  NO stack frame. `finally` rm the tmp dir.
- A second tiny assertion (cheap, reuses the same scaffold path concept): the report does NOT
  list `lisa on PATH` — confirming the workspace-aware switch actually swapped check-sets (so
  green isn't an accident of the host happening to have lisa).

### MODIFY `src/cli.ts` (the `doctor` dispatch arm only, ~lines 920–934)

Make the arm workspace-aware. Read the cwd listing, branch on `isKitchenWorkspace`:

```
if (parsed.cmd === "doctor") {
  const { renderDoctorReport } = await import("./doctor/doctor-core.ts");
  const { readdir } = await import("node:fs/promises");
  const { isKitchenWorkspace, probeKitchen } = await import("./kitchen/kitchen-doctor.ts");
  const cwd = process.cwd();
  const entries = await readdir(cwd).catch(() => [] as string[]);
  const checks = isKitchenWorkspace(entries)
    ? await probeKitchen(cwd)
    : await (await import("./doctor/doctor-probe.ts")).probeDoctor();
  const report = renderDoctorReport(checks);
  process.stdout.write(`${report.report}\n`);
  process.exit(report.exitCode);
}
```

Comment is updated to explain the workspace-aware switch + why (standalone kitchen app's
prerequisites differ from the build engine's). Lazy imports preserved. `parseDoctorArgs`
UNCHANGED (still zero-arg). `readdir` failure → `[]` → non-kitchen branch (safe default).

## Unchanged (explicit)

- `src/doctor/doctor-core.ts`, `src/doctor/doctor-probe.ts`, `src/doctor/preflight.ts` —
  untouched. The verdict renderer is already general; the cast guard deliberately keeps the
  build-engine checks (see design).
- `src/kitchen/dish-seed.ts` — consumed as-is (its header already anticipates this use).
- `src/kitchen/kitchen-overlay.ts`, `examples/templates/kitchen-seed/**` — source of truth,
  read-only here.

## Ordering of changes

1. `kitchen-doctor.ts` (the probe + detector).
2. `kitchen-doctor.test.ts` (unit) — proves the branches before wiring.
3. Wire `cli.ts` doctor arm.
4. `kitchen-doctor.smoke.test.ts` (the AC) — proves the wired, scaffolded end-to-end green.

Each step is independently committable; the test files gate the code they cover.

## Module boundaries / invariants preserved

- Pure verdict logic stays in `doctor-core`; fs/PATH only in the impure `kitchen-doctor`
  shell with injected deps.
- Never-throws: `probeKitchen` resolves on any input (safeCheck wrapper).
- Name-the-failure: every red check minted via `failed(name, hint)`.
- No CLI surface growth: doctor still takes no arguments; the workspace decides the check-set.
