import { describe, expect, test } from "bun:test";
import { buildGraph, type RawNode, type WorkGraph } from "../graph/model.ts";
import { DESIGNER_PRESET } from "../present/spec.ts";
import { projectGraph, type Projection, type ProjectedCard } from "../present/project.ts";
import { renderPaper } from "../present/paper.ts";
import { RUBRIC_DIMENSIONS, scoreDesignerRubric, formatScorecard, type DimensionScore } from "./rubric.ts";

// T-021-09 — the 'GOOD ENOUGH' RUBRIC SCORECARD pure core (a probe over the rendered designer
// preset). Pure tests over fabricated frozen graphs (the paper.test.ts / project.test.ts mould),
// the AC's mechanical-language teeth (a jargon token on a face → the language dimension fails),
// and the IA-4 vacuous-pass + P5 determinism discipline.

// ── fixtures: genuine frozen graphs via buildGraph (mirrors paper.test.ts) ────────────────────────

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

// 2 epics → 3 stories → 5 tickets, one cross-story dep, mixed states (the paper.test.ts graph).
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

const emptyGraph = (): WorkGraph => buildGraph([], [], []);

const dimOf = (card: { dimensions: readonly DimensionScore[] }, name: string): DimensionScore =>
  card.dimensions.find((d) => d.dimension === name)!;

/** A hand-built one-card projection — lets a test plant a face directly (bypassing scrubFace),
 *  the only way to exercise the language gate's failure branch (a real render never leaks). */
function oneCardProjection(face: Record<string, string>): Projection {
  const pc: ProjectedCard = { card: { id: "T-009-01", kind: "ticket", face, details: {} }, color: "open" } as ProjectedCard;
  return {
    groupBy: "story",
    density: "low",
    colorLanguage: "leverage",
    metaphor: "tree",
    groups: [{ key: "S-009-01", label: "Story nine", cards: [pc] }],
    links: [],
  } as Projection;
}

// ── the happy path over a real designer render ────────────────────────────────────────────────────

describe("scoreDesignerRubric — a clean designer render", () => {
  test("carries all five dimensions in order and passes (good enough)", () => {
    const graph = miniGraph();
    const projection = projectGraph(graph, DESIGNER_PRESET);
    const render = renderPaper(graph, DESIGNER_PRESET);
    const card = scoreDesignerRubric(render, projection);

    expect(card.dimensions.map((d) => d.dimension)).toEqual([...RUBRIC_DIMENSIONS]);
    expect(dimOf(card, "language").pass).toBe(true); // the renderer scrubs → no face jargon
    expect(card.pass).toBe(true);
  });
});

// ── the AC's teeth: language fails on any untranslated-jargon token on a face ──────────────────────

describe("language dimension — the AC's mechanical gate", () => {
  test("fails on a charter code planted on a face, naming the token and failing the card", () => {
    const projection = oneCardProjection({ plainTitle: "Ship the PE-1 thing", state: "To do" });
    const card = scoreDesignerRubric("## Designer view\n## Card faces\n## Founder/director view", projection);
    const language = dimOf(card, "language");
    expect(language.pass).toBe(false);
    expect(language.failures.join(" ")).toContain("PE-1");
    expect(card.pass).toBe(false); // the gate sinks the whole scorecard
  });

  test("fails on a file-path cite planted on a face", () => {
    const projection = oneCardProjection({ plainTitle: "wire survey-core.ts", state: "To do" });
    expect(dimOf(scoreDesignerRubric("Designer view Card faces Founder/director view", projection), "language").pass).toBe(false);
  });

  test("a clean planted face passes the language gate", () => {
    const projection = oneCardProjection({ plainTitle: "Ship the thing", state: "To do" });
    expect(dimOf(scoreDesignerRubric("Designer view Card faces Founder/director view", projection), "language").pass).toBe(true);
  });
});

// ── the other four dimensions ─────────────────────────────────────────────────────────────────────

describe("comprehension / density / structure / navigability", () => {
  test("comprehension fails when a face lacks a state chip", () => {
    const projection = oneCardProjection({ plainTitle: "A clear title" }); // no state
    const c = dimOf(scoreDesignerRubric("Designer view Card faces Founder/director view", projection), "comprehension");
    expect(c.pass).toBe(false);
    expect(c.failures.join(" ")).toContain("state");
  });

  test("density fails when a low-density face exceeds its char budget", () => {
    const projection = oneCardProjection({ plainTitle: "x".repeat(300), state: "To do" });
    expect(dimOf(scoreDesignerRubric("Designer view Card faces Founder/director view", projection), "density").pass).toBe(false);
  });

  test("structure fails when the render carries no decomposition tree", () => {
    const graph = miniGraph();
    const projection = projectGraph(graph, DESIGNER_PRESET);
    const noTree = "Designer view Card faces Founder/director view"; // no ```mermaid / graph TD
    expect(dimOf(scoreDesignerRubric(noTree, projection), "structure").pass).toBe(false);
  });

  test("navigability fails on a missing section heading", () => {
    const graph = miniGraph();
    const projection = projectGraph(graph, DESIGNER_PRESET);
    const render = renderPaper(graph, DESIGNER_PRESET).replace("Founder/director view", "Founder brief");
    const n = dimOf(scoreDesignerRubric(render, projection), "navigability");
    expect(n.pass).toBe(false);
    expect(n.failures.join(" ")).toContain("Founder/director view");
  });
});

// ── IA-4 vacuous pass + P5 determinism + the formatter ────────────────────────────────────────────

describe("honest-empty (IA-4) and determinism (P5)", () => {
  test("an empty board is a vacuous pass throughout — score 1, never NaN", () => {
    const graph = emptyGraph();
    const card = scoreDesignerRubric(renderPaper(graph, DESIGNER_PRESET), projectGraph(graph, DESIGNER_PRESET));
    expect(card.pass).toBe(true);
    for (const d of card.dimensions) {
      expect(d.pass).toBe(true);
      expect(Number.isNaN(d.score)).toBe(false);
      expect(d.score).toBe(1);
    }
  });

  test("deterministic: same inputs → identical formatted scorecard", () => {
    const graph = miniGraph();
    const projection = projectGraph(graph, DESIGNER_PRESET);
    const render = renderPaper(graph, DESIGNER_PRESET);
    expect(formatScorecard(scoreDesignerRubric(render, projection))).toBe(
      formatScorecard(scoreDesignerRubric(render, projection)),
    );
  });

  test("formatScorecard leads with the good-enough verdict and one line per dimension", () => {
    const graph = miniGraph();
    const out = formatScorecard(scoreDesignerRubric(renderPaper(graph, DESIGNER_PRESET), projectGraph(graph, DESIGNER_PRESET)));
    expect(out).toContain("good enough:");
    for (const dim of RUBRIC_DIMENSIONS) expect(out).toContain(dim);
  });
});
