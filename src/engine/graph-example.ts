// The DETERMINISTIC worked example (T-046-03, story S-046-01, epic E-046) — the executable
// demonstration E-046's "Done looks like" requires: a declared `DagSpec` with ≥1 FAN-OUT and ≥1 JOIN
// (a diamond A → {B, C} → D), run end-to-end so the substrate's two non-linear shapes are proven.
//
// STUB NODES, NOT A LIVE CAST: every node returns a CANNED `RunSummary` (the chain-core.test.ts /
// graph-core.test.ts fake discipline), and it drives the PURE `runGraph` (T-046-02) — imported from
// `./graph-core.ts`, NEVER from `./graph.ts` (which value-imports `castPlay` → the executor seam).
// So this module spawns nothing, loads no addon, and is importable + reproducible. A real-play graph
// cast is a downstream METERED proof (E-046 scope: OUT here); this proves the SUBSTRATE deterministically.
//
// What it proves (the shape the substrate enables): A fans out to B and C (both read A's `produced`),
// and D JOINS both — D receives BOTH B's and C's `produced`, the convergence the linear engine
// structurally cannot deliver. The runtime CONCURRENCY of B ∥ C is `castGraph`'s job (graph.ts),
// proven live; here the diamond's correctness under the sequential reference executor is what we pin.

import { runGraph, runGraphConcurrent, type GraphResult } from "./graph-core.ts";
import type { RunOutcome } from "../log/run-log.ts";
import type { RunSummary } from "./cast.ts";
import type { DagNode, DagSpec, NodeId, NodeUpstreams } from "./dag-core.ts";
import { allocate, type Wallet } from "../budget/wallet.ts";
import { countTokens, type Budget } from "../budget/budget.ts";

/** A canned cast result — the only thing the pure core sees of a node (graph-core.test.ts shape). */
function summary(outcome: RunOutcome, produced?: string): RunSummary {
  return { runId: `run-${outcome}`, outcome, materialized: outcome === "success", produced };
}

/** A stub node that RECORDS the {@link NodeUpstreams} it was cast with (so the example can show the
 *  fan-out and the join) and returns a canned success carrying `produced`. */
function recordingStub(id: NodeId, produced: string): { node: DagNode; calls: Record<string, string>[] } {
  const calls: Record<string, string>[] = [];
  return {
    calls,
    node: {
      id,
      cast: async (upstreams: NodeUpstreams) => {
        calls.push(Object.fromEntries(upstreams));
        return summary("success", produced);
      },
    },
  };
}

/** The diamond fixture: nodes A,B,C,D with edges A→B, A→C (fan-out), B→D, C→D (join). `seen[id]` is
 *  a live reference to the upstreams object that node recorded when cast (populated by `runGraph`). */
export function diamondExample(): { spec: DagSpec; seen: Record<NodeId, Record<string, string>[]> } {
  const a = recordingStub("A", "pa");
  const b = recordingStub("B", "pb");
  const c = recordingStub("C", "pc");
  const d = recordingStub("D", "pd");

  const spec: DagSpec = {
    nodes: [a.node, b.node, c.node, d.node],
    edges: [
      { from: "A", to: "B" },
      { from: "A", to: "C" },
      { from: "B", to: "D" },
      { from: "C", to: "D" },
    ],
  };

  return { spec, seen: { A: a.calls, B: b.calls, C: c.calls, D: d.calls } };
}

/** The result of running the diamond: the upstreams each node actually saw (keyed by node id) and the
 *  whole {@link GraphResult}. `upstreamsSeen.D` is the JOIN — it carries BOTH B's and C's `produced`. */
export interface DiamondTrace {
  readonly upstreamsSeen: Record<NodeId, Record<string, string>>;
  readonly result: GraphResult;
}

/** Run the diamond end-to-end through the pure `runGraph` and surface what each node saw. */
export async function runDiamondExample(): Promise<DiamondTrace> {
  const { spec, seen } = diamondExample();
  const result = await runGraph(spec);
  const upstreamsSeen: Record<NodeId, Record<string, string>> = {};
  for (const id of Object.keys(seen)) {
    upstreamsSeen[id] = seen[id]?.[0] ?? {}; // each node is cast exactly once in the diamond
  }
  return { upstreamsSeen, result };
}

// ─── The SHARED-WALLET worked example (T-048-02, epic E-048) ───────────────────────────────────────
//
// E-048's "Done looks like": a fan-out whose branches' COMBINED cost exceeds a small shared envelope.
// Under ONE shared wallet, `castGraph`'s wave dispatcher (the pure `runGraphConcurrent`, exercised here
// with stubs — NO live cast, NO castPlay) stops the overflowing branch at the wave boundary and the
// total debited stays inside the envelope (tokens SUM, wall-clock MAX). Under the OLD per-node budgets
// (the no-wallet legacy path) the SAME fan-out dispatches BOTH branches — each "affords" its own budget
// against the pre-wave balance — and OVERSPENDS. This module builds that fixture and both runs.

/** A COSTED stub node — a canned success carrying both a `produced` ref AND measured `actuals`
 *  (`{ usage, wallMs }`) so `debitWave` has a real delta to fold. The wave-budget analog of
 *  {@link recordingStub}; tokens are carried as `input_tokens` (so `countTokens` == that count). */
function costedStub(id: NodeId, produced: string, price: Budget): DagNode {
  return {
    id,
    cast: async () => ({
      runId: `run-${id}`,
      outcome: "success" as RunOutcome,
      materialized: true,
      produced,
      actuals: { usage: { input_tokens: price.tokens }, wallMs: price.timeMs },
    }),
  };
}

/** The shared-wallet fan-out fixture: A → {B, C}. A is cheap; B and C are each affordable ALONE but
 *  TOGETHER overflow the post-A token envelope. Prices == actuals (deterministic, no recalibration).
 *  - envelope:  90_000 tokens / 60_000 ms.
 *  - A:         40_000 tok / 30_000 ms  → after A debit: 50_000 tok / 30_000 ms remaining.
 *  - B, C:      40_000 tok / 20_000 ms each. Wave {B,C}: B fits (cum 40k ≤ 50k); C stops (40k+40k=80k
 *               > 50k). Per-node (no wallet): both dispatch → 40k+40k = 80k summed on top of A's 40k. */
export function budgetedFanoutExample(): {
  spec: DagSpec;
  wallet: Wallet;
  priceOf: (id: NodeId) => Budget;
} {
  const prices: Record<NodeId, Budget> = {
    A: { tokens: 40_000, timeMs: 30_000 },
    B: { tokens: 40_000, timeMs: 20_000 },
    C: { tokens: 40_000, timeMs: 20_000 },
  };
  const spec: DagSpec = {
    nodes: [
      costedStub("A", "pa", prices.A as Budget),
      costedStub("B", "pb", prices.B as Budget),
      costedStub("C", "pc", prices.C as Budget),
    ],
    edges: [
      { from: "A", to: "B" },
      { from: "A", to: "C" },
    ],
  };
  const wallet = allocate({ tokens: 90_000, timeMs: 60_000 });
  const priceOf = (id: NodeId): Budget => (prices[id] as Budget) ?? { tokens: 0, timeMs: 0 };
  return { spec, wallet, priceOf };
}

/** Run the fan-out under the SHARED wallet — the bounded path. C is budget-stopped at the wave
 *  boundary; `result.walletRemaining` shows the envelope was not overspent. */
export async function runSharedWalletFanout(): Promise<{ result: GraphResult; funded: Budget }> {
  const { spec, wallet, priceOf } = budgetedFanoutExample();
  const result = await runGraphConcurrent(spec, { wallet, priceOf });
  return { result, funded: wallet.funded };
}

/** Run the SAME fan-out with NO shared wallet — the legacy per-node path. Both B and C dispatch; the
 *  summed actuals (what each node really burned) is the OVERSPEND a shared wallet would have stopped. */
export async function runPerNodeFanout(): Promise<{ result: GraphResult; totalSpent: Budget }> {
  const { spec } = budgetedFanoutExample();
  const result = await runGraphConcurrent(spec); // no budget ⇒ every runnable node dispatched
  let tokens = 0;
  let timeMs = 0;
  for (const summary of result.nodes.values()) {
    const a = summary.actuals;
    if (a === undefined) continue;
    tokens += countTokens(a.usage); // every branch's tokens are real — summed
    timeMs += a.wallMs;
  }
  return { result, totalSpent: { tokens, timeMs } };
}

// ─── The CONDITIONAL-EDGE worked example (T-049-03, epic E-049) ─────────────────────────────────────
//
// E-049's "Done looks like": a playbook author declares a BRANCH once — a predicate on the edge — and
// the not-taken subgraph is an OBSERVABLE skip, not a silent drop. This module builds that worked
// example as a parametric ROUTER: one router node R fans out to two handler branches, and a mutually
// exclusive `when` predicate on each out-edge selects exactly one. The SAME declared graph routes
// either way purely by R's produced data — the essence of a conditional edge.
//
// It drives the PURE `runGraphConcurrent` (graph-core.ts) with `recordingStub`s — NO `castPlay`, NO
// native addon, nothing spawned (the diamond/shared-wallet discipline). That is the dispatcher the
// impure `castGraph` (graph.ts) DELEGATES to, and `castGraph` is PREDICATE-TRANSPARENT: it passes the
// caller's `edges` (every `when` included) straight through (graph.ts:114) and neither reads nor
// rewrites the predicate. So the predicate threading an author declares end-to-end is delivered
// ENTIRELY here — exactly as the E-048 shared wallet (which also lives in `castGraph`) is proven by
// `runSharedWalletFanout` driving the same pure dispatcher. Proving it here proves the author path
// without value-importing graph.ts (which would load the executor seam). NO LIVE MODEL.
//
// What it proves: with route "go", R→T fires and R→N does NOT — T (and its downstream TD) run, while N
// AND its dependent subgraph ND land in `skipped`: N as a BRANCH-NOT-TAKEN (its edge's predicate
// rejected R's produced), ND as a cascade `dependent on halted upstream` (the not-taken skip propagates
// through the SAME halt machinery — reuse, not reinvent). Route "stop" is the mirror image.

/** The branching fixture: a router R fans out to two branches under mutually exclusive edge predicates.
 *  `route` is the signal R produces ("go" ⇒ the T/TD branch is taken; "stop" ⇒ the N/ND branch is).
 *  Edge topology is IDENTICAL for both routes — only R's produced data differs, so the author declared
 *  the branch ONCE on the edges and the run-time data picks it. `seen[id]` is the live record of the
 *  upstreams that node was cast with (empty ⇒ the node was skipped, never cast). */
export function branchingExample(route: "go" | "stop"): {
  spec: DagSpec;
  seen: Record<NodeId, Record<string, string>[]>;
} {
  const r = recordingStub("R", route); // the router — its `produced` IS the routing signal
  const t = recordingStub("T", "pt"); // taken-branch handler (fires on "go")
  const td = recordingStub("TD", "ptd"); // taken-branch downstream (proves the taken subgraph runs)
  const n = recordingStub("N", "pn"); // not-taken-branch handler (fires on "stop")
  const nd = recordingStub("ND", "pnd"); // not-taken-branch downstream (proves the cascade skip)

  const spec: DagSpec = {
    nodes: [r.node, t.node, td.node, n.node, nd.node],
    edges: [
      { from: "R", to: "T", when: (produced) => produced === "go" }, // the branch — declared ONCE,
      { from: "R", to: "N", when: (produced) => produced === "stop" }, // here, on the edge.
      { from: "T", to: "TD" }, // plain edge: the taken branch's dependent subgraph
      { from: "N", to: "ND" }, // plain edge: the not-taken branch's dependent subgraph
    ],
  };

  return { spec, seen: { R: r.calls, T: t.calls, TD: td.calls, N: n.calls, ND: nd.calls } };
}

/** The result of running the branching example: the upstreams each node saw (`undefined` ⇒ that node
 *  was NEVER cast — the observable skip, kept distinct from a node cast with an empty upstream map) and
 *  the whole {@link GraphResult} (its `skipped` carries the branch-not-taken + cascade andons). */
export interface BranchingTrace {
  readonly upstreamsSeen: Record<NodeId, Record<string, string> | undefined>;
  readonly result: GraphResult;
}

/** Run the branching example end-to-end through the pure `runGraphConcurrent` (the dispatcher
 *  `castGraph` delegates to) and surface what each node saw. A node that was skipped has an empty
 *  `calls` record ⇒ its `upstreamsSeen` entry is `undefined`. */
export async function runBranchingExample(route: "go" | "stop"): Promise<BranchingTrace> {
  const { spec, seen } = branchingExample(route);
  const result = await runGraphConcurrent(spec); // no wallet — the predicate path is budget-independent
  const upstreamsSeen: Record<NodeId, Record<string, string> | undefined> = {};
  for (const id of Object.keys(seen)) {
    upstreamsSeen[id] = seen[id]?.[0]; // each node casts at most once here; absent ⇒ undefined (skipped)
  }
  return { upstreamsSeen, result };
}
