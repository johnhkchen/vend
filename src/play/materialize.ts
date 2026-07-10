// Materialize a cleared WorkPlan into lisa-valid story/ticket files (T-002-03).
//
// This is the back half of the convergence: a plan that cleared the gates becomes
// real `docs/active/stories/*.md` + `docs/active/tickets/*.md` files. It is the home
// of the MEMBER→ALIAS mapping flagged in T-002-01's review: `b.parse` returns the
// enum MEMBER name ("Task", "InProgress", "Ready"), while lisa frontmatter wants the
// ALIAS token ("task", "in-progress", "ready"). The maps below are fixed by the
// `@alias` annotations in baml_src/decompose.baml — the single source of that mapping.
//
// PURITY (house pattern, mirrors materialize's siblings): the render functions
// (`renderTicketFile`, `renderStoryFile`) and the alias maps are PURE — no fs, no
// clock, no native addon — so materialize.test.ts is an ordinary pure-function test.
// The baml import is TYPE-ONLY (erased under verbatimModuleSyntax), so it never loads
// the BAML native addon into the test process (the T-002-02 precedent). `materialize`
// is the single IMPURE verb — now read-then-write: it first GATHERS the board ids
// (listIdsIn) and runs the pure cross-board collision guard (detectCollisions,
// T-004-01), refusing with a typed `IdCollisionError` BEFORE any mkdir/writeFile, then
// does mkdir -p + writeFile. The verb itself is untested here exactly as
// `appendRunLog`/`dispense` are; its guard is covered by a real-fs fixture test
// (materialize.test.ts) and its pure judgment by id-guard.test.ts.
//
// T-066-01-03: `renderStoryFile` writes the story CONTRACT body — the five parsed sections
// (scope, story acceptance, honest boundary, wave rationale, out of slice), a `## DAG` block
// DERIVED from the tickets' `depends_on` edges (the edges stay the single source, never
// duplicated), and the old one-line provenance demoted to a dated footer. The clock stays out
// of the pure pair: `materialize` supplies `cutDate` as a parameter (the work-core pattern —
// `new Date(ms)` is total, argless `new Date()` is not), so the golden tests pin exact bytes.
// An ABSENT contract field renders nothing — the completeness gate (T-066-01-02), not this
// writer, owns refusing shells; fabricating a placeholder here would launder one.
//
// T-067-01-02: cut artifacts carry their charter grounding. Both renderers take a
// `CharterSnapshot` (code → one-line text, T-067-01-01) and render every cited code as
// `code — carried text` — the `_Advances:_` line from the array, prose citations (purpose /
// doneSignal, the five story sections) via a snapshot-GATED rewrite that leaves non-charter
// tokens and already-glossed codes untouched. `materialize` gains the charter parameter and
// resolves it exactly ONCE per cut (snapshot-at-cut, E-067). A code the snapshot misses
// degrades to the bare code — never a fabricated gloss; refusing that cut is the write
// guard's job (T-067-01-03), not the renderer's.

import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import type { StoryDraft, TicketDraft, WorkPlan } from "../../baml_client/index.ts";
import { snapshotCharterCodes, type CharterSnapshot } from "./charter-snapshot.ts";
import { detectCollisions } from "./id-guard.ts";
import { listIdsIn } from "./project-context.ts";

/** Enum MEMBER → lisa frontmatter ALIAS. Keyed by the member string `b.parse`
 *  returns; values are the `@alias` tokens from decompose.baml. */
export const TYPE_ALIAS: Readonly<Record<string, string>> = {
  Task: "task",
  Bug: "bug",
  Spike: "spike",
};

export const STATUS_ALIAS: Readonly<Record<string, string>> = {
  Open: "open",
  InProgress: "in-progress",
  Review: "review",
  Done: "done",
  Blocked: "blocked",
};

export const PRIORITY_ALIAS: Readonly<Record<string, string>> = {
  Critical: "critical",
  High: "high",
  Medium: "medium",
  Low: "low",
};

export const PHASE_ALIAS: Readonly<Record<string, string>> = {
  Ready: "ready",
  Research: "research",
  Design: "design",
  Structure: "structure",
  Plan: "plan",
  Implement: "implement",
  Review: "review",
  Done: "done",
};

/** Where the rendered files are written. Composed by the runner from a project root
 *  (default the repo's `docs/active/…`, redirectable so tests / T-002-04 never
 *  clobber the live board). */
export interface MaterializeTargets {
  readonly storiesDir: string;
  readonly ticketsDir: string;
}

/** The paths written, for the runner to log / report. */
export interface MaterializeResult {
  readonly storyFiles: string[];
  readonly ticketFiles: string[];
}

/**
 * Thrown by {@link materialize} when the plan's ids collide with ids already on the
 * board — the cross-board andon (T-004-02). Carries the colliding ids (deduped and
 * plan-ordered, straight from `detectCollisions`) so the runner names them in its
 * stdout andon and maps the refusal to the `id-collision` run-log outcome. An EXPECTED
 * refusal the runner catches — a sibling of the `RangeError` this module throws on
 * enum/alias drift, distinguished by type so a genuine fs failure is not misread as a
 * clean andon. Thrown BEFORE any write, so a collision leaves zero partial output (P7).
 */
export class IdCollisionError extends Error {
  readonly collisions: readonly string[];
  constructor(collisions: readonly string[]) {
    super(
      `materialize: refusing to write — ${collisions.length} id(s) already on the board: ${collisions.join(", ")}`,
    );
    this.name = "IdCollisionError";
    this.collisions = collisions;
  }
}

/** One rendered file: a `{id}.md` name + its full contents. */
export interface RenderedFile {
  readonly name: string;
  readonly body: string;
}

/** Map a member through one alias table, throwing on an unknown key — a programmer
 *  error meaning the BAML enum drifted from this map (house rule: caller/wiring
 *  error THROWS; it is never a silently-wrong frontmatter token). */
function alias(table: Readonly<Record<string, string>>, member: string, field: string): string {
  const a = table[member];
  if (a === undefined) {
    throw new RangeError(`materialize: no alias for ${field} member ${JSON.stringify(member)} (enum/map drift)`);
  }
  return a;
}

/** Render a `depends_on`/`tickets` list as a YAML flow array, matching the existing
 *  hand-authored files (`[]` when empty, `[a, b]` otherwise). */
function flowArray(items: readonly string[]): string {
  return `[${items.join(", ")}]`;
}

/** The code shape charter-snapshot parses (`[A-Z]{1,3}\d+`), met here in RUNNING PROSE. The
 *  `(?! —)` lookahead skips a code already carrying a gloss — the model's own `P4 — <its
 *  words>` is not bare — and the rewrite's own output starts `code — `, so the transform is
 *  idempotent. */
const PROSE_CODE = /\b([A-Z]{1,3}\d+)\b(?! —)/g;

/** Rewrite each cited code in prose to `code — carried text`, GATED on the snapshot: only a
 *  code the charter actually defines is expanded; anything else (`E1` in "forward-E1", a
 *  K-code cited against the vend charter) passes through verbatim, so the transform can
 *  never corrupt prose it does not understand. */
function resolveCodesInProse(text: string, snapshot: CharterSnapshot): string {
  return text.replace(PROSE_CODE, (bare, code: string) => {
    const title = snapshot.get(code);
    return title === undefined ? bare : `${code} — ${title}`;
  });
}

/** The `_Advances:_` line — the single owner of that format. Each code renders as
 *  `code — carried text` (code kept for traceability); entries join on `; ` because the
 *  carried texts are prose. A snapshot miss degrades to the BARE code — this renderer stays
 *  total; turning that absence into a named refusal is the write guard (T-067-01-03). */
function advancesLine(advances: readonly string[], snapshot: CharterSnapshot): string {
  const entries = advances.map((code) => {
    const title = snapshot.get(code);
    return title === undefined ? code : `${code} — ${title}`;
  });
  return `_Advances: ${entries.join("; ")}_`;
}

/**
 * Render one TicketDraft → a lisa-valid ticket file. PURE. Frontmatter carries the
 * eight lisa fields with enum members mapped to aliases; the body is generated from
 * the value triplet — `purpose` becomes the Context, `doneSignal` the single
 * Acceptance Criterion, `advances` a noted line (so the materialized file is honest
 * about why the unit exists, not just structurally valid). Every cited charter code
 * in the body carries its cut-time one-liner via `snapshot` (T-067-01-02); the
 * frontmatter is code-free and byte-identical to the pre-snapshot shape.
 */
export function renderTicketFile(t: TicketDraft, snapshot: CharterSnapshot): RenderedFile {
  const fm = [
    "---",
    `id: ${t.id}`,
    `story: ${t.story}`,
    `title: ${t.title}`,
    `type: ${alias(TYPE_ALIAS, t.type, "type")}`,
    `status: ${alias(STATUS_ALIAS, t.status, "status")}`,
    `priority: ${alias(PRIORITY_ALIAS, t.priority, "priority")}`,
    `phase: ${alias(PHASE_ALIAS, t.phase, "phase")}`,
    `depends_on: ${flowArray(t.depends_on)}`,
    "---",
  ].join("\n");
  const body = [
    "",
    "## Context",
    "",
    resolveCodesInProse(t.purpose, snapshot),
    "",
    advancesLine(t.advances, snapshot),
    "",
    "## Acceptance Criteria",
    "",
    `- [ ] ${resolveCodesInProse(t.doneSignal, snapshot)}`,
    "",
  ].join("\n");
  return { name: `${t.id}.md`, body: `${fm}\n${body}` };
}

// ── story contract body (T-066-01-03) ──────────────────────────────────────────────────────────

/** The three contract sections rendered ABOVE the DAG, in order, with their prose labels
 *  (the hand-authored S-066-01.md is the look-and-feel bar). `waveRationale` is absent on
 *  purpose — it renders inside the `## DAG` section, under the block it explains — as is
 *  `outOfSlice`, which closes the body. The `satisfies` pin makes a StoryDraft field rename
 *  that misses this table a compile failure. */
const PRE_DAG_SECTIONS = [
  ["scope", "Scope"],
  ["storyAcceptance", "Story acceptance"],
  ["honestBoundary", "Honest boundary"],
] as const satisfies readonly (readonly [keyof StoryDraft, string])[];

/** The `## DAG` fenced block: one line per story ticket in `s.tickets` (execution) order —
 *  `id  title`, plus `  ← deps` when the ticket declares `depends_on` edges. A PROJECTION of
 *  the tickets' `depends_on` fields, rendered verbatim (edges may name tickets outside the
 *  story — `--after` legitimately mints those); an id with no matching draft degrades to a
 *  bare-id line rather than crashing or dropping the node. */
function dagBlock(s: StoryDraft, storyTickets: readonly TicketDraft[]): string {
  const byId = new Map(storyTickets.map((t) => [t.id, t]));
  const lines = s.tickets.map((id) => {
    const t = byId.get(id);
    if (t === undefined) return id;
    const deps = t.depends_on.length > 0 ? `  ← ${t.depends_on.join(", ")}` : "";
    return `${t.id}  ${t.title}${deps}`;
  });
  return `\`\`\`\n${lines.join("\n")}\n\`\`\``;
}

/**
 * Render one StoryDraft → a lisa-valid story file. PURE. `type` is hardcoded `story`
 * (lisa renders stories at this layer as `type: story`, NOT the draft's DraftType —
 * see S-001.md / decompose.baml StoryDraft note); status/priority map through their
 * alias tables; `tickets` is a flow array in execution order.
 *
 * The body is the story CONTRACT (T-066-01-03): the parsed sections that are PRESENT
 * (an absent field renders nothing — the completeness gate owns refusal), the derived
 * {@link dagBlock}, and the provenance footer — the play that cut it, the ticket count,
 * and `cutDate` (`YYYY-MM-DD`, supplied by the impure caller so this stays clock-free).
 * Section prose resolves its cited charter codes through `snapshot` exactly as the
 * ticket body does (T-067-01-02); the DAG block and footer carry no codes by
 * construction and are untouched.
 */
export function renderStoryFile(
  s: StoryDraft,
  storyTickets: readonly TicketDraft[],
  cutDate: string,
  snapshot: CharterSnapshot,
): RenderedFile {
  const fm = [
    "---",
    `id: ${s.id}`,
    `title: ${s.title}`,
    "type: story",
    `status: ${alias(STATUS_ALIAS, s.status, "status")}`,
    `priority: ${alias(PRIORITY_ALIAS, s.priority, "priority")}`,
    `tickets: ${flowArray(s.tickets)}`,
    "---",
  ].join("\n");

  const chunks: string[] = [];
  for (const [field, label] of PRE_DAG_SECTIONS) {
    const value = s[field];
    if (value != null) chunks.push(`**${label}:** ${resolveCodesInProse(value, snapshot)}`);
  }
  let dag = `## DAG\n\n${dagBlock(s, storyTickets)}`;
  if (s.waveRationale != null) dag += `\n\nWave rationale: ${resolveCodesInProse(s.waveRationale, snapshot)}`;
  chunks.push(dag);
  if (s.outOfSlice != null) chunks.push(`**Out of this slice:** ${resolveCodesInProse(s.outOfSlice, snapshot)}`);
  chunks.push(
    `---\n_Materialized by Vend's \`decompose-epic\` play — ${s.tickets.length} ticket(s), ${cutDate}._`,
  );

  return { name: `${s.id}.md`, body: `${fm}\n\n${chunks.join("\n\n")}\n` };
}

/**
 * Write a cleared WorkPlan to disk. The single IMPURE verb — composes the pure render
 * pair with `mkdir -p` + `writeFile`. Not unit-tested (its logic is the tested render
 * pair). Only called on a CLEAR verdict; the runner never reaches here on a STOP.
 *
 * Cross-board collision guard FIRST (T-004-02): gather the ids already living under the
 * target dirs and run the pure `detectCollisions`; if the plan re-mints any, refuse
 * with {@link IdCollisionError} BEFORE the first `mkdir`/`writeFile`. The throw precedes
 * every write, so a refused plan materializes nothing — "no partial materialization"
 * (P7) is structural, not a cleanup. A fresh/disjoint board gathers `[]` and writes
 * normally.
 *
 * `charter` is the SAME string the runner feeds the gates' `ClearContext` — resolved here
 * into a {@link CharterSnapshot} exactly once per cut (after the guard: no point resolving
 * a refused plan; T-067-01-03's resolvability check slots between that build and the first
 * write) and threaded into both renderers.
 */
export async function materialize(
  plan: WorkPlan,
  targets: MaterializeTargets,
  charter: string,
): Promise<MaterializeResult> {
  const existing = [
    ...(await listIdsIn(targets.storiesDir)),
    ...(await listIdsIn(targets.ticketsDir)),
  ];
  const generated = [...plan.stories.map((s) => s.id), ...plan.tickets.map((t) => t.id)];
  const collisions = detectCollisions(generated, existing);
  if (collisions.length > 0) throw new IdCollisionError(collisions);

  await mkdir(targets.storiesDir, { recursive: true });
  await mkdir(targets.ticketsDir, { recursive: true });

  // One clock read per run (the pure renderer takes the date as data), and ONE charter
  // resolution per run (snapshot-at-cut); the story's tickets are the plan's drafts
  // filtered by the story's own membership list, in plan order.
  const cutDate = new Date().toISOString().slice(0, 10);
  const snapshot = snapshotCharterCodes(charter);

  const storyFiles: string[] = [];
  for (const s of plan.stories) {
    const storyTickets = plan.tickets.filter((t) => s.tickets.includes(t.id));
    const { name, body } = renderStoryFile(s, storyTickets, cutDate, snapshot);
    const path = join(targets.storiesDir, name);
    await writeFile(path, body, "utf8");
    storyFiles.push(path);
  }

  const ticketFiles: string[] = [];
  for (const t of plan.tickets) {
    const { name, body } = renderTicketFile(t, snapshot);
    const path = join(targets.ticketsDir, name);
    await writeFile(path, body, "utf8");
    ticketFiles.push(path);
  }

  return { storyFiles, ticketFiles };
}
