# T-055-02 — Research: projection-to-svg renderer core

_Descriptive map of the territory. What exists, where, how it connects. No solutions here._

## The ticket in one line

Land `projectionToSvg(projection, overlays?) -> string` — the **THIRD consumer** of the
E-021 Projection IR (after `project.ts` itself and `paper.ts`). It walks a `Projection` and
emits a single large static SVG: each `ProjectionGroup` → a labeled swimlane, each
`ProjectedCard` → a box carrying its face text + color token, each `ProjectionLink` → an
edge. It mirrors `renderPaper`'s `(IR, overlays?)` signature, its **purity**, its
**honest-empty** discipline, and its **never-writes-back** one-way authority — exactly.

## Where this ticket sits in E-055 / S-055-01

The story decomposes the epic into a clean leaf → core → seam stack:

- **T-055-01 (done, committed 1106329)** — the LEAF: pure `svgRect`/`svgText`/`svgLine`
  emitters + `layout(groupSizes)` swimlane geometry. `src/present/svg.ts` (+ `svg.test.ts`).
  IR-agnostic by design — imports nothing from `project.ts`.
- **T-055-02 (this)** — the CORE: `projectionToSvg`, which maps the `Projection` IR onto
  T-055-01's geometry, owns the **color-token → palette** decision, and assembles the
  `<svg>` document. `depends_on: [T-055-01]`.
- **T-055-03 (later)** — the SEAM: a thin CLI/file path (load board → `projectGraph` →
  `projectionToSvg` → write a staged `.svg`). `depends_on: [T-055-02]`.

So this ticket is the join: it is the FIRST module in the stack that imports both the IR
(`project.ts` types) and the toolkit (`svg.ts`). T-055-01 deliberately left two things to us:
(1) the mapping `ProjectionGroup[] → groupSizes` and box→id keying, and (2) the palette —
the svg.ts header says verbatim "the caller — T-055-02 — owns the palette and supplies
fill/stroke from a card's color token."

## The IR we consume (`src/present/project.ts`)

- `Projection { groupBy, density, colorLanguage, metaphor, groups: ProjectionGroup[], links: ProjectionLink[] }`
  (`project.ts:68`) — deeply frozen by `deepFreeze`, self-describing (carries its own knobs).
- `ProjectionGroup { key, label, cards: readonly ProjectedCard[] }` (`project.ts:50`) — one
  swimlane: a plain `label` (already scrubbed/humanized) + a vertical stack of cards. Cards
  are **id-sorted** within the group; groups are **ordered** (status/leverage natural order,
  else key `localeCompare`) — all upstream, deterministic.
- `ProjectedCard { card: Card, color: string }` (`project.ts:42`) — `card.face.plainTitle`
  is the scrubbed face text the `<text>` primitive escapes; `color` is a **semantic token**
  (`"done"`, `"in_progress"`, `"high"`, `"critical"`, `"default"`…), NOT a hex — the renderer
  owns the token→palette map.
- `ProjectionLink { from, to, kind: "depends_on" }` (`project.ts:59`) — a `(from,to)`-sorted
  edge set; only the authored `depends_on` direction is emitted (the inverse `blocks` is never
  double-emitted). Every endpoint is a real ticket id present in exactly one group.

The color tokens are produced by `colorFor` (`project.ts:168`): `status` → `stateKey`
(`done`/`in_progress`/`open`/`ready`/…), `leverage` → `priority`
(`critical`/`high`/`medium`/`low`), `role` → `"default"`.

## The toolkit we compose (`src/present/svg.ts`, T-055-01)

- `layout(groupSizes: readonly number[]): SvgLayout` (`svg.ts:193`) — column-per-group
  swimlanes. Returns `{ width, height, lanes }`; each `LaneBox { index, x, labelX, labelY,
  cards }`; each `CardBox { x, y, width, height, cx, cy }`. **Input order preserved** (no
  sorting — the IR is already sorted), and **integer-only** coordinates (byte-stable). Empty
  input → a minimal `2·PAD` (48×48) canvas, zero lanes — the honest-empty geometry, never NaN.
- `svgRect(a)` / `svgText(a)` / `svgLine(a)` (`svg.ts:141/157/169`) — fixed-attribute-order
  emitters; absent optionals omitted; `svgText` escapes its `content` INTERNALLY (the caller
  cannot forget). `xmlEscape(text)` (`svg.ts:106`) is exported for any other escaped emission
  (e.g. a `<title>`), `&`-first so introduced entities are not re-escaped.
- The lane→card correspondence is **positional**: `lay.lanes[g].cards[c]` is the box for
  `projection.groups[g].cards[c]`, because `layout` preserves input order and we feed it
  `groups.map(g => g.cards.length)`. That positional join is how we key a card id → its box.

## The contract to mirror (`src/present/paper.ts`, the 2nd consumer)

- **Signature shape.** `renderPaper(graph, spec, opts)` and the IR-level entries
  `renderFaces(projection)` / `renderFounderBrief(projection, narrative)` all take the IR then
  an optional second arg. Our `projectionToSvg(projection, overlays?)` echoes that shape.
- **Purity.** "everything here is pure string building … no fs, clock, network, or native
  addon" (`paper.ts:1`). `projectGraph` is called by the caller, not us; we only read a frozen
  `Projection`. No `Date`/`Math.random`.
- **Honest-empty (IA-4).** `paper.ts` renders `nothing here` for an empty board. Our analogue:
  an empty projection → a valid **minimal `<svg>`** (root only, no fabricated boxes/edges); a
  card without a `plainTitle` → no fabricated face text.
- **One-way authority.** "this layer READS the graph + projection and never writes"
  (`paper.ts:15`). We only read; the input `projection` is returned reference-unchanged and
  stays frozen.
- **Frozen lookup tables.** `paper.ts` keeps `STATE_EMOJI`/`STATE_CLASS` as `Object.freeze`
  tables with the same hex family the SVG palette will reuse (`#E8F5E9`/`#66BB6A` done,
  `#FFF8E1`/`#FFB300` active, `#ECEFF1`/`#90A4AE` todo).

## Testing precedent (`paper.test.ts` / `svg.test.ts` / `project.test.ts`)

- `bun:test`; gates are `bun test` (`check:test`) and `tsc --noEmit` (`check:typecheck`).
- Tests are **pure-function tests over fabricated inputs**. paper/project build frozen graphs
  via `buildGraph` then `projectGraph(graph, DESIGNER_PRESET)`; svg.test asserts over plain
  numbers/strings. T-055-02 can use BOTH: a real `projectGraph` projection (integration-ish,
  for the AC counts) and a small hand-built `Projection` literal (focused unit assertions:
  escaping, palette override, per-card structure).
- `noUncheckedIndexedAccess: true` (tsconfig) — array/record index access yields `T |
  undefined`; the house fix is `!` on known-safe indexes (svg.test.ts) or `??` fallbacks.
- Determinism is tested by `expect(f(x)).toBe(f(x))` (paper.test:120/199, svg.test:141).

## Assumptions & open questions (to resolve in Design)

1. **What is `overlays?` for an already-projected IR?** Face prose was baked in at
   `projectGraph` time, so it cannot mean prose overlays here. Design picks the honest
   meaning for THIS consumer (a palette override + optional `<title>`), documenting the
   divergence from `paper.ts`'s prose `overlays`.
2. **No lane-background rects.** The AC counts "exactly one `<rect>` per card"; a lane
   backdrop would inflate that count. Lanes are delimited by their label + card column only.
3. **Distinguishing group labels from face texts** (both are `<text>`) for the AC's
   "one group label per group" — Design fixes a font-size convention so the count is exact.
4. **Text overflow.** `CARD_W` is fixed; long faces/labels overflow. A pure, deterministic
   character clip is the candidate (no font metrics — those would break purity/determinism).
5. **Edge endpoints.** `CardBox.cx/cy` are precomputed centers — edges anchor center→center.
   Defensive skip if an endpoint id is absent (cannot happen for a well-formed projection).
