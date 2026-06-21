# T-056-03 — Design: weight-blocked-edges-in-svg

_Phase: Design. Options, tradeoffs, decision with rationale — grounded in `research.md`._

## The decision (summary)

Add a second frozen edge-style constant `EDGE_BLOCKED` next to the existing `EDGE` in
`projection-svg.ts`, and in the edge-draw loop select the style per link with
`const edge = link.blocked ? EDGE_BLOCKED : EDGE;`. Feed `edge.stroke` / `edge.strokeWidth` to the
existing `svgLine` call. `EDGE_BLOCKED` is a **heavier, distinct** stroke:
`{ stroke: "#E53935", strokeWidth: 4 }` — the red already in the palette's `critical` family, at 2×
the satisfied width. No primitive change, no new public option, no geometry change.

## What the change must satisfy (from Research)

- Reads `link.blocked` only (data authority settled in T-056-02). Pure, byte-identical per fixed
  projection.
- Satisfied edges emit the **unchanged** `EDGE` style (`#B0BEC5`, width 2).
- Weight + color only. No arrows, no palette redesign, no new geometry.
- Honest-empty, one-way authority, purity guards all stay green.

## Options considered

### Option A — second const + ternary at the call site **(chosen)**

```ts
const EDGE = Object.freeze({ stroke: "#B0BEC5", strokeWidth: 2 });
const EDGE_BLOCKED = Object.freeze({ stroke: "#E53935", strokeWidth: 4 });
...
for (const link of projection.links) {
  const from = boxes.get(link.from);
  const to = boxes.get(link.to);
  if (!from || !to) continue;
  const edge = link.blocked ? EDGE_BLOCKED : EDGE;
  out.push(`  ${svgLine({ x1: from.cx, y1: from.cy, x2: to.cx, y2: to.cy, stroke: edge.stroke, strokeWidth: edge.strokeWidth })}`);
}
```

- **Pros:** mirrors the existing style-table idiom exactly (`EDGE`/`CARD`/`LABEL`/`FACE` are all
  frozen consts; `styleFor` already does table-lookup-then-use for card colors). Minimal diff — one
  new const, one new local, two field reads swapped in. Purely a function of `link.blocked` → byte
  identity trivially preserved. Satisfied path is literally the old code with `EDGE` → `edge`.
- **Cons:** introduces a sibling const rather than reusing the palette table. Acceptable: edges are a
  different visual channel (stroke-only, no fill) and already have their own `EDGE` const — extending
  that pattern is the consistent move, not a regression.

### Option B — a `blocked`-keyed style table (parallel to `DEFAULT_PALETTE`)

A `Record<"blocked"|"satisfied", {stroke,strokeWidth}>` table + an overlay override hook.

- **Pros:** symmetrical with the color palette; would let callers re-skin edges later.
- **Cons:** over-built for this ticket. The AC asks for two fixed styles, not a configurable edge
  palette. Adding an `overlays.edgePalette` is scope creep (the ticket explicitly says "no palette
  redesign") and a new public surface to test/maintain. Rejected — can be a later ticket if a real
  need appears.

### Option C — push the decision into `svgLine` / the leaf (`svg.ts`)

Give `svgLine` a `blocked?: boolean` and let it choose weights.

- **Cons:** violates the layering teeth documented in `svg.ts:12–17` — the leaf is **IR-agnostic** and
  must not know about `blocked`/state. The state→style decision belongs in the core, exactly where
  the color-token→palette decision already lives. Rejected on architecture grounds.

### Option D — reuse the `critical` palette entry's stroke directly inline

`stroke: DEFAULT_PALETTE.critical!.stroke`.

- **Cons:** couples edge color to a card-fill table and needs a non-null assertion (house style
  avoids `!` in src — cf. the `noUncheckedIndexedAccess` guard in `indexBoxes`). A dedicated frozen
  const is cleaner and self-documenting. We *echo* the red hex value for palette consistency, but own
  it as an edge const. Rejected.

## Chosen values and why

| Aspect | Satisfied (`EDGE`) | Blocked (`EDGE_BLOCKED`) | Rationale |
|---|---|---|---|
| `stroke` | `#B0BEC5` (slate) | `#E53935` (red) | Red is already the palette's `critical` stroke (`:64`) — reads as "urgent/attention" with zero new color language. Distinct from every card fill, so it pops. |
| `strokeWidth` | `2` | `4` | 2× weight is unmistakable at the board's zoomed-out scale; "give blocked edges visual WEIGHT" is literally width. Integer → byte-stable (`num`). |

Both stay **stroke-only** (no fill, no markers) — exactly the AC's "stroke weight/color only".

## Determinism & invariants (how the design protects them)

- **Byte-identity:** `edge` is `link.blocked ? EDGE_BLOCKED : EDGE` — a total function of a frozen
  boolean. Same projection → same per-link choice → same string. No `Date`/`Math.random` introduced,
  so the purity-grep guard (`projection-svg.test.ts:199–210`) stays green.
- **Satisfied edges unchanged:** when `link.blocked` is falsy (incl. the legacy `undefined` in
  `fakeProjection`), `edge === EDGE`, emitting the exact prior bytes. Old byte-stable expectations and
  the live satisfied-edge baseline don't move.
- **One-way authority / honest-empty:** untouched — we only read `link.blocked` inside the existing
  loop; empty projection still emits zero `<line>`.

## Test design (maps to the single AC)

The AC bundles four checks. Plan them as:

1. **Blocked → heavy/distinct stroke.** Use `miniProjection()` — its one real link (`T-002-01` open
   `→ T-001-03`) is `blocked: true`. Assert the emitted `<line>` carries `stroke="#E53935"` and
   `stroke-width="4"`.
2. **Satisfied → light EDGE style.** Extend `fakeProjection` (or add a focused literal) with a link
   `blocked: false`; assert its `<line>` carries `stroke="#B0BEC5"` and `stroke-width="2"` and **not**
   the heavy values.
3. **Byte-identical for same projection.** Already covered by existing determinism tests; add a
   targeted re-render equality on a projection containing a blocked link to be explicit.
4. **Live `.vend/work-graph.svg`** — heavy strokes only on unsatisfied deps: a manual `vend svg`
   render check, recorded in `review.md` (not an automated assertion — file-output is T-055-03's
   seam).

House gate `bun run check` must end green.

## Out of scope (explicit)

Arrowheads/markers, edge labels, dashed styles, configurable edge palette, any change to `svg.ts`
primitives or geometry, any change to how `blocked` is computed (that is T-056-02, done).
