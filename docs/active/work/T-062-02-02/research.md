# T-062-02-02 — Research: doctor-green-on-kitchen-workspace

## The ask

Ensure `vend doctor` probes and reports **green** on the freshly-scaffolded kitchen
workspace, covering the EmDash/Astro/bun prerequisites the seed needs. The single AC: a
smoke test scaffolds the kitchen workspace, runs `vend doctor`, and asserts a green exit
with every kitchen-seed prerequisite probe passing.

Depends on T-062-02-01 (DONE) — `vend init --template kitchen` scaffolds the full
EmDash+Astro seed into an empty dir. That ticket is what produces the workspace this one
must report green on.

## The doctor preflight, as it exists today

`vend doctor` is the E-042 preflight gate. Three modules, the project's pure-core /
impure-shell split:

- **`src/doctor/doctor-core.ts`** — PURE. `Check` (a named probe result + optional fix-it
  `hint`), `passed(name)` / `failed(name, hint)` constructors, and `renderDoctorReport(checks)`
  → `DoctorReport { ok, exitCode, report }`. `ok` is `failCount === 0`; `exitCode` is
  `EXIT_OK` (0) when ok, else `EXIT_FAILED` (1). Empty set → honest-empty line, exit 0.
  Lists every check (green `✓` and red `✗ <name> — <hint>`). ZERO throws.
- **`src/doctor/doctor-probe.ts`** — IMPURE but narrow. `probeDoctor(deps)` runs four
  vend-tool checks concurrently and returns the ordered `Check[]`: **lisa on PATH**,
  **claude on PATH**, **BAML native addon loadable**, **active executor config**. World-facts
  are INJECTED via `DoctorProbeDeps { onPath, bamlLoadable, env }` (defaults: envinfo `which`,
  a dynamic `@boundaryml/baml` import, `process.env`). Every check is `safeCheck`-wrapped →
  the probe NEVER rejects. Check names + hints are exported constants (single source of truth).
- **`src/doctor/preflight.ts`** — `castPreflight(deps)` composes `probeDoctor` →
  `renderDoctorReport` as the cast precondition guard (T-042-04), reused at the door of a
  cast (`castWork`) to refuse cleanly before a budget is committed.

The CLI dispatch arm (`src/cli.ts`, ~line 920): lazy-imports `probeDoctor` +
`renderDoctorReport`, prints `report.report`, exits `report.exitCode`. `parseDoctorArgs`
(line ~256) takes **NO arguments at all** — any token after `doctor` is a usage error.
Doctor reads NO cwd / fs today; its only world is envinfo, the addon import, and env.

### The existing smoke test's non-flaky discipline (load-bearing constraint)

`src/doctor/doctor-cli.smoke.test.ts` spawns the real `bun run src/cli.ts doctor`. Case A
deliberately asserts only the INVARIANT — `exit 0 ⇔ stdout includes "doctor: ok"` — **never
a hard green** — precisely because a CI box may lack `claude`/`lisa`. Case B injects a
host-independent fault (`VEND_EXECUTOR=bogus`) to prove the red path. This tells us: a new
smoke test that asserts a **hard green exit** cannot depend on lisa/claude/BAML being
present, because they are not guaranteed in the test environment.

## The kitchen seed (what T-062-02-01 scaffolds)

`src/kitchen/kitchen-overlay.ts` — `KITCHEN_OVERLAY: ScaffoldEntry[]`, the files
`vend init --template kitchen` layers over the base scaffold. Authored bytes live at
`examples/templates/kitchen-seed/` and are text-embedded into the binary. Headline files:

- `.emdash/seed.json` — the EmDash Dish content type + one example dish.
- `astro.config.mjs` — `output: "server"` + `adapter: cloudflare()`.
- `package.json` — declares `astro ^6.4.8` + `@astrojs/cloudflare ^13.7.0`.
- `wrangler.toml` — `name = "kitchen-storefront"`, config-present (no live creds).
- `src/pages/index.astro` (stub "coming soon"), `tsconfig.json`, `.gitignore`,
  `bun.lock`, `README-STACK.md`, `.github/workflows/deploy.yml`, `public/favicon.svg`,
  `src/env.d.ts`.

Crucially, the overlay does **NOT** scaffold `node_modules`. So a freshly-scaffolded
workspace has the seed's package manifest and config, but no installed dependencies until
the cook runs `bun install`. Any "Astro prerequisite" probe must therefore be a
**config-presence** check (the manifest declares it), NOT a node_modules resolution — else
it could never be green right after scaffold, contradicting the AC.

`kitchen` is a STANDALONE template (`STANDALONE_TEMPLATES` in `init-core.ts` =
`{minimal, kitchen}`): it writes NO lisa marker (`CLAUDE.md` / `.lisa.toml`) and lands in an
empty dir. So a kitchen workspace is *not* a lisa/build project — it is a standalone Astro
app. Its prerequisites are the app's (bun, the Astro/Cloudflare config, the EmDash seed),
NOT the vend/lisa build-engine deps.

## The Dish-seed contract (reusable, by design)

`src/kitchen/dish-seed.ts` is PURE and its header explicitly states it is "reusable as-is by
a future `vend doctor` kitchen check." Relevant exports:

- `parseKitchenSeed(json)` → `EmDashSeed` (structural guard, throws on malformed).
- `validateDishSeed(seed)` → `DishSeedCheck { ok, violations }` — grades the Dish content
  type + the single-row honest-empty contract; soft (accumulates reasons, never throws on
  bad data).
- `dishRecords(seed)`, `findCollection(seed, slug)`.

T-062-02-01's `init-kitchen.test.ts` already proves the *scaffolded* `.emdash/seed.json`
passes `validateDishSeed` with zero violations, and that `astro.config.mjs` contains
`adapter` + `cloudflare`, `package.json` contains `@astrojs/cloudflare`, `wrangler.toml`
contains `kitchen-storefront`. These are exactly the green signals a kitchen probe will
re-assert against the live scaffolded dir.

## Workspace detection idiom

`init-core.ts` `isLisaProject(existing: Iterable<string>)` — pure, true iff the top-level
listing contains any `LISA_MARKERS` entry. This is the established pattern for "what kind of
workspace is this, from a directory listing." A kitchen-workspace detector would mirror it:
the seed's signature at top level is `.emdash` + `astro.config.mjs`.

## Constraints & assumptions surfaced

1. **Deterministic green requires kitchen-only checks.** The whole set doctor runs in a
   kitchen workspace must be green-able with no install step and no lisa/claude/BAML on the
   host. `bun` IS guaranteed (the test runs under bun). The Astro config and EmDash seed are
   scaffolded. lisa/claude/BAML are NOT guaranteed → they cannot be part of the asserted-green
   set.
2. **No node_modules at scaffold time** → Astro check is config-presence, not resolution.
3. Doctor must not regress for non-kitchen invocations (the existing smoke test runs in the
   repo root, which has no kitchen signature at top level).
4. Purity doctrine: any new fs reading belongs in an impure shell with injected deps (the
   `probeDoctor` pattern); the verdict logic stays in pure `doctor-core`.
5. `castPreflight` (the cast door guard) is a separate question — a standalone kitchen app
   still needs the build engine to `vend work`, so the cast guard's build-engine checks should
   stay. This ticket is scoped to the `vend doctor` *command*.
