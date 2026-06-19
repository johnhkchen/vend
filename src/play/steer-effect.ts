// The Steer play's EFFECT — the world-touching verb (T-018-02, story S-018-01, epic E-018). Split out
// from BOTH the pure core (steer-core.ts, T-018-01) and the BAML-loading shell (steer.ts) for the house
// testability reason, exactly as survey-effect.ts is, ONE SCALE UP: where Survey stages a ranked BOARD,
// Steer stages a board AND the real FORKS — the demand-extraction capstone in one staged artifact:
//
//  - steer-core.ts keeps a LOUD pure contract (gates + `renderFork`/`renderForks`, type-only imports
//    only); adding an fs verb there would re-open a reviewed, committed module. So the effect lives HERE.
//  - steer.ts value-imports `b` (the BAML native addon), so no `bun test` may value-import it. This
//    module imports NO BAML — only the pure `renderBoard` (survey-core), `renderForks` (steer-core), and
//    the shared `STAGING_DIR` (expand-effect, itself addon-free). So steer-effect.test.ts exercises the
//    effect as an ordinary test against a real temp-dir projectRoot — the survey-effect discipline.
//
// ADDON-FREE but IMPURE: the one verb writes the staged steer (`mkdir` + `writeFile`). The `Steer`/`Fork`/
// engine imports are TYPE-ONLY (erased under verbatimModuleSyntax), so no addon ever loads through here.
//
// STAGING, NOT PROMOTION (the headline — AC#2): a cleared steer is STAGED under the PM desk
// (`docs/active/pm/staged/`, the upstream un-promoted space — docs/active/pm/README.md), where a human
// reviews the board, PULLS a signal, and ANSWERS a fork. It is NEVER appended to `demand.md` or the board
// (`epic/`, `stories/`, `tickets/`), and a fork is never ACTED ON — assent is the separate human gesture.
//
// ONE steer file, idempotent (mirrors survey-effect D4): a steer has no id and no DAG identity, so it
// stages to a FIXED `steer.md` stem — re-steering OVERWRITES the prior draft (a draft you iterate on, not
// an artifact with an identity). Distinct stem from `survey-board.md` so the two plays' drafts coexist.
//
// REUSES three shared contracts (not re-implemented — the steer-core reuse rationale): `renderBoard`
// (survey-core: the demand.md table body, byte-identical to a Survey board), `renderForks` (steer-core:
// the fork blocks), and `STAGING_DIR` (expand-effect: the machine inbox). All three source modules are
// addon-free, so importing them keeps THIS module addon-free.

import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import type { Steer } from "../../baml_client/index.ts";
import type { CastContext, EffectResult } from "../engine/play.ts";
import { renderBoard } from "./survey-core.ts";
import { renderForks } from "./steer-core.ts";
import { STAGING_DIR } from "./expand-effect.ts";

/**
 * The Steer play's typed inputs — what the cast assembles and `castPlay` threads to BOTH `render` and
 * the gate/effect context. `render` consumes `project`/`charter`; the pure steer gates need neither
 * (read-never-invent/leverage-rank read only the board; fork-genuineness reads only the forks — steer-core's
 * `clear` takes no ctx). The same two-field shape as `SurveyInputs` (steer reuses survey's assembly).
 */
export interface SteerInputs {
  readonly project: string;
  readonly charter: string;
}

/** The fixed filename stem the staged steer lands under (idempotent overwrite). A steer has no per-steer
 *  `what` to slug, so — unlike expand's per-signal slug — the stem is constant; distinct from survey's. */
export const STEER_STEM = "steer";

/** The demand.md table header — the same row contract Survey/Expand write (so a staged steer board is
 *  byte-identical to a staged survey board). */
const TABLE_HEADER = "| Signal | Value | Budget (envelope) | Status |";

/** The origin trailer — names the play + its un-promoted status (the steer is for assent, not action). */
const TRAILER = "_Staged by Vend's `steer` play — not promoted; pull a signal / assent to a fork to clear._";

/**
 * Render a cleared Steer → the staged markdown artifact. PURE (the `renderStagedBoard` pattern, extended
 * with the fork half): deterministic, no clock. Three branches (design D3) — the two-sided honest-empty:
 *  - a FULLY empty steer (no signals, no forks) is the honest abstention on BOTH sides — render a legible
 *    "steered, nothing to stage" note (IA-4 language) so a success leaves a trace, NOT an empty file.
 *  - otherwise render a `# Steer` heading and, when present, the BOARD half (the demand.md table + one
 *    `renderBoard` row per signal, then a `## Pull these` block quoting the exact `vend chain` gesture per
 *    signal, top-ranked recommended) and the FORKS half (`## Forks` + `renderForks`). When the board is
 *    non-empty but `forks` is empty, a one-line "no forks — the path is clear" note states the clear-path
 *    abstention rather than silently omitting the section (the fork-side honest-empty, made legible).
 */
export function renderStagedSteer(steer: Steer): string {
  const hasBoard = steer.signals.length > 0;
  const hasForks = steer.forks.length > 0;

  if (!hasBoard && !hasForks) {
    return [
      "# Steer — nothing to stage",
      "",
      "Steered the project and found no real demand gradient to board and no genuine fork to surface — " +
        "an **honest empty steer** on both sides (a fabricated board or a manufactured fork is worse than " +
        "none, IA-4). Nothing was promoted.",
      "",
      TRAILER,
      "",
    ].join("\n");
  }

  const lines: string[] = ["# Steer — staged board + forks", ""];

  if (hasBoard) {
    const pulls = steer.signals.map((s, i) => {
      const cmd = `vend chain "${s.what} — ${s.why}"`;
      return i === 0 ? `${cmd}   # recommended next pull (highest leverage)` : cmd;
    });
    lines.push(
      "A ranked demand board read off the whole project, highest-leverage first. Un-promoted: review and pull a row.",
      "",
      TABLE_HEADER,
      "|---|---|---|---|",
      renderBoard({ signals: steer.signals }),
      "",
      "## Pull these",
      "",
      "A human pulls any one staged signal onto the board with one gesture:",
      "",
      "```",
      ...pulls,
      "```",
      "",
    );
  }

  lines.push("## Forks", "");
  if (hasForks) {
    lines.push(
      "The genuine decisions only the human can make — each recommendation-first. Assent or override:",
      "",
      renderForks(steer.forks),
      "",
    );
  } else {
    lines.push("_No forks — the path is clear (nothing to decide). The fork-side honest abstention._", "");
  }

  lines.push(TRAILER, "");
  return lines.join("\n");
}

/**
 * The play's EFFECT — STAGE the cleared steer under the PM desk. The one async, impure member of the
 * contract: it `mkdir -p`s `docs/active/pm/staged/` under `ctx.projectRoot` and writes the rendered
 * markdown to the fixed `steer.md` (idempotent overwrite — design D4). NO BAML, NO spawn — so it is
 * testable against a real temp-dir fixture (the `surveyBoardEffect`/`expandFragmentEffect` precedent).
 * Reports back as DATA (`EffectResult`): the staged path in `artifacts` and as `produced` (parity with
 * the other effects, though no chain consumes a staged steer today).
 *
 * No `outcome` relabel: a steer has no id, so the id-collision branch does not apply — overwrite-by-
 * fixed-name is intended. A genuine fs failure THROWS (not a clean outcome), the survey/expand rule.
 */
export async function steerEffect(steer: Steer, ctx: CastContext<SteerInputs>): Promise<EffectResult> {
  const dir = join(ctx.projectRoot, STAGING_DIR);
  const path = join(dir, `${STEER_STEM}.md`);
  await mkdir(dir, { recursive: true });
  await writeFile(path, renderStagedSteer(steer), "utf8");
  return { ok: true, detail: `staged ${path}`, artifacts: [path], produced: path };
}
