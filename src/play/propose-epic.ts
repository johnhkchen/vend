// The ProposeEpic play (T-009-03, story S-009-01, epic E-009) — the THIRD registry entry of
// the casting engine, completing the proof: three plays (decompose-epic + capture-note +
// propose-epic) cast through ONE generic `castPlay`. A Blue PERMANENT (card-model.md) — a
// reusable planning play that turns a pulled demand SIGNAL into a gated EpicCard on the board —
// in deliberate contrast to capture-note's Red single-use sorcery. The six per-play variation
// points (render, parse, gates, effect, budget, card) are collected into one
// `Play<ProposeEpicInputs, EpicCard>` (`proposeEpicPlay`), registered onto the shelf-wide
// `registry`; the generic `castPlay` loop owns the fixed spine. This module owns only the
// play-specific judgment.
//
// DEPENDENCY DIRECTION (E-007 keystone): a concrete play depends UP onto the engine. This
// module imports `castPlay` + the `Play` contract from src/engine/; the engine never imports
// src/play/. Acyclic, exactly as decompose-epic.ts / note.ts. The budget is inlined (not
// imported from the shelf — that edge would cycle).
//
// PURITY (house pattern): the play's `gates` is the pure `clear` (propose-core); its `effect`
// is the addon-free `proposeEpicEffect` (propose-effect); only `render`/`parse` call BAML in
// process (the addon's one-call-per-process limit is `bun test`-specific — a plain `bun`
// process, which the CLI is, runs both fine). So NO bun-test file value-imports this module —
// its logic is the engine's tested core + propose-core.test.ts + propose-effect.test.ts + the
// propose.test.ts bridge. `assembleProposeEpicInputs`/`castProposeEpic` are the IMPURE verbs.

import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { b } from "../../baml_client/sync_client.ts";
import type { EpicCard } from "../../baml_client/index.ts";
import { extractPromptText } from "../baml/decompose-bridge.ts";
import { registry, type Card, type Play } from "../engine/play.ts";
import { castPlay } from "../engine/cast.ts";
import type { Budget } from "../budget/budget.ts";
import { clear } from "./propose-core.ts";
import { AUTONOMOUS_DENY } from "./autonomous-deny.ts";
import { buildProjectSnapshot, listIdsIn, CHARTER_PATH } from "./project-context.ts";
import { EPIC_DIR, proposeEpicEffect, type ProposeEpicInputs } from "./propose-effect.ts";

/** The play name — the registry key and the value stamped on every run-log record. */
export const PLAY = "propose-epic";

/** `RunSummary` is the engine's cast result. Re-exported (TYPE-ONLY) so callers resolve it here. */
export type { RunSummary } from "../engine/cast.ts";
import type { RunSummary } from "../engine/cast.ts";

/** An empty EpicCard — the coercion target when `b.parse` REJECTS a garbage reply (see
 *  `parseProposeEpic`). The value gate fires first on the blank `serves`, so the enum members
 *  here are never rendered; they only satisfy the type. */
const EMPTY_CARD: EpicCard = {
  id: "",
  title: "",
  kind: "Permanent" as EpicCard["kind"],
  advances: [],
  serves: "",
  manaCost: "",
  color: [],
  type: "Permanent" as EpicCard["type"],
  rarity: "Common" as EpicCard["rarity"],
  intent: "",
  value: "",
  doneLooksLike: "",
  context: "",
};

/**
 * SAP-parse the model's reply into a typed EpicCard, made TOTAL. EpicCard's required scalar
 * fields (`id`/`title`/`serves`/…) mean `b.parse` THROWS on a reply missing them — unlike
 * DecomposeEpic's all-array `WorkPlan`, which degrades to empty (propose.test.ts pins both).
 * The cast loop calls `play.parse` without an error channel, so we catch that rejection and
 * return an empty card: the `value` gate then STOPs the line as a clean `gate-failed` andon,
 * rather than an uncontracted throw crashing `castPlay` (the `parseNote` precedent — the same
 * engine-level sharp edge, contained per-play).
 */
export function parseProposeEpic(text: string): EpicCard {
  try {
    return b.parse.ProposeEpic(text);
  } catch {
    return EMPTY_CARD;
  }
}

/**
 * ProposeEpic as a {@link Play} — the six variation points the cast loop plugs into its fixed
 * orchestration:
 *  - `render` : `b.request.ProposeEpic(signal, charter, project)` → prompt text (via
 *               `extractPromptText`).
 *  - `parse`  : {@link parseProposeEpic} — `b.parse.ProposeEpic`, made total (garbage → empty card).
 *  - `gates`  : `clear(card, { charter, existingEpicIds })` (propose-core) — value → bounds →
 *               structural; its `cleared` echo lets a successful cast log three passed gate rows.
 *  - `effect` : `proposeEpicEffect` (propose-effect) — mints the next free id and writes the
 *               `E-0XX.md` epic card under the project root.
 *  - `budget` : a single bounded proposal's envelope (30m / 16k) — heavier than note's one-shot
 *               capture, lighter than DecomposeEpic's keystone decomposition. Inlined so the play
 *               never depends UP onto the shelf (that edge would cycle). A fallback; the caller
 *               passes an explicit budget.
 *  - `card`   : Blue permanent, rare — a reusable planning play (card-model.md).
 */
export const proposeEpicPlay: Play<ProposeEpicInputs, EpicCard> = {
  name: PLAY,
  summary: "turn a signal into a proposed epic card",
  render: (i) => extractPromptText(b.request.ProposeEpic(i.signal, i.charter, i.project) as unknown as {
    body: { json: () => { messages?: unknown[] } };
  }),
  parse: parseProposeEpic,
  gates: (card, ctx) => clear(card, { charter: ctx.inputs.charter, existingEpicIds: ctx.inputs.existingEpicIds }),
  effect: proposeEpicEffect,
  // Recalibrated 2026-06-19 from MEASURED use (E-018 consolidation): the 16k cold-start guess
  // under-shot — a live chain cast spent ~109k (budget-exhausted at 60k). 150k clears the
  // observed spend with headroom. (E-013's loop sets this from the real log once it warms.)
  budget: { timeMs: 1_800_000, tokens: 150_000 },
  // Per-play tool provisioning (E-051): propose-epic is an autonomous cast run headless via
  // `claude -p`, so deny AskUserQuestion — it has no answerer on a piped cast and would hang the
  // cast (the E-049 failure mode). A deny-ONLY declaration: `resolveTools` keeps this play
  // scoping-PASSTHROUGH (no `mcp`/`allow` ⇒ no `--allowedTools`/`--strict-mcp-config`), so it
  // retains its global MCP set and gains exactly `--disallowedTools AskUserQuestion`. Interactive
  // plays declare no `tools` and stay flag-free.
  tools: { deny: AUTONOMOUS_DENY },
  card: { color: ["blue"], type: "permanent", rarity: "rare" } satisfies Card,
};

// Self-register at module load — any module that value-imports this one populates the singleton.
// Pure tests import ./propose-core.ts / ./propose-effect.ts instead, so they never load this
// module and never register.
registry.register(proposeEpicPlay);

/** Options for {@link castProposeEpic} — the per-cast values the play itself does not carry. */
export interface ProposeEpicOptions {
  /** The pulled demand signal to propose an epic from — the play's subject, stamped on the
   *  run-log record. ONE explicitly pulled signal (PE-1); never an auto-drain over the board. */
  readonly signal: string;
  readonly budget: Budget;
  /** Repo root the snapshot/board are gathered from and the epic is written under. */
  readonly projectRoot?: string;
  /** Pinned model id; omitted ⇒ CLI default (and the engine's `DEFAULT_MODEL` logged). */
  readonly model?: string;
  /** Stable run id; derived if omitted. */
  readonly runId?: string;
  /** Override the transcript dir (default `<root>/.vend/transcripts`). */
  readonly transcriptDir?: string;
}

/**
 * Assemble ProposeEpic's typed inputs — the pulled signal, the REAL charter (the bounds gate
 * greps it for live `P#`/`N#` ids), a thin go-and-see project snapshot, and the live epic-id
 * board (the structural gate's disjointness oracle + the effect's mint input). The IMPURE verb,
 * mirroring `assembleNoteInputs`: reuses the EXPORTED `buildProjectSnapshot`/`listIdsIn`; a
 * proposal needs no src tree, so `srcFiles` is empty (a light snapshot, like the note's). NOT
 * unit-tested (its logic is the pure formatter + thin fs reads).
 */
export async function assembleProposeEpicInputs(opts: ProposeEpicOptions): Promise<ProposeEpicInputs> {
  const root = opts.projectRoot ?? process.cwd();
  const [charter, stories, tickets, epics] = await Promise.all([
    readFile(join(root, CHARTER_PATH), "utf8"),
    listIdsIn(`${root}/docs/active/stories`),
    listIdsIn(`${root}/docs/active/tickets`),
    listIdsIn(join(root, EPIC_DIR)),
  ]);
  const project = buildProjectSnapshot({ root, srcFiles: [], stories, tickets });
  return { signal: opts.signal, charter, project, existingEpicIds: epics };
}

/**
 * Cast the ProposeEpic permanent end to end — `castPlay` OVER the registry entry, the parallel
 * of `runDecomposeEpic` / `castCaptureNote`. This is the proof the THIRD play casts through the
 * SAME generic `castPlay`: same loop, same run-log append, zero per-play branches. IMPURE
 * (assembles inputs, spawns). NOT unit-tested; its logic is the engine's tested core.
 *
 * PULL-DISCIPLINE (PE-1): casts ONE explicitly pulled `signal` — it does NOT read or iterate
 * `demand.md`. The deliberate single-signal gesture IS the pull-discipline; there is no
 * auto-drainer over the board here by construction.
 */
export async function castProposeEpic(opts: ProposeEpicOptions): Promise<RunSummary> {
  const root = opts.projectRoot ?? process.cwd();
  const inputs = await assembleProposeEpicInputs(opts);
  return castPlay(proposeEpicPlay, inputs, opts.budget, {
    subject: opts.signal,
    projectRoot: root,
    model: opts.model,
    runId: opts.runId,
    transcriptDir: opts.transcriptDir,
  });
}
