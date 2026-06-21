# T-055-03 — Structure: svg-file-output-seam

_Phase: Structure. File-level blueprint — the shape of the code, not the code._

## Files

| File | Action | Why |
|---|---|---|
| `src/present/svg-file.ts` | **create** | The seam: load → project → render → write `.vend/*.svg`. |
| `src/present/svg-file.test.ts` | **create** | Hermetic temp-dir test of the seam + the AC's three teeth. |
| `src/cli.ts` | **modify** | Add the `vend svg` command (parser + `ParsedCommand` variant + dispatch arm). |
| `src/cli.test.ts` | **modify** | Unit-test the pure `parseSvgArgs` (the dispatch arm is the untested shell). |
| `docs/active/work/T-055-03/*.md` | **create** | RDSPI artifacts (this set). |

No file is deleted. No existing `src/present/` module is edited — the renderer (`projection-svg.ts`),
toolkit (`svg.ts`), and authority guard are reused untouched.

## `src/present/svg-file.ts` — the seam module

Header comment (the house provenance block), mirroring `calibration-demo.ts`: name the ticket/story/
epic, state it is the FOURTH composition over the Projection IR (the file-output seam), state PURITY
posture (impure: graph load + one `.vend` write; everything below it pure/deterministic), and state
ONE-WAY AUTHORITY (writes `.vend`, **never `docs/active`** — the `presets.ts` allowed shape; this
provenance mention of `docs/active` lives only in the comment, stripped before the guard scan).

**Imports (value vs type):**
- value: `mkdir`, `writeFile` from `node:fs/promises`; `join` from `node:path`; `loadWorkGraph` from
  `../graph/load.ts`; `projectGraph` from `./project.ts`; `projectionToSvg` from `./projection-svg.ts`;
  `defaultPresetForSeat` from `./presets.ts`.
- type-only: `WorkGraph` from `../graph/model.ts`; `PresentationSpec` from `./spec.ts`; `Seat` from
  `./presets.ts`; `SvgOverlays` from `./projection-svg.ts`.

**Exported constants:**
- `DEFAULT_SVG_DIR = ".vend"` — overridable per call (the `DEFAULT_PRESETS_DIR` idiom).
- `DEFAULT_SVG_FILENAME = "work-graph.svg"`.

**Exported types:** `SvgFileOptions`, `SvgFileResult` (D5 shapes, all `readonly`).

**Exported functions:**
- `boardSvgPath(outDir?, fileName?): string` — pure path helper, `join(outDir, fileName)` (the
  `seatSpecPath` idiom; lets the test assert the path without fs).
- `writeBoardSvg(opts?: SvgFileOptions): Promise<SvgFileResult>` — the one impure verb.

**`writeBoardSvg` internal order:**
1. Resolve `graph = opts.graph ?? await loadWorkGraph()`.
2. Resolve `spec = opts.spec ?? defaultPresetForSeat(opts.seat ?? "designer")`.
3. `const projection = projectGraph(graph, spec)` — pure; `graph` returned reference-unchanged.
4. `const overlays: SvgOverlays = opts.title !== undefined ? { title: opts.title } : {}`.
5. `const svg = projectionToSvg(projection, overlays)`.
6. Resolve `path = boardSvgPath(opts.outDir, opts.fileName)`.
7. `await mkdir(dirname(path) or outDir, { recursive: true })` then `await writeFile(path, svg, "utf8")`.
8. Return `{ path, svg, groupCount: projection.groups.length, cardCount: Σ cards, linkCount:
   projection.links.length }`.

Honest-empty: an empty board flows through unchanged — `projectionToSvg` yields a minimal valid
`<svg>`, counts are `0`, the file is still written. A genuine fs failure THROWS (the
`saveSeatSpec`/`expandFragmentEffect` rule — a broken write is loud, not a swallowed outcome).

## `src/cli.ts` — the `vend svg` command

- **USAGE banner:** add a line `vend svg [--seat <designer|dev>] [--out <path>]`.
- **`ParsedCommand` union:** add `| { readonly cmd: "svg"; readonly seat: Seat; readonly out?: string }`.
  Import `Seat` type from `./present/presets.ts` (type-only — no addon, like the existing
  `ValueTier` type import from `shelf/menu.ts`). Mirror the local `VALUE_TIERS` tuple with a local
  `SVG_SEATS = ["designer", "dev"] as const` for a parse-time membership check without importing
  `presets` at parse time.
- **`parseArgs` dispatch:** add `if (argv[0] === "svg") return parseSvgArgs(argv);` before the
  `parseSelectOrBrowse` fallthrough.
- **`parseSvgArgs(argv)`:** flags-only (the `parseWorkArgs` shape, minus `--budget`). Walk from
  `i=1`: `--seat <word>` validated against `SVG_SEATS` (miss → usage), `--out <path>` (missing/`--`
  → usage), any other token → usage. Default `seat = "designer"`. Return
  `{ cmd: "svg", seat, ...(out ? { out } : {}) }`.
- **Dispatch arm (`import.meta.main`):** add an `if (parsed.cmd === "svg")` block: lazy-import
  `writeBoardSvg` from `./present/svg-file.ts`, call with `{ seat, ...(out ? derive outDir/fileName
  from out : {}) }`. For `--out <path>`: split into `outDir = dirname(path)`, `fileName =
  basename(path)` (lazy-import `node:path`, the `envelope` arm precedent). Print `wrote <path> —
  <groupCount> groups, <cardCount> cards, <linkCount> links`, exit 0. (fs errors propagate as a
  non-zero crash — acceptable for the thin shell, matching the other arms.)

## `src/cli.test.ts` — parser unit tests

A new `describe("parseArgs — svg (T-055-03 file-output seam)")` with cases:
- bare `svg` → `{ cmd: "svg", seat: "designer" }` (the default seat).
- `svg --seat dev` → `{ cmd: "svg", seat: "dev" }`.
- `svg --out path/to/board.svg` → `{ cmd: "svg", seat: "designer", out: "path/to/board.svg" }`.
- `svg --seat designer --out x.svg` → both set.
- `svg --seat bogus` → `usage` with an error naming the allowed seats.
- `svg --out` (no value) → `usage`.
- `svg frobnicate` → `usage` (unexpected positional).

## `src/present/svg-file.test.ts` — the seam test (hermetic)

Mirror `expand-effect.test.ts` (temp dir) + `projection-svg.test.ts` (fixture graph via `buildGraph`)
+ `one-way-authority.test.ts` (byte-hash bracket). Structure:
- Fixtures: a `miniGraph()` via `buildGraph` (reuse the `projection-svg.test.ts` mould — a few
  epics/stories/tickets with one cross-story dep) and a temp `outDir` via `mkdtemp`.
- **`writes a valid .svg to the chosen dir`:** call `writeBoardSvg({ graph, outDir })`; assert the
  file exists at `boardSvgPath(outDir)`, its content `=== result.svg`, starts with `<svg`, ends with
  `</svg>`, and `result` counts match the projection (one `<rect`/card, one `<line`/link).
- **`content equals the direct render`:** assert the written bytes `===
  projectionToSvg(projectGraph(graph, DESIGNER_PRESET))` — proves the seam adds no rendering of its
  own and is deterministic.
- **`honest-empty board → minimal valid svg`:** `writeBoardSvg({ graph: buildGraph([],[],[]),
  outDir })` writes a file containing `<svg` and `</svg>`, `cardCount === 0`, no throw.
- **`seat selects the spec`:** `writeBoardSvg({ graph, seat: "dev", outDir })` differs from the
  designer render (different `groupBy`) — proves D4 wiring.
- **AC tooth #3 — `graph object is reference-unchanged`:** hold `graph.tickets`, run the seam, assert
  `graph.tickets` is the same reference and `Object.isFrozen(graph)`.
- **AC tooth #2 — `never docs/active`:** byte-hash `docs/active` before/after a
  `writeBoardSvg({ outDir })` run **on the live board** (no injected graph), assert zero drift; assert
  the written path is under `outDir`, not under `docs/active`.
- **static guard reflex:** assert `classifyAuthorityViolations([["svg-file.ts", <source>]])` is `[]`
  (the seam's own source is guard-clean — writes `.vend`, never names `docs/active` in code).

## Ordering of changes (for Plan)

1. `svg-file.ts` (the seam) — compiles against landed legs.
2. `svg-file.test.ts` — green proves the seam + all three AC teeth.
3. `cli.ts` `vend svg` wiring.
4. `cli.test.ts` parser cases.
Each step is independently committable; (1)+(2) is the AC-bearing unit, (3)+(4) the gesture.
