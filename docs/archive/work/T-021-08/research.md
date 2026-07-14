# T-021-08 — Research: calibration-loop-demo

## Ticket in one line

Demonstrate the calibration loop: turn one knob in the spec, re-render, prove the
projection/render changes **while no `docs/active` markdown changes**, then save the tuned
designer preset and prove reloading it reproduces the tuned render on demand.

This is the *capstone* of E-021's data/presentation split (story S-021-04). It writes no new
mechanism — every leg it composes has already landed. The work is a **demo module + an
integration test** that wires the four legs together and asserts the loop's defining property.

## The four legs already on the shelf

| Leg | Module | Pure? | What this demo uses from it |
|---|---|---|---|
| Data (source of truth) | `src/graph/load.ts` → `loadWorkGraph()` | impure (read-only fs) | loads the live board as a frozen `WorkGraph` |
| Spec (the knobs) | `src/present/spec.ts` | pure | `PresentationSpec`, `DESIGNER_PRESET`, the closed-set knob types |
| Projection (graph×spec→IR) | `src/present/project.ts` → `projectGraph()` | pure | the `Projection` IR; flips visibly when a knob turns |
| Render (IR→paper) | `src/present/paper.ts` → `renderPaper()` | pure | the human-facing artifact string the AC's "rendered output" refers to |
| Persistence (save/load seat) | `src/present/presets.ts` | pure core + 2 fs verbs | `defaultPresetForSeat`, `saveSeatSpec`, `loadSeatSpec` |

All five are landed and green (713 tests at the T-021-07/06 baseline). Nothing here needs new
production logic in those modules.

## How a knob reaches the rendered output (the mechanism the demo exercises)

`renderPaper(graph, spec)` (paper.ts:362) composes:
1. `presetHeader(spec)` (paper.ts:340) — a self-describing blockquote that **echoes every knob**:
   `vocabulary · density · metaphor · color_language · group_by`. So **any** knob flip changes
   this header line → the rendered string is guaranteed to differ, independent of board shape.
2. `renderDesignerView(graph, projectGraph(graph, spec))` — the Mermaid tree (graph-walked,
   state-colored) + the projected card faces (in projection group order).
3. `renderFounderBrief(projectGraph(graph, founderSpec(spec)))` — `founderSpec` (paper.ts:351)
   forces `groupBy:epic · colorLanguage:status · density:low`, so the brief is invariant to most
   knob flips by design.

Effect of each knob on the **rendered paper** in the *current* renderer:
- `density`, `metaphor`, `vocabulary`, `colorLanguage` → change the **preset header line** only;
  their *graduated* render effect is a documented v1 deferral (see project.ts:24-30, "carried
  onto the projection … but their graduated effect is a v1 deferral").
- `groupBy` → header line **plus** reorders/regroups the designer card faces (renderFaces flattens
  `projection.groups` in order, paper.ts:281).

Effect on the **projection IR** (`projectGraph`):
- `density`/`metaphor`/`colorLanguage` are echoed onto `Projection.{density,metaphor,colorLanguage}`
  (project.ts:237) → IR differs by that field.
- `colorLanguage` additionally re-tokens every `ProjectedCard.color` (project.ts:168).
- `groupBy` restructures `Projection.groups` wholesale (project.ts:107).

**Conclusion for the demo:** flipping `density: low → full` (the AC's literal example) is
guaranteed to change both the rendered paper (header line) and the projection IR (the `density`
field), on any board, with zero dependence on the live board's current contents. It is the
lowest-risk, board-shape-independent choice that maps 1:1 to the acceptance criteria.

## The one-way-authority invariant (the AC's "no docs/active markdown changed")

This is already guaranteed structurally and already tested two ways (T-021-07):
- `src/present/one-way-authority.test.ts` — SHA-256 snapshots all of `docs/active/**` before and
  after running load → project → render, asserts byte-identical. The demo's read path is the
  *same* path, so the demo inherits the guarantee.
- `src/present/authority-guard.ts` — a static classifier proving no present module imports a
  writer against `docs/active`.

The **only** write in the whole demo is `saveSeatSpec`, which writes to `.vend/presets/<seat>.yaml`
(presets.ts:120, `DEFAULT_PRESETS_DIR = ".vend/presets"`) — *outside* `docs/active`, and
overridable per call so a test points it at a temp dir. So the demo writes a preset file but
never a board file. The `hashTree` technique from one-way-authority.test.ts is the exact tool to
re-assert "no docs/active markdown changed" across the demo run.

## The persistence round-trip (the AC's "reproduces on demand")

`presets.ts` already proves byte-equal round-trips (presets.test.ts:107). The demo's job is the
*value-level* reproduction: `saveSeatSpec(seat, tuned, dir)` → `loadSeatSpec(seat, dir)` returns a
spec that `toEqual(tuned)`, and `renderPaper(graph, reloaded) === renderPaper(graph, tuned)`. Two
facts make this hold:
- `serializeSpec` is canonical/deterministic (presets.ts:80) — save→load→equal.
- `renderPaper` is pure & deterministic (paper.test.ts:199-202, "deterministic (P5)") — same
  spec + same graph → byte-identical paper.

`loadSeatSpec` semantics that matter here (presets.ts:152):
- missing file (ENOENT) → `defaultPresetForSeat(seat)` (so an *unsaved* designer seat = `DESIGNER_PRESET`).
- present-but-corrupt → throws `PresentationSpecError` (loud, never silently defaulted).

## Test/fixture conventions to mirror

- **Integration test over the live board**: `one-way-authority.test.ts` / `paper.test.ts`'s
  "AC (live board)" block — `await loadWorkGraph()` (cwd = repo root), assert `tickets.length > 0`.
- **Real-fs temp dir** for the save/load leg: `presets.test.ts` uses `mkdtemp(tmpdir(), "vend-…")`
  + `afterAll` cleanup. The demo test must save to a temp dir, never the repo's `.vend`.
- **Byte-hash docs/active**: `hashTree` from one-way-authority.test.ts.
- **AC contract block**: every present test closes with a `describe("T-0xx-xx — AC …")` block that
  maps tests to AC clauses verbatim — follow that.

## Module-shape conventions (house pattern)

- A long header comment stating purpose, purity posture, one-way authority, composition-not-
  reinvention. Every present module follows this (spec/project/paper/translate/presets).
- Type-only imports for graph/spec types; value imports only for the pure functions used.
- `import` paths carry the `.ts` extension (Bun ESM), e.g. `"./paper.ts"`.
- No barrel/index in `src/present/` — tests import modules directly.

## Constraints & assumptions

- The demo is **impure** (loads the graph, writes/reads a preset file) — so it lives alongside
  `presets.ts`/`load.ts` as an orchestrator, not in the pure core; its test is an integration test.
- Stay inside `src/present/`. No CLI/TUI wiring (deferred epic) — the "demo" is a callable
  orchestrator returning a structured result a test asserts on, not an interactive surface.
- Determinism: no clock/random anywhere (P5). `renderPaper` and `projectGraph` are already pure.
- D-005 stop gate polices **all** uncommitted `src/` files across threads — commit only this
  ticket's own files, leave siblings alone (T-021-07 precedent).
