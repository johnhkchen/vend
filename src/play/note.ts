// The CaptureNote play (T-007-04) — the SECOND registry entry of the casting engine, and
// E-007's keystone done-signal: ≥2 plays cast through one `castPlay`. A minimal-but-real Red
// SORCERY (card-model.md) — a fast, single-use capture whose effect writes a real markdown
// artifact — in deliberate contrast to DecomposeEpic's Blue/White permanent. The six per-play
// variation points (render, parse, gates, effect, budget, card) are collected into one
// `Play<NoteInputs, Note>` (`captureNotePlay`), registered onto the shelf-wide `registry`; the
// generic `castPlay` loop owns the fixed spine. This module owns only the play-specific judgment.
//
// DEPENDENCY DIRECTION (E-007 keystone): a concrete play depends UP onto the engine. This module
// imports `castPlay` + the `Play` contract from src/engine/; the engine never imports src/play/.
// Acyclic, exactly as decompose-epic.ts.
//
// PURITY (house pattern): the play's `gates`/`effect`/`render`-helpers are the pure note-core;
// `render`/`parse` call BAML in-process (the addon's one-call-per-process limit is `bun test`-
// specific — a plain `bun` process, which the CLI is, runs both fine). So NO bun-test file
// value-imports this module — its logic is the engine's tested core + note-core.test.ts +
// note.test.ts (the bridge). `assembleNoteInputs`/`castCaptureNote` are the IMPURE verbs.

import { b } from "../../baml_client/sync_client.ts";
import type { Note } from "../../baml_client/index.ts";
import { extractPromptText } from "../baml/decompose-bridge.ts";
import { registry, type Card, type Play } from "../engine/play.ts";
import { castPlay } from "../engine/cast.ts";
import type { Budget } from "../budget/budget.ts";
import { buildProjectSnapshot, listIdsIn } from "./project-context.ts";
import { captureNoteEffect, clearNote, type NoteInputs } from "./note-core.ts";

/** The play name — the registry key and the value stamped on every run-log record. */
export const PLAY = "capture-note";

/** `RunSummary` is the engine's cast result. Re-exported (TYPE-ONLY) so callers resolve it here. */
export type { RunSummary } from "../engine/cast.ts";
import type { RunSummary } from "../engine/cast.ts";

/** An empty Note — the coercion target when `b.parse` REJECTS a garbage reply (see `parse` below). */
const EMPTY_NOTE: Note = { title: "", summary: "", points: [] };

/**
 * SAP-parse the model's reply into a typed Note, made TOTAL. Note's required scalar fields
 * (`title`/`summary`) mean `b.parse` THROWS on a reply missing them — unlike DecomposeEpic's
 * all-array `WorkPlan`, which degrades to empty (note.test.ts pins both). The cast loop calls
 * `play.parse` without an error channel, so we catch that rejection and return an empty Note:
 * the `substance` gate then STOPs the line as a clean `gate-failed` andon, rather than an
 * uncontracted throw crashing `castPlay`. This preserves decompose's "parse never throws; the
 * gate catches empty" invariant for a play whose parse otherwise could throw.
 */
function parseNote(text: string): Note {
  try {
    return b.parse.CaptureNote(text);
  } catch {
    return EMPTY_NOTE;
  }
}

/**
 * CaptureNote as a {@link Play} — the six variation points the cast loop plugs into its fixed
 * orchestration:
 *  - `render` : `b.request.CaptureNote(topic, project)` → prompt text (via `extractPromptText`).
 *  - `parse`  : {@link parseNote} — `b.parse.CaptureNote`, made total (garbage → empty Note).
 *  - `gates`  : `clearNote(note)` — the single `substance` gate; its `cleared:["substance"]` echo
 *               lets a successful cast log one passed gate row.
 *  - `effect` : `captureNoteEffect` — writes `docs/active/notes/<slug>.md` under the project root.
 *  - `budget` : a small/fast envelope (10m / 8k) — a one-shot capture's mana, a fraction of
 *               DecomposeEpic's 2h/50k. Inlined (not imported from the shelf) so the play never
 *               depends UP onto the shelf (that edge would cycle).
 *  - `card`   : Red sorcery, common — a fast single-use capture (card-model.md).
 */
export const captureNotePlay: Play<NoteInputs, Note> = {
  name: PLAY,
  summary: "capture a topic into a filed markdown note",
  render: (i) => extractPromptText(b.request.CaptureNote(i.topic, i.project) as unknown as {
    body: { json: () => { messages?: unknown[] } };
  }),
  parse: parseNote,
  gates: (note) => clearNote(note),
  effect: captureNoteEffect,
  budget: { timeMs: 600_000, tokens: 8_000 },
  card: { color: ["red"], type: "sorcery", rarity: "common" } satisfies Card,
};

// Self-register at module load — any module that value-imports this one populates the singleton.
// Pure tests import ./note-core.ts instead, so they never load this module and never register.
registry.register(captureNotePlay);

/** Options for {@link castCaptureNote} — the per-cast values the play itself does not carry. */
export interface CaptureNoteOptions {
  /** The topic to capture — the play's subject, stamped on the run-log record. */
  readonly topic: string;
  readonly budget: Budget;
  /** Repo root the snapshot is gathered from and the note is written under. */
  readonly projectRoot?: string;
  /** Pinned model id; omitted ⇒ CLI default (and the engine's `DEFAULT_MODEL` logged). */
  readonly model?: string;
  /** Stable run id; derived if omitted. */
  readonly runId?: string;
  /** Override the transcript dir (default `<root>/.vend/transcripts`). */
  readonly transcriptDir?: string;
}

/**
 * Assemble CaptureNote's typed inputs — the topic plus a thin go-and-see project snapshot. The
 * IMPURE verb (lists the board ids). Reuses the EXPORTED `buildProjectSnapshot` + `listIdsIn`
 * from project-context.ts; a note needs no src tree, so `srcFiles` is empty — a lighter snapshot
 * than DecomposeEpic's. NOT unit-tested (its logic is the pure formatter + thin fs reads).
 */
export async function assembleNoteInputs(opts: CaptureNoteOptions): Promise<NoteInputs> {
  const root = opts.projectRoot ?? process.cwd();
  const [stories, tickets] = await Promise.all([
    listIdsIn(`${root}/docs/active/stories`),
    listIdsIn(`${root}/docs/active/tickets`),
  ]);
  const project = buildProjectSnapshot({ root, srcFiles: [], stories, tickets });
  return { topic: opts.topic, project };
}

/**
 * Cast the CaptureNote sorcery end to end — `castPlay` OVER the registry entry, the parallel of
 * `runDecomposeEpic`. This is the proof the second play casts through the SAME generic
 * `castPlay`: same loop, same run-log append, zero per-play branches. IMPURE (assembles inputs,
 * spawns). NOT unit-tested; its logic is the engine's tested core.
 */
export async function castCaptureNote(opts: CaptureNoteOptions): Promise<RunSummary> {
  const root = opts.projectRoot ?? process.cwd();
  const inputs = await assembleNoteInputs(opts);
  return castPlay(captureNotePlay, inputs, opts.budget, {
    subject: opts.topic,
    projectRoot: root,
    model: opts.model,
    runId: opts.runId,
    transcriptDir: opts.transcriptDir,
  });
}
