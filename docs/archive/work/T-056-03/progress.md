# T-056-03 — Progress: weight-blocked-edges-in-svg

_Phase: Implement. Executed the plan; tracked here._

## Completed

- **Step 1 — `EDGE_BLOCKED` const + `EDGE` relabel** (`src/present/projection-svg.ts`).
  Added frozen `EDGE_BLOCKED = { stroke: "#E53935", strokeWidth: 4 }` beside `EDGE`; reworded
  `EDGE`'s comment to mark it the satisfied style. ✓
- **Step 2 — edge-loop branch** (`projection-svg.ts`).
  Added `const edge = link.blocked ? EDGE_BLOCKED : EDGE;` after the endpoint guard; swapped the
  `svgLine` call to read `edge.stroke` / `edge.strokeWidth`. Loop order/guards unchanged. ✓
- **Step 3 — fixture tweak** (`projection-svg.test.ts`).
  `fakeProjection`'s link now `{ ..., blocked: false }` — a controlled satisfied case. ✓
- **Step 4 — new describe block** (`projection-svg.test.ts`).
  "blocked edges carry visual weight (E-056)": 3 tests — blocked-true heavy (miniProjection),
  blocked-false light (fakeProjection), byte-identical re-render. ✓
- **Step 5 — gate + live render.** ✓
  - `bun run check`: **1281 pass, 0 fail** (3603 expects, 81 files), `tsc --noEmit` clean.
  - Live render `bun run src/cli.ts svg` → `.vend/work-graph.svg`: 2 groups, 136 cards, 90 links.
    `stroke="#E53935" stroke-width="4"` count = **1** (the lone unsatisfied dep — T-056-03 itself,
    not-done, → T-056-02); `stroke="#B0BEC5" stroke-width="2"` count = **89**. Heavy strokes appear
    only on the unsatisfied dependency. ✓

## Deviations from plan

None. Plan executed as written. One note: the `vend svg` command is invoked as
`bun run src/cli.ts svg` (there is no `vend` bun script alias) — used for the manual render in Step 5.

## Remaining

- Step 6 — commit. Single atomic commit pending (left to the sweep per workflow;
  source + test changes staged conceptually). No further code work.

## Files changed

- `src/present/projection-svg.ts` — `EDGE_BLOCKED` const + per-link style branch.
- `src/present/projection-svg.test.ts` — `blocked:false` fixture link + new describe (3 tests).
