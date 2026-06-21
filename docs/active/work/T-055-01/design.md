# T-055-01 — Design: SVG primitives & deterministic layout

_Options, tradeoffs, decisions — grounded in the Research map. What we build and what we reject._

## What this ticket must deliver (from the AC)

1. A geometry that, given **N groups of M cards**, returns deterministic, **non-overlapping**
   box rects (group→column, card→box).
2. An **XML-escape helper** that neutralizes `<`, `>`, `&`, `"` in face text.
3. **Primitive emitters** (`<rect>`/`<text>`/`<line>`) that emit **byte-identical** strings
   for identical input.
4. The module imports **no fs/clock/random** — `Date`/`Math.random` absent.

All four are pure-function obligations. The design space is small; the discipline is the point.

## Decision 1 — Module layout: one leaf file `src/present/svg.ts`

**Options.** (a) One `svg.ts` holding primitives + geometry. (b) Split into `svg-emit.ts`
(primitives) and `svg-layout.ts` (geometry). (c) Fold into a future `projection-svg.ts`.

**Decision: (a) one file, `src/present/svg.ts`, with a matching `svg.test.ts`.**

**Why.** Mirrors `paper.ts`, which keeps its leaf-helper slice (`sanitizeId`/`mmLabel` + the
frozen tables) in one file beside the consumer. Primitives and geometry are both leaf
concerns with no cross-dependency on the IR, so a single cohesive "SVG toolkit" module reads
naturally and gives T-055-02 one import site. (b) over-splits ~120 lines of pure helpers into
two files with no boundary benefit. (c) is rejected because the consumer (`projectionToSvg`)
is explicitly T-055-02's deliverable — folding it here would blur the dependency edge the DAG
encodes (S-055-01: 01 = leaf, 02 = consumer).

## Decision 2 — Keep the module strictly IR-agnostic

**Decision: `svg.ts` imports nothing from `project.ts`/`spec.ts`.** Its geometry takes plain
numbers; its primitives take plain coordinates/strings.

**Why.** The Research map shows T-055-02 (`depends_on: [T-055-01]`) is the layer that walks
`ProjectionGroup[]`/`ProjectionLink[]`. If T-055-01 imported the IR, the leaf and core would
fuse and the layered decomposition would collapse. Staying IR-agnostic also makes the unit
tests trivially pure (numbers in, rects out) and keeps the determinism guarantee airtight —
there is simply no graph, clock, or spec in scope to leak nondeterminism. Trade-off: T-055-02
must do the small mapping from cards→counts and box→id; that is correct placement, not extra cost.

## Decision 3 — Primitive API: typed options objects, attribute-ordered output

**Options.** (a) Positional args (`rect(x, y, w, h, fill)`). (b) Typed options object
(`rect({ x, y, width, height, fill?, stroke? })`). (c) A generic attribute-map emitter.

**Decision: (b) typed options objects**, each primitive emitting attributes in a **fixed,
declared order** so output is byte-stable.

**Why.** Options objects are self-documenting at the T-055-02 call site (which juggles
fill/stroke/strokeWidth per card color) and tolerate optional styling without positional-arg
soup. Byte-stability requires a *fixed attribute order* regardless of how the caller orders
object keys — so each emitter writes attributes in a hand-fixed sequence (e.g. `x y width
height` then optional `fill`/`stroke`/`stroke-width` then `rx`), omitting absent optionals.
(c) a generic map emitter would make order depend on insertion/iteration — a determinism
hazard — and would push escaping responsibility to every caller. Rejected.

**Escaping placement.** `<text>` content is the only place free-form face text reaches the
output, so `svgText` runs its `content` through `xmlEscape` internally — the caller cannot
forget. Numeric coordinates are formatted through a small `num()` normalizer (integer-ish,
no locale, no exponential) so `12` and `12.0` can never diverge. Attribute string values
(rare here) are escaped on the way out too.

## Decision 4 — `xmlEscape`: the four required entities, ampersand first

**Decision.** A single total function replacing, **in this order**: `&`→`&amp;` (first, so we
don't double-escape the `&` we introduce), then `<`→`&lt;`, `>`→`&gt;`, `"`→`&quot;`.

**Why.** The AC names exactly `<`, `>`, `&`, `"`. Ampersand-first is the classic correctness
rule: escaping `<`→`&lt;` before `&`→`&amp;` would turn it into `&amp;lt;`. We also escape `'`
→`&apos;`? **No** — the AC scopes the set to four chars and `'` is legal in double-quoted XML
attributes and in text content; adding it is scope creep. We stop at the four named. This is
the `mmLabel` shape (chained `.replace()`), retargeted from Mermaid syntax to XML entities.

## Decision 5 — Layout: column-per-group swimlanes, deterministic integer grid

**Options.** (a) Column-per-group: groups laid left→right, cards stacked top→down within each
column. (b) Row-per-group: groups stacked top→down, cards left→right within each row. (c) A
packed grid ignoring group boundaries.

**Decision: (a) column-per-group swimlanes.**

**Why.** The epic's language is "labeled swimlane/column," and a column-per-group board is the
canonical "read each theme as a lane" mental model (and matches how `paper.ts`'s founder brief
groups by epic theme). Card stacking within a column is trivial integer math and yields
obviously non-overlapping boxes. (c) is rejected outright — it discards the group structure the
whole renderer exists to show. (b) is a viable mirror; we pick columns because horizontal lanes
of vertically-stacked cards scale better when one group has many cards (a tall column, not an
ever-widening row), and a wide static SVG scrolls horizontally cleanly.

**The grid math (deterministic, integer, total).** Fixed layout constants in a frozen table:

```
PAD (canvas margin), LANE_GAP (between columns), LANE_LABEL_H (label band atop each lane),
CARD_W, CARD_H, CARD_GAP_Y (between stacked cards), LANE_PAD (inset of cards within a lane).
```

For group index `g` (0-based) and card index `c` within it:

```
laneX   = PAD + g * (CARD_W + 2*LANE_PAD + LANE_GAP)
cardX   = laneX + LANE_PAD
cardY   = PAD + LANE_LABEL_H + c * (CARD_H + CARD_GAP_Y)
```

Non-overlap is structural: distinct `g` ⇒ disjoint x-ranges (the per-lane stride strictly
exceeds `CARD_W`); distinct `c` ⇒ disjoint y-ranges (stride strictly exceeds `CARD_H`).
Canvas `width`/`height` are the max extents over all lanes/cards plus `PAD`. An empty input
(no groups) yields a minimal canvas of `2*PAD` square — the honest-empty geometry, no NaN.

## Decision 6 — Geometry input/return types

**Input.** `layout(groupSizes: readonly number[])` — one entry per group, its card count.
This is the minimal IR-agnostic shape and exactly what T-055-02 produces with
`groups.map(g => g.cards.length)`.

**Return.** A frozen `SvgLayout`:

```
SvgLayout {
  width, height,
  lanes: LaneBox[]          // one per group, in input order
}
LaneBox {
  index, x, labelX, labelY, // where T-055-02 puts the group label
  cards: CardBox[]          // one per card, in input order
}
CardBox { x, y, width, height, cx, cy }   // cx/cy = center, for edge anchoring
```

`cx`/`cy` are precomputed so T-055-02 can draw `depends_on` edges (`<line>`) between card
centers without recomputing geometry. Input order is preserved (no sorting here — the IR is
already deterministically sorted upstream by `project.ts`), so the layout adds no ordering
policy of its own and stays byte-stable.

## Rejected alternatives (summary)

- **Force-directed / external layout engine** — explicitly forbidden by the epic (dependency-
  light, deterministic). A physics sim is also nondeterministic without seeding. Rejected.
- **Computing canvas size from rendered text width** — would need font metrics (a native/measured
  dependency) and break purity/determinism. We use fixed `CARD_W`; T-055-02 can wrap/clip text.
- **Escaping `'`** — out of AC scope; see Decision 4.
- **Emitting whole `<svg>` document here** — that is the consumer's job (T-055-02 wraps lanes +
  the `<svg>` root). T-055-01 stops at element-level primitives + coordinates.
