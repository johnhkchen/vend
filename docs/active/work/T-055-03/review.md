# T-055-03 — Review: svg-file-output-seam

_Phase: Review. The handoff doc — what changed, coverage, open concerns._

## Summary

T-055-03 closes E-055 (projection-to-svg-renderer) by adding the **file-output seam** the renderer
left for it: the impure verb that loads the live board, projects it, renders the SVG (via T-055-02's
`projectionToSvg`), and writes the `.svg` to a file — plus a thin `vend svg` CLI gesture. This is the
unblocked, MCP-independent visual half of the non-dev round-trip (Frontier 4): a portable, offline
file, not a live Linear/MCP integration.

The seam adds **no rendering logic** — it composes three landed legs (`loadWorkGraph` →
`projectGraph` → `projectionToSvg`) and adds exactly one mutation (one `.vend` write). Verified live:
the real board renders to a valid 17128×380 SVG — 62 groups, 133 cards, 89 links.

## Files changed

| File | Action | Lines | Notes |
|---|---|---|---|
| `src/present/svg-file.ts` | create | ~120 | The seam: `writeBoardSvg` + `boardSvgPath` + option/result types + `.vend` constants. |
| `src/present/svg-file.test.ts` | create | ~250 | 10 hermetic tests — all three AC teeth. |
| `src/cli.ts` | modify | +~45 | `vend svg [--seat][--out]`: USAGE, `Seat` import, `SVG_SEATS`, union member, `parseSvgArgs`, dispatch arm. |
| `src/cli.test.ts` | modify | +~40 | 7 `parseSvgArgs` cases. |
| `docs/active/work/T-055-03/*.md` | create | — | RDSPI artifacts. |

Two atomic commits: `4574dcf` (seam + test), `7f2959b` (CLI + parser tests). No file deleted; no
existing `src/present/` module touched.

## Acceptance criteria — how each is met

> Running the seam against the live board writes a `.svg` that opens in any viewer and shows a
> swimlane per group, a labeled box per card, and an edge per link …

✅ `writeBoardSvg()` against the live board wrote a well-formed `<svg>` (root + `viewBox`), one
labeled swimlane per `ProjectionGroup`, one `<rect>` + face `<text>` per `ProjectedCard`, one
`<line>` per `depends_on` link — all owned by the already-shipped `projectionToSvg`. Demonstrated
live (62/133/89) and via `vend svg --out …`. Tests assert one `<rect>` per card and one `<line>` per
link, content `startsWith("<svg")` / ends `</svg>`, and that the written bytes equal the direct
`projectionToSvg(projectGraph(graph, DESIGNER_PRESET))` render.

> … the authority-guard one-way-authority build gate stays green (the seam writes the staged
> artifact, never docs/active) …

✅ The artifact is written under **`.vend`** (default `.vend/work-graph.svg`) — provably outside
`docs/active`, the `presets.ts` / `calibration-demo.ts` "staged, never docs/active" precedent
(design D1). Two guards confirm it: (a) the **static** scan — `authority-guard.test.ts` globs
`src/present/*.ts`, now including `svg-file.ts`, and finds it clean (it imports a writer but never
names `docs/active` in code); a dedicated reflex test asserts `classifyAuthorityViolations` returns
`[]` for the seam's own source. (b) the **runtime** byte-hash — a seam test brackets a real
live-board `writeBoardSvg` run with a SHA-256 snapshot of all of `docs/active` and asserts zero
drift, plus that the written path is under the temp dir and not under `docs/active`.

> … and the loaded graph object is reference-unchanged.

✅ `projectGraph` returns the graph reference-unchanged (E-021 invariant); the seam never mutates it.
A test holds `graph.tickets`, runs the seam, and asserts the same reference + `Object.isFrozen(graph)`.

## Test coverage

10 seam tests + 7 parser tests = **17 new** (suite 1255 → 1272, 0 fail). Coverage:
- valid `.svg` written at the resolved path; content === returned `svg`; `<svg>`…`</svg>` envelope.
- counts (`groupCount`/`cardCount`/`linkCount`) match the projection; one `<rect>`/card, `<line>`/link.
- written bytes === direct render (seam adds no rendering); determinism (second run byte-identical).
- `title` overlay → `<title>`; absent → none (honest-empty).
- empty board → minimal valid `<svg>`, `cardCount: 0`, file still written, no throw.
- seat selects the spec (dev ≠ designer render).
- AC teeth #2 (live-board byte-hash + static guard reflex) and #3 (graph reference-unchanged).
- parser: default seat, `--seat`, `--out`, composition, bad seat, missing `--out`, bad positional.

**Gaps (acceptable, by design):**
- The CLI **dispatch arm** (the `import.meta.main` block) is untested — the house pattern (pure
  parsers are unit-tested; the impure shell is exercised by hand). Verified manually live.
- No test pins the rendered SVG **renders correctly in a specific viewer** — out of scope and
  untestable without a browser; the SVG is well-formed XML and `projection-svg.test.ts` already pins
  its structure exhaustively.

## Open concerns / follow-ons (none blocking)

- **Saved-tune projection deferred (design D4):** the seam projects under the seat's **built-in**
  preset (`defaultPresetForSeat`), not a designer's saved tune (`loadSeatSpec`). A clean future
  enhancement — add a `--tuned` flag / honor `.vend/presets` — noted, not built (kept scope tight).
- **Large-SVG ergonomics:** the live board renders 17128px wide (62 lanes). That is the renderer's
  deterministic geometry (T-055-01), working as designed for a "large static SVG" surface; any
  pan/zoom/scale affordance is a renderer concern, not the seam's, and not in E-055's scope.
- **E-055 named follow-ons (out of scope, not hidden):** the Linear-MCP live integration (still
  blocked) and the annotation→demand round-trip.

## Verdict

AC met end-to-end, both gates green, two clean commits, no deviations of substance. E-055 is
complete — the Projection IR now has four consumers (project → paper, projection-svg, svg-file), and
the non-dev round-trip has its unblocked, offline visual surface. Ready for human review.
