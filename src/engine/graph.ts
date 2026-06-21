// The graph primitive's IMPURE shell (T-046-03, story S-046-01, epic E-046) — `castGraph`, the
// `chain.ts` `castChain` analog at graph scale. Where `castChain` casts a linear SEQUENCE, `castGraph`
// casts a typed DAG: for each `DagNode` it injects the play-specific `adapt → castPlay` (upstream
// `produced` map → the node's typed inputs → `castPlay`), and it runs **independent ready nodes
// CONCURRENTLY** — the "run plays in parallel" E-046 names. It re-exports the pure core so a caller
// has ONE engine entry for the whole graph surface (the `cast.ts`/`chain.ts` re-export pattern).
//
// DEPENDENCY DIRECTION (E-007 keystone): the engine stays acyclic. This module imports the engine
// (`castPlay`, the `Play` contract, the pure cores) and `Budget` only — NEVER `src/play/`. A concrete
// graph (the clearing plays wired into a diamond) is assembled BY a caller, where the concrete plays
// depend UP onto this primitive; the primitive never depends down on them.
//
// THE ASYMMETRY vs `castChain` (why this shell is not a thin pass-through): `castChain` is tiny because
// `runChain`'s SEQUENTIAL await IS the chain's semantics — a chain has no concurrency to add. A graph
// ADDS branch concurrency, which the pure `runGraph` (T-046-02) deliberately does NOT provide: it
// awaits each node one-at-a-time in topo order ("correctness, not parallelism, is its contract"). The
// concurrent twin — the WAVE DISPATCHER `runGraphConcurrent` — is pure-given-injected-casts and lives
// in graph-core.ts beside `runGraph` (it `Promise.all`s injected thunks: concurrency, not impurity).
// `castGraph` is the thin IMPURE shell that injects the real `adapt → castPlay` (the SPAWNING) and
// delegates the dispatch to that pure twin. `runGraph` is the tested sequential REFERENCE for the exact
// join/fan-out/halt semantics; `runGraphConcurrent` is its concurrent twin over the same primitives.
//
// SHARED WALLET (E-048, T-048-02): `castGraph` optionally takes ONE shared `Wallet`. When present, it
// builds the per-node price map (each `PlayNode.budget`, the measured envelope) and hands it with the
// wallet to `runGraphConcurrent`, which authorizes each ready-set before dispatch and debits after
// settle — so concurrent branches draw from one envelope with a hard stop at the wave boundary (P7
// under concurrency). When absent, the legacy path: every runnable node dispatched.
//
// PURITY: `castGraph` is the impure verb — it value-imports `castPlay` (which spawns + logs) and the
// node casts await `adapt` (which may read fs). It is NOT unit-tested; its logic is the pure
// `topoSort`/`decideThread`/`runGraph`/`runGraphConcurrent` (proven in dag-core.test.ts +
// graph-core.test.ts + the budgeted worked example in graph-example.test.ts), and the concurrent shell
// is proven LIVE downstream — exactly as `castChain` is. Because it value-imports `castPlay`, **no
// `bun test` value-imports this module** (the `chain.ts` discipline).

import type { Budget } from "../budget/budget.ts";
import type { Wallet } from "../budget/wallet.ts";
import { castPlay, type CastOptions } from "./cast.ts";
import type { Play } from "./play.ts";
import type { DagEdge, DagNode, NodeId, NodeUpstreams } from "./dag-core.ts";
import { runGraphConcurrent, type GraphResult } from "./graph-core.ts";

// Re-export the pure graph surface (model + validateDag/topoSort + runGraph/GraphResult) so a caller
// has one import for the whole graph surface — the `cast.ts`/`chain.ts` re-export pattern.
export * from "./graph-core.ts";

/**
 * A node's cast options — STATIC, or DERIVED from its upstreams' `produced` map. The {@link
 * NodeUpstreams} analog of `chain.ts`'s `StepOptions`: a join node may name its run-log `subject`
 * from a threaded upstream ref, resolved against the SAME upstream map its `adapt` sees (a source
 * node's is empty). A plain {@link CastOptions} is still a valid `NodeOptions`, so static nodes are
 * unchanged — the function form is purely additive.
 */
export type NodeOptions = CastOptions | ((upstreams: NodeUpstreams) => CastOptions);

/**
 * One node of a graph: its stable {@link NodeId}, the play, its budget + cast options, and an
 * `adapt` that builds the play's typed inputs from this node's upstreams' `produced` refs. The
 * `chain.ts` `PlayStep` generalized with IDENTITY (edges name it) and a multi-upstream adapter
 * ({@link NodeUpstreams}) instead of a single `upstream: string | undefined` — a source node's map
 * is empty, a linear node's has one entry, a JOIN's has many. `adapt` may be async (assembling a
 * play's inputs reads fs), so `castGraph` awaits it before casting.
 *
 * @typeParam I the play's typed inputs
 * @typeParam O the play's typed output
 */
export interface PlayNode<I, O> {
  readonly id: NodeId;
  readonly play: Play<I, O>;
  readonly budget: Budget;
  readonly opts: NodeOptions;
  readonly adapt: (upstreams: NodeUpstreams) => I | Promise<I>;
}

/**
 * Cast a declared graph end to end — the graph primitive. For each node it injects `adapt → castPlay`
 * (the `castChain` pattern, generalized to the upstreams join map), runs **independent ready nodes
 * CONCURRENTLY** (the pure `runGraphConcurrent` wave dispatcher), threads each node's `produced` to its
 * downstreams (FAN-OUT), converges multiple upstreams into a join node (JOIN), and skips exactly the
 * dependent subgraph of any node that does not proceed (HALT). The impure shell over the pure cores:
 * it owns spawning; `runGraphConcurrent` owns the concurrent dispatch, `topoSort` ordering,
 * `decideThread` the halt gate.
 *
 * SHARED WALLET (E-048): pass an optional `wallet` to draw every concurrent branch from ONE envelope
 * with a hard stop at the wave boundary (P7 under concurrency). When supplied, each node's `budget` is
 * its predicted wave price (IA-8 honest — the measured envelope, untouched), `runGraphConcurrent`
 * authorizes each ready-set against the live shared wallet before dispatch and debits after settle
 * (tokens SUM, wall-clock MAX), and the result carries `walletRemaining`. When omitted, the legacy
 * path: every runnable node dispatched (back-compat — the E-047 live cast is unchanged). Fund once
 * with `allocate(macro)` and pass the `Wallet`; a linear graph then behaves exactly as the sequential
 * spend loop (single-node waves), and `spendDown`/`vend work` is untouched.
 *
 * The `PlayNode<any, any>[]` element type is the same documented, unavoidable type-erasure as
 * `castChain`'s `PlayStep<any, any>[]` and `AnyPlay = Play<any, any>`: a graph is heterogeneous — its
 * nodes hold plays with different `I`/`O`, which a single array cannot preserve. Type safety lives at
 * each node's internally-consistent construction and at the `adapt`/`opts` boundary.
 */
export async function castGraph(
  nodes: readonly PlayNode<any, any>[],
  edges: readonly DagEdge[],
  wallet?: Wallet,
): Promise<GraphResult> {
  // Build the typed DagSpec: each node's `cast` injects `adapt → castPlay` (the castChain injection,
  // generalized to the NodeUpstreams join map). Resolve `opts` against the same upstreams `adapt` sees.
  const dagNodes: DagNode[] = nodes.map((n) => ({
    id: n.id,
    cast: async (upstreams: NodeUpstreams) => {
      const inputs = await n.adapt(upstreams);
      const opts = typeof n.opts === "function" ? n.opts(upstreams) : n.opts;
      return castPlay(n.play, inputs, n.budget, opts);
    },
  }));

  if (wallet === undefined) return runGraphConcurrent({ nodes: dagNodes, edges });

  // SHARED WALLET: each node's measured `budget` is its predicted wave price. A dispatched id is always
  // a declared node, so the map always hits; the `{0,0}` fallback only keeps `priceOf` total.
  const budgetById = new Map<NodeId, Budget>(nodes.map((n) => [n.id, n.budget]));
  const priceOf = (id: NodeId): Budget => budgetById.get(id) ?? { tokens: 0, timeMs: 0 };
  return runGraphConcurrent({ nodes: dagNodes, edges }, { wallet, priceOf });
}
