# T-048-02 — Plan: ordered, verifiable steps

Each step is independently checkable; commits are atomic. Testing strategy below.

## Step 1 — Move + budget-arm the dispatcher in `graph-core.ts`

1. Rewrite the graph-core.ts header to own BOTH executors (sequential `runGraph` + concurrent
   budgeted `runGraphConcurrent`), both pure-given-injected-casts; note the new pure value-imports and
   that the SPAWNING (not the dispatching) is the shell's job.
2. Add pure imports: `authorizeWave` (spend-core.ts), `debitWave` + `type Wallet` (wallet.ts),
   `countTokens` + `type Budget` (budget.ts).
3. Add `walletRemaining?: Budget` to `GraphResult` (additive, documented).
4. Add `export interface ConcurrentBudget { wallet: Wallet; priceOf: (id: NodeId) => Budget }`.
5. Paste `runGraphConcurrent` from graph.ts, **export** it, add `budget?: ConcurrentBudget` param, and:
   - make `wallet` a `let` initialized from `budget?.wallet`;
   - in the wave loop, after `toRun`: `const { dispatch, stopped } = budget ? authorizeWave(wallet,
     toRun, budget.priceOf) : { dispatch: toRun, stopped: [] };`
   - budget-stop each `stopped` id (push `SkippedNode` reason `budget-stopped — price …, remaining …`,
     `haltReasonOf.set`, `decided.add`, `remaining.delete`);
   - rename the run target `toRun` → `dispatch` in the `Promise.all`;
   - after settle: `if (budget) wallet = debitWave(wallet, dispatch.map(deltaOf)).wallet;` where
     `deltaOf(id)` reads `summaries.get(id)?.actuals` → `{tokens: countTokens(usage), timeMs: wallMs}`
     (`{0,0}` if absent);
   - add `...(budget ? { walletRemaining: wallet.remaining } : {})` to the returned object.
6. Add module-local pure helper `actualsDelta(s: RunSummary): Budget`.

**Verify:** `bun run check:typecheck` (graph-core.ts compiles; no import cycle — spend-core.ts &
wallet.ts are pure and do not import graph-core.ts).

## Step 2 — Shrink + wire `graph.ts`

1. Delete the now-moved `runGraphConcurrent`.
2. Import `runGraphConcurrent` + `type ConcurrentBudget` from `./graph-core.ts`; import `type Wallet`
   from `../budget/wallet.ts`; keep `type Budget`.
3. Add `wallet?: Wallet` param to `castGraph`; build `budgetById`/`priceOf` only when `wallet` set;
   call `runGraphConcurrent({nodes: dagNodes, edges}, wallet ? { wallet, priceOf } : undefined)`.
4. Update `castGraph` doc: the shared wallet is opt-in; node `budget` doubles as wave price.

**Verify:** `bun run check:typecheck`; confirm `graph-real-play.ts` still compiles unchanged
(`castGraph(nodes, edges)` — wallet defaults undefined → legacy path).

## Step 3 — Deterministic worked-example fixture in `graph-example.ts`

1. Add `costedStub(id, produced, actuals)` (or extend `summary`) so stub `RunSummary`s carry
   `actuals: { usage, wallMs }`.
2. Add `budgetedFanoutExample()` returning `{ spec, wallet, priceOf }` for `A → {B, C}` with the
   numbers below.
3. Add `runSharedWalletFanout()` → `runGraphConcurrent(spec, { wallet, priceOf })`.
4. Add `runPerNodeFanout()` → `runGraphConcurrent(spec)` (legacy) + sum dispatched actuals into
   `totalSpent`.
5. Imports stay pure (`runGraphConcurrent`, `allocate`, types) — NO `castPlay`.

**Fixed numbers:**
- envelope `allocate({ tokens: 90_000, timeMs: 60_000 })`.
- A price `{ tokens: 40_000, timeMs: 30_000 }`, A actuals same.
- B price/actuals `{ tokens: 40_000, timeMs: 20_000 }`; C price/actuals `{ tokens: 40_000, timeMs: 20_000 }`.
- Shared: A debits → remaining `{ tokens: 50_000, timeMs: 30_000 }`. Wave `{B,C}`: B cum 40k ≤ 50k
  (time 20k ≤ 30k) → dispatch; C cum 80k > 50k → **stopped**. After B debit → remaining
  `{ tokens: 10_000, timeMs: 10_000 }`. Total spent `funded − remaining = { tokens: 80_000, timeMs:
  50_000 }` ≤ envelope `{90_000, 60_000}` — bounded; tokens summed (40k+40k), time max (30k then 20k).
- Per-node (no wallet): A,B,C all dispatch → `totalSpent.tokens = 120_000` > 90_000 envelope —
  the overspend the shared wallet prevents.

**Verify:** `bun run check:typecheck`.

## Step 4 — Tests for the worked example in `graph-example.test.ts`

`describe("AC#3 (E-048): shared wallet stops a fan-out the per-node budgets would overspend")`:

1. **shared stops at the wall:** run `runSharedWalletFanout()`:
   - `result.nodes` has A, B (cast); NOT C.
   - `result.skipped` has C with reason matching `/budget-stopped/`.
   - `result.halted === true`; `result.outcome === "success"` (clean refusal, IA-9).
   - `result.walletRemaining` deep-equals `{ tokens: 10_000, timeMs: 10_000 }`.
   - derived total spent `funded − walletRemaining === { tokens: 80_000, timeMs: 50_000 }` and
     `≤ funded` on BOTH denominations (bounded envelope; tokens SUM, time MAX).
2. **per-node would overspend:** run `runPerNodeFanout()`:
   - A, B, C all in `result.nodes`; `result.skipped` empty.
   - `totalSpent.tokens === 120_000` and `> 90_000` (the envelope tokens) — overspends.
   - `result.walletRemaining === undefined` (legacy path sets no readout).
3. **side-by-side:** assert shared total tokens (80k) `<` per-node total tokens (120k), and shared
   total `≤` envelope while per-node `>` envelope — the explicit shared-vs-per-node contrast (the
   fails-vs-linear rhetorical shape, AC#3).
4. **single-node-wave back-compat (AC#2):** a tiny LINEAR `A → B` budgeted graph dispatches both when
   affordable and the per-wave debit equals two sequential `debit`s — confirming a linear graph =
   single-node waves (links to T-048-01's `authorizeWave`/`debitWave` single-node equivalence).

Update the test-file header: it now also imports the pure budgeted dispatcher; still loads no native
addon, spawns nothing.

**Verify:** `bun test src/engine/graph-example.test.ts` green.

## Step 5 — Full gate + commit

1. `bun run check` (baml:gen + typecheck + full `bun test`) — AC#4.
2. Sanity: grep that `spend.ts`, `wallet.ts`, `spend-core.ts` are unmodified (AC#2 — vend work
   untouched) and `graph-real-play.ts` is unmodified (back-compat).
3. Commit: `feat(engine): thread one shared wallet through castGraph's wave dispatcher (T-048-02)`.

## Testing strategy

- **Unit / deterministic (this ticket's proof):** graph-example.test.ts drives the **real** pure
  budgeted dispatcher with stub casts — no spawn, no model. Covers: shared-wallet hard stop at the
  wave boundary, bounded-envelope debit (tokens SUM / time MAX), the per-node overspend contrast, and
  single-node-wave back-compat.
- **Already covered upstream (T-048-01):** `authorizeWave` partition logic and `debitWave` fold
  arithmetic — not re-proven here; this ticket proves their **integration** in the dispatcher.
- **Live:** out of scope (the ticket says no live model; a budgeted live re-cast is a downstream pull).
- **Back-compat:** typecheck + unchanged `graph-real-play.ts` + the legacy no-wallet path assertions.

## Risks & mitigations

- **Import cycle** graph-core ↔ spend-core/wallet: none — spend-core.ts and wallet.ts are leaf pure
  modules importing only budget.ts; they do not import graph-core.ts. Verified at Step 1 typecheck.
- **Narrative coherence:** graph-core.ts header rewrite owns the concurrent twin; reviewed in Step 1.
- **Stub actuals omitted:** without `actuals` the debit folds `{0,0}` and the example would falsely
  pass; mitigated by `costedStub` carrying explicit actuals and asserting exact `walletRemaining`.
