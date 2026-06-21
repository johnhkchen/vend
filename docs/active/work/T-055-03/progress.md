# T-055-03 — Progress: svg-file-output-seam

_Phase: Implement. Execution log against plan.md. Two atomic commits._

## Completed

### Step 1 + 2 — the seam + its test → commit `4574dcf`
`feat(present): svg-file seam — load→project→render→write .vend/work-graph.svg`

- **`src/present/svg-file.ts`** (created): the FOURTH composition over the Projection IR. Exports
  `DEFAULT_SVG_DIR = ".vend"`, `DEFAULT_SVG_FILENAME = "work-graph.svg"`, `boardSvgPath()`,
  `SvgFileOptions`, `SvgFileResult`, and the one impure verb `writeBoardSvg(opts?)`. Internals exactly
  per structure.md: resolve graph (`opts.graph ?? loadWorkGraph()`) → resolve spec (`opts.spec ??
  defaultPresetForSeat(opts.seat ?? "designer")`) → `projectGraph` → build `SvgOverlays` from
  `opts.title` → `projectionToSvg` → `mkdir -p` + `writeFile` under `.vend` → return the path + svg +
  IR counts. Header block mirrors `calibration-demo.ts` (impure-orchestrator posture + one-way
  authority: writes `.vend`, never `docs/active`).
- **`src/present/svg-file.test.ts`** (created): 10 hermetic tests (injected `buildGraph` fixtures +
  `mkdtemp` temp dirs). Covers all three AC teeth (see review.md). Green: 10 pass / 32 expect.
- **Gates:** `tsc --noEmit` clean; the real-source authority scan (`authority-guard.test.ts`,
  which globs `src/present/*.ts` and now includes `svg-file.ts`) stays green — the seam writes
  `.vend` and never names `docs/active` in code.
- **Live demo:** `writeBoardSvg({ outDir: /tmp/… })` against the real board wrote a valid
  17128×380 SVG — **62 groups, 133 cards, 89 links**, 133 `<rect>` (one per card).

### Step 3 + 4 — the `vend svg` CLI gesture + parser tests → commit `7f2959b`
`feat(cli): vend svg — thin gesture over the svg-file seam`

- **`src/cli.ts`** (modified): added the USAGE line; a type-only `Seat` import + a local
  `SVG_SEATS = ["designer","dev"]` tuple (parse-time membership check without importing the present
  layer); the `{ cmd: "svg"; seat; out? }` union member; the `parseArgs` branch; `parseSvgArgs`
  (flags-only — `--seat` validated, `--out` optional); and the `import.meta.main` dispatch arm
  (lazy-imports `writeBoardSvg` + `node:path`, splits `--out` into dir/filename, prints
  `wrote <path> — N groups, N cards, N links`, exits 0).
- **`src/cli.test.ts`** (modified): a `describe("parseArgs — svg …")` with 7 cases (default seat,
  `--seat`, `--out`, composition, bad seat, missing `--out` value, unexpected positional).
- **Gates:** full `bun test` green — **1272 pass / 0 fail** (was 1255 at T-055-02; +17 = 10 seam +
  7 parser). `tsc --noEmit` clean. Live `vend svg --out …` wrote the real board; `vend svg --seat
  founder` cleanly refused with the allowed-seats usage error.

## Deviations from plan

**None of substance.** Two micro-notes:
- The plan allowed folding Step 2 into Step 1's commit and Step 4 into Step 3's; both folds were
  taken (two commits total, as the plan's "fold into" branch anticipated).
- `mkdir` is called on `dirname(path)` (not the raw `outDir`) so a `--out` with nested dirs creates
  the full parent chain — strictly more correct than the structure.md sketch, same behavior for the
  default `.vend` case.

## State
All four steps landed and committed. Both gates green. The AC is met end-to-end (seam function +
CLI gesture + live-board demo). Nothing outstanding for Implement.
