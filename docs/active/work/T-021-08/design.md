# T-021-08 — Design: calibration-loop-demo

## What "done" means (re-reading the AC)

> A demo flips one knob (e.g. metaphor tree→board or density low→full), re-renders, and a test
> asserts the rendered output differs while no docs/active markdown changed; reloading the saved
> preset reproduces the tuned render.

Four assertions the artifact must make verifiable:
1. **flips one knob & re-renders** → there is a base render and a tuned render from the same graph.
2. **rendered output differs** → `before !== after`.
3. **no docs/active markdown changed** → `docs/active/**` byte-hash identical across the whole run.
4. **reloading the saved preset reproduces the tuned render** → save tuned → load → render ===
   tuned render (and the reloaded spec equals the tuned spec).

## D1 — Shape of the demo: a callable orchestrator returning a result record

**Options**

- **(A) A pure-ish orchestrator function** `runCalibrationDemo(opts)` that loads the graph, renders
  before/after, saves+reloads, and **returns a structured `CalibrationDemo` record** (both specs,
  both renders, the reloaded render, the projections, the knob descriptor, the saved path). The
  test calls it and asserts on the record.
- (B) A bare script with `console.log`s and no return value; the test re-implements the steps.
- (C) Bake the whole loop inside the test file; no production module.

**Decision: (A).** It matches the house "thin orchestrator + structured result" posture and makes
the demo *reusable* (a future CLI/TUI `demo` command, or docs generation, can call the same
function). (B) gives the test nothing to assert on without duplicating logic. (C) hides the demo —
the ticket asks for *a demo*, a named artifact, not just a test. The function is the demo; the test
is its proof.

## D2 — Which knob to flip: `density: low → full`

**Options**: `metaphor tree→board`, `density low→full` (both named in the AC), `groupBy story→status`,
`colorLanguage`, `vocabulary`.

**Decision: `density: low → full`**, starting from the **designer** seat's built-in preset.

Rationale, grounded in Research:
- The AC names density explicitly → 1:1 mapping, lowest reviewer-verification cost.
- `DESIGNER_PRESET.density === "low"` (spec.ts:117) and the flip target is `"full"` → the change is
  **guaranteed non-trivial by construction** (base ≠ target), not contingent on board contents.
- `density` is echoed in `presetHeader` (paper.ts:342) → the **rendered paper is guaranteed to
  differ** (`density: low` → `density: full`) on *any* board, even an empty one.
- `density` is echoed onto `Projection.density` (project.ts:237) → the **projection IR also
  differs**, so the test can show the knob reaches the data layer, not just a cosmetic label.

**Honest scope note (carried into review):** in the *current* renderer, density's effect on the
paper is confined to the self-describing preset header; its *graduated* per-card effect is a
documented v1 deferral (project.ts:24-30). The demo therefore additionally asserts the **projection
IR** differs, so "the view changed" is demonstrated at the data layer too, not overstated at the
render layer. `groupBy` would give a richer *body* diff but couples the assertion to the live
board's group shape and drifts from the AC's named example — rejected for robustness + fidelity.

## D3 — Start the base spec from the built-in default, not `loadSeatSpec`

**Options**: base = `loadSeatSpec(seat, dir)` (shows the loop "starting from a seat") vs base =
`defaultPresetForSeat(seat)` (the built-in).

**Decision: `defaultPresetForSeat(seat)`.** `loadSeatSpec` against a dir that may already hold a
saved tune could return a `density:full` spec, making the "low→full" flip a silent no-op and
breaking `before !== after`. Starting from the built-in default is **deterministic** and keeps the
flip meaningful regardless of what is on disk. The save/reload leg still exercises `saveSeatSpec` +
`loadSeatSpec` fully — we just don't use the seat file to seed the *base*.

## D4 — Where the preset is saved: caller-supplied dir, default `.vend/presets`

**Decision:** `runCalibrationDemo({ presetsDir })` threads a dir straight into
`saveSeatSpec/loadSeatSpec`, defaulting to `DEFAULT_PRESETS_DIR`. The **test passes a `mkdtemp`
temp dir** so the demo never writes the repo's `.vend`. This is the presets.test.ts precedent and
keeps the one-way-authority byte-hash assertion clean — the only write goes to a throwaway dir,
provably outside `docs/active`.

## D5 — Injectable graph for fast/deterministic tests; live board for the AC

**Decision:** `runCalibrationDemo({ graph })` accepts a pre-built `WorkGraph`; when omitted it
`await loadWorkGraph()`. The test suite runs the demo **both** ways:
- a **fabricated miniGraph** (the paper.test.ts fixture style) → fast, hermetic unit-level coverage
  of `before≠after`, `reproduced===after`, IR-differs, spec round-trip.
- the **live board** (`loadWorkGraph()`) → the AC contract: asserts `tickets.length > 0`, the
  before/after/reproduced relationships, **and** the `docs/active` byte-hash is unchanged.

## D6 — Asserting "no docs/active markdown changed": reuse `hashTree`

**Options**: re-export `hashTree` from one-way-authority.test.ts; re-implement it in the new test;
factor it into a shared test util.

**Decision: re-implement the ~15-line `hashTree` locally in the new test** (no shared test-util
module exists; introducing one is out of scope and would touch a sibling's file). It is small,
self-contained, and the duplication is confined to test files. The demo test snapshots
`docs/active` before `runCalibrationDemo(liveBoard)` and after, asserting zero drift — the same
discipline T-021-07 established, now wrapped around the *calibration* path specifically.

## D7 — The `CalibrationDemo` result contract

Return a single frozen-enough record (plain readonly object) carrying everything the test (or a
future CLI) needs, so callers never re-run the loop to inspect a piece:
- `seat`, `knob: { field, from, to }` — what was turned.
- `baseSpec`, `tunedSpec`, `reloadedSpec` — the three specs.
- `before`, `after`, `reproduced` — the three rendered papers.
- `baseProjection`, `tunedProjection` — the two IRs (so the IR-differs claim is inspectable).
- `savedPath` — where the tuned preset was written (for the test to confirm it's outside docs/active).

## D8 — Purity & determinism posture

The demo is **impure** (graph load + preset fs), so it sits beside `presets.ts`/`load.ts` as an
orchestrator and its test is an integration test. But it adds **no nondeterminism**: no clock, no
random; `renderPaper`/`projectGraph`/`serializeSpec` are all deterministic, so `before`/`after`/
`reproduced` are reproducible byte-for-byte (P5). The header comment will state this posture, per
house convention.

## Rejected, briefly

- **Flipping `groupBy`** — richer body diff but board-shape-coupled and off the AC's named knobs (D2).
- **A real CLI `vend demo` command** — needs the deferred TUI/CLI epic; out of scope. The callable
  function is the seam a CLI will later wrap.
- **Mutating `DESIGNER_PRESET` in place to tune** — it is frozen and shared; tuning is a spread copy
  with `preset:"custom"` (the presets.test.ts tuned-spec idiom).
- **Asserting only the projection differs** — the AC says "rendered output differs"; we assert the
  paper string differs *and* (additionally) the IR, never substituting one for the other.
