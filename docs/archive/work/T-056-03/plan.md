# T-056-03 — Plan: weight-blocked-edges-in-svg

_Phase: Plan. Ordered, verifiable steps + testing strategy + verification criteria._

## Testing strategy

- **Unit (automated, the gate):** all assertions live in `src/present/projection-svg.test.ts`,
  pure/no-live-model — same style as the existing T-055-02 suite. Three new tests under one new
  describe cover the four AC clauses (blocked-heavy, satisfied-light, byte-identical). Determinism,
  one-way authority, and purity already have suite-wide guards that the change must not break.
- **Manual (recorded, not gated):** one live `vend svg` render of the real board to
  `.vend/work-graph.svg`, eyeballed for heavy strokes only on unsatisfied deps. Captured in
  `review.md`. File-output is T-055-03's seam, so this stays a manual confirmation.
- **House gate:** `bun run check` (typecheck + full test suite + format). Green-before-commit. (No
  `lint` script exists — `check` is the correct gate, per T-056-02.)

## Ordered steps

### Step 1 — Add `EDGE_BLOCKED` and relabel `EDGE`

`src/present/projection-svg.ts`, near line 82.

- Reword the `EDGE` doc comment to mark it the *satisfied* style.
- Add the frozen `EDGE_BLOCKED = { stroke: "#E53935", strokeWidth: 4 }` const with its doc comment.

**Verify:** `bun run check` typechecks (const unused warning is fine until step 2 wires it; if the
config errors on unused, steps 1–2 land together — they are one commit anyway).

### Step 2 — Branch the edge-draw loop on `link.blocked`

`src/present/projection-svg.ts`, lines ~149–156.

- Add `const edge = link.blocked ? EDGE_BLOCKED : EDGE;` after the endpoint guard.
- Replace `stroke: EDGE.stroke, strokeWidth: EDGE.strokeWidth` with `stroke: edge.stroke,
  strokeWidth: edge.strokeWidth`.

**Verify:** `bun test src/present/projection-svg.test.ts` — the **existing** suite still passes
(satisfied path unchanged; `fakeProjection`'s link, until step 3, has `blocked` undefined → falsy →
light style → byte-stable).

### Step 3 — Extend the fixture for a controlled satisfied case

`src/present/projection-svg.test.ts`, `fakeProjection` link (~line 70).

- Set the existing link to `{ from: "T-3", to: "T-1", kind: "depends_on", blocked: false }`.

**Verify:** existing endpoint-coords test (`:113`) and determinism tests still pass (topology
unchanged).

### Step 4 — Add the blocked-edge describe block

`src/present/projection-svg.test.ts`, after the "one line per link" describe (~line 121).

Three tests:
1. `miniProjection()` (real `blocked:true` link) → emitted `<line>` has `stroke="#E53935"` and
   `stroke-width="4"`.
2. `fakeProjection()` (`blocked:false`) → its `<line>` has `stroke="#B0BEC5"` /
   `stroke-width="2"`, and does **not** contain `#E53935` / `stroke-width="4"`.
3. `miniProjection()` rendered twice → `toBe` (byte-identical on the blocked path).

**Verify:** `bun test src/present/projection-svg.test.ts` — all new + old tests green.

### Step 5 — Full gate + manual render

- `bun run check` → green (whole suite, typecheck, format).
- `bun run vend svg` (or the project's svg command) → open `.vend/work-graph.svg`; confirm heavy red
  strokes appear only on edges from not-done tickets. Record the observed counts in `review.md`.

### Step 6 — Commit

One atomic commit: `feat(present): weight blocked edges in projectionToSvg (T-056-03)`.
Includes the source + test changes only.

## Verification criteria (AC → check)

| AC clause | How verified |
|---|---|
| blocked:true → heavy/distinct stroke (thicker + distinct color) | Test 1 (`#E53935`, width 4) |
| blocked:false → existing light EDGE style | Test 2 (`#B0BEC5`, width 2; not heavy) |
| same projection → byte-identical SVG | Test 3 + existing determinism block |
| opening `.vend/work-graph.svg` shows heavy strokes only on unsatisfied deps | Step 5 manual render, recorded in `review.md` |
| House gates green | `bun run check` in step 5 |

## Risk register

| Risk | Likelihood | Mitigation |
|---|---|---|
| Unused-const lint error between steps 1–2 | low | Steps 1+2 are one commit; const is wired before any commit. |
| `fakeProjection` fixture change breaks the endpoint-coords test | low | Topology (`T-3→T-1`) unchanged; only `blocked:false` added — that test asserts coords only. |
| A blocked color collides with a card fill, hurting contrast | low | `#E53935` is a *stroke* on a thin line over the canvas; card fills are pale tints (`#FFEBEE` etc.) — strong contrast. Stroke-only, per scope. |
| Byte-baseline drift for satisfied edges | very low | Satisfied path emits identical bytes (`EDGE` unchanged); only blocked links differ. |

## Rollback

Single commit → `git revert` cleanly restores the uniform `EDGE` rendering. No data/schema change
(the `blocked` flag persists, simply unread by the renderer again).
