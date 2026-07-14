# T-048-02 — Structure: file-level changes & interfaces

The blueprint. Shapes, signatures, boundaries — not code. Grounded in `design.md`.

## Files touched

| File | Change | Why |
|------|--------|-----|
| `src/engine/graph-core.ts` | **MODIFY** — move `runGraphConcurrent` here, budget-aware; extend `GraphResult`; rewrite header | the pure, importable home for both graph executors |
| `src/engine/graph.ts` | **MODIFY** — delete moved fn; add optional `wallet` param; build `priceOf`; call moved dispatcher | shrink to a thin shell; opt-in shared wallet |
| `src/engine/graph-example.ts` | **MODIFY** — add a budgeted fan-out fixture + runner (stub `actuals`) | the deterministic worked-example source |
| `src/engine/graph-example.test.ts` | **MODIFY** — add AC#3 shared-vs-per-node describe block | prove the budget arithmetic deterministically |

No deletions of files. No new files (Q1/Option-B/C: graph-core.ts is the home). `src/engine/spend.ts`,
`src/budget/wallet.ts`, `src/engine/spend-core.ts` are **NOT** touched (T-048-01 already shipped the
algebra; spendDown is out of scope).

## `src/engine/graph-core.ts`

### Header rewrite

Own both executors honestly: the sequential reference `runGraph` (correctness) AND the concurrent
budgeted twin `runGraphConcurrent` (the wave dispatcher), both **pure given injected casts** — the
SPAWNING is the impure shell's (`castGraph`) job, the dispatching/threading logic is pure. Note the
new pure value-imports and that purity is preserved.

### New imports (all pure)

```
import { authorizeWave } from "./spend-core.ts";
import { debitWave, type Wallet } from "../budget/wallet.ts";
import { countTokens, type Budget } from "../budget/budget.ts";
```

### `GraphResult` — one additive field

```
export interface GraphResult {
  // …existing fields unchanged…
  /** The shared wallet's remaining balance at the run's end — the budget readout (E-048).
   *  Present only when a wallet was threaded through the concurrent dispatcher; undefined on the
   *  sequential runGraph path and the legacy (no-wallet) concurrent path. */
  readonly walletRemaining?: Budget;
}
```

### Moved + budget-aware `runGraphConcurrent`

```
export interface ConcurrentBudget {
  readonly wallet: Wallet;
  readonly priceOf: (id: NodeId) => Budget;   // predicted per-node envelope (PlayNode.budget)
}

export async function runGraphConcurrent(
  spec: DagSpec,
  budget?: ConcurrentBudget,
): Promise<GraphResult>
```

- **EXPORTED** (was private) so `bun test` and `castGraph` can both call it.
- `budget` **absent** ⇒ legacy: `dispatch = toRun`, no authorize, no debit, `walletRemaining`
  undefined — byte-for-byte today's behavior.
- `budget` **present** ⇒ per-wave authorize/debit (the wave-loop shape from design.md).

Internal additions to the wave loop (between `toRun` and `Promise.all`):

1. `const { dispatch, stopped } = budget ? authorizeWave(budget.wallet?…) : { dispatch: toRun, stopped: [] }`
   — but `authorizeWave` takes the *live* wallet, so the wallet is a `let` updated each wave.
2. budget-stop bookkeeping for each `stopped` id: push `SkippedNode` (reason
   `budget-stopped — …`), `haltReasonOf.set(id, "budget-stopped: …")`, `decided.add`, `remaining.delete`.
3. `Promise.all` over `dispatch` (renamed from `toRun`).
4. after settle: if budget, fold dispatched actuals → `wallet = debitWave(wallet, deltas).wallet`.
5. return includes `...(budget ? { walletRemaining: wallet.remaining } : {})`.

Helper (module-local, pure):
```
function actualsDelta(s: RunSummary): Budget   // { tokens: countTokens(s.actuals.usage), timeMs: s.actuals.wallMs } ; {0,0} if no actuals
```

`toRun` → `dispatch` is the only rename rippling into the existing `Promise.all` block.

## `src/engine/graph.ts`

### Remove

`runGraphConcurrent` (the whole private function, now in graph-core.ts). The
`export * from "./graph-core.ts"` already re-exports the moved (now exported) function + the extended
`GraphResult`, so no new export plumbing.

### Imports

Add `type Wallet` (budget/wallet.ts) and pull `runGraphConcurrent` — it arrives via the existing
`export *`/`import` of the pure surface; add an explicit named import from `./graph-core.ts`.

### `castGraph` signature

```
export async function castGraph(
  nodes: readonly PlayNode<any, any>[],
  edges: readonly DagEdge[],
  wallet?: Wallet,                       // NEW — opt-in shared envelope (E-048)
): Promise<GraphResult>
```

Body:
- build `dagNodes` as today;
- if `wallet`: build `const budgetById = new Map(nodes.map(n => [n.id, n.budget]))` and
  `priceOf = (id) => budgetById.get(id) ?? ZERO` (ZERO = `{tokens:0,timeMs:0}` — a missing id is
  unreachable since dispatched ids ⊆ nodes, but stays total);
- `return runGraphConcurrent({ nodes: dagNodes, edges }, wallet ? { wallet, priceOf } : undefined)`.

Doc note: a node's `budget` is now BOTH the per-cast envelope handed to `castPlay` AND its predicted
price for wave authorization when a shared wallet is threaded — IA-8 honest (the price is the measured
envelope, untouched).

## `src/play/graph-real-play.ts`

**Unchanged.** `castRealPlayGraph` keeps calling `castGraph(nodes, edges)` (no wallet ⇒ legacy path).
Confirms back-compat AC. (A budgeted live re-cast is an explicit downstream pull, out of scope.)

## `src/engine/graph-example.ts`

Add, beside the diamond:

```
/** A budgeted fan-out fixture A → {B, C}: stub costs whose B+C combined exceed a small envelope. */
export function budgetedFanoutExample(): {
  spec: DagSpec;
  wallet: Wallet;            // allocate(macro) — small shared envelope
  priceOf: (id: NodeId) => Budget;
}

/** Run it through the pure budgeted dispatcher under the SHARED wallet. */
export async function runSharedWalletFanout(): Promise<GraphResult>   // runGraphConcurrent(spec, {wallet, priceOf})

/** Run the SAME fan-out with NO wallet (legacy per-node), summing would-be actuals → the overspend. */
export async function runPerNodeFanout(): Promise<{ result: GraphResult; totalSpent: Budget }>
```

Stub nodes carry `actuals` (so `debitWave` folds real deltas): extend the `summary` helper or add a
`costedStub(id, produced, actuals)`. Imports stay pure: `runGraphConcurrent`, `allocate`, types — NO
`castPlay`.

### Numbers (illustrative, fixed in plan.md)

Envelope after A: tokens ~50k, time ~30k. B price {tokens 40k, time 20k}, C price {tokens 40k, time
20k}. Shared: A debits, then `{B,C}`: B fits (cum 40k ≤ 50k), C stopped (40k+40k=80k > 50k) →
dispatch [B], stopped [C]. Per-node: both dispatch, summed tokens 80k > 50k envelope → overspend.

## `src/engine/graph-example.test.ts`

Add `describe("AC#3: shared wallet stops a fan-out the per-node budgets would overspend")`:
- shared: `result.skipped` contains C with a `budget-stopped` reason; B in `result.nodes`;
  `result.halted === true`; `result.outcome === "success"` (clean refusal);
  `funded − result.walletRemaining` == bounded envelope (tokens summed, time max).
- per-node: both B and C in `result.nodes`; `totalSpent.tokens` > envelope tokens (the overspend the
  shared wallet prevents).
- side-by-side assertion mirroring the existing fails-vs-linear contrast.

Header note updated: imports the pure budgeted dispatcher; still no native addon, spawns nothing.

## Ordering of changes (see plan.md)

graph-core.ts (move+extend) → graph.ts (shrink+wire) → typecheck green → example fixture → test →
full `bun run check`.
