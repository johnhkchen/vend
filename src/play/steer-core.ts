// The SteerProject-lite play's PURE core (T-018-01, story S-018-01, epic E-018) — the play's testable
// judgment: the three steer gates (read-never-invent → fork-genuineness → leverage-rank) over a `Steer`
// (a ranked `Signal[]` board PLUS a `Fork[]`), and the pure fork renderer. The demand-extraction
// CAPSTONE one step UP from survey-core: where Survey clears the whole project into a ranked BOARD,
// SteerProject-lite clears it into a board AND the real FORKS — the handful of genuine decisions only a
// human can make.
//
// Split from the (T-018-02) impure steer shell for the house reason every play splits its core: the
// shell value-imports `b` from baml_client/sync_client, loading the BAML native addon whose once-driven
// reactor makes a `bun test` process flaky. Keeping the gates + renderer HERE — with the `Steer`/`Fork`/
// `Signal` imports TYPE-ONLY (erased under verbatimModuleSyntax) — lets steer-core.test.ts exercise all
// of it as an ordinary pure-function test, no addon ever loaded (the survey-core / expand-core / gates.ts
// discipline).
//
// TWO cross-core VALUE imports, both pure and both genuine SHARED CONTRACTS (not the util-coupling the
// no-shared-util idiom guards against): `renderSignalRow` from expand-core.ts (the demand.md row — steer
// writes the IDENTICAL board row Survey/Expand do) and `TIER_RANK` from survey-core.ts (the single source
// of the leverage ordinal — the same demand.md ranking). Both source modules are PURE (type-only BAML),
// so importing them keeps THIS module addon-free. The incidental `nonEmpty` predicate and the `tierRank`
// wrapper are COPIED per the no-shared-util idiom, exactly as survey-core copied `nonEmpty`.
//
// PURE: no fs, clock, network, process, or native addon. The gates judge an already-parsed Steer; a STOP
// is RETURNED DATA (an expected andon), never a throw — the gates.ts house rule (a programmer error
// throws; an unworthy board / a manufactured fork / a mis-ordered set is a returned STOP). The `tierRank`
// lookup is the one exception: an out-of-map tier member is enum/map DRIFT (a programmer error), so it
// throws RangeError exactly as survey-core.ts's `tierRank` does.
//
// THE TWO HONEST-EMPTY POLARITIES (note — steer has NO separate board honest-empty gate): the ticket
// enumerates exactly THREE gates and names `fork-genuineness` "the fork-side sibling of honest-empty," so
// the honest-empty role lives on the FORKS. The board's emptiness stays honest by construction — an empty
// `signals[]` passes all three gates (nothing ungrounded, nothing mis-ordered), the Survey abstention;
// and an empty `forks[]` is the CLEAR-PATH abstention fork-genuineness clears. Same IA-4 discipline, two
// containers.

import type { Signal, Fork, Steer } from "../../baml_client/index.ts";
import type { GateVerdict } from "../engine/play.ts";
import { renderSignalRow } from "./expand-core.ts";
import { TIER_RANK } from "./survey-core.ts";

// ── the gate set ──────────────────────────────────────────────────────────────────────────

/** The three steer gates, in value-priority order — the single source of ordering, encoding
 *  "is the board real? → are the forks real? → is the board leverage-ordered?". `clear()` runs them
 *  in this sequence and a CLEAR echoes it. The capstone sibling of SURVEY_GATE_NAMES: the new middle
 *  gate is `fork-genuineness` (the signature gate); the board's `read-never-invent`/`leverage-rank`
 *  mirror survey. There is NO board `honest-empty` gate — fork-genuineness carries that role (header). */
export const STEER_GATE_NAMES = ["read-never-invent", "fork-genuineness", "leverage-rank"] as const;
export type SteerGateName = (typeof STEER_GATE_NAMES)[number];

/** A fork is a real choice ⇒ it needs at least this many distinct options; fewer is not a trade-off. */
export const MIN_FORK_OPTIONS = 2;
/** A fork is a NARROWED decision ⇒ at most this many options; more is an un-narrowed menu, not a fork. */
export const MAX_FORK_OPTIONS = 4;

// ── tier member → leverage rank (leverage-rank support) ─────────────────────────────────────
// Reuse `TIER_RANK` from survey-core (the single source of the leverage ordering — the demand.md
// ranking is shared, not per-play). The tiny `tierRank` wrapper is COPIED per the no-shared-util idiom.

/** Map a tier member to its leverage ordinal, throwing on an unknown key — a programmer error meaning
 *  the BAML enum drifted from the shared map (the house rule: a wiring/drift error THROWS; it is never a
 *  silently-wrong ranking). Mirrors survey-core's `tierRank`. */
function tierRank(member: string): number {
  const r = TIER_RANK[member];
  if (r === undefined) {
    throw new RangeError(`leverageRankGate: no rank for tier member ${JSON.stringify(member)} (enum/map drift)`);
  }
  return r;
}

// ── pure helpers (self-contained, the no-shared-util idiom — copied, not shared) ────────────

/** A usable string field: present and non-blank after trimming (the survey-core/expand-core idiom). */
function nonEmpty(s: unknown): boolean {
  return typeof s === "string" && s.trim().length > 0;
}

// ── the three gates: (steer) => Offense | null ───────────────────────────────────────────────

/** One gate's finding: the offending unit + why, or `null` for "passed" (the survey-core shape). */
interface Offense {
  readonly unit: string;
  readonly reason: string;
}

/**
 * READ-NEVER-INVENT (PE-1/PE-2) — the first fixture, mirroring survey-core: was each board signal READ
 * off real state or INVENTED? The pure, decidable proxy is the citation: every signal's `grounding` must
 * name what it traces to (a file/doc, a TODO, a run-log fact). The FIRST signal with no grounding is
 * speculation — the garbage-factory the demand board exists to prevent — and the whole steer is refused
 * (the andon stops the line). An empty board passes (no candidates to check): the honest abstention. This
 * is PE-2 ("cite the source") as a poka-yoke, not a semantic oracle.
 */
function readNeverInventGate(steer: Steer): Offense | null {
  for (const signal of steer.signals) {
    if (!nonEmpty(signal.grounding)) {
      return {
        unit: nonEmpty(signal.what) ? signal.what : "<signal>",
        reason: "read-never-invent: a board candidate cites no real state in `grounding` — a speculative/invented signal is refused (PE-1)",
      };
    }
  }
  return null;
}

/**
 * FORK-GENUINENESS (the new SIGNATURE gate) — the fork-side sibling of honest-empty/read-never-invent.
 * A `Fork` must be a GENUINE trade-off the human must make; a fake/inconsequential choice is refused. An
 * EMPTY `forks[]` is VALID and correct — a clear path surfaces no forks ("never survey what you can just
 * choose"), so the gate PASSES on zero forks. A pure gate cannot judge semantic consequence, but it CAN
 * refuse the shapes that are provably NOT a real, framed decision — the poka-yoke, the fork analogue of
 * read-never-invent's "cite or be refused". The FIRST fork that fails any check → STOP. A fork is refused
 * when it is:
 *  - INCONSEQUENTIAL — a blank `question` (nothing to decide) or blank `whyItMatters` (no stakes named);
 *  - NOT A REAL CHOICE — fewer than {@link MIN_FORK_OPTIONS} *distinct, non-blank* options (a one-option
 *    or duplicate-option "fork" offers no trade-off);
 *  - OVER-FRAMED — more than {@link MAX_FORK_OPTIONS} options (an un-narrowed menu, not a decision);
 *  - UNFRAMED — a blank `recommendation` (Vend must frame the call recommendation-first; a naked choice
 *    pushes the articulation back onto the human — the very cost this play removes).
 */
function forkGenuinenessGate(steer: Steer): Offense | null {
  for (const fork of steer.forks) {
    const label = nonEmpty(fork.question) ? fork.question : "<fork>";
    if (!nonEmpty(fork.question) || !nonEmpty(fork.whyItMatters)) {
      return {
        unit: label,
        reason: "fork-genuineness: a fork names no decision/stakes (blank `question` or `whyItMatters`) — an inconsequential fork is refused; surface no fork when the path is clear",
      };
    }
    const options = Array.isArray(fork.options) ? fork.options : [];
    if (options.length > MAX_FORK_OPTIONS) {
      return {
        unit: label,
        reason: `fork-genuineness: ${options.length} options exceed the ${MAX_FORK_OPTIONS}-option bound — an un-narrowed menu is not a decision the human can assent to`,
      };
    }
    const distinct = new Set(options.filter(nonEmpty).map((o) => o.trim().toLowerCase()));
    if (distinct.size < MIN_FORK_OPTIONS) {
      return {
        unit: label,
        reason: `fork-genuineness: fewer than ${MIN_FORK_OPTIONS} distinct, real options — not a genuine trade-off (a manufactured/fake choice is refused)`,
      };
    }
    if (!nonEmpty(fork.recommendation)) {
      return {
        unit: label,
        reason: "fork-genuineness: no `recommendation` — Vend must frame the call recommendation-first; a naked choice pushes the articulation back onto the human",
      };
    }
  }
  return null;
}

/**
 * LEVERAGE-RANK — identical to survey-core: the board's ORDER is the ranking (keystone unblocks most →
 * leaf nothing), so the set must be non-increasing in leverage — every adjacent pair must have
 * rank(i) ≤ rank(i+1). The FIRST inversion (a higher-leverage signal placed AFTER a lower one) → STOP
 * naming the pair. Empty/single boards trivially pass; equal-tier ties are allowed (non-strict). The
 * gate REFUSES a mis-ordered board rather than silently SORTING it — sorting would hide that the model
 * mis-ranked (the no-mutation gate discipline); the visible andon is the point.
 */
function leverageRankGate(steer: Steer): Offense | null {
  const { signals } = steer;
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

/** The ordered gate table — names match `STEER_GATE_NAMES`, so the value-ordering is encoded once. */
const GATES: ReadonlyArray<readonly [SteerGateName, (steer: Steer) => Offense | null]> = [
  ["read-never-invent", readNeverInventGate],
  ["fork-genuineness", forkGenuinenessGate],
  ["leverage-rank", leverageRankGate],
];

/**
 * Clear a Steer through the three value-ordered steer gates. Returns the FIRST gate's STOP (the andon —
 * the line stops, it does not accumulate findings or run later gates), or a CLEAR echoing every gate name
 * (so the cast loop logs one passed row per gate, parity with Survey). Returns the engine's play-agnostic
 * `GateVerdict` so it drops straight into `Play.gates` at registration (T-018-02) with no adapter — the
 * gates need NO external context (the board gates read only tier order/grounding, the fork gate reads only
 * the forks), so the closure is simply `(steer) => clear(steer)`.
 *
 * An EMPTY steer (`{signals:[], forks:[]}`) CLEARS — the honest abstention on BOTH sides:
 * read-never-invent passes (no candidates), fork-genuineness passes (no forks = clear path), leverage-rank
 * passes (trivially ordered). A STOP is RETURNED DATA, never a throw — an expected andon is data, not an
 * exception (the gates.ts house rule).
 */
export function clear(steer: Steer): GateVerdict {
  for (const [gate, run] of GATES) {
    const offense = run(steer);
    if (offense) return { status: "stop", gate, unit: offense.unit, reason: offense.reason };
  }
  return { status: "clear", cleared: [...STEER_GATE_NAMES] };
}

// ── the fork renderer ───────────────────────────────────────────────────────────────────────

/**
 * Render one cleared Fork → a markdown block a human reads and assents to. PURE (the renderSignalRow
 * pattern, lifted to a fork): deterministic, no fs. The question is the heading; why-it-matters, the
 * ordered options, and the Vend recommendation follow. T-018-02's staging effect composes these under a
 * `## Forks` section (parity with survey-effect composing `renderBoard` for the board half). The board
 * half itself reuses `renderSignalRow` (the shared demand.md row), not re-rendered here.
 */
export function renderFork(fork: Fork): string {
  const options = fork.options.map((opt, i) => `  ${i + 1}. ${opt}`).join("\n");
  return [
    `### Fork — ${fork.question}`,
    `- **Why it matters:** ${fork.whyItMatters}`,
    `- **Options:**`,
    options,
    `- **Vend recommends:** ${fork.recommendation}`,
  ].join("\n");
}

/**
 * Render a set of cleared Forks → the joined fork blocks (one `renderFork` per fork, separated by a blank
 * line). An EMPTY list renders the empty string (the clear-path abstention carries no markup — the fork
 * analogue of `renderBoard`'s empty board → ""). PURE; the staging effect (T-018-02) wraps this under a
 * heading.
 */
export function renderForks(forks: readonly Fork[]): string {
  return forks.map(renderFork).join("\n\n");
}
