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
// does mkdir -p + writeFile. The verb itself is fixture-tested through its public
// boundary; its guards are covered by real-fs tests
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
// doneSignal, the five story sections) via a snapshot-gated rewrite that leaves non-charter
// tokens untouched. `materialize` gains the charter parameter and resolves it exactly ONCE per
// cut (snapshot-at-cut, E-067). An `advances` code the snapshot misses remains bare for the
// downstream guard; T-077-02-02 makes the inline-prose miss behavior an honest annotation.
//
// T-067-01-03 added the rendered-byte bare-code write guard. T-077-02-02 narrows its
// disposition for INLINE PROSE: a charter-family code missing from the cut-time snapshot is
// replaced by an honest annotation and returned as a structured degradation instead of
// refusing the whole cut. The guard remains after that transform as the final backstop for
// unhandled surfaces (notably `advances`, owned by T-077-02-03): any surviving bare code in a
// POLICED prefix family still throws before every mkdir/write. Foreign prefixes (`E1` in
// "forward-E1", `A3`) remain unpoliced passthrough.
//
// T-069-01-02 added the seat write guard; T-070-01-02 flips its unknown-seat disposition.
// A supplied Lisa executor-routing seat is checked once against the canonical pure oracle.
// A known seat is stamped uniformly onto every ticket immediately after `priority:`. An
// unknown seat degrades to Lisa's default by omitting the key, preserving the pre-seat bytes,
// and is returned as requested-vs-applied data rather than refusing a gates-cleared board.

import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import type { StoryDraft, TicketDraft, WorkPlan } from "../../baml_client/index.ts";
import type { SeatDefaulted } from "../engine/play.ts";
import { findUnknownSeat, type AgentSeat } from "./agent-seat.ts";
import { snapshotCharterCodes, type CharterSnapshot } from "./charter-snapshot.ts";
import {
  classifyCharterCite,
  materializationDisposition,
  type CharterCiteClassification,
  type DegradeDisposition,
} from "./degrade-disposition.ts";
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
  /** Ordered occurrence-level evidence for inline charter cites annotated during this cut. */
  readonly degrades: readonly DegradeDisposition[];
  readonly seatDefaulted?: SeatDefaulted;
}

/** Lisa's routing default when ticket frontmatter omits `agent:`. */
const DEFAULT_AGENT_SEAT = "claude" as const satisfies AgentSeat;

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

/** Internal rendering result: public bytes plus occurrence-level cite judgments. */
interface DetailedRender {
  readonly file: RenderedFile;
  readonly classifications: readonly CharterCiteClassification[];
}

/** One file's bare (unglossed, policed-prefix) codes: `codes` deduped, in body order.
 *  The payload {@link BareCodeError} carries and the runner's andon detail names. */
export interface BareCodeHit {
  readonly file: string;
  readonly codes: readonly string[];
}

/**
 * Thrown by {@link materialize} when a rendered body would land carrying a bare code in a
 * policed prefix family — the charter cannot resolve a cited code (T-067-01-03).
 * {@link IdCollisionError}'s sibling, same contract: an EXPECTED refusal the runner
 * catches by type and relabels to the `bare-code` run-log outcome, thrown BEFORE any
 * mkdir/write so a refused cut leaves zero partial output (P7). Carries the per-file
 * hits so the andon names exactly what the charter is missing and where.
 */
export class BareCodeError extends Error {
  readonly hits: readonly BareCodeHit[];
  constructor(hits: readonly BareCodeHit[]) {
    super(
      `materialize: refusing to write — bare unresolved code(s): ${hits
        .map((h) => `${h.file}: ${h.codes.join(", ")}`)
        .join("; ")}`,
    );
    this.name = "BareCodeError";
    this.hits = hits;
  }
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

/** The code shape charter-snapshot parses (`[A-Z]{1,3}\d+`), met here in RUNNING PROSE.
 *  The optional second capture observes an authored gloss delimiter: a resolvable authored
 *  gloss stays byte-identical, while an unresolved cite loses both its code and delimiter so
 *  the retained prose reads naturally after the honest marker. */
const PROSE_CODE = /\b([A-Z]{1,3}\d+)\b( — )?/g;

/** Artifact-visible honesty without reintroducing a code-shaped token the write guard rejects. */
const UNRESOLVED_CHARTER_CITE = "[unresolved charter cite]";

/** The write guard's independent bare-code shape, with the prefix captured separately. Its
 *  gloss-skip lookahead treats a code followed by ` — ` as explained, whether by the charter's
 *  carried text or the model's own words; anything else is bare. One deliberate widening: the
 *  trailing boundary is
 *  `(?![0-9A-Za-z])` rather than `\b`, because the advances line wraps in italic
 *  underscores (`_Advances: P1_`) and `_` is a word character — a bare code closing that
 *  line must still be caught. The widening only ever FLAGS more, never writes more. */
const BARE_CODE = /\b([A-Z]{1,3})\d+(?![0-9A-Za-z])(?! —)/g;

interface ResolvedProse {
  readonly text: string;
  readonly classifications: readonly CharterCiteClassification[];
}

/**
 * Resolve or honestly annotate charter citations in one located prose field. Snapshot-known
 * codes carry their title; snapshot-missing P/N or charter-defined-prefix codes become the
 * annotation marker and one ordered degradation record. Unknown foreign-prefix tokens remain
 * verbatim. PURE — the caller supplies both snapshot and stable artifact-field location.
 */
function resolveCodesInProse(
  text: string,
  snapshot: CharterSnapshot,
  location: string,
): ResolvedProse {
  const classifications: CharterCiteClassification[] = [];
  const prefixes = policedPrefixes(snapshot);
  const resolved = text.replace(
    PROSE_CODE,
    (matched, code: string, authoredGloss: string | undefined) => {
      const title = snapshot.get(code);
      const prefix = code.match(/^[A-Z]+/)?.[0];
      if (title === undefined && (prefix === undefined || !prefixes.has(prefix))) return matched;

      const classification = classifyCharterCite(
        { code, location, action: "annotate" },
        snapshot,
      );
      classifications.push(classification);

      if (classification.classification === "resolvable") {
        return authoredGloss === undefined ? `${classification.code} — ${classification.title}` : matched;
      }
      if (classification.classification === "degradable") {
        return authoredGloss === undefined ? UNRESOLVED_CHARTER_CITE : `${UNRESOLVED_CHARTER_CITE} `;
      }
      throw new RangeError(
        `materialize: inline charter cite classifier invariant failed at ${location}: ${classification.reason}`,
      );
    },
  );
  return { text: resolved, classifications };
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

/** The prefix families the write guard polices: {P, N} ALWAYS (the story's grep bar —
 *  bare P/N codes are the honey-kitchen defect, and the floor holds even against a
 *  charter whose snapshot is empty), plus the leading-letter prefix of every code this
 *  charter DEFINES (a kitchen charter defining `K1..K3` makes a bare `K7` a detectable
 *  defect — the charter owns its prefix families). Foreign prefixes pass through. */
function policedPrefixes(snapshot: CharterSnapshot): Set<string> {
  const prefixes = new Set(["P", "N"]);
  for (const code of snapshot.keys()) {
    const letters = code.match(/^[A-Z]+/);
    if (letters) prefixes.add(letters[0]);
  }
  return prefixes;
}

/**
 * Scan rendered files for bare (unglossed) codes in the policed prefix families —
 * the pure judgment of the T-067-01-03 write guard. PURE and TOTAL: no fs, no clock,
 * never throws; inputs are not mutated. Judges the RENDERED bytes, so it cannot
 * disagree with the renderers about what resolved: post-render, every resolvable code
 * is already glossed — a surviving bare policed code is a defect by definition, whether
 * it came from an `advances` miss or prose the gates never see. `snapshot` is consulted
 * only for {@link policedPrefixes}. Per file: codes deduped in body order; a clean file
 * contributes no hit. `[]` means clear — safe to write.
 */
export function findBareCodes(
  files: readonly RenderedFile[],
  snapshot: CharterSnapshot,
): BareCodeHit[] {
  const prefixes = policedPrefixes(snapshot);
  const hits: BareCodeHit[] = [];
  for (const f of files) {
    const codes: string[] = [];
    for (const m of f.body.matchAll(BARE_CODE)) {
      const prefix = m[1];
      if (prefix === undefined || !prefixes.has(prefix)) continue;
      if (!codes.includes(m[0])) codes.push(m[0]);
    }
    if (codes.length > 0) hits.push({ file: f.name, codes });
  }
  return hits;
}

/**
 * Render one TicketDraft → a lisa-valid ticket file. PURE. Frontmatter carries the
 * eight lisa fields with enum members mapped to aliases; the body is generated from
 * the value triplet — `purpose` becomes the Context, `doneSignal` the single
 * Acceptance Criterion, `advances` a noted line (so the materialized file is honest
 * about why the unit exists, not just structurally valid). Every cited charter code
 * in prose either carries its cut-time one-liner or becomes the unresolved-cite marker;
 * `advances` retains its separate renderer/guard path. The frontmatter is code-free. A
 * supplied `agent` renders immediately after `priority:`; absence contributes zero bytes
 * and retains the pre-seat full-file shape.
 */
function renderTicketFileDetailed(
  t: TicketDraft,
  snapshot: CharterSnapshot,
  agent?: string,
): DetailedRender {
  const name = `${t.id}.md`;
  const fm = [
    "---",
    `id: ${t.id}`,
    `story: ${t.story}`,
    `title: ${t.title}`,
    `type: ${alias(TYPE_ALIAS, t.type, "type")}`,
    `status: ${alias(STATUS_ALIAS, t.status, "status")}`,
    `priority: ${alias(PRIORITY_ALIAS, t.priority, "priority")}`,
    ...(agent !== undefined ? [`agent: ${agent}`] : []),
    `phase: ${alias(PHASE_ALIAS, t.phase, "phase")}`,
    `depends_on: ${flowArray(t.depends_on)}`,
    "---",
  ].join("\n");
  const purpose = resolveCodesInProse(t.purpose, snapshot, `${name}#purpose`);
  const doneSignal = resolveCodesInProse(t.doneSignal, snapshot, `${name}#doneSignal`);
  const body = [
    "",
    "## Context",
    "",
    purpose.text,
    "",
    advancesLine(t.advances, snapshot),
    "",
    "## Acceptance Criteria",
    "",
    `- [ ] ${doneSignal.text}`,
    "",
  ].join("\n");
  return {
    file: { name, body: `${fm}\n${body}` },
    classifications: [...purpose.classifications, ...doneSignal.classifications],
  };
}

export function renderTicketFile(
  t: TicketDraft,
  snapshot: CharterSnapshot,
  agent?: string,
): RenderedFile {
  return renderTicketFileDetailed(t, snapshot, agent).file;
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
 * Section prose resolves or annotates its cited charter codes through `snapshot` exactly as
 * the ticket body does; the DAG block and footer carry no codes by construction and are
 * untouched.
 */
function renderStoryFileDetailed(
  s: StoryDraft,
  storyTickets: readonly TicketDraft[],
  cutDate: string,
  snapshot: CharterSnapshot,
): DetailedRender {
  const name = `${s.id}.md`;
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
  const classifications: CharterCiteClassification[] = [];
  for (const [field, label] of PRE_DAG_SECTIONS) {
    const value = s[field];
    if (value != null) {
      const prose = resolveCodesInProse(value, snapshot, `${name}#${field}`);
      chunks.push(`**${label}:** ${prose.text}`);
      classifications.push(...prose.classifications);
    }
  }
  let dag = `## DAG\n\n${dagBlock(s, storyTickets)}`;
  if (s.waveRationale != null) {
    const waveRationale = resolveCodesInProse(
      s.waveRationale,
      snapshot,
      `${name}#waveRationale`,
    );
    dag += `\n\nWave rationale: ${waveRationale.text}`;
    classifications.push(...waveRationale.classifications);
  }
  chunks.push(dag);
  if (s.outOfSlice != null) {
    const outOfSlice = resolveCodesInProse(s.outOfSlice, snapshot, `${name}#outOfSlice`);
    chunks.push(`**Out of this slice:** ${outOfSlice.text}`);
    classifications.push(...outOfSlice.classifications);
  }
  chunks.push(
    `---\n_Materialized by Vend's \`decompose-epic\` play — ${s.tickets.length} ticket(s), ${cutDate}._`,
  );

  return {
    file: { name, body: `${fm}\n\n${chunks.join("\n\n")}\n` },
    classifications,
  };
}

export function renderStoryFile(
  s: StoryDraft,
  storyTickets: readonly TicketDraft[],
  cutDate: string,
  snapshot: CharterSnapshot,
): RenderedFile {
  return renderStoryFileDetailed(s, storyTickets, cutDate, snapshot).file;
}

/**
 * Write a cleared WorkPlan to disk. The single IMPURE verb — composes the pure render
 * pair with `mkdir -p` + `writeFile`. Fixture-tested through this public boundary while
 * pure rendering judgments remain pinned separately. Only called on a CLEAR verdict;
 * the runner never reaches here on a STOP.
 *
 * Pre-write identity and rendered-content guards run BEFORE the first `mkdir`/`writeFile`,
 * so a structurally refused plan materializes nothing — "no partial materialization" (P7)
 * is structural, not a cleanup. Inline editorial cites are applied before the content guard:
 * they annotate and return ordered degradation records rather than refusing the cut.
 *
 * Before those guards, seat disposition (T-070-01-02) checks supplied routing metadata
 * against the canonical seat contract. Unknown metadata is omitted from rendered tickets,
 * safely selecting Lisa's default, and returned as a degradation report rather than refusing.
 *
 *  1. Cross-board collision guard (T-004-02): gather the ids already living under the
 *     target dirs, run the pure `detectCollisions`; a re-minted id refuses with
 *     {@link IdCollisionError}.
 *  2. Bare-code write guard (T-067-01-03): after inline application, run the pure
 *     {@link findBareCodes} over every would-be body; a surviving bare policed code refuses
 *     with {@link BareCodeError}. Rendering precedes writing entirely, so the guard judges
 *     the exact bytes that would land.
 *
 * `charter` is the SAME string the runner feeds the gates' `ClearContext` — resolved here
 * into a {@link CharterSnapshot} exactly once per cut (after the collision guard: no
 * point resolving a refused plan) and threaded into both renderers and the guard.
 */
export async function materialize(
  plan: WorkPlan,
  targets: MaterializeTargets,
  charter: string,
  agent?: string,
): Promise<MaterializeResult> {
  let effectiveAgent = agent;
  let seatDefaulted: SeatDefaulted | undefined;
  if (agent !== undefined) {
    const unknown = findUnknownSeat(agent);
    if (unknown !== null) {
      effectiveAgent = undefined;
      seatDefaulted = {
        requested: unknown,
        applied: DEFAULT_AGENT_SEAT,
        reason: "unknown-seat",
      };
    }
  }

  const existing = [
    ...(await listIdsIn(targets.storiesDir)),
    ...(await listIdsIn(targets.ticketsDir)),
  ];
  const generated = [...plan.stories.map((s) => s.id), ...plan.tickets.map((t) => t.id)];
  const collisions = detectCollisions(generated, existing);
  if (collisions.length > 0) throw new IdCollisionError(collisions);

  // One clock read per run (the pure renderer takes the date as data), and ONE charter
  // resolution per run (snapshot-at-cut); the story's tickets are the plan's drafts
  // filtered by the story's own membership list, in plan order.
  const cutDate = new Date().toISOString().slice(0, 10);
  const snapshot = snapshotCharterCodes(charter);

  const storyRenders = plan.stories.map((s) => {
    const storyTickets = plan.tickets.filter((t) => s.tickets.includes(t.id));
    return renderStoryFileDetailed(s, storyTickets, cutDate, snapshot);
  });
  const ticketRenders = plan.tickets.map((t) => renderTicketFileDetailed(t, snapshot, effectiveAgent));
  const stories = storyRenders.map((render) => render.file);
  const tickets = ticketRenders.map((render) => render.file);

  const disposition = materializationDisposition([
    ...storyRenders.flatMap((render) => render.classifications),
    ...ticketRenders.flatMap((render) => render.classifications),
  ]);
  if (disposition.status === "structural-refusal") {
    throw new RangeError(
      `materialize: inline charter cite classifier invariant failed at ${disposition.finding.location}: ${disposition.finding.reason}`,
    );
  }

  const bare = findBareCodes([...stories, ...tickets], snapshot);
  if (bare.length > 0) throw new BareCodeError(bare);

  await mkdir(targets.storiesDir, { recursive: true });
  await mkdir(targets.ticketsDir, { recursive: true });

  const storyFiles: string[] = [];
  for (const { name, body } of stories) {
    const path = join(targets.storiesDir, name);
    await writeFile(path, body, "utf8");
    storyFiles.push(path);
  }

  const ticketFiles: string[] = [];
  for (const { name, body } of tickets) {
    const path = join(targets.ticketsDir, name);
    await writeFile(path, body, "utf8");
    ticketFiles.push(path);
  }

  return {
    storyFiles,
    ticketFiles,
    degrades: disposition.degrades,
    ...(seatDefaulted !== undefined ? { seatDefaulted } : {}),
  };
}
