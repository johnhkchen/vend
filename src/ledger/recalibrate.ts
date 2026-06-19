// The Ledger's recalibration core (T-013-02) — measured envelopes from a play's own
// past (IA-12/IA-13). Cast a play, and its envelope is *proposed from its measured
// history*: bound a play's cost — tokens AND wall-clock, independently — at the
// VALUE-TIER percentile over its SUCCESSFUL runs, and report that bound's CONFIDENCE
// (how many successes fed it, how many andon'd-at-envelope runs were censored).
//
// THE THREE PRINCIPLES MADE CODE:
//   IA-12 — value picks the percentile; data provides the value at it. The tier sets an
//           andon budget (Keystone ~5% → p95, Leaf ~25% → p75); the percentile of
//           measured cost is what SPENDS that budget.
//   IA-13 — bound the fat tail from SUCCESSES (what finishing actually costs), never
//           mean+stddev; andon'd runs are right-CENSORED at the envelope (`≥ envelope`
//           lower bounds) — excluded from the percentile sample but COUNTED, because the
//           censored rate is itself the signal. This slice READS that rate into the
//           confidence; it does not yet ACTUATE on it (IA-14 — auto-widen/slow-tighten —
//           is a later rung).
//   cold-start — below a handful of successes the percentile is noise; fall back to the
//           hand prior, labelled honestly.
//
// PURE (house pattern, mirrors budget.ts / cast-core.ts / press-core.ts): every export
// takes plain values and returns fresh ones — no fs, clock, network, or process. The one
// fs touch (load the ledger) is the existing `loadRunLog`; the cli shell composes them.
// Imports are TYPE-ONLY (`Budget`, `ValueTier` — erased) plus run-log's PURE record
// helpers (`forPlay`/`totalTokens`/`wallClockMs` operate on records, never fs), so the
// zero-coupling discipline (run-log ⊥ budget) holds: the Ledger is the consumer where
// the two leaves meet, and nothing imports the Ledger back.

import { forPlay, totalTokens, wallClockMs, type RunOutcome, type RunRecord } from "../log/run-log.ts";
import type { Budget } from "../budget/budget.ts";
import type { ValueTier } from "../shelf/menu.ts";

/**
 * The percentile each value tier spends its andon budget at (IA-12). Keystone work
 * tolerates the fewest stops (~5%) so it bounds at the fattest tail (p95); Leaf tolerates
 * the most (~25%) so it bounds tighter (p75). `high` is placed at p92 — interpolating
 * IA-12's andon-budget ladder between keystone and standard (the ticket names three
 * tiers; the board carries four). Value picks the percentile; data provides the value.
 */
export const TIER_PERCENTILE: Record<ValueTier, number> = {
  keystone: 0.95,
  high: 0.92,
  standard: 0.9,
  leaf: 0.75,
};

/** Below this many successful runs, the percentile is noise — fall back to the hand
 *  prior (IA-13 cold start; "a handful"). Overridable per call. */
export const COLD_START_MIN_SUCCESSES = 3;

/** Default recency window: the percentile is computed over at most the last N records of
 *  the play (IA-13 "weight recent runs more", in its minimal honest form — a hard window,
 *  not yet exponential decay, which is IA-14's drift actuation). Overridable per call. */
export const DEFAULT_WINDOW = 100;

/** The andon'd-at-envelope outcomes (IA-13): a token wall (`budget-exhausted`) or a
 *  wall-clock wall (`timed-out`). These are right-censored — their true cost is `≥`
 *  the envelope, never observed — so they are excluded from the percentile but counted.
 *  `gate-failed` / `id-collision` are NEITHER (a refusal is not a finishing-cost
 *  observation, nor an envelope censoring), so they fall out of both. */
const CENSORED_OUTCOMES: readonly RunOutcome[] = ["budget-exhausted", "timed-out"];

/** How trustworthy the returned envelope is: the sample size that produced it, the
 *  censored (andon'd) count alongside it, and the percentile it was bound at. */
export interface Confidence {
  /** Successful runs in the window — the sample the percentile was computed over. */
  readonly successes: number;
  /** Andon'd-at-envelope runs in the window (right-censored lower bounds) — counted,
   *  never averaged in. The andon-rate signal (IA-15), surfaced not swallowed. */
  readonly censored: number;
  /** The tier percentile the envelope was bound at (e.g. 0.95), echoed for the label. */
  readonly percentile: number;
}

/** The proposed envelope plus its confidence and provenance. `source: "prior"` means the
 *  cold-start fallback fired (too few successes) and `envelope` IS the hand prior. */
export interface RecalibrateResult {
  readonly envelope: Budget;
  readonly confidence: Confidence;
  readonly source: "measured" | "prior";
}

/** Knobs for {@link recalibrate}; both default to the module constants. */
export interface RecalibrateOptions {
  /** Cold-start threshold; default {@link COLD_START_MIN_SUCCESSES}. */
  readonly minSuccesses?: number;
  /** Recency window size; default {@link DEFAULT_WINDOW}. */
  readonly window?: number;
}

/** Coerce a percentile value to a valid budget dimension: a positive integer (budget's
 *  `assertPositiveInt` contract). `ceil` keeps the bound conservative — we never round a
 *  tail estimate DOWN past an observed cost — and `max(1, …)` guarantees positivity so a
 *  measured envelope can be handed straight to a real run. */
function positiveInt(n: number): number {
  return Math.max(1, Math.ceil(n));
}

/**
 * The exact percentile of an ASCENDING-SORTED, NON-EMPTY sample by the nearest-rank
 * (ceil) method: `index = clamp(ceil(p·n) − 1, 0, n−1)`. PURE. NOT t-digest — an exact
 * read of the real sample (the log is small; ship the smaller real thing). Nearest-rank
 * is deliberately CONSERVATIVE on small n: p95 of n=10 → the max observed, never an
 * interpolated value below it — because the andon budget already caps how much tail we
 * can ever see (IA-13), so erring high is correct when bounding a fat tail.
 *
 * PRECONDITION (caller-guaranteed): `sortedAsc` is sorted ascending and non-empty;
 * `p ∈ [0, 1]`. {@link recalibrate} guards both (cold-start handles the empty case).
 */
export function percentile(sortedAsc: readonly number[], p: number): number {
  const n = sortedAsc.length;
  const idx = Math.min(n - 1, Math.max(0, Math.ceil(p * n) - 1));
  return sortedAsc[idx]!;
}

/**
 * Propose a play's envelope from its measured past. PURE. Filters `records` to `play`,
 * windows to the most recent `window`, then bounds tokens and wall-clock INDEPENDENTLY
 * at the tier percentile over the SUCCESSFUL runs — censored (andon'd) runs are counted
 * but never averaged in (IA-13). Below `minSuccesses` successes it returns the `prior`
 * verbatim (cold start), still reporting the real counts so the surface can label it
 * honestly. `prior` is passed in (not imported) so this core stays type-only and never
 * redefines budget policy — the caller owns the hand prior (`budgetForTier`).
 */
export function recalibrate(
  play: string,
  records: readonly RunRecord[],
  tier: ValueTier,
  prior: Budget,
  opts: RecalibrateOptions = {},
): RecalibrateResult {
  const p = TIER_PERCENTILE[tier];
  const window = opts.window ?? DEFAULT_WINDOW;
  const minSuccesses = opts.minSuccesses ?? COLD_START_MIN_SUCCESSES;

  // This play's records, most-recent `window` only (the ledger is append-ordered, so the
  // tail is the recent horizon), then split: successes feed the percentile; censored runs
  // are counted as the andon-rate signal over the SAME window.
  const windowed = forPlay(records, play).slice(-window);
  const successes = windowed.filter((r) => r.outcome === "success");
  const censored = windowed.filter((r) => CENSORED_OUTCOMES.includes(r.outcome)).length;
  const confidence: Confidence = { successes: successes.length, censored, percentile: p };

  // Cold start: too few successes to bound a tail — hand back the prior, honestly tagged.
  if (successes.length < minSuccesses) {
    return { envelope: prior, confidence, source: "prior" };
  }

  // Two independent samples from the same success set (AC: tokens & wall-clock bounded
  // separately). Wall-clock can be null (unparseable stamps) → that record drops from the
  // TIME sample only; its tokens still count. Sorts are on fresh mapped arrays (the
  // records are frozen and never mutated).
  const tokensAsc = successes.map(totalTokens).sort((a, b) => a - b);
  const timesAsc = successes
    .map(wallClockMs)
    .filter((ms): ms is number => ms !== null)
    .sort((a, b) => a - b);

  const tokens = positiveInt(percentile(tokensAsc, p));
  // If every success had unparseable stamps the time sample is empty — keep the prior's
  // time dimension rather than invent one, while tokens stays measured.
  const timeMs = timesAsc.length > 0 ? positiveInt(percentile(timesAsc, p)) : prior.timeMs;

  return { envelope: { timeMs, tokens }, confidence, source: "measured" };
}

/**
 * Render a {@link RecalibrateResult} as an honest one-line confidence label (IA-8 — the
 * meter must not lie). PURE. A measured envelope reads "measured · N casts · pXX" (with a
 * "· K andon'd" tail when the window saw censored runs — the andon-rate is not hidden,
 * IA-10/IA-15); a cold-start fallback reads "estimate (no data)" or "estimate (N casts)"
 * so the user can never mistake a guessed default for an earned one.
 */
export function formatEnvelopeLabel(result: RecalibrateResult): string {
  const { successes, censored, percentile: p } = result.confidence;
  if (result.source === "measured") {
    const andon = censored > 0 ? ` · ${censored} andon'd` : "";
    return `measured · ${successes} casts · p${Math.round(p * 100)}${andon}`;
  }
  return successes === 0 ? "estimate (no data)" : `estimate (${successes} casts)`;
}
