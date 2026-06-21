# T-046-02 — Structure: `runGraph`, the pure executor core

The blueprint for generalizing `runChain` (a linear walk) into `runGraph` (a DAG walk) over
T-046-01's typed model — **PURE given injected casts**, the `chain-core.ts` discipline.

## File-level changes

| File | Action | Why |
|------|--------|-----|
| `src/engine/dag-core.ts` | **modify** | Narrow `NodeCast` to its real upstream-collection shape; add `NodeUpstreams`. T-046-01 explicitly deferred this ("T-046-02's concern, which narrows this signature"). |
| `src/engine/graph-core.ts` | **create** | The pure executor: `runGraph` + `GraphResult` + `SkippedNode`. The DAG analog of `runChain`/`ChainResult` in `chain-core.ts`. |
| `src/engine/graph-core.test.ts` | **create** | Fakes-only proof of fan-out, join, diamond, halt-subgraph, sibling-independence, empty, cyclic-refusal. The `chain-core.test.ts` discipline (no spawn, no addon). |

No deletions. `chain-core.ts` is **unchanged** — `runGraph` *reuses* its `decideThread`.

### Why a new file (not folded into `dag-core.ts`)

The trio mirrors the chain split's intent at graph scale:

- `dag-core.ts` — the **substrate**: model (`DagNode`/`DagEdge`/`DagSpec`), `validateDag`, `topoSort` (T-046-01, shipped, 18 tests green). Shape + ordering only.
- `graph-core.ts` — the pure **run**: `runGraph` threads/joins/fans-out/halts (T-046-02, this ticket). Spawns nothing.
- `graph.ts` — the impure **shell**: `castGraph` injects `adapt → castPlay` + the diamond example (T-046-03).

Keeping `runGraph` out of `dag-core.ts` leaves the already-green substrate untouched (minus the one anticipated `NodeCast` narrowing) and keeps each file single-purpose.

## `dag-core.ts` changes (the one anticipated narrowing)

Add the cast-input type and narrow `NodeCast` from the wide placeholder to its real shape:

```ts
/** The upstream `produced` references threaded into a node's cast, KEYED BY the upstream
 *  (from-)node id. runGraph (T-046-02) builds it from the node's IN-edges: a SOURCE node gets an
 *  EMPTY map, a LINEAR node a 1-entry map, a JOIN a multi-entry map. The graph generalization of
 *  `runChain`'s single `upstream: string | undefined`. */
export type NodeUpstreams = ReadonlyMap<NodeId, string>;

/** A node's cast thunk — T-046-02 narrows it from T-046-01's wide placeholder to its real shape:
 *  it receives this node's upstreams' `produced` refs (keyed by from-node) and returns its
 *  RunSummary (which carries this node's own `produced`, the edge payload a downstream join threads).
 *  The play-specific adapter (upstreams → typed inputs → castPlay) is closed over by `cast`
 *  (T-046-03); the pure core only ever sees the `produced` STRING thread. */
export type NodeCast = (upstreams: NodeUpstreams) => Promise<RunSummary>;
```

A 0-param fake (`dag-core.test.ts`'s `neverCast`) stays assignable to a 1-param type — **the
existing T-046-01 tests need no edit.** The module's type-only `RunSummary` import is preserved.

## `graph-core.ts` public interface

```ts
import type { RunOutcome } from "../log/run-log.ts";   // terminal-outcome vocabulary (type-only)
import type { RunSummary } from "./cast.ts";           // the cast result (type-only — keeps purity)
import { decideThread } from "./chain-core.ts";        // REUSE the per-edge halt gate (pure value)
import { topoSort, type DagNode, type DagSpec, type NodeId, type NodeUpstreams } from "./dag-core.ts";

/** A node not cast because its dependent subgraph was halted: the offending upstream(s) and why. */
export interface SkippedNode {
  readonly id: NodeId;
  readonly blockedBy: readonly NodeId[];   // in-edge upstream(s) that did not proceed
  readonly reason: string;                 // andon naming the halted upstream cause
}

/** The outcome of running a graph — the DAG analog of `ChainResult`.
 *  - nodes     : one RunSummary per CAST node (skipped nodes absent — they recorded in `skipped`).
 *  - skipped   : the dependent-subgraph nodes a halt skipped (siblings independent of it still ran).
 *  - outcome   : terminal outcome — the FIRST non-success cast outcome (topo order), else success.
 *  - halted    : did any node skip a dependent subgraph (`skipped.length > 0`).
 *  - produced  : the SINK (leaf) nodes' `produced` — a graph may have several leaves.
 *  - haltReason: the first skip's cause, when halted. */
export interface GraphResult {
  readonly nodes: ReadonlyMap<NodeId, RunSummary>;
  readonly skipped: readonly SkippedNode[];
  readonly outcome: RunOutcome;
  readonly halted: boolean;
  readonly produced: ReadonlyMap<NodeId, string>;
  readonly haltReason?: string;
}

/** Run a DAG in topological order, threading each node's upstreams' `produced` into its cast,
 *  fanning a node's `produced` to every downstream, joining multiple upstreams into one node, and
 *  halting exactly the dependent subgraph of any node that fails / produces nothing. PURE given
 *  injected casts — spawns nothing. TOTAL: a cyclic spec is refused (never hangs). */
export async function runGraph(spec: DagSpec): Promise<GraphResult>;
```

## Internal organization of `runGraph` (the three generalizations)

1. **Order.** `topoSort(spec)`. A `{ cycle }` is a precondition violation (`validateDag` is the
   cycle gate) — refuse TOTALLY: cast nothing, every node `skipped`, `outcome: "gate-failed"`,
   `halted: true`. Never throw, never hang.
2. **Build adjacency** over **declared** endpoints only (dangling edges ignored — parity with
   `topoSort`'s "unknown endpoint → no dependency"): `inEdges: id → from[]`, and an `outDegree`
   map to identify sinks (out-degree 0).
3. **Walk `order`.** Per node, maintaining `proceeded: Set`, `producedAll: Map`, `summaries: Map`,
   `skipped[]`, `haltReasonOf: Map`:
   - **Skip rule (the halt):** a node runs iff EVERY in-edge upstream is in `proceeded`. Any
     upstream not proceeded (failed, produced-nothing, or itself skipped) ⇒ record `skipped` with
     the blocking upstream(s) + reason; cascades through topo order to the whole dependent closure.
     Independent siblings are unaffected — they have different (proceeded) upstreams.
   - **The join + run:** gather the `NodeUpstreams` map `{ from → producedAll.get(from) }` (every
     upstream proceeded ⇒ each `produced` present & non-empty). Source ⇒ empty map; join ⇒
     multi-entry. `await node.cast(upstreams)`; store the summary.
   - **The fan-out + thread gate:** `decideThread(summary)` (REUSED). Proceed ⇒ add to `proceeded`,
     record `producedAll[id] = summary.produced` — automatically read by every downstream's
     in-edge next. Not-proceed ⇒ record its reason in `haltReasonOf` (its downstreams will skip).
4. **Assemble:** `outcome` = first non-success summary (topo order) ?? `"success"`;
   `halted` = `skipped.length > 0`; `haltReason` = first skip's reason; `produced` = sink nodes
   (out-degree 0) present in `producedAll`.

## Purity & boundaries

- Imports: two **type-only** (`RunOutcome`, `RunSummary`) + one **pure value** (`decideThread`) +
  `dag-core.ts` (model + `topoSort`, itself type-only-importing). No fs/clock/network/process.
- `runGraph` **spawns nothing** — casts are injected `DagNode.cast` thunks. Deterministic: same
  spec + same fake casts ⇒ identical result (topo order is `topoSort`'s declaration-order tie-break).
- Real concurrency of independent ready nodes is **T-046-03's** shell job; `runGraph` may `await`
  per node sequentially in topo order — correctness, not parallelism, is this ticket's contract.
