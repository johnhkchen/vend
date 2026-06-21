# T-055-02 — Structure: file-level shape of the renderer core

_The blueprint — not code, but the shape of the code. Files, boundaries, interfaces, ordering._

## Files

| File | Disposition | Purpose |
|---|---|---|
| `src/present/projection-svg.ts` | **created** | The IR-consuming core: `projectionToSvg` + palette/options. |
| `src/present/projection-svg.test.ts` | **created** | Deterministic, no-live-model AC suite. |
| `src/present/svg.ts` | unchanged | Toolkit consumed (primitives + `layout` + `xmlEscape`). |
| `src/present/project.ts` | unchanged | IR types consumed (`Projection`/`ProjectionGroup`/`ProjectionLink`/`ProjectedCard`). |

No edits to existing modules — this ticket is purely additive (a new consumer), so it cannot
regress E-021/T-055-01. (T-055-03 will add the CLI/file seam that imports this module.)

## `src/present/projection-svg.ts` — internal organization

Header comment first (the house pattern: PURITY / THIRD-CONSUMER / ONE-WAY AUTHORITY /
HONEST-EMPTY / OWNS-THE-PALETTE), then top-to-bottom:

### 1. Imports (type-only IR, value toolkit)
```ts
import type { Projection } from "./project.ts";
import { layout, svgRect, svgText, svgLine, xmlEscape, type CardBox, type SvgLayout } from "./svg.ts";
```
IR import is **type-only** (erased) — the runtime dependency is just the pure toolkit. We do
NOT import `projectGraph`/`spec.ts`: we consume the IR, we don't build it.

### 2. Public option types
```ts
export interface SvgBoxStyle { readonly fill: string; readonly stroke: string; }
export interface SvgOverlays {
  readonly palette?: Readonly<Record<string, SvgBoxStyle>>;
  readonly title?: string;
}
```

### 3. Frozen constant tables (the single source of style truth, cf. paper.ts)
- `DEFAULT_PALETTE: Readonly<Record<string, SvgBoxStyle>>` — token → `{fill,stroke}` for
  `done`/`in_progress`/`open`/`ready`/`critical`/`high`/`medium`/`low`/`default`, each frozen.
- `NEUTRAL: SvgBoxStyle` — the hard fallback grey.
- `LABEL` / `FACE` / `CARD` / `EDGE` style constants (font sizes 14/13, fills, stroke widths,
  card `rx`, face inset) — frozen. `FACE_CHAR_BUDGET` — the clip width.

### 4. Pure private helpers
- `styleFor(token, palette): SvgBoxStyle` — `palette[token] ?? DEFAULT_PALETTE[token] ?? NEUTRAL`.
- `clip(text, max): string` — deterministic char truncation + `"…"`.
- `svgTitle(t): string` — `<title>${xmlEscape(t)}</title>` (svg.ts has no title primitive).
- `indexBoxes(projection, lay): Map<string, CardBox>` — the positional id→box join
  (`lanes[g].cards[c]` ↔ `groups[g].cards[c]`), `?? `/`if` guarded for noUncheckedIndexedAccess.

### 5. The one public entry
```ts
export function projectionToSvg(projection: Projection, overlays: SvgOverlays = {}): string
```
Body, in fixed emission order (Decision 4): compute `layout(groups.map(g => g.cards.length))`
→ build box index → push `<svg>` root → optional `<title>` → one `<line>` per resolvable link
→ per group: one label `<text>` then per card one `<rect>` (+ face `<text>` iff `plainTitle`) →
push `</svg>` → `out.join("\n")`. Reads only; allocates a fresh string; never touches
`projection`.

## Public interface (what leaves this module)

- `projectionToSvg(projection, overlays?) -> string` — the deliverable; the third IR consumer.
- `SvgOverlays`, `SvgBoxStyle` — the options surface, for T-055-03 (CLI) and tests.
- `DEFAULT_PALETTE` — exported so T-055-03/tests can reference or extend the built-in palette.

Everything else (`styleFor`, `clip`, `svgTitle`, `indexBoxes`, the style constants) is private.

## `src/present/projection-svg.test.ts` — shape

`import { describe, expect, test } from "bun:test"`, plus `buildGraph` + `DESIGNER_PRESET` +
`projectGraph` for a real projection, and a small hand-built `Projection` literal for focused
assertions. One `describe` block per AC clause:

1. **fixtures** — `miniGraph()` (mirrors paper.test: 2 epics → 3 stories → 5 tickets, one
   cross-story `depends_on` → exactly 1 link), `emptyGraph()`, and `fakeProjection()` (a hand
   built literal: 2 groups [2 cards, 1 card], 1 link, a label with `<`,`>`,`&`,`"` to prove
   escaping, and a palette-override hook).
2. **one rect per card** — `count(/<rect/) === projection-card-count`.
3. **one label per group** — `count(/font-size="14"/) === projection.groups.length`.
4. **one line per link** — `count(/<line/) === projection.links.length` (== 1 for miniGraph).
5. **honest-empty** — empty projection → contains `<svg` and `</svg>`, NO `<rect`/`<line`.
6. **byte-identical twice** — `projectionToSvg(p) === projectionToSvg(p)`.
7. **reference-unchanged** — capture `p` + `p.groups` refs and `Object.isFrozen(p)`; render;
   assert all unchanged and still frozen.
8. **escaping + options** — `fakeProjection` label renders `&lt;…&gt; &amp; &quot;…`; a
   `title` overlay emits `<title>`; a `palette` override flips a card's `fill`.

## Ordering of changes (commit plan)

One atomic commit: `src/present/projection-svg.ts` + `projection-svg.test.ts` together (the
test has no value without the module, and the module must land green). Gates `tsc --noEmit`
and `bun test` must both pass before commit. No migration, no deletion, no dependency edits.

## Boundaries preserved

- **IR-agnostic leaf stays leaf.** `svg.ts` is not touched; its no-IR-import invariant holds.
- **One-way authority.** No write path to the projection or any node; input returned unchanged.
- **Purity.** No fs/clock/network/`Date`/`Math.random` in the module (a source-scan purity test
  mirrors svg.test.ts's guard).
