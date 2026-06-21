// The PROJECTION→SVG RENDERER CORE — the THIRD consumer of E-021's Projection IR (T-055-02, story
// S-055-01), after project.ts (which builds the IR) and paper.ts (which renders it to Mermaid +
// markdown). It turns a `Projection` (src/present/project.ts) into a single large STATIC SVG: each
// `ProjectionGroup` becomes a labeled swimlane, each `ProjectedCard` a box carrying its face text +
// color token, each `ProjectionLink` an edge between two card centers. It mirrors paper.ts's
// `(IR, overlays?) -> string` contract — signature shape, purity, honest-empty, and one-way
// authority — exactly, retargeted from Mermaid to SVG.
//
// THE STACK SEAM (S-055-01: leaf → core → seam): this is the FIRST module that imports BOTH the IR
// (project.ts, type-only) AND the toolkit (svg.ts, T-055-01). svg.ts deliberately left us two jobs:
// (1) map `ProjectionGroup[]` onto its `layout(groupSizes)` geometry and key each card box by id,
// and (2) own the color-token → palette decision (svg.ts emits no colors of its own). T-055-03 will
// later add the thin CLI/file seam that calls this function.
//
// PURITY (house pattern, cf. paper.ts / project.ts / svg.ts): pure string building over a frozen
// input — no fs, clock, network, or native addon, and no `Date` / `Math.random`. `projectGraph` is
// the CALLER's concern; here we only READ an already-built `Projection`. Identical input →
// byte-identical output, every time (P5 consistency).
//
// ONE-WAY AUTHORITY (E-021 invariant): this layer READS the projection and never writes — no setter,
// no fs. It allocates a string and returns it; the input `projection` is returned reference-unchanged
// and stays frozen (the AC's teeth).
//
// HONEST-EMPTY (IA-4): an empty projection renders a valid MINIMAL `<svg>` (root only — no fabricated
// box or edge); a card with no `plainTitle` renders its box but no invented face text; an absent
// `title` overlay emits no `<title>`. Absence is reported as absence, never padded.
//
// OWNS THE PALETTE: a card's `color` is a SEMANTIC token (`"done"`, `"high"`, `"default"`…), never a
// hex (project.ts:44). `DEFAULT_PALETTE` maps each token the IR can emit to a `{fill, stroke}` pair,
// reusing paper.ts's classDef hex family so the two surfaces read consistently. A caller may override
// per-token via `overlays.palette`; unknown tokens degrade to a neutral grey — total, never a crash.

import type { Projection } from "./project.ts";
import { layout, svgRect, svgText, svgLine, xmlEscape, type CardBox, type SvgLayout } from "./svg.ts";

// ── public option types (all readonly — the model.ts/project.ts immutability idiom) ───────────────

/** One box style: the `fill`/`stroke` a color token resolves to. The renderer owns this mapping. */
export interface SvgBoxStyle {
  readonly fill: string;
  readonly stroke: string;
}

/** The optional second argument — the `(IR, overlays?)` shape mirrored from paper.ts. For THIS
 *  consumer the IR already carries the face prose, so `overlays` instead routes the two things the
 *  SVG layer genuinely owns: a `palette` override (color token → style) and an accessible `title`.
 *  Both optional and honest-empty: absent `palette` → {@link DEFAULT_PALETTE}; absent `title` → no
 *  `<title>` element (never a fabricated caption). */
export interface SvgOverlays {
  readonly palette?: Readonly<Record<string, SvgBoxStyle>>;
  readonly title?: string;
}

// ── frozen style tables (the single source of style truth, cf. paper.ts's classDefs) ──────────────

/** Semantic color token → box style. Covers every token `colorFor` (project.ts:168) can emit:
 *  status keys, leverage priorities, and the role/unknown `default`. Hex reuses paper.ts's family
 *  (done=green, in_progress=amber, open/ready=slate) so paper and SVG read as one palette. */
export const DEFAULT_PALETTE: Readonly<Record<string, SvgBoxStyle>> = Object.freeze({
  done: Object.freeze({ fill: "#E8F5E9", stroke: "#66BB6A" }),
  in_progress: Object.freeze({ fill: "#FFF8E1", stroke: "#FFB300" }),
  open: Object.freeze({ fill: "#ECEFF1", stroke: "#90A4AE" }),
  ready: Object.freeze({ fill: "#ECEFF1", stroke: "#90A4AE" }),
  critical: Object.freeze({ fill: "#FFEBEE", stroke: "#E53935" }),
  high: Object.freeze({ fill: "#FFF3E0", stroke: "#FB8C00" }),
  medium: Object.freeze({ fill: "#FFFDE7", stroke: "#FDD835" }),
  low: Object.freeze({ fill: "#F1F8E9", stroke: "#7CB342" }),
  default: Object.freeze({ fill: "#FAFAFA", stroke: "#BDBDBD" }),
});

/** The final fallback when neither an override nor the built-in table knows a token — neutral grey,
 *  so an unfamiliar token degrades honestly instead of crashing. */
const NEUTRAL: SvgBoxStyle = Object.freeze({ fill: "#FAFAFA", stroke: "#BDBDBD" });

/** Group-label text: 14px (the per-group-label count keys on this size — distinct from the face). */
const LABEL = Object.freeze({ fontSize: 14, fill: "#311B92" });
/** Card face text: 13px, dark slate, inset from the box's left edge. */
const FACE = Object.freeze({ fontSize: 13, fill: "#37474F", inset: 10 });
/** Card box stroke width + corner radius. */
const CARD = Object.freeze({ strokeWidth: 1, rx: 6 });
/** Edge line style. */
const EDGE = Object.freeze({ stroke: "#B0BEC5", strokeWidth: 2 });
/** Character budget before a face/label is clipped with an ellipsis (CARD_W is fixed; no font
 *  metrics — those would break purity/determinism). Cosmetic only; full text stays in the IR. */
const FACE_CHAR_BUDGET = 30;

// ── pure leaf helpers ─────────────────────────────────────────────────────────────────────────────

/** Resolve a color token to a box style: a caller override first, then the built-in table, then the
 *  neutral fallback. Total — every token resolves to a concrete style. */
function styleFor(token: string, palette: Readonly<Record<string, SvgBoxStyle>>): SvgBoxStyle {
  return palette[token] ?? DEFAULT_PALETTE[token] ?? NEUTRAL;
}

/** Deterministically truncate over-budget text to `max-1` chars + an ellipsis; pass it through
 *  unchanged otherwise. Pure string op (no font metrics). */
function clip(text: string, max: number): string {
  return text.length <= max ? text : `${text.slice(0, Math.max(0, max - 1))}…`;
}

/** An accessible `<title>` element (svg.ts has no title primitive); content XML-escaped. */
function svgTitle(title: string): string {
  return `<title>${xmlEscape(title)}</title>`;
}

/** The positional id→box join: `layout` preserves input order and we feed it the per-group card
 *  counts, so `lay.lanes[g].cards[c]` is exactly the box for `projection.groups[g].cards[c]`. Built
 *  once so links can anchor on card centers. Guarded for `noUncheckedIndexedAccess` — no `!`. */
function indexBoxes(projection: Projection, lay: SvgLayout): Map<string, CardBox> {
  const boxes = new Map<string, CardBox>();
  for (let g = 0; g < projection.groups.length; g++) {
    const group = projection.groups[g];
    const lane = lay.lanes[g];
    if (!group || !lane) continue;
    for (let c = 0; c < group.cards.length; c++) {
      const pc = group.cards[c];
      const box = lane.cards[c];
      if (pc && box) boxes.set(pc.card.id, box);
    }
  }
  return boxes;
}

// ── the renderer (the one public entry) ───────────────────────────────────────────────────────────

/**
 * Render a {@link Projection} into a single static SVG string: one labeled swimlane per group, one
 * `<rect>` (+ face `<text>`) per card, one `<line>` per `depends_on` link, wrapped in an `<svg>` root
 * sized to the deterministic {@link layout}. PURE: reads the frozen projection, allocates a fresh
 * string, and never touches the input — `projection` is returned to the caller reference-unchanged
 * (E-021 one-way authority). Same frozen projection → byte-identical output (deterministic geometry +
 * fixed emission order, no clock/random — P5). Honest-empty (IA-4): an empty projection yields a
 * minimal `<svg>` root with no fabricated boxes or edges. The optional `overlays` route a `palette`
 * override and an accessible `title`; both omit cleanly when absent.
 */
export function projectionToSvg(projection: Projection, overlays: SvgOverlays = {}): string {
  const palette = overlays.palette ?? DEFAULT_PALETTE;
  const lay = layout(projection.groups.map((g) => g.cards.length));
  const boxes = indexBoxes(projection, lay);

  const out: string[] = [];
  out.push(
    `<svg xmlns="http://www.w3.org/2000/svg" width="${lay.width}" height="${lay.height}" ` +
      `viewBox="0 0 ${lay.width} ${lay.height}">`,
  );
  if (overlays.title !== undefined) out.push(`  ${svgTitle(overlays.title)}`);

  // Edges first, so the opaque card boxes paint over the lines (deterministic regardless of order).
  for (const link of projection.links) {
    const from = boxes.get(link.from);
    const to = boxes.get(link.to);
    if (!from || !to) continue; // defensive — every endpoint resolves for a well-formed projection.
    out.push(
      `  ${svgLine({ x1: from.cx, y1: from.cy, x2: to.cx, y2: to.cy, stroke: EDGE.stroke, strokeWidth: EDGE.strokeWidth })}`,
    );
  }

  // One labeled swimlane per group; one rect (+ face text) per card.
  for (let g = 0; g < projection.groups.length; g++) {
    const group = projection.groups[g];
    const lane = lay.lanes[g];
    if (!group || !lane) continue;
    out.push(
      `  ${svgText({ x: lane.labelX, y: lane.labelY, content: clip(group.label, FACE_CHAR_BUDGET), fontSize: LABEL.fontSize, fill: LABEL.fill })}`,
    );
    for (let c = 0; c < group.cards.length; c++) {
      const pc = group.cards[c];
      const box = lane.cards[c];
      if (!pc || !box) continue;
      const style = styleFor(pc.color, palette);
      out.push(
        `  ${svgRect({ x: box.x, y: box.y, width: box.width, height: box.height, fill: style.fill, stroke: style.stroke, strokeWidth: CARD.strokeWidth, rx: CARD.rx })}`,
      );
      const face = pc.card.face.plainTitle;
      if (face) {
        out.push(
          `  ${svgText({ x: box.x + FACE.inset, y: box.cy, content: clip(face, FACE_CHAR_BUDGET), fontSize: FACE.fontSize, fill: FACE.fill })}`,
        );
      }
    }
  }

  out.push("</svg>");
  return out.join("\n");
}
