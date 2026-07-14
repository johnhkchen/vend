# T-055-02 — Design: projection-to-svg renderer core

_Options, tradeoffs, decisions — grounded in the Research map. What we build, what we reject._

## What this ticket must deliver (from the AC)

A deterministic, no-live-model test suite that proves `projectionToSvg`:

1. emits **exactly one `<rect>` per card**,
2. emits **one group label per group**,
3. emits **one `<line>`/edge per `depends_on` link**,
4. renders an **empty projection** as a valid minimal `<svg>` (honest-empty),
5. renders the **same frozen projection twice byte-identically** (P5), and
6. returns the input projection **reference-unchanged** (never written back).

Every clause is a purity/determinism obligation. The design space is small; discipline is the point.

## Decision 1 — One core file `src/present/projection-svg.ts`

**Options.** (a) New `projection-svg.ts` beside `svg.ts`. (b) Add `projectionToSvg` into
`svg.ts`. (c) Extend `paper.ts` with an SVG variant.

**Decision: (a) `src/present/projection-svg.ts` + `projection-svg.test.ts`.**

**Why.** T-055-01's `svg.ts` is the LEAF and is *defined* by importing nothing from the IR
(its header makes that a load-bearing invariant — "Keeping the IR out of scope is what makes
the determinism guarantee airtight"). `projectionToSvg` is the IR-consuming CORE; folding it
into `svg.ts` would break that invariant and fuse the two DAG nodes S-055-01 deliberately
split. (c) `paper.ts` is the Mermaid/markdown consumer with its own state vocabulary; an SVG
renderer is a parallel sibling, not an extension. A new file is the one import site T-055-03
will later wire to a CLI seam.

## Decision 2 — `overlays?` means render-time visual options, not prose

**The tension.** `paper.ts`'s `overlays` are per-node authored PROSE threaded into
`projectGraph`. But `projectionToSvg` receives an **already-projected** `Projection` — face
prose is baked into `card.face` already. Re-accepting prose overlays would be dead weight.

**Decision.** The second parameter keeps the `(IR, overlays?)` SHAPE but, for this consumer,
carries the two things the SVG layer genuinely owns and a caller might genuinely override:

```ts
interface SvgOverlays {
  readonly palette?: Readonly<Record<string, SvgBoxStyle>>; // color-token → {fill, stroke}
  readonly title?: string;                                  // an accessible <title> element
}
```

Both optional; both **honest-empty** — omitted `palette` → the built-in `DEFAULT_PALETTE`;
omitted `title` → no `<title>` element emitted (never a fabricated caption). This honors the
mirror in shape and purpose (an optional, omit-friendly options bag) without inventing a prose
path the IR already satisfied. The divergence is deliberate and documented here.

**Rejected:** accepting `ProjectionOverlays` and re-projecting — that would require the graph
+ spec we do not have and were explicitly not handed (we consume the IR, not the graph).

## Decision 3 — The renderer owns the palette (semantic token → {fill, stroke})

**Decision.** A frozen `DEFAULT_PALETTE: Record<string, SvgBoxStyle>` maps every semantic
color token `colorFor` can emit to a `{ fill, stroke }` pair, with a `default` neutral and a
hard-coded `NEUTRAL` final fallback:

```
done → green   in_progress → amber   open/ready → slate
critical → red   high → orange   medium → yellow   low → lime   default → grey
```

Resolution: `palette[token] ?? DEFAULT_PALETTE[token] ?? NEUTRAL` — a caller's partial palette
override falls back to the built-in per-token, then to neutral grey. Hex values reuse
`paper.ts`'s `classDef` family so the two surfaces read consistently.

**Why.** svg.ts's header explicitly assigns the palette to T-055-02 ("the caller … owns the
palette"). A semantic token (not a hex) crossing the IR boundary is the E-021 stance —
"a SEMANTIC color token … the renderer owns the palette" (`project.ts:44`). Total + frozen,
so no unknown token can crash or vary (honest fallback to neutral).

## Decision 4 — SVG shape: root + edges-under-cards + labeled lanes; NO lane backdrop

**Decision.** Emit, in this fixed order (determinism = stable order):

```
<svg xmlns width H viewBox>            one root, sized to layout.{width,height}
  <title>…</title>                     iff overlays.title given
  <line …/> × links                    edges first → drawn beneath the boxes
  per group g:
    <text …>group label</text>         exactly one label per lane (font-size = LABEL)
    per card c:
      <rect …/>                        exactly one box per card (fill/stroke from palette)
      <text …>face</text>              iff card.face.plainTitle present (honest-empty)
</svg>
```

**No lane background `<rect>`.** AC clause 1 counts "exactly one `<rect>` per card"; a lane
backdrop would inflate that count to `cards + lanes`. Lanes are conveyed by their label band
and the column of card boxes alone. **Edges first** so the (opaque) card boxes paint over the
lines — a z-order nicety that costs nothing and is fully deterministic regardless.

**Distinguishing labels from faces.** Both are `<text>`. We fix **group labels at
`font-size="14"` and card faces at `font-size="13"`**, so "one group label per group" is
exactly testable as `count(/font-size="14"/) === groups.length` — robust and byte-stable.

## Decision 5 — Positional id→box index; edges anchor on precomputed centers

**Decision.** Because `layout` preserves input order and we feed it
`projection.groups.map(g => g.cards.length)`, lane/card boxes correspond **positionally**:
`lay.lanes[g].cards[c]` ↔ `projection.groups[g].cards[c]`. We build a `Map<id, CardBox>` from
that positional walk, then draw each link as one `<line>` from `boxes.get(from).{cx,cy}` to
`boxes.get(to).{cx,cy}`. A link whose endpoint id is absent is **skipped defensively** (cannot
occur for a well-formed projection, where every ticket sits in exactly one group).

**Why.** `cx/cy` exist precisely so the consumer "can anchor edges between card centers without
recomputing geometry" (`svg.ts:61`). The positional join needs no re-sort and inherits the IR's
determinism. Under `noUncheckedIndexedAccess`, both the index build and the link lookup are
`?? `/`if (!box) continue` guarded — total, no `!`-on-unknown.

## Decision 6 — Deterministic text clip; integer-only coordinates

**Decision.** A pure `clip(text, max)` truncates an over-budget face/label to `max-1` chars +
`"…"`; otherwise returns it unchanged. Applied to both group labels and card faces with one
fixed `FACE_CHAR_BUDGET`. All coordinates flow from `layout` (integers) straight into the
primitives' `num()` normalizer; stroke widths are small integers. So output is byte-stable.

**Why.** `CARD_W` is fixed and we refuse font metrics (a measured/native dependency that would
break purity + determinism — the same stance svg.ts took). A character clip keeps long titles
from overflowing wildly while staying a pure string op. Truncation is cosmetic, not semantic;
full text lives in the IR for any future tooltip/`<title>` per-card refinement (a deferral).

## Rejected alternatives (summary)

- **Re-projecting from graph+spec inside the renderer** — we are handed the IR, not the graph
  (Decision 2). Rejected; it would re-introduce the very coupling the layering removed.
- **Lane background rects / card drop-shadows / gradients** — inflate the `<rect>`-per-card
  count (AC clause 1) and add visual state with no AC. Deferred to a later polish ticket.
- **Per-card `<title>` tooltips with full untruncated text** — nice, but no AC and adds an
  element class the count tests would have to special-case. Deferred.
- **Wrapping face text across `<tspan>` lines** — needs width estimation (font metrics) to do
  well; non-deterministic in spirit. Clip instead.
- **Emitting `'`→`&apos;`** — out of svg.ts's escape scope (four chars); we reuse `xmlEscape`.
