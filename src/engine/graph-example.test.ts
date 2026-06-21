import { describe, expect, test } from "bun:test";
import type { RunOutcome } from "../log/run-log.ts";
import type { RunSummary } from "./cast.ts";
import { runGraph } from "./graph-core.ts";
import { runChain, type ChainStep } from "./chain-core.ts";
import type { DagSpec, NodeUpstreams } from "./dag-core.ts";
import { runDiamondExample, runSharedWalletFanout, runPerNodeFanout, runBranchingExample, branchingExample } from "./graph-example.ts";

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

// T-048-02 (E-048) — the SHARED-WALLET worked example. We drive the REAL pure budgeted wave dispatcher
// (`runGraphConcurrent`, in graph-core.ts) with COSTED stubs — still no `castPlay`, no native addon,
// nothing spawned. The shape mirrors fails-vs-linear above: a fan-out the shared wallet stops which the
// old per-node budgets would have OVERSPENT. NO LIVE MODEL.
describe("AC#3 (E-048): one shared wallet stops a fan-out the per-node budgets would overspend", () => {
  test("shared wallet: the overflowing branch is budget-stopped at the wave boundary, spend bounded", async () => {
    const { result, funded } = await runSharedWalletFanout();

    // A and B cast; C never ran — it was hard-stopped when the wave {B,C} could not collectively afford.
    expect([...result.nodes.keys()].sort()).toEqual(["A", "B"]);
    expect(result.nodes.has("C")).toBe(false);

    // C appears in `skipped` with a BUDGET reason (a clean wave-boundary halt, not an upstream failure).
    const c = result.skipped.find((s) => s.id === "C");
    expect(c).toBeDefined();
    expect(c?.reason).toMatch(/budget-stopped/);

    // A clean refusal (IA-9): halted true, but the OUTCOME is success — no cast failed.
    expect(result.halted).toBe(true);
    expect(result.outcome).toBe("success");

    // The readout: remaining = funded − (A debit 40k/30k) − (B debit 40k/20k). Tokens SUM (80k spent),
    // wall-clock MAX per wave (A wave 30k, B wave 20k → 50k spent). C's 40k tokens were NEVER charged.
    expect(result.walletRemaining).toEqual({ tokens: 10_000, timeMs: 10_000 });

    // Total debited == bounded envelope: spent ≤ funded on BOTH denominations (P7 held under concurrency).
    const spent = {
      tokens: funded.tokens - (result.walletRemaining?.tokens ?? 0),
      timeMs: funded.timeMs - (result.walletRemaining?.timeMs ?? 0),
    };
    expect(spent).toEqual({ tokens: 80_000, timeMs: 50_000 });
    expect(spent.tokens).toBeLessThanOrEqual(funded.tokens);
    expect(spent.timeMs).toBeLessThanOrEqual(funded.timeMs);
  });

  test("per-node (legacy, no wallet): the SAME fan-out dispatches both branches and OVERSPENDS", async () => {
    const { result, totalSpent } = await runPerNodeFanout();

    // All three nodes cast — no authorization gate, nothing stopped.
    expect([...result.nodes.keys()].sort()).toEqual(["A", "B", "C"]);
    expect(result.skipped).toEqual([]);

    // The legacy path threads no wallet, so there is no readout.
    expect(result.walletRemaining).toBeUndefined();

    // Summed real burn = A(40k) + B(40k) + C(40k) = 120k tokens — over the 90k envelope the shared
    // wallet enforced. This is the cross-branch leak E-048 fixes.
    expect(totalSpent.tokens).toBe(120_000);
    expect(totalSpent.tokens).toBeGreaterThan(90_000);
  });

  test("side by side: the shared wallet bounds spend to the envelope; per-node breaches it", async () => {
    const shared = await runSharedWalletFanout();
    const perNode = await runPerNodeFanout();

    const sharedTokens = shared.funded.tokens - (shared.result.walletRemaining?.tokens ?? 0);
    const envelope = shared.funded.tokens; // 90_000

    expect(sharedTokens).toBeLessThanOrEqual(envelope); // shared: 80k ≤ 90k — inside the wall
    expect(perNode.totalSpent.tokens).toBeGreaterThan(envelope); // per-node: 120k > 90k — overspent
    expect(sharedTokens).toBeLessThan(perNode.totalSpent.tokens); // the wall saved 40k of tokens
  });
});

// T-049-03 (E-049) — the CONDITIONAL-EDGE worked example. We drive the REAL pure dispatcher
// (`runGraphConcurrent`, in graph-core.ts) — the one the impure `castGraph` delegates to, and which it
// hands the caller's `edges` (every `when` included) straight through — with recording stubs: no
// `castPlay`, no native addon, nothing spawned. So this proves the author path end-to-end (declare the
// branch once on the edge; the not-taken subgraph is an observable skip) without value-importing
// graph.ts. The reasons asserted below are the SAME contract T-049-01/02 pinned. NO LIVE MODEL.
describe("AC (E-049): an authored edge predicate routes the branch; the not-taken subgraph skips", () => {
  test('route "go": R→T fires; R→N does not — T,TD run, N AND its subgraph ND skip', async () => {
    const { upstreamsSeen, result } = await runBranchingExample("go");

    // Only the taken path cast — R, then T, then T's downstream TD. The not-taken handlers never ran.
    expect([...result.nodes.keys()].sort()).toEqual(["R", "T", "TD"]);
    expect(result.nodes.has("N")).toBe(false);
    expect(result.nodes.has("ND")).toBe(false);

    // The ROUTED data reached the taken branch: T saw R's produced ("go"); TD saw T's. The not-taken
    // nodes are `undefined` — never cast (the observable skip, distinct from a cast with empty upstreams).
    expect(upstreamsSeen.R).toEqual({}); // source — empty upstream map
    expect(upstreamsSeen.T).toEqual({ R: "go" });
    expect(upstreamsSeen.TD).toEqual({ T: "pt" });
    expect(upstreamsSeen.N).toBeUndefined();
    expect(upstreamsSeen.ND).toBeUndefined();

    // The not-taken branch AND its dependent subgraph are observable skips, with the DISTINCT andons.
    expect(result.skipped.map((s) => s.id).sort()).toEqual(["N", "ND"]);
    const n = result.skipped.find((s) => s.id === "N");
    const nd = result.skipped.find((s) => s.id === "ND");
    // N: a BRANCH-NOT-TAKEN (its edge's predicate rejected R's produced) — textually distinct from halt.
    expect(n?.reason).toMatch(/branch not taken/);
    expect(n?.reason).not.toMatch(/dependent on halted upstream/);
    expect(n?.blockedBy).toEqual(["R"]);
    // ND: the cascade — the not-taken skip propagates through the SAME `dependent on halted upstream`
    // machinery (reuse, not reinvent). The whole not-taken subgraph is accounted for, never dropped.
    expect(nd?.reason).toMatch(/dependent on halted upstream/);

    // A clean route is a SUCCESS (no cast failed) that nonetheless halted a subgraph (the not-taken one).
    expect(result.outcome).toBe("success");
    expect(result.halted).toBe(true);

    // The graph's net output is the taken branch's sink only — the not-taken sink never produced.
    expect(Object.fromEntries(result.produced)).toEqual({ TD: "ptd" });
  });

  test('route "stop": the mirror image — N,ND run, T AND its subgraph TD skip', async () => {
    const { upstreamsSeen, result } = await runBranchingExample("stop");

    // The SAME declared graph now routes the other way, by data alone.
    expect([...result.nodes.keys()].sort()).toEqual(["N", "ND", "R"]);
    expect(result.nodes.has("T")).toBe(false);
    expect(result.nodes.has("TD")).toBe(false);

    expect(upstreamsSeen.N).toEqual({ R: "stop" });
    expect(upstreamsSeen.ND).toEqual({ N: "pn" });
    expect(upstreamsSeen.T).toBeUndefined();
    expect(upstreamsSeen.TD).toBeUndefined();

    expect(result.skipped.map((s) => s.id).sort()).toEqual(["T", "TD"]);
    const t = result.skipped.find((s) => s.id === "T");
    const td = result.skipped.find((s) => s.id === "TD");
    expect(t?.reason).toMatch(/branch not taken/);
    expect(t?.reason).not.toMatch(/dependent on halted upstream/);
    expect(td?.reason).toMatch(/dependent on halted upstream/);

    expect(result.outcome).toBe("success");
    expect(result.halted).toBe(true);
    expect(Object.fromEntries(result.produced)).toEqual({ ND: "pnd" });
  });

  test("both routes are ONE declared graph — only R's produced data differs (declare once, route by data)", () => {
    // The edge TOPOLOGY (from/to) is identical across routes; the predicate is a pure read over R's
    // produced. The author wired the branch ONCE — the run-time signal selects it, not a different graph.
    const topology = (route: "go" | "stop") =>
      branchingExample(route).spec.edges.map((e) => ({ from: e.from, to: e.to }));

    expect(topology("go")).toEqual(topology("stop"));
    expect(topology("go")).toEqual([
      { from: "R", to: "T" },
      { from: "R", to: "N" },
      { from: "T", to: "TD" },
      { from: "N", to: "ND" },
    ]);
  });
});
