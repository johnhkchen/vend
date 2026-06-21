// The graph executor's PURE core (T-046-02, story S-046-01, epic E-046) — `runChain` generalized
// from a linear walk into a DAG walk over T-046-01's typed model. Where `runChain` threads ONE
// `upstream` string into each step and halts the whole tail on the first non-success, `runGraph`:
//
//   1. JOIN     — a node receives the `produced` of ALL its upstream (in-edge) nodes, keyed by the
//                 from-node (a `NodeUpstreams` map): source ⇒ empty, linear ⇒ 1-entry, join ⇒ many.
//                 This is the load-bearing generalization — the linear engine structurally cannot
//                 deliver two upstreams to one node.
//   2. FAN-OUT  — a node's `produced` feeds EVERY out-edge; each downstream reads it (keyed by this
//                 node's id) in its own upstream map. Topological order guarantees a node runs only
//                 after all its upstreams.
//   3. HALT THE DEPENDENT SUBGRAPH — a node that fails / produces nothing skips exactly the nodes
//                 that transitively depend on it (its downstream closure); independent siblings
//                 still run. The per-edge gate is the SAME `decideThread` `runChain` uses (reused,
//                 not reimplemented). Elaborate cross-branch error semantics are OUT (E-046 scope).
//
// PURITY (the chain-core.ts discipline): the only imports are two TYPES (`RunOutcome`, `RunSummary`,
// erased under verbatimModuleSyntax), one PURE value (`decideThread` from chain-core.ts, itself
// type-only-importing), and dag-core.ts (the model + `topoSort`). No fs, clock, network, process,
// or native addon. `runGraph` is "pure given its injected casts" — it SPAWNS NOTHING; the `cast`
// thunks are injected (`DagNode.cast`), exactly as graph-core.test.ts injects fakes returning
// canned summaries and T-046-03's `castGraph` injects `adapt → castPlay`. Same spec + same casts ⇒
// byte-identical result (ordering is `topoSort`'s declaration-order tie-break). Real concurrency of
// independent ready nodes is the impure shell's job (T-046-03); this core awaits per node in topo
// order — correctness, not parallelism, is its contract.

import type { RunOutcome } from "../log/run-log.ts";
import type { RunSummary } from "./cast.ts";
import { decideThread } from "./chain-core.ts";
import { topoSort, type DagNode, type DagSpec, type NodeId, type NodeUpstreams } from "./dag-core.ts";

/**
 * A node NOT cast because its dependent subgraph was halted (the graph analog of `runChain`'s
 * "skipped downstream step"). Records the in-edge upstream(s) that did not proceed and a human
 * andon — so a skipped node is visibly accounted for, never silently dropped.
 */
export interface SkippedNode {
  readonly id: NodeId;
  /** The in-edge upstream node(s) that did not proceed (failed, produced nothing, or were
   *  themselves skipped) — the cause of this skip. */
  readonly blockedBy: readonly NodeId[];
  /** The andon: which halted upstream(s) skipped this node, and why each did not proceed. */
  readonly reason: string;
}

/**
 * The outcome of running a graph — the {@link DagSpec} analog of `ChainResult`.
 *  - `nodes`     : one {@link RunSummary} per CAST node, keyed by id (skipped nodes are absent —
 *                  they appear in `skipped`). Each corresponds to one run-log record downstream.
 *  - `skipped`   : the dependent-subgraph nodes a halt skipped; independent siblings are NOT here
 *                  (they ran). Each carries its blocking upstream(s) + andon.
 *  - `outcome`   : the terminal outcome a caller maps to an exit code — the FIRST non-success cast
 *                  outcome in topological order, else `success`. (A success-but-no-`produced` halt
 *                  leaves this `success` with `halted` true, mirroring `runChain` exactly.)
 *  - `halted`    : did any node skip a dependent subgraph (`skipped.length > 0`).
 *  - `produced`  : the SINK (leaf, out-degree-0) nodes' `produced` refs, keyed by id — the graph's
 *                  net output(s); a graph may have several leaves. A sink that failed / produced
 *                  nothing / was skipped is absent.
 *  - `haltReason`: the first skip's cause, present only when `halted`.
 */
export interface GraphResult {
  readonly nodes: ReadonlyMap<NodeId, RunSummary>;
  readonly skipped: readonly SkippedNode[];
  readonly outcome: RunOutcome;
  readonly halted: boolean;
  readonly produced: ReadonlyMap<NodeId, string>;
  readonly haltReason?: string;
}

/**
 * Run a {@link DagSpec} in topological order — PURE given injected casts, TOTAL, DETERMINISTIC.
 * Threads each node's upstreams' `produced` into its cast (JOIN), fans a node's `produced` to every
 * downstream (FAN-OUT), and skips exactly the transitive dependents of any node that does not
 * proceed (HALT THE DEPENDENT SUBGRAPH — siblings independent of it still run).
 *
 * A node runs iff EVERY one of its in-edge upstreams proceeded (succeeded AND surfaced a `produced`
 * to thread — the reused {@link decideThread} gate). Topological order guarantees every upstream is
 * decided first, so a non-proceeding node's skip cascades through its whole downstream closure.
 *
 * TOTAL: a CYCLIC spec violates the precondition — {@link validateDag} is the cycle gate and refuses
 * cyclic graphs before they reach here — but rather than hang, `runGraph` refuses it cleanly: it
 * casts NOTHING, marks every node skipped, and returns `outcome: "gate-failed"`, `halted: true`.
 * The empty graph is a vacuous `success` no-op (mirrors the empty chain).
 */
export async function runGraph(spec: DagSpec): Promise<GraphResult> {
  const sorted = topoSort(spec);

  // CYCLE — precondition violation (validateDag gates this). Refuse totally rather than hang:
  // nothing cast, every node skipped, a non-success terminal outcome the caller maps to non-zero.
  if ("cycle" in sorted) {
    const reason = `graph is cyclic — runGraph runs only acyclic specs (validateDag is the cycle gate); cycle: ${sorted.cycle.join(", ")}`;
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
  // (parity with topoSort's "unknown endpoint → no dependency"); validateDag refuses dangling edges.
  // `inEdges` keys are exactly the declared ids, so `inEdges.has(id)` doubles as "id is declared".
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
  const proceeded = new Set<NodeId>(); // nodes that cast AND passed decideThread (have a threadable produced)
  const producedAll = new Map<NodeId, string>(); // every proceeded node's produced — the fan-out source
  const haltReasonOf = new Map<NodeId, string>(); // why a CAST node did not proceed (for skip andons)
  const skipped: SkippedNode[] = [];
  let firstFail: RunSummary | undefined;

  for (const id of order) {
    const upstreamIds = inEdges.get(id) ?? [];

    // HALT: a node runs only if EVERY upstream proceeded. Any upstream not in `proceeded` (failed,
    // produced nothing, or was itself skipped) halts this node — and, via the cascade, its closure.
    const blockedBy = upstreamIds.filter((from) => !proceeded.has(from));
    if (blockedBy.length > 0) {
      const causes = blockedBy.map((from) =>
        haltReasonOf.has(from) ? `'${from}' (${haltReasonOf.get(from)})` : `'${from}' (upstream skipped)`,
      );
      skipped.push({ id, blockedBy, reason: `skipped — dependent on halted upstream ${causes.join(", ")}` });
      continue;
    }

    // JOIN: gather this node's upstreams' `produced`, keyed by from-node. Every upstream proceeded
    // ⇒ each `produced` is present and non-empty. Source ⇒ empty map; linear ⇒ 1-entry; join ⇒ many.
    const upstreams: NodeUpstreams = new Map(
      upstreamIds.flatMap((from) => {
        const p = producedAll.get(from);
        return p === undefined ? [] : [[from, p] as const];
      }),
    );

    const node = byId.get(id);
    if (node === undefined) continue; // unreachable (id ∈ order ⊆ declared); guards the Map lookup
    const summary = await node.cast(upstreams);
    summaries.set(id, summary);
    if (firstFail === undefined && summary.outcome !== "success") firstFail = summary;

    // FAN-OUT + thread gate: on proceed, record `produced` — every downstream's in-edge reads it
    // next. On no-proceed, record the andon; this node's downstreams will skip (the cascade root).
    const decision = decideThread(summary);
    if (decision.proceed) {
      proceeded.add(id);
      if (summary.produced !== undefined) producedAll.set(id, summary.produced);
    } else {
      haltReasonOf.set(id, decision.reason ?? "did not proceed");
    }
  }

  // SINKS: the leaves' `produced` are the graph's net output(s). A sink absent from `producedAll`
  // (it failed, produced nothing, or was skipped) is omitted.
  const produced = new Map<NodeId, string>();
  for (const id of order) {
    if ((outDegree.get(id) ?? 0) !== 0) continue;
    const p = producedAll.get(id);
    if (p !== undefined) produced.set(id, p);
  }

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
