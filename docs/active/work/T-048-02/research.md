# T-048-02 — Research: thread ONE shared wallet through castGraph's wave dispatcher

Descriptive map of the code this ticket touches. No solutions here — that is `design.md`.

## The ticket in one line

T-048-01 shipped the **pure** wave-budget algebra (`authorizeWave`, `debitWave`). This ticket wires
that algebra into the **impure** concurrent wave dispatcher so a fan-out's parallel branches draw from
**one shared wallet** with a correct hard stop at the wave boundary (P7 under concurrency). Plus a
**deterministic worked example** (stub nodes, no live cast) proving the shared wallet stops where the
old per-node budgets would have overspent.

## The seam: `castGraph` and its private dispatcher (`src/engine/graph.ts`)

`castGraph(nodes, edges)` (graph.ts:89) is the impure shell over the typed DAG. It:

1. maps each `PlayNode<any, any>` → a `DagNode` whose `cast` injects `adapt → castPlay` (graph.ts:95-102);
2. delegates to the private `runGraphConcurrent(spec)` (graph.ts:104).

`runGraphConcurrent(spec)` (graph.ts:115-246) is the **concurrent twin** of the pure sequential
`runGraph`. Its WAVE LOOP (graph.ts:163-215):

- **`wave`** = every remaining node whose in-edge upstreams are all `decided` (graph.ts:164-166);
- **SKIP** (`toSkip`, graph.ts:172-182): a wave node with any non-`proceeded` upstream is halted —
  recorded in `skipped`, `decided`, removed from `remaining`; its downstream cascades in later waves;
- **RUN** (`toRun`, graph.ts:186-199): the runnable subset is dispatched **concurrently** via
  `Promise.all`, each gathering its JOIN map and awaiting its injected cast;
- **SETTLE** (graph.ts:202-214): record each summary, run `decideThread` (the reused per-edge halt
  gate), and on proceed add to `proceeded` + `producedAll`; else record `haltReasonOf`.

After the loop, a **deterministic assembly in topo order** (graph.ts:217-245) computes `firstFail`,
the sink `produced` map, sorts `skipped` to topo order, and returns the `GraphResult`.

**Key fact:** `runGraphConcurrent` is **pure given its injected casts** — it spawns nothing itself; it
only `Promise.all`s over `DagNode.cast` thunks. The ONLY thing that makes `graph.ts` impure (and
unimportable by `bun test`) is `castGraph`'s **value-import of `castPlay`** (graph.ts:31). The
dispatcher's placement in graph.ts is a narrative choice ("concurrency is the shell's job"), not a
purity necessity.

`PlayNode<I,O>` (graph.ts:68-74) carries `id`, `play`, **`budget: Budget`** (the per-node predicted
envelope), `opts`, `adapt`. That `budget` is the natural **`priceOf`** source for `authorizeWave`.

## The pure algebra already shipped (T-048-01)

### `authorizeWave` (`src/engine/spend-core.ts:132-157`)

Generalizes `fitNext` from one candidate to a whole ready-set against one shared wallet. Returns
`WaveAuthorization<C> { dispatch, stopped }` (spend-core.ts:109-112), preserving input order. The two
IA-8 denominations DIVERGE:

- **wall-clock (MAX / EACH-fits):** each node's predicted `timeMs` must fit the FULL remaining time —
  no cumulative time (parallel branches overlap);
- **tokens (SUM / cumulative):** running cumulative tokens (incl. this node) must fit remaining tokens.

Implemented via a per-node **virtual wallet** whose remaining tokens are depleted by
`cumulativeTokens` (time left whole), reusing `canAfford`'s single `<=` + safe-refuse rule
(spend-core.ts:145-154). A non-fitting node goes to `stopped` and the walk **continues** (a smaller
later node may still fit — `fitNext` skip-the-head behavior). Unit-tested: spend-core.test.ts:62-137
(all-fit, token-stop cumulative, time-stop each-fits, continue-after-stop, none-fit, empty, exact-fit
`<=`, given-order-not-resorted).

### `debitWave` (`src/budget/wallet.ts:159-168`)

Folds a settled wave's actuals into the one wallet: **tokens SUMMED**, **wall-clock MAX**, then debits
the combined delta through the single `debit` path (so floor + overshoot computed ONCE). A
single-element wave equals `debit` (back-compat); empty wave is a no-op. Unit-tested:
wallet.test.ts:170-234.

### `canAfford` / `debit` / `allocate` / `Wallet` (`src/budget/wallet.ts`)

- `Wallet { funded, remaining }` (wallet.ts:43-48), both `Budget`, `remaining` floors at 0.
- `allocate(macro: Budget): Wallet` (wallet.ts:104-108) — funds once; guards each dim positive int.
- `canAfford(wallet, predicted)` (wallet.ts:117-122) — fits iff BOTH tokens & timeMs `<=` remaining.
- `debit(wallet, actual): DebitResult { wallet, overshoot }` (wallet.ts:130-146).

## What a settled cast surfaces — the actuals for `debitWave`

`RunSummary` (cast.ts:101-120) carries optional **`actuals?: CastActuals`** where
`CastActuals { usage: Usage; wallMs: number }` (cast.ts:95-97). `castPlay` ALWAYS populates `actuals`
(cast.ts:317) — even a timed-out run gets `{ usage: {}, wallMs }` (cast.ts:176). So in the concurrent
dispatcher each dispatched node's debit delta is `{ tokens: countTokens(s.actuals.usage), timeMs:
s.actuals.wallMs }`. A hand-built stub `RunSummary` (graph-core.test.ts shape) omits `actuals` →
contributes `{0,0}` (no ledger fallback in a pure core; the ledger fallback is spend.ts's impure job).

## The sequential reference — `runGraph` (`src/engine/graph-core.ts:85-189`)

The pure topo-order executor `runGraphConcurrent` mirrors. Owns `GraphResult` (graph-core.ts:61-68)
and `SkippedNode` (graph-core.ts:37-44). `graph.ts` re-exports the whole pure surface via
`export * from "./graph-core.ts"` (graph.ts:46) — so anything added to graph-core.ts is visible
through graph.ts with no new import for `castGraph`. graph-core.ts is **pure** (only type imports +
pure `decideThread`/`topoSort`); `bun test` imports it freely (graph-example.test.ts:4).

## The worked-example discipline (`src/engine/graph-example.ts` + `.test.ts`)

The established deterministic pattern (T-046-03): stub `DagNode`s returning canned `RunSummary`s
(graph-example.ts:22-40), driving the **pure** `runGraph` — imported from `./graph-core.ts`, **NEVER**
`./graph.ts`. The test (graph-example.test.ts) imports only pure cores + the stub module, so it loads
no native addon and spawns nothing. AC#3 there already does a **fails-vs-linear** contrast (runGraph
converges a join; runChain cannot) — the exact rhetorical shape this ticket's
**shared-vs-per-node** contrast will follow.

## The single live caller (back-compat constraint)

`src/play/graph-real-play.ts:166-168` — `castRealPlayGraph` calls `castGraph(nodes, edges)` (the E-047
live diamond: survey → {propose×2 concurrent} → capture-note). **This is the only `castGraph` call
site in `src/`.** Any signature change MUST keep `castGraph(nodes, edges)` working unchanged.

`spendDown` (`src/engine/spend.ts`) — the linear `vend work` macro loop — is a **separate module**,
already threads one wallet sequentially (spend.ts:61-112), and is **not touched** by this ticket.

## Constraints & assumptions

- **Back-compat:** `castGraph(nodes, edges)` must still compile and behave as today (no shared wallet
  ⇒ legacy: every runnable node dispatched). The shared wallet is **additive/optional**.
- **Testability:** the deterministic worked example must exercise the **real** budgeted dispatcher
  without spawning ⇒ the dispatcher (or its budget decision) must be importable from a pure module.
- **Purity:** the budgeted dispatcher uses predicted `priceOf` (node.budget) for AUTHORIZE and settled
  `summary.actuals` for DEBIT — no ledger read (that is spend.ts's impure concern).
- **Determinism:** authorize walks `toRun` in topo order (`authorizeWave` preserves input order);
  result assembled in topo order — same spec + same casts ⇒ same `GraphResult`.
- **IA-8:** the two denominations never conflate — tokens SUM, wall-clock MAX, both in the dispatcher.
- **IA-9:** a budget stop is a **clean refusal** (success-but-halted), not a failure outcome.

## Open questions for Design

1. Where does the budgeted concurrent dispatcher live so it is testable (move to a pure module vs.
   keep in graph.ts and test via a parallel path)?
2. How is the shared wallet passed — `Wallet`, `Budget` macro, or optional?
3. How are budget-stopped nodes represented in `GraphResult` (reuse `skipped` + reason, add a wallet
   readout field)?
4. Does the run "stop entirely" on first budget stop, or authorize each wave against the live wallet
   (independent affordable work still proceeds)?
