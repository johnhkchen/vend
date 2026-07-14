# T-055-02 — Plan: ordered implementation steps

_Sequenced, independently verifiable steps. Each small enough to commit atomically._

## Testing strategy

- **Unit / pure** — the whole suite. No live model, no fs at runtime (the purity test reads
  source text, not behavior). Two fixture styles: a real `projectGraph(miniGraph, DESIGNER_PRESET)`
  projection for the AC counts (proves the real IR shape flows through), and a hand-built
  `Projection` literal for focused escaping/options/structure assertions.
- **Determinism** — `expect(projectionToSvg(p)).toBe(projectionToSvg(p))` (P5), plus
  reference-unchanged + still-frozen assertions for one-way authority.
- **Gates** — `bun run check:typecheck` (tsc `--noEmit`, with `noUncheckedIndexedAccess`) and
  `bun test` both green before commit. This IS the AC's "deterministic test suite passes."

## Verification criteria (the AC, made executable)

| AC clause | Executable check |
|---|---|
| one `<rect>` per card | `svg.match(/<rect/g).length === cardCount` |
| one group label per group | `svg.match(/font-size="14"/g).length === groups.length` |
| one `<line>` per `depends_on` | `svg.match(/<line/g).length === links.length` |
| empty → minimal `<svg>` | contains `<svg`/`</svg>`, no `<rect`/`<line` |
| byte-identical twice | `toBe` self-equality on the same frozen projection |
| reference-unchanged | `p`/`p.groups` refs identical + `Object.isFrozen(p)` after render |

## Steps

### Step 1 — `projection-svg.ts`: types, palette, constants
Header comment + `SvgBoxStyle`/`SvgOverlays`, `DEFAULT_PALETTE` (9 tokens, frozen) + `NEUTRAL`,
and the `LABEL`/`FACE`/`CARD`/`EDGE`/`FACE_CHAR_BUDGET` constants. Hex reuses paper.ts's family.
*Verify:* `tsc --noEmit` clean (types resolve, frozen tables well-typed).

### Step 2 — pure helpers
`styleFor` (`?? ` chain), `clip` (truncate + `…`), `svgTitle` (`xmlEscape`), `indexBoxes` (the
positional id→box join, `noUncheckedIndexedAccess`-guarded with `?? `/`if (!x) continue`).
*Verify:* `tsc --noEmit` clean; helpers are total (no `!` on unknown indexes).

### Step 3 — `projectionToSvg`
Assemble in the fixed order (root → optional title → edges → per-lane label + per-card
rect[+face]) → `join("\n")`. `overlays.palette ?? DEFAULT_PALETTE`. Reads only; never mutates.
*Verify:* `tsc --noEmit` clean.

### Step 4 — `projection-svg.test.ts`
Fixtures (`miniGraph`/`emptyGraph`/`fakeProjection`) + one `describe` per AC clause + an
escaping/options block + a source-scan purity block (no `Date`/`Math.random`/fs import in the
module). Compute expected counts from the projection itself (robust to `DESIGNER_PRESET`'s
`groupBy`), not hard-coded group totals.
*Verify:* `bun test` green (new suite + full suite ~1218 prior tests unaffected).

### Step 5 — gates + commit
Run `bun run check:typecheck` and `bun test`. On green, commit both files atomically:
`feat(present): projectionToSvg — third Projection-IR consumer renders the work-graph as SVG (T-055-02)`.
*Verify:* working tree clean except the ticket/work artifacts; both gates green at HEAD.

## Risk register

| Risk | Likelihood | Mitigation |
|---|---|---|
| `noUncheckedIndexedAccess` errors on `lanes[g]`/`cards[c]`/`palette[token]` | high | `?? ` fallbacks + `if (!x) continue` guards from the start (svg.test.ts precedent); no `!` on IR-derived indexes. |
| `<rect>` count inflated by a stray lane/background rect | med | Decision 4: NO lane backdrop — only card rects emit `<rect>`; test asserts exact count. |
| label vs. face `<text>` ambiguity breaks the per-group-label count | med | font-size convention (14 labels / 13 faces); test counts `font-size="14"`. |
| float coordinate sneaks in → byte drift | low | all coords come from `layout` (integer-only) through `num()`; stroke widths are small ints. |
| over-long face/label overflows the SVG box | low (cosmetic) | deterministic `clip`; full text stays in the IR for a future per-card `<title>` (deferred). |
| an edge endpoint id missing from the box index | very low | defensive `if (!from||!to) continue`; cannot occur for a well-formed projection (every ticket is in one group). |

## Out of scope (explicit deferrals)

- CLI/file seam (load board → write staged `.svg`) — **T-055-03**.
- Per-card tooltips / full-text `<title>`, text wrapping, lane backdrops, legend — later polish.
- Any change to `svg.ts`, `project.ts`, or `paper.ts` — this ticket is additive only.
