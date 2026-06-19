# T-021-08 — Structure: calibration-loop-demo

## Files

| File | Action | Why |
|---|---|---|
| `src/present/calibration-demo.ts` | **create** | the demo orchestrator + its result contract (D1, D7) |
| `src/present/calibration-demo.test.ts` | **create** | unit (miniGraph) + AC (live board) coverage (D5, D6) |

No existing module is modified. The demo composes the landed legs read-only; nothing in
spec/project/paper/presets/load needs to change.

## `src/present/calibration-demo.ts`

### Header comment (house convention)
States: this is the E-021 calibration-loop *capstone* (T-021-08, S-021-04); it composes the four
landed legs (load → spec/presets → project → paper) into one turn of the loop; **impure**
(graph load + preset fs) but **deterministic** (no clock/random — P5); one-way authority holds
(the only write is the seat preset under `.vend/presets`, never `docs/active`); composition, not
reinvention (it adds no projection/render/persistence logic).

### Imports
```ts
import { loadWorkGraph } from "../graph/load.ts";
import type { WorkGraph } from "../graph/model.ts";
import { DESIGNER_PRESET } from "./spec.ts";           // type fixture + the default density:"low"
import type { Density, PresentationSpec } from "./spec.ts";
import { projectGraph } from "./project.ts";
import type { Projection } from "./project.ts";
import { renderPaper } from "./paper.ts";
import { DEFAULT_PRESETS_DIR, defaultPresetForSeat, loadSeatSpec, saveSeatSpec } from "./presets.ts";
import type { Seat } from "./presets.ts";
```

### Public types
```ts
/** The one knob the demo turns: which field, and the before/after values (self-describing). */
export interface KnobFlip {
  readonly field: "density";
  readonly from: Density;
  readonly to: Density;
}

/** Options for runCalibrationDemo — all optional (the live-board, designer-seat, .vend default). */
export interface CalibrationDemoOptions {
  readonly graph?: WorkGraph;     // injected graph (tests); omitted → loadWorkGraph() (D5)
  readonly seat?: Seat;           // default "designer" (the AC's seat)
  readonly presetsDir?: string;   // default DEFAULT_PRESETS_DIR; tests pass a temp dir (D4)
}

/** The structured proof of one calibration-loop turn (D7) — every piece the test/CLI inspects. */
export interface CalibrationDemo {
  readonly seat: Seat;
  readonly knob: KnobFlip;
  readonly baseSpec: PresentationSpec;
  readonly tunedSpec: PresentationSpec;
  readonly reloadedSpec: PresentationSpec;
  readonly before: string;        // renderPaper(graph, baseSpec)
  readonly after: string;         // renderPaper(graph, tunedSpec)
  readonly reproduced: string;    // renderPaper(graph, reloadedSpec)
  readonly baseProjection: Projection;
  readonly tunedProjection: Projection;
  readonly savedPath: string;     // where the tuned preset was written (outside docs/active)
}
```

### The one public function
```ts
export async function runCalibrationDemo(
  opts: CalibrationDemoOptions = {},
): Promise<CalibrationDemo>
```
Body (ordered, ~6 steps — pure where it can be, fs only for load + save/load):
1. resolve `seat` (default `"designer"`), `presetsDir` (default `DEFAULT_PRESETS_DIR`),
   `graph` (`opts.graph ?? await loadWorkGraph()`).
2. `baseSpec = defaultPresetForSeat(seat)` (D3 — deterministic base, density `"low"` for designer).
3. `before = renderPaper(graph, baseSpec)`; `baseProjection = projectGraph(graph, baseSpec)`.
4. **flip the knob**: `tunedSpec = { ...baseSpec, density: "full", preset: "custom" }`;
   `after = renderPaper(graph, tunedSpec)`; `tunedProjection = projectGraph(graph, tunedSpec)`.
5. **persist + reload**: `savedPath = await saveSeatSpec(seat, tunedSpec, presetsDir)`;
   `reloadedSpec = await loadSeatSpec(seat, presetsDir)`;
   `reproduced = renderPaper(graph, reloadedSpec)`.
6. `return { seat, knob: { field: "density", from: baseSpec.density, to: tunedSpec.density },
   baseSpec, tunedSpec, reloadedSpec, before, after, reproduced, baseProjection, tunedProjection,
   savedPath }`.

Note: the function does **not** assert anything — it produces the record; the test owns the
assertions (a demo is reusable; a test is a checker). It also performs **no** writes to
`docs/active` — the only mutation is `saveSeatSpec` into `presetsDir`.

### Optional convenience (small, deterministic)
```ts
/** A human-readable one-liner summarizing the turn — for a future CLI/log. Pure. */
export function describeFlip(d: CalibrationDemo): string;
//  e.g. `designer · density: low → full · view changed, docs/active untouched`
```
Kept tiny and pure; not load-bearing for the AC but makes the demo self-describing when printed.

## `src/present/calibration-demo.test.ts`

### Imports & fixtures
- `bun:test` (`afterAll, describe, expect, test`).
- fs temp-dir helpers: `mkdtemp, rm` from `node:fs/promises`, `tmpdir`, `join` (presets.test.ts mould).
- crypto + fs for the local `hashTree`: `createHash`, `readFile, readdir`, `relative`.
- `buildGraph`, `RawNode`, `WorkGraph` from `../graph/model.ts` + the `epic/story/ticket/miniGraph`
  fixture helpers copied from paper.test.ts (small, self-contained).
- `runCalibrationDemo`, `describeFlip` from `./calibration-demo.ts`.
- `DESIGNER_PRESET` from `./spec.ts` for sanity checks.

### Local helpers
- `freshDir()` + `tmpDirs[]` + `afterAll` cleanup (presets.test.ts copy).
- `hashTree(root)` (one-way-authority.test.ts copy — re-implemented locally per D6).
- `miniGraph()` (paper.test.ts copy).

### Test blocks
1. `describe("runCalibrationDemo — pure over a fabricated graph")`
   - **flips one knob; the rendered output differs** → `d.before !== d.after`;
     `d.knob` is `{ field:"density", from:"low", to:"full" }`.
   - **the projection IR carries the knob too** → `d.baseProjection.density === "low"`,
     `d.tunedProjection.density === "full"`,
     `JSON.stringify(d.baseProjection) !== JSON.stringify(d.tunedProjection)`.
   - **reloading the saved preset reproduces the tuned render** → `d.reloadedSpec` `toEqual`
     `d.tunedSpec`; `d.reproduced === d.after`.
   - **the saved preset lives outside docs/active** → `d.savedPath` starts with the temp dir and
     does not contain `docs/active`.
   - **deterministic (P5)** → two runs over the same graph+dir give equal `after`.
2. `describe("T-021-08 — AC (live board)")`
   - **the calibration loop runs on the live board and changes the view** → `await loadWorkGraph()`
     has `tickets.length > 0`; run the demo with that graph + a temp dir;
     `before !== after`, `reproduced === after`, `reloadedSpec toEqual tunedSpec`.
   - **no docs/active markdown changed** → `hashTree("docs/active")` before vs after the demo run
     is byte-identical (the AC's teeth); `before.size > 0` (not vacuous).
   - (the live-board run reuses the same temp `presetsDir`, so the repo `.vend` is untouched.)

### Ordering / determinism in tests
Each test that writes uses its own `freshDir()`; `afterAll` removes all. No reliance on test order.

## Risk register

| Risk | Likelihood | Mitigation |
|---|---|---|
| `density:full` is a no-op vs base (no diff) | none | base is the built-in designer preset (`low`); flip target `full` ≠ `low` by construction (D2/D3) |
| Demo writes into repo `.vend`, polluting the tree | low | tests always pass a `mkdtemp` dir; default only used by a real CLI later (D4) |
| Demo accidentally touches `docs/active` | none-by-design | only write is `saveSeatSpec` → `presetsDir`; AC test byte-hashes `docs/active` to prove it |
| `hashTree` duplication drifts from the T-021-07 copy | low | both are ~15 lines of stdlib; behavior is "hash every file", not a shared contract (D6) |
| Over-claiming density changes the paper *body* | medium | header-only render effect is documented in design D2 + review; test also asserts the IR diff |
| D-005 stop gate blocks on sibling uncommitted files | low | commit only the two new files; leave siblings (T-021-07 precedent) |
