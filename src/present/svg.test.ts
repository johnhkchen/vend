import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { svgRect, svgText, svgLine, xmlEscape, layout, type CardBox } from "./svg.ts";

// T-055-01 — the SVG TOOLKIT (the leaf layer of E-055): pure XML-escaped <rect>/<text>/<line>
// builders + a deterministic hand-rolled swimlane geometry. Pure-function tests over plain
// numbers/strings — no graph, no fs at runtime (the purity guard reads source, not behavior), no
// live model. One describe per AC clause, with determinism woven through.

// ── xmlEscape: neutralizes <, >, &, " (& first, no double-escape) ──────────────────────────────────

describe("xmlEscape — XML entity neutralization", () => {
  test("neutralizes each of the four AC chars", () => {
    expect(xmlEscape("<")).toBe("&lt;");
    expect(xmlEscape(">")).toBe("&gt;");
    expect(xmlEscape("&")).toBe("&amp;");
    expect(xmlEscape('"')).toBe("&quot;");
  });

  test("& is escaped FIRST — no double-escaping of introduced entities", () => {
    expect(xmlEscape('<a href="x" & y>')).toBe("&lt;a href=&quot;x&quot; &amp; y&gt;");
    // a literal that already looks like an entity is escaped once, at the ampersand only.
    expect(xmlEscape("&lt;")).toBe("&amp;lt;");
  });

  test("a clean string passes through unchanged", () => {
    expect(xmlEscape("svg-primitives and layout")).toBe("svg-primitives and layout");
  });

  test("deterministic: same input → identical output", () => {
    const s = 'face <b>"text"</b> & more';
    expect(xmlEscape(s)).toBe(xmlEscape(s));
  });
});

// ── primitives: fixed attribute order, omitted optionals, byte-identical ───────────────────────────

describe("svg primitives — byte-identical element emission", () => {
  test("svgRect: required-only emits a minimal self-closing rect in fixed order", () => {
    expect(svgRect({ x: 0, y: 0, width: 220, height: 64 })).toBe(
      '<rect x="0" y="0" width="220" height="64"/>',
    );
  });

  test("svgRect: optionals slot into their fixed positions, absent ones omitted", () => {
    expect(
      svgRect({ x: 12, y: 24, width: 220, height: 64, fill: "#fff", stroke: "#333", strokeWidth: 2, rx: 6 }),
    ).toBe('<rect x="12" y="24" width="220" height="64" fill="#fff" stroke="#333" stroke-width="2" rx="6"/>');
  });

  test("svgText: escapes its content internally — a card face cannot inject markup", () => {
    expect(svgText({ x: 5, y: 9, content: '<script>"x" & y' })).toBe(
      '<text x="5" y="9">&lt;script&gt;&quot;x&quot; &amp; y</text>',
    );
  });

  test("svgText: optional styling in fixed order", () => {
    expect(svgText({ x: 5, y: 9, content: "hi", fontSize: 13, fill: "#111", anchor: "middle" })).toBe(
      '<text x="5" y="9" font-size="13" fill="#111" text-anchor="middle">hi</text>',
    );
  });

  test("svgLine: required-only edge in fixed order", () => {
    expect(svgLine({ x1: 0, y1: 0, x2: 10, y2: 20 })).toBe('<line x1="0" y1="0" x2="10" y2="20"/>');
    expect(svgLine({ x1: 0, y1: 0, x2: 10, y2: 20, stroke: "#999", strokeWidth: 1 })).toBe(
      '<line x1="0" y1="0" x2="10" y2="20" stroke="#999" stroke-width="1"/>',
    );
  });

  test("deterministic: identical input → identical string for every primitive", () => {
    const r = { x: 1, y: 2, width: 3, height: 4, fill: "#abc" };
    const t = { x: 1, y: 2, content: "a & b" };
    const l = { x1: 1, y1: 2, x2: 3, y2: 4 };
    expect(svgRect(r)).toBe(svgRect(r));
    expect(svgText(t)).toBe(svgText(t));
    expect(svgLine(l)).toBe(svgLine(l));
  });
});

// ── geometry: N groups of M cards → deterministic non-overlapping boxes ─────────────────────────────

/** True iff two axis-aligned boxes share any area (touching edges do NOT count as overlap). */
function overlaps(a: CardBox, b: CardBox): boolean {
  return a.x < b.x + b.width && b.x < a.x + a.width && a.y < b.y + b.height && b.y < a.y + a.height;
}

describe("layout — deterministic swimlane geometry", () => {
  test("one lane per group, one card box per card, in input order", () => {
    const l = layout([2, 3, 1]);
    expect(l.lanes.length).toBe(3);
    expect(l.lanes.map((lane) => lane.cards.length)).toEqual([2, 3, 1]);
    expect(l.lanes.map((lane) => lane.index)).toEqual([0, 1, 2]);
  });

  test("no two card boxes overlap (N groups of M cards)", () => {
    const l = layout([3, 3, 3, 3]);
    const boxes = l.lanes.flatMap((lane) => lane.cards);
    expect(boxes.length).toBe(12);
    for (let i = 0; i < boxes.length; i++) {
      for (let j = i + 1; j < boxes.length; j++) {
        expect(overlaps(boxes[i]!, boxes[j]!)).toBe(false);
      }
    }
  });

  test("lanes march left→right; cards stack top→down; every box is within the canvas", () => {
    const l = layout([2, 2]);
    const [lane0, lane1] = [l.lanes[0]!, l.lanes[1]!];
    expect(lane1.x).toBeGreaterThan(lane0.x + lane0.cards[0]!.width);
    expect(lane0.cards[1]!.y).toBeGreaterThan(lane0.cards[0]!.y + lane0.cards[0]!.height);
    for (const box of l.lanes.flatMap((lane) => lane.cards)) {
      expect(box.x).toBeGreaterThanOrEqual(0);
      expect(box.y).toBeGreaterThanOrEqual(0);
      expect(box.x + box.width).toBeLessThanOrEqual(l.width);
      expect(box.y + box.height).toBeLessThanOrEqual(l.height);
    }
  });

  test("card centers (cx/cy) sit at the box midpoint — the edge anchors for the consumer", () => {
    const box = layout([1]).lanes[0]!.cards[0]!;
    expect(box.cx).toBe(box.x + box.width / 2);
    expect(box.cy).toBe(box.y + box.height / 2);
  });

  test("honest-empty: zero groups → a minimal valid canvas, zero lanes (never NaN)", () => {
    const l = layout([]);
    expect(l.lanes).toEqual([]);
    expect(l.width).toBeGreaterThan(0);
    expect(l.height).toBeGreaterThan(0);
    expect(Number.isNaN(l.width)).toBe(false);
    expect(Number.isNaN(l.height)).toBe(false);
  });

  test("an empty group (zero cards) is a labeled lane with no boxes", () => {
    const l = layout([0, 2]);
    expect(l.lanes.length).toBe(2);
    expect(l.lanes[0]!.cards.length).toBe(0);
    expect(l.lanes[1]!.cards.length).toBe(2);
  });

  test("deterministic: same input → deep-equal layout (P5)", () => {
    expect(layout([2, 3, 1])).toEqual(layout([2, 3, 1]));
  });

  test("the returned layout is frozen (immutable output, house discipline)", () => {
    const l = layout([1]);
    expect(Object.isFrozen(l)).toBe(true);
    expect(Object.isFrozen(l.lanes)).toBe(true);
    expect(Object.isFrozen(l.lanes[0]!.cards[0])).toBe(true);
  });
});

// ── purity guard: the module imports no fs/clock/random (Date / Math.random absent) ────────────────

describe("purity — no fs/clock/random in the module source", () => {
  const source = readFileSync(new URL("./svg.ts", import.meta.url), "utf8");
  // strip the header comment block's prose mentions so we test CODE, not the doc-block that
  // explains the prohibition.
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
