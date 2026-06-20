// The walk-away audit (T-014-01, E-014 PRD KR1–KR2) — the E1 / TRUST arm of the Trust &
// Consistency Evidence Gate. Where `recalibrate.ts` proposes a play's ENVELOPE from its
// measured cost history, this reads the SAME ledger for a different question: can the author
// walk away and let it run? It surfaces four numbers over a run-log slice —
//
//   1. ANDON-RATE vs the IA-12 budget   — the stop rate against the tier's tolerable setpoint
//      (an SRE error budget). "An andon rate AT budget is the gates working, not a defect; a
//      0% rate is suspicious, not ideal" (IA-10/12). We read it, never red-flag it.
//   2. OUTCOME MIX                       — counts per terminal state, with the censored subset
//      (budget-exhausted + timed-out, IA-13) and the success count called out.
//   3. COST-vs-ENVELOPE                  — median actual/allocated ratio (tokens & time) over
//      successful runs that carry an envelope; how close runs ran to their ceiling.
//   4. INTERVENTION RATE + TREND         — over records carrying the `intervened` bit (T-014-01):
//      the walk-away rate and whether it trends toward zero (the A2 trust signal, PRD KR2).
//
// PURE (house pattern, mirrors recalibrate.ts / budget.ts): every export takes plain records
// and returns fresh values — no fs, clock, network, or process. The one fs touch (load the
// ledger) is the existing `loadRunLog`; the cli shell composes them. Imports are TYPE-ONLY
// (`ValueTier`) plus run-log's PURE record helpers, so the zero-coupling discipline holds and
// nothing imports this module back (a leaf consumer, like recalibrate).

import { forPlay, totalTokens, wallClockMs, RUN_OUTCOMES, type RunOutcome, type RunRecord } from "../log/run-log.ts";
import { DEFAULT_WINDOW } from "./recalibrate.ts";
import type { ValueTier } from "../shelf/menu.ts";

/**
 * The andon BUDGET each value tier tolerates (IA-12, the % side of the same principle
 * `TIER_PERCENTILE` is the percentile side of): the tolerable stop rate, an SRE error budget.
 * Work that matters tolerates fewer stops (Keystone ~5%); leaf work tolerates the most (~25%).
 * `high` is interpolated between keystone and standard, mirroring how `recalibrate` placed
 * `high` at p92. Value sets the budget; the observed rate is read against it.
 */
export const TIER_ANDON_BUDGET: Record<ValueTier, number> = {
  keystone: 0.05,
  high: 0.08,
  standard: 0.1,
  leaf: 0.25,
};

/** The andon'd-at-envelope outcomes (IA-13): a token wall (`budget-exhausted`) or a wall-clock
 *  wall (`timed-out`). Right-censored — their true cost is `≥` the envelope. The COST subset
 *  excluded from ratios; called out in the mix. (The ANDON rate is broader — any non-success
 *  stop — because IA-12's budget governs the whole stop rate, not just envelope censorings.) */
const CENSORED_OUTCOMES: readonly RunOutcome[] = ["budget-exhausted", "timed-out"];

/** Per-outcome counts (every {@link RunOutcome} keyed, seeded 0 so the mix is total), plus the
 *  three derived roll-ups the findings note reads: total runs, successes, censored subset. */
export type OutcomeMix = Record<RunOutcome, number> & {
  readonly total: number;
  readonly success: number;
  readonly censored: number;
};

/** Cost actuals vs the allocated envelope: the MEDIAN actual/allocated ratio per dimension
 *  (`< 1` ⇒ ran under ceiling; `~1` ⇒ ran to the wall), or `null` when no usable pair. `n` is
 *  the token-pair sample size (the headline; the time sample may be smaller). */
export interface CostVsEnvelope {
  readonly tokens: number | null;
  readonly timeMs: number | null;
  readonly n: number;
}

/** The intervention signal (A2): the walk-away rate over records that CARRY the bit, kept
 *  distinct from `total` so "N runs but only M self-reports" stays honest (KR1 needs ≥10
 *  reports). `trend` splits the reported records in half so the surface can show "→ 0". */
export interface InterventionStat {
  /** Records in scope carrying the `intervened` bit (the self-report sample). */
  readonly reported: number;
  /** Of those, how many the author stepped into (`intervened === true`). */
  readonly intervened: number;
  /** `intervened / reported`, or `null` when nothing was reported (never a fabricated 0). */
  readonly rate: number | null;
  /** The rate over the earlier vs the recent half of the reported records (each `null` when
   *  its half is empty) — the → 0 trend the target (PRD KR2) is read against. */
  readonly trend: { readonly earlier: number | null; readonly recent: number | null };
  /** FORWARD (live) sub-reading (T-028-01): the self-reports captured at run time — NOT attested
   *  back-fill. This is the road a verdict cites; E-026's over-claim came from it being merged
   *  with the attested pool. Always a sub-stat (its `reported` may be 0). */
  readonly forward: InterventionSubStat;
  /** ATTESTED back-fill sub-reading (T-028-01): the self-reports a human attested post-hoc
   *  (carrying the `intervenedAttestation` marker). Real evidence, but a different KIND than
   *  forward — kept distinct so the two are never conflated again. */
  readonly attested: InterventionSubStat;
}

/** One provenance slice of the intervention sample (T-028-01) — the same three numbers as the
 *  combined stat, with no trend (trend is a single combined-series read; per-split halving would
 *  invite mis-citation). `reported` may be 0, in which case `rate` is `null`, never a fabricated 0. */
export interface InterventionSubStat {
  /** Self-reports in this provenance partition. */
  readonly reported: number;
  /** Of those, how many were intervened (`intervened === true`). */
  readonly intervened: number;
  /** `intervened / reported`, or `null` when this partition is empty. */
  readonly rate: number | null;
}

/** The full E1 trust readout over a run-log slice. */
export interface WalkAwayReport {
  /** Runs in scope after the play filter + window. */
  readonly total: number;
  /** The play the slice was filtered to, or `null` for all plays. */
  readonly play: string | null;
  /** The tier whose andon budget the rate was read against. */
  readonly tier: ValueTier;
  /** Non-success stops ÷ total (IA-12 stop rate). 0 when there are no runs. */
  readonly andonRate: number;
  /** The tier's tolerable stop rate ({@link TIER_ANDON_BUDGET}). */
  readonly andonBudget: number;
  /** `andonRate <= andonBudget` — the gates working within budget (IA-10/12), not a pass/fail. */
  readonly withinBudget: boolean;
  readonly outcomeMix: OutcomeMix;
  readonly cost: CostVsEnvelope;
  readonly intervention: InterventionStat;
}

/** Knobs for {@link auditWalkAway}; all optional. */
export interface AuditOptions {
  /** Restrict to one play (absent ⇒ every play in the slice). */
  readonly play?: string;
  /** The tier whose andon budget to read against; default `standard` (10%). */
  readonly tier?: ValueTier;
  /** Recency window — at most the last N records of the (optionally play-filtered) slice;
   *  default {@link DEFAULT_WINDOW}. */
  readonly window?: number;
}

/** The TRUE median of an ASCENDING-SORTED sample, or `null` when empty. PURE. (Same central-
 *  tendency choice as recalibrate's bias factor — robust, one outlier cannot drag it.) */
function medianOrNull(sortedAsc: readonly number[]): number | null {
  const n = sortedAsc.length;
  if (n === 0) return null;
  const mid = Math.floor(n / 2);
  return n % 2 === 1 ? sortedAsc[mid]! : (sortedAsc[mid - 1]! + sortedAsc[mid]!) / 2;
}

/** The fraction of `true` over a boolean sample, or `null` when empty. PURE. */
function rateOrNull(bits: readonly boolean[]): number | null {
  if (bits.length === 0) return null;
  return bits.filter(Boolean).length / bits.length;
}

/** Reduce a provenance partition of reported records to its {@link InterventionSubStat} (T-028-01).
 *  PURE. Every record passed already carries the `intervened` bit (the caller filters first), so
 *  `reported` is just the length and the rate reuses {@link rateOrNull} — an empty partition ⇒
 *  `rate: null`, never a fabricated 0. */
function subStat(records: readonly RunRecord[]): InterventionSubStat {
  const bits = records.map((r) => r.intervened as boolean);
  return { reported: bits.length, intervened: bits.filter(Boolean).length, rate: rateOrNull(bits) };
}

/**
 * Audit a run-log slice for the E1 trust numbers. PURE. Optionally filters to one play and
 * windows to the most recent `window` records (the ledger is append-ordered, so the tail is
 * the recent horizon), then computes the four blocks. Degrades on thin/empty data: an empty
 * slice yields a zero mix, `andonRate: 0`, `cost`/`intervention` nulls — never a throw, never
 * a fabricated rate. Tolerates records with AND without `intervened` (only the carriers count
 * toward the intervention sample).
 */
export function auditWalkAway(records: readonly RunRecord[], opts: AuditOptions = {}): WalkAwayReport {
  const tier = opts.tier ?? "standard";
  const window = opts.window ?? DEFAULT_WINDOW;
  const scope = (opts.play ? forPlay(records, opts.play) : records).slice(-window);
  const total = scope.length;

  // Outcome mix: seed every known outcome to 0 so the mix is total, then count.
  const counts = Object.fromEntries(RUN_OUTCOMES.map((o) => [o, 0])) as Record<RunOutcome, number>;
  for (const r of scope) counts[r.outcome]++;
  const success = counts.success;
  const censored = CENSORED_OUTCOMES.reduce((s, o) => s + counts[o], 0);
  const outcomeMix: OutcomeMix = { ...counts, total, success, censored };

  // Andon rate: any non-success stop ÷ total (IA-12 stop rate), read against the tier budget.
  const andonRate = total === 0 ? 0 : (total - success) / total;
  const andonBudget = TIER_ANDON_BUDGET[tier];

  // Cost vs envelope: median actual/allocated over successes that carry an envelope (IA-13 —
  // censored runs have no observed cost, an envelope-less run has no known allocation).
  const tokenRatios: number[] = [];
  const timeRatios: number[] = [];
  for (const r of scope) {
    if (r.outcome !== "success" || r.envelope === undefined || r.envelope.tokens <= 0) continue;
    tokenRatios.push(totalTokens(r) / r.envelope.tokens);
    const ms = wallClockMs(r);
    if (ms !== null && r.envelope.timeMs > 0) timeRatios.push(ms / r.envelope.timeMs);
  }
  const cost: CostVsEnvelope = {
    tokens: medianOrNull(tokenRatios.sort((a, b) => a - b)),
    timeMs: medianOrNull(timeRatios.sort((a, b) => a - b)),
    n: tokenRatios.length,
  };

  // Intervention: over records carrying the bit only (absence = unknown, excluded). Trend
  // splits those reports in half (earlier = first ⌊n/2⌋, recent = the rest) — the → 0 signal.
  const reportedRecs = scope.filter((r) => r.intervened !== undefined);
  const reportedBits = reportedRecs.map((r) => r.intervened as boolean);
  const half = Math.floor(reportedBits.length / 2);
  // Provenance split (T-028-01): partition the reported records on `intervenedAttested`. Forward
  // = the live instrument (the road a verdict cites); attested = post-hoc back-fill. The combined
  // numbers above are UNCHANGED (back-compat) — this is additive disaggregation, not a redefinition.
  const intervention: InterventionStat = {
    reported: reportedBits.length,
    intervened: reportedBits.filter(Boolean).length,
    rate: rateOrNull(reportedBits),
    trend: { earlier: rateOrNull(reportedBits.slice(0, half)), recent: rateOrNull(reportedBits.slice(half)) },
    forward: subStat(reportedRecs.filter((r) => r.intervenedAttested !== true)),
    attested: subStat(reportedRecs.filter((r) => r.intervenedAttested === true)),
  };

  return { total, play: opts.play ?? null, tier, andonRate, andonBudget, withinBudget: andonRate <= andonBudget, outcomeMix, cost, intervention };
}

/** Render a 0..1 rate as a whole-number percent, or an em-dash when `null`. PURE. The shared
 *  Home/`vend audit` rounding seam (T-031-01): `homeLedgerLine` (`src/shelf/home.ts`) reuses this
 *  so the DL-6 foot and the DL-8 readout can never round a trust percent differently. */
export function pct(r: number | null): string {
  return r === null ? "—" : `${Math.round(r * 100)}%`;
}

/** Render a ratio to 2dp with a `×` prefix, or an em-dash when `null`. PURE. */
function ratio(r: number | null): string {
  return r === null ? "—" : `×${r.toFixed(2)}`;
}

/** Render one provenance sub-stat (T-028-01) as its WALK-AWAY reading (`1 − intervention rate`),
 *  with the untouched/reported fraction. "none yet" when the partition is empty — an honest label
 *  (IA-8), never a fabricated 0%. PURE. */
function subWalk(s: InterventionSubStat): string {
  if (s.reported === 0) return "none yet";
  const walkAway = s.rate === null ? null : 1 - s.rate;
  return `${pct(walkAway)} (${s.reported - s.intervened}/${s.reported} untouched)`;
}

/**
 * Render a {@link WalkAwayReport} as the E1 FINDINGS FRAGMENT (T-014-01 AC #3) — the trust
 * numbers block T-014-03's findings note quotes. PURE. Honest labels (IA-8): "no self-reports
 * yet" when nothing carried the bit, "no envelope data" when no cost pair — a guess never reads
 * as an earned number. The walk-away rate is `1 − intervention rate` (finished untouched).
 */
export function formatWalkAwayFindings(report: WalkAwayReport): string {
  const scope = report.play ?? "all plays";
  const m = report.outcomeMix;
  const iv = report.intervention;

  const lines: string[] = [];
  lines.push(`E1 — walk-away trust · ${scope} · ${report.total} run${report.total === 1 ? "" : "s"} [${report.tier}]`);

  if (iv.reported === 0) {
    lines.push(`  walk-away rate: no self-reports yet (${report.total} runs, intervention bit unrecorded)`);
  } else {
    const walkAway = iv.rate === null ? null : 1 - iv.rate;
    const trendWalk = (r: number | null) => (r === null ? "—" : pct(1 - r));
    lines.push(
      `  walk-away rate: ${pct(walkAway)} (${iv.reported - iv.intervened}/${iv.reported} ran untouched)` +
        ` · trend ${trendWalk(iv.trend.earlier)} → ${trendWalk(iv.trend.recent)} (target → 100%)`,
    );
    // Provenance split (T-028-01): the combined rate above pools two different KINDS of evidence —
    // forward (live) self-reports and attested back-fill. A verdict cites the FORWARD count; this
    // sub-line keeps them legible so attested back-fill is never mistaken for the live instrument.
    lines.push(`    └ forward (live): ${subWalk(iv.forward)} · attested back-fill: ${subWalk(iv.attested)}`);
  }

  const budgetMark = report.withinBudget ? "✓ within" : "⚠ over";
  lines.push(`  andon rate: ${pct(report.andonRate)} vs ${pct(report.andonBudget)} budget — ${budgetMark} (gates working, not defects)`);
  lines.push(
    `  outcome mix: ${m.success} success · ${m.censored} censored (budget/timeout) · ${m["gate-failed"]} gate-failed · ${m["id-collision"]} id-collision`,
  );
  if (cost_has(report)) {
    lines.push(`  cost vs envelope: tokens ${ratio(report.cost.tokens)} · time ${ratio(report.cost.timeMs)} (median over ${report.cost.n} successful run${report.cost.n === 1 ? "" : "s"})`);
  } else {
    lines.push(`  cost vs envelope: no envelope data`);
  }
  return lines.join("\n");
}

/** True when the report has at least one cost-vs-envelope pair to show. PURE (cosmetic). */
function cost_has(report: WalkAwayReport): boolean {
  return report.cost.n > 0;
}
