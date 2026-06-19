import { describe, expect, test } from "bun:test";
import { buildGraph, type RawNode, type WorkGraph } from "../graph/model.ts";
import { loadWorkGraph } from "../graph/load.ts";
import { DESIGNER_PRESET, type PresentationSpec } from "./spec.ts";
import { projectGraph } from "./project.ts";

// T-021-05 — the PURE (graph, spec) → projection core, covered with a fabricated frozen graph (no
// fs) the spec.test.ts/model.test.ts mould, plus the AC's live-graph regroup block. The new layer
// composes projectNode (per-card) with grouping, color, and links.

// ── a small but real frozen WorkGraph: 2 epics → 3 stories → 5 tickets, one cross-story dep ───────
// Built via buildGraph (not a cast) so it is a genuine deeply-frozen graph, the load.test.ts idiom.

const raw = (file: string, data: Record<string, unknown>, body = ""): RawNode => ({ data, body, file });
const epic = (id: string): RawNode => raw(`${id}.md`, { id, title: `e-${id}`, status: "open", advances: ["P1"] });
const story = (id: string, tickets: string[]): RawNode =>
  raw(`${id}.md`, { id, title: `s-${id}`, type: "story", status: "open", priority: "high", tickets });
const ticket = (
  id: string,
  story: string,
  fields: { status?: string; phase?: string; priority?: string; depends_on?: string[] } = {},
): RawNode =>
  raw(`${id}.md`, {
    id,
    story,
    title: `t-${id}`,
    type: "task",
    status: fields.status ?? "open",
    priority: fields.priority ?? "high",
    phase: fields.phase ?? "ready",
    depends_on: fields.depends_on ?? [],
  });

function miniGraph(): WorkGraph {
  return buildGraph(
    [epic("E-001"), epic("E-002")],
    [story("S-001-01", ["T-001-01", "T-001-02"]), story("S-001-02", ["T-001-03"]), story("S-002-01", ["T-002-01", "T-002-02"])],
    [
      ticket("T-001-01", "S-001-01", { status: "done", phase: "done", priority: "high" }),
      ticket("T-001-02", "S-001-01", { status: "open", priority: "low" }),
      ticket("T-001-03", "S-001-02", { status: "in-progress", priority: "critical" }),
      // a cross-story dependency: T-002-01 depends on T-001-03
      ticket("T-002-01", "S-002-01", { status: "open", priority: "medium", depends_on: ["T-001-03"] }),
      ticket("T-002-02", "S-002-01", { status: "done", phase: "done", priority: "low" }),
    ],
  );
}

const withGroup = (g: PresentationSpec["groupBy"]): PresentationSpec => ({ ...DESIGNER_PRESET, groupBy: g });
const allCardIds = (p: ReturnType<typeof projectGraph>) =>
  p.groups.flatMap((grp) => grp.cards.map((c) => c.card.id)).sort();

describe("projectGraph — grouping (same graph, many renders)", () => {
  const graph = miniGraph();

  test("group_by epic → two groups keyed by epic id; every ticket placed once", () => {
    const p = projectGraph(graph, withGroup("epic"));
    expect(p.groups.map((g) => g.key)).toEqual(["E-001", "E-002"]);
    expect(p.groups.find((g) => g.key === "E-001")!.cards.map((c) => c.card.id)).toEqual([
      "T-001-01",
      "T-001-02",
      "T-001-03",
    ]);
    expect(allCardIds(p)).toEqual(["T-001-01", "T-001-02", "T-001-03", "T-002-01", "T-002-02"]);
  });

  test("group_by story → three groups keyed by storyId", () => {
    const p = projectGraph(graph, withGroup("story"));
    expect(p.groups.map((g) => g.key)).toEqual(["S-001-01", "S-001-02", "S-002-01"]);
    expect(p.groups[0]!.label).toBe("S S 001 01"); // humanized story title `s-S-001-01` → scrubbed
  });

  test("group_by status → ordered open → in_progress → done (natural reading order)", () => {
    const p = projectGraph(graph, withGroup("status"));
    expect(p.groups.map((g) => g.key)).toEqual(["open", "in_progress", "done"]);
    // the designer labels map the keys to display words
    expect(p.groups.find((g) => g.key === "done")!.label).toBe("Done");
  });

  test("group_by leverage → ordered critical → high → medium → low (the priority proxy)", () => {
    const p = projectGraph(graph, withGroup("leverage"));
    expect(p.groups.map((g) => g.key)).toEqual(["critical", "high", "medium", "low"]);
    expect(p.groups[0]!.label).toBe("Critical");
  });

  test("group_by role → a single honest 'all' group (no node-level role)", () => {
    const p = projectGraph(graph, withGroup("role"));
    expect(p.groups.map((g) => g.key)).toEqual(["all"]);
    expect(p.groups[0]!.label).toBe("All");
    expect(p.groups[0]!.cards).toHaveLength(5);
  });
});

describe("projectGraph — color tokens (semantic, not hex; design D3)", () => {
  const graph = miniGraph();

  test("color_language status → the state key; leverage → the priority; same card, two colors", () => {
    const byStatus = projectGraph(graph, { ...DESIGNER_PRESET, colorLanguage: "status" });
    const byLeverage = projectGraph(graph, { ...DESIGNER_PRESET, colorLanguage: "leverage" });
    const find = (p: ReturnType<typeof projectGraph>, id: string) =>
      p.groups.flatMap((g) => g.cards).find((c) => c.card.id === id)!;
    expect(find(byStatus, "T-001-01").color).toBe("done");
    expect(find(byLeverage, "T-001-01").color).toBe("high");
  });

  test("color_language role → a single 'default' token", () => {
    const p = projectGraph(graph, { ...DESIGNER_PRESET, colorLanguage: "role" });
    expect(p.groups.flatMap((g) => g.cards).every((c) => c.color === "default")).toBe(true);
  });
});

describe("projectGraph — links (depends_on → edges; design D4)", () => {
  const graph = miniGraph();
  const p = projectGraph(graph, DESIGNER_PRESET);

  test("the one cross-story depends_on edge appears once, (from→to)-correct", () => {
    expect(p.links).toEqual([{ from: "T-002-01", to: "T-001-03", kind: "depends_on" }]);
  });

  test("blocks is NOT double-emitted as a reverse link", () => {
    expect(p.links.some((l) => l.from === "T-001-03")).toBe(false);
  });
});

describe("projectGraph — overlays thread through to projectNode", () => {
  const graph = miniGraph();

  test("an authored why for one ticket lands on its face; others omit it (honest-empty)", () => {
    const p = projectGraph(graph, DESIGNER_PRESET, {
      "T-001-01": { why: "because it matters" },
    });
    const cards = p.groups.flatMap((g) => g.cards);
    expect(cards.find((c) => c.card.id === "T-001-01")!.card.face.why).toBe("because it matters");
    expect(cards.find((c) => c.card.id === "T-001-02")!.card.face.why).toBeUndefined();
  });
});

describe("projectGraph — purity & freeze (the read-only idiom)", () => {
  test("the projection is deeply frozen", () => {
    const p = projectGraph(miniGraph(), DESIGNER_PRESET);
    expect(Object.isFrozen(p)).toBe(true);
    expect(Object.isFrozen(p.groups)).toBe(true);
    expect(() => {
      (p.groups as unknown as unknown[]).push({} as never);
    }).toThrow();
  });

  test("same graph + same spec → identical projection (determinism / P5)", () => {
    const graph = miniGraph();
    expect(projectGraph(graph, DESIGNER_PRESET)).toEqual(projectGraph(graph, DESIGNER_PRESET));
  });
});

// ── the AC contract: live graph, two specs differing only in group_by, graph reference-unchanged ──

describe("T-021-05 — the AC contract (live graph)", () => {
  test("regroups under epic vs story while the graph object stays reference-unchanged", async () => {
    const graph = await loadWorkGraph();
    expect(graph.tickets.length).toBeGreaterThan(0);

    const ticketsRefBefore = graph.tickets;
    const byEpic = projectGraph(graph, withGroup("epic"));
    const byStory = projectGraph(graph, withGroup("story"));

    // (a) the projection regroups: the two axes partition into different group key-sets.
    const epicKeys = byEpic.groups.map((g) => g.key);
    const storyKeys = byStory.groups.map((g) => g.key);
    expect(epicKeys).not.toEqual(storyKeys);
    // both projections cover the SAME ticket set (only the grouping changed).
    expect(allCardIds(byEpic)).toEqual(allCardIds(byStory));

    // (b) the underlying graph object is reference-unchanged (E-021 one-way authority).
    expect(graph.tickets).toBe(ticketsRefBefore);
    expect(Object.isFrozen(graph)).toBe(true);

    // (c) a re-projection under the same spec is identical (same inputs → identical projection).
    expect(projectGraph(graph, withGroup("epic"))).toEqual(byEpic);
  });
});
