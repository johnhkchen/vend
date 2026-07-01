// Clearing gates (T-002-02) — the contract that nothing unworthy settles into execution
// (charter P3). The four value-ordered gates from playbook-decompose-epic.md run over a
// BAML-parsed WorkPlan and STOP THE LINE (andon) at the first failure, naming the gate, the
// offending unit, and why. The runner refuses to materialize on a STOP.
//
//   value → allocation → bounds → structural        (priority of VALUE, not of format)
//
// DIVISION OF LABOR (decompose.baml lines 11-12): BAML owns SHAPE — the four closed lisa sets
// (type/status/priority/phase) are enums, so an out-of-set value is unrepresentable and no gate
// re-checks it. These gates own MEANING — the things the type cannot guarantee: the dependency
// graph is a DAG, depends_on refs resolve, the plan isn't empty, `advances` claims are backed.
//
// PURE: no fs, clock, network, or process — it judges an already-parsed value, so it never
// touches the BAML native addon (the WorkPlan import is TYPE-ONLY, erased at runtime). This is
// what lets the test be an ordinary pure-function test, free of the bun-test/BAML one-call limit.
//
// HOUSE RULE (from budget.ts): a *programmer* error (a malformed call) THROWS; a plan that
// simply doesn't clear is a RETURNED STOP — an expected andon is data, not an exception.
//
// EMPTY-PLAN HAZARD (inherited from T-002-01, review Concern 2): WorkPlan is an all-array class,
// so the SAP parser never REJECTS — a malformed model reply degrades to an EMPTY WorkPlan rather
// than throwing. The value gate classifies a zero-ticket plan as MALFORMED; `b.parse` cannot.
//
// NAMING: the `GateResult` here is the WHOLE-PLAN clearing verdict. run-log.ts separately
// declares a PER-GATE `GateResult { gate; passed; detail? }` — the record the runner forwards to
// the log. Different module, different import; the runner translates a STOP/CLEAR into log rows.

import type { StoryDraft, TicketDraft, WorkPlan } from "../../baml_client/index.ts";

/** The four gates, in value-priority order. The single source of ordering — `clear()` runs them
 *  in this sequence and `cleared` echoes it. */
export const GATE_NAMES = ["value", "allocation", "bounds", "structural"] as const;

export type GateName = (typeof GATE_NAMES)[number];

/** The clearing context: the SAME `epic` + `charter` strings fed to `DecomposeEpic`. The bounds
 *  gate greps `charter` for the live invariant ids — alignment is recomputed, never stored. */
export interface ClearContext {
  readonly epic: string;
  readonly charter: string;
}

/** The line stopped. Names the gate, the offending unit (a ticket/story id, or `"<plan>"`), and
 *  why — enough for the runner to refuse, log `gate-failed`, and tell a human what to fix. */
export interface GateStop {
  readonly status: "stop";
  readonly gate: GateName;
  readonly unit: string;
  readonly reason: string;
}

/** Nothing tripped: the plan cleared every gate, in order. */
export interface GateClear {
  readonly status: "clear";
  readonly cleared: readonly GateName[];
}

/** The whole-plan clearing verdict. A value the runner switches on — not an exception. */
export type GateResult = GateClear | GateStop;

/** One gate's finding: the offending unit + why, or `null` for "passed". */
interface Offense {
  readonly unit: string;
  readonly reason: string;
}

// ── boundary guards (programmer error → throw, per the budget.ts house rule) ──────────────────

/** A non-object plan, or one missing its arrays, is a caller wiring error — surfaced loudly,
 *  before any gate runs. (A *malformed-but-shaped* plan is a STOP, not a throw — that's the
 *  gates' job.) */
function assertPlan(plan: WorkPlan): void {
  if (typeof plan !== "object" || plan === null) {
    throw new TypeError(`clear: workPlan must be an object, got ${JSON.stringify(plan)}`);
  }
  if (!Array.isArray(plan.stories) || !Array.isArray(plan.tickets)) {
    throw new TypeError("clear: workPlan must have array `stories` and `tickets`");
  }
}

/** The context strings must be strings — the bounds gate greps `charter`, and a non-string is a
 *  wiring error, not an unworthy plan. */
function assertContext(ctx: ClearContext): void {
  if (typeof ctx?.epic !== "string" || typeof ctx?.charter !== "string") {
    throw new TypeError("clear: context `epic` and `charter` must both be strings");
  }
}

// ── pure helpers ──────────────────────────────────────────────────────────────────────────────

/** A usable string field: present and non-blank after trimming. */
function nonEmpty(s: unknown): boolean {
  return typeof s === "string" && s.trim().length > 0;
}

/** Normalize a title/signal for equality: lowercased, whitespace collapsed. Lets the value gate
 *  catch a `doneSignal` that merely restates the `title` (the cheap slice of "distinguishable
 *  from merely done"). */
function normalizeTitle(s: string): string {
  return s.trim().toLowerCase().replace(/\s+/g, " ");
}

/** The set of ticket ids, plus the first duplicate id seen (a dup makes every reference to it
 *  ambiguous — unallocatable). */
function idSetOf(tickets: readonly TicketDraft[]): { ids: Set<string>; dup?: string } {
  const ids = new Set<string>();
  for (const t of tickets) {
    if (ids.has(t.id)) return { ids, dup: t.id };
    ids.add(t.id);
  }
  return { ids };
}

/** Grep stable invariant/non-goal ids (`P1`, `N4`, …) out of a charter/epic string. The bounds
 *  gate derives its valid set from the live charter at call time — so retiring an invariant makes
 *  a dangling `advances` ref a *detectable defect*, exactly as the charter promises, rather than
 *  drifting against a hardcoded list. */
function matchIds(text: string, prefix: "P" | "N"): Set<string> {
  const out = new Set<string>();
  for (const m of text.matchAll(new RegExp(`\\b${prefix}\\d+\\b`, "g"))) {
    if (m[0]) out.add(m[0]);
  }
  return out;
}

/** Return one ticket id lying on a `depends_on` cycle, or `null` if the graph is acyclic. DFS
 *  with a recursion stack; unresolved refs are ignored here (the allocation gate reports those
 *  separately, before this runs). */
function findCycle(tickets: readonly TicketDraft[]): string | null {
  const byId = new Map(tickets.map((t) => [t.id, t]));
  const state = new Map<string, "visiting" | "done">();

  function visit(id: string): string | null {
    const s = state.get(id);
    if (s === "done") return null;
    if (s === "visiting") return id; // back-edge → a node on the cycle
    state.set(id, "visiting");
    const node = byId.get(id);
    if (node) {
      for (const dep of node.depends_on) {
        if (!byId.has(dep)) continue; // unresolved — not our concern here
        const hit = visit(dep);
        if (hit) return hit;
      }
    }
    state.set(id, "done");
    return null;
  }

  for (const t of tickets) {
    const hit = visit(t.id);
    if (hit) return hit;
  }
  return null;
}

// ── the four gates: (plan, ctx) => Offense | null ────────────────────────────────────────────

/**
 * VALUE — every unit names what it advances and how we'll know it landed; nothing speculative
 * settles (overproduction is the worst waste). A zero-ticket plan is MALFORMED — it advances
 * nothing — so it stops here (the empty-degradation case `b.parse` cannot reject).
 */
function valueGate(plan: WorkPlan): Offense | null {
  if (plan.tickets.length === 0) {
    return { unit: "<plan>", reason: "plan has no tickets — it advances nothing (malformed/empty)" };
  }
  for (const t of plan.tickets) {
    if (!nonEmpty(t.purpose)) {
      return { unit: t.id, reason: "no `purpose` — the unit must say the value it delivers" };
    }
    if (!Array.isArray(t.advances) || t.advances.length === 0 || !t.advances.every(nonEmpty)) {
      return { unit: t.id, reason: "`advances` is empty — must name what it advances (never empty)" };
    }
    if (!nonEmpty(t.doneSignal)) {
      return { unit: t.id, reason: "no `doneSignal` — must say how we'll know it landed" };
    }
    if (normalizeTitle(t.doneSignal) === normalizeTitle(t.title)) {
      return { unit: t.id, reason: "`doneSignal` merely restates the title — not a verifiable signal" };
    }
  }
  return null;
}

/**
 * ALLOCATION — capacity never stalls on a missing dependency: ids are unique, every `depends_on`
 * resolves, the graph is a DAG, and every `story.tickets` index points at a real ticket.
 * ("Right-sized for one session" is human judgment — not rule-checked.)
 */
function allocationGate(plan: WorkPlan): Offense | null {
  const { ids, dup } = idSetOf(plan.tickets);
  if (dup !== undefined) {
    return { unit: dup, reason: "duplicate ticket id — every reference to it is ambiguous" };
  }
  for (const t of plan.tickets) {
    for (const dep of t.depends_on) {
      if (!ids.has(dep)) {
        return { unit: t.id, reason: `depends_on \`${dep}\` resolves to no ticket in this plan` };
      }
    }
  }
  const cyclic = findCycle(plan.tickets);
  if (cyclic !== null) {
    return { unit: cyclic, reason: "depends_on forms a cycle — capacity would deadlock (not a DAG)" };
  }
  for (const s of plan.stories) {
    for (const ref of s.tickets) {
      if (!ids.has(ref)) {
        return { unit: s.id, reason: `story lists ticket \`${ref}\` that resolves to no ticket` };
      }
    }
  }
  return null;
}

/**
 * BOUNDS — `advances` claims actually hold (the charter's "detectable defect" rule, recomputed
 * here): an entry shaped like an invariant id (`P\d+`) must resolve to a real invariant in THIS
 * charter; an entry naming a non-goal (`N\d+`) is incoherent — you cannot *advance* a non-goal.
 * Free-text entries (epic-outcome prose, which carries no grep-able id) are human-judgment
 * territory and are not failed by rule.
 *
 * NON-GOAL BACKSTOP: the decompose play now strips `N\d+` codes from `advances` in `parse`
 * (`stripNonGoalAdvances`, honey-kitchen field fix #1), so on the normal play path the non-goal
 * branch below never fires — a mis-tagged `[P4, N2]` clears as `[P4]` instead of hard-halting the
 * chain, and a ticket left with no real claim collapses to `[]` and stops at VALUE (retry-able).
 * The check is KEPT as defense-in-depth for any caller that clears an un-normalized plan directly.
 */
function boundsGate(plan: WorkPlan, ctx: ClearContext): Offense | null {
  const invariants = matchIds(ctx.charter, "P");
  const nonGoals = matchIds(ctx.charter, "N");
  for (const t of plan.tickets) {
    for (const claim of t.advances) {
      const ref = claim.trim();
      if (/^N\d+$/.test(ref) || nonGoals.has(ref)) {
        return { unit: t.id, reason: `advances \`${ref}\` — cannot advance a non-goal` };
      }
      if (/^P\d+$/.test(ref) && !invariants.has(ref)) {
        return { unit: t.id, reason: `advances \`${ref}\` — no such invariant in the charter (dangling ref)` };
      }
    }
  }
  return null;
}

/** The eight required lisa frontmatter fields on every ticket (rdspi-workflow.md ticket format).
 *  Enum-valued fields are checked for PRESENCE only — BAML already guarantees the *value* is in
 *  set, so re-checking it would duplicate the type. */
const REQUIRED_TICKET_FIELDS = ["id", "story", "title", "type", "status", "priority", "phase"] as const;

/**
 * STRUCTURAL — the last fixture on the way out: every TicketDraft carries all required lisa
 * frontmatter, present and non-empty, so it materializes to a valid ticket file. Runs only after
 * value/allocation/bounds, exactly as the playbook orders it ("only now").
 */
function structuralGate(plan: WorkPlan): Offense | null {
  for (const t of plan.tickets) {
    for (const field of REQUIRED_TICKET_FIELDS) {
      if (!nonEmpty(t[field])) {
        return { unit: nonEmpty(t.id) ? t.id : "<ticket>", reason: `missing required field \`${field}\`` };
      }
    }
    if (!Array.isArray(t.depends_on)) {
      return { unit: t.id, reason: "missing required field `depends_on` (must be an array)" };
    }
  }
  return null;
}

// ── the public clearing function ──────────────────────────────────────────────────────────────

/** The ordered gate table — names match `GATE_NAMES`, so value-ordering is encoded once. */
const GATES: ReadonlyArray<readonly [GateName, (plan: WorkPlan, ctx: ClearContext) => Offense | null]> = [
  ["value", (p) => valueGate(p)],
  ["allocation", (p) => allocationGate(p)],
  ["bounds", (p, ctx) => boundsGate(p, ctx)],
  ["structural", (p) => structuralGate(p)],
];

/**
 * Clear a WorkPlan through the four value-ordered gates. Returns the FIRST gate's STOP (the andon
 * — the line stops, it does not accumulate findings or run later gates), or CLEAR if every gate
 * passes. Reporting the highest-priority defect is the feature: a plan that both advances nothing
 * (value) and is missing a field (structural) is reported as a VALUE failure.
 *
 * Throws (TypeError) only on programmer error — a non-object plan or non-string context. An
 * unworthy plan is never a throw; it is a returned STOP.
 */
export function clear(plan: WorkPlan, ctx: ClearContext): GateResult {
  assertPlan(plan);
  assertContext(ctx);
  for (const [gate, run] of GATES) {
    const offense = run(plan, ctx);
    if (offense) return { status: "stop", gate, unit: offense.unit, reason: offense.reason };
  }
  return { status: "clear", cleared: [...GATE_NAMES] };
}

/** Narrow a {@link GateResult} to a STOP — convenience for the runner's `if (isStop(r)) refuse`. */
export function isStop(r: GateResult): r is GateStop {
  return r.status === "stop";
}
