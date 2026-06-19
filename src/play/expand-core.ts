// The ExpandFragment play's PURE core (T-016-01, story S-016-01, epic E-016) — the play's
// testable judgment: the three demand-extraction gates (honest-empty → read-never-invent →
// value-link) over a Signal, plus the pure demand-row renderer. The addon-free mirror of
// propose-core.ts's `clear` + `renderCard`, one notch UPSTREAM: ExpandFragment clears a rough
// fragment into a board-ready SIGNAL, where ProposeEpic clears a pulled signal into an epic CARD.
//
// Split from the (T-016-02) impure ExpandFragment shell for the house reason every play splits
// its core: the shell value-imports `b` from baml_client/sync_client, loading the BAML native
// addon whose once-driven reactor makes a `bun test` process flaky (obs 20675/20702). Keeping the
// gates + renderer HERE — with the `Signal` and `GateVerdict` imports TYPE-ONLY (erased under
// verbatimModuleSyntax) — lets expand-core.test.ts exercise all of it as an ordinary pure-function
// test, no addon ever loaded (the propose-core / note-core / gates.ts discipline). This module has
// NO runtime import at all — it is the purest kind of core.
//
// PURE: no fs, clock, network, process, or native addon. The gates judge an already-parsed Signal;
// a STOP is RETURNED DATA (an expected andon), never a throw — the gates.ts house rule (a
// programmer error throws; an ungrounded/empty signal is a returned STOP). The renderer's
// `aliasTier` is the one exception: an out-of-map tier member is enum/map DRIFT (a programmer
// error), so it throws RangeError exactly as propose-core.ts's `alias` does.

import type { Signal } from "../../baml_client/index.ts";
import type { GateVerdict } from "../engine/play.ts";

// ── the gate set ──────────────────────────────────────────────────────────────────────────

/** The three expand gates, in value-priority order — the single source of ordering, encoding
 *  "is there anything? → is it real? → does it name its value?". `clear()` runs them in this
 *  sequence and a CLEAR echoes it. One notch up from propose-core's value/bounds/structural. */
export const EXPAND_GATE_NAMES = ["honest-empty", "read-never-invent", "value-link"] as const;
export type ExpandGateName = (typeof EXPAND_GATE_NAMES)[number];

/**
 * What the pure gates need beyond the signal. `charter` is greped at call time for the live
 * `P#`/`N#` ids (value-link), so the alignment is recomputed, never stored — retiring an
 * invariant makes a dangling `advances` ref a detectable defect (the propose-core / charter
 * discipline). No `existingEpicIds`: a signal mints no id (it is not an epic), so this is a
 * slimmed `ProposeClearContext`. T-016-02's `gates` closure passes `{ charter: ctx.inputs.charter }`.
 */
export interface ExpandClearContext {
  readonly charter: string;
}

// ── tier member → alias map (renderer support, the propose-core pattern) ────────────────────
// `b.parse` returns the enum MEMBER name ("Keystone"); the demand row wants the lowercase token
// the `@alias` in expand.baml fixes. This map is the single source of that mapping.

export const TIER_ALIAS: Readonly<Record<string, string>> = {
  Keystone: "keystone",
  High: "high",
  Standard: "standard",
  Leaf: "leaf",
};

/** Map a tier member through the alias table, throwing on an unknown key — a programmer error
 *  meaning the BAML enum drifted from this map (the propose-core house rule: a wiring/drift error
 *  THROWS; it is never a silently-wrong demand token). */
function aliasTier(member: string): string {
  const a = TIER_ALIAS[member];
  if (a === undefined) {
    throw new RangeError(`renderSignalRow: no alias for tier member ${JSON.stringify(member)} (enum/map drift)`);
  }
  return a;
}

// ── pure helpers (self-contained, the gates.ts discipline — no shared-util coupling) ────────

/** A usable string field: present and non-blank after trimming (the propose-core/note-core idiom). */
function nonEmpty(s: unknown): boolean {
  return typeof s === "string" && s.trim().length > 0;
}

/** Grep stable invariant/non-goal ids (`P1`, `N4`, …) out of a charter string — the propose-core
 *  `matchIds` discipline, so value-link derives its valid set from the LIVE charter at call time
 *  rather than a hardcoded list. */
function matchIds(text: string, prefix: "P" | "N"): Set<string> {
  const out = new Set<string>();
  for (const m of text.matchAll(new RegExp(`\\b${prefix}\\d+\\b`, "g"))) {
    if (m[0]) out.add(m[0]);
  }
  return out;
}

/** Render a list as a YAML flow array matching the demand notes (`[]` / `[P2]`), the propose-core
 *  `flowArray`. */
function flowArray(items: readonly string[]): string {
  return `[${items.join(", ")}]`;
}

/** Title-case a tier alias for the demand row's Value column (`keystone` → `Keystone`). */
function tierLabel(aliasToken: string): string {
  return aliasToken.charAt(0).toUpperCase() + aliasToken.slice(1);
}

// ── the three gates: (signal, ctx) => Offense | null ────────────────────────────────────────

/** One gate's finding: the offending unit + why, or `null` for "passed" (the propose-core shape). */
interface Offense {
  readonly unit: string;
  readonly reason: string;
}

/**
 * HONEST-EMPTY (IA-4) — the first fixture: is there a move at ALL? A Signal whose `what` AND `why`
 * are both blank is the model's ABSTENTION — the fragment closed no vision-distance, so there is
 * nothing to stage. This is a *successful refusal* (an honest empty board, not manufactured
 * busywork), surfaced as a STOP so the effect never runs and nothing materializes (P7: no partial).
 * Checked FIRST so an abstaining signal reads as "honest empty," never as a fabrication complaint.
 * Also catches the SAP-degraded empty Signal the play's parse closure (T-016-02) coerces a garbage
 * reply into — the note-core empty-degradation lesson, applied to a fragment.
 */
function honestEmptyGate(signal: Signal): Offense | null {
  if (!nonEmpty(signal.what) && !nonEmpty(signal.why)) {
    return {
      unit: "<fragment>",
      reason: "honest-empty: the fragment grounds no demand — nothing to stage, not manufactured busywork (IA-4)",
    };
  }
  return null;
}

/**
 * READ-NEVER-INVENT (PE-1/PE-2) — by here `what`/`why` are non-blank (content exists), so the
 * question is whether that content was READ off real state or INVENTED. The pure, decidable proxy
 * is the citation: `grounding` must name what the signal traces to (a fragment phrase, a file/doc,
 * a run-log fact). A stated move with no grounding is speculation — the garbage-factory the demand
 * board exists to prevent — and is refused. This is PE-2 ("cite the source") as a poka-yoke, not a
 * semantic oracle: a pure gate cannot verify groundedness against the whole project, but it CAN
 * refuse a signal that names nothing it read.
 */
function readNeverInventGate(signal: Signal): Offense | null {
  if (!nonEmpty(signal.grounding)) {
    return {
      unit: nonEmpty(signal.what) ? signal.what : "<signal>",
      reason: "read-never-invent: the signal cites no real state in `grounding` — a speculative/invented signal is refused (PE-1)",
    };
  }
  return null;
}

/**
 * VALUE-LINK (PE-3/PE-4) — the signal must name a REAL value it serves. `advances` must be present
 * and non-empty (it names SOMETHING), and each grep-able entry must actually hold against the LIVE
 * charter — an entry naming a non-goal (`N\d+`) is incoherent (you cannot *advance* a non-goal),
 * and a `P\d+`-shaped entry absent from THIS charter is a dangling ref. Free-text entries
 * (core-feature prose, no grep-able id) are human-judgment territory and are not failed by rule —
 * the propose-core `boundsGate` rule, folded into value-link so it means "links to a real value,"
 * not merely "non-empty."
 */
function valueLinkGate(signal: Signal, ctx: ExpandClearContext): Offense | null {
  if (!Array.isArray(signal.advances) || signal.advances.length === 0 || !signal.advances.every(nonEmpty)) {
    return {
      unit: nonEmpty(signal.what) ? signal.what : "<signal>",
      reason: "value-link: `advances` is empty — the signal must name the invariant or core-feature advance it serves (PE-3)",
    };
  }
  const invariants = matchIds(ctx.charter, "P");
  const nonGoals = matchIds(ctx.charter, "N");
  for (const claim of signal.advances) {
    const ref = claim.trim();
    if (/^N\d+$/.test(ref) || nonGoals.has(ref)) {
      return { unit: ref, reason: `value-link: advances \`${ref}\` — cannot advance a non-goal (PE-5)` };
    }
    if (/^P\d+$/.test(ref) && !invariants.has(ref)) {
      return { unit: ref, reason: `value-link: advances \`${ref}\` — no such invariant in the charter (dangling ref)` };
    }
  }
  return null;
}

// ── the public clearing function ────────────────────────────────────────────────────────────

/** The ordered gate table — names match `EXPAND_GATE_NAMES`, so the value-ordering is encoded once. */
const GATES: ReadonlyArray<readonly [ExpandGateName, (signal: Signal, ctx: ExpandClearContext) => Offense | null]> = [
  ["honest-empty", (s) => honestEmptyGate(s)],
  ["read-never-invent", (s) => readNeverInventGate(s)],
  ["value-link", (s, ctx) => valueLinkGate(s, ctx)],
];

/**
 * Clear a Signal through the three value-ordered expand gates. Returns the FIRST gate's STOP (the
 * andon — the line stops, it does not accumulate findings or run later gates), or a CLEAR echoing
 * every gate name (so the cast loop logs one passed row per gate, parity with ProposeEpic). Returns
 * the engine's play-agnostic `GateVerdict` so it drops straight into `Play.gates` at registration
 * (T-016-02) with no adapter, exactly as propose-core's `clear` does.
 *
 * Reporting the highest-priority finding is the feature: an empty signal that is also ungrounded is
 * reported as HONEST-EMPTY (the honest abstention), not a speculation complaint. A STOP is RETURNED
 * DATA, never a throw — an expected andon is data, not an exception (the gates.ts house rule).
 */
export function clear(signal: Signal, ctx: ExpandClearContext): GateVerdict {
  for (const [gate, run] of GATES) {
    const offense = run(signal, ctx);
    if (offense) return { status: "stop", gate, unit: offense.unit, reason: offense.reason };
  }
  return { status: "clear", cleared: [...EXPAND_GATE_NAMES] };
}

// ── the demand-row renderer ───────────────────────────────────────────────────────────────────

/**
 * Render a cleared Signal → one `demand.md` table row (`| Signal | Value | Budget | Status |`).
 * PURE (the propose-core `renderCard` / note-core `renderNoteFile` pattern): tier member→alias
 * mapping, deterministic output. The row carries `what — why` (the signal cell), the title-cased
 * tier (the value cell), the pre-filled `budget`, and `readiness` (the status cell); a trailing
 * note round-trips `advances` and `grounding` so the markdown carries every Signal field (the test
 * pins this). T-016-02's staging effect calls this to write the staged signal under the pm desk.
 *
 * Throws RangeError only on tier enum/alias drift (an out-of-map member) — a programmer error,
 * never an unworthy-signal outcome (the propose-core rule).
 */
export function renderSignalRow(signal: Signal): string {
  const tier = tierLabel(aliasTier(signal.tier));
  const note = `advances ${flowArray(signal.advances)} · grounded in ${signal.grounding}`;
  return `| **${signal.what}** — ${signal.why} | **${tier}** | ${signal.budget} | ${signal.readiness} (${note}) |`;
}
