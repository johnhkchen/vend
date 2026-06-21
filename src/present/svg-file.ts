// The SVG FILE-OUTPUT SEAM — the FOURTH composition over E-021's Projection IR (T-055-03, story
// S-055-01, epic E-055 projection-to-svg-renderer), after project.ts (builds the IR), paper.ts
// (renders it to markdown/Mermaid), and projection-svg.ts (renders it to a static SVG string,
// T-055-02). This module adds the one thing the renderer deliberately left out: the world-touching
// verb that LOADS the live board, projects it, renders the SVG, and WRITES the `.svg` to a file — the
// unblocked, MCP-independent visual half of the non-dev round-trip (a portable offline file, not a
// live Linear/MCP integration).
//
// PURITY / POSTURE (house pattern, cf. calibration-demo.ts / presets.ts): this orchestrator is
// IMPURE — it loads the live graph and writes one file — so it sits beside the other impure verbs in
// the present layer, not in the pure core. But it adds NO nondeterminism: `loadWorkGraph`,
// `projectGraph`, and `projectionToSvg` are all clock-/random-free, so the same board renders to the
// same bytes every run (P5 consistency). The only impurity is the load + the single write.
//
// ONE-WAY AUTHORITY (E-021 invariant; the AC's teeth): the seam READS the board and never writes it.
// Its ONLY mutation is the rendered `.svg`, written under `.vend` (default) — provably OUTSIDE
// docs/active, the presets.ts allowed shape: a present-layer module MAY import a writer as long as it
// never names the protected board path in code (this provenance mention of docs/active lives only in
// this comment, which authority-guard strips before its scan). `projectGraph` returns the loaded
// graph reference-unchanged (the AC's other tooth), so nothing on the board is touched.

import { mkdir, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { loadWorkGraph } from "../graph/load.ts";
import type { WorkGraph } from "../graph/model.ts";
import { projectGraph } from "./project.ts";
import { projectionToSvg } from "./projection-svg.ts";
import type { SvgOverlays } from "./projection-svg.ts";
import { defaultPresetForSeat } from "./presets.ts";
import type { Seat } from "./presets.ts";
import type { PresentationSpec } from "./spec.ts";

// ── output location (the `.vend` project-state convention, cf. DEFAULT_PRESETS_DIR) ───────────────

/** Where the rendered board SVG lands — the project-state dir (cf. presets' `.vend/presets`), NOT
 *  docs/active. Overridable per call so tests write to a temp dir. */
export const DEFAULT_SVG_DIR = ".vend";

/** The default SVG filename under {@link DEFAULT_SVG_DIR}. */
export const DEFAULT_SVG_FILENAME = "work-graph.svg";

/** The file the rendered board SVG lives in: `{dir}/{fileName}`. Pure path helper (no fs) — the
 *  `seatSpecPath` idiom, so a caller/test can name the artifact without writing it. */
export function boardSvgPath(
  outDir: string = DEFAULT_SVG_DIR,
  fileName: string = DEFAULT_SVG_FILENAME,
): string {
  return join(outDir, fileName);
}

// ── the seam's options / result contract (all readonly — the calibration-demo idiom) ──────────────

/** Options for {@link writeBoardSvg} — all optional. Tests inject a fabricated `graph` and a temp
 *  `outDir` so the run is hermetic and the repo's `.vend` / live board are never touched. */
export interface SvgFileOptions {
  /** A pre-built graph; omitted → {@link loadWorkGraph} reads the live board. */
  readonly graph?: WorkGraph;
  /** The seat whose built-in preset projects the board; default `"designer"` (the non-dev seat —
   *  the audience of the non-dev round-trip). Ignored when an explicit `spec` is given. */
  readonly seat?: Seat;
  /** An explicit spec override — wins over `seat`. For programmatic control + hermetic tests. */
  readonly spec?: PresentationSpec;
  /** An accessible `<title>` threaded to the renderer; omitted → no `<title>` (honest-empty). */
  readonly title?: string;
  /** Where the `.svg` is written; default {@link DEFAULT_SVG_DIR}. */
  readonly outDir?: string;
  /** The `.svg` filename; default {@link DEFAULT_SVG_FILENAME}. */
  readonly fileName?: string;
}

/** The structured result of one seam run — the written path, the rendered string (so a caller/test
 *  asserts structure without re-reading the file), and the IR counts (one swimlane per group, one
 *  box per card, one edge per link — the AC's visible shape, as numbers). */
export interface SvgFileResult {
  readonly path: string;
  readonly svg: string;
  readonly groupCount: number;
  readonly cardCount: number;
  readonly linkCount: number;
}

// ── the seam (the one impure verb) ────────────────────────────────────────────────────────────────

/**
 * Load the board (or take an injected `graph`), project it under the seat's preset (or an explicit
 * `spec`), render the {@link projectionToSvg} SVG, and WRITE it to `{outDir}/{fileName}` (default
 * `.vend/work-graph.svg`). Returns a {@link SvgFileResult}. IMPURE (graph load + one file write) but
 * DETERMINISTIC: same board → byte-identical `.svg` every run (no clock/random below the seam).
 *
 * ONE-WAY AUTHORITY (the AC's teeth): writes ONLY under `outDir` (`.vend` by default — never
 * docs/active), and `projectGraph` returns the loaded `graph` reference-unchanged, so the board is
 * untouched. HONEST-EMPTY: an empty board flows through to a minimal valid `<svg>` (`cardCount: 0`),
 * still written — absence is rendered, not padded. A genuine fs failure THROWS (the saveSeatSpec
 * rule — a broken write is loud, never a swallowed outcome).
 */
export async function writeBoardSvg(opts: SvgFileOptions = {}): Promise<SvgFileResult> {
  const graph = opts.graph ?? (await loadWorkGraph());
  const spec = opts.spec ?? defaultPresetForSeat(opts.seat ?? "designer");

  // PURE below this line: project the frozen graph, then render. `graph` is returned unchanged.
  const projection = projectGraph(graph, spec);
  const overlays: SvgOverlays = opts.title !== undefined ? { title: opts.title } : {};
  const svg = projectionToSvg(projection, overlays);

  // The one mutation: write the rendered SVG under `.vend` (never docs/active).
  const path = boardSvgPath(opts.outDir, opts.fileName);
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, svg, "utf8");

  const cardCount = projection.groups.reduce((n, g) => n + g.cards.length, 0);
  return {
    path,
    svg,
    groupCount: projection.groups.length,
    cardCount,
    linkCount: projection.links.length,
  };
}
