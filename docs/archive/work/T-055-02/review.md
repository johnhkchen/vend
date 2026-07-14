# T-055-02 — Review: projection-to-svg renderer core

_Handoff. What a reviewer needs to understand the work without reading every diff._

## What shipped

`projectionToSvg(projection, overlays?) -> string` — the **third consumer** of the E-021
Projection IR — turning a `Projection` into a single static SVG: one labeled swimlane per
`ProjectionGroup`, one `<rect>` + face `<text>` per `ProjectedCard` (colored by its semantic
token), one `<line>` per `depends_on` `ProjectionLink` (anchored card-center → card-center),
wrapped in an `<svg>` root sized to T-055-01's deterministic `layout()`. It is the CORE that
joins the IR (`project.ts`) to the toolkit (`svg.ts`), and it owns the color-token → palette
decision svg.ts deliberately left open.

Commit `2312f9a` (feat, on `main`, mirroring T-055-01's commit shape).

## Files

| File | Change | Lines |
|---|---|---|
| `src/present/projection-svg.ts` | **created** — the renderer core + `SvgOverlays`/`SvgBoxStyle`/`DEFAULT_PALETTE` | ~165 |
| `src/present/projection-svg.test.ts` | **created** — 16 pure tests, one per AC clause + overlays + purity | ~205 |

No existing module touched — purely additive, so it cannot regress E-021 or T-055-01.

## How it works (the one entry)

1. `layout(projection.groups.map(g => g.cards.length))` → integer-only swimlane geometry.
2. `indexBoxes` — a **positional** id→box join: `layout` preserves input order, so
   `lanes[g].cards[c]` is exactly the box for `groups[g].cards[c]`. Built once so edges anchor
   on precomputed `cx/cy` centers.
3. Emit in a fixed order (determinism = stable order): `<svg>` root → optional `<title>` →
   edges (beneath) → per group: one label `<text>` (font-size 14) then per card one `<rect>`
   (palette fill/stroke) + face `<text>` (font-size 13, only when `plainTitle` present).
4. `out.join("\n")`. Reads only; the input projection is never touched.

## Test coverage

16 tests, 33 assertions, all green; full suite **1255 pass / 0 fail**. Every AC clause has a
direct executable check (see the table in `progress.md`). Two fixture styles:

- a **real** `projectGraph(miniGraph, DESIGNER_PRESET)` projection — proves the genuine IR shape
  flows through and pins the counts (5 cards → 5 rects, 1 link → 1 line);
- a **hand-built** `Projection` literal — focused assertions on XML escaping (a label with
  `<`,`>`,`&`,`"`), the palette override + fallback, and the `<title>` honest-empty path.

Plus a source-scan purity guard (no `Date` / `Math.random` / fs import), mirroring svg.test.ts.

### Coverage gaps (honest accounting)

- **Visual fidelity is not asserted** — tests check element COUNTS, escaping, determinism, and
  structure, not pixel layout or that the SVG renders in a browser. That is inherent to a static
  string renderer; the geometry's non-overlap is already covered by T-055-01's `svg.test.ts`.
- **`clip` truncation has no dedicated test.** The ellipsis path only triggers above 30 chars;
  fixture titles are short, so the branch is currently exercised indirectly (no over-budget
  fixture). Low risk (pure string slice), but a targeted case would close it.
- **Cross-group edge geometry** is asserted to be present and well-formed, not that the specific
  endpoint coordinates equal the two card centers numerically. The center anchoring is structural
  (uses `box.cx/cy`) and T-055-01 already tests `cx/cy === midpoint`.

## Open concerns / deferrals (none blocking)

1. **`overlays?` diverges in meaning from paper.ts** (palette/title vs. per-node prose) — by
   design (design.md Decision 2): the IR already carries prose when we receive it. The signature
   *shape* and honest-empty *semantics* match; the *payload* is what this consumer can act on.
   A reviewer expecting prose overlays should read that decision.
2. **Text overflow is clipped, not wrapped** — `CARD_W` is fixed and we refuse font metrics
   (purity/determinism). Long faces truncate with `…`; full text remains in the IR for a future
   per-card `<title>` tooltip (deferred polish).
3. **No lane backdrop / legend / state chips on cards** — deliberately omitted: a lane backdrop
   would inflate the AC's one-rect-per-card count, and chips/legend have no AC. Candidate polish.
4. **T-055-03 (the CLI/file seam) is unblocked** — it imports `projectionToSvg` + `SvgOverlays`
   (and may reference `DEFAULT_PALETTE`), runs `projectGraph` over a loaded board, and writes a
   staged `.svg`. The public surface this ticket exposes is exactly what that seam needs.

## Reviewer checklist

- [x] AC fully satisfied — every clause has a passing executable check.
- [x] Purity / determinism — no clock/random/fs; byte-identical on repeat; source-scan guard.
- [x] One-way authority — input projection returned reference-unchanged and still frozen.
- [x] Honest-empty — empty projection → minimal valid `<svg>`; no fabricated boxes/edges/title.
- [x] Layering intact — `svg.ts` not edited; its no-IR-import invariant preserved.
- [x] Gates green — `tsc --noEmit` clean, `bun test` 1255/0, pre-commit hook green.
