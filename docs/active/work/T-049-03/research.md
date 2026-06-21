# T-049-03 — Research

**Ticket:** branching-worked-example-through-castgraph (S-049-01, E-049 conditional-dag-edges)
**Goal of this phase:** map what exists so the branching worked example extends the established
deterministic-stub discipline rather than inventing a new one. Descriptive only — no solution here.

## The feature is already built; this ticket is the author-facing PROOF

E-049 ships conditional DAG edges in three tickets. The first two built the mechanism; this one proves
it end-to-end as a playbook author would experience it:

- **T-049-01** (`runGraph`, sequential reference): added `EdgePredicate` + optional `when?` to
  `DagEdge`, and made the sequential executor fire an in-edge iff its upstream proceeded AND its `when`
  predicate holds. A not-taken edge yields an observable `skipped` entry with a distinct andon.
- **T-049-02** (`runGraphConcurrent`, the wave dispatcher): ported the identical three-state in-edge
  classification so the concurrent twin returns a `GraphResult` byte-for-byte equal to `runGraph`'s for
  the same predicated spec. The reason strings are the cross-executor contract.
- **T-049-03 (this ticket):** prove the authored predicate threads end-to-end through the impure
  `castGraph` shell, with a deterministic stub-node branching example — confirming the author declares
  the branch ONCE on the edge and the not-taken subgraph is an observable skip.

## The data model (`src/engine/dag-core.ts`)

- `EdgePredicate = (produced: string) => boolean` (dag-core.ts:63) — a PURE read over an upstream
  node's `produced` string. Declared in the model in T-049-01.
- `DagEdge` (dag-core.ts:68) is `{ from, to, when? }`. `when` absent ⇒ the edge ALWAYS fires (pre-E-049
  unconditional fan-out). `when` present ⇒ the edge fires only if `when(produced)` is `true`; otherwise
  the edge does not fire and `to`'s dependent subgraph cascade-skips as a branch-not-taken.
- `validateDag`/`topoSort` do NOT consult `when` (dag-core.ts:76) — the structural dependency `from→to`
  holds regardless of which branch is selected at run time. So a predicated spec is structurally valid
  exactly when the same spec without predicates is.

## The two pure executors (`src/engine/graph-core.ts`)

Both executors live here and share one classification of each in-edge. A node casts iff EVERY in-edge
fires; an un-fired in-edge is one of two kinds, kept apart so each is its own andon:

- **halted** — upstream did not proceed (failed / produced nothing / was itself skipped). Reason:
  `skipped — dependent on halted upstream '<id>' (…)`.
- **not-taken** — upstream proceeded but this edge's `when` rejected its `produced`. Reason:
  `skipped — branch not taken: upstream '<id>' produced a result this edge's predicate rejected`.

Halt takes precedence when both are present on one node. A skipped node never enters `proceeded`, so its
downstream closure cascade-skips through the SAME halt machinery — the "reuse, don't reinvent" spine.

- `runGraph` (graph-core.ts:109) — sequential reference: classifies in `for…of` topo order
  (graph-core.ts:165-196).
- `runGraphConcurrent` (graph-core.ts:291) — wave dispatcher: the same classification, memoized in a
  `classified` map and applied as a `wave.filter` before `authorizeWave` (graph-core.ts:362-401). A
  wave node is formed only once every upstream is `decided`, so `proceeded`/`producedAll` are final for
  each in-edge — the same settled state `runGraph` reads in topo order.

`GraphResult` (graph-core.ts:80) surfaces `nodes` (cast summaries by id), `skipped` (each with
`id`/`blockedBy`/`reason`), `outcome`, `halted`, `produced` (sink refs), optional `walletRemaining`.

## The impure shell (`src/engine/graph.ts`) — what the predicate threads "through"

`castGraph(nodes, edges, wallet?)` (graph.ts:98) is the impure verb. For each `PlayNode` it injects
`adapt → castPlay` into a `DagNode.cast`, then delegates the dispatch:

```
if (wallet === undefined) return runGraphConcurrent({ nodes: dagNodes, edges });
… else build priceOf and return runGraphConcurrent({ nodes: dagNodes, edges }, { wallet, priceOf });
```

**Critical for this ticket:** `castGraph` passes `edges` (the caller's `DagEdge[]`, INCLUDING every
`when`) straight to `runGraphConcurrent` untouched. It is *predicate-transparent* — it neither reads nor
rewrites `when`. So the predicate threading a playbook author declares on an edge is delivered ENTIRELY
by `runGraphConcurrent`. (Confirmed by the T-049-02 review and by reading graph.ts:114,120.)

## The test/import discipline (non-negotiable, the ticket's own AC)

`graph.ts` value-imports `castPlay` (cast.ts), which value-imports the executor seam (a native addon).
Therefore **no `bun test` may value-import `graph.ts`** — importing it would load the addon and risk a
spawn. This is the "chain.ts discipline," stated in graph.ts:34 and graph-example.ts:7.

Consequence: the worked example CANNOT call `castGraph` directly. It proves the predicate through the
pure dispatcher `castGraph` delegates to (`runGraphConcurrent`), driven with deterministic stub
`DagNode`s. This is not a workaround — it is exactly how the E-048 shared-wallet feature (which lives in
`castGraph`) is already proven: `runSharedWalletFanout` drives `runGraphConcurrent` with costed stubs.

## The worked-example pattern to extend (`src/engine/graph-example.ts`)

The module hosts THREE deterministic examples, all importing ONLY the pure cores (graph-core.ts) +
type-only cast.ts:

- `summary(outcome, produced?)` (graph-example.ts:24) — the canned `RunSummary` stub shape.
- `recordingStub(id, produced)` (graph-example.ts:30) — a `DagNode` that RECORDS the `NodeUpstreams` it
  was cast with (so a test can assert which nodes ran and what they saw) and returns a canned success
  carrying `produced`. Used by `diamondExample`.
- `diamondExample()` / `runDiamondExample()` (graph-example.ts:46,73) — fan-out + join, driven through
  `runGraph`. Surfaces `seen[id]` (live upstream records) and the `GraphResult`.
- `costedStub` / `budgetedFanoutExample` / `runSharedWalletFanout` / `runPerNodeFanout`
  (graph-example.ts:95-162) — the E-048 shared-wallet proof, driven through `runGraphConcurrent`.

The tests (`graph-example.test.ts`) import `runDiamondExample`, `runSharedWalletFanout`,
`runPerNodeFanout` from graph-example.ts and the pure `runGraph`/`runChain` — never graph.ts.

## Constraints & assumptions carried into Design

1. The example must import only the pure cores; the test must not value-import graph.ts (the AC).
2. `recordingStub` is the right primitive: it records the upstreams each node saw, which is exactly how
   we prove "the taken branch ran with R's produced" and "the not-taken branch never cast."
3. `runGraphConcurrent` is the dispatcher to drive — it is what `castGraph` delegates to, so proving the
   predicate there proves the end-to-end author path (the shared-wallet precedent).
4. The reason strings (`branch not taken` vs `dependent on halted upstream`) are the established
   contract from T-049-01/02; the example asserts against them, not against new strings.
5. Determinism: stub nodes return canned summaries, no clock/random; `topoSort`'s declaration-order
   tie-break makes the `GraphResult` byte-identical run to run.
