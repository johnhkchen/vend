# T-021-08 — Review: calibration-loop-demo

## What shipped

The capstone of E-021's data/presentation split: a callable demo that performs **one full turn of
the calibration loop** and a test that asserts the loop's defining property. No new mechanism in
the composed legs — pure composition of load → spec/presets → project → paper.

### Files created
| File | Lines | Role |
|---|---|---|
| `src/present/calibration-demo.ts` | ~135 | the demo orchestrator `runCalibrationDemo` + `CalibrationDemo` record + `describeFlip` |
| `src/present/calibration-demo.test.ts` | ~190 | 6 unit tests (fabricated graph) + 1 AC test (live board, docs/active byte-hash) |

### Files modified / deleted
None. The four legs (load, spec/presets, project, paper) are untouched.

### Commit
- `feat(present): calibration-loop demo — flip a knob, re-render, save/reload (T-021-08)` —
  both files together (the test is the demo's proof; they are meaningless apart).

## How it maps to the AC

> A demo flips one knob (e.g. … density low→full), re-renders, and a test asserts the rendered
> output differs while no docs/active markdown changed; reloading the saved preset reproduces the
> tuned render.

| AC clause | Where it's proven |
|---|---|
| flips one knob & re-renders | `runCalibrationDemo`: base = designer preset (`density:low`) → tuned `density:full`; renders `before`/`after` |
| rendered output differs | unit test `d.before !== d.after` (+ header shows `density: low` vs `density: full`); AC test asserts it on the **live board** |
| no docs/active markdown changed | AC test SHA-256-hashes `docs/active/**` before and after the whole run and asserts zero drift |
| reloading the saved preset reproduces the tuned render | `saveSeatSpec` → `loadSeatSpec`; tests assert `reloadedSpec toEqual tunedSpec` and `reproduced === after` |

## Test coverage

- **720 tests pass** (713 baseline + 7 new), `tsc --noEmit` clean, `bun run check` fully green.
- Unit (hermetic, fabricated `miniGraph` + temp preset dir): knob descriptor + render differs;
  **IR also differs** (`baseProjection.density` vs `tunedProjection.density`, stringified
  projections differ); reload reproduces; saved path is outside `docs/active`; determinism (two
  runs → equal renders); `describeFlip`.
- AC (live board): real `loadWorkGraph()` (`tickets.length > 0`), the before/after/reproduced
  relationships, and the `docs/active` byte-hash invariant — the one-way-authority teeth, now
  wrapped specifically around the calibration path.

### Gaps / not covered
- The demo's `saveSeatSpec`/`loadSeatSpec` fs verbs are exercised via the demo but not re-unit-
  tested here — they already have direct coverage in `presets.test.ts`. Intentional (no duplication).
- `describeFlip` is a convenience one-liner with one assertion; it is not load-bearing for the AC.

## Open concerns / honest limitations

1. **Density's render effect is currently header-only.** In the *current* renderer, flipping
   `density` changes the rendered paper only in the self-describing **preset header** line; its
   graduated per-card effect is a documented v1 deferral (project.ts:24-30). The demo therefore
   *additionally* asserts the **projection IR** differs, so "the view changed" is demonstrated at
   the data layer too — never overstated at the render layer. If a future renderer graduates
   density, the demo's assertions only get stronger. A maintainer wanting a richer *body* diff can
   flip `groupBy` instead (design D2 records the lever and why it was not chosen: board-shape
   coupling + drift from the AC's named knob).
2. **The demo is the seam a future CLI wraps**, not an interactive surface. `vend demo` is deferred
   to the TUI/CLI epic; `runCalibrationDemo` returns a structured record precisely so that command
   (or docs generation) can later call it unchanged.

## ⚠ Needs human / Lisa attention

- **D-005 stop gate is currently red on a SIBLING file, not mine.** `bun run check:committed`
  reports `src/probe/rubric.ts` uncommitted. That file belongs to **T-021-09** (an active,
  concurrent thread — its `docs/active/work/T-021-09/` artifacts are being written now) and its
  required `rubric.test.ts` does **not yet exist**, so it is work-in-progress, not complete-and-
  green. Unlike the T-021-07 precedent (where the sibling `paper.*` was complete with a passing
  test and was committed on its behalf), committing an in-flight, untested module would race its
  owner and risk capturing a broken intermediate state. **I deliberately left it for the T-021-09
  thread to commit.** All of *this* ticket's source is committed and green; the gate will clear
  once T-021-09 lands `rubric.ts` + its test.

## Reviewer's quick path

1. Read `src/present/calibration-demo.ts` (one function, six clearly-numbered steps).
2. Read the AC test block `T-021-08 — AC (live board)` — it is the whole ticket in ~20 lines.
3. `bun test src/present/calibration-demo.test.ts` → 7 pass.
