// The Survey play's EFFECT — the world-touching verb (T-017-02, story S-017-01, epic E-017). Split
// out from BOTH the pure core (survey-core.ts, T-017-01) and the BAML-loading shell (survey.ts) for
// the house testability reason, exactly as expand-effect.ts is, ONE SCALE UP: where expand stages one
// SIGNAL, Survey stages a whole ranked BOARD:
//
//  - survey-core.ts keeps a LOUD pure contract (gates + `renderBoard`, type-only imports only); adding
//    an fs verb there would re-open a reviewed, committed module. So the effect lives HERE.
//  - survey.ts value-imports `b` (the BAML native addon), so no `bun test` may value-import it. This
//    module imports NO BAML — only the pure `renderBoard` (survey-core) and the shared `STAGING_DIR`
//    (expand-effect, itself addon-free). So survey-effect.test.ts exercises the effect as an ordinary
//    test against a real temp-dir projectRoot — the expand-effect / propose-effect discipline.
//
// ADDON-FREE but IMPURE: the one verb writes the staged board (`mkdir` + `writeFile`). The
// `Board`/engine imports are TYPE-ONLY (erased under verbatimModuleSyntax), so no addon ever loads
// through this module.
//
// STAGING, NOT PROMOTION (the headline — AC#2): a cleared board is STAGED under the PM desk
// (`docs/active/pm/staged/`, the upstream un-promoted space — docs/active/pm/README.md), where a human
// reviews + pulls signals from it. It is NEVER appended to `demand.md` or the board (`epic/`,
// `stories/`,`tickets/`). Promotion of any one row is the separate human gesture `vend chain "<signal>"`.
//
// ONE board file, idempotent (T-017-02 design D4): a board has no id and no DAG identity, so it stages
// to a FIXED `survey-board.md` stem — re-surveying OVERWRITES the prior draft (a draft you iterate on,
// not a board artifact with an identity). The board analogue of expand's overwrite-by-slug; there is no
// per-board `what` to slug, so the stem is the constant {@link BOARD_STEM}.
//
// `STAGING_DIR` is IMPORTED from expand-effect.ts, not re-declared: both plays write the IDENTICAL
// machine inbox, so it is a genuine SHARED CONTRACT (re-declaring would risk the two drifting), and
// expand-effect.ts is addon-free, so the import keeps THIS module addon-free.

import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import type { Board } from "../../baml_client/index.ts";
import type { CastContext, EffectResult } from "../engine/play.ts";
import { renderBoard } from "./survey-core.ts";
import { STAGING_DIR } from "./expand-effect.ts";

/**
 * The Survey play's typed inputs — what the cast assembles and `castPlay` threads to BOTH `render`
 * and the gate/effect context. `render` consumes `project`/`charter`; the pure board gates need
 * neither (leverage-rank reads only tier order — survey-core's `clear` takes no ctx). No `fragment`
 * (survey reads the WHOLE project) and no `existingEpicIds` (a board mints no id): the slimmed,
 * scaled-up sibling of `ExpandFragmentInputs`.
 */
export interface SurveyInputs {
  readonly project: string;
  readonly charter: string;
}

/** The fixed filename stem the staged board lands under (design D4: idempotent overwrite). A board has
 *  no per-board `what` to slug — so, unlike expand's per-signal `slugify(what)`, the stem is constant. */
export const BOARD_STEM = "survey-board";

/**
 * Render a cleared Board → the staged markdown artifact. PURE (the `renderStagedSignal` pattern lifted
 * to a set): deterministic, no clock. Branches on emptiness (design D5):
 *  - an EMPTY board is the honest abstention (honest-empty CLEARED it) — render a legible "surveyed,
 *    nothing to stage" note (IA-4 language) so a success leaves a trace, NOT an empty file.
 *  - a non-empty board carries a `# Survey` heading, the `demand.md` table header + one
 *    `renderBoard` row per signal (the "Signal[] in the demand.md shape" — every field round-trips via
 *    survey-core/expand-core's renderer), a `## Pull these` block quoting the exact `vend chain`
 *    gesture for each signal (top-ranked first, the first marked the recommended next pull), and an
 *    origin trailer naming the play + its un-promoted status.
 */
export function renderStagedBoard(board: Board): string {
  const trailer = "_Staged by Vend's `survey` play — not promoted; pull to clear._";
  if (board.signals.length === 0) {
    return [
      "# Survey — no demand staged",
      "",
      "Surveyed the project and found no real demand gradient to stage — an **honest empty board**, " +
        "not manufactured busywork (honest-empty, IA-4). Nothing was promoted.",
      "",
      trailer,
      "",
    ].join("\n");
  }
  const pulls = board.signals.map((s, i) => {
    const cmd = `vend chain "${s.what} — ${s.why}"`;
    return i === 0 ? `${cmd}   # recommended next pull (highest leverage)` : cmd;
  });
  return [
    "# Survey — staged demand board",
    "",
    "A ranked board read off the whole project, highest-leverage first. Un-promoted: review and pull a row.",
    "",
    "| Signal | Value | Budget (envelope) | Status |",
    "|---|---|---|---|",
    renderBoard(board),
    "",
    "## Pull these",
    "",
    "A human pulls any one staged signal onto the board with one gesture:",
    "",
    "```",
    ...pulls,
    "```",
    "",
    trailer,
    "",
  ].join("\n");
}

/**
 * The play's EFFECT — STAGE the cleared board under the PM desk. The one async, impure member of the
 * contract: it `mkdir -p`s `docs/active/pm/staged/` under `ctx.projectRoot` and writes the rendered
 * markdown to the fixed `survey-board.md` (idempotent overwrite — design D4). NO BAML, NO spawn — so it
 * is testable against a real temp-dir fixture (the `expandFragmentEffect`/`proposeEpicEffect`
 * precedent). Reports back as DATA (`EffectResult`): the staged path in `artifacts` and as `produced`
 * (parity with the other effects, though no chain consumes a staged board today).
 *
 * No `outcome` relabel: a board has no id, so the id-collision branch `proposeEpicEffect` carries does
 * not apply — overwrite-by-fixed-name is intended. A genuine fs failure THROWS (not a clean outcome),
 * the `expandFragmentEffect` rule.
 */
export async function surveyBoardEffect(
  board: Board,
  ctx: CastContext<SurveyInputs>,
): Promise<EffectResult> {
  const dir = join(ctx.projectRoot, STAGING_DIR);
  const path = join(dir, `${BOARD_STEM}.md`);
  await mkdir(dir, { recursive: true });
  await writeFile(path, renderStagedBoard(board), "utf8");
  return { ok: true, detail: `staged ${path}`, artifacts: [path], produced: path };
}
