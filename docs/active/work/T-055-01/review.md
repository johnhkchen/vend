# T-055-01 — Review

_Handoff document. What a reviewer needs to understand the work without reading every diff._

## Summary

Landed the **leaf layer** of E-055's projection-to-svg renderer: a pure, IR-agnostic SVG
toolkit. Two new files, one atomic commit (`1106329`). No existing files modified, no public
behavior elsewhere touched. The renderer core (T-055-02) and file seam (T-055-03) are unblocked
to compose this.

## Files changed

| File | Lines | What |
|---|---|---|
| `src/present/svg.ts` | ~230 (new) | `xmlEscape` + private `num`/attr helpers; `svgRect`/`svgText`/`svgLine` primitive emitters; the frozen `LAYOUT` constant table; `layout()` swimlane geometry; public types `RectAttrs`/`TextAttrs`/`LineAttrs`/`CardBox`/`LaneBox`/`SvgLayout`. |
| `src/present/svg.test.ts` | ~150 (new) | 21 pure-function tests / 123 assertions across four `describe` blocks (escape, primitives, geometry, purity). |

## What it does

- **Primitives.** `svgRect`/`svgText`/`svgLine` emit single SVG elements with a hand-fixed
  attribute order and `undefined`-optional omission, so identical input is byte-identical output.
  `svgText` runs its free-form `content` through `xmlEscape` internally — face text cannot inject
  markup.
- **`xmlEscape`.** Neutralizes the four AC chars (`<`,`>`,`&`,`"`), ampersand-first so introduced
  entities are never double-escaped. The XML analogue of `paper.ts`'s `mmLabel`.
- **`layout(groupSizes)`.** Column-per-group swimlanes: groups left→right, cards stacked
  top→down. Returns a frozen `SvgLayout` of canvas dimensions + lanes + card boxes (each with a
  precomputed `cx`/`cy` center for edge anchoring). Empty input → a minimal `2·PAD` canvas
  (honest-empty). Integer arithmetic throughout → byte-stable coordinates.

## Design decisions worth a reviewer's eye

1. **IR-agnostic by construction.** `svg.ts` imports nothing from `project.ts`/`spec.ts`; the
   geometry takes plain card counts (`number[]`), not `ProjectionGroup[]`. This keeps the
   leaf→core decomposition (S-055-01) crisp and the determinism guarantee airtight — there is
   no graph/spec/clock in scope to leak nondeterminism. The mapping from the IR onto this
   geometry is deliberately T-055-02's job. **If a reviewer expected `projectionToSvg` here, that
   is by design the next ticket.**
2. **No `<svg>` document wrapper.** This layer stops at element-level primitives + coordinates.
   The document root, the color→palette table, and the honest-empty *minimal `<svg>`* string are
   T-055-02 concerns. Scope was held deliberately (plan R4).
3. **Escaping scoped to the four named chars** — `'` is intentionally NOT escaped (legal in
   double-quoted XML and in text content; adding it would be scope creep beyond the AC).

## Test coverage

- **All four AC clauses are covered by an executable test** (see progress.md's AC table).
  Determinism is asserted directly (`toBe` for strings, deep-equal for the layout). Non-overlap
  is a pairwise rect-intersection check over a 4×3 fixture. Purity ("Date/Math.random absent") is
  an executable source-scan, not just a claim.
- **Suite:** `bun test src/present/svg.test.ts` → 21 pass / 0 fail. **Full suite:** 1239 pass /
  0 fail. **Typecheck:** `tsc --noEmit` clean. Precommit hook re-ran tests green at commit time.

### Coverage gaps / honest limits

- **The purity guard is a source-text scan**, not a sandbox. It would miss obfuscated
  nondeterminism (e.g. `globalThis["Da"+"te"]`). Acceptable for a ~230-line visibly-pure module;
  the determinism `toBe` tests are the real backstop. Flagged, not hidden.
- **Text width vs. fixed `CARD_W`.** Boxes are a fixed width; long face text is not measured or
  wrapped here (font metrics would break purity/determinism). T-055-02 owns any truncation/wrap
  policy when it routes faces into `svgText`. Not a defect in this leaf — a documented boundary.
- **No rendered-SVG validity assertion** (e.g. parsing the output as XML). The primitives are
  unit-asserted by exact string; whole-document validity is meaningfully testable only once
  T-055-02 assembles the `<svg>` root, where the epic's "opens in any viewer" AC lives.

## Open concerns / handoff notes for T-055-02

- Consume via `import { layout, svgRect, svgText, svgLine, xmlEscape } from "./svg.ts"`; call
  `layout(groups.map(g => g.cards.length))`; key card boxes back to ids by parallel index (input
  order is preserved and matches the IR's deterministic order).
- Draw `depends_on` edges from the source `CardBox` `(cx,cy)` to the target's — centers are
  precomputed for exactly this.
- Layout constants live in the private frozen `LAYOUT`; if T-055-02 needs to tune spacing, prefer
  exporting the table over duplicating magic numbers.

## Critical issues needing human attention

None. The ticket is self-contained, green on all gates, and within scope. No migration, no
breaking change, no dependency added.
