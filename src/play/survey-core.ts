// The Survey play's PURE core (T-017-01, story S-017-01, epic E-017) — the play's testable judgment:
// the three board gates (honest-empty → read-never-invent → leverage-rank) over a `Board` (a ranked
// `Signal[]`), plus the pure board renderer. The addon-free mirror of expand-core.ts's `clear` +
// `renderSignalRow`, ONE SCALE UP: where ExpandFragment clears one fragment into one SIGNAL, Survey
// reads the whole project and clears it into a ranked BOARD of signals for a human pull.
//
// Split from the (T-017-02) impure Survey shell for the house reason every play splits its core: the
// shell value-imports `b` from baml_client/sync_client, loading the BAML native addon whose once-driven
// reactor makes a `bun test` process flaky. Keeping the gates + renderer HERE — with the `Board`/`Signal`/
// `SignalTier` imports TYPE-ONLY (erased under verbatimModuleSyntax) — lets survey-core.test.ts exercise
// all of it as an ordinary pure-function test, no addon ever loaded (the expand-core / propose-core /
// gates.ts discipline).
//
// ONE cross-core VALUE import: `renderSignalRow` from expand-core.ts. The demand row is a genuine SHARED
// CONTRACT — both plays write the IDENTICAL row to the IDENTICAL demand.md — so reusing it is correct DRY,
// not the util-coupling the no-shared-util idiom guards against; and expand-core.ts is itself PURE
// (type-only BAML imports), so the import keeps THIS module addon-free. The incidental predicate
// (`nonEmpty`) is COPIED per the no-shared-util idiom, exactly as expand-core copied it from propose-core.
//
// PURE: no fs, clock, network, process, or native addon. The gates judge an already-parsed Board; a STOP
// is RETURNED DATA (an expected andon), never a throw — the gates.ts house rule (a programmer error
// throws; an unworthy/empty/mis-ordered board is a returned STOP). The `tierRank` lookup is the one
// exception: an out-of-map tier member is enum/map DRIFT (a programmer error), so it throws RangeError
// exactly as expand-core.ts's `aliasTier` does.
//
// THE EMPTY-BOARD POLARITY (note — it INVERTS from expand): in ExpandFragment a blank Signal IS the whole
// output, so blank → STOP (nothing to stage). In Survey the board IS the output, so an EMPTY board is the
// SUCCESS abstention (honest-empty CLEARS it), while a blank ENTRY among real ones is the dishonesty the
// honest-empty gate refuses. Same IA-4 discipline, inverted container.

import type { Board, Signal, SignalTier } from "../../baml_client/index.ts";
import type { GateVerdict } from "../engine/play.ts";
import { renderSignalRow } from "./expand-core.ts";

// ── the gate set ──────────────────────────────────────────────────────────────────────────

/** The three survey gates, in value-priority order — the single source of ordering, encoding
 *  "is the board honest? → is each candidate real? → is the set leverage-ordered?". `clear()` runs
 *  them in this sequence and a CLEAR echoes it. The board-scale sibling of EXPAND_GATE_NAMES; the
 *  third gate is `leverage-rank` (board ordering) where expand's third was `value-link`. */
export const SURVEY_GATE_NAMES = ["honest-empty", "read-never-invent", "leverage-rank"] as const;
export type SurveyGateName = (typeof SURVEY_GATE_NAMES)[number];

// ── tier member → leverage rank (leverage-rank support) ─────────────────────────────────────
// `b.parse` returns the enum MEMBER name ("Keystone"); leverage-rank needs an ORDINAL to compare
// adjacent signals. This map is the single source of the leverage ordering (keystone unblocks most → 0;
// leaf unblocks nothing → 3). NEW vs expand-core (which has only TIER_ALIAS for the row token).

export const TIER_RANK: Readonly<Record<string, number>> = {
  Keystone: 0,
  High: 1,
  Standard: 2,
  Leaf: 3,
};

/** Map a tier member to its leverage ordinal, throwing on an unknown key — a programmer error meaning
 *  the BAML enum drifted from this map (the house rule: a wiring/drift error THROWS; it is never a
 *  silently-wrong ranking). Mirrors expand-core's `aliasTier`. */
function tierRank(member: string): number {
  const r = TIER_RANK[member];
  if (r === undefined) {
    throw new RangeError(`leverageRankGate: no rank for tier member ${JSON.stringify(member)} (enum/map drift)`);
  }
  return r;
}

// ── pure helpers (self-contained, the no-shared-util idiom — copied, not shared) ────────────

/** A usable string field: present and non-blank after trimming (the expand-core/propose-core idiom). */
function nonEmpty(s: unknown): boolean {
  return typeof s === "string" && s.trim().length > 0;
}

// ── the three gates: (board) => Offense | null ───────────────────────────────────────────────

/** One gate's finding: the offending unit + why, or `null` for "passed" (the expand-core shape). */
interface Offense {
  readonly unit: string;
  readonly reason: string;
}

/**
 * HONEST-EMPTY (IA-4) — the first fixture: is the board HONEST about emptiness? An EMPTY board is the
 * model's correct ABSTENTION — the project grounds no demand gradient, so there is nothing to stage —
 * and it CLEARS (a board-stocker that fabricates demand is explicitly worse than none). What this gate
 * REFUSES is the dishonest non-empty: a board padded with a BLANK/filler signal (`what` AND `why` both
 * blank), which is manufactured busywork dressed as a stocked board (or an SAP-degraded partial entry).
 * Checked FIRST so an honest empty board reads as a clean abstention, never as a fabrication complaint.
 * Note the polarity INVERTS from expand's honest-empty (where the single blank Signal STOPs) — see the
 * module header.
 */
function honestEmptyGate(board: Board): Offense | null {
  for (const signal of board.signals) {
    if (!nonEmpty(signal.what) && !nonEmpty(signal.why)) {
      return {
        unit: "<board>",
        reason: "honest-empty: a blank/filler signal pads the board — abstain with an EMPTY board, never manufacture busywork (IA-4)",
      };
    }
  }
  return null;
}

/**
 * READ-NEVER-INVENT (PE-1/PE-2) — by here every signal has content (honest-empty passed), so the
 * question is whether each candidate was READ off real state or INVENTED. The pure, decidable proxy is
 * the citation: every signal's `grounding` must name what it traces to (a file/doc, a TODO, a run-log
 * fact). The FIRST candidate with content but no grounding is speculation — the garbage-factory the
 * demand board exists to prevent — and the whole board is refused (the andon stops the line). This is
 * PE-2 ("cite the source") as a poka-yoke, not a semantic oracle: a pure gate cannot verify groundedness
 * against the whole project, but it CAN refuse a board carrying a candidate that names nothing it read.
 */
function readNeverInventGate(board: Board): Offense | null {
  for (const signal of board.signals) {
    if (!nonEmpty(signal.grounding)) {
      return {
        unit: nonEmpty(signal.what) ? signal.what : "<signal>",
        reason: "read-never-invent: a candidate cites no real state in `grounding` — a speculative/invented signal is refused (PE-1)",
      };
    }
  }
  return null;
}

/**
 * LEVERAGE-RANK — the board's ORDER is the ranking (demand.md: keystone unblocks most → leaf nothing),
 * so the set must be in non-increasing leverage order: every adjacent pair must have
 * rank(i) ≤ rank(i+1). The FIRST inversion (a higher-leverage signal placed AFTER a lower one) → STOP
 * naming the pair. Empty/single boards trivially pass; equal-tier ties are allowed (non-strict). The
 * gate REFUSES a mis-ordered board rather than silently SORTING it — sorting would hide that the model
 * mis-ranked (the no-mutation gate discipline); the visible andon is the point. This replaces expand's
 * `value-link`: at board scale the new failure mode is mis-ordering, not a single dangling ref.
 */
function leverageRankGate(board: Board): Offense | null {
  const { signals } = board;
  for (let i = 0; i + 1 < signals.length; i++) {
    const hi = signals[i]!;
    const lo = signals[i + 1]!;
    if (tierRank(hi.tier) > tierRank(lo.tier)) {
      return {
        unit: `${hi.tier} after ${lo.tier}`,
        reason: `leverage-rank: '${hi.tier}' is placed after the higher-leverage '${lo.tier}' — the board must be ordered highest-leverage first`,
      };
    }
  }
  return null;
}

// ── the public clearing function ────────────────────────────────────────────────────────────

/** The ordered gate table — names match `SURVEY_GATE_NAMES`, so the value-ordering is encoded once. */
const GATES: ReadonlyArray<readonly [SurveyGateName, (board: Board) => Offense | null]> = [
  ["honest-empty", honestEmptyGate],
  ["read-never-invent", readNeverInventGate],
  ["leverage-rank", leverageRankGate],
];

/**
 * Clear a Board through the three value-ordered survey gates. Returns the FIRST gate's STOP (the andon —
 * the line stops, it does not accumulate findings or run later gates), or a CLEAR echoing every gate name
 * (so the cast loop logs one passed row per gate, parity with ExpandFragment). Returns the engine's
 * play-agnostic `GateVerdict` so it drops straight into `Play.gates` at registration (T-017-02) with no
 * adapter — the gates need NO external context (unlike expand's value-link, which greps the charter), so
 * the closure is simply `(board, _ctx) => clear(board)`.
 *
 * An EMPTY board CLEARS (the honest abstention): honest-empty passes (empty is honest), read-never-invent
 * passes (no candidates to check), leverage-rank passes (trivially ordered). A STOP is RETURNED DATA,
 * never a throw — an expected andon is data, not an exception (the gates.ts house rule).
 */
export function clear(board: Board): GateVerdict {
  for (const [gate, run] of GATES) {
    const offense = run(board);
    if (offense) return { status: "stop", gate, unit: offense.unit, reason: offense.reason };
  }
  return { status: "clear", cleared: [...SURVEY_GATE_NAMES] };
}

// ── the board renderer ────────────────────────────────────────────────────────────────────────

/**
 * Render a cleared Board → the demand-board body: one `demand.md` row per signal (reusing
 * expand-core's `renderSignalRow` — the shared row contract; see the module header), joined by newlines.
 * An EMPTY board renders the empty string (no rows — the honest abstention carries no markup). PURE
 * (the expand-core `renderSignalRow` pattern lifted to a set): deterministic, no fs. T-017-02's staging
 * effect calls this to write the staged board under the pm desk.
 *
 * Throws RangeError only on tier enum/alias drift (an out-of-map member), propagated from
 * `renderSignalRow` — a programmer error, never an unworthy-board outcome (the house rule).
 */
export function renderBoard(board: Board): string {
  return board.signals.map(renderSignalRow).join("\n");
}
