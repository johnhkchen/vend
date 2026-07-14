# T-055-03 — Research: svg-file-output-seam

_Phase: Research. Descriptive map of the terrain the seam plugs into. No solutions yet._

## What the ticket asks

A thin CLI/file seam — the third and last ticket of E-055 (projection-to-svg-renderer). It must
**load the live board → project it → render the SVG → write the `.svg` to a staged output path**, the
MCP-independent visual half of the non-dev round-trip. The AC has three teeth:

1. Running the seam against the live board writes a `.svg` that opens in any viewer and shows a
   swimlane per group, a labeled box per card, an edge per link.
2. The `authority-guard` one-way-authority **build gate stays green** — the seam writes the **staged
   artifact, never `docs/active`**.
3. The **loaded graph object is reference-unchanged** after the seam runs.

The two prerequisite legs are already landed on `main`:
- `projectGraph(graph, spec, overlays?)` → `Projection` (T-021-05, `src/present/project.ts`).
- `projectionToSvg(projection, overlays?)` → `string` (T-055-02, `src/present/projection-svg.ts`).

So this ticket adds **only the impure seam** that wires load → project → render → write. No new
rendering logic.

## The pieces that already exist

### The load verb — `src/graph/load.ts`
`loadWorkGraph(opts?: LoadOptions): Promise<WorkGraph>` is the single impure verb that reads the
three `docs/active/**` board dirs (`epic/`, `stories/`, `tickets/`) and hands them to the pure
`buildGraph`, returning a deeply-frozen `WorkGraph`. It imports **only** `readFile`/`readdir` — there
is structurally no write path back to the board. Defaults point at `process.cwd()/docs/active/**`;
all dirs are overridable (tests load temp fixtures). A missing dir reads as `[]` (tolerant of a
fresh board).

### The projection — `src/present/project.ts`
`projectGraph(graph, spec, overlays?)` is **pure**: it reads the frozen graph + a `PresentationSpec`
and returns a fresh, deeply-frozen `Projection` — `{ groupBy, density, colorLanguage, metaphor,
groups: ProjectionGroup[], links: ProjectionLink[] }`. Crucially (AC tooth #3): *"the input graph
object is returned to the caller reference-unchanged"* — the projection never mutates the graph.

### The renderer — `src/present/projection-svg.ts` (T-055-02)
`projectionToSvg(projection, overlays?: SvgOverlays): string` turns a frozen `Projection` into one
large static SVG: one labeled swimlane per group, one `<rect>` (+ face `<text>`) per card, one
`<line>` per `depends_on` link, wrapped in a sized `<svg>` root. Pure, honest-empty (an empty
projection → minimal valid `<svg>`), deterministic (same projection → byte-identical). `SvgOverlays`
optionally routes a `palette` override and an accessible `title`.

### The spec source — `src/present/spec.ts` + `presets.ts`
A `PresentationSpec` is required to project. Two built-in frozen presets exist:
- `DESIGNER_PRESET` — `groupBy: "story"`, `colorLanguage: "leverage"`, plain vocabulary (the non-dev
  seat — fits "non-dev round-trip").
- `DEV_PRESET` — `groupBy: "epic"`, `colorLanguage: "status"`, technical.
`presets.ts` exposes `defaultPresetForSeat(seat)` (`designer → DESIGNER_PRESET`, `dev → DEV_PRESET`)
and `loadSeatSpec(seat, dir?)` (the saved tune, falling back to the built-in). `SEATS = ["designer",
"dev"]`.

## The one-way-authority guarantee — the constraint that shapes the seam

This is the load-bearing constraint. Authority is enforced in **two halves** (T-021-07):

1. **Static (`src/present/authority-guard.ts`, the build gate):** `classifyAuthorityViolations`
   scans `src/present/*.ts` SOURCE. A module is a violation **iff** its comment-stripped code BOTH
   (a) carries a write capability (a `node:fs` `WRITE_PRIMITIVES` import/call, or `Bun.write(`) AND
   (b) references the literal `PROTECTED_PATH = "docs/active"`. The conjunction is deliberate — it's
   what keeps `presets.ts` (which **imports `writeFile`/`mkdir` and writes `.vend/presets`**) CLEAN:
   it writes, but never names `docs/active` in code. The guard's own header calls `presets.ts` out
   by name as exactly this allowed shape.
2. **Runtime (`src/present/one-way-authority.test.ts`):** snapshots SHA-256 of every file under
   `docs/active`, runs the READ path (load → project → "render"), and asserts the tree is
   byte-identical afterward. It also asserts `graph.tickets` is the same reference after projection
   (AC tooth #3). This test **only drives the read path** — it never invokes a write seam.

**Two precedents for "an impure module that writes, under the authority guarantee":**
- `src/present/presets.ts` — IN `src/present/`, imports `writeFile`/`mkdir`, writes to **`.vend`**
  (never `docs/active`) → passes the static guard by construction.
- `src/present/calibration-demo.ts` — IN `src/present/`, an impure orchestrator that
  `loadWorkGraph` → `projectGraph` → `renderPaper` → **saves a tuned preset to `.vend`**; its header
  states it is *"provably OUTSIDE docs/active"* and *"never touches docs/active."* It delegates its
  write to `saveSeatSpec`, so it carries no write primitive itself.

**The staging convention.** `expand`/`survey`/`steer` plays stage machine output under
`docs/active/pm/staged/` — but those effects live in `src/play/` (e.g. `expand-effect.ts`,
`STAGING_DIR = "docs/active/pm/staged"`), which the static guard does **not** scan. `init-core.ts`
creates `docs/active/pm/staged` as a scaffolded dir. So "staged" has two readings in this codebase:
the PM desk under `docs/active/pm/staged` (written by `src/play/` effects), and the `.vend/` project
state (written by `src/present/` modules — `presets.ts`, `calibration-demo.ts`). Only the latter is
literally **"never `docs/active`."**

## The CLI surface — `src/cli.ts`

`parseArgs(argv)` is a pure dispatcher returning a `ParsedCommand` union; `import.meta.main` runs the
impure dispatch (lazy-imports each verb's module to keep the BAML addon off the pure-parse path).
Flags-only read commands (`shelf`, `doctor`, `init`) are the simplest precedent: a tiny
`parseXArgs` that rejects any extra token, a `{ cmd: "x" }` variant, and a dispatch arm that
lazy-imports + prints + exits. `cli.test.ts` unit-tests the **pure parsers** only.

## Constraints & assumptions surfaced

- **Determinism / purity below the seam:** `projectGraph` and `projectionToSvg` are pure and
  clock/random-free, so the only impurity the seam adds is graph load + the file write — exactly the
  `calibration-demo` posture.
- **No new deps / no layout engine** (E-055 N-goals): the seam composes landed legs only.
- **Hermetic testability:** every fs-touching precedent (`presets`, `expand-effect`,
  `calibration-demo`) takes an overridable output dir / injectable graph so its test runs against a
  temp dir and never touches the repo's real state. The seam must do the same.
- **Open question for Design:** *where* the `.svg` lands — `.vend/` (literally never `docs/active`,
  the `presets`/`calibration-demo` precedent) vs `docs/active/pm/staged/` (the `src/play/` staging
  convention) — and *where the seam file lives* (which decides which guard half applies). This is the
  one real decision; everything else is mechanical wiring.
