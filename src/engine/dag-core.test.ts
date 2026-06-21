import { describe, expect, test } from "bun:test";
import type { RunSummary } from "./cast.ts";
import { topoSort, validateDag, type DagEdge, type DagNode, type DagSpec } from "./dag-core.ts";

// T-046-01 typed DAG model: the PURE shape + ordering core. We import ONLY ./dag-core.ts (which
// has a type-only `RunSummary` import) so this `bun test` process loads no native addon and spawns
// NOTHING — an ordinary pure-function test (the chain-core.test.ts discipline). T-046-01 never
// invokes a node's `cast`; the model owns SHAPE + ORDERING only, so the fake cast below is never
// called — it exists solely so a `DagNode` typechecks.

const neverCast = async (): Promise<RunSummary> => {
  throw new Error("a node's cast was invoked — T-046-01 owns shape + ordering only, it runs nothing");
};

const node = (id: string): DagNode => ({ id, cast: neverCast });
const edge = (from: string, to: string): DagEdge => ({ from, to });
const spec = (nodes: readonly DagNode[], edges: readonly DagEdge[]): DagSpec => ({ nodes, edges });

// Narrow a TopoResult to its order, asserting it sorted (no cycle).
function orderOf(spec: DagSpec): readonly string[] {
  const r = topoSort(spec);
  if ("cycle" in r) throw new Error(`expected an order, got a cycle: ${r.cycle.join(", ")}`);
  return r.order;
}

describe("topoSort — valid shapes (pure, deterministic, declaration-order tie-break)", () => {
  test("empty graph → a vacuous empty order", () => {
    expect(topoSort(spec([], []))).toEqual({ order: [] });
  });

  test("single node → its id", () => {
    expect(orderOf(spec([node("a")], []))).toEqual(["a"]);
  });

  test("linear path a→b→c → the unique chain order", () => {
    const s = spec([node("a"), node("b"), node("c")], [edge("a", "b"), edge("b", "c")]);
    expect(orderOf(s)).toEqual(["a", "b", "c"]);
  });

  test("fan-out a→{b,c} → root first, siblings in declaration order", () => {
    const s = spec([node("a"), node("b"), node("c")], [edge("a", "b"), edge("a", "c")]);
    const order = orderOf(s);
    expect(order[0]).toBe("a");
    expect(order).toEqual(["a", "b", "c"]); // b before c — declaration-order tie-break
  });

  test("join {a,b}→c → c is last", () => {
    const s = spec([node("a"), node("b"), node("c")], [edge("a", "c"), edge("b", "c")]);
    const order = orderOf(s);
    expect(order[order.length - 1]).toBe("c");
    expect(new Set(order)).toEqual(new Set(["a", "b", "c"]));
  });

  test("diamond a→{b,c}→d → a first, d last, b before c (stable)", () => {
    const s = spec(
      [node("a"), node("b"), node("c"), node("d")],
      [edge("a", "b"), edge("a", "c"), edge("b", "d"), edge("c", "d")],
    );
    const order = orderOf(s);
    expect(order[0]).toBe("a");
    expect(order[order.length - 1]).toBe("d");
    expect(order.indexOf("b")).toBeLessThan(order.indexOf("c"));
  });

  test("disconnected subgraphs → all nodes present, every dependency respected", () => {
    const s = spec(
      [node("a"), node("b"), node("x"), node("y")],
      [edge("a", "b"), edge("x", "y")],
    );
    const order = orderOf(s);
    expect(new Set(order)).toEqual(new Set(["a", "b", "x", "y"]));
    expect(order.indexOf("a")).toBeLessThan(order.indexOf("b"));
    expect(order.indexOf("x")).toBeLessThan(order.indexOf("y"));
  });
});

describe("topoSort — determinism", () => {
  test("the same fan-out spec sorted twice → byte-identical order", () => {
    const s = spec(
      [node("root"), node("c"), node("b"), node("a")],
      [edge("root", "a"), edge("root", "b"), edge("root", "c")],
    );
    const first = topoSort(s);
    const second = topoSort(s);
    expect(first).toEqual(second);
    // declaration-order tie-break: ready siblings emit as declared (c, b, a), not alphabetically
    expect(first).toEqual({ order: ["root", "c", "b", "a"] });
  });
});

describe("topoSort — cycles are detected + returned, never run/hung", () => {
  test("a 2-cycle a→b→a → { cycle } with both nodes, no order", () => {
    const r = topoSort(spec([node("a"), node("b")], [edge("a", "b"), edge("b", "a")]));
    expect("order" in r).toBe(false);
    if ("cycle" in r) expect(new Set(r.cycle)).toEqual(new Set(["a", "b"]));
  });

  test("a 3-cycle a→b→c→a → { cycle } with all three", () => {
    const r = topoSort(spec([node("a"), node("b"), node("c")], [edge("a", "b"), edge("b", "c"), edge("c", "a")]));
    expect("cycle" in r && new Set(r.cycle)).toEqual(new Set(["a", "b", "c"]));
  });

  test("a self-loop a→a → { cycle: [a] }", () => {
    expect(topoSort(spec([node("a")], [edge("a", "a")]))).toEqual({ cycle: ["a"] });
  });

  test("a cycle plus an acyclic tail → only the cyclic nodes are reported", () => {
    // a→b→a is a cycle; c→d is acyclic and emits fine; only a,b remain unemitted.
    const s = spec(
      [node("a"), node("b"), node("c"), node("d")],
      [edge("a", "b"), edge("b", "a"), edge("c", "d")],
    );
    const r = topoSort(s);
    expect("cycle" in r && new Set(r.cycle)).toEqual(new Set(["a", "b"]));
  });
});

describe("validateDag — clean graphs", () => {
  test("every valid shape (linear/fan-out/join/diamond/disconnected) → ok", () => {
    const shapes: DagSpec[] = [
      spec([node("a"), node("b")], [edge("a", "b")]),
      spec([node("a"), node("b"), node("c")], [edge("a", "b"), edge("a", "c")]),
      spec([node("a"), node("b"), node("c")], [edge("a", "c"), edge("b", "c")]),
      spec([node("a"), node("b"), node("c"), node("d")], [edge("a", "b"), edge("a", "c"), edge("b", "d"), edge("c", "d")]),
      spec([node("a"), node("b"), node("x"), node("y")], [edge("a", "b"), edge("x", "y")]),
    ];
    for (const s of shapes) expect(validateDag(s)).toEqual({ ok: true });
  });

  test("empty graph → ok (vacuous)", () => {
    expect(validateDag(spec([], []))).toEqual({ ok: true });
  });
});

describe("validateDag — distinct named offenses (total, accumulates all)", () => {
  test("dangling edge (unknown `to`) → one dangling-edge offense naming the missing id", () => {
    const r = validateDag(spec([node("a")], [edge("a", "ghost")]));
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.offenses).toHaveLength(1);
      expect(r.offenses[0]?.kind).toBe("dangling-edge");
      expect(r.offenses[0]?.nodes).toEqual(["ghost"]);
    }
  });

  test("duplicate node id → one duplicate-node offense naming the id", () => {
    const r = validateDag(spec([node("a"), node("a")], []));
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.offenses).toHaveLength(1);
      expect(r.offenses[0]?.kind).toBe("duplicate-node");
      expect(r.offenses[0]?.nodes).toEqual(["a"]);
    }
  });

  test("a cycle → one cycle offense naming the cyclic nodes", () => {
    const r = validateDag(spec([node("a"), node("b")], [edge("a", "b"), edge("b", "a")]));
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.offenses).toHaveLength(1);
      expect(r.offenses[0]?.kind).toBe("cycle");
      expect(new Set(r.offenses[0]?.nodes)).toEqual(new Set(["a", "b"]));
    }
  });

  test("multiple independent faults → multiple offenses (accumulation, not first-failure)", () => {
    // duplicate 'a' AND two dangling edges — the cycle check is suppressed (graph not sound), so
    // we expect exactly the structural offenses: 1 duplicate + 2 dangling.
    const s = spec([node("a"), node("a")], [edge("a", "ghost1"), edge("ghost2", "a")]);
    const r = validateDag(s);
    expect(r.ok).toBe(false);
    if (!r.ok) {
      const kinds = r.offenses.map((o) => o.kind).sort();
      expect(kinds).toEqual(["dangling-edge", "dangling-edge", "duplicate-node"]);
    }
  });
});
