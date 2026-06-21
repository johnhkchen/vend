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

import { runGraph, type GraphResult } from "./graph-core.ts";
import type { RunOutcome } from "../log/run-log.ts";
import type { RunSummary } from "./cast.ts";
import type { DagNode, DagSpec, NodeId, NodeUpstreams } from "./dag-core.ts";

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
