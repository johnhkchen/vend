# T-055-01 — Structure: file-level blueprint

_The shape of the code — files, exports, boundaries, ordering. Not the code itself._

## Files

| File | Action | Purpose |
|---|---|---|
| `src/present/svg.ts` | **create** | The leaf SVG toolkit: `xmlEscape`, the three primitive emitters, the layout constants, and `layout()`. Pure, IR-agnostic. |
| `src/present/svg.test.ts` | **create** | `bun:test` pure-function suite proving all four AC clauses. |

No other files are touched. T-055-01 introduces no imports into the module and is imported by
nothing yet (T-055-02 will import from `svg.ts`).

## `src/present/svg.ts` — internal organization (top to bottom)

Follows the `paper.ts` ordering idiom: header doc-block → public types → frozen constants →
pure leaf helpers → primitives → geometry.

### 1. Header doc-block

A comment block in the `paper.ts` house voice stating: the leaf layer of E-055, the THIRD
consumer's primitives (consumer is T-055-02), **PURITY** (no fs/clock/network/native; no
`Date`/`Math.random`), **IR-agnostic** (imports nothing from `project.ts`), and **DETERMINISM**
(fixed attribute order, integer geometry → byte-identical output).

### 2. Public types

```
export interface RectAttrs   { x; y; width; height; fill?; stroke?; strokeWidth?; rx?; }
export interface TextAttrs   { x; y; content; fontSize?; fill?; anchor?; }   // anchor: text-anchor
export interface LineAttrs   { x1; y1; x2; y2; stroke?; strokeWidth?; }
export interface CardBox     { x; y; width; height; cx; cy; }
export interface LaneBox     { index; x; labelX; labelY; cards: readonly CardBox[]; }
export interface SvgLayout   { width; height; lanes: readonly LaneBox[]; }
```

All fields `readonly` (the model.ts/project.ts immutability idiom). Numbers are integers.

### 3. Layout constants — one frozen table

```
const LAYOUT = Object.freeze({
  PAD, LANE_GAP, LANE_LABEL_H, LANE_PAD,
  CARD_W, CARD_H, CARD_GAP_Y,
});
```

Single source of truth for geometry; mirrors `paper.ts`'s `Object.freeze({...})` tables.
Concrete values chosen in Plan/Implement (e.g. CARD_W 220, CARD_H 64, gaps 16–24, PAD 24).

### 4. Pure leaf helpers

- `xmlEscape(s: string): string` — **exported**. Chained `.replace()`: `&` first, then `<`,
  `>`, `"`. Total, pure. (Decision 4.)
- `num(n: number): string` — private. Normalizes a coordinate to a stable string (no locale,
  no exponential, trims a trailing `.0`). Guards byte-identity across `12` vs `12.0`.
- `attr(name, value)` / inline join — private helper to assemble `name="value"` with escaped
  string values, skipping `undefined` optionals so absent attributes never emit.

### 5. Primitive emitters (exported)

- `svgRect(a: RectAttrs): string` → `<rect x=".." y=".." width=".." height=".." [fill=..]
  [stroke=..] [stroke-width=..] [rx=..]/>`. Fixed attribute order; optionals omitted when
  absent.
- `svgText(a: TextAttrs): string` → `<text x=".." y=".." [font-size=..] [fill=..]
  [text-anchor=..]>{xmlEscape(content)}</text>`. Escaping is internal & mandatory.
- `svgLine(a: LineAttrs): string` → `<line x1=".." y1=".." x2=".." y2=".." [stroke=..]
  [stroke-width=..]/>`.

Each returns a single line, no trailing newline (the consumer joins). No element has any
clock/random/fs touch — pure string assembly.

### 6. Geometry (exported)

- `layout(groupSizes: readonly number[]): SvgLayout` — the one public geometry entry.
  - Walks `groupSizes` in order; for each group computes `laneX`, the label anchor, and the
    stacked `CardBox[]` via the Decision-5 formulas.
  - Accumulates canvas `width`/`height` from max extents + `PAD`.
  - Empty input → `{ width: 2*PAD, height: 2*PAD, lanes: [] }` (honest-empty geometry).
  - Returns a **frozen** object (`Object.freeze` on the result + nested arrays) to match the
    house immutable-output discipline; no input is mutated (there is no input object, only a
    number array, which is read, never written).

## Public surface (what T-055-02 will import)

```
import { svgRect, svgText, svgLine, xmlEscape, layout } from "./svg.ts";
import type { SvgLayout, LaneBox, CardBox, RectAttrs, TextAttrs, LineAttrs } from "./svg.ts";
```

Boundary contract for the consumer: T-055-02 calls `layout(groups.map(g => g.cards.length))`,
then for each `LaneBox`/`CardBox` emits a `svgRect` (color→fill/stroke from the palette it
owns), a `svgText` for the face, a `svgText` for the lane label, and for each `ProjectionLink`
a `svgLine` from the source `CardBox` `(cx,cy)` to the target's. T-055-01 owns none of that
mapping — only the primitives and coordinates.

## `src/present/svg.test.ts` — test organization

Four `describe` blocks, one per AC clause, plus determinism woven through:

1. **`xmlEscape`** — neutralizes `<`, `>`, `&`, `"`; `&`-first (no double-escape); a clean
   string is unchanged; idempotent on already-safe input is NOT asserted (escaping is not
   idempotent by design — assert the exact entity output instead).
2. **primitives** — each emitter produces the expected element string with fixed attribute
   order; optionals omitted when absent, present when given; `svgText` escapes its content
   (a `<script>`-ish face becomes `&lt;script&gt;`); **byte-identical** on repeated identical
   input (`expect(f(x)).toBe(f(x))`).
3. **geometry / `layout`** — given N groups of M cards: one `LaneBox` per group, one `CardBox`
   per card; **non-overlap** checked by a pairwise rect-intersection assertion across all
   boxes; lanes in input order; canvas dimensions bound all boxes; empty input → minimal
   canvas, zero lanes (honest-empty); deterministic (`toBe`/deep-equal on repeat).
4. **purity guard** — read `svg.ts` source text and assert it contains no `Date`/`Math.random`/
   `import ... fs` tokens (the same "Date/Math.random absent" AC clause, enforced as a test);
   alternatively assert via no runtime imports. (Chosen approach finalized in Plan.)

## Ordering of changes

1. Types + constants (no behavior) — compiles immediately.
2. `xmlEscape` + `num` + primitives — unit-testable in isolation.
3. `layout` — depends only on constants/types.
4. Tests last (or alongside each step), then commit once green.

A single atomic commit is appropriate: the file is one cohesive leaf with no partial-value
intermediate state worth committing separately.
