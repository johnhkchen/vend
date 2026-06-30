# T-062-02-02 — Design: doctor-green-on-kitchen-workspace

## The decision in one line

`vend doctor` becomes **workspace-aware**: when run inside a kitchen workspace (detected by
the seed's top-level signature), it runs the **kitchen-seed prerequisite checks** (bun on
PATH, Astro/Cloudflare storefront config present, EmDash Dish seed valid) instead of the
vend-tool/build-engine checks. Everywhere else it is unchanged. A new guarded-live smoke test
scaffolds the kitchen seed and asserts `vend doctor` exits green with all three probes passing.

## Why workspace-aware (the central tradeoff)

The AC demands a **hard green exit**. The existing doctor smoke test is deliberately written
to NOT assert hard green (it asserts `exit 0 ⇔ "doctor: ok"`) because lisa/claude/BAML are
not guaranteed on a CI box. So whatever check-set doctor runs in a kitchen workspace must be
green-able deterministically: `bun` (guaranteed — the test runs under bun), the scaffolded
Astro config, and the scaffolded EmDash seed. The build-engine deps (lisa/claude/BAML) are
NOT in that green-able set.

This is not just a test convenience — it is *correct*. A kitchen workspace is a STANDALONE
Astro app (`STANDALONE_TEMPLATES` includes `kitchen`; it writes no lisa marker). Its
prerequisites are the app's runtime/build deps, not the vend/lisa build engine. `vend doctor`
answers "are the prerequisites for what you'd do *here* satisfied?" — in a build project that
is lisa/claude/BAML; in a standalone kitchen app it is bun/Astro/EmDash. The context switch
makes doctor *more* honest, and it is what makes the AC's green deterministic.

## Options considered

### Option A — Additive: kitchen checks appended to the existing four (REJECTED)

`vend doctor` in a kitchen workspace runs lisa+claude+BAML+executor **and** the three kitchen
checks; assert green. Rejected: green then requires lisa/claude/BAML present, which the
existing smoke test's own design says we cannot assume. The smoke test would be flaky on any
host missing the build engine — the exact failure mode the E-042 author engineered around.

### Option B — A new command / flag, e.g. `vend doctor --kitchen` (REJECTED)

`parseDoctorArgs` currently rejects ALL arguments; this would widen the CLI surface and
contradict the "doctor takes no subject" contract. It also pushes the decision onto the user
("which doctor do I run?") when the workspace itself already says which prerequisites matter.
A non-goal of the project is gratuitous surface. Rejected.

### Option C — Workspace-aware dispatch (CHOSEN)

Doctor detects the workspace from cwd and runs the matching check-set. No new CLI surface
(still zero-arg), no flakiness (kitchen set is deterministically green post-scaffold), and
semantically correct (each workspace's real prerequisites). The detection mirrors the
established `isLisaProject(listing)` idiom.

## Shape of the chosen design

### Detection — `isKitchenWorkspace(entries)` (pure)

Mirror `isLisaProject`. A directory is a kitchen workspace iff its top-level listing contains
**both** `.emdash` AND `astro.config.mjs` — the two unambiguous seed signatures (the EmDash
content dir + the Astro storefront config). Requiring both avoids false positives (a generic
Astro repo, or some unrelated `.emdash`). Lives next to the kitchen probe (kitchen-specific
knowledge), not in generic `init-core`.

### The three kitchen checks (impure shell, injected deps, pure validators reused)

A new module `src/kitchen/kitchen-doctor.ts` — the kitchen analogue of `doctor-probe.ts`:
impure but narrow, injectable deps, never throws (every check `safeCheck`-style wrapped),
emits `Check[]` the existing pure `renderDoctorReport` verdicts. The checks, in fixed order:

1. **`bun on PATH`** — `onPath("bun")` (envinfo `which`, the same backend doctor-probe uses).
   Hint: `install bun (https://bun.sh) and ensure \`bun\` is on your PATH`. This is the only
   genuine system prerequisite; `astro`/`@astrojs/cloudflare` install *through* bun, so bun is
   the thing that must exist before anything else works.

2. **`Astro storefront config present`** — read `astro.config.mjs` + `package.json` from the
   workspace; green iff the config declares the Cloudflare adapter (`adapter` + `cloudflare`)
   AND `package.json` declares both `astro` and `@astrojs/cloudflare` dependencies. This is a
   **config-presence** check (no node_modules needed — the seed ships no `node_modules`), so it
   is green right after scaffold. Hint: `re-run \`vend init --template kitchen\` to restore the
   Astro/Cloudflare storefront config`. Reuses the exact signals T-062-02-01's test pins.

3. **`EmDash Dish seed valid`** — read `.emdash/seed.json`; `parseKitchenSeed` +
   `validateDishSeed` (the pure contract dish-seed.ts advertises as reusable here). Green iff
   `ok` (zero violations). On failure, the hint carries the first violation so the line is
   actionable (e.g. `Dish field \`name\` must be required — re-run \`vend init --template
   kitchen\``). A parse throw (malformed JSON) is caught and rendered as a red check with the
   parse message — never a crash (returned-data-never-thrown).

All three names + hints are exported constants (the doctor-probe single-source-of-truth
style), so the unit test asserts against the constants, not re-stated literals.

### Injection seam (testable today)

`KitchenProbeDeps { onPath, readFile, readdir }` defaulting to envinfo `which` + node fs.
`probeKitchen(dir, deps)` runs the three checks against `dir`, concurrently, order-preserved,
each wrapped so the probe RESOLVES. Unit tests inject fabricated fs/PATH to exercise every
branch (bun missing, config absent, seed invalid, all-green) deterministically — the
`planInit(existing, manifest)` discipline, no dependence on the host.

### CLI wiring

The `doctor` arm reads the cwd listing once. If `isKitchenWorkspace(listing)` →
`renderDoctorReport(await probeKitchen(cwd))`; else the existing
`renderDoctorReport(await probeDoctor())`. Both branches print `report.report` and exit
`report.exitCode`. Lazy imports as today. No change to `parseDoctorArgs` (still zero-arg).

## Deliberate non-changes

- **`preflight.ts` / `castPreflight` untouched.** The cast door still runs the build-engine
  checks: a standalone kitchen app still needs lisa/claude/BAML to `vend work` the
  menu-render slice, so the cast guard must keep checking them. Making the cast guard
  kitchen-aware would let a cast proceed into a missing build engine. Out of scope and wrong.
- **`doctor-core.ts` untouched.** The verdict logic is already general over any `Check[]`.
- **No new node_modules / install step.** Config-presence keeps green achievable at scaffold.

## What proves it (mapping to the AC)

- Unit test (`kitchen-doctor.test.ts`): every branch of the three checks with injected facts
  + a guarded-live "the real defaults compose without throwing" block (the doctor-probe.test
  pattern).
- Smoke test (`kitchen-doctor.smoke.test.ts`): `runInit(tmp, "kitchen")`, then spawn
  `bun run src/cli.ts doctor` with `cwd: tmp`, assert `exitCode === 0`, `stdout` contains
  `doctor: ok` and a `✓` line for each of the three kitchen checks, and NO stack trace. `bun`
  is guaranteed (the spawn runs under bun); the config + seed are scaffolded → deterministic
  green. This is the AC, end to end.
