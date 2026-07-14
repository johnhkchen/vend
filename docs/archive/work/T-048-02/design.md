# T-048-02 — Design: thread ONE shared wallet through castGraph's wave dispatcher

Decisions, with rationale, grounded in `research.md`. Four questions to settle.

## Q1 — Where does the budgeted concurrent dispatcher live? (testability)

The deterministic worked example (AC#3) must drive the **real** budgeted dispatcher with stub casts
**without spawning**. Today the dispatcher (`runGraphConcurrent`) lives in `graph.ts`, which is
unimportable by `bun test` because `castGraph` value-imports `castPlay`.

- **Option A — keep dispatcher in graph.ts; re-prove the arithmetic in graph-example via raw
  `authorizeWave`+`debitWave`.** Rejected: re-tests the pure primitives (already covered by T-048-01),
  does NOT test the integration the ticket asks for ("threads ONE shared wallet THROUGH castGraph's
  wave dispatcher"). Divergence risk: the example could pass while the dispatcher is miswired.

- **Option B — move the budgeted concurrent dispatcher into the pure core (`graph-core.ts`); make
  `castGraph` a thin shell that builds the price map and calls it.** **CHOSEN.** `runGraphConcurrent`
  is already *pure given its injected casts* (research.md) — it `Promise.all`s over `DagNode.cast`
  thunks and spawns nothing. graph-core.ts is already the pure graph surface that graph.ts re-exports
  wholesale (`export * from "./graph-core.ts"`), so `castGraph`'s call keeps working with no new
  import, and `bun test` can import the dispatcher directly (exactly as it imports `runGraph`). The
  only edits to graph.ts shrink it: delete the moved function, build `priceOf`, pass the wallet.

- **Option C — new module `src/engine/graph-budget.ts`.** Rejected: a third graph module for one
  function fragments the narrative; graph-core.ts is the established home for the pure graph executors
  (`runGraph` lives there) and `GraphResult`/`SkippedNode`.

**Consequence (narrative):** graph-core.ts's header says "real concurrency is the impure shell's job;
this core awaits per node in topo order." That softens to: *the SPAWNING is the shell's job; the
dispatching logic (sequential reference `runGraph` AND its concurrent budgeted twin
`runGraphConcurrent`) is pure-given-injected-casts.* The concurrent twin uses `Promise.all` over
injected thunks — still no fs/clock/network/process/seam. I will rewrite the header to own both
executors honestly. graph-core.ts gains **pure value-imports** of `authorizeWave` (spend-core.ts) and
`debitWave`/`allocate`/`Wallet` (wallet.ts) and `countTokens` (budget.ts) — all pure modules; purity
preserved.

## Q2 — How is the shared wallet passed?

- **Required `Wallet` param.** Rejected: breaks the sole live caller `castGraph(nodes, edges)`
  (graph-real-play.ts) and the AC "single-chain path unchanged / vend work untouched" spirit of
  minimal disturbance.
- **Optional `wallet?: Wallet`** on `castGraph` and on `runGraphConcurrent`. **CHOSEN.** When
  **present**, the dispatcher authorizes each ready-set against it and debits after settle. When
  **absent**, the dispatcher takes the **legacy path** (every runnable node dispatched, no
  authorize/debit) — byte-for-byte today's behavior. This makes the shared wallet purely additive: the
  E-047 live cast is unchanged; a budgeted caller opts in by passing a wallet.
- A caller funds once with `allocate(macro)` (existing) and passes the `Wallet`. We do NOT make
  `castGraph` accept a raw `Budget` macro — funding is the caller's gesture (`allocate` is one line),
  and `Wallet` is the precise type the algebra consumes. (The ticket's "or a macro Budget it allocates
  once" is satisfied by the caller allocating once; no need to overload the param.)

`priceOf`: built inside `castGraph` from each `PlayNode.budget` — `priceOf(id) = budgetById.get(id)`.
The dispatcher receives `(spec, opts?: { wallet, priceOf })`. priceOf defaults to "free" only when no
wallet; when a wallet is present priceOf is always supplied by `castGraph`.

## Q3 — How are budget-stopped nodes represented in `GraphResult`?

A budget-stopped node was **not cast** but **is** a not-run node with a reason — exactly what
`SkippedNode` models. **CHOSEN:** budget stops are appended to `skipped` with a distinct reason string
(`budget-stopped — wave envelope exhausted (price …, remaining …)`), and the node is recorded in
`haltReasonOf` so its **downstream cascade** message reads `'B' (budget-stopped: …)`. It is NOT added
to `proceeded`, so its dependent subgraph cascade-skips via the existing machinery (the "runGraph halt
semantics" the ticket names).

Add ONE optional field to `GraphResult`: **`walletRemaining?: Budget`** — the live wallet at the end
(the "remaining readout" the ticket asks for, mirroring `spendDown`'s stop detail). Set only when a
wallet was threaded; `undefined` on the legacy/sequential path. The sequential `runGraph` never sets
it (no behavioral change). Total debited is derivable as `funded − walletRemaining`.

**Outcome semantics (IA-9):** a budget stop is a **clean refusal**, not a failure. It adds to
`skipped` ⇒ `halted: true` with a `haltReason` naming the budget wall, but it does NOT set a non-success
`outcome` (no failed cast occurred). This mirrors a success-but-halted `runChain`/`runGraph`. We do
NOT introduce a new terminal outcome code; `halted + haltReason` carries the wall.

## Q4 — Stop the whole run, or authorize each wave against the live wallet?

- **Global short-circuit on first budget stop.** Rejected: would strand independent affordable work in
  later waves and is less correct — a sink in a cheap independent branch should still run if it fits.
- **Per-wave authorization against the live (depleting) wallet.** **CHOSEN.** Each ready-set is
  `authorizeWave`'d against the current wallet; `dispatch` runs, `stopped` cascade-skip. `debitWave`
  depletes the wallet; the next wave authorizes against the smaller balance. The run **converges to a
  clean stop**: once nothing fits, every ready node is stopped and its subgraph skipped, so
  `remaining` empties and the loop ends. The "stop the run when no further node fits" (ticket step 3)
  is therefore **emergent**, and total spend stays bounded by `funded` (every dispatch is authorized
  against live remaining; only the IA-8 detect-after token overshoot on a settled wave can exceed, and
  `debitWave` surfaces it — identical to the sequential loop). This is the faithful generalization of
  `spendDown`'s loop to waves.

## The wave loop, with budget threading (the chosen shape)

Per wave, after `toSkip` (upstream-halt cascade) and `toRun` (runnable) are computed:

1. **AUTHORIZE** — if wallet present: `{ dispatch, stopped } = authorizeWave(wallet, toRun, priceOf)`;
   else `dispatch = toRun, stopped = []`.
2. **STOP** — for each `stopped` id: append a budget `SkippedNode`, record `haltReasonOf`, `decided`,
   remove from `remaining`. (Cascade handled by later waves' `toSkip`.)
3. **DISPATCH** — `Promise.all` over `dispatch` (the existing concurrent cast), settle as today.
4. **DEBIT** — if wallet present: gather each dispatched node's `summary.actuals` →
   `{ tokens: countTokens(usage), timeMs: wallMs }`; `wallet = debitWave(wallet, deltas).wallet`.

`authorizeWave` walks `toRun` in topo order (it preserves input order; `toRun` is `order.filter`), so
authorization is deterministic. The MAX-vs-SUM divergence lives entirely in the two pure primitives;
the dispatcher only threads them.

## Single-chain / back-compat (AC#2)

A linear graph is a sequence of **single-node waves**. With a wallet: `authorizeWave(w,[n],priceOf)`
dispatches iff `n` fits (== `fitNext` over a singleton), and `debitWave(w,[a])` == `debit(w,a)`
(proven in T-048-01 unit tests). So a linear graph under a shared wallet behaves exactly like the
sequential spend loop. `spendDown`/`vend work` is a different module and is **left untouched** —
confirmed by not editing `spend.ts`. The legacy `castGraph(nodes, edges)` path (no wallet) is
byte-identical to today.

## The deterministic worked example (AC#3)

Stub fan-out `A → {B, C}` (B and C concurrent), known stub costs whose **combined** predicted cost
**exceeds** a small shared envelope (after A's debit). Driving the pure budgeted dispatcher:

- **shared wallet:** the wave `{B,C}` is authorized → only the affordable branch dispatched, the other
  **budget-stopped** (in `skipped` with a budget reason); `walletRemaining` shows the bounded envelope;
  total debited (`funded − walletRemaining`) == the envelope (tokens summed, wall-clock max).
- **per-node contrast (legacy, no wallet):** the SAME fan-out dispatches **both** B and C (each
  "affords" its own `budget` against the pre-wave balance); summing their actuals **overspends** the
  envelope. Asserted side-by-side, the AC#3 / fails-vs-linear rhetorical shape.

Stubs carry `actuals` so `debitWave` has real deltas to fold. Test imports the dispatcher from
`graph-core.ts` (pure) — no `castPlay`, no spawn, no native addon.

## Risks

- **Narrative drift in graph-core.ts** — mitigated by rewriting the header to own both executors.
- **`GraphResult` surface growth** — one optional field, undefined on legacy paths; no caller breaks.
- **priceOf wiring** — a node missing from the price map would throw; guarded by building the map from
  the same `nodes` array the dispatcher iterates (every dispatched id has a budget).
