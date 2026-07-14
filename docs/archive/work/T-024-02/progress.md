# T-024-02 Progress — autonomous-spend-loop

Implementation tracking against `plan.md`. All steps complete; full gate green.

## Status: complete

| Step | What | State |
|------|------|-------|
| 1 | `RunSummary` actuals seam (`cast.ts`) | ✅ done |
| 2 | Pure decision core (`spend-core.ts` + test) | ✅ done |
| 3 | Impure loop (`spend.ts`) | ✅ done |
| 4 | Full gate `bun run check` | ✅ green (805 pass / 0 fail) |

## What landed

- **`src/engine/cast.ts`** — added `CastActuals { usage; wallMs }` and an additive optional
  `actuals?` on `RunSummary`. `castPlay` now lifts `endedAt` into a `const` (logged line
  byte-identical) and returns `actuals: { usage: result?.usage ?? {}, wallMs: max(0, endedAt −
  startedAt) }`. The existing cast path is unchanged behaviorally.
- **`src/engine/spend-core.ts`** (created, ~135 lines) — pure: `fitNext` (first-fit in rank
  order, skips an unaffordable head, null when nothing fits), `shouldContinue` (andon →
  board-cleared → wallet-exhausted → continue, each with a reason + detail), and the data types
  (`StopReason`, `Continuation`, `BoardState`, `SpendStep`, `SessionResult`, `StepSignal`).
- **`src/engine/spend-core.test.ts`** (created) — 16 unit tests; every branch of both functions.
- **`src/engine/spend.ts`** (created, ~150 lines) — impure `spendDown<C>` (the loop), `SpendLoopParams<C>`,
  and the private `sumActuals` (sums chain-step actuals; lazy ledger fallback by runId). Injected
  `castOne`/`priceOf`/`labelOf` keep the engine ⊥ play boundary; re-exports the core.

## Deviations from plan

- **Single commit, not three.** The seam, core, and loop are interdependent and land cleanest as
  one cohesive `feat(engine)` commit, mirroring how T-024-01 landed (`be7246d`). Each step was
  still verified independently (typecheck after the seam; `spend-core.test.ts` green before the
  loop). No scope change.
- **`spend.ts` imports `ReadResult` as a type** for the lazy-fallback accumulator, rather than the
  inline `Awaited<ReturnType<…>>` first drafted — cleaner and matches house import style. The
  `loadRunLog`/`totalTokens`/`wallClockMs` *values* are still imported lazily inside the fallback
  branch only, so the common path stays off fs.

## Verification

- `bun test src/engine/spend-core.test.ts` → 16 pass.
- `bun run check:typecheck` → clean (`strict` + `noUncheckedIndexedAccess`).
- `bun run check` → `baml:gen` ok, typecheck clean, `bun test` 805 pass / 0 fail (16 new; the
  789 pre-existing all still green — the seam is additive).
- No `lint` script exists yet (a not-yet-live convention per CLAUDE.md); the live gate is `check`.
