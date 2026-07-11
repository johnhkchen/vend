// The DecomposeEpic runner's PURE decision core (T-002-03).
//
// Split out from decompose-epic.ts (the impure orchestrator) for ONE reason: the
// orchestrator value-imports `b` from baml_client/sync_client, which loads the BAML
// native addon. The addon's once-driven runtime reactor makes a `bun test` process
// flaky (memory 20213/20218). Keeping the runner's judgment in this baml-free module
// lets decompose-epic.test.ts exercise it as an ordinary pure-function test — no
// native addon ever loaded into the test process (the same discipline gates.test.ts
// and materialize.test.ts follow). Every import here is a TYPE, or a value from a
// pure module (`isStop` from gates.ts, which imports baml type-only).
//
// PURE: classify (the outcome decision), gateRowsFor (the GateResult translator),
// formatMessage + makeStreamSink (the two-surface stream formatter). No fs, clock,
// network, process, or native addon.

import type { StreamMessage } from "../executor/claude.ts";
import type { BudgetOutcome } from "../budget/budget.ts";
import { isStop, type GateResult } from "../gate/gates.ts";
import type { GateResult as LogGate, RunOutcome } from "../log/run-log.ts";
import type { PlayTools } from "../engine/play.ts";
import { AUTONOMOUS_DENY } from "./autonomous-deny.ts";
import { buildGraph, GraphIntegrityError, GraphParseError, type RawNode } from "../graph/model.ts";
import type { WorkPlan } from "../../baml_client/index.ts";

/**
 * Logged when no real model id was observed on the stream and the caller pinned
 * none; the seam omits `--model` in that case. Lives in the pure core (not the
 * impure orchestrator) so the fallback resolver below is testable without loading
 * the BAML addon; re-exported from decompose-epic.ts via its `export *`.
 */
export const DEFAULT_MODEL = "claude-cli-default";

/**
 * DecomposeEpic's WARRANTED DEFAULT agentic turn cap (T-015-02), set on
 * `decomposeEpicPlay.maxTurns` and resolved by the cast loop as
 * `resolveMaxTurns(opts.maxTurns, play.maxTurns)` (the per-cast override still wins).
 * Lives in the addon-free core so its value is unit-testable without loading BAML.
 *
 * JUDGMENT, not a frozen guess:
 *  - clean decompose runs land at 1–7 turns (live transcripts; `num_turns` 1,2,2,3,4,7);
 *  - the ~85–95k token tail (E-014's E2 probe, 2026-06-19) is agentic WANDERING, not input
 *    size — `claude -p` is the full agent (A2's tiny fixture once burned 119k);
 *  - 15 ≈ 2× the observed clean-run ceiling — generous enough that no legitimate run is cut
 *    off (a false andon is worse than one tail through — the ticket's tie-breaker; AC4),
 *    tight enough to bound the unbounded wander behind the tail (AC3).
 *
 * It is a SEED, not a constant frozen forever: `turnsUsed` is now logged on every run
 * (T-015-02 AC2), so a later iteration replaces 15 with a p95-of-clean number read from the
 * ledger (the E-014 / IA-14 measure-then-tighten discipline). See work/T-015-02/design.md D2.
 */
export const DECOMPOSE_MAX_TURNS = 15;

/**
 * DecomposeEpic's per-play TOOL declaration (E-032, T-032-02) — set on `decomposeEpicPlay.tools`
 * and resolved at cast by `resolveTools(play.tools, available)` against the project `.mcp.json`.
 * Lives in the addon-free core (the `DECOMPOSE_MAX_TURNS` precedent) so the live-proof argv test
 * reads it WITHOUT loading the BAML addon.
 *
 *  - `optionalMcp: ["codebase-memory-mcp"]` — the codebase-memory grounding server the E-031 tickets
 *    wired by hand into context. RECLASSIFIED from required to OPTIONAL (E-060 #3, T-060-01-01):
 *    present ⇒ the cast scopes exactly it in (byte-identical to the prior required behavior); ABSENT
 *    ⇒ the cast DEGRADES — it proceeds with the read-only built-ins below and flips the resolution's
 *    `reducedGrounding` flag rather than firing the missing-capability andon. The make-or-break
 *    steer→board path never needs the MCP, and requiring it raised fresh-seed onboarding friction
 *    against P2/P5, so a fresh seed without the server now clears with reduced grounding.
 *  - `allow: ["Read", "Grep", "Glob"]` — read-only built-ins. The decompose agent reasons by
 *    READING the board/epic/charter and searching the codebase ("go and see"); the play's WRITES
 *    are its own `effect` (materialize), not the agent's. Least privilege: read to reason, the
 *    harness writes.
 *  - `deny: AUTONOMOUS_DENY` (E-051) — make AskUserQuestion UNAVAILABLE: decompose is an autonomous
 *    cast run headless via `claude -p` with no answerer, and E-049 stalled when the agent improvised
 *    a mid-decompose question. The subtractive denylist rides alongside the strict allowlist above.
 */
export const DECOMPOSE_TOOLS: PlayTools = {
  optionalMcp: ["codebase-memory-mcp"],
  allow: ["Read", "Grep", "Glob"],
  deny: AUTONOMOUS_DENY,
};

/**
 * Pick the model id to stamp on the run log: the REAL id observed on the dispense
 * stream, else the caller's pinned id (`opts.model`), else the {@link DEFAULT_MODEL}
 * sentinel (T-005-01). PURE — the sentinel tail guarantees the non-empty string the
 * run log requires even on a timed-out run that returned no result.
 */
export function resolveLoggedModel(real: string | undefined, opt: string | undefined): string {
  return real ?? opt ?? DEFAULT_MODEL;
}

/** The inputs to the pure outcome decision. */
export interface ClassifyInput {
  /** The seam threw `ClaudeTimeoutError` (no result, nothing parsed/gated). */
  readonly timedOut: boolean;
  /** The token check after the seam returned; null when timed out. */
  readonly budgetOutcome: BudgetOutcome | null;
  /** The gate verdict; null when the run never reached or deliberately skipped gating. */
  readonly gateResult: GateResult | null;
}

/** The pure decision: the terminal outcome, whether to materialize, the log rows, and any
 *  one-way warning the effect shell must surface and persist. */
export interface Verdict {
  readonly outcome: RunOutcome;
  readonly materialize: boolean;
  readonly gateLog: readonly LogGate[];
  /** Present only when a token-exhausted cast explicitly cleared its gates and may materialize. */
  readonly overEnvelope?: true;
}

/**
 * Translate a gate verdict into run-log per-gate rows (the two distinct `GateResult`
 * types — gates' whole-plan verdict vs. run-log's per-gate record — meet here;
 * T-002-02 handoff #1). A STOP → one failed row naming gate/unit/reason; a CLEAR →
 * one passed row per cleared gate; null (never gated) → `[]`.
 */
export function gateRowsFor(g: GateResult | null): readonly LogGate[] {
  if (g === null) return [];
  if (isStop(g)) return [{ gate: g.gate, passed: false, detail: `${g.unit}: ${g.reason}` }];
  return g.cleared.map((gate) => ({ gate, passed: true }));
}

/**
 * Decide the run's outcome. PURE. First-match priority (T-068-02-02): TIMEOUT always discards;
 * an explicit gate STOP always discards (P3); a token-exhausted run materializes as `success`
 * ONLY when its gates explicitly CLEAR, carrying the one-way `overEnvelope` warning that keeps
 * the P7 contract breach countable. Exhaustion without a clear remains censored and discarded.
 */
export function classify(i: ClassifyInput): Verdict {
  const gateLog = gateRowsFor(i.gateResult);
  if (i.timedOut) return { outcome: "timed-out", materialize: false, gateLog };
  if (i.gateResult !== null && isStop(i.gateResult)) {
    return { outcome: "gate-failed", materialize: false, gateLog };
  }
  if (i.budgetOutcome?.status === "exhausted") {
    if (i.gateResult !== null) {
      return { outcome: "success", materialize: true, gateLog, overEnvelope: true };
    }
    return { outcome: "budget-exhausted", materialize: false, gateLog };
  }
  return { outcome: "success", materialize: true, gateLog };
}

/**
 * Format one stream-json message into a compact human line for the live surface.
 * PURE and TOTAL — never throws on an unknown `type` (the stream is external JSON;
 * tolerate noise). Keeps the line short: the full message goes to the transcript.
 */
export function formatMessage(msg: StreamMessage): string {
  const type = typeof msg.type === "string" ? msg.type : "?";
  if (type === "result") {
    const sub = typeof msg.subtype === "string" ? msg.subtype : "";
    return `· result${sub ? ` (${sub})` : ""}`;
  }
  if (type === "system") {
    const subtype = typeof msg.subtype === "string" ? msg.subtype : "";
    return `· system${subtype ? ` (${subtype})` : ""}`;
  }
  return `· ${type}`;
}

/**
 * Build the seam's `onMessage` hook, fanning each message to BOTH surfaces (AC#4):
 * a human line to `write` (live stdout) and the raw JSON to `sink` (the durable
 * per-run transcript). PURE given its injected edges, so it is testable with a fake
 * writer/sink — the edges (real stdout / file append) are owned by the caller.
 */
export function makeStreamSink(opts: {
  write: (line: string) => void;
  sink: (raw: string) => void;
}): (msg: StreamMessage) => void {
  return (msg) => {
    opts.write(formatMessage(msg));
    opts.sink(JSON.stringify(msg));
  };
}

// ── advances normalization: strip non-goal codes before gating (honey-kitchen field fix) ────────
//
// WHY: the decompose model recurrently tags a ticket's `advances` with a NON-GOAL id (`N2`, `N4`),
// most often on an epic that is ABOUT respecting a non-goal (an access gate ↔ N2 "one couple";
// health tags ↔ N4). Advancing a non-goal is definitionally incoherent, so the bounds gate rightly
// refuses it — but as a HARD chain-halting andon it became the single biggest babysit in a 14-epic
// real drive (honey-kitchen tooling-feedback #1: hit E-007/008/009/012/014). The fix the field asked
// for: auto-STRIP any N-code from `advances` before the gates run, so the common `[P4, N2]` case
// clears cleanly instead of andon-ing on the noise. A ticket whose `advances` was ONLY a non-goal
// collapses to `[]` and then trips the VALUE gate ("advances nothing") — a real, retry-able defect,
// not a silent pass. Applied in the play's `parse` (cast.ts feeds one parsed plan to BOTH gates and
// effect), so the MATERIALIZED board never carries the bogus N-code either. Not hidden: the raw model
// output is still captured verbatim in the per-run transcript, so the generator defect stays visible.

/** True for an `advances` entry shaped like a non-goal id (`N4`), after trimming. PURE. The bounds
 *  gate's non-goal set is a subset of these — a charter's non-goals are all `N\d+` — so this shape
 *  test alone strips every non-goal without needing the charter. */
export const isNonGoalAdvance = (claim: string): boolean => /^N\d+$/.test(claim.trim());

/**
 * Drop every non-goal (`N\d+`) entry from each ticket's `advances`, returning a NEW plan (PURE —
 * never mutates the input; stories carry no `advances`, so they pass through untouched). A ticket
 * left with an empty `advances` is deliberately NOT patched up here: the value gate then reports it
 * as advancing nothing, the honest verdict for a ticket that named only a non-goal. Only tickets
 * that actually carry an N-code are re-allocated, so the common no-N-code plan is returned as-is.
 */
export function stripNonGoalAdvances(plan: WorkPlan): WorkPlan {
  const tickets = plan.tickets.map((t) =>
    Array.isArray(t.advances) && t.advances.some(isNonGoalAdvance)
      ? { ...t, advances: t.advances.filter((a) => !isNonGoalAdvance(a)) }
      : t,
  );
  return { ...plan, tickets };
}

// ── born-blocked mint: --after <ticket> (honey-kitchen field fix #3) ─────────────────────────────
//
// WHY: queuing a fresh epic behind a LIVE lisa loop races the scheduler (tooling-feedback #6). A
// minted epic's ENTRY tickets are born `depends_on: []`, so a greedy loop grabs them the instant
// they materialize — before a human can hand-add the blocking edge. There is no way to make
// "materialize, then edit the edge" atomic from the outside. The fix: `vend chain … --after <ticket>`
// adds the blocking edge AT MINT TIME, so the epic's front is born blocked on an existing board
// ticket (e.g. a running loop's terminal ticket) and the loop only flows onto it once that clears.
//
// Only ENTRY tickets (empty `depends_on`) need the edge: every other ticket already depends on an
// entry ticket, so it is transitively blocked. This runs in the effect AFTER the fragment-only
// graph-integrity net — the `--after` targets live OUTSIDE the plan fragment (they are other epics'
// tickets), so the net must not see them; they are validated against the live board separately.

/**
 * Add each `afterId` to the `depends_on` of every ENTRY ticket (one with no in-plan dependency),
 * returning a NEW plan (PURE — never mutates the input). `afterIds` is de-duplicated; a ticket that
 * already carries dependencies is left untouched (it is already blocked). An empty `afterIds` returns
 * the plan structurally unchanged. The targets are NOT checked here (that is the effect's board-
 * membership job) — this is the pure edge-application half.
 */
export function blockEntryTicketsAfter(plan: WorkPlan, afterIds: readonly string[]): WorkPlan {
  const deps = [...new Set(afterIds)];
  if (deps.length === 0) return plan;
  const tickets = plan.tickets.map((t) =>
    Array.isArray(t.depends_on) && t.depends_on.length === 0 ? { ...t, depends_on: [...deps] } : t,
  );
  return { ...plan, tickets };
}

// ── nested-id canonicalization + graph-integrity net (E-061 retro #8) ──────────────────────────
//
// WHY: the decompose model EMITS ids (its prompt even shows the old flat `T-002-01` / `S-002`
// form), but vend's graph model derives a story's epic from the id's FIRST number block
// (`epicIdForStory`: `S-061-02` → `E-061`). A flat plan for epic E-061 (`S-061, S-062, S-063, …`)
// therefore resolves `S-062` → a non-existent `E-062` and the board fails `bun run check`
// (GraphIntegrityError) — while passing lisa's laxer `validate`. The fix is to make vend OWN the
// identifiers (renumber onto the nested convention E-060 follows) and to run vend's OWN model over
// the would-be board BEFORE any write, so the play can never materialize a graph-invalid board.

/** The digit block of an epic id: `"E-061"` → `"061"`; null if not `E-<digits>`. PURE. */
export function epicNumOf(epicId: string): string | null {
  const m = epicId.match(/^E-(\d+)$/);
  return m ? m[1]! : null;
}

/** Pull the epic id (`"E-061"`) from an epic markdown doc's frontmatter (`id: E-061`), else null.
 *  PURE — mirrors `epicIdOf` in decompose-epic.ts but needs no path (the effect has only the doc). */
export function epicIdFromDoc(epic: string): string | null {
  const m = epic.match(/^\s*id:\s*(E-\d+)\b/m);
  return m ? m[1]! : null;
}

const pad2 = (n: number): string => String(n).padStart(2, "0");

/**
 * Deterministically RENUMBER a parsed plan onto the nested id convention the board's graph model
 * requires: every story becomes `S-<epic>-<NN>` (plan order) and every ticket `T-<epic>-<NN>-<MM>`
 * (NN = its story's number, MM = its order within that story). All cross-references
 * (`story.tickets`, `ticket.story`, `ticket.depends_on`) are remapped through the SAME old→new
 * tables, so the result is a faithful bijection of the model's plan carrying graph-valid ids.
 *
 * PURE and TOTAL. An id this cannot place — a ticket whose declared `story` is not in the plan —
 * is kept VERBATIM (never silently invented), so a genuinely malformed plan trips
 * {@link graphIntegrityViolations} rather than being papered over. A non-`E-<digits>` epic id is a
 * no-op (the net then judges the untouched plan). Produces plain objects (the drafts are plain
 * interfaces) — every downstream reader (gates already ran; materialize/the net) reads fields only.
 */
export function renumberPlanToEpic(plan: WorkPlan, epicId: string): WorkPlan {
  const num = epicNumOf(epicId);
  if (num === null) return plan;

  // 1. story ids in plan order
  const storyMap = new Map<string, string>();
  const storyNN = new Map<string, string>();
  plan.stories.forEach((s, i) => {
    const nn = pad2(i + 1);
    storyMap.set(s.id, `S-${num}-${nn}`);
    storyNN.set(s.id, nn);
  });

  // 2. ticket ids — first by each story's declared ticket order, then any unlisted ticket under
  //    its own declared story (so MM stays dense + unique within a story).
  const ticketMap = new Map<string, string>();
  const mmCount = new Map<string, number>();
  const assign = (oldTid: string, oldSid: string): void => {
    const nn = storyNN.get(oldSid);
    if (nn === undefined || ticketMap.has(oldTid)) return;
    const mm = (mmCount.get(oldSid) ?? 0) + 1;
    mmCount.set(oldSid, mm);
    ticketMap.set(oldTid, `T-${num}-${nn}-${pad2(mm)}`);
  };
  for (const s of plan.stories) for (const tid of s.tickets) assign(tid, s.id);
  for (const t of plan.tickets) assign(t.id, t.story);

  // 3. rebuild with remapped refs (unmapped → kept verbatim so the net andons, not this)
  const stories = plan.stories.map((s) => ({
    ...s,
    id: storyMap.get(s.id) ?? s.id,
    tickets: s.tickets.map((tid) => ticketMap.get(tid) ?? tid),
  }));
  const tickets = plan.tickets.map((t) => ({
    ...t,
    id: ticketMap.get(t.id) ?? t.id,
    story: storyMap.get(t.story) ?? t.story,
    depends_on: t.depends_on.map((d) => ticketMap.get(d) ?? d),
  }));
  return { ...plan, stories, tickets };
}

/**
 * Run vend's OWN graph model ({@link buildGraph}) over the plan as a would-be board FRAGMENT — a
 * synthetic node for the epic under decomposition plus the plan's stories/tickets — and return the
 * integrity violations. `[]` ⇒ the plan would materialize to a graph-valid board (every story
 * resolves to its epic, every edge resolves, no duplicate/cycle); a non-empty list is exactly WHY it
 * would not, straight from the same andon `bun run check` raises. PURE — builds RawNodes in-memory
 * (no fs, no `Bun.YAML`) and never throws: an expected integrity/parse refusal becomes data the
 * effect relabels to a `graph-invalid` outcome. The synthetic epic carries only the fields
 * `coerceEpic` requires; type/status/etc. are the drafts' enum-member strings (buildGraph keeps them
 * as opaque strings — the faithful-mirror rule — so no alias mapping is needed here).
 */
export function graphIntegrityViolations(plan: WorkPlan, epicId: string): string[] {
  const epicRaw: RawNode = {
    data: { id: epicId, title: "epic-under-decomposition", status: "active" },
    body: "",
    file: `${epicId} (synthetic)`,
  };
  const storyRaws: RawNode[] = plan.stories.map((s) => ({
    data: { id: s.id, title: s.title, status: s.status, priority: s.priority, tickets: s.tickets },
    body: "",
    file: `${s.id}.md`,
  }));
  const ticketRaws: RawNode[] = plan.tickets.map((t) => ({
    data: {
      id: t.id, story: t.story, title: t.title, type: t.type, status: t.status,
      priority: t.priority, phase: t.phase, depends_on: t.depends_on,
    },
    body: "",
    file: `${t.id}.md`,
  }));
  try {
    buildGraph([epicRaw], storyRaws, ticketRaws);
    return [];
  } catch (e) {
    if (e instanceof GraphIntegrityError) return [...e.violations];
    if (e instanceof GraphParseError) return [e.message];
    throw e;
  }
}

// ── story contract (T-066-01-01): the five fields every story must carry ───────────────────────
//
// The schema (decompose.baml StoryDraft) makes the five fields REPRESENTABLE as typed absences;
// the prompt DEMANDS them; the completeness gate (T-066-01-02) REFUSES their absence. The
// CANONICAL field list now lives in gates.ts (the enforcer owns the contract's vocabulary — and
// this module already value-imports gates.ts, so the reverse import would cycle); it is
// RE-EXPORTED here so the render test and the story writer keep one stable import path in the
// play's core. The exemplar stays here: it is render vocabulary, and the gate never needs it.

export { STORY_CONTRACT_FIELDS } from "../gate/gates.ts";
export type { StoryContractField } from "../gate/gates.ts";

/**
 * The in-prompt exemplar of a contract-quality story — condensed from the hand-authored
 * S-066-01.md, the look-and-feel bar for what decompose must emit. MUST stay byte-identical to
 * the exemplar block authored inside decompose.baml's prompt: the render test asserts the
 * rendered prompt CONTAINS this constant, so an edit to either copy without the other stops the
 * line. Flush-left on purpose — BAML dedents the `#"…"#` template's common indent, so the
 * rendered block is flush-left too.
 */
export const STORY_CONTRACT_EXEMPLAR = `scope: the decompose pipeline end to end — BAML schema + render, the play's gate list, and the
story writer. Ticket bodies and epic cards are untouched; only the story artifact changes shape.
storyAcceptance: casting decompose-epic against a fixture epic through a stub executor yields
story files carrying all five sections plus a DAG block consistent with the tickets' depends_on
edges — and replaying a ten-line shell through the same cast is refused with a named andon, no
file written.
honestBoundary: everything here is fixture-proven and FREE (stub executor, no tokens). The live
metered cast closes the epic, not this story — authorized by the human at the counter, named
here as the deferred step, not hidden inside a ticket.
waveRationale: the schema ticket runs alone — all three consumers depend on the settled field
shape. The gate, writer, and doc tickets then run in parallel: disjoint files, no overlap.
outOfSlice: status derivation and the archive sweep (the sibling epic); backfilling shell
stories already on the board (history stays); the live gold-master cast (see honestBoundary).`;
