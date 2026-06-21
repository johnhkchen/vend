import { describe, expect, test } from "bun:test";
import type { RunOutcome } from "../log/run-log.ts";
import type { RunSummary } from "./cast.ts";
import { runGraph } from "./graph-core.ts";
import type { DagEdge, DagNode, DagSpec, NodeUpstreams } from "./dag-core.ts";

// T-046-02 runGraph: the PURE join/fan-out/halt core. We import ONLY ./graph-core.ts + ./dag-core.ts
// (both type-only-import the impure cast.ts) so this `bun test` process loads no native addon and
// spawns NOTHING — an ordinary pure-function test (the chain-core.test.ts discipline). `castGraph`
// is the impure shell (T-046-03) and is not exercised here; its logic is this tested core, proven
// live when the diamond example is cast in T-046-03. NO LIVE MODEL.

// A canned cast result — the only thing the pure core sees of a node.
function summary(outcome: RunOutcome, produced?: string): RunSummary {
  return { runId: `run-${outcome}`, outcome, materialized: outcome === "success", produced };
}

// A node that RECORDS the NodeUpstreams it was cast with (proves threading + the JOIN) and returns
// a canned summary. `calls` captures each upstream map as a plain object for easy assertion.
function recordingNode(id: string, result: RunSummary): {
  node: DagNode;
  calls: Record<string, string>[];
} {
  const calls: Record<string, string>[] = [];
  return {
    calls,
    node: {
      id,
      cast: async (upstreams: NodeUpstreams) => {
        calls.push(Object.fromEntries(upstreams));
        return result;
      },
    },
  };
}

// A node that MUST NOT be cast — it throws if invoked (proves a halt skipped it, or that a cyclic
// spec casts nothing).
const neverNode = (id: string): DagNode => ({
  id,
  cast: async () => {
    throw new Error(`node '${id}' was cast — it must not have run`);
  },
});

const edge = (from: string, to: string): DagEdge => ({ from, to });
const spec = (nodes: readonly DagNode[], edges: readonly DagEdge[]): DagSpec => ({ nodes, edges });

describe("runGraph — threads upstream `produced` into each node (JOIN + FAN-OUT)", () => {
  test("linear A→B→C: each node receives its single upstream's produced; sink is C", async () => {
    const a = recordingNode("A", summary("success", "pa"));
    const b = recordingNode("B", summary("success", "pb"));
    const c = recordingNode("C", summary("success", "pc"));

    const result = await runGraph(spec([a.node, b.node, c.node], [edge("A", "B"), edge("B", "C")]));

    expect(a.calls).toEqual([{}]); // source — empty upstream map
    expect(b.calls).toEqual([{ A: "pa" }]); // linear — exactly A's produced
    expect(c.calls).toEqual([{ B: "pb" }]);
    expect(result.outcome).toBe("success");
    expect(result.halted).toBe(false);
    expect(result.nodes.size).toBe(3);
    expect(Object.fromEntries(result.produced)).toEqual({ C: "pc" }); // single leaf
  });

  test("fan-out A→{B,C}: A's produced reaches BOTH downstreams; two sinks", async () => {
    const a = recordingNode("A", summary("success", "pa"));
    const b = recordingNode("B", summary("success", "pb"));
    const c = recordingNode("C", summary("success", "pc"));

    const result = await runGraph(spec([a.node, b.node, c.node], [edge("A", "B"), edge("A", "C")]));

    expect(b.calls).toEqual([{ A: "pa" }]);
    expect(c.calls).toEqual([{ A: "pa" }]); // the same produced fanned to both
    expect(Object.fromEntries(result.produced)).toEqual({ B: "pb", C: "pc" }); // two leaves
    expect(result.halted).toBe(false);
  });

  test("JOIN {A,B}→C: C receives a MULTI-entry map — the linear engine cannot express this", async () => {
    const a = recordingNode("A", summary("success", "pa"));
    const b = recordingNode("B", summary("success", "pb"));
    const c = recordingNode("C", summary("success", "pc"));

    const result = await runGraph(spec([a.node, b.node, c.node], [edge("A", "C"), edge("B", "C")]));

    expect(a.calls).toEqual([{}]); // both sources cast with empty maps
    expect(b.calls).toEqual([{}]);
    expect(c.calls).toEqual([{ A: "pa", B: "pb" }]); // the JOIN — both upstreams keyed by from-node
    expect(result.outcome).toBe("success");
    expect(Object.fromEntries(result.produced)).toEqual({ C: "pc" });
  });

  test("diamond A→{B,C}→D: D joins B and C; D is the sole sink", async () => {
    const a = recordingNode("A", summary("success", "pa"));
    const b = recordingNode("B", summary("success", "pb"));
    const c = recordingNode("C", summary("success", "pc"));
    const d = recordingNode("D", summary("success", "pd"));

    const result = await runGraph(
      spec([a.node, b.node, c.node, d.node], [edge("A", "B"), edge("A", "C"), edge("B", "D"), edge("C", "D")]),
    );

    expect(b.calls).toEqual([{ A: "pa" }]);
    expect(c.calls).toEqual([{ A: "pa" }]);
    expect(d.calls).toEqual([{ B: "pb", C: "pc" }]); // the diamond join
    expect(result.halted).toBe(false);
    expect(result.nodes.size).toBe(4);
    expect(Object.fromEntries(result.produced)).toEqual({ D: "pd" });
  });
});

describe("runGraph — halts the DEPENDENT subgraph; independent siblings still run (AC#2)", () => {
  test("A gate-failed → B and C (the whole chain below A) are skipped, not cast", async () => {
    const result = await runGraph(
      spec([{ ...recordingNode("A", summary("gate-failed")).node }, neverNode("B"), neverNode("C")],
        [edge("A", "B"), edge("B", "C")]),
    );

    expect(result.nodes.size).toBe(1); // only A cast — B, C never ran
    expect(result.skipped.map((s) => s.id)).toEqual(["B", "C"]); // the cascade
    expect(result.halted).toBe(true);
    expect(result.outcome).toBe("gate-failed");
    expect(result.haltReason).toContain("A");
    expect(result.produced.size).toBe(0);
  });

  test("fan-out A→{B,C}: B fails (skips only B's closure); C — independent — still runs", async () => {
    const a = recordingNode("A", summary("success", "pa"));
    const c = recordingNode("C", summary("success", "pc"));

    const result = await runGraph(
      spec([a.node, { id: "B", cast: async () => summary("gate-failed") }, c.node],
        [edge("A", "B"), edge("A", "C")]),
    );

    expect(c.calls).toEqual([{ A: "pa" }]); // the independent sibling ran
    expect(result.skipped.length).toBe(0); // B failed but has no downstream — nothing skipped
    expect(result.halted).toBe(false);
    expect(result.outcome).toBe("gate-failed"); // first non-success cast outcome
    expect(Object.fromEntries(result.produced)).toEqual({ C: "pc" }); // C is a leaf; B produced nothing
  });

  test("diamond with B failing: D (joins B) is skipped; C (independent of B) ran", async () => {
    const a = recordingNode("A", summary("success", "pa"));
    const c = recordingNode("C", summary("success", "pc"));

    const result = await runGraph(
      spec(
        [a.node, { id: "B", cast: async () => summary("gate-failed") }, c.node, neverNode("D")],
        [edge("A", "B"), edge("A", "C"), edge("B", "D"), edge("C", "D")],
      ),
    );

    expect(c.calls).toEqual([{ A: "pa" }]); // C ran (depends only on A)
    expect(result.skipped.map((s) => s.id)).toEqual(["D"]); // D joins B → skipped
    expect(result.skipped[0]?.blockedBy).toContain("B");
    expect(result.halted).toBe(true);
    // The only sink (D) was skipped; C is interior (C→D), so the graph surfaces no leaf output.
    expect(result.produced.size).toBe(0);
  });

  test("success-but-no-`produced` halts downstream — distinct andon (mirrors runChain)", async () => {
    const result = await runGraph(
      spec([{ id: "A", cast: async () => summary("success", undefined) }, neverNode("B")], [edge("A", "B")]),
    );

    expect(result.skipped.map((s) => s.id)).toEqual(["B"]);
    expect(result.halted).toBe(true);
    expect(result.outcome).toBe("success"); // A succeeded — but cannot feed B
    expect(result.haltReason).toContain("no `produced`");
  });
});

describe("runGraph — purity, totality, determinism", () => {
  test("empty graph → vacuous success no-op", async () => {
    const result = await runGraph(spec([], []));
    expect(result.nodes.size).toBe(0);
    expect(result.skipped).toEqual([]);
    expect(result.outcome).toBe("success");
    expect(result.halted).toBe(false);
    expect(result.produced.size).toBe(0);
  });

  test("single source → its outcome + it is the sole sink", async () => {
    const result = await runGraph(spec([{ id: "A", cast: async () => summary("success", "pa") }], []));
    expect(result.outcome).toBe("success");
    expect(result.halted).toBe(false);
    expect(Object.fromEntries(result.produced)).toEqual({ A: "pa" });
  });

  test("CYCLIC spec → total refusal: nothing cast, every node skipped, non-success terminal", async () => {
    // neverNode throws if cast — so this passing proves runGraph casts NOTHING on a cycle (no hang).
    const result = await runGraph(spec([neverNode("A"), neverNode("B")], [edge("A", "B"), edge("B", "A")]));

    expect(result.nodes.size).toBe(0); // nothing cast
    expect(result.skipped.map((s) => s.id).sort()).toEqual(["A", "B"]);
    expect(result.halted).toBe(true);
    expect(result.outcome).toBe("gate-failed");
    expect(result.haltReason).toContain("cyclic");
    expect(result.produced.size).toBe(0);
  });

  test("deterministic: fan-out sink order follows declaration order (topoSort tie-break)", async () => {
    const mk = (id: string) => ({ id, cast: async () => summary("success", `p${id}`) });
    const result = await runGraph(spec([mk("A"), mk("B"), mk("C")], [edge("A", "B"), edge("A", "C")]));
    // B declared before C → B's leaf precedes C's in the produced map's insertion order.
    expect([...result.produced.keys()]).toEqual(["B", "C"]);
  });
});
