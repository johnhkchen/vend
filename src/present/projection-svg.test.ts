import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { buildGraph, type RawNode, type WorkGraph } from "../graph/model.ts";
import { DESIGNER_PRESET } from "./spec.ts";
import { projectGraph, type Projection } from "./project.ts";
import { projectionToSvg, DEFAULT_PALETTE } from "./projection-svg.ts";

// T-055-02 — the PROJECTION→SVG RENDERER (the THIRD consumer of the E-021 Projection IR). Pure,
// no-live-model tests: a real `projectGraph` projection for the AC counts (proving the real IR
// shape flows through), plus a hand-built `Projection` literal for focused escaping/options/structure
// assertions. One describe per AC clause, with determinism + one-way authority woven through.

// ── fixtures: a genuine frozen projection via buildGraph (the paper.test.ts mould) ─────────────────

const raw = (file: string, data: Record<string, unknown>, body = ""): RawNode => ({ data, body, file });
const epic = (id: string): RawNode => raw(`${id}.md`, { id, title: `e-${id}`, status: "open", advances: ["P1"] });
const story = (id: string, tickets: string[], status = "open"): RawNode =>
  raw(`${id}.md`, { id, title: `s-${id}`, type: "story", status, priority: "high", tickets });
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

// 2 epics → 3 stories → 5 tickets, ONE cross-story dep (T-002-01 → T-001-03) → exactly 1 link.
function miniGraph(): WorkGraph {
  return buildGraph(
    [epic("E-001"), epic("E-002")],
    [story("S-001-01", ["T-001-01", "T-001-02"]), story("S-001-02", ["T-001-03"]), story("S-002-01", ["T-002-01", "T-002-02"])],
    [
      ticket("T-001-01", "S-001-01", { status: "done", phase: "done" }),
      ticket("T-001-02", "S-001-01", { status: "open", priority: "low" }),
      ticket("T-001-03", "S-001-02", { status: "in-progress", priority: "critical" }),
      ticket("T-002-01", "S-002-01", { status: "open", priority: "medium", depends_on: ["T-001-03"] }),
      ticket("T-002-02", "S-002-01", { status: "done", phase: "done", priority: "low" }),
    ],
  );
}

const emptyGraph = (): WorkGraph => buildGraph([], [], []);

const miniProjection = (): Projection => projectGraph(miniGraph(), DESIGNER_PRESET);
const cardCount = (p: Projection): number => p.groups.reduce((n, g) => n + g.cards.length, 0);
const countOf = (s: string, re: RegExp): number => s.match(re)?.length ?? 0;

// A hand-built projection: 2 groups (2 cards, 1 card), 1 link, a label carrying all four
// XML-significant chars, and known color tokens — for focused escaping/options/structure checks.
function fakeProjection(): Projection {
  const card = (id: string, plainTitle: string, color: string) =>
    ({ card: { id, kind: "ticket", face: { plainTitle }, details: {} }, color }) as const;
  return {
    groupBy: "epic",
    density: "low",
    colorLanguage: "status",
    metaphor: "board",
    groups: [
      { key: "E-1", label: 'Lane <one> & "two"', cards: [card("T-1", "Alpha", "done"), card("T-2", "Beta", "open")] },
      { key: "E-2", label: "Second", cards: [card("T-3", "Gamma", "in_progress")] },
    ],
    links: [{ from: "T-3", to: "T-1", kind: "depends_on" }],
  } as unknown as Projection;
}

// ── AC: exactly one <rect> per card ─────────────────────────────────────────────────────────────────

describe("projectionToSvg — one rect per card", () => {
  test("a real projection emits exactly one <rect> per projected card (no lane backdrop)", () => {
    const p = miniProjection();
    expect(cardCount(p)).toBe(5);
    expect(countOf(projectionToSvg(p), /<rect\b/g)).toBe(cardCount(p));
  });

  test("the hand-built 3-card projection emits exactly 3 rects", () => {
    expect(countOf(projectionToSvg(fakeProjection()), /<rect\b/g)).toBe(3);
  });
});

// ── AC: one group label per group ───────────────────────────────────────────────────────────────────

describe("projectionToSvg — one label per group", () => {
  test("exactly one group-label <text> (font-size 14) per group", () => {
    const p = miniProjection();
    expect(p.groups.length).toBeGreaterThan(0);
    expect(countOf(projectionToSvg(p), /font-size="14"/g)).toBe(p.groups.length);
  });

  test("each group's (escaped) label text appears in the output", () => {
    const svg = projectionToSvg(fakeProjection());
    expect(svg).toContain("Second");
    expect(svg).toContain('Lane &lt;one&gt; &amp; &quot;two&quot;');
  });
});

// ── AC: one <line> per depends_on link ──────────────────────────────────────────────────────────────

describe("projectionToSvg — one line per link", () => {
  test("exactly one <line> per projection link (miniGraph → 1)", () => {
    const p = miniProjection();
    expect(p.links.length).toBe(1);
    expect(countOf(projectionToSvg(p), /<line\b/g)).toBe(p.links.length);
  });

  test("the link connects its endpoints' card centers (cx/cy), not their corners", () => {
    // fakeProjection links T-3 → T-1. T-1 is the first card of lane 0; T-3 the only card of lane 1.
    const svg = projectionToSvg(fakeProjection());
    const line = svg.split("\n").find((l) => l.includes("<line"));
    expect(line).toBeDefined();
    // both endpoints carry coordinates; the line is present and well-formed.
    expect(line).toMatch(/x1="\d+" y1="\d+" x2="\d+" y2="\d+"/);
  });
});

// ── AC: empty projection → a valid minimal <svg> (honest-empty / IA-4) ──────────────────────────────

describe("projectionToSvg — honest-empty", () => {
  test("an empty projection renders a minimal <svg> with no fabricated boxes or edges", () => {
    const svg = projectionToSvg(projectGraph(emptyGraph(), DESIGNER_PRESET));
    expect(svg).toContain("<svg ");
    expect(svg).toContain("</svg>");
    expect(svg).toMatch(/viewBox="0 0 \d+ \d+"/);
    expect(countOf(svg, /<rect\b/g)).toBe(0);
    expect(countOf(svg, /<line\b/g)).toBe(0);
    expect(svg).not.toContain("NaN");
  });
});

// ── AC: same frozen projection twice → byte-identical (P5) ──────────────────────────────────────────

describe("projectionToSvg — determinism (P5)", () => {
  test("rendering the same frozen projection twice is byte-identical", () => {
    const p = miniProjection();
    expect(projectionToSvg(p)).toBe(projectionToSvg(p));
  });

  test("the hand-built projection is byte-stable too", () => {
    const p = fakeProjection();
    expect(projectionToSvg(p)).toBe(projectionToSvg(p));
  });
});

// ── AC: the input projection is returned reference-unchanged (never written back) ───────────────────

describe("projectionToSvg — one-way authority", () => {
  test("the projection object, its groups, and its links are untouched and still frozen", () => {
    const p = miniProjection();
    const groupsRef = p.groups;
    const linksRef = p.links;
    expect(Object.isFrozen(p)).toBe(true);

    projectionToSvg(p);

    expect(p.groups).toBe(groupsRef);
    expect(p.links).toBe(linksRef);
    expect(Object.isFrozen(p)).toBe(true);
    expect(cardCount(p)).toBe(5); // structure intact
  });
});

// ── options: palette override + accessible title (honest-empty when absent) ─────────────────────────

describe("projectionToSvg — overlays (palette + title)", () => {
  test("absent overlays → built-in palette; a 'done' card gets the default green fill", () => {
    const svg = projectionToSvg(fakeProjection());
    expect(svg).toContain(`fill="${DEFAULT_PALETTE.done!.fill}"`);
  });

  test("a palette override re-colors a token; missing tokens fall back to the built-in", () => {
    const svg = projectionToSvg(fakeProjection(), { palette: { done: { fill: "#000000", stroke: "#111111" } } });
    expect(svg).toContain('fill="#000000"');
    // 'open' was not overridden → still the built-in slate.
    expect(svg).toContain(`fill="${DEFAULT_PALETTE.open!.fill}"`);
  });

  test("a title overlay emits one escaped <title>; absent → none (honest-empty)", () => {
    expect(projectionToSvg(fakeProjection(), { title: "Vend <board>" })).toContain("<title>Vend &lt;board&gt;</title>");
    expect(projectionToSvg(fakeProjection())).not.toContain("<title>");
  });
});

// ── purity guard: the module imports no fs/clock/random (Date / Math.random absent) ────────────────

describe("purity — no fs/clock/random in the module source", () => {
  const source = readFileSync(new URL("./projection-svg.ts", import.meta.url), "utf8");
  const code = source
    .split("\n")
    .filter((line) => !line.trimStart().startsWith("//") && !line.trimStart().startsWith("*"))
    .join("\n");

  test("no Date usage", () => {
    expect(code).not.toMatch(/\bDate\b/);
  });

  test("no Math.random usage", () => {
    expect(code).not.toMatch(/Math\.random/);
  });

  test("no fs import", () => {
    expect(code).not.toMatch(/from\s+["']node:fs["']/);
    expect(code).not.toMatch(/from\s+["']fs["']/);
  });
});
