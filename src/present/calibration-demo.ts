// The CALIBRATION-LOOP DEMO — the capstone of E-021's data/presentation split (T-021-08, story
// S-021-04). It composes the four landed legs into ONE turn of the loop the whole epic exists to
// deliver: start from a seat's preset, TURN ONE KNOB in the spec, re-render, watch the projection
// and the rendered paper change — then SAVE the tuned designer preset and prove that reloading it
// REPRODUCES the tuned render on demand. Grounded in docs/active/pm/linear-surface-prep.md §2c
// ("the same graph renders differently per seat") and the E-021 promise "calibration edits the
// spec, never the data."
//
// COMPOSITION, NOT REINVENTION: this module adds NO projection/render/persistence logic. It wires
// the legs that already landed — load (T-021-01), spec/presets (T-021-02/03), projection
// (T-021-05), paper render (T-021-06) — into a single orchestrated transaction and returns a
// structured record a test (or a future CLI `demo` command) asserts on. The demo IS the function;
// its proof is calibration-demo.test.ts.
//
// PURITY / POSTURE (house pattern, cf. presets.ts / load.ts): this orchestrator is IMPURE — it
// loads the live graph and writes+reads a seat preset file — so it sits beside the other impure
// verbs, not in the pure core, and its test is an integration test. But it adds NO nondeterminism:
// no clock, no random; `projectGraph` / `renderPaper` / `serializeSpec` are all deterministic, so
// `before` / `after` / `reproduced` reproduce byte-for-byte (P5).
//
// ONE-WAY AUTHORITY (E-021 invariant; the AC's teeth): the demo READS the graph and never writes
// it. Its ONLY mutation is `saveSeatSpec`, which writes the tuned preset under `.vend/presets`
// (overridable per call) — provably OUTSIDE docs/active. The AC test brackets the whole run with a
// docs/active byte-hash to prove not one board file changed while the view did.

import { loadWorkGraph } from "../graph/load.ts";
import type { WorkGraph } from "../graph/model.ts";
import type { Density, PresentationSpec } from "./spec.ts";
import { projectGraph } from "./project.ts";
import type { Projection } from "./project.ts";
import { renderPaper } from "./paper.ts";
import { DEFAULT_PRESETS_DIR, defaultPresetForSeat, loadSeatSpec, saveSeatSpec } from "./presets.ts";
import type { Seat } from "./presets.ts";

// ── the turned knob + the demo's options/result contract ──────────────────────────────────────────

/** The one knob this demo turns: which field, and its before/after values (self-describing). The AC
 *  names `density low→full` as an example; this demo turns exactly that. */
export interface KnobFlip {
  readonly field: "density";
  readonly from: Density;
  readonly to: Density;
}

/** Options for {@link runCalibrationDemo} — all optional (live board, designer seat, .vend default).
 *  Tests inject a fabricated `graph` and a temp `presetsDir` so the run is hermetic and the repo's
 *  `.vend` is never touched. */
export interface CalibrationDemoOptions {
  /** A pre-built graph; omitted → {@link loadWorkGraph} reads the live board. */
  readonly graph?: WorkGraph;
  /** The seat whose preset is tuned and saved; default `"designer"` (the AC's seat). */
  readonly seat?: Seat;
  /** Where the tuned preset is written/read; default {@link DEFAULT_PRESETS_DIR}. */
  readonly presetsDir?: string;
}

/** The structured proof of one calibration-loop turn — every piece a checker (or a CLI) inspects
 *  without re-running the loop. `before`/`after`/`reproduced` are the rendered papers; the two
 *  projections expose that the knob reached the data layer, not just the self-describing header. */
export interface CalibrationDemo {
  readonly seat: Seat;
  readonly knob: KnobFlip;
  readonly baseSpec: PresentationSpec;
  readonly tunedSpec: PresentationSpec;
  readonly reloadedSpec: PresentationSpec;
  /** `renderPaper(graph, baseSpec)` — the seat's default view. */
  readonly before: string;
  /** `renderPaper(graph, tunedSpec)` — the view after the knob turned. Differs from `before`. */
  readonly after: string;
  /** `renderPaper(graph, reloadedSpec)` — the view rebuilt from the SAVED preset. Equals `after`. */
  readonly reproduced: string;
  readonly baseProjection: Projection;
  readonly tunedProjection: Projection;
  /** Where the tuned preset was written — outside docs/active (the one-way-authority guarantee). */
  readonly savedPath: string;
}

// ── the demo (one orchestrated turn of the loop) ──────────────────────────────────────────────────

/**
 * Run one full turn of the calibration loop and return the {@link CalibrationDemo} record. The
 * steps, in order:
 *   1. start from the seat's BUILT-IN default preset (deterministic base — designer is `density:low`);
 *   2. render + project the base view (`before` / `baseProjection`);
 *   3. TURN ONE KNOB — `density: low → full`, marking the result a `custom` (tuned) spec —
 *      then render + project the tuned view (`after` / `tunedProjection`), which differs;
 *   4. SAVE the tuned preset to the seat, then RELOAD it and render again (`reproduced`), which
 *      equals `after` because serialize/deserialize and the renderer are deterministic.
 *
 * Impure (graph load + preset fs) but deterministic. Asserts nothing — a demo produces a record; a
 * test owns the verdicts. Writes ONLY the seat preset under `presetsDir`; never touches docs/active.
 */
export async function runCalibrationDemo(opts: CalibrationDemoOptions = {}): Promise<CalibrationDemo> {
  const seat: Seat = opts.seat ?? "designer";
  const presetsDir = opts.presetsDir ?? DEFAULT_PRESETS_DIR;
  const graph = opts.graph ?? (await loadWorkGraph());

  // 1-2. the seat's default preset is the loop's starting point — render + project it.
  const baseSpec = defaultPresetForSeat(seat);
  const before = renderPaper(graph, baseSpec);
  const baseProjection = projectGraph(graph, baseSpec);

  // 3. turn one knob: density low → full. A tuned spec is a `custom` preset (no built-in twin).
  const tunedSpec: PresentationSpec = { ...baseSpec, density: "full", preset: "custom" };
  const after = renderPaper(graph, tunedSpec);
  const tunedProjection = projectGraph(graph, tunedSpec);

  // 4. save the tuned preset, reload it, and re-render — "reproduces on demand."
  const savedPath = await saveSeatSpec(seat, tunedSpec, presetsDir);
  const reloadedSpec = await loadSeatSpec(seat, presetsDir);
  const reproduced = renderPaper(graph, reloadedSpec);

  return {
    seat,
    knob: { field: "density", from: baseSpec.density, to: tunedSpec.density },
    baseSpec,
    tunedSpec,
    reloadedSpec,
    before,
    after,
    reproduced,
    baseProjection,
    tunedProjection,
    savedPath,
  };
}

/** A human-readable one-liner summarizing the turn — for a future CLI/log. Pure. */
export function describeFlip(d: CalibrationDemo): string {
  return `${d.seat} · ${d.knob.field}: ${d.knob.from} → ${d.knob.to} · view changed, docs/active untouched`;
}
