# E-068 clearing notes (go-and-see)

Grounded against the actual seams, 2026-07-11:

- **Slice 1 blast radius is two functions, not many.** The parity 4-bucket sum funnels through
  exactly `budget.ts#countTokens` (read by the hard-wall `check`; imported by `wallet.ts`
  debit/canAfford and by `engine/graph-core.ts` + `engine/spend.ts` + `engine/graph-example.ts`
  wave/spend accounting) and `run-log.ts#totalTokens` (read by `recalibrate.ts`, `walk-away.ts`,
  and `spend.ts`'s ledger recompute). Re-base those two onto one cost-weight model and every
  consumer cost-weights transitively. Also re-denominate `recalibrate.ts`'s magnitude band
  constants `FUNDING_FLOOR_TOKENS` (350k) / `FUNDING_CEILING_TOKENS` (700k) — they are in old
  parity units and would clamp wrongly in cost units.
- **run-log ⊥ budget zero-coupling must hold.** `run-log.ts` deliberately imports nothing from
  `src/budget/` and inlines `totalTokens`. The two spent-definitions must share the SAME weights
  without run-log importing budget (re-inline + an agreement test, or a neutral leaf) — an
  implement-time call, but the constraint is named, not hidden.
- **Price ratios confirmed.** {input 1.0, cache_read 0.1, cache_creation 1.25, output 5} is the
  standard current Claude ratio (base input $x → cache read 0.1x, 5-min cache write 1.25x,
  output 5x). The epic's starting weights are correct; the confirm is a comment-cite, not a spike.
- **Slice 2 needs a wiring change too.** `cast.ts:236-244` only runs gates when
  `budgetOutcome.status === "ok"`, so an overshooting run never reaches gating today. Warn-not-
  discard requires running gates on token-overshoot (only a timeout skips), then classify
  materializes on gates-clear. Wall-clock timeout stays a HARD discard (a token wall can't
  un-spend; a clock wall is a real runaway guard). An over-envelope run becomes outcome=success
  + a warning marker — so it enters recalibrate's SUCCESS percentile as an honest finishing-cost
  observation (previously censored), which HELPS convergence; no censoring change needed.
- **Slice 3 = detection, not rollback.** doctor flags an epic with zero stories/tickets (the safe,
  local, non-destructive path). The destructive alternative (chain rolls back / deletes the
  half-minted card) is deferred. Kept in-epic as the separable third story, ordered last.
