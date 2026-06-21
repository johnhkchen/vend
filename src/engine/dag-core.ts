// The typed DAG model + its PURE ordering core (T-046-01, story S-046-01, epic E-046) — the data
// substrate the graph executor (T-046-02 `runGraph`) walks. This GENERALIZES the linear chain
// (chain-core.ts) from an implicit *path* graph (each `ChainStep` one upstream, one downstream)
// into an EXPLICIT typed node/edge graph that admits the first non-linear shapes: a node with ≥2
// in-edges (a JOIN) and a node with ≥2 out-edges (a FAN-OUT).
//
// SCOPE (this ticket): SHAPE + ORDERING only. This module spawns nothing and casts nothing — it
// owns the model (`DagNode`/`DagEdge`/`DagSpec`), a TOTAL `validateDag` (refuses dangling edges,
// duplicate ids, and cycles as distinct named offenses — never throws), and a pure, total,
// DETERMINISTIC `topoSort` (an order for a DAG, or the offending nodes for a cycle — never a hang).
// The RUN (threading each node's upstreams' `produced` into its cast, fan-out, join, halt) is
// T-046-02's `runGraph`; the impure `castGraph` shell + worked example is T-046-03.
//
// PURITY (the chain-core.ts discipline): the only import is a TYPE (`RunSummary`, erased under
// verbatimModuleSyntax — referenced solely in `NodeCast`'s return). No fs, clock, network, process,
// or native addon. Both exported functions are TOTAL and pure; all ordering is driven by a node's
// position in `spec.nodes` (declaration order) so the same spec yields a byte-identical result.

import type { RunSummary } from "./cast.ts";

// ── Identity & the cast payload ──────────────────────────────────────────────

/** A node's stable identity within a graph — what {@link DagEdge} references. A transparent
 *  `string` alias: the chain identifies nothing (its steps are positional), but a graph needs
 *  identity for edges to name. Integrity (no duplicates, no dangling references) is enforced by
 *  {@link validateDag}, not by the type. */
export type NodeId = string;

/**
 * The upstream `produced` references threaded into a node's cast, KEYED BY the upstream (from-)node
 * id. T-046-02's `runGraph` builds this from a node's IN-edges: a SOURCE node (no in-edges) gets an
 * EMPTY map, a LINEAR node a 1-entry map, a **JOIN** (≥2 in-edges) a multi-entry map. This is the
 * graph generalization of `runChain`'s single `upstream: string | undefined` — the load-bearing
 * shape the linear engine structurally cannot deliver (two upstreams into one node).
 */
export type NodeUpstreams = ReadonlyMap<NodeId, string>;

/**
 * A node's cast thunk. T-046-02 NARROWS this from T-046-01's wide `(...args)` placeholder to its
 * real shape: it receives this node's {@link NodeUpstreams} (its upstreams' `produced` refs, keyed
 * by from-node) and returns the node's {@link RunSummary} (which carries this node's OWN `produced`
 * — the edge payload a downstream join threads). The play-specific adapter (upstreams → typed
 * inputs → `castPlay`) is closed over by `cast` (T-046-03); this model/ordering layer still never
 * invokes `cast` — exactly as `runChain`'s sequencing never reads inside a `ChainStep.cast`.
 */
export type NodeCast = (upstreams: NodeUpstreams) => Promise<RunSummary>;

// ── The typed graph model ────────────────────────────────────────────────────

/** A graph node: a stable {@link NodeId} plus its opaque {@link NodeCast}. The `ChainStep`
 *  generalized with identity. */
export interface DagNode {
  readonly id: NodeId;
  readonly cast: NodeCast;
}

/** A directed dependency edge `from → to`: the upstream (`from`) node's `produced` thread feeds the
 *  downstream (`to`) node. A node's IN-edges define its upstreams (≥2 = a JOIN); its OUT-edges its
 *  downstreams (≥2 = a FAN-OUT). */
export interface DagEdge {
  readonly from: NodeId;
  readonly to: NodeId;
}

/** The graph a playbook declares: its nodes and the directed edges between them. */
export interface DagSpec {
  readonly nodes: readonly DagNode[];
  readonly edges: readonly DagEdge[];
}

// ── Validation (total) ───────────────────────────────────────────────────────

/** The distinct, named fault kinds {@link validateDag} refuses. Each is a separate andon rather
 *  than a stringly-typed blob — mirrors `chain-core.ts`'s distinct halt reasons. */
export type DagOffenseKind = "dangling-edge" | "duplicate-node" | "cycle";

/** One validation offense: its {@link DagOffenseKind}, a human andon `detail`, and the offending
 *  node id(s) (an edge's unknown endpoint(s); the repeated id; the cycle's nodes). */
export interface DagOffense {
  readonly kind: DagOffenseKind;
  readonly detail: string;
  readonly nodes: readonly NodeId[];
}

/** The result of {@link validateDag}: clean, or a list of ALL offenses found (not first-failure —
 *  a malformed graph can carry several independent faults, and naming them all is the loud andon). */
export type DagValidation =
  | { readonly ok: true }
  | { readonly ok: false; readonly offenses: readonly DagOffense[] };

// ── Topological sort (pure, total, deterministic) ────────────────────────────

/** The result of {@link topoSort}: a topological `order` over all node ids for an acyclic graph,
 *  or the `cycle` nodes (the cyclic remainder) for a cyclic one. Never both; never a throw. */
export type TopoResult =
  | { readonly order: readonly NodeId[] }
  | { readonly cycle: readonly NodeId[] };

/**
 * Topologically sort a {@link DagSpec} — PURE, TOTAL, DETERMINISTIC. Kahn's algorithm
 * (indegree BFS): every node is indexed by its position in `spec.nodes`, so the ready set is
 * processed in DECLARATION ORDER — a fan-out's ready siblings emit in the order their nodes were
 * declared, giving a reproducible result for the same spec.
 *
 * Edges referencing an unknown id contribute NO dependency (they are skipped), so this function is
 * total even on a malformed graph — {@link validateDag} is what REFUSES such a graph; `topoSort`
 * alone degrades gracefully rather than throwing. A cyclic graph returns the nodes that never reach
 * indegree 0 (the cyclic remainder) as `{ cycle }`; it never hangs. The empty graph → `{ order: [] }`.
 */
export function topoSort(spec: DagSpec): TopoResult {
  const n = spec.nodes.length;

  // Index every node by declaration order; a duplicate id keeps its FIRST index (validateDag is
  // what refuses duplicates — here we just stay total and deterministic).
  const idToIndex = new Map<NodeId, number>();
  for (let i = 0; i < n; i++) {
    const node = spec.nodes[i];
    if (node === undefined) continue; // unreachable (i < n); satisfies noUncheckedIndexedAccess
    if (!idToIndex.has(node.id)) idToIndex.set(node.id, i);
  }

  const indegree = new Array<number>(n).fill(0);
  const successors: number[][] = Array.from({ length: n }, () => []);
  for (const edge of spec.edges) {
    const from = idToIndex.get(edge.from);
    const to = idToIndex.get(edge.to);
    if (from === undefined || to === undefined) continue; // unknown endpoint → no dependency
    const succ = successors[from];
    if (succ === undefined) continue; // unreachable (from < n); guards noUncheckedIndexedAccess
    succ.push(to);
    indegree[to] = (indegree[to] ?? 0) + 1;
  }

  // Emit ready nodes one at a time, ALWAYS choosing the smallest declaration index among those
  // currently ready (indegree 0, not yet emitted). This makes the tie-break purely a node's
  // DECLARATION ORDER — robust to the order edges happen to be listed in — so a fan-out's ready
  // siblings emit lowest-index-first and the same spec yields a byte-identical order.
  const order: NodeId[] = [];
  const emitted = new Array<boolean>(n).fill(false);
  while (order.length < n) {
    let next = -1;
    for (let i = 0; i < n; i++) {
      if (!emitted[i] && (indegree[i] ?? 0) === 0) { next = i; break; }
    }
    if (next === -1) break; // no ready node remains → the rest form a cycle
    const node = spec.nodes[next];
    emitted[next] = true;
    if (node !== undefined) order.push(node.id);
    for (const s of successors[next] ?? []) indegree[s] = (indegree[s] ?? 0) - 1;
  }

  if (order.length === n) return { order };

  // The un-emitted nodes are exactly the cyclic remainder — collected in declaration order.
  const cycle: NodeId[] = [];
  for (let i = 0; i < n; i++) {
    if (emitted[i]) continue;
    const node = spec.nodes[i];
    if (node !== undefined) cycle.push(node.id);
  }
  return { cycle };
}

/**
 * Validate a {@link DagSpec} — TOTAL (returns offenses, never throws). Accumulates ALL faults:
 *  - **duplicate-node:** an id declared more than once;
 *  - **dangling-edge:** an edge whose `from` or `to` is not a declared node id;
 *  - **cycle:** the graph is not acyclic (cycles are DETECTED and REFUSED, never run — E-046 scope).
 *
 * The structural checks (duplicate, dangling) run first; the cycle check is delegated to the single
 * cycle authority {@link topoSort} and only consulted when the graph is structurally sound, so a
 * dangling/duplicate fault can't masquerade as (or mask) a cycle.
 */
export function validateDag(spec: DagSpec): DagValidation {
  const offenses: DagOffense[] = [];

  // duplicate-node — scan declaration order, report each id that first repeats.
  const seen = new Set<NodeId>();
  const duplicates: NodeId[] = [];
  for (const node of spec.nodes) {
    if (seen.has(node.id)) {
      if (!duplicates.includes(node.id)) duplicates.push(node.id);
    } else {
      seen.add(node.id);
    }
  }
  for (const id of duplicates) {
    offenses.push({ kind: "duplicate-node", detail: `duplicate node id '${id}'`, nodes: [id] });
  }

  // dangling-edge — any edge endpoint not among the declared ids (one offense per offending edge).
  const ids = new Set<NodeId>(spec.nodes.map((node) => node.id));
  for (const edge of spec.edges) {
    const missing: NodeId[] = [];
    if (!ids.has(edge.from)) missing.push(edge.from);
    if (!ids.has(edge.to)) missing.push(edge.to);
    if (missing.length > 0) {
      offenses.push({
        kind: "dangling-edge",
        detail: `edge ${edge.from} → ${edge.to} references unknown node id(s): ${missing.join(", ")}`,
        nodes: missing,
      });
    }
  }

  // cycle — only on a structurally-sound graph; topoSort is the single cycle authority.
  if (offenses.length === 0) {
    const sorted = topoSort(spec);
    if ("cycle" in sorted) {
      offenses.push({
        kind: "cycle",
        detail: `graph is cyclic — offending nodes: ${sorted.cycle.join(", ")}`,
        nodes: sorted.cycle,
      });
    }
  }

  return offenses.length === 0 ? { ok: true } : { ok: false, offenses };
}
