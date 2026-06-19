# T-007-02 — Progress: generic-cast-loop

## Status: Implement complete — all gates green

Followed the plan's step order. One commit (the pure core + its test + the impure verb
landed together as one coherent slice rather than split — they typecheck only as a pair,
so a mid-slice commit would not have built).

## Steps

- [x] **Step 1 — `src/engine/cast-core.ts` (pure core).** `DEFAULT_MODEL`,
  `resolveLoggedModel`, `ClassifyInput`/`Verdict`, `castGateRows`, `classify` (generic over
  `GateVerdict`), `formatMessage`, `makeStreamSink`. All imports `import type` — addon-free.
- [x] **Step 2 — `src/engine/cast-core.test.ts`.** 12 tests: `classify` ×4 (timeout outranks,
  budget beats clear (P7), in-budget stop → gate-failed + row, clear → success + `[]` rows),
  `castGateRows` ×3, `formatMessage`, `makeStreamSink`, `resolveLoggedModel` ×3. Imports only
  the pure core — no BAML, no `./cast.ts`, no spawn.
- [x] **Step 3 — `src/engine/cast.ts` (impure verb).** `CastOptions`, `RunSummary`,
  `castPlay<I, O>`, private `stopReason`. Re-exports the pure core via `export *`.
- [x] **Step 4 — gate sweep.** `tsc --noEmit` exit 0; `bun test` 248 pass / 0 fail / 17 files.

## Verification results

- `bun run check:typecheck` → clean (exit 0). The play-agnostic compile is proven: `castPlay`
  typechecks against the generic `Play<I, O>` with zero `src/play/`, gates.ts, or BAML import.
- `bun run check:test` → **248 pass, 0 fail** (236 prior + 12 new). No regression.
- Import audit: `grep -nE "from \"\.\./play|from \"\.\./gate|baml_client" src/engine/cast*.ts`
  → no matches. AC#2 (play-agnostic) confirmed mechanically.
- One `appendRunLog` call in `castPlay`, reached on every terminal path (AC#1).

## Acceptance criteria

- [x] **AC#1** — `castPlay(play, inputs, budget, opts) -> RunSummary`: the
  render→dispense→meter→parse→gate→classify→effect→log loop, branching on the reused pure
  `classify`; streams every message to both surfaces (`makeStreamSink`); one `appendRunLog`
  per cast.
- [x] **AC#2** — play-agnostic: `cast.ts` touches the `Play` interface only; no
  DecomposeEpic/gates/BAML code (import audit above).
- [x] **AC#3** — impure orchestration (`castPlay`) is the single untested verb; the decision
  core (`cast-core.ts`) is pure + tested (mirrors the runner split).
- [x] **AC#4** — `check:test` / `check:typecheck` green.

## Deviations from plan

- **Single commit instead of two.** Plan §Step 2 anticipated a cast-core commit before
  cast.ts. The two typecheck only together (cast.ts imports cast-core's `classify` etc.), so
  committing cast-core alone would build but the natural reviewable unit is the whole loop.
  Landed as one commit `5abe19e`. No scope change.

## Carried to Review (deliberate, flagged)

1. **Duplicated stream/model helpers** (`makeStreamSink`/`formatMessage`/`resolveLoggedModel`)
   mirror decompose-epic-core.ts — unavoidable given the no-cycle constraint (engine ↛ play).
   A kaizen DRY is possible once T-007-03 reverses the dep direction.
2. **Successful DecomposeEpic runs will log `gateResults: []`** once wired through `castPlay`
   (D3: `GateVerdict.clear` is opaque), vs the welded runner's 4 passed rows. Faithful to the
   generic contract; T-007-03 can enrich `GateVerdict.clear` if per-gate success logging
   matters.
3. **`castPlay` has no live/integration test** — the untested-verb category, by design; it
   goes live in T-007-03.
