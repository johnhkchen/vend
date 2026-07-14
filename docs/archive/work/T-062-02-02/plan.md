# T-062-02-02 — Plan: doctor-green-on-kitchen-workspace

## Testing strategy

- **Unit** (`kitchen-doctor.test.ts`): every check branch via injected `onPath`/`readFile`
  (deterministic, host-independent) — the doctor-probe.test.ts discipline. Plus a guarded-live
  block proving the REAL default backends compose without throwing.
- **Smoke / integration** (`kitchen-doctor.smoke.test.ts`): the AC — scaffold the real kitchen
  workspace via `runInit`, spawn `vend doctor` with `cwd` set there, assert hard green exit +
  the three `✓` lines + no stack trace. Green is deterministic: bun is the runtime running the
  test, the Astro config + EmDash seed are scaffolded.
- **Gate**: `bun run check` (typecheck + lint + tests) must pass at the end.

## Verification criteria (the AC, decomposed)

1. `vend doctor` run in a freshly-scaffolded kitchen workspace exits 0.
2. The report is the all-green one (`doctor: ok`) and lists a green check for each of bun,
   Astro storefront config, EmDash Dish seed.
3. No stack trace on the green path; the probe never throws on any input (unit-proven).
4. Non-kitchen `vend doctor` is unchanged (existing smoke test still passes; the new smoke
   test confirms the kitchen branch swapped check-sets, i.e. no `lisa on PATH` line).

## Steps (each independently committable)

### Step 1 — `src/kitchen/kitchen-doctor.ts`

Write the impure probe + pure detector per structure.md:
- Module header (house style).
- Exported name/hint constants + `KITCHEN_SIGNATURE`.
- `isKitchenWorkspace(entries)` — pure, both signatures present.
- `KitchenProbeDeps` + `DEFAULT_KITCHEN_PROBE_DEPS` (envinfo `which`, `node:fs/promises`
  readFile utf8).
- Private `whichOnPath`, `messageOf`, `safeCheck`.
- `bunCheck`, `astroConfigCheck`, `dishSeedCheck`.
- `probeKitchen(dir, deps)` — `Promise.all` of the three safeCheck-wrapped checks, fixed order.
- `bun run lint` / typecheck this file.
Commit: `feat(kitchen): vend doctor kitchen-seed prereq probe (E-062 S-062-02)`.

### Step 2 — `src/kitchen/kitchen-doctor.test.ts`

Unit cases per structure.md (all-green from authored bytes, bun-missing, astro-config-bad,
seed-invalid, malformed-seed, `isKitchenWorkspace` true/false, guarded-live defaults compose).
Run `bun test src/kitchen/kitchen-doctor.test.ts` → green.
Commit: `test(kitchen): unit-cover the doctor kitchen probe branches (E-062 S-062-02)`.

### Step 3 — wire `src/cli.ts` doctor arm

Make the arm workspace-aware: read cwd listing, branch `isKitchenWorkspace` →
`probeKitchen(cwd)` else `probeDoctor()`; render/print/exit unchanged. Update the comment.
`parseDoctorArgs` untouched. Typecheck.
Commit: `feat(cli): vend doctor reports on the kitchen workspace's own prereqs (E-062 S-062-02)`.

### Step 4 — `src/kitchen/kitchen-doctor.smoke.test.ts` (the AC)

Scaffold-then-run smoke test. Assert hard green + three `✓` lines + no stack + no `lisa on
PATH` line. `bun test src/kitchen/kitchen-doctor.smoke.test.ts` → green.
Commit: `test(kitchen): AC — vend doctor green on the scaffolded kitchen workspace (E-062 S-062-02)`.

### Step 5 — full gate + review

`bun run check`. Fix any lint/type/test fallout. Write `progress.md` + `review.md`.

## Risks & mitigations

- **R1 — the smoke spawn's cwd / module resolution.** `Bun.spawnSync` with `cwd: tmp` runs
  `bun run <abs CLI path> doctor`; the CLI path is absolute (`join(import.meta.dir, "..",
  "cli.ts")` style), and `process.cwd()` inside the child is `tmp`. The text-embedded seed +
  bundled deps resolve from the CLI's own location, not cwd, so the spawn works from any cwd.
  Mitigation: pass the absolute CLI path (as doctor-cli.smoke.test.ts does).
- **R2 — false green from the host coincidentally having lisa.** Mitigated by asserting the
  report does NOT contain `lisa on PATH` — proves the kitchen branch ran, not the default one.
- **R3 — astro config check too strict/loose.** Use the same signals T-062-02-01's test
  already pins (`adapter`+`cloudflare` in the config; `astro`+`@astrojs/cloudflare` in deps),
  so the check tracks the authored seed exactly.
- **R4 — node_modules assumption.** The Astro check is config-presence only; it never touches
  node_modules, so it is green at scaffold (no `bun install` required). Verified against the
  overlay (no node_modules entry).
- **R5 — readdir failure in the CLI arm.** `.catch(() => [])` → non-kitchen branch → existing
  behavior. Safe default.
