# T-060-02-02 — Progress

## Done (all plan steps)

- **Step 1 — pure resolver + quote renderer** (`src/play/work-core.ts`): added `WorkBudgetPlan`,
  `makeWorkBudgetPlan`, `planWorkBudget`, `renderBudgetQuote` + the three imports
  (`coldStartEnvelope` value; `ValueTier`/`RunRecord` type-only). ~50 lines, additive.
- **Step 2 — tests** (`src/play/work-core.test.ts`): new `describe` with 6 cases (local `recordOf`
  factory + a `clearingCast` stub). Drives the real `spendDown` funded at the calibrated default →
  ≥1 clear; pins quote == p90 (< funding); cold-start fundable; `usedDefault`/override; quote render.
- **Step 3 — shell wiring** (`src/play/work.ts`): reordered `loadRunLog`/`prior` above the wallet;
  one `coldStartEnvelope` call now sources `price`, the funding legs (`cold.perPlay`), and the
  default (`makeWorkBudgetPlan`); added `onPlan`, emitted before the loop. Deleted
  `DEFAULT_MACRO_BUDGET`, the private `sumBudgets`, and the `recalibrate` import.
- **Step 4 — CLI** (`src/cli.ts`): dropped `DEFAULT_MACRO_BUDGET`; `budget` passed only when present;
  `onPlan` prints `renderBudgetQuote` (when `usedDefault`) + captures `funded` for the meter; final
  receipt wallet uses `result.funded`.
- **Step 5 — seed docs** (`README.md`, `shelf-note.md`): "defaults to 2h/2M" → "funds the calibrated
  cold-start clear at the p90 quote." `EXPECTED-OUTCOME.md` untouched (T-060-03-01).
- **Step 6 — gate**: `bun run check` → **1354 pass / 0 fail**, `tsc --noEmit` clean.

## Deviations from plan

None of substance. Confirmed during research that `castWork`'s existing `price` was already
`coldStartEnvelope().envelope` (same Σ), so Step 3 became a *unification* (one `coldStartEnvelope`
call replacing two `recalibrate` calls + `sumBudgets`) rather than an addition — net-neutral lines,
cleaner, and the funding legs now read `cold.perPlay` instead of re-recalibrating.

## Verification at each step

- work-core.test.ts: 26 pass / 0 fail (14 new `expect`s).
- Full gate after wiring: 1354 pass / 0 fail.
- `grep DEFAULT_MACRO_BUDGET src examples` → only the explanatory comment in work-core.ts.
- `grep "2 hours / 2M" examples/templates/hackathon-seed` → none.
