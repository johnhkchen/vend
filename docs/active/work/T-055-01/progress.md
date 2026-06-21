# T-055-01 — Progress

_What got done, what deviated, what remains. Updated through Implement._

## Status: COMPLETE — implemented, tested, typechecked, committed.

Commit `1106329` — `feat(present): SVG primitives + deterministic swimlane geometry (T-055-01)`.

## Steps executed (against plan.md)

| Step | Plan | Outcome |
|---|---|---|
| 1 | Types + frozen `LAYOUT` constants | Done. `RectAttrs`/`TextAttrs`/`LineAttrs`/`CardBox`/`LaneBox`/`SvgLayout` + the frozen constant table, values as planned (`CARD_W=220, CARD_H=64, PAD=24, …`). |
| 2 | `xmlEscape` + `num` | Done. `xmlEscape`: `&`-first chained replace over the four AC chars. `num` simplified to `String(n + 0)` (folds `-0`; `String` already collapses `12.0`). |
| 3 | Primitives | Done. `svgRect`/`svgText`/`svgLine` with hand-fixed attribute order via `joinAttrs`; `svgText` escapes `content` internally. |
| 4 | `layout` | Done. Column-per-group swimlanes, integer grid, `cx`/`cy` centers, honest-empty `2·PAD` canvas, frozen output. |
| 5 | Test suite | Done. `svg.test.ts` — 21 tests / 123 assertions, four `describe` blocks (escape, primitives, geometry, purity). |
| 6 | Full gate + commit | Done. `bun test` 1239 pass / 0 fail; `tsc --noEmit` clean; committed (precommit hook re-ran tests green). |

## AC verification

- **Geometry: N groups of M cards → deterministic non-overlapping boxes** — `layout` block:
  count-per-lane, pairwise non-overlap over a 4×3 fixture, input-order, in-canvas bounds,
  deep-equal determinism. ✓
- **XML-escape neutralizes `<`,`>`,`&`,`"`** — `xmlEscape` block: per-char, `&`-first
  (no double-escape), plus `svgText` proving face text cannot inject markup. ✓
- **Each primitive byte-identical for identical input** — primitives block: exact-string
  assertions + `toBe` repeat for all three emitters. ✓
- **No fs/clock/random (`Date`/`Math.random` absent)** — purity-guard block scans the module
  source (comments stripped) for `Date`, `Math.random`, and `fs` imports — all absent. ✓

## Deviations from plan

1. **`num` body** — planned a trailing-`.0` trim; `String` already does that, so the body is
   `String(n + 0)` (the only real work is folding `-0`). Behaviorally identical, simpler. No
   impact on the AC.
2. **Test-file non-null assertions** — `tsconfig` has `noUncheckedIndexedAccess: true`, so
   indexed access into `lanes`/`cards` is `T | undefined`. Adopted the house convention (the
   `!` non-null assertion used throughout `project.test.ts`) rather than restructuring. Caught
   by the first `tsc --noEmit` run; fixed; clean on re-run.
3. **`maxBottom` literal-type annotation** — `PAD` destructured from the frozen `LAYOUT` carries
   the literal type `24`, so `let maxBottom = PAD` inferred `24` and rejected the later numeric
   assignment. Annotated `let maxBottom: number = PAD`. No behavior change.

None of these touched scope or the AC; all three were mechanical type-correctness fixes.

## Risk register outcome (from plan.md)

- **R1 (float coords)** — non-event. All constants integer; `cx/cy` divide by 2 over even
  dimensions → integers; `num` guards regardless.
- **R2 (attribute-order drift)** — held. Emitters write a hand-fixed sequence; tested by exact
  strings.
- **R3 (escape order)** — held. `&`-first, tested explicitly (`&lt;` → `&amp;lt;`).
- **R4 (scope creep)** — held. No `<svg>` wrapper, no palette, no IR import — all left to T-055-02.
- **R5 (purity-guard false confidence)** — accepted; the determinism `toBe` tests plus the
  source scan are sufficient for this tiny visibly-pure leaf.

## What remains (downstream, NOT this ticket)

- **T-055-02** — `projectionToSvg(projection, overlays?)`: import `{ layout, svgRect, svgText,
  svgLine }`, map `groups.map(g => g.cards.length)` → `layout`, route faces/colors/labels/edges,
  wrap in the `<svg>` document, own the color→palette table and honest-empty minimal `<svg>`.
- **T-055-03** — the CLI/file seam writing the staged `.svg`.
