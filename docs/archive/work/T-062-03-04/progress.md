# Progress — T-062-03-04 harden-bootstrap-friction-fix-at-source

Execution log against `plan.md`. ✅ done · ⏸️ deferred-by-design.

## Step 1 — End-to-end re-drive guard ✅
- Created `src/kitchen/cold-start-redrive.test.ts`: one `describe`, one `test` driving the
  deterministic cold-start path **in sequence on ONE temp workspace** — Stage 1 INIT
  (`runInit` → scaffolded, created>0, zero skips), Stage 2 SCAFFOLD (`isKitchenWorkspace` +
  `KITCHEN_SIGNATURE` + the four intent/contract files exist), Stage 3 DOCTOR (real `probeKitchen`
  → `renderDoctorReport` ok/exit 0/3 green checks in fixed order), Stage 4 SEED→STEER (pure
  `buildProjectSnapshot` carries `## Stated intent (SEED.md)` + the menu intent; charter is the
  kitchen value function), Stage 5 DEGRADE (`readProjectMcpServers` empty → `resolveTools`
  degraded shape with `reducedGrounding:true`, not the andon), Stage 6 RE-DRIVE (second `runInit`
  converges no-clobber; doctor stays green).
- Reuses the real shipped seam functions (no mocks) and the existing kitchen-test idioms
  (`exists` stat-or-false, `tmps`+`afterEach` teardown, `bareEmptyDir`).
- `bun test src/kitchen/cold-start-redrive.test.ts` → **1 pass / 0 fail / 25 expect()**, **first
  run, no source fix needed** — confirming the composition is already clean (the expected outcome
  per Research/Design). **No deviation.**

## Step 2 — No regression across the gate ✅
- `bun run check` → `tsc --noEmit` clean; **1488 pass / 1 skip / 0 fail** (was 1487 — +1 test, no
  regression). The degrade fixtures' expected `andon: timed-out` / `reduced grounding` log lines
  are the pre-existing cast-test output, not failures.

## Step 3 — Friction ledger ✅
- Created `docs/active/work/T-062-03-04/friction-ledger.md`: the per-friction disposition table
  (7 rows — 6 epic-named frictions all fixed-at-source-with-a-guard upstream, + the new
  composition guard this card adds), the boundaries→escalation table (3 rows → proposed
  `E-063 kitchen-clean-room-drive`), the re-drive evidence (by-hand transcript + the gated guard),
  and the honest-on-outcome footer.

## Step 4 — Re-drive witness ✅
- The by-hand deterministic drive is captured in `research.md` and the ledger (init 31-created,
  doctor 3-green, idempotent, steer dispatches metered). The gated guard (Step 1) is the durable
  replacement. The metered path was **not** re-run (P7).

## Step 5 — progress.md + review.md ✅
- This file + `review.md`.

## Deviations from plan
- **None.** The plan's Step 1 contingency ("if the guard surfaces a real break, fix at source")
  did not fire — the guard passed first run, so there was no deterministic source fix to make
  (the honest, good outcome for a hardening card; the frictions were already fixed upstream).

## Honest status of the AC
- **Clause A (per-friction disposition):** ✅ met — every friction fixed-at-source with a named
  guard (ledger rows 1–7); the 3 out-of-scope boundaries escalated to the proposed follow-up epic.
- **Clause B (full path re-drives clean, no manual intervention):** ✅ met (deterministic half) —
  `cold-start-redrive.test.ts` gates it; ⏸️ the metered half (live steer ranking + work clear in
  budget) deferred to T-062-04-01, recorded as `⟪…⟫`, no number invented.

## Commits
Left to Lisa (file-locked, serialized — rdspi-workflow §Concurrency). The working tree carries
uncommitted sibling-thread work (the whole `examples/templates/kitchen-seed/` tree + `src/init/*`
mods + the other T-062-03-0x kitchen files); a by-hand `git add` would entangle it. `bun run
check` is green over the combined tree.
