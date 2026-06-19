import { describe, expect, test } from "bun:test";
import { buildGraph, type RawNode, type WorkGraph } from "../graph/model.ts";
import { loadWorkGraph } from "../graph/load.ts";
import { DESIGNER_PRESET } from "./spec.ts";
import { projectGraph } from "./project.ts";
import {
  mmLabel,
  rollUpState,
  sanitizeId,
  renderTree,
  renderFaces,
  renderFounderBrief,
  renderPaper,
} from "./paper.ts";

// T-021-06 — the PAPER RENDERER (Projection → Mermaid tree + faces + founder brief), the 4th leg of
// E-021's data/presentation split. Pure tests over fabricated frozen graphs (the project.test.ts
// mould) + the AC's live-board render. Honest-empty (IA-4) is exercised by a sparse and an empty graph.

// ── fixtures: genuine frozen graphs via buildGraph (not casts) ────────────────────────────────────

const raw = (file: string, data: Record<string, unknown>, body = ""): RawNode => ({ data, body, file });
const epic = (id: string): RawNode => raw(`${id}.md`, { id, title: `e-${id}`, status: "open", advances: ["P1"] });
const story = (id: string, tickets: string[], status = "open"): RawNode =>
  raw(`${id}.md`, { id, title: `s-${id}`, type: "story", status, priority: "high", tickets });
const ticket = (
  id: string,
  story: string,
  fields: { status?: string; phase?: string; priority?: string; depends_on?: string[]; body?: string } = {},
): RawNode =>
  raw(
    `${id}.md`,
    {
      id,
      story,
      title: `t-${id}`,
      type: "task",
      status: fields.status ?? "open",
      priority: fields.priority ?? "high",
      phase: fields.phase ?? "ready",
      depends_on: fields.depends_on ?? [],
    },
    fields.body ?? "",
  );

// 2 epics → 3 stories → 5 tickets, one cross-story dep, mixed states (mirrors project.test.ts).
function miniGraph(): WorkGraph {
  return buildGraph(
    [epic("E-001"), epic("E-002")],
    [story("S-001-01", ["T-001-01", "T-001-02"]), story("S-001-02", ["T-001-03"]), story("S-002-01", ["T-002-01", "T-002-02"])],
    [
      ticket("T-001-01", "S-001-01", { status: "done", phase: "done", body: "cites survey-core.ts and PE-1" }),
      ticket("T-001-02", "S-001-01", { status: "open", priority: "low" }),
      ticket("T-001-03", "S-001-02", { status: "in-progress", priority: "critical" }),
      ticket("T-002-01", "S-002-01", { status: "open", priority: "medium", depends_on: ["T-001-03"] }),
      ticket("T-002-02", "S-002-01", { status: "done", phase: "done", priority: "low" }),
    ],
  );
}

// An epic with no stories (E-009) and a story with no tickets (S-001-09) — the IA-4 branch.
function sparseGraph(): WorkGraph {
  return buildGraph(
    [epic("E-001"), epic("E-009")],
    [story("S-001-01", ["T-001-01"]), story("S-001-09", [])],
    [ticket("T-001-01", "S-001-01", { status: "done", phase: "done" })],
  );
}

const emptyGraph = (): WorkGraph => buildGraph([], [], []);

// ── pure helpers ──────────────────────────────────────────────────────────────────────────────────

describe("paper — pure helpers", () => {
  test("sanitizeId makes a Mermaid-safe node id", () => {
    expect(sanitizeId("T-021-06")).toBe("T_021_06");
    expect(sanitizeId("E-001")).toBe("E_001");
  });

  test("mmLabel wraps and escapes quotes/brackets/newlines", () => {
    expect(mmLabel('a "b" [c]\nd')).toBe('["a \'b\' (c) d"]');
  });

  test("rollUpState: any in_progress wins, else all-done → done, else open", () => {
    const g = (...colors: string[]) => ({ key: "k", label: "K", cards: colors.map((color) => ({ color })) }) as never;
    expect(rollUpState(g("done", "in_progress", "open"))).toBe("in_progress");
    expect(rollUpState(g("done", "done"))).toBe("done");
    expect(rollUpState(g("done", "open"))).toBe("open");
  });
});

// ── the tree ────────────────────────────────────────────────────────────────────────────────────

describe("renderTree — decomposition tree", () => {
  test("emits a fenced graph TD with classDefs and a root node", () => {
    const graph = miniGraph();
    const tree = renderTree(graph, projectGraph(graph, DESIGNER_PRESET));
    expect(tree).toContain("```mermaid");
    expect(tree).toContain("graph TD");
    expect(tree).toContain("classDef done");
    expect(tree).toContain("ROOT[");
  });

  test("every ticket appears as a sanitized node", () => {
    const graph = miniGraph();
    const tree = renderTree(graph, projectGraph(graph, DESIGNER_PRESET));
    for (const t of graph.tickets) expect(tree).toContain(sanitizeId(t.id));
  });

  test("an empty branch renders exactly 'nothing here', never a fabricated node (IA-4)", () => {
    const graph = sparseGraph();
    const tree = renderTree(graph, projectGraph(graph, DESIGNER_PRESET));
    // E-009 (no stories) and S-001-09 (no tickets) each yield one placeholder → two total.
    expect(tree.match(/nothing here/g)?.length).toBe(2);
    // the empty epic/story are present as container nodes, but no invented child id under them.
    expect(tree).toContain(sanitizeId("E-009"));
    expect(tree).toContain(sanitizeId("S-001-09"));
  });

  test("deterministic: same inputs → identical string (P5)", () => {
    const graph = miniGraph();
    expect(renderTree(graph, projectGraph(graph, DESIGNER_PRESET))).toBe(
      renderTree(graph, projectGraph(graph, DESIGNER_PRESET)),
    );
  });

  test("empty board → a single 'nothing here' under the root", () => {
    const graph = emptyGraph();
    const tree = renderTree(graph, projectGraph(graph, DESIGNER_PRESET));
    expect(tree.match(/nothing here/g)?.length).toBe(1);
  });
});

// ── faces ─────────────────────────────────────────────────────────────────────────────────────────

describe("renderFaces — card faces", () => {
  test("an authored why surfaces; a card without one omits it (honest-empty)", () => {
    const graph = miniGraph();
    const faces = renderFaces(projectGraph(graph, DESIGNER_PRESET, { "T-001-01": { why: "because it matters" } }));
    expect(faces).toContain("because it matters");
    // T-001-02 has no overlay why → no second *Why:* manufactured for it.
    expect(faces.match(/\*Why:\*/g)?.length).toBe(1);
  });

  test("no jargon leaks onto a face line (a charter code / file cite stays in details)", () => {
    const graph = miniGraph();
    const faces = renderFaces(projectGraph(graph, DESIGNER_PRESET));
    // the face title region must not carry the raw tokens from T-001-01's body.
    const faceLines = faces.split("\n").filter((l) => l.startsWith("> **"));
    expect(faceLines.join("\n")).not.toContain("survey-core.ts");
    expect(faceLines.join("\n")).not.toContain("PE-1");
  });

  test("empty projection → nothing here", () => {
    const graph = emptyGraph();
    expect(renderFaces(projectGraph(graph, DESIGNER_PRESET))).toContain("nothing here");
  });
});

// ── founder brief ─────────────────────────────────────────────────────────────────────────────────

describe("renderFounderBrief — collapsed themes table", () => {
  const founderSpec = { ...DESIGNER_PRESET, groupBy: "epic" as const, colorLanguage: "status" as const, preset: "custom" as const };

  test("one row per epic theme with a rolled-up state", () => {
    const graph = miniGraph();
    const brief = renderFounderBrief(projectGraph(graph, founderSpec));
    expect(brief).toContain("| Theme | State |");
    // E-001 has a done + open + in_progress ticket → In progress; E-002 has open + done → To do/open.
    expect(brief).toMatch(/In progress/);
  });

  test("narrative.decision is routed when given, omitted when absent (honest-empty)", () => {
    const graph = miniGraph();
    const p = projectGraph(graph, founderSpec);
    expect(renderFounderBrief(p, { decision: "ship it?" })).toContain("ship it?");
    expect(renderFounderBrief(p)).not.toContain("decision waiting");
  });

  test("empty projection → nothing here", () => {
    const graph = emptyGraph();
    expect(renderFounderBrief(projectGraph(graph, founderSpec))).toContain("nothing here");
  });
});

// ── the composer ─────────────────────────────────────────────────────────────────────────────────

describe("renderPaper — the full artifact", () => {
  test("contains the designer tree, faces, and the founder table", () => {
    const graph = miniGraph();
    const paper = renderPaper(graph, DESIGNER_PRESET);
    expect(paper).toContain("Designer view");
    expect(paper).toContain("```mermaid");
    expect(paper).toContain("Card faces");
    expect(paper).toContain("Founder/director view");
    expect(paper).toContain("| Theme | State |");
  });

  test("deterministic (P5)", () => {
    const graph = miniGraph();
    expect(renderPaper(graph, DESIGNER_PRESET)).toBe(renderPaper(graph, DESIGNER_PRESET));
  });
});

// ── the AC contract: render the live board; honest-empty; graph reference-unchanged ───────────────

describe("T-021-06 — AC (live board)", () => {
  test("renders a designer tree + faces and a founder brief; graph untouched", async () => {
    const graph = await loadWorkGraph();
    expect(graph.tickets.length).toBeGreaterThan(0);
    const ticketsRef = graph.tickets;

    const paper = renderPaper(graph, DESIGNER_PRESET);
    expect(paper).toContain("```mermaid");
    expect(paper).toContain("Designer view");
    expect(paper).toContain("Founder/director view");
    expect(paper).toMatch(/✅|🔄|⬜/); // at least one state chip rendered

    // one-way authority: the projection/render never touched the graph object.
    expect(graph.tickets).toBe(ticketsRef);
    expect(Object.isFrozen(graph)).toBe(true);
  });

  test("an honest-empty board renders 'nothing here' rather than fabricated nodes (IA-4)", () => {
    const paper = renderPaper(emptyGraph(), DESIGNER_PRESET);
    expect(paper).toContain("nothing here");
  });
});
