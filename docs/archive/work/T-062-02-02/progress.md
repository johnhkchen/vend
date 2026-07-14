# T-062-02-02 — Progress

## Status: COMPLETE (all phases through Review)

## Completed

- **Step 1 — `src/kitchen/kitchen-doctor.ts`** ✓
  Impure kitchen-workspace probe: `isKitchenWorkspace(entries)` (pure detector, both
  signatures required), `KitchenProbeDeps` injection seam + real defaults (envinfo `which`,
  node `readFile`), the three check verbs (`bunCheck`, `astroConfigCheck`, `dishSeedCheck`),
  the `safeCheck` never-throw wrapper, and `probeKitchen(dir, deps)` (fixed order, resolves
  always). Reuses the pure `Check`/`passed`/`failed` (doctor-core) + `parseKitchenSeed`/
  `validateDishSeed` (dish-seed). Names + hints exported as constants.

- **Step 2 — `src/kitchen/kitchen-doctor.test.ts`** ✓
  Unit cover of every branch with injected facts (all-green from authored bytes, bun-off-PATH,
  astro config without adapter, package.json missing a dep, seed contract violation, malformed
  seed degraded by safeCheck, readFile-always-throws → 3 reds), `isKitchenWorkspace` true/false,
  and a guarded-live "real defaults compose without throwing" block.

- **Step 3 — `src/cli.ts` doctor arm** ✓
  Workspace-aware dispatch: read the cwd listing (`readdir(...).catch(() => [])`), branch on
  `isKitchenWorkspace` → `probeKitchen(cwd)` else `probeDoctor()`. Render/print/exit unchanged.
  `parseDoctorArgs` untouched (still zero-arg). Comment rewritten to explain the switch + why.

- **Step 4 — `src/kitchen/kitchen-doctor.smoke.test.ts`** (the AC) ✓
  `mkdtemp` → `runInit(tmp, "kitchen")` → spawn `bun run src/cli.ts doctor` with `cwd: tmp`.
  Asserts exit 0, `doctor: ok`, a `✓` line for each of bun / Astro config / EmDash seed, NO
  build-engine lines (proves the switch swapped check-sets), no stack trace.

- **Step 5 — gate + artifacts** ✓
  `bun run check` green (tsc clean; 1471 pass / 1 skip / 0 fail). research/design/structure/
  plan/progress/review written.

## Verification

- `bun test src/kitchen/kitchen-doctor.test.ts src/kitchen/kitchen-doctor.smoke.test.ts`
  → 13 pass / 0 fail.
- `bun run check` → typecheck clean, full suite 1471 pass / 0 fail.

## Deviations from plan

- None of substance. Committed as a single cohesive commit (probe + tests + CLI wiring +
  artifacts) rather than four micro-commits — the pieces are mutually dependent (the CLI arm
  imports the probe; the smoke test exercises the wired arm), so one atomic commit keeps every
  intermediate state building and green. The plan's step ordering was still followed in authoring.

## Files

- CREATE `src/kitchen/kitchen-doctor.ts`
- CREATE `src/kitchen/kitchen-doctor.test.ts`
- CREATE `src/kitchen/kitchen-doctor.smoke.test.ts`
- MODIFY `src/cli.ts` (the `doctor` dispatch arm only)
