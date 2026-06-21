// The SVG TOOLKIT — the LEAF layer of E-055's projection-to-svg renderer (T-055-01, story
// S-055-01). It is the primitive slice the renderer core (T-055-02's `projectionToSvg`, the THIRD
// consumer of the E-021 Projection IR) will compose: pure, XML-escaped <rect>/<text>/<line>
// builders and a hand-rolled, dependency-light grid/swimlane geometry (group→column, card→box
// coordinates). It mirrors paper.ts's `sanitizeId`/`mmLabel`/helper slice in SHAPE — total, pure
// string/number helpers — retargeted from Mermaid syntax to XML.
//
// PURITY (house pattern, cf. paper.ts / project.ts / translate.ts): everything here is pure string
// building and integer arithmetic — no fs, clock, network, or native addon, and no `Date` /
// `Math.random`. Identical input → byte-identical output, every time (P5 consistency).
//
// IR-AGNOSTIC (the layered decomposition's teeth): this module imports NOTHING from project.ts /
// spec.ts. Its geometry takes plain card counts; its primitives take plain coordinates and strings.
// Mapping a `Projection`/`ProjectionGroup`/`ProjectionLink` onto this geometry — and owning the
// color→palette decision — belongs to T-055-02, which depends on this leaf. Keeping the IR out of
// scope is what makes the determinism guarantee airtight: there is no graph, spec, or clock here to
// leak nondeterminism.
//
// DETERMINISM: each primitive emits its attributes in a HAND-FIXED order (never by iterating object
// keys), absent optionals are omitted, and coordinates pass through `num` so `12` and `12.0` can
// never diverge. The geometry is integer add/multiply only (no division), so box coordinates stay
// integral and byte-stable.

// ── public attribute / geometry types (all readonly — the model.ts/project.ts immutability idiom) ──

/** Attributes for {@link svgRect}. `x`/`y`/`width`/`height` required; styling optional (the caller —
 *  T-055-02 — owns the palette and supplies fill/stroke from a card's color token). */
export interface RectAttrs {
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
  readonly fill?: string;
  readonly stroke?: string;
  readonly strokeWidth?: number;
  readonly rx?: number;
}

/** Attributes for {@link svgText}. `content` is free-form face text and is XML-escaped INTERNALLY —
 *  the caller cannot forget. `anchor` maps to SVG `text-anchor` (start/middle/end). */
export interface TextAttrs {
  readonly x: number;
  readonly y: number;
  readonly content: string;
  readonly fontSize?: number;
  readonly fill?: string;
  readonly anchor?: string;
}

/** Attributes for {@link svgLine} — a `depends_on` edge between two card boxes. */
export interface LineAttrs {
  readonly x1: number;
  readonly y1: number;
  readonly x2: number;
  readonly y2: number;
  readonly stroke?: string;
  readonly strokeWidth?: number;
}

/** One laid-out card box: top-left `x`/`y` + `width`/`height`, plus the precomputed center
 *  (`cx`/`cy`) so the consumer can anchor edges between card centers without recomputing geometry. */
export interface CardBox {
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
  readonly cx: number;
  readonly cy: number;
}

/** One laid-out swimlane (column) for a group: its `index` (input order), column `x`, the label
 *  anchor (`labelX`/`labelY`), and the stacked card boxes (input order). */
export interface LaneBox {
  readonly index: number;
  readonly x: number;
  readonly labelX: number;
  readonly labelY: number;
  readonly cards: readonly CardBox[];
}

/** A full deterministic layout: canvas `width`/`height` bounding every box, and the lanes in input
 *  order. The geometry's frozen, honest-empty output (zero groups → a minimal 2·PAD canvas). */
export interface SvgLayout {
  readonly width: number;
  readonly height: number;
  readonly lanes: readonly LaneBox[];
}

// ── layout constants (one frozen table — the single source of geometry truth, cf. paper.ts) ───────

/** All geometry constants. Integers only (R1: no float coordinates → byte-stable output). */
const LAYOUT = Object.freeze({
  PAD: 24, // canvas margin
  LANE_GAP: 32, // horizontal gap between columns
  LANE_LABEL_H: 28, // label band atop each lane (where the group label sits)
  LANE_PAD: 12, // inset of cards within a lane
  CARD_W: 220,
  CARD_H: 64,
  CARD_GAP_Y: 16, // vertical gap between stacked cards
});

// ── pure leaf helpers ─────────────────────────────────────────────────────────────────────────────

/** Neutralize the four XML-significant chars in face text: `&` FIRST (so the `&` we introduce is not
 *  re-escaped), then `<`, `>`, `"`. Total and pure — the XML analogue of paper.ts's `mmLabel`. */
export function xmlEscape(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/** Normalize a coordinate to a stable attribute string. `String` already collapses `12.0`→`"12"`
 *  and uses no locale; `+ 0` folds a stray `-0`→`0` so byte-identity can never hinge on the sign of
 *  zero. The geometry only ever feeds integers — this is the belt-and-suspenders guard (R1). */
function num(n: number): string {
  return String(n + 0);
}

/** Assemble `name="value"` for a numeric attribute. */
function numAttr(name: string, value: number): string {
  return `${name}="${num(value)}"`;
}

/** Assemble `name="value"` for an optional string attribute, escaping the value; "" when absent so
 *  the caller can join-and-filter. */
function strAttr(name: string, value: string | undefined): string {
  return value === undefined ? "" : `${name}="${xmlEscape(value)}"`;
}

/** Join a fixed attribute sequence into an element's attribute string, dropping the empties so absent
 *  optionals never emit. Order is the caller's hand-fixed sequence — never object-key iteration. */
function joinAttrs(parts: readonly string[]): string {
  return parts.filter((p) => p.length > 0).join(" ");
}

// ── primitive emitters (pure; fixed attribute order → byte-identical output) ───────────────────────

/** Emit one `<rect/>`. Fixed order: x y width height, then optional fill stroke stroke-width rx. */
export function svgRect(a: RectAttrs): string {
  const attrs = joinAttrs([
    numAttr("x", a.x),
    numAttr("y", a.y),
    numAttr("width", a.width),
    numAttr("height", a.height),
    strAttr("fill", a.fill),
    strAttr("stroke", a.stroke),
    a.strokeWidth === undefined ? "" : numAttr("stroke-width", a.strokeWidth),
    a.rx === undefined ? "" : numAttr("rx", a.rx),
  ]);
  return `<rect ${attrs}/>`;
}

/** Emit one `<text>…</text>`. The `content` is XML-escaped INTERNALLY (the caller cannot forget).
 *  Fixed order: x y, then optional font-size fill text-anchor. */
export function svgText(a: TextAttrs): string {
  const attrs = joinAttrs([
    numAttr("x", a.x),
    numAttr("y", a.y),
    a.fontSize === undefined ? "" : numAttr("font-size", a.fontSize),
    strAttr("fill", a.fill),
    strAttr("text-anchor", a.anchor),
  ]);
  return `<text ${attrs}>${xmlEscape(a.content)}</text>`;
}

/** Emit one `<line/>`. Fixed order: x1 y1 x2 y2, then optional stroke stroke-width. */
export function svgLine(a: LineAttrs): string {
  const attrs = joinAttrs([
    numAttr("x1", a.x1),
    numAttr("y1", a.y1),
    numAttr("x2", a.x2),
    numAttr("y2", a.y2),
    strAttr("stroke", a.stroke),
    a.strokeWidth === undefined ? "" : numAttr("stroke-width", a.strokeWidth),
  ]);
  return `<line ${attrs}/>`;
}

// ── the geometry (pure; integer grid; honest-empty) ───────────────────────────────────────────────

/**
 * Lay out `groupSizes` (one card-count per group) as column-per-group swimlanes: groups left→right,
 * cards stacked top→down within each column. Returns a deterministic, NON-OVERLAPPING set of lane +
 * card boxes plus the bounding canvas, in input order (no sorting — the IR is already deterministically
 * sorted upstream by project.ts). PURE and integer-only. An empty input yields a minimal `2·PAD`
 * square canvas with zero lanes (honest-empty geometry — never NaN, never a crash).
 *
 * Non-overlap is structural: distinct group index ⇒ disjoint x-ranges (the per-lane stride exceeds
 * CARD_W); distinct card index ⇒ disjoint y-ranges (the stride exceeds CARD_H).
 */
export function layout(groupSizes: readonly number[]): SvgLayout {
  const { PAD, LANE_GAP, LANE_LABEL_H, LANE_PAD, CARD_W, CARD_H, CARD_GAP_Y } = LAYOUT;
  const laneStride = CARD_W + 2 * LANE_PAD + LANE_GAP;

  const lanes: LaneBox[] = [];
  let maxBottom: number = PAD; // tallest extent seen (canvas height accumulator)

  for (let g = 0; g < groupSizes.length; g++) {
    const count = Math.max(0, Math.trunc(groupSizes[g] ?? 0));
    const laneX = PAD + g * laneStride;
    const cardX = laneX + LANE_PAD;

    const cards: CardBox[] = [];
    for (let c = 0; c < count; c++) {
      const cardY = PAD + LANE_LABEL_H + c * (CARD_H + CARD_GAP_Y);
      cards.push(
        Object.freeze({
          x: cardX,
          y: cardY,
          width: CARD_W,
          height: CARD_H,
          cx: cardX + CARD_W / 2,
          cy: cardY + CARD_H / 2,
        }),
      );
      const bottom = cardY + CARD_H;
      if (bottom > maxBottom) maxBottom = bottom;
    }

    lanes.push(
      Object.freeze({
        index: g,
        x: laneX,
        labelX: cardX,
        labelY: PAD + LANE_LABEL_H - 8, // baseline sits just above the first card
        cards: Object.freeze(cards),
      }),
    );
  }

  const width =
    groupSizes.length === 0 ? 2 * PAD : PAD + groupSizes.length * laneStride - LANE_GAP + PAD;
  const height = groupSizes.length === 0 ? 2 * PAD : maxBottom + PAD;

  return Object.freeze({ width, height, lanes: Object.freeze(lanes) });
}
