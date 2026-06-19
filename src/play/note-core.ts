// The CaptureNote play's PURE core (T-007-04) — the second play's testable judgment, the
// addon-free mirror of materialize.ts's pure render + impure verb split.
//
// Split out from note.ts (the impure shell) for the same reason every play splits its core:
// note.ts value-imports `b` from baml_client/sync_client, which loads the BAML native addon,
// and the addon's once-driven reactor makes a `bun test` process flaky (memory 20213/20675).
// Keeping the gate, the slug/render helpers, AND the file-writing effect HERE — with the
// `Note` import TYPE-ONLY (erased under verbatimModuleSyntax) — lets note-core.test.ts
// exercise all of it as an ordinary test, no addon ever loaded (the gates.ts / materialize.ts
// discipline). The engine imports (`GateVerdict`/`CastContext`/`EffectResult`) are TYPE-ONLY
// too; `captureNoteEffect` is the single IMPURE verb (mkdir + writeFile), untested only by the
// shell, proven here against a real temp-dir fixture exactly as `materialize` is.

import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import type { Note } from "../../baml_client/index.ts";
import type { CastContext, EffectResult, GateVerdict } from "../engine/play.ts";

/** The play's typed inputs — what `render` consumes (the topic to capture + a go-and-see
 *  project snapshot to ground it in). The pure analogue of DecomposeEpic's `DecomposeInputs`. */
export interface NoteInputs {
  readonly topic: string;
  readonly project: string;
}

/** Where the captured note is written, relative to the cast's `projectRoot`. A real, sensible
 *  home for a note — NOT a lisa stories/tickets dir, so the board's DAG never sees it. */
export const NOTES_DIR = "docs/active/notes";

/** The single gate's name — echoed in `GateVerdict.cleared` on a pass so the run log gets one
 *  passed `substance` row (parity with DecomposeEpic's four named rows). */
export const NOTE_GATE = "substance";

/**
 * Slugify a note title into a filename stem. PURE. Lowercase, runs of non-alphanumerics → a
 * single `-`, leading/trailing dashes trimmed. A title that slugs to empty (all punctuation)
 * falls back to `"note"` so the effect always has a writable `{stem}.md` — the artifact name
 * is never empty, the way materialize's `{id}.md` never is.
 */
export function slugify(title: string): string {
  const slug = title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return slug.length > 0 ? slug : "note";
}

/** One rendered file: a `{slug}.md` name + its full markdown body. Mirrors materialize's
 *  `RenderedFile`. */
export interface RenderedNote {
  readonly name: string;
  readonly body: string;
}

/**
 * Render a Note → a markdown artifact. PURE. A `# title` heading, the summary paragraph, a
 * `## Points` bullet list, and a trailer naming the `capture-note` play (so the file is honest
 * about its origin). The shape mirrors `renderTicketFile` — generated, deterministic prose.
 */
export function renderNoteFile(note: Note): RenderedNote {
  const points = note.points.map((p) => `- ${p}`).join("\n");
  const body = [
    `# ${note.title}`,
    "",
    note.summary,
    "",
    "## Points",
    "",
    points,
    "",
    "_Captured by Vend's `capture-note` play._",
    "",
  ].join("\n");
  return { name: `${slugify(note.title)}.md`, body };
}

/** A usable string field: present and non-blank after trimming (the gates.ts `nonEmpty` idiom). */
function nonEmpty(s: unknown): boolean {
  return typeof s === "string" && s.trim().length > 0;
}

/**
 * Clear a Note through the single `substance` gate. PURE. The note must carry a real title, a
 * real summary, and at least one non-blank point — the SAP parser degrades a malformed reply
 * to an EMPTY Note (decompose.baml's leniency hazard), so this gate is what classifies that
 * degradation as a STOP (the value-gate's empty-plan job, applied to a note). Returns the
 * engine's `GateVerdict` directly: a STOP names the offending unit; a pass echoes the gate
 * name in `cleared` so the run log records one passed `substance` row.
 */
export function clearNote(note: Note): GateVerdict {
  if (!nonEmpty(note.title)) {
    return { status: "stop", gate: NOTE_GATE, unit: "title", reason: "no `title` — the note has no subject (malformed/empty)" };
  }
  if (!nonEmpty(note.summary)) {
    return { status: "stop", gate: NOTE_GATE, unit: "summary", reason: "no `summary` — the note captures nothing" };
  }
  if (!Array.isArray(note.points) || !note.points.some(nonEmpty)) {
    return { status: "stop", gate: NOTE_GATE, unit: "points", reason: "no non-empty `points` — the note has no takeaways" };
  }
  return { status: "clear", cleared: [NOTE_GATE] };
}

/**
 * The play's EFFECT — land the cleared note in the world. The one IMPURE member of the
 * contract: it `mkdir -p`s the notes dir under `ctx.projectRoot` and writes the rendered
 * markdown. NO BAML, NO spawn — so it is testable against a real temp-dir fixture (the
 * `materialize` precedent). Reports back as DATA (`EffectResult`): `ok:true`, a `detail`, and
 * the written path in `artifacts`. A note has no board ids and no lisa validation, so there is
 * no `outcome` relabel — the loop logs `classify`'s verdict. A genuine fs failure throws (not a
 * clean outcome), mirroring `decomposeEffect`'s uncontracted-throw rule.
 */
export async function captureNoteEffect(note: Note, ctx: CastContext<NoteInputs>): Promise<EffectResult> {
  const dir = join(ctx.projectRoot, NOTES_DIR);
  const { name, body } = renderNoteFile(note);
  const path = join(dir, name);
  await mkdir(dir, { recursive: true });
  await writeFile(path, body, "utf8");
  // `produced` (the written path) makes a note threadable by the chain primitive (T-011-01),
  // for consistency with proposeEpicEffect — the same explicit downstream handle as `artifacts[0]`.
  return { ok: true, detail: `wrote ${path}`, artifacts: [path], produced: path };
}
