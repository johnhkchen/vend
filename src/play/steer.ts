// The Steer play (T-018-02, story S-018-01, epic E-018) — the SIXTH registry entry of the casting engine
// and the demand-extraction CAPSTONE ONE SCALE ABOVE Survey: where Survey reads the whole rough project
// and stages a ranked demand BOARD (the *what*), Steer reads it and stages a board AND the real FORKS (the
// *decisions*) — the handful of genuine choices only a human can make. One gesture in, a steer out: the
// ranked board and the framed forks, for human assent. A Blue/Green PERMANENT (card-model.md) — a reusable
// articulation play cast forever. The six per-play variation points (render, parse, gates, effect, budget,
// card) are collected into one `Play<SteerInputs, Steer>` (`steerProjectPlay`), registered onto the
// shelf-wide `registry`; the generic `castPlay` loop owns the fixed spine. This module owns only the
// play-specific judgment.
//
// DEPENDENCY DIRECTION (E-007 keystone): a concrete play depends UP onto the engine. This module imports
// `castPlay` + the `Play` contract from src/engine/; the engine never imports src/play/. Acyclic, exactly
// as survey.ts / expand-fragment.ts. The budget is inlined (not imported from the shelf — that edge cycles).
//
// PURITY (house pattern): the play's `gates` is the pure `clear` (steer-core); its `effect` is the
// addon-free `steerEffect` (steer-effect); only `render`/`parse` call BAML in process (the addon's
// one-call-per-process limit is `bun test`-specific — a plain `bun` process, which the CLI is, runs both
// fine). So NO bun-test file value-imports this module — its logic is the engine's tested core +
// steer-core.test.ts + steer-effect.test.ts + the ../baml/steer.test.ts bridge. `assembleSteerInputs`/
// `castSteer` are the IMPURE verbs.

import { readFile } from "node:fs/promises";
import { basename, join } from "node:path";
import { b } from "../../baml_client/sync_client.ts";
import type { Steer } from "../../baml_client/index.ts";
import { extractPromptText } from "../baml/decompose-bridge.ts";
import { registry, type Card, type Play } from "../engine/play.ts";
import { castPlay } from "../engine/cast.ts";
import type { Budget } from "../budget/budget.ts";
import { clear } from "./steer-core.ts";
import { buildProjectSnapshot, listIdsIn, CHARTER_PATH } from "./project-context.ts";
import { steerEffect, type SteerInputs } from "./steer-effect.ts";

/** The play name — the registry key and the value stamped on every run-log record. */
export const PLAY = "steer";

/** `RunSummary` is the engine's cast result. Re-exported (TYPE-ONLY) so callers resolve it here. */
export type { RunSummary } from "../engine/cast.ts";
import type { RunSummary } from "../engine/cast.ts";

/**
 * SAP-parse the model's reply into a typed Steer. UNLIKE {@link parseSurvey}, this needs NO try/catch
 * and NO empty-coercion closure: `Steer` is an all-array class with TWO array fields (`signals` + `forks`),
 * so — exactly like `WorkPlan` and the DIVERGENCE from single-field `Board` — the SAP parser DEGRADES both
 * an object-shaped reply lacking the fields AND a bare unstructured string to `{signals:[], forks:[]}`; it
 * NEVER throws (probed live in T-018-01 Step 5, pinned in ../baml/steer.test.ts). That empty steer then
 * reaches the gates, which CLEAR it as a clean honest-empty abstention on both sides — so a thin total
 * passthrough is correct and complete; adding a catch would be dead code that misreads Steer as throwable.
 */
export function parseSteer(text: string): Steer {
  return b.parse.SteerProject(text);
}

/**
 * Steer as a {@link Play} — the six variation points the cast loop plugs into its fixed orchestration:
 *  - `render` : `b.request.SteerProject(project, charter)` → prompt text (via `extractPromptText`).
 *  - `parse`  : {@link parseSteer} — `b.parse.SteerProject` (total by the two-array SAP degrade; no catch).
 *  - `gates`  : `clear(steer)` (steer-core) — read-never-invent → fork-genuineness → leverage-rank; its
 *               `cleared` echo lets a successful cast log three passed gate rows. Ignores `ctx` (the steer
 *               gates read only the board/forks — no charter needed, like survey's `gates`).
 *  - `effect` : `steerEffect` (steer-effect) — STAGES the board AND the forks under
 *               `docs/active/pm/staged/steer.md`, never the live board.
 *  - `budget` : the HEAVIEST read yet (board + forks). Pre-filled GENEROUSLY ABOVE Survey's held 300k
 *               (T-018-02 ticket): 400k tokens / 40 min as a measured FLOOR, not a cold-start guess.
 *               recalibrate from the log (E-013). Inlined so the play never depends UP onto the shelf
 *               (that edge would cycle). A fallback; the gesture passes an explicit budget.
 *  - `card`   : Blue/Green permanent, rare — a reusable articulation play one scale up from survey.
 */
export const steerProjectPlay: Play<SteerInputs, Steer> = {
  name: PLAY,
  summary: "read the project and propose a course-correction",
  render: (i) => extractPromptText(b.request.SteerProject(i.project, i.charter) as unknown as {
    body: { json: () => { messages?: unknown[] } };
  }),
  parse: parseSteer,
  gates: (steer) => clear(steer),
  effect: steerEffect,
  budget: { timeMs: 2_400_000, tokens: 400_000 },
  card: { color: ["blue", "green"], type: "permanent", rarity: "rare" } satisfies Card,
};

// Self-register at module load — any module that value-imports this one populates the singleton. Pure
// tests import ./steer-core.ts / ./steer-effect.ts instead, so they never load this module and never register.
registry.register(steerProjectPlay);

/** Options for {@link castSteer} — the per-cast values the play itself does not carry. Steer has NO
 *  positional subject (it reads the whole project), so — like SurveyOptions — there is no `fragment`; the
 *  run-log subject is synthesized from the project root. */
export interface SteerOptions {
  readonly budget: Budget;
  /** Repo root the snapshot/charter are gathered from and the steer is staged under. */
  readonly projectRoot?: string;
  /** Pinned model id; omitted ⇒ CLI default (and the engine's `DEFAULT_MODEL` logged). */
  readonly model?: string;
  /** Stable run id; derived if omitted. */
  readonly runId?: string;
  /** Override the transcript dir (default `<root>/.vend/transcripts`). */
  readonly transcriptDir?: string;
}

/**
 * Assemble Steer's typed inputs — the REAL charter (the value function the model reads its demand gradient
 * AND its forks against) and a thin go-and-see project snapshot (the whole board state the steer reads).
 * The IMPURE verb, identical to `assembleSurveyInputs` (Steer takes the same two inputs as Survey). Reuses
 * the EXPORTED `buildProjectSnapshot`/`listIdsIn`; a steer reads the BOARD state, not the src tree, so
 * `srcFiles` is empty (the heaviness of steer's read is the model's agentic file-reading during the live
 * cast, not the snapshot). NOT unit-tested (its logic is the pure formatter + thin fs reads).
 */
export async function assembleSteerInputs(opts: SteerOptions): Promise<SteerInputs> {
  const root = opts.projectRoot ?? process.cwd();
  const [charter, stories, tickets] = await Promise.all([
    readFile(join(root, CHARTER_PATH), "utf8"),
    listIdsIn(`${root}/docs/active/stories`),
    listIdsIn(`${root}/docs/active/tickets`),
  ]);
  const project = buildProjectSnapshot({ root, srcFiles: [], stories, tickets });
  return { project, charter };
}

/**
 * Cast the Steer permanent end to end — `castPlay` OVER the registry entry, the parallel of `castSurvey`.
 * The SIXTH play cast through the SAME generic `castPlay`: same loop, same run-log append, zero per-play
 * branches. On success it STAGES the ranked board AND the real forks under the PM desk for human assent; a
 * read-never-invent / fork-genuineness refusal halts as a `gate-failed` andon with nothing staged (an
 * honestly-empty steer, by contrast, CLEARS and stages a both-sides abstention note). IMPURE (assembles
 * inputs, spawns). NOT unit-tested; its logic is the engine's tested core.
 *
 * The run-log `subject` is synthesized (`steer of <project>`) since steer has no positional subject —
 * `castPlay` separately stamps the `project` field. This is the steering capstone gesture: point it at a
 * project and it reads the latent board AND the genuine forks off the actual state.
 */
export async function castSteer(opts: SteerOptions): Promise<RunSummary> {
  const root = opts.projectRoot ?? process.cwd();
  const inputs = await assembleSteerInputs(opts);
  return castPlay(steerProjectPlay, inputs, opts.budget, {
    subject: `steer of ${basename(root)}`,
    projectRoot: root,
    model: opts.model,
    runId: opts.runId,
    transcriptDir: opts.transcriptDir,
  });
}
