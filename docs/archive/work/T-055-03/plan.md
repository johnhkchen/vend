# T-055-03 — Plan: svg-file-output-seam

_Phase: Plan. Ordered, independently-verifiable steps + the testing strategy._

## Testing strategy

- **Unit, no live model, hermetic.** The seam is impure (graph load + `.vend` write) but every test
  injects a fabricated `graph` (via `buildGraph`, the `projection-svg.test.ts` mould) and a temp
  `outDir` (via `mkdtemp`, the `expand-effect.test.ts` mould) — so no test touches the repo's real
  `.vend` or board.
- **One live-board test** for the authority teeth: byte-hash `docs/active` around a real
  `writeBoardSvg({ outDir: temp })` (no injected graph), proving the read-then-write path leaves the
  board byte-identical (the `one-way-authority.test.ts` bracket).
- **Pure-parser unit tests** for the CLI, in `cli.test.ts` — the dispatch arm is the untested thin
  shell (house pattern).
- **Gates:** `bun test` (full suite green, incl. the real-source authority scan picking up the new
  `svg-file.ts` and finding it clean) and `tsc --noEmit` (clean under `noUncheckedIndexedAccess`).

## Steps

### Step 1 — `src/present/svg-file.ts` (the seam)
Write the module per structure.md: header block; `DEFAULT_SVG_DIR`/`DEFAULT_SVG_FILENAME`;
`SvgFileOptions`/`SvgFileResult`; `boardSvgPath`; `writeBoardSvg` (resolve graph → resolve spec →
`projectGraph` → overlays → `projectionToSvg` → `mkdir -p` → `writeFile` → typed record).
**Verify:** `tsc --noEmit` clean.
**Commit:** `feat(present): svg-file seam — load→project→render→write .vend/work-graph.svg (T-055-03)`.

### Step 2 — `src/present/svg-file.test.ts` (the AC-bearing test)
Write the seven cases from structure.md: valid-svg-written, content==direct-render, honest-empty,
seat-selects-spec, graph-reference-unchanged (tooth #3), never-docs/active byte-hash on the live
board (tooth #2), static-guard-clean reflex. Tooth #1 (swimlane/box/edge) is covered by the
counts + the `<rect>`/`<line>` assertions plus the inherited `projection-svg.test.ts` structural
suite.
**Verify:** `bun test src/present/svg-file.test.ts` green; then full `bun test` green (the real-source
authority scan now includes `svg-file.ts`).
**Commit:** fold into Step 1's commit if landed together, else `test(present): svg-file seam — AC
teeth + hermetic temp-dir coverage (T-055-03)`.

### Step 3 — `src/cli.ts` (`vend svg` command)
Add the USAGE line, the `Seat` type import + local `SVG_SEATS` tuple, the `{ cmd: "svg" }` union
member, the `parseArgs` branch, `parseSvgArgs`, and the `import.meta.main` dispatch arm
(lazy-import `writeBoardSvg`, derive `outDir`/`fileName` from `--out` via `node:path`, print + exit).
**Verify:** `tsc --noEmit` clean; `vend svg --out /tmp/board.svg` writes a real openable SVG.
**Commit:** `feat(cli): vend svg — thin gesture over the svg-file seam (T-055-03)`.

### Step 4 — `src/cli.test.ts` (parser cases)
Add the `describe("parseArgs — svg …")` block with the seven cases from structure.md.
**Verify:** full `bun test` green; `tsc --noEmit` clean.
**Commit:** fold into Step 3, else `test(cli): parseSvgArgs cases (T-055-03)`.

## Risk register

| Risk | Likelihood | Mitigation |
|---|---|---|
| Static authority guard flags `svg-file.ts` | low | D1/D3: write `.vend`, never name `docs/active` in code (comments are stripped). A dedicated test asserts `classifyAuthorityViolations` returns `[]` for the seam's source. |
| Live-board byte-hash test flaky if seam ever writes under `docs/active` | low | D1 puts output in a temp `.vend` dir; the test passes `outDir: <temp>`, so even the live-board run writes outside `docs/active`. |
| `--out` path with no dir (`board.svg`) → `dirname` is `.` | low | `mkdir(".", {recursive:true})` is a no-op success; `writeFile` lands in cwd. Acceptable + tested. |
| `noUncheckedIndexedAccess` on `projection.groups` reduce | low | Use `.reduce((n,g)=>n+g.cards.length,0)` — no index access; same idiom as `projection-svg.test.ts`'s `cardCount`. |
| Scope creep into a saved-tune read / richer CLI | low | D4: `defaultPresetForSeat` only; `loadSeatSpec` explicitly deferred. CLI is flags-only, no `--budget`. |

## Out of scope (named, not hidden)
- Saved-tune (`loadSeatSpec`) projection — future enhancement (D4).
- Linear-MCP live integration and the annotation→demand round-trip — E-055's named follow-ons.
- Any change to the renderer, toolkit, or authority guard — reused untouched.
