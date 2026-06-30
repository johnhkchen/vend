# Structure — T-062-03-04 harden-bootstrap-friction-fix-at-source

_Phase: Structure. File-level blueprint: what is created/modified/deleted, the guard's shape,
the ledger's shape, and the ordering. Not code — the shape of the code._

## Files

### Created (source)
- `src/kitchen/cold-start-redrive.test.ts` — the end-to-end re-drive guard. One `describe`, one
  primary `test` driving the deterministic cold-start path in sequence on ONE workspace, plus a
  small `afterEach` teardown. ~120–150 lines.

### Created (artifacts, `docs/active/work/T-062-03-04/`)
- `friction-ledger.md` — the consolidated friction → disposition table (the AC's per-friction
  record). Names each friction, its stage, the fix-at-source location, the guarding test, and —
  for boundaries — the escalation target.
- `research.md`, `design.md`, `structure.md`, `plan.md`, `progress.md`, `review.md` — the RDSPI
  trail (this file is `structure.md`).

### Modified
- **None under `src/`.** Research found no broken deterministic seam; Design rejected inventing a
  fix where there is no friction. The guard is itself the regression probe.

### Deleted
- **None.**

## The guard: `src/kitchen/cold-start-redrive.test.ts`

### Imports (all real shipped seams — no mocks)
```
bun:test                         → describe, expect, test, afterEach
node:fs/promises                 → mkdtemp, rm, readFile, readdir, stat
node:os                          → tmpdir
node:path                        → join
../init/init-effect.ts           → runInit
./kitchen-doctor.ts              → probeKitchen, isKitchenWorkspace, KITCHEN_SIGNATURE,
                                   BUN_CHECK, ASTRO_CHECK, SEED_CHECK
../doctor/doctor-core.ts         → renderDoctorReport, EXIT_OK
../play/project-context.ts       → buildProjectSnapshot, listIdsIn, SEED_PATH, CHARTER_PATH
../engine/mcp-registry.ts        → readProjectMcpServers
../engine/cast-core.ts           → resolveTools
../play/decompose-epic-core.ts   → DECOMPOSE_TOOLS
../play/autonomous-deny.ts       → AUTONOMOUS_DENY
```

### Helpers (mirroring the existing kitchen-test idioms, no shared util)
- `exists(abs): Promise<boolean>` — `stat`→true / catch→false (the `seed-steer-seam.test.ts`
  idiom).
- `tmps: string[]` + `afterEach` teardown (the `kitchen-degrade.test.ts` idiom).
- `scaffold(): Promise<string>` — `mkdtemp` + push to `tmps` + return root (NOT init'd yet, so
  the test body owns the first `runInit` as stage 1).

### The test body — the path IN SEQUENCE on ONE `root` (the dimension no other test covers)
A single `test("the full cold-start path re-drives clean in one pass …")`:

1. **INIT** — `const out = await runInit(root, "kitchen")`; assert `out.kind === "scaffolded"`
   and `out.created.length > 0`, `out.skipped.length === 0`. (First drive of a bare dir.)
2. **SCAFFOLD** — read `await readdir(root)`; assert `isKitchenWorkspace(entries)` true and
   `KITCHEN_SIGNATURE` members present; assert the four intent/contract files exist:
   `.emdash/seed.json`, `SEED.md`, `docs/knowledge/charter.md`, `src/pages/index.astro`.
3. **DOCTOR** — `const checks = await probeKitchen(root)` (REAL default deps — bun is on PATH
   because bun runs the test); `const report = renderDoctorReport(checks)`; assert
   `report.ok === true`, `report.exitCode === EXIT_OK`, every check `ok`, and the three named
   checks (`BUN_CHECK`/`ASTRO_CHECK`/`SEED_CHECK`) all present and green.
4. **SEED→STEER (inputs, zero spend)** — reconstruct `assembleSteerInputs`' pure core exactly as
   `seed-steer-seam.test.ts` does: read `SEED_PATH` + `CHARTER_PATH`, `listIdsIn` stories +
   tickets, `buildProjectSnapshot({ root, srcFiles:[], stories, tickets, intent })`; assert the
   snapshot contains `## Stated intent (SEED.md)` + the menu intent, and the charter is the
   kitchen value function (not the generic stub).
5. **DEGRADE (mcp-absence, zero spend)** — `const { available } = await readProjectMcpServers(root)`;
   assert `available` is `[]`; `const resolved = resolveTools(DECOMPOSE_TOOLS, available)`;
   assert the degraded shape: `ok:true`, `reducedGrounding:true`, `mcp:[]`,
   `allowedTools:["Read","Grep","Glob"]`, `deny` = `AUTONOMOUS_DENY` — and explicitly NOT the
   missing-capability andon.
6. **RE-DRIVE (idempotent, no manual intervention)** — `const again = await runInit(root, "kitchen")`;
   assert `again.created.length === 0` and `again.skipped.length === out.created.length`
   (no-clobber converge). Re-`probeKitchen` → still all green.

### What the comment header must state (honest boundary)
- WHY this exists: the per-seam tests each drive their own dir; this is the ONLY test that drives
  the **whole path as a composition on one workspace** — the AC's "full path re-drives clean".
- WHY it's deterministic: green-by-construction (bun on PATH; scaffolded config + seed).
- WHAT is deferred: the live metered steer ranking + `vend work` clear (T-062-04-01, P7) — this
  guard stops at steer *inputs* and degrade *resolution*, never spending a token.

## The ledger: `friction-ledger.md`

A table + short prose, structured as:
- **Header**: scope, the deterministic/metered split, the honest finding (surface already clean).
- **Per-friction table**: `friction | stage | surfaced-in | disposition | fix-at-source | guard`.
  One row per friction from Research §"friction log" (6 rows).
- **Boundaries → escalation table**: `boundary | why out-of-scope | escalation target`.
  Three rows; target = proposed `E-063 kitchen-clean-room-drive`.
- **Re-drive evidence**: the by-hand drive transcript summary + the new gated guard.
- **Honest-on-outcome footer**: metered half = `⟪…⟫` (T-062-04-01).

## Ordering of changes (matters)

1. Write `cold-start-redrive.test.ts` first and run it — it must pass on the *current* tree
   (proving the composition is clean) OR surface a real break to fix here.
2. If it surfaces a break: fix at source, re-run. (Expectation per Research: no break.)
3. Write `friction-ledger.md` with the guard's actual result folded in.
4. `bun run check` — full gate green, no regression (+N tests).
5. `progress.md` + `review.md`.

## Interfaces touched

- **None changed.** The guard only *consumes* existing public exports (`runInit`, `probeKitchen`,
  `renderDoctorReport`, `buildProjectSnapshot`, `readProjectMcpServers`, `resolveTools`,
  `DECOMPOSE_TOOLS`). No signature added or altered, so no caller is affected.
