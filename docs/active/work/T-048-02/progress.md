# T-048-02 — Progress

## Status: implementation complete, gate green

All plan steps executed. `bun run check` → **1150 pass, 0 fail**. No deviations from the plan.

## Steps

- [x] **Step 1 — graph-core.ts: move + budget-arm the dispatcher.**
  - Rewrote the header to own BOTH executors (sequential `runGraph` + concurrent budgeted
    `runGraphConcurrent`), both pure-given-injected-casts; the SPAWNING (not the dispatching) is the
    shell's job.
  - Added pure imports: `authorizeWave` (spend-core), `debitWave`/`Wallet` (wallet), `countTokens`/
    `Budget` (budget). No import cycle (those are leaf pure modules).
  - Added `walletRemaining?: Budget` to `GraphResult` (additive; undefined on legacy/sequential paths).
  - Added `ConcurrentBudget` interface + `actualsDelta` helper.
  - Moved `runGraphConcurrent` from graph.ts, **exported** it, added `budget?: ConcurrentBudget`:
    per-wave `authorizeWave` → budget-stop bookkeeping → `Promise.all` over `dispatch` → `debitWave`
    fold of the live wallet.

- [x] **Step 2 — graph.ts: shrink + wire.**
  - Deleted the now-moved private `runGraphConcurrent` (graph.ts 262 → 121 lines).
  - Imports `runGraphConcurrent` + `GraphResult` from graph-core.ts; added `type Wallet`.
  - `castGraph(nodes, edges, wallet?)`: legacy when `wallet` absent; builds `budgetById`/`priceOf` from
    each `PlayNode.budget` and threads `{ wallet, priceOf }` when present.
  - Updated the module + function docs for the shared-wallet path and the dispatcher's new home.

- [x] **Step 3 — graph-example.ts: deterministic worked example.**
  - Added `costedStub` (stub `RunSummary` carrying `actuals`), `budgetedFanoutExample` (A → {B,C}),
    `runSharedWalletFanout`, `runPerNodeFanout`. Imports stay pure (no `castPlay`).

- [x] **Step 4 — graph-example.test.ts: AC#3 tests.**
  - New describe block: shared wallet stops C at the wave boundary (`walletRemaining` 10k/10k, spent
    80k/50k ≤ envelope, clean success-but-halted); per-node legacy dispatches both and overspends
    (120k > 90k); side-by-side contrast. 7/7 in the file pass.

- [x] **Step 5 — full gate.** `bun run check` green (1150 pass). Back-compat confirmed: `spend.ts`,
  `wallet.ts`, `spend-core.ts`, `graph-real-play.ts` all **unmodified** (AC#2 / vend work untouched;
  the E-047 live cast's `castGraph(nodes, edges)` call is unchanged).

## Files changed

- `src/engine/graph-core.ts` — moved + budget-armed dispatcher; `GraphResult.walletRemaining`.
- `src/engine/graph.ts` — thin shell; optional `wallet` param; −141 lines net of the move.
- `src/engine/graph-example.ts` — budgeted fan-out worked example.
- `src/engine/graph-example.test.ts` — AC#3 shared-vs-per-node proof.

## Deviations

None. The design's Option B (move the dispatcher to the pure core for testability) and per-wave
authorization model held without adjustment.
