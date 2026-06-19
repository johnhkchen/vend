// The 'GOOD ENOUGH' RUBRIC SCORECARD's IMPURE harness (T-021-09, story S-021-04, epic E-021) —
// the probe over the rendered designer preset, patterned on ./run-consistency-probe.ts:
//
//   bun run src/probe/run-rubric-probe.ts [root]
//
// It loads the live work-graph (or the board under an optional [root], the run-consistency-probe
// redirectable-input precedent), PROJECTS + RENDERS it under DESIGNER_PRESET (the same paper
// artifact a human reads), scores that render across the five rubric dimensions with the PURE
// core (./rubric.ts), and prints the per-dimension scorecard + the "good enough" verdict.
//
// NOT unit-tested (house rule, exactly as ./run-consistency-probe.ts and ./run-probe.ts: the
// impure verbs — `loadWorkGraph`, render composition — are proven live; their judgment is the
// tested pure core, ./rubric.ts + rubric.test.ts). This file is the scorecard instrument, not
// part of the everyday `vend` surface.
//
// READ-ONLY / ONE-WAY AUTHORITY (E-021 invariant): the only world-touching verb is
// `loadWorkGraph` (src/graph/load.ts), which imports readers only; everything downstream is pure
// string building. This harness writes NOTHING — scoring a render has no side effects, so unlike
// the casting probes it needs no disposable temp root. The `docs/active` reference above is
// PROVENANCE in this comment, never executable code (so authority-guard stays green).

import { loadWorkGraph } from "../graph/load.ts";
import { DESIGNER_PRESET } from "../present/spec.ts";
import { projectGraph } from "../present/project.ts";
import { renderPaper } from "../present/paper.ts";
import { scoreDesignerRubric, formatScorecard } from "./rubric.ts";

/** Load → project → render → score → print. `root` redirects the loader at a fixture board
 *  (defaults to the live repo). */
async function main(root?: string): Promise<void> {
  const graph = await loadWorkGraph(root ? { root } : undefined);
  const projection = projectGraph(graph, DESIGNER_PRESET);
  const render = renderPaper(graph, DESIGNER_PRESET);
  const card = scoreDesignerRubric(render, projection);

  process.stdout.write(
    `rubric scorecard — designer render of ${graph.tickets.length} ticket(s)` +
      `${root ? ` under ${root}` : ""}\n\n`,
  );
  process.stdout.write(`${formatScorecard(card)}\n`);
}

if (import.meta.main) {
  const root = Bun.argv[2];
  await main(root);
  process.exit(0);
}
