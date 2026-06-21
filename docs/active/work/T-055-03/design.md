# T-055-03 — Design: svg-file-output-seam

_Phase: Design. Options, tradeoffs, decisions — grounded in research.md. Six decisions (D1–D6)._

The seam is mechanical wiring (load → project → render → write). The only genuine design questions
are **where the `.svg` lands** and **where the seam file lives**, because together they decide which
half of the authority guard applies and whether the AC's "never `docs/active`" holds literally.

## D1 — Output location: `.vend/` (not `docs/active/pm/staged/`)

**The decision.** The seam writes the `.svg` under **`.vend/`** (default `.vend/work-graph.svg`).

**Options considered:**
- **(A) `docs/active/pm/staged/work-graph.svg`** — the `src/play/` staging convention
  (`expand`/`survey`/`steer` effects, `init-core` scaffolds the dir).
- **(B) `.vend/work-graph.svg`** — the `src/present/` project-state convention (`presets.ts` →
  `.vend/presets`, `calibration-demo.ts` → `.vend`).

**Why (B).** The AC names the gate in one breath: *"the authority-guard one-way-authority build gate
stays green (the seam writes the staged artifact, **never docs/active**)."* `docs/active/pm/staged/`
is **under** `docs/active`, so option (A) can satisfy "writes the staged artifact" OR "never
docs/active" but not both *literally*. Option (B) satisfies both: `.vend/` is provably outside
`docs/active`, so (i) the runtime byte-hash gate stays green even if the seam's write is ever folded
into that test's bracket, and (ii) `.vend/` is *this codebase's* established "staged, never
docs/active" location — `calibration-demo.ts`'s header uses those exact words about its `.vend`
write under the one-way-authority guarantee. "Staged output" here means *a machine-written artifact
staged for a human to open*, and `.vend` is where `src/present/` stages such artifacts.

**Why not (A).** It reads "staged" literally but breaks "never docs/active" literally, and it would
force the seam out of `src/present/` (see D2) to dodge the static guard — splitting the SVG family
across two directories for no real gain. The `src/play/` staging convention exists for **demand
signals a human pulls onto the board** (epics/tickets-in-waiting); an SVG render is not board demand,
it's a view — the `calibration-demo` lineage, not the `expand`/`steer` lineage.

## D2 — Seam location: `src/present/svg-file.ts`

**The decision.** A new module **`src/present/svg-file.ts`**, beside its renderer
(`projection-svg.ts`) and the other present-layer orchestrator (`calibration-demo.ts`).

Given D1 (`.vend`), the static guard is satisfied *by construction*: a `src/present/` module may
import `writeFile`/`mkdir` freely as long as its code never names `docs/active` — exactly
`presets.ts`. Keeping the seam in `src/present/` keeps the whole SVG stack (toolkit `svg.ts` → core
`projection-svg.ts` → seam `svg-file.ts`) co-located and lets the seam value-import the renderer
directly. Rejected: `src/play/` (would imply a BAML "play" it is not) and a new top-level dir
(needless structure for one file).

## D3 — The write: direct `mkdir` + `writeFile`, mirroring `presets.ts`

**The decision.** The seam calls `mkdir(dir, { recursive: true })` then `writeFile(path, svg,
"utf8")` directly — the `saveSeatSpec` body verbatim in shape.

`calibration-demo` *delegates* its write to `saveSeatSpec`; there is no analogous "save an SVG"
helper to delegate to, and inventing one (a one-line `writeFile` wrapper) is the kind of premature
shared util the house `gates.ts` no-shared-util rule discourages. A direct write keeps the seam one
honest function. The guard stays green because the path string is `.vend/...`, never `docs/active`
(D1). The header comment may *name* `docs/active` for provenance — comments are stripped before the
scan.

## D4 — The spec: seat-selected, default `designer`

**The decision.** The seam projects under `defaultPresetForSeat(seat)` with **`seat` defaulting to
`"designer"`**; the seat is an option / a `--seat` CLI flag.

`projectGraph` needs a `PresentationSpec`. The designer preset (`groupBy: "story"`,
`colorLanguage: "leverage"`, plain vocabulary) is the non-dev seat — the exact audience of the
"non-dev round-trip" this epic serves. Making `seat` an option (validated against `SEATS`) gives the
dev view for free without widening scope. Rejected: `loadSeatSpec` (honors a saved tune) — it adds a
`.vend` *read* coupling for a marginal benefit; the built-in preset is deterministic and sufficient.
Noted in plan.md as a clean future enhancement. Also accept an explicit `spec?` override in the
options object for full programmatic control + hermetic tests.

## D5 — The contract: an injectable-graph options object returning a typed record

**The decision.** Mirror `calibration-demo`'s `runCalibrationDemo(opts)` shape exactly:

```ts
interface SvgFileOptions {
  readonly graph?: WorkGraph;          // omitted → loadWorkGraph() (the live board)
  readonly seat?: Seat;                // default "designer" (D4)
  readonly spec?: PresentationSpec;    // explicit override; wins over seat
  readonly title?: string;             // → SvgOverlays.title (accessible <title>); omitted → none
  readonly outDir?: string;            // default ".vend"
  readonly fileName?: string;          // default "work-graph.svg"
}
interface SvgFileResult {
  readonly path: string;               // the written .svg path
  readonly svg: string;                // the rendered string (assert without re-reading)
  readonly groupCount: number;
  readonly cardCount: number;
  readonly linkCount: number;
}
async function writeBoardSvg(opts?: SvgFileOptions): Promise<SvgFileResult>;
```

`graph?` injectable is what makes the test hermetic *and* lets the test hold the graph reference to
prove AC tooth #3 (reference-unchanged). `outDir?` override is what lets the test write to a temp dir
and never touch the repo's `.vend`. The returned `svg` + counts let a test assert structure without a
re-read. Honest-empty: an empty board → a minimal valid `<svg>` written, `cardCount: 0` — no throw.

## D6 — CLI surface: a thin flags-only `vend svg` command

**The decision.** Add `vend svg [--seat <designer|dev>] [--out <path>]` to `src/cli.ts`, mirroring
the `shelf`/`doctor` flags-only precedent: a tiny pure `parseSvgArgs`, a `{ cmd: "svg"; seat; out? }`
variant, and a dispatch arm that lazy-imports `writeBoardSvg`, prints the written path + counts, and
exits 0 (1 on an unexpected fs failure). The epic explicitly scopes "**plus a thin CLI/file seam to
write the `.svg`**" — the function is the seam, the command is the gesture that runs it. Pure
parser tested in `cli.test.ts`; the dispatch arm is the thin untested shell (the house pattern).
`--out` overrides the full path; `--seat` validates against `SEATS`. Kept minimal — no `--budget`
(nothing is cast), like `shelf`/`doctor`/`init`.

## What this design deliberately does **not** do

- No new rendering, layout, or palette logic — `projectionToSvg` owns all of it (E-055 N-goals).
- No live model, no MCP, no network (N4/P5) — pure compose + one fs write.
- No `docs/active` write and no board mutation — D1 + `projectGraph`'s purity are the AC's teeth.
- No saved-tune read (`loadSeatSpec`) — deferred (D4), noted as a future enhancement.
