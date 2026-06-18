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
// is the single IMPURE verb (mkdir -p + writeFile), untested here exactly as
// `appendRunLog`/`dispense` are — its logic is the tested pure render pair.

import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import type { StoryDraft, TicketDraft, WorkPlan } from "../../baml_client/index.ts";

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

/**
 * Render one TicketDraft → a lisa-valid ticket file. PURE. Frontmatter carries the
 * eight lisa fields with enum members mapped to aliases; the body is generated from
 * the value triplet — `purpose` becomes the Context, `doneSignal` the single
 * Acceptance Criterion, `advances` a noted line (so the materialized file is honest
 * about why the unit exists, not just structurally valid).
 */
export function renderTicketFile(t: TicketDraft): RenderedFile {
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
    t.purpose,
    "",
    `_Advances: ${t.advances.join(", ")}_`,
    "",
    "## Acceptance Criteria",
    "",
    `- [ ] ${t.doneSignal}`,
    "",
  ].join("\n");
  return { name: `${t.id}.md`, body: `${fm}\n${body}` };
}

/**
 * Render one StoryDraft → a lisa-valid story file. PURE. `type` is hardcoded `story`
 * (lisa renders stories at this layer as `type: story`, NOT the draft's DraftType —
 * see S-001.md / decompose.baml StoryDraft note); status/priority map through their
 * alias tables; `tickets` is a flow array in execution order.
 */
export function renderStoryFile(s: StoryDraft): RenderedFile {
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
  const body = `\nMaterialized by Vend's \`${"decompose-epic"}\` play — ${s.tickets.length} ticket(s).\n`;
  return { name: `${s.id}.md`, body: `${fm}\n${body}` };
}

/**
 * Write a cleared WorkPlan to disk. The single IMPURE verb — composes the pure render
 * pair with `mkdir -p` + `writeFile`. Not unit-tested (its logic is the tested render
 * pair). Only called on a CLEAR verdict; the runner never reaches here on a STOP.
 */
export async function materialize(plan: WorkPlan, targets: MaterializeTargets): Promise<MaterializeResult> {
  await mkdir(targets.storiesDir, { recursive: true });
  await mkdir(targets.ticketsDir, { recursive: true });

  const storyFiles: string[] = [];
  for (const s of plan.stories) {
    const { name, body } = renderStoryFile(s);
    const path = join(targets.storiesDir, name);
    await writeFile(path, body, "utf8");
    storyFiles.push(path);
  }

  const ticketFiles: string[] = [];
  for (const t of plan.tickets) {
    const { name, body } = renderTicketFile(t);
    const path = join(targets.ticketsDir, name);
    await writeFile(path, body, "utf8");
    ticketFiles.push(path);
  }

  return { storyFiles, ticketFiles };
}
