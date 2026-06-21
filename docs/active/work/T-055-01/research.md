# T-055-01 — Research: SVG primitives & deterministic layout

_Descriptive map of the territory. What exists, where, how it connects. No solutions here._

## The ticket in one line

Land the **leaf layer** for the SVG renderer (E-055): pure SVG-emitter primitives
(XML-escaped `<rect>`/`<text>`/`<line>` builders) plus a hand-rolled, dependency-light
grid/swimlane geometry (group→column, card→box coordinates). This mirrors `paper.ts`'s
`sanitizeId`/`mmLabel`/helper slice — the pure primitives the renderer core (T-055-02)
will later compose. T-055-01 emits **strings and coordinates**; it does NOT consume the
`Projection` IR itself (that is T-055-02's `projectionToSvg`).

## The E-055 slice and where this ticket sits

Story S-055-01 decomposes the epic into three tickets, a clean leaf→core→seam stack:

- **T-055-01 (this)** — pure SVG primitives + geometry. `depends_on: []`. The leaf.
- **T-055-02** — `projectionToSvg(projection, overlays?) -> string`, the THIRD consumer of
  the Projection IR, composing this ticket's primitives/geometry. `depends_on: [T-055-01]`.
- **T-055-03** — a thin CLI/file seam: load board → `projectGraph` → `projectionToSvg` →
  write staged `.svg`. `depends_on: [T-055-02]`.

So this ticket is deliberately **IR-agnostic**: it must not import `project.ts` types or
walk a `Projection`. It exposes (a) string emitters and (b) a layout function over abstract
shapes (counts of groups/cards). T-055-02 is the one that maps `ProjectionGroup[]` onto the
geometry and feeds card faces into the text primitive.

## The precedent to mirror — `src/present/paper.ts`

`paper.ts` is the canonical "second consumer" of the Projection IR and the house template
for a pure renderer. Its leaf-helper slice (lines ~87–156) is exactly what T-055-01 mirrors:

- `sanitizeId(id)` (`paper.ts:90`) — `id.replace(/[^A-Za-z0-9_]/g, "_")`: a total, pure,
  single-`replace` sanitizer producing Mermaid-safe ids. Our XML-escape helper is the
  same shape: total, pure, string-in/string-out.
- `mmLabel(text)` (`paper.ts:96`) — chained `.replace()` calls that neutralize the chars
  that break Mermaid `["…"]` syntax (`"`, `[`, `]`, newlines, whitespace runs). The SVG
  analogue neutralizes the chars that break XML text/attribute content (`<`, `>`, `&`,
  `"`). Note `mmLabel` escapes for **Mermaid**, not XML — there is no existing XML escaper
  in the tree, so T-055-01 introduces it.
- The header comment block (`paper.ts:1–30`) states the **PURITY** house pattern explicitly:
  "everything here is pure string building — deterministic walks, table lookups, joins —
  no fs, clock, network, or native addon." T-055-01 inherits this contract verbatim.

`paper.ts` keeps `const STATE_EMOJI = Object.freeze({…})` lookup tables and small private
helpers (`stateEmoji`, `stateClass`) — the frozen-table idiom T-055-01 will reuse for any
layout constants.

## The shapes the geometry will eventually position (`src/present/project.ts`)

Although T-055-01 does not import these, they pin the geometry's target so its abstraction
fits T-055-02 cleanly:

- `Projection { groupBy, density, colorLanguage, metaphor, groups: ProjectionGroup[], links: ProjectionLink[] }`
  (`project.ts:68`), deeply frozen via `deepFreeze` (T-021-01).
- `ProjectionGroup { key, label, cards: readonly ProjectedCard[] }` (`project.ts:50`) — the
  geometry renders one of these as a **column/swimlane**: a label + a vertical stack of card boxes.
- `ProjectedCard { card: Card, color: string }` (`project.ts:42`) — one card box; `card.face`
  carries the plain text the `<text>` primitive escapes, `color` is a semantic token (e.g.
  `"done"`, `"high"`) the renderer maps to a palette (palette mapping is T-055-02's concern).
- `ProjectionLink { from, to, kind: "depends_on" }` (`project.ts:59`) — an edge between two
  card boxes; T-055-02 needs each card box's center/anchor coordinates to draw a `<line>`.

The geometry's job in this ticket: given **N groups, each with M cards**, return a
deterministic, non-overlapping set of column rects and card box rects, plus the overall
canvas dimensions. T-055-02 then keys card boxes by id to route faces/colors/edges.

## Determinism & purity constraints (project-wide, load-bearing)

This is the strongest current in the codebase and the spine of the AC:

- **P5 / byte-identical output.** `project.ts` and `paper.ts` both promise "same graph +
  same spec → byte-identical" via deterministic sorts and no clock/random. The recent
  graph-engine work (E-054, T-054-03) formalized determinism as a *tested equivalence*,
  not an assertion. T-055-01's primitives must be referentially transparent: identical
  input → identical string, every time.
- **No `Date` / `Math.random`.** The AC requires the module import no fs/clock/random.
  Note the environment-level prohibition on `Date.now()`/`Math.random()` already present in
  the house style — the geometry is integer arithmetic over inputs only.
- **Honest-empty (IA-4).** `paper.ts` renders `nothing here` for an empty board rather than
  fabricating nodes. The geometry analogue: zero groups (or a group with zero cards) must
  produce a valid, empty-but-well-formed layout (e.g. a minimal canvas), never NaN
  coordinates or a crash. T-055-02 turns that into the "valid minimal `<svg>`" AC clause.

## Testing precedent (`src/present/paper.test.ts`, `project.test.ts`)

- `bun:test` (`import { describe, expect, test } from "bun:test"`). Run via `bun test`
  (package.json `check:test`). Typecheck gate: `tsc --noEmit` (`check:typecheck`).
- Tests are **pure-function tests over fabricated inputs** — no fs, no live model. The
  paper/project tests build frozen graphs via `buildGraph`; T-055-01 needs none of that —
  its inputs are plain numbers/strings, so tests are even simpler (call helper, assert
  string; call layout, assert rect coordinates & non-overlap).
- Determinism is tested by `expect(f(x)).toBe(f(x))` (`paper.test.ts:120`,`199`). T-055-01
  mirrors this for both primitives and geometry.

## Files & boundaries relevant to this ticket

- `src/present/paper.ts` — the precedent (purity, escaping, frozen-table idiom). READ-only ref.
- `src/present/project.ts` — the IR shapes the geometry targets. NOT imported by T-055-01.
- `src/present/translate.ts` — has `scrubFace` (jargon stripping) and chained-`replace`
  helpers; a style reference for total string helpers, not a dependency.
- No existing `svg` code anywhere in `src/` (grep empty) — this is greenfield within the
  module. New file(s) live alongside the other `src/present/*` renderers.

## Assumptions & open questions (to resolve in Design)

1. **One file or two?** Primitives and geometry could share one `svg.ts`, or split. Both are
   leaf concerns; `paper.ts` keeps its helper slice in-file. Lean: one module, two sections.
2. **Swimlane orientation.** Column-per-group (vertical card stack) vs. row-per-group. The
   epic says "swimlane/column" — Design picks one and justifies (column-per-group reads as
   the natural board layout and makes card stacking trivial).
3. **Primitive API shape.** Options object vs. positional args; how much styling
   (`fill`/`stroke`) the primitive bakes vs. leaves to the caller (T-055-02 owns palette).
4. **Geometry input type.** `number[]` of card-counts vs. a small `{ cards: n }[]` shape vs.
   generic over a card payload. Must stay IR-agnostic but ergonomic for T-055-02.
