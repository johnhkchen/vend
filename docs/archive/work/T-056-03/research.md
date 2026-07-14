# T-056-03 — Research: weight-blocked-edges-in-svg

_Phase: Research. Descriptive map of the edge-render path. No solutions proposed here._

## Ticket in one line

Give blocked edges visual **weight** in `projectionToSvg` — a blocked `depends_on` link renders
thicker with a distinct stroke; a satisfied (done-`from`) edge keeps the existing light style — so
"what should I unblock first?" pops off the board. Scope: stroke **weight/color only**, no palette
redesign.

## Where the edge is drawn

`src/present/projection-svg.ts` is the projection→SVG renderer core (T-055-02, the third consumer
of the E-021 Projection IR after `project.ts` and `paper.ts`). The edge-draw path is the loop at
`projection-svg.ts:148–156`:

```ts
// Edges first, so the opaque card boxes paint over the lines (deterministic regardless of order).
for (const link of projection.links) {
  const from = boxes.get(link.from);
  const to = boxes.get(link.to);
  if (!from || !to) continue; // defensive — every endpoint resolves for a well-formed projection.
  out.push(
    `  ${svgLine({ x1: from.cx, y1: from.cy, x2: to.cx, y2: to.cy, stroke: EDGE.stroke, strokeWidth: EDGE.strokeWidth })}`,
  );
}
```

Every link, regardless of state, is emitted with the single `EDGE` constant. There is currently
**no branch** on link state.

## The one style table for edges

`projection-svg.ts:82`:

```ts
/** Edge line style. */
const EDGE = Object.freeze({ stroke: "#B0BEC5", strokeWidth: 2 });
```

This is the sole edge style. It sits alongside the card/face/label style constants (`LABEL`, `FACE`,
`CARD`) and the `DEFAULT_PALETTE` color table (`projection-svg.ts:59–69`). Note the palette already
contains a red family member: `critical: { fill: "#FFEBEE", stroke: "#E53935" }` (`:64`) and
`high: { stroke: "#FB8C00" }` (`:65`) — the existing "urgent" hues the surface already reads.

## The `blocked` flag — already on the IR (T-056-02)

The data this ticket needs already exists. `ProjectionLink` (`src/present/project.ts:59–67`) carries:

```ts
export interface ProjectionLink {
  readonly from: string;
  readonly to: string;
  readonly kind: "depends_on";
  /** Status-derived decision weight (E-056 edges-as-payload): `true` when the `from` ticket is not
   *  done (its `stateKey` ≠ `"done"`) ... same graph → same flag. */
  readonly blocked: boolean;
}
```

It is **computed** in `buildLinks` (`project.ts:191–197`):

```ts
const blocked = stateKey(t) !== "done"; // `from` is `t`; reuse the done-authority, no lookup
...
if (ticketIds.has(dep)) links.push({ from: t.id, to: dep, kind: "depends_on", blocked });
```

So `blocked` is purely derived from the frozen graph — a `from` ticket that is not `done` blocks its
dependency. This ticket (T-056-03) only **reads** `link.blocked` in the renderer; the data authority
is settled and depended-on (`depends_on: [T-056-02]`).

## The line primitive (leaf layer)

`src/present/svg.ts:169–179` — `svgLine(a: LineAttrs)`:

```ts
export function svgLine(a: LineAttrs): string {
  const attrs = joinAttrs([
    numAttr("x1", a.x1), numAttr("y1", a.y1), numAttr("x2", a.x2), numAttr("y2", a.y2),
    strAttr("stroke", a.stroke),
    a.strokeWidth === undefined ? "" : numAttr("stroke-width", a.strokeWidth),
  ]);
  return `<line ${attrs}/>`;
}
```

`LineAttrs` (`svg.ts:50–58`) already accepts optional `stroke` and `strokeWidth`. **The primitive
needs no change** — it can already emit any stroke/width the core hands it. The renderer core simply
needs to pick the right pair per link. `svg.ts` is IR-agnostic by design (it imports nothing from
`project.ts`); the state→style decision belongs in `projection-svg.ts`, exactly as the color-token→
palette decision does. Determinism is structural: attributes emit in hand-fixed order, coordinates
pass through `num`, geometry is integer-only.

## House patterns that constrain the change

- **Purity (P5):** the module is pure string-building over a frozen input — no fs/clock/network, no
  `Date`/`Math.random`. Identical input → byte-identical output. A test guard
  (`projection-svg.test.ts:192–211`) greps the source for `Date`, `Math.random`, and fs imports.
- **One-way authority (E-021):** the renderer reads the projection and never writes it back; the
  input stays frozen and reference-unchanged (`projection-svg.test.ts:153–167`).
- **Honest-empty (IA-4):** empty projection → minimal `<svg>` with zero `<rect>`/`<line>`
  (`projection-svg.test.ts:125–135`).
- **Style tables are the single source of style truth** — colors/weights live in frozen const tables
  (`EDGE`, `CARD`, `DEFAULT_PALETTE`), never inlined at the call site beyond reading a table entry.

## Test landscape

`src/present/projection-svg.test.ts` (212 lines). Relevant fixtures and cases:

- `miniGraph()` / `miniProjection()` (`:36–52`): a genuine `projectGraph` projection — 5 tickets,
  exactly **1** cross-story link `T-002-01 → T-001-03`. `T-002-01` is `open` (not done) → its link
  is `blocked: true`. This is a ready-made real blocked-edge fixture.
- `fakeProjection()` (`:58–72`): a hand-built `Projection` literal. Its single link is
  `{ from: "T-3", to: "T-1", kind: "depends_on" }` — **no `blocked` field** (cast
  `as unknown as Projection`). Today `link.blocked` is `undefined` there.
- "one line per link" (`:106–121`): counts `<line>` and checks endpoint coordinates.
- determinism (`:139–149`), one-way authority (`:153–167`), purity (`:192–211`).

## Constraints / assumptions surfaced

1. **Byte-identity must hold** for any fixed projection — the blocked branch must be a pure function
   of `link.blocked`, no clock/random.
2. **Satisfied edges must be unchanged** — the existing `EDGE` style (`#B0BEC5`, width 2) must remain
   exactly what a non-blocked link emits, so prior byte-stable expectations and the live `.vend/
   work-graph.svg` baseline for satisfied edges don't shift.
3. **Scope discipline:** weight (`strokeWidth`) + color (`stroke`) only. No new geometry, no arrows,
   no palette-table redesign, no new public option.
4. **`fakeProjection`'s link lacks `blocked`.** New tests that assert blocked styling need fixtures
   that set `blocked: true` / `blocked: false` explicitly; or use `miniProjection` (real `blocked:
   true`). The hand-built literal will need a small extension for a controlled `blocked:false` case.
5. **House gate** is `bun run check` (per T-056-02 memory: there is no `lint` script). Green = the
   gate.
