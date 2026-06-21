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
// awaits each node one-at-a-time in topo order ("correctness, not parallelism, is its contract"; real
// concurrency is THIS shell's job). So `castGraph` owns a concurrent WAVE DISPATCHER — but it honors
// "the pure core owns ordering/threading/halt" by REUSING the pure decision primitives, not
// reimplementing judgment: `topoSort` (ordering + the cycle authority) and `decideThread` (the SAME
// per-edge halt gate `runGraph` uses). `runGraph` is the tested sequential REFERENCE for these exact
// join/fan-out/halt semantics; `castGraph` is its concurrent twin over the same primitives, returning
// the same {@link GraphResult} (assembled in topo order, so deterministic despite concurrent settle).
//
// PURITY: `castGraph` is the impure verb — it value-imports `castPlay` (which spawns + logs) and the
// node casts await `adapt` (which may read fs). It is NOT unit-tested; its logic is the pure
// `topoSort`/`decideThread`/`runGraph` (proven in dag-core.test.ts + graph-core.test.ts), and the
// concurrent shell is proven LIVE downstream — exactly as `castChain` is. Because it value-imports
// `castPlay`, **no `bun test` value-imports this module** (the `chain.ts` discipline).

import type { Budget } from "../budget/budget.ts";
import { castPlay, type CastOptions, type RunSummary } from "./cast.ts";
import type { Play } from "./play.ts";
import { decideThread } from "./chain-core.ts";
import {
  topoSort,
  type DagEdge,
  type DagNode,
  type DagSpec,
  type NodeId,
  type NodeUpstreams,
} from "./dag-core.ts";
import type { GraphResult, SkippedNode } from "./graph-core.ts";

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
 * CONCURRENTLY** (a `Promise.all` per topological ready-set), threads each node's `produced` to its
 * downstreams (FAN-OUT), converges multiple upstreams into a join node (JOIN), and skips exactly the
 * dependent subgraph of any node that does not proceed (HALT). The impure shell over the pure cores:
 * it owns spawning + concurrency; `topoSort` owns ordering, `decideThread` owns the halt gate.
 *
 * The `PlayNode<any, any>[]` element type is the same documented, unavoidable type-erasure as
 * `castChain`'s `PlayStep<any, any>[]` and `AnyPlay = Play<any, any>`: a graph is heterogeneous — its
 * nodes hold plays with different `I`/`O`, which a single array cannot preserve. Type safety lives at
 * each node's internally-consistent construction and at the `adapt`/`opts` boundary.
 */
export async function castGraph(
  nodes: readonly PlayNode<any, any>[],
  edges: readonly DagEdge[],
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

  return runGraphConcurrent({ nodes: dagNodes, edges });
}

/**
 * The concurrent wave dispatcher — `runGraph`'s twin with `Promise.all` per ready-set. PRIVATE to the
 * shell: it spawns nothing itself, but it exists to drive injected casts CONCURRENTLY (the shell's
 * job), so it lives beside `castGraph` rather than in the pure core. It reuses `topoSort` (ordering +
 * cycle authority) and `decideThread` (halt gate), and assembles the result in TOPO ORDER so the
 * {@link GraphResult} is deterministic even though the wave's casts settle in nondeterministic order.
 * Its join/fan-out/halt semantics are the ones `graph-core.test.ts` proves on the sequential `runGraph`.
 */
async function runGraphConcurrent(spec: DagSpec): Promise<GraphResult> {
  const sorted = topoSort(spec);

  // CYCLE — precondition violation (validateDag is the cycle gate). Refuse totally rather than hang:
  // nothing cast, every node skipped, a non-success terminal outcome — byte-for-byte the runGraph path.
  if ("cycle" in sorted) {
    const reason = `graph is cyclic — castGraph runs only acyclic specs (validateDag is the cycle gate); cycle: ${sorted.cycle.join(", ")}`;
    return {
      nodes: new Map(),
      skipped: spec.nodes.map((node) => ({ id: node.id, blockedBy: sorted.cycle, reason })),
      outcome: "gate-failed",
      halted: true,
      produced: new Map(),
      haltReason: reason,
    };
  }

  const order = sorted.order;

  // First-declared node per id (parity with topoSort's first-index rule for any duplicate id;
  // validateDag is what refuses duplicates — here we just stay total and deterministic).
  const byId = new Map<NodeId, DagNode>();
  for (const node of spec.nodes) if (!byId.has(node.id)) byId.set(node.id, node);

  // Adjacency over DECLARED endpoints only — an edge touching an unknown id contributes nothing
  // (parity with runGraph/topoSort). `inEdges` keys are exactly the declared ids in `order`.
  const inEdges = new Map<NodeId, NodeId[]>();
  const outDegree = new Map<NodeId, number>();
  for (const id of order) {
    inEdges.set(id, []);
    outDegree.set(id, 0);
  }
  for (const edge of spec.edges) {
    if (!inEdges.has(edge.from) || !inEdges.has(edge.to)) continue; // unknown endpoint → ignored
    inEdges.get(edge.to)?.push(edge.from);
    outDegree.set(edge.from, (outDegree.get(edge.from) ?? 0) + 1);
  }

  const summaries = new Map<NodeId, RunSummary>();
  const proceeded = new Set<NodeId>(); // cast AND passed decideThread (has a threadable produced)
  const producedAll = new Map<NodeId, string>(); // every proceeded node's produced — the fan-out source
  const haltReasonOf = new Map<NodeId, string>(); // why a CAST node did not proceed (skip andons)
  const decided = new Set<NodeId>(); // proceeded, halted-after-cast, or skipped — i.e. resolved
  const skipped: SkippedNode[] = [];
  const remaining = new Set<NodeId>(order);

  // WAVE LOOP: each pass dispatches every currently-runnable ready node TOGETHER (Promise.all), then
  // settles. A node is "ready" once all its upstreams are decided; runnable iff all upstreams proceeded.
  while (remaining.size > 0) {
    const wave = order.filter(
      (id) => remaining.has(id) && (inEdges.get(id) ?? []).every((from) => decided.has(from)),
    );
    // `wave` is non-empty: `order` is a topo order over an acyclic graph, so the earliest remaining
    // node has all upstreams already decided. (Defensive: break to stay total rather than spin.)
    if (wave.length === 0) break;

    // SKIP: a wave node with any non-proceeded upstream is halted (its downstreams cascade later).
    const toSkip = wave.filter((id) => (inEdges.get(id) ?? []).some((from) => !proceeded.has(from)));
    const skipSet = new Set(toSkip);
    for (const id of toSkip) {
      const blockedBy = (inEdges.get(id) ?? []).filter((from) => !proceeded.has(from));
      const causes = blockedBy.map((from) =>
        haltReasonOf.has(from) ? `'${from}' (${haltReasonOf.get(from)})` : `'${from}' (upstream skipped)`,
      );
      skipped.push({ id, blockedBy, reason: `skipped — dependent on halted upstream ${causes.join(", ")}` });
      decided.add(id);
      remaining.delete(id);
    }

    // RUN: dispatch the runnable ready nodes CONCURRENTLY. Each gathers its JOIN map (every upstream
    // proceeded ⇒ each produced present) and awaits its injected cast.
    const toRun = wave.filter((id) => !skipSet.has(id));
    const cast = await Promise.all(
      toRun.map(async (id) => {
        const upstreams: NodeUpstreams = new Map(
          (inEdges.get(id) ?? []).flatMap((from) => {
            const p = producedAll.get(from);
            return p === undefined ? [] : [[from, p] as const];
          }),
        );
        const node = byId.get(id);
        if (node === undefined) return [id, undefined] as const; // unreachable (id ∈ order ⊆ declared)
        return [id, await node.cast(upstreams)] as const;
      }),
    );

    // SETTLE: record summaries + the fan-out/thread gate (decideThread, REUSED).
    for (const [id, summary] of cast) {
      decided.add(id);
      remaining.delete(id);
      if (summary === undefined) continue;
      summaries.set(id, summary);
      const decision = decideThread(summary);
      if (decision.proceed) {
        proceeded.add(id);
        if (summary.produced !== undefined) producedAll.set(id, summary.produced);
      } else {
        haltReasonOf.set(id, decision.reason ?? "did not proceed");
      }
    }
  }

  // DETERMINISTIC ASSEMBLY in topo order — independent of the concurrent settle order above, so the
  // same spec + same casts yield the same GraphResult (parity with the sequential runGraph).
  let firstFail: RunSummary | undefined;
  for (const id of order) {
    const s = summaries.get(id);
    if (s !== undefined && firstFail === undefined && s.outcome !== "success") firstFail = s;
  }

  // SINKS: the leaves' produced are the graph's net output(s); a sink absent from producedAll
  // (failed, produced nothing, or skipped) is omitted.
  const produced = new Map<NodeId, string>();
  for (const id of order) {
    if ((outDegree.get(id) ?? 0) !== 0) continue;
    const p = producedAll.get(id);
    if (p !== undefined) produced.set(id, p);
  }

  // Skips were appended in wave order; re-key to topo order so the result is fully deterministic.
  skipped.sort((a, b) => order.indexOf(a.id) - order.indexOf(b.id));

  const halted = skipped.length > 0;
  return {
    nodes: summaries,
    skipped,
    outcome: firstFail?.outcome ?? "success",
    halted,
    produced,
    ...(halted ? { haltReason: skipped[0]?.reason } : {}),
  };
}
