# T-056-03 — Structure: weight-blocked-edges-in-svg

_Phase: Structure. File-level blueprint — the shape of the code, not the code._

## Files touched

| File | Action | Why |
|---|---|---|
| `src/present/projection-svg.ts` | **modify** | Add `EDGE_BLOCKED` const; branch the edge-draw loop on `link.blocked`. The only production change. |
| `src/present/projection-svg.test.ts` | **modify** | Add a `blocked-edge weight` describe block; extend `fakeProjection` for a controlled `blocked:false` link. |

No files created. No files deleted. No new modules. `src/present/svg.ts` is **not** touched (the
`svgLine` primitive already accepts `stroke`/`strokeWidth`). `src/present/project.ts` is **not**
touched (the `blocked` flag already exists from T-056-02).

## Change 1 — `src/present/projection-svg.ts`

### 1a. New style constant (next to `EDGE`, ~line 82)

After the existing:

```ts
/** Edge line style. */
const EDGE = Object.freeze({ stroke: "#B0BEC5", strokeWidth: 2 });
```

add a sibling:

```ts
/** Blocked-edge style (E-056 edges-as-payload): a heavier, distinct stroke so an UNSATISFIED
 *  dependency — "what should I unblock first?" — pops off the board. Red echoes the palette's
 *  `critical` stroke; 2× the satisfied weight. Stroke weight/color only (no markers, no geometry). */
const EDGE_BLOCKED = Object.freeze({ stroke: "#E53935", strokeWidth: 4 });
```

- Reuses the `Object.freeze({...})` idiom of every style const in the file.
- Update the `EDGE` doc comment to read `/** Edge line style — a SATISFIED dependency: light + thin. */`
  so the pair reads as a set.

### 1b. Branch the edge loop (~lines 149–156)

Inside the existing `for (const link of projection.links)` loop, after the `if (!from || !to)
continue;` guard, introduce one local and swap the two field reads:

```ts
const edge = link.blocked ? EDGE_BLOCKED : EDGE;
out.push(
  `  ${svgLine({ x1: from.cx, y1: from.cy, x2: to.cx, y2: to.cy, stroke: edge.stroke, strokeWidth: edge.strokeWidth })}`,
);
```

- The loop structure, ordering ("edges first"), and the defensive endpoint guard are unchanged.
- `edge` is a pure function of the frozen `link.blocked` → byte-identity preserved.
- A falsy/`undefined` `blocked` selects `EDGE` → satisfied path emits the exact prior bytes.

### Public interface impact

**None.** `projectionToSvg`'s signature, the exported `SvgBoxStyle`/`SvgOverlays`/`DEFAULT_PALETTE`,
and the `svg.ts` primitives are all unchanged. `EDGE_BLOCKED` is a module-private const (not
exported) — consistent with `EDGE`, `LABEL`, `FACE`, `CARD`, `NEUTRAL` all being private.

## Change 2 — `src/present/projection-svg.test.ts`

### 2a. Extend `fakeProjection` to carry an explicit `blocked` link (~line 70)

The current single link has no `blocked` field. Change it to two links with explicit flags so the
hand-built fixture exercises both styles deterministically. Keep the existing `T-3 → T-1` topology
(it backs the "endpoint coords" test) and set it `blocked: false`; that test only checks coordinate
shape, so it is unaffected. Optionally add a second link with `blocked: true` for a focused literal
case (or rely on `miniProjection` for the blocked-true case to avoid over-touching the fixture).

Decision: minimal touch — set the existing link to `blocked: false` (controlled satisfied case) and
use `miniProjection()`'s genuine `blocked: true` link for the heavy-stroke assertion. This keeps the
real-IR path proving the real flag, and the literal proving the satisfied path.

```ts
links: [{ from: "T-3", to: "T-1", kind: "depends_on", blocked: false }],
```

(Still cast `as unknown as Projection`, so the literal stays terse.)

### 2b. New describe block (append after "one line per link", ~line 121)

```
describe("projectionToSvg — blocked edges carry visual weight (E-056)", () => {
  test("a blocked:true link renders the heavy, distinct stroke (width 4, #E53935)")
  test("a blocked:false link renders the existing light EDGE style (width 2, #B0BEC5)")
  test("same projection with a blocked link → byte-identical SVG (P5)")
})
```

- Test 1 uses `miniProjection()`; locate the `<line>` and assert `stroke="#E53935"` and
  `stroke-width="4"`.
- Test 2 uses `fakeProjection()`; assert the `<line>` carries `stroke="#B0BEC5"` /
  `stroke-width="2"` and does **not** contain `#E53935` / `stroke-width="4"`.
- Test 3 re-renders `miniProjection()` twice and asserts `toBe` (explicit byte-identity on the
  blocked path, complementing the existing determinism block).

A small line-extracting helper (`svg.split("\n").filter(l => l.includes("<line"))`) mirrors the
existing endpoint test's approach — no new imports.

## Ordering of changes

1. Edit `projection-svg.ts` (const + loop branch).
2. Edit `projection-svg.test.ts` (fixture tweak + new describe).
3. Run `bun run check` (typecheck + tests + format) → green.
4. Single atomic commit.

Steps 1 and 2 are co-dependent (tests assert the new styles) and land together in one commit.

## Invariants preserved (checklist)

- [ ] Purity: no `Date`/`Math.random`/fs added → purity-grep guard green.
- [ ] One-way authority: only reads `link.blocked`; input stays frozen/reference-unchanged.
- [ ] Honest-empty: empty projection still emits zero `<line>` (loop body unchanged for empty links).
- [ ] Byte-identity: per-link style is a total function of `link.blocked`.
- [ ] Satisfied edges: unchanged bytes (`EDGE` path identical to before).
