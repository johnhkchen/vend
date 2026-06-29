// The Survey play (T-017-02, story S-017-01, epic E-017) — the FIFTH registry entry of the casting
// engine and the cold-start board bootstrapper ONE SCALE ABOVE ExpandFragment: where ExpandFragment
// clears one rough FRAGMENT into one board-ready SIGNAL, Survey reads the WHOLE rough project and
// stages a RANKED demand BOARD (a `Signal[]`, highest-leverage first) for a human pull. The pipeline
// grows: project → survey → board → pull → propose → epic → decompose. A Blue/Green PERMANENT
// (card-model.md) — a reusable articulation play cast forever. The six per-play variation points
// (render, parse, gates, effect, budget, card) are collected into one `Play<SurveyInputs, Board>`
// (`surveyPlay`), registered onto the shelf-wide `registry`; the generic `castPlay` loop owns the
// fixed spine. This module owns only the play-specific judgment.
//
// DEPENDENCY DIRECTION (E-007 keystone): a concrete play depends UP onto the engine. This module
// imports `castPlay` + the `Play` contract from src/engine/; the engine never imports src/play/.
// Acyclic, exactly as expand-fragment.ts / propose-epic.ts. The budget is inlined (not imported from
// the shelf — that edge would cycle).
//
// PURITY (house pattern): the play's `gates` is the pure `clear` (survey-core); its `effect` is the
// addon-free `surveyBoardEffect` (survey-effect); only `render`/`parse` call BAML in process (the
// addon's one-call-per-process limit is `bun test`-specific — a plain `bun` process, which the CLI is,
// runs both fine). So NO bun-test file value-imports this module — its logic is the engine's tested
// core + survey-core.test.ts + survey-effect.test.ts + the survey.test.ts bridge.
// `assembleSurveyInputs`/`castSurvey` are the IMPURE verbs.

import { readFile } from "node:fs/promises";
import { basename, join } from "node:path";
import { b } from "../../baml_client/sync_client.ts";
import type { Board } from "../../baml_client/index.ts";
import { extractPromptText } from "../baml/decompose-bridge.ts";
import { registry, type Card, type Play } from "../engine/play.ts";
import { castPlay } from "../engine/cast.ts";
import type { Budget } from "../budget/budget.ts";
import { clear } from "./survey-core.ts";
import { buildProjectSnapshot, listIdsIn, CHARTER_PATH, SEED_PATH } from "./project-context.ts";
import { surveyBoardEffect, type SurveyInputs } from "./survey-effect.ts";

/** The play name — the registry key and the value stamped on every run-log record. */
export const PLAY = "survey";

/** `RunSummary` is the engine's cast result. Re-exported (TYPE-ONLY) so callers resolve it here. */
export type { RunSummary } from "../engine/cast.ts";
import type { RunSummary } from "../engine/cast.ts";

/** An empty Board — the coercion target when `b.parse` REJECTS a garbage reply (see {@link parseSurvey}).
 *  An empty board is the HONEST abstention: the honest-empty gate CLEARS it (the polarity inverts from
 *  expand's `EMPTY_SIGNAL`, which STOPs), so a garbage reply lands a clean success-with-empty-board. */
const EMPTY_BOARD: Board = { signals: [] };

/**
 * SAP-parse the model's reply into a typed Board, made TOTAL. The HYBRID degrade (T-017-01 finding,
 * obs 21370–21372, pinned in survey.test.ts): `b.parse.Survey` DEGRADES an object-shaped garbage reply
 * to `{signals: []}` (Board's single array field, the WorkPlan leniency), but THROWS on a bare
 * unstructured string (it cannot coerce a bare string INTO `signals`). The cast loop calls `play.parse`
 * without an error channel, so we catch that rejection and return an empty Board: BOTH garbage shapes
 * then reach the honest-empty gate, which CLEARS the empty board as a clean abstention, rather than an
 * uncontracted throw crashing `castPlay`. The `parseExpandFragment` precedent, applied to a board.
 */
export function parseSurvey(text: string): Board {
  try {
    return b.parse.Survey(text);
  } catch {
    return EMPTY_BOARD;
  }
}

/**
 * Survey as a {@link Play} — the six variation points the cast loop plugs into its fixed orchestration:
 *  - `render` : `b.request.Survey(project, charter)` → prompt text (via `extractPromptText`).
 *  - `parse`  : {@link parseSurvey} — `b.parse.Survey`, made total (garbage → empty board).
 *  - `gates`  : `clear(board)` (survey-core) — honest-empty → read-never-invent → leverage-rank; its
 *               `cleared` echo lets a successful cast log three passed gate rows. Ignores `ctx` (the
 *               board gates need no charter — the one clean divergence from expand's `gates`).
 *  - `effect` : `surveyBoardEffect` (survey-effect) — STAGES the ranked board under
 *               `docs/active/pm/staged/survey-board.md`, never the live board.
 *  - `budget` : a PROJECT-SCALE read — heavier than expand, which under-shot (100k ceiling, 211k spent:
 *               obs 21333). Pre-filled GENEROUSLY as a measured FLOOR, not a cold-start guess.
 *               recalibrate from the log (E-013). Inlined so the play never depends UP onto the shelf
 *               (that edge would cycle). A fallback; the gesture passes an explicit budget.
 *  - `card`   : Blue/Green permanent, rare — a reusable articulation play one scale up from expand.
 */
export const surveyPlay: Play<SurveyInputs, Board> = {
  name: PLAY,
  summary: "read the project into a ranked demand board",
  render: (i) => extractPromptText(b.request.Survey(i.project, i.charter) as unknown as {
    body: { json: () => { messages?: unknown[] } };
  }),
  parse: parseSurvey,
  gates: (board) => clear(board),
  effect: surveyBoardEffect,
  budget: { timeMs: 1_800_000, tokens: 300_000 },
  card: { color: ["blue", "green"], type: "permanent", rarity: "rare" } satisfies Card,
};

// Self-register at module load — any module that value-imports this one populates the singleton.
// Pure tests import ./survey-core.ts / ./survey-effect.ts instead, so they never load this module and
// never register.
registry.register(surveyPlay);

/** Options for {@link castSurvey} — the per-cast values the play itself does not carry. Survey has NO
 *  positional subject (it reads the whole project), so — unlike ExpandFragmentOptions — there is no
 *  `fragment`; the run-log subject is synthesized from the project root. */
export interface SurveyOptions {
  readonly budget: Budget;
  /** Repo root the snapshot/charter are gathered from and the board is staged under. */
  readonly projectRoot?: string;
  /** Pinned model id; omitted ⇒ CLI default (and the engine's `DEFAULT_MODEL` logged). */
  readonly model?: string;
  /** Stable run id; derived if omitted. */
  readonly runId?: string;
  /** Override the transcript dir (default `<root>/.vend/transcripts`). */
  readonly transcriptDir?: string;
}

/**
 * Assemble Survey's typed inputs — the REAL charter (the value function the model reads its demand
 * gradient against) and a thin go-and-see project snapshot (the whole board state the survey reads).
 * The IMPURE verb, mirroring `assembleExpandFragmentInputs` MINUS the `fragment` (survey has no
 * subject). Reuses the EXPORTED `buildProjectSnapshot`/`listIdsIn`; a survey reads the BOARD state, not
 * the src tree, so `srcFiles` is empty (a light snapshot, like expand's). ALSO reads the root `SEED.md`
 * intent TOLERANTLY (absent ⇒ undefined ⇒ no intent section ⇒ snapshot byte-identical — the `listIdsIn`
 * tolerance precedent); survey has the identical gap as steer, so it wires the same E-059 intent thread.
 * NOT unit-tested (its logic is the pure formatter + thin fs reads).
 */
export async function assembleSurveyInputs(opts: SurveyOptions): Promise<SurveyInputs> {
  const root = opts.projectRoot ?? process.cwd();
  const [charter, intent, stories, tickets] = await Promise.all([
    readFile(join(root, CHARTER_PATH), "utf8"),
    readFile(join(root, SEED_PATH), "utf8").catch(() => undefined),
    listIdsIn(`${root}/docs/active/stories`),
    listIdsIn(`${root}/docs/active/tickets`),
  ]);
  const project = buildProjectSnapshot({ root, srcFiles: [], stories, tickets, intent });
  return { project, charter };
}

/**
 * Cast the Survey permanent end to end — `castPlay` OVER the registry entry, the parallel of
 * `castExpandFragment` / `castProposeEpic`. The FIFTH play cast through the SAME generic `castPlay`:
 * same loop, same run-log append, zero per-play branches. On success it STAGES a ranked board under the
 * PM desk for a human pull; a honest-empty (a padded board) / read-never-invent refusal halts as a
 * `gate-failed` andon with nothing staged (an honestly-empty board, by contrast, CLEARS and stages an
 * abstention note). IMPURE (assembles inputs, spawns). NOT unit-tested; its logic is the engine's
 * tested core.
 *
 * The run-log `subject` is synthesized (`survey of <project>`) since survey has no positional subject —
 * `castPlay` separately stamps the `project` field. This is the cold-start gesture: point it at a rough
 * project and it reads the latent demand board off the actual state (PE-1 read-never-invent is the
 * gate, not a per-row pull).
 */
export async function castSurvey(opts: SurveyOptions): Promise<RunSummary> {
  const root = opts.projectRoot ?? process.cwd();
  const inputs = await assembleSurveyInputs(opts);
  return castPlay(surveyPlay, inputs, opts.budget, {
    subject: `survey of ${basename(root)}`,
    projectRoot: root,
    model: opts.model,
    runId: opts.runId,
    transcriptDir: opts.transcriptDir,
  });
}
