// The ExpandFragment play (T-016-02, story S-016-01, epic E-016) — the FOURTH registry entry of the
// casting engine and the demand-extraction primitive ONE NOTCH UPSTREAM of ProposeEpic: it clears a
// rough FRAGMENT (a felt "this is rough", a one-liner, a TODO) into a board-ready demand SIGNAL,
// where ProposeEpic clears a pulled signal into an epic CARD. The pipeline grows: fragment → expand
// → signal → propose → epic → decompose. A Blue/Green PERMANENT (card-model.md) — a reusable
// articulation play cast forever. The six per-play variation points (render, parse, gates, effect,
// budget, card) are collected into one `Play<ExpandFragmentInputs, Signal>` (`expandFragmentPlay`),
// registered onto the shelf-wide `registry`; the generic `castPlay` loop owns the fixed spine. This
// module owns only the play-specific judgment.
//
// DEPENDENCY DIRECTION (E-007 keystone): a concrete play depends UP onto the engine. This module
// imports `castPlay` + the `Play` contract from src/engine/; the engine never imports src/play/.
// Acyclic, exactly as propose-epic.ts / note.ts. The budget is inlined (not imported from the shelf —
// that edge would cycle).
//
// PURITY (house pattern): the play's `gates` is the pure `clear` (expand-core); its `effect` is the
// addon-free `expandFragmentEffect` (expand-effect); only `render`/`parse` call BAML in process (the
// addon's one-call-per-process limit is `bun test`-specific — a plain `bun` process, which the CLI
// is, runs both fine). So NO bun-test file value-imports this module — its logic is the engine's
// tested core + expand-core.test.ts + expand-effect.test.ts + the expand.test.ts bridge.
// `assembleExpandFragmentInputs`/`castExpandFragment` are the IMPURE verbs.

import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { b } from "../../baml_client/sync_client.ts";
import type { Signal } from "../../baml_client/index.ts";
import { extractPromptText } from "../baml/decompose-bridge.ts";
import { registry, type Card, type Play } from "../engine/play.ts";
import { castPlay } from "../engine/cast.ts";
import type { Budget } from "../budget/budget.ts";
import { clear } from "./expand-core.ts";
import { buildProjectSnapshot, listIdsIn, CHARTER_PATH } from "./project-context.ts";
import { expandFragmentEffect, type ExpandFragmentInputs } from "./expand-effect.ts";

/** The play name — the registry key and the value stamped on every run-log record. */
export const PLAY = "expand-fragment";

/** `RunSummary` is the engine's cast result. Re-exported (TYPE-ONLY) so callers resolve it here. */
export type { RunSummary } from "../engine/cast.ts";
import type { RunSummary } from "../engine/cast.ts";

/** An empty Signal — the coercion target when `b.parse` REJECTS a garbage reply (see
 *  {@link parseExpandFragment}). The honest-empty gate fires first on the blank `what`/`why`, so the
 *  placeholder `tier` here is never rendered; it only satisfies the closed-enum type. */
const EMPTY_SIGNAL: Signal = {
  what: "",
  why: "",
  tier: "Keystone" as Signal["tier"],
  budget: "",
  advances: [],
  grounding: "",
  readiness: "",
};

/**
 * SAP-parse the model's reply into a typed Signal, made TOTAL. Signal's required scalar fields
 * (`what`/`why`/`tier`/…) mean `b.parse` THROWS on a reply missing them — unlike DecomposeEpic's
 * all-array `WorkPlan`, which degrades to empty (expand.test.ts pins both: a canned reply parses,
 * garbage rejects). The cast loop calls `play.parse` without an error channel, so we catch that
 * rejection and return an empty Signal: the `honest-empty` gate then STOPs the line as a clean
 * `gate-failed` andon (nothing staged), rather than an uncontracted throw crashing `castPlay`. The
 * `parseProposeEpic`/`parseNote` precedent, applied to a fragment.
 */
export function parseExpandFragment(text: string): Signal {
  try {
    return b.parse.ExpandFragment(text);
  } catch {
    return EMPTY_SIGNAL;
  }
}

/**
 * ExpandFragment as a {@link Play} — the six variation points the cast loop plugs into its fixed
 * orchestration:
 *  - `render` : `b.request.ExpandFragment(fragment, charter, project)` → prompt text (via
 *               `extractPromptText`).
 *  - `parse`  : {@link parseExpandFragment} — `b.parse.ExpandFragment`, made total (garbage → empty).
 *  - `gates`  : `clear(signal, { charter })` (expand-core) — honest-empty → read-never-invent →
 *               value-link; its `cleared` echo lets a successful cast log three passed gate rows.
 *  - `effect` : `expandFragmentEffect` (expand-effect) — STAGES the signal under
 *               `docs/active/pm/staged/<slug>.md`, never the board.
 *  - `budget` : a single articulation's envelope (20m / 12k) — heavier than note's one-shot capture,
 *               lighter than ProposeEpic's full epic card. Inlined so the play never depends UP onto
 *               the shelf (that edge would cycle). A fallback; the gesture passes an explicit budget.
 *  - `card`   : Blue/Green permanent, rare — a reusable articulation play (Blue planning + Green ramp:
 *               the articulation lift's foundation), sibling power to propose-epic.
 */
export const expandFragmentPlay: Play<ExpandFragmentInputs, Signal> = {
  name: PLAY,
  summary: "grow a rough fragment into one board-ready signal",
  render: (i) => extractPromptText(b.request.ExpandFragment(i.fragment, i.charter, i.project) as unknown as {
    body: { json: () => { messages?: unknown[] } };
  }),
  parse: parseExpandFragment,
  gates: (signal, ctx) => clear(signal, { charter: ctx.inputs.charter }),
  effect: expandFragmentEffect,
  // Recalibrated 2026-06-19 from MEASURED use (E-018 consolidation): the 12k cold-start guess
  // was absurd — a live cast spent 211k (a 5-turn wander) and even a 100k override under-shot.
  // 250k clears the observed tail with headroom. (E-013's loop sets this from the real log once
  // it warms; by hand until then — N=1, but far better than the guess.)
  budget: { timeMs: 1_200_000, tokens: 250_000 },
  card: { color: ["blue", "green"], type: "permanent", rarity: "rare" } satisfies Card,
};

// Self-register at module load — any module that value-imports this one populates the singleton.
// Pure tests import ./expand-core.ts / ./expand-effect.ts instead, so they never load this module
// and never register.
registry.register(expandFragmentPlay);

/** Options for {@link castExpandFragment} — the per-cast values the play itself does not carry. */
export interface ExpandFragmentOptions {
  /** The rough fragment to expand — the play's subject, stamped on the run-log record. ONE
   *  explicitly typed fragment (PE-1 pull-discipline); never an auto-drain over a TODO file. */
  readonly fragment: string;
  readonly budget: Budget;
  /** Repo root the snapshot/charter are gathered from and the signal is staged under. */
  readonly projectRoot?: string;
  /** Pinned model id; omitted ⇒ CLI default (and the engine's `DEFAULT_MODEL` logged). */
  readonly model?: string;
  /** Stable run id; derived if omitted. */
  readonly runId?: string;
  /** Override the transcript dir (default `<root>/.vend/transcripts`). */
  readonly transcriptDir?: string;
}

/**
 * Assemble ExpandFragment's typed inputs — the rough fragment, the REAL charter (the value-link gate
 * greps it for live `P#`/`N#` ids), and a thin go-and-see project snapshot. The IMPURE verb,
 * mirroring `assembleProposeEpicInputs` MINUS `existingEpicIds` (a signal mints no id). Reuses the
 * EXPORTED `buildProjectSnapshot`/`listIdsIn`; an articulation needs no src tree, so `srcFiles` is
 * empty (a light snapshot, like propose's). NOT unit-tested (its logic is the pure formatter + thin
 * fs reads).
 */
export async function assembleExpandFragmentInputs(opts: ExpandFragmentOptions): Promise<ExpandFragmentInputs> {
  const root = opts.projectRoot ?? process.cwd();
  const [charter, stories, tickets] = await Promise.all([
    readFile(join(root, CHARTER_PATH), "utf8"),
    listIdsIn(`${root}/docs/active/stories`),
    listIdsIn(`${root}/docs/active/tickets`),
  ]);
  const project = buildProjectSnapshot({ root, srcFiles: [], stories, tickets });
  return { fragment: opts.fragment, charter, project };
}

/**
 * Cast the ExpandFragment permanent end to end — `castPlay` OVER the registry entry, the parallel of
 * `castProposeEpic` / `castCaptureNote`. The FOURTH play cast through the SAME generic `castPlay`:
 * same loop, same run-log append, zero per-play branches. On success it STAGES one signal under the
 * PM desk for a human pull; an honest-empty / read-never-invent refusal halts as a `gate-failed`
 * andon with nothing materialized. IMPURE (assembles inputs, spawns). NOT unit-tested; its logic is
 * the engine's tested core.
 *
 * PULL-DISCIPLINE (PE-1): casts ONE explicitly typed `fragment` — it does NOT read or iterate a TODO
 * file / the board. The deliberate single-fragment gesture IS the pull-discipline; there is no
 * auto-drainer here by construction.
 */
export async function castExpandFragment(opts: ExpandFragmentOptions): Promise<RunSummary> {
  const root = opts.projectRoot ?? process.cwd();
  const inputs = await assembleExpandFragmentInputs(opts);
  return castPlay(expandFragmentPlay, inputs, opts.budget, {
    subject: opts.fragment,
    projectRoot: root,
    model: opts.model,
    runId: opts.runId,
    transcriptDir: opts.transcriptDir,
  });
}
