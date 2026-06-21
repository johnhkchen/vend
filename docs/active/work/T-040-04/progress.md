# T-040-04 — Progress

## Status: implementation complete, gate green

The plan executed without deviation. No production source changed — this slice is the
end-to-end proof of the already-complete T-040-01..03 machinery.

## Steps

- **Step 1 — author the test file** ✅ `src/init/init-idempotency.test.ts` created per Structure:
  `LISA` guard constant, `lisaInit` / `lisaValidate` / `exists` helpers, `SEED_TICKET` + `TICKET_REL`,
  and a `describe.skipIf(!LISA)` block with Test A (twice-run end-to-end) and Test B (one-way
  byte-identity). `tsc --noEmit` clean — the `InitOutcome` union is narrowed (`if kind !== "scaffolded"
  throw`) before reading `.result`, the existing init-effect.test.ts idiom.

- **Step 2 — run the new file live** ✅ `bun test src/init/init-idempotency.test.ts` → **2 pass / 0
  fail / 27 expect() calls** (29 ms). The live `lisa` invocations behaved exactly as go-and-see
  predicted:
  - pre-`vend init` `lisaValidate(root)` → 0 (the seed ticket makes the bare project valid).
  - post-`runInit` #1 `lisaValidate(root)` → 0 (vend layered its tree without breaking validity).
  - post-`runInit` #2 `lisaValidate(root)` → 0 (idempotent re-run, still valid).
  - `countDemandRows` on board + archive → 0 (honestly empty).
  - `runInit` #2 → `created === []`, `skipped.length === 17` (zero new writes).

- **Step 3 — init suite + full gate** ✅
  - `bun test src/init/` → **30 pass / 0 fail** across 3 files.
  - `bun test` (whole suite) → **1047 pass / 0 fail / 2733 expect() calls** (1.40 s).
  - `bun run check:typecheck` → clean.
  - No existing test perturbed — no source touched, so no regression is possible by construction;
    the suite count rose by exactly the 2 new tests.

- **Step 4 — progress.md** ✅ this file.

- **Step 5 — commit** ⏳ pending (Review next, then commit per the green-before-merge gate).

## Deviations from plan

None. Every AC oracle landed as specified; the live `lisa` exit codes matched the go-and-see
exactly. The guard (`describe.skipIf(!Bun.which("lisa"))`) is in place so a lisa-less box skips
cleanly rather than failing.

## Evidence the AC is satisfied

> guarded-live test runs `vend init` twice in a fresh bare-lisa temp project: first run creates
> the tree and `lisa validate` passes; second run reports zero new writes and `lisa validate`
> still passes; the seeded demand board contains no fabricated demand rows.

- twice in a fresh bare-lisa temp project → `lisaInit` + seed ticket + two `runInit` calls. ✅
- first run creates the tree → all 17 `SCAFFOLD_MANIFEST` paths `exists()`. ✅
- `lisa validate` passes → `lisaValidate(root) === 0` after run #1. ✅
- second run reports zero new writes → `created === []`, `skipped.length === 17`. ✅
- `lisa validate` still passes → `lisaValidate(root) === 0` after run #2. ✅
- demand board has no fabricated demand rows → `countDemandRows` of board AND archive === 0. ✅
- (bonus) one-way to lisa → the seed lisa ticket is byte-identical after `vend init`. ✅
