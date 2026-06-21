import { describe, expect, test } from "bun:test";
import type { RunOutcome } from "../log/run-log.ts";
import type { RunSummary } from "./cast.ts";
import { runGraph } from "./graph-core.ts";
import { runChain, type ChainStep } from "./chain-core.ts";
import type { DagSpec, NodeUpstreams } from "./dag-core.ts";
import { runDiamondExample } from "./graph-example.ts";

// T-046-03 — the DETERMINISTIC worked example (AC#2) + the fails-vs-linear proof (AC#3). We import
// ONLY the pure cores (`runGraph`, `runChain`) + the stub example (both type-only-import the impure
// cast.ts), so this `bun test` loads no native addon and spawns NOTHING. `castGraph` (graph.ts) is
// the impure shell and is NOT exercised here — by design it value-imports `castPlay`, so importing it
// would spawn (the chain.ts discipline). Its concurrent join/fan-out/halt semantics ARE the ones
// `runGraph` is proven on; the diamond below pins them. NO LIVE MODEL.

function summary(outcome: RunOutcome, produced?: string): RunSummary {
  return { runId: `run-${outcome}`, outcome, materialized: outcome === "success", produced };
}

describe("worked example (AC#2): a diamond with fan-out + join runs end-to-end", () => {
  test("all four nodes run; B and C are parallel branches off A; D JOINS both upstreams", async () => {
    const { upstreamsSeen, result } = await runDiamondExample();

    // All four nodes cast — the graph ran to completion.
    expect(result.nodes.size).toBe(4);
    expect(result.halted).toBe(false);
    expect(result.outcome).toBe("success");

    // FAN-OUT: A's `produced` reached BOTH downstream branches (B and C ran off the same A output).
    expect(upstreamsSeen.A).toEqual({}); // source — empty upstream map
    expect(upstreamsSeen.B).toEqual({ A: "pa" });
    expect(upstreamsSeen.C).toEqual({ A: "pa" });

    // JOIN: D — the convergence node — received BOTH B's and C's `produced`, keyed by from-node.
    expect(upstreamsSeen.D).toEqual({ B: "pb", C: "pc" });

    // The diamond's sole sink is D; its `produced` is the graph's net output.
    expect(Object.fromEntries(result.produced)).toEqual({ D: "pd" });
  });
});

describe("fails-vs-linear (AC#3): the 2-upstream join is inexpressible by runChain/ChainStep[]", () => {
  // The SAME four-node diamond. `runGraph` converges the join (D sees two upstreams). No `ChainStep[]`
  // linearization can: `runChain` threads a SINGLE `produced` string into the next step, so D's step
  // receives exactly ONE upstream ref — it structurally cannot carry both B's and C's `produced`.

  const diamondSpec = (recordD: (u: NodeUpstreams) => void): DagSpec => ({
    nodes: [
      { id: "A", cast: async () => summary("success", "pa") },
      { id: "B", cast: async () => summary("success", "pb") },
      { id: "C", cast: async () => summary("success", "pc") },
      {
        id: "D",
        cast: async (u: NodeUpstreams) => {
          recordD(u);
          return summary("success", "pd");
        },
      },
    ],
    edges: [
      { from: "A", to: "B" },
      { from: "A", to: "C" },
      { from: "B", to: "D" },
      { from: "C", to: "D" },
    ],
  });

  test("runGraph CONVERGES the join: D receives BOTH B's and C's produced", async () => {
    let dJoin: Record<string, string> = {};
    await runGraph(diamondSpec((u) => (dJoin = Object.fromEntries(u))));

    expect(dJoin).toEqual({ B: "pb", C: "pc" }); // two upstreams into one node
    expect(Object.keys(dJoin).length).toBe(2);
  });

  test("runChain CANNOT: over any linearization [A,B,C,D], D's step gets a SINGLE upstream string", async () => {
    // The only faithful topological linearizations of the diamond are A,B,C,D and A,C,B,D — both
    // place D last with a single immediately-prior step. Each step records the lone `upstream` it saw.
    const seen: (string | undefined)[] = [];
    const linearStep = (produced: string): ChainStep => ({
      cast: async (upstream) => {
        seen.push(upstream);
        return summary("success", produced);
      },
    });

    const result = await runChain([linearStep("pa"), linearStep("pb"), linearStep("pc"), linearStep("pd")]);

    // runChain threads the PREVIOUS step's produced only: A→undefined, B→"pa", C→"pb", D→"pc".
    expect(seen).toEqual([undefined, "pa", "pb", "pc"]);

    // D's step (the join in the diamond) received exactly ONE ref — a lone string, never a 2-entry
    // map. It is structurally impossible for `runChain` to feed D both B's ("pb") and C's ("pc").
    const dUpstream = seen[3];
    expect(typeof dUpstream).toBe("string"); // a single value, not a join map
    expect(dUpstream).toBe("pc"); // only the immediately-prior step's output
    expect(dUpstream).not.toBe("pb"); // B's contribution is dropped by the linearization
    expect(result.outcome).toBe("success");
  });

  test("the contrast, side by side: runGraph delivers a 2-entry join; runChain delivers 1 thread", async () => {
    let graphJoinSize = 0;
    await runGraph(diamondSpec((u) => (graphJoinSize = u.size)));

    const chainThread: (string | undefined)[] = [];
    const step = (p: string): ChainStep => ({
      cast: async (upstream) => {
        chainThread.push(upstream);
        return summary("success", p);
      },
    });
    await runChain([step("pa"), step("pb"), step("pc"), step("pd")]);

    expect(graphJoinSize).toBe(2); // runGraph: D ← {B, C}
    // The chain never threads more than one ref into any step — its "join" capacity is exactly 1.
    const maxRefsIntoAnyStep = Math.max(...chainThread.map((u) => (u === undefined ? 0 : 1)));
    expect(maxRefsIntoAnyStep).toBe(1); // runChain: at most ONE upstream per step — no join
    expect(graphJoinSize).toBeGreaterThan(maxRefsIntoAnyStep); // genuinely non-linear
  });
});
