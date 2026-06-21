import { describe, expect, test } from "bun:test";
import { RUN_OUTCOMES, type RunOutcome } from "../log/run-log.ts";
import type { RunSummary } from "./cast.ts";
import { erroredSummary, NODE_ERRORED, runGraph, runGraphConcurrent, type GraphResult } from "./graph-core.ts";
import { decideThread } from "./chain-core.ts";
import { validateDag, type DagEdge, type DagNode, type DagSpec, type NodeUpstreams } from "./dag-core.ts";
import { allocate } from "../budget/wallet.ts";
import type { Budget } from "../budget/budget.ts";

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

// A node whose cast THROWS — the stimulus T-054-02's runners must ABSORB into an `errored`
// summary. UNLIKE `neverNode` (whose throw asserts it was NOT called), this throw is expected:
// the runner is required to catch it, not propagate it.
const throwingNode = (id: string): DagNode => ({
  id,
  cast: async () => {
    throw new Error(`cast for '${id}' threw (T-054-02 stub)`);
  },
});

const edge = (from: string, to: string): DagEdge => ({ from, to });
const spec = (nodes: readonly DagNode[], edges: readonly DagEdge[]): DagSpec => ({ nodes, edges });

// T-054-01: the pure throw→errored routing primitive both runners will reuse (T-054-02). These are
// pure-function assertions — NO runner is invoked, NO live model, NO spawn — proving the errored
// summary is a marked, non-proceeding node and that the EXISTING decideThread gate refuses it.
describe("erroredSummary — the pure throw→errored primitive (T-054-01)", () => {
  test("yields outcome 'errored' with produced undefined (nothing landed, nothing to thread)", () => {
    const s = erroredSummary("X");
    expect(s.outcome).toBe("errored");
    expect(s.produced).toBeUndefined(); // a throw surfaced nothing threadable
    expect(s.materialized).toBe(false); // a throw landed no effect
    expect(s.actuals).toBeUndefined(); // a throw measured nothing ⇒ no phantom wallet charge
    expect(s.runId).toBe("errored:X"); // deterministic, non-empty, a pure fn of the node id
  });

  test("decideThread refuses it (proceed:false) — routes through the EXISTING halt path unchanged", () => {
    const decision = decideThread(erroredSummary("X"));
    expect(decision.proceed).toBe(false);
    // The reason takes the generic non-success branch (no new branch added to decideThread).
    expect(decision.reason).toContain("errored");
    expect(decision.reason).toContain("not success");
  });

  test("is deterministic — same id ⇒ byte-identical summary (the precondition T-054-03 leans on)", () => {
    expect(erroredSummary("X")).toEqual(erroredSummary("X"));
    expect(erroredSummary("A").runId).not.toBe(erroredSummary("B").runId); // distinct ids ⇒ distinct
  });

  test("NODE_ERRORED is a member of RUN_OUTCOMES (the constant and the tuple cannot drift)", () => {
    expect(NODE_ERRORED).toBe("errored");
    expect((RUN_OUTCOMES as readonly RunOutcome[]).includes(NODE_ERRORED)).toBe(true);
  });
});

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

describe("runGraph — conditional edges select the taken branch (E-049, T-049-01)", () => {
  // 1→{A,B} with MUTUALLY-EXCLUSIVE predicates over 1's produced. 1 produces "go-A", so the A-edge
  // fires and the B-edge does not — A runs, B is a branch-not-taken skip. `whenEq`/`whenNeq` are the
  // two out-edge predicates (a node's produced selects which downstream fires).
  const whenEq = (want: string): DagEdge["when"] => (p: string) => p === want;
  const whenNeq = (want: string): DagEdge["when"] => (p: string) => p !== want;

  function predicated() {
    const root = recordingNode("1", summary("success", "go-A"));
    const a = recordingNode("A", summary("success", "pa"));
    const b = recordingNode("B", summary("success", "pb"));
    const graph = spec(
      [root.node, a.node, b.node],
      [
        { from: "1", to: "A", when: whenEq("go-A") },
        { from: "1", to: "B", when: whenNeq("go-A") },
      ],
    );
    return { root, a, b, graph };
  }

  test("runs ONLY the matching branch; the not-taken node lands in `skipped`", async () => {
    const { root, a, b, graph } = predicated();
    const result = await runGraph(graph);

    expect(root.calls).toEqual([{}]); // source
    expect(a.calls).toEqual([{ "1": "go-A" }]); // predicate held → A cast with 1's produced
    expect(b.calls).toEqual([]); // predicate false → B NEVER cast
    expect(result.nodes.size).toBe(2); // only 1 and A cast
    expect(result.skipped.map((s) => s.id)).toEqual(["B"]);
    expect(Object.fromEntries(result.produced)).toEqual({ A: "pa" }); // only the taken leaf
    expect(result.outcome).toBe("success");
    expect(result.halted).toBe(true);
  });

  test("the not-taken reason reads 'branch not taken' — textually distinct from the halt andon", async () => {
    const { graph } = predicated();
    const result = await runGraph(graph);
    const skip = result.skipped.find((s) => s.id === "B");

    expect(skip?.reason).toContain("branch not taken");
    expect(skip?.reason).not.toContain("dependent on halted upstream");
    expect(skip?.blockedBy).toContain("1"); // the upstream whose edge predicate rejected its produced
  });

  test("validateDag still returns ok for the predicated spec (the predicate is ignored by validation)", () => {
    const { graph } = predicated();
    expect(validateDag(graph)).toEqual({ ok: true });
  });

  test("an edge with no predicate still fires unconditionally (back-compat)", async () => {
    const a = recordingNode("A", summary("success", "pa"));
    const b = recordingNode("B", summary("success", "pb"));
    const result = await runGraph(spec([a.node, b.node], [edge("A", "B")]));

    expect(b.calls).toEqual([{ A: "pa" }]); // unconditional edge → B ran, exactly as pre-E-049
    expect(result.halted).toBe(false);
    expect(Object.fromEntries(result.produced)).toEqual({ B: "pb" });
  });

  test("the not-taken branch cascade-skips its whole subgraph (reuses the halt machinery)", async () => {
    const root = recordingNode("1", summary("success", "go-A"));
    const a = recordingNode("A", summary("success", "pa"));
    // B is not taken; C depends on B (neverNode — throws if cast) → C cascade-skips via the EXISTING
    // dependent-on-halted-upstream path, proving the branch-not-taken reuse rather than reinvention.
    const result = await runGraph(
      spec(
        [root.node, a.node, neverNode("B"), neverNode("C")],
        [
          { from: "1", to: "A", when: whenEq("go-A") },
          { from: "1", to: "B", when: whenNeq("go-A") },
          edge("B", "C"),
        ],
      ),
    );

    expect(a.calls).toEqual([{ "1": "go-A" }]); // taken branch ran
    expect(result.skipped.map((s) => s.id)).toEqual(["B", "C"]); // the cascade
    expect(result.skipped.find((s) => s.id === "B")?.reason).toContain("branch not taken");
    expect(result.skipped.find((s) => s.id === "C")?.reason).toContain("dependent on halted upstream");
    expect(Object.fromEntries(result.produced)).toEqual({ A: "pa" }); // A is the only surviving leaf
  });
});

describe("runGraphConcurrent — conditional edges mirror runGraph (E-049, T-049-02)", () => {
  // The CONCURRENT wave dispatcher must fire predicate edges byte-for-byte as the sequential reference:
  // for the same predicated spec, the GraphResult's cast-node set, skipped ids+reasons, and produced map
  // must be IDENTICAL under both executors (the AC's definition of "equal"). `walletRemaining` is present
  // only on the budgeted concurrent path and absent on runGraph by design, so equality is asserted on the
  // facets below, not a naive deep-equal.
  const facets = (r: GraphResult) => ({
    cast: [...r.nodes.keys()].sort(),
    skipped: r.skipped.map((s) => ({ id: s.id, reason: s.reason, blockedBy: [...s.blockedBy] })),
    produced: Object.fromEntries(r.produced),
    outcome: r.outcome,
    halted: r.halted,
  });

  const whenEq = (want: string): DagEdge["when"] => (p: string) => p === want;
  const whenNeq = (want: string): DagEdge["when"] => (p: string) => p !== want;

  // A COSTED stub (mirrors graph-example.ts) — carries `actuals` so the shared wallet's debitWave folds a
  // real delta. tokens are carried as `input_tokens` so countTokens == that count.
  const costed = (id: string, produced: string, price: Budget): DagNode => ({
    id,
    cast: async () => ({
      runId: `run-${id}`,
      outcome: "success",
      materialized: true,
      produced,
      actuals: { usage: { input_tokens: price.tokens }, wallMs: price.timeMs },
    }),
  });

  test("AC fan-out: concurrent equals sequential for the predicated 1→{A,B}", async () => {
    // 1 produces "go-A": the A-edge fires, the B-edge is a branch-not-taken. Both executors agree.
    const mkSpec = () =>
      spec(
        [
          recordingNode("1", summary("success", "go-A")).node,
          recordingNode("A", summary("success", "pa")).node,
          recordingNode("B", summary("success", "pb")).node,
        ],
        [
          { from: "1", to: "A", when: whenEq("go-A") },
          { from: "1", to: "B", when: whenNeq("go-A") },
        ],
      );

    const seq = await runGraph(mkSpec());
    const con = await runGraphConcurrent(mkSpec());

    expect(facets(con)).toEqual(facets(seq)); // byte-for-byte identical
    expect(facets(con).cast).toEqual(["1", "A"]); // only the taken branch cast
    expect(Object.fromEntries(con.produced)).toEqual({ A: "pa" });
    expect(con.skipped.map((s) => s.id)).toEqual(["B"]);
    expect(con.skipped.find((s) => s.id === "B")?.reason).toContain("branch not taken");
  });

  test("multi-wave predicated branch with a cascade: concurrent equals sequential", async () => {
    // Waves: {1} → {A taken, B not-taken} → {C runs (A taken), D cascade-skips (B halted upstream)}.
    const mkSpec = () =>
      spec(
        [
          recordingNode("1", summary("success", "go-A")).node,
          recordingNode("A", summary("success", "pa")).node,
          neverNode("B"), // not taken — must never be cast
          recordingNode("C", summary("success", "pc")).node,
          neverNode("D"), // cascade-skipped below the not-taken B — must never be cast
        ],
        [
          { from: "1", to: "A", when: whenEq("go-A") },
          { from: "1", to: "B", when: whenNeq("go-A") },
          edge("A", "C"),
          edge("B", "D"),
        ],
      );

    const seq = await runGraph(mkSpec());
    const con = await runGraphConcurrent(mkSpec());

    expect(facets(con)).toEqual(facets(seq));
    expect(con.skipped.map((s) => s.id)).toEqual(["B", "D"]); // topo-ordered in both executors
    expect(con.skipped.find((s) => s.id === "B")?.reason).toContain("branch not taken");
    expect(con.skipped.find((s) => s.id === "D")?.reason).toContain("dependent on halted upstream");
    expect(Object.fromEntries(con.produced)).toEqual({ C: "pc" }); // C is the surviving leaf
  });

  test("branch-not-taken under a budgeted wallet: facets equal sequential; wallet untouched by the skip", async () => {
    // The predicated 1→{A,B} with COSTED nodes + a generously-funded shared wallet (nothing budget-stops,
    // so the ONLY skip is the predicate's not-taken — keeping facets equal to the unbudgeted sequential).
    const prices: Record<string, Budget> = {
      "1": { tokens: 10_000, timeMs: 5_000 },
      A: { tokens: 20_000, timeMs: 8_000 },
      B: { tokens: 20_000, timeMs: 8_000 },
    };
    const mkSpec = () =>
      spec(
        [costed("1", "go-A", prices["1"] as Budget), costed("A", "pa", prices.A as Budget), costed("B", "pb", prices.B as Budget)],
        [
          { from: "1", to: "A", when: whenEq("go-A") },
          { from: "1", to: "B", when: whenNeq("go-A") },
        ],
      );

    const seq = await runGraph(mkSpec());
    const wallet = allocate({ tokens: 200_000, timeMs: 100_000 }); // far above the taken path
    const priceOf = (id: string): Budget => (prices[id] as Budget) ?? { tokens: 0, timeMs: 0 };
    const con = await runGraphConcurrent(mkSpec(), { wallet, priceOf });

    expect(facets(con)).toEqual(facets(seq)); // predicate firing identical under the budgeted path
    expect(con.skipped.find((s) => s.id === "B")?.reason).toContain("branch not taken");
    // The not-taken B was never dispatched, so it never debited: remaining = funded − (1 + A) only.
    expect(con.walletRemaining).toEqual({
      tokens: 200_000 - prices["1"]!.tokens - prices.A!.tokens, // 170_000 — B's 20k never charged
      timeMs: 100_000 - Math.max(prices["1"]!.timeMs, 0) - prices.A!.timeMs, // single-node waves: MAX==that node
    });
  });

  test("back-compat: an un-predicated diamond is identical under both executors", async () => {
    const mkSpec = () =>
      spec(
        [
          recordingNode("A", summary("success", "pa")).node,
          recordingNode("B", summary("success", "pb")).node,
          recordingNode("C", summary("success", "pc")).node,
          recordingNode("D", summary("success", "pd")).node,
        ],
        [edge("A", "B"), edge("A", "C"), edge("B", "D"), edge("C", "D")],
      );

    const seq = await runGraph(mkSpec());
    const con = await runGraphConcurrent(mkSpec());

    expect(facets(con)).toEqual(facets(seq));
    expect(facets(con).skipped).toEqual([]); // no predicate → nothing not-taken, nothing halted
    expect(Object.fromEntries(con.produced)).toEqual({ D: "pd" });
  });
});

describe("a thrown cast becomes an 'errored' node, dependents skip, siblings survive (T-054-02)", () => {
  // ONE fan-out + cascade shape exercises all four AC clauses:
  //        A (source, success "pa")
  //       / \
  //   B(throws)  C (independent sibling, success "pc")
  //      |
  //      D (depends on B — neverNode: must NOT be cast; proves the cascade-skip)
  // A→B, A→C, B→D. Fresh nodes per call so seq/con runs never cross-contaminate recorded calls.
  const mkParts = () => {
    const a = recordingNode("A", summary("success", "pa"));
    const c = recordingNode("C", summary("success", "pc"));
    const graph = spec(
      [a.node, throwingNode("B"), c.node, neverNode("D")],
      [edge("A", "B"), edge("A", "C"), edge("B", "D")],
    );
    return { a, c, graph };
  };

  // The cross-executor projection (same as the E-049 block) — used for the de-risking parity check.
  const facets = (r: GraphResult) => ({
    cast: [...r.nodes.keys()].sort(),
    skipped: r.skipped.map((s) => ({ id: s.id, reason: s.reason, blockedBy: [...s.blockedBy] })),
    produced: Object.fromEntries(r.produced),
    outcome: r.outcome,
    halted: r.halted,
  });

  // The four AC clauses, asserted identically against either runner over a fresh spec.
  const assertAc = (r: GraphResult, c: ReturnType<typeof mkParts>["c"]) => {
    // AC#1 — the throwing node is an 'errored' entry in GraphResult.nodes (caught, not propagated).
    expect(r.nodes.get("B")?.outcome).toBe("errored");
    // AC#2 — its transitive dependent D landed in `skipped` with a reason naming the halted upstream.
    expect(r.nodes.has("D")).toBe(false); // D was never cast (neverNode would have thrown)
    const skipD = r.skipped.find((s) => s.id === "D");
    expect(skipD).toBeDefined();
    expect(skipD?.blockedBy).toContain("B");
    expect(skipD?.reason).toContain("halted upstream");
    expect(skipD?.reason).toContain("errored"); // the andon carries decideThread's non-success reason
    // AC#3 — the independent sibling C still completed, cast with its real JOIN map.
    expect(r.nodes.has("C")).toBe(true);
    expect(c.calls).toEqual([{ A: "pa" }]);
    // Terminal outcome is the errored summary (first non-success in topo order); the run halted.
    expect(r.outcome).toBe("errored");
    expect(r.halted).toBe(true);
    expect(Object.fromEntries(r.produced)).toEqual({ C: "pc" }); // only the surviving leaf
  };

  test("runGraph: throwing B → errored node, D skips, C survives, promise RESOLVES (never throws)", async () => {
    const { c, graph } = mkParts();
    // AC#4 — the `await` returning a GraphResult IS the proof the runner resolved, not rejected.
    const r = await runGraph(graph);
    assertAc(r, c);
  });

  test("runGraphConcurrent: same containment — the thrown thunk does not reject the Promise.all wave", async () => {
    const { c, graph } = mkParts();
    const r = await runGraphConcurrent(graph);
    assertAc(r, c);
  });

  test("runGraphConcurrent RESOLVES on a throw (AC#4 as a first-class property, not an incidental)", async () => {
    const { graph } = mkParts();
    // If the catch were placed outside the dispatch thunk, Promise.all would reject and this fails.
    await expect(runGraphConcurrent(graph)).resolves.toBeDefined();
  });

  test("both runners agree on the throwing spec (de-risks T-054-03's formal equivalence)", async () => {
    const seq = await runGraph(mkParts().graph);
    const con = await runGraphConcurrent(mkParts().graph);
    expect(facets(con)).toEqual(facets(seq));
    expect(facets(seq).cast).toEqual(["A", "B", "C"]); // A, the errored B, and the sibling C all cast
  });
});

// T-054-03 — the FORMAL dual-runner throw-equivalence proof, closing the last unbuilt graph
// primitive on the E-046 substrate. T-054-02 wired both runners to CATCH a thrown cast into the
// `errored` summary; this block proves the resulting GraphResult is IDENTICAL across the sequential
// `runGraph` and the concurrent `runGraphConcurrent` for a throwing-node + independent-sibling spec.
// Equivalence is exact (not merely structural) because `erroredSummary` is a PURE FUNCTION OF THE
// NODE ID (no clock, no random), so the same throwing spec yields a byte-identical summary under
// both runners. Pure-function tests: NO live model, NO spawn, stub throwing thunks only.
describe("dual-runner throw-equivalence — same GraphResult under runGraph & runGraphConcurrent (T-054-03)", () => {
  // The cross-executor projection (the established E-049 / T-054-02 idiom). It EXCLUDES
  // `walletRemaining` (present only on the budgeted concurrent path), so equality is asserted on the
  // facets the AC names — nodes (the cast keyset) / skipped / outcome / halted — plus `produced`.
  const facets = (r: GraphResult) => ({
    cast: [...r.nodes.keys()].sort(),
    skipped: r.skipped.map((s) => ({ id: s.id, reason: s.reason, blockedBy: [...s.blockedBy] })),
    produced: Object.fromEntries(r.produced),
    outcome: r.outcome,
    halted: r.halted,
  });

  // The throwing node + INDEPENDENT SIBLING shape the AC calls for (fresh nodes per call so the seq
  // and con runs never share recorded-call state):
  //        A (source, success "pa")
  //       / \
  //   B(throws)   C (independent sibling, success "pc")
  //      |
  //      D (depends on B — neverNode: must NOT be cast; proves the cascade-skip)
  const mkSpec = () =>
    spec(
      [recordingNode("A", summary("success", "pa")).node, throwingNode("B"), recordingNode("C", summary("success", "pc")).node, neverNode("D")],
      [edge("A", "B"), edge("A", "C"), edge("B", "D")],
    );

  test("the full GraphResult facets are byte-identical across both runners", async () => {
    const seq = await runGraph(mkSpec());
    const con = await runGraphConcurrent(mkSpec());

    expect(facets(con)).toEqual(facets(seq)); // the equivalence claim, whole projection at once
    expect(facets(seq).cast).toEqual(["A", "B", "C"]); // nodes facet: A, the errored B, and sibling C all cast
  });

  test("each AC-named facet agrees: nodes / skipped / outcome / halted", async () => {
    const seq = await runGraph(mkSpec());
    const con = await runGraphConcurrent(mkSpec());

    for (const r of [seq, con]) {
      // nodes — the throwing node is a caught `errored` entry; its dependent D was never cast.
      expect(r.nodes.get("B")?.outcome).toBe("errored");
      expect(r.nodes.has("D")).toBe(false);
      expect(r.nodes.has("C")).toBe(true); // the independent sibling completed
      // skipped — D landed in `skipped`, its reason naming the halted (errored) upstream B.
      const skipD = r.skipped.find((s) => s.id === "D");
      expect(skipD).toBeDefined();
      expect(skipD?.blockedBy).toContain("B");
      expect(skipD?.reason).toContain("halted upstream");
      expect(skipD?.reason).toContain("errored");
      // outcome — the errored summary is the first non-success in topo order.
      expect(r.outcome).toBe("errored");
      // halted — a dependent subgraph was skipped.
      expect(r.halted).toBe(true);
      // produced — only the surviving leaf C (D, the other sink, was skipped).
      expect(Object.fromEntries(r.produced)).toEqual({ C: "pc" });
    }
  });

  test("deterministic: repeated runs of each runner are byte-identical (erroredSummary purity, observed)", async () => {
    expect(facets(await runGraph(mkSpec()))).toEqual(facets(await runGraph(mkSpec())));
    expect(facets(await runGraphConcurrent(mkSpec()))).toEqual(facets(await runGraphConcurrent(mkSpec())));
  });

  // STRENGTHENING (beyond the AC): the equivalence still holds when the concurrent runner threads a
  // shared wallet (E-048). A thrown cast's `errored` summary carries `actuals === undefined`, so the
  // post-settle debit contributes {0,0} — the throw cannot over-charge the wallet, and the budgeted
  // facets stay identical to the unbudgeted sequential run. Mirrors the E-049 budgeted parity test.
  describe("under a budgeted concurrent wallet, the throw is still equivalent and charges nothing", () => {
    // A COSTED success stub (carries `actuals` so debitWave folds a real delta); tokens via input_tokens.
    const costed = (id: string, produced: string, price: Budget): DagNode => ({
      id,
      cast: async () => ({
        runId: `run-${id}`,
        outcome: "success",
        materialized: true,
        produced,
        actuals: { usage: { input_tokens: price.tokens }, wallMs: price.timeMs },
      }),
    });
    const prices: Record<string, Budget> = {
      A: { tokens: 10_000, timeMs: 5_000 },
      B: { tokens: 20_000, timeMs: 8_000 }, // B's PREDICTED price (authorization only — it throws, debiting {0,0})
      C: { tokens: 15_000, timeMs: 6_000 },
    };
    // Same shape as mkSpec, but A and C are costed and B throws. neverNode("D") proves the cascade-skip.
    const mkCostedSpec = () =>
      spec(
        [costed("A", "pa", prices.A as Budget), throwingNode("B"), costed("C", "pc", prices.C as Budget), neverNode("D")],
        [edge("A", "B"), edge("A", "C"), edge("B", "D")],
      );

    test("facets equal the sequential run; the throwing B debits nothing", async () => {
      const seq = await runGraph(mkCostedSpec());
      const wallet = allocate({ tokens: 200_000, timeMs: 100_000 }); // far above the surviving path
      const priceOf = (id: string): Budget => (prices[id] as Budget) ?? { tokens: 0, timeMs: 0 };
      const con = await runGraphConcurrent(mkCostedSpec(), { wallet, priceOf });

      expect(facets(con)).toEqual(facets(seq)); // throw equivalent even under the budgeted wave
      expect(con.nodes.get("B")?.outcome).toBe("errored");
      // Waves: {A} → {B throws, C} → {D skipped}. Debit is by ACTUALS: A then (B={0,0} ⊕ C), wall MAX
      // per wave. So remaining = funded − A − C; B's predicted 20k/8k never charged.
      expect(con.walletRemaining).toEqual({
        tokens: 200_000 - prices.A!.tokens - prices.C!.tokens, // 175_000 — B never debited
        timeMs: 100_000 - prices.A!.timeMs - prices.C!.timeMs, // 89_000 — wave-2 MAX(0, C) == C's time
      });
    });
  });
});
