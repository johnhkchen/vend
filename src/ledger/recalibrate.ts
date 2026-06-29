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

import { forPlay, projectOf, totalTokens, wallClockMs, type RunOutcome, type RunRecord } from "../log/run-log.ts";
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

// ── Measurement-funding headroom (T-050-01, IA-14) ──────────────────────────────────────
// The GUARD a cast is RUN under, distinct from the PRICE the shelf QUOTES. `recalibrate`
// bounds a play's cost at the tier percentile over its SUCCESSFUL runs and right-censors
// andon'd runs OUT of that sample (IA-13, correct — their true cost is only a lower bound).
// But handing that thin percentile (or, cold-start, the hand prior) straight back as the
// FUNDING envelope is the censoring ratchet: an under-bounding prior censors the run, the
// censored run feeds nothing back, and the next run is funded at the same thin guess and
// censors again. `recalibrate` (above) READS the censored rate into `confidence` but does
// not ACTUATE on it (the IA-14 deferral). `fundingEnvelope` actuates it — the TOKEN analogue
// of budget.ts's `timeoutMsFor`/`TIMEOUT_HEADROOM`, generalized over BOTH dimensions: when a
// play is under-calibrated, fund it at `max(price, maxCensoredActual × headroom)` so the run
// clears every observed wall, FINISHES, and lands a success the percentile can finally bind to.
//
// GUARD ≠ PRICE (IA-8, charter P7): this NEVER mutates `recalibrate`'s returned `envelope`,
// the percentile math, or `formatEnvelopeLabel` — the quoted estimate stays the honest p90.
// The headroom is a bounded (finite, ≥2) runaway-tolerant funding floor, exactly as
// `TIMEOUT_HEADROOM` is for the wall-clock kill-switch. PURE/TOTAL like the rest of this
// module: plain values in, a fresh `Budget` out; no fs, clock, or process. A well-calibrated
// play (measured source, low censored rate) is funded at the price verbatim — back-compat.

/** Headroom a measurement-funded envelope gets ABOVE the largest observed lower bound (a
 *  censored run's logged actual). Mirrors budget.ts `TIMEOUT_HEADROOM` — one warranted factor
 *  for the class (double the observed wall), not a patch for a data point. ≥2 and finite, so the
 *  funded guard stays bounded (P7). The token+time analogue of the wall-clock kill-switch's slack:
 *  it clears the observed wall so a heavy cast FINISHES and RECORDS, breaking the censoring ratchet. */
export const MEASUREMENT_HEADROOM = 2;

/** Censored-rate threshold at/above which a `measured`-source play is treated as under-calibrated
 *  and auto-widened (the IA-14 actuation `recalibrate`'s `:14-16` comment defers). When runs are
 *  andon'd-at-envelope at least this often (~1 in 3), the percentile over the surviving successes is
 *  provably under-bounding the tail — so the FUNDING envelope (not the price) is widened to let the
 *  next heavy run finish. Cold-start (`source: "prior"`) is always under-calibrated regardless. */
export const CENSORED_WIDEN_RATE = 1 / 3;

/** Rational-band FLOOR on the funding guard's TOKEN dimension (E-053). Below this we don't care —
 *  every cast is funded at least this many tokens, so a too-tight p90 (a well-calibrated play funds
 *  at its bare p90 with no headroom — correct per E-050, but ~10% of runs exceed it) never starves a
 *  real cast on a tail draw (the `vend chain` propose that budget-exhausted at 176k against a 170k
 *  envelope). Finite positive int (P7). Overridable per call via {@link FundingOptions.floorTokens}. */
export const FUNDING_FLOOR_TOKENS = 350_000;

/** Rational-band CEILING on the funding guard's TOKEN dimension (E-053). The hard P7 wall: no cast is
 *  ever funded beyond this — runaway self-funding (E-051's decompose ran to ~733k under
 *  `maxCensoredActual × headroom`, unbounded by anything but the observed tail) is rejected here.
 *  Finite positive int, `> FUNDING_FLOOR_TOKENS` (P7). Overridable via {@link FundingOptions.ceilingTokens}. */
export const FUNDING_CEILING_TOKENS = 700_000;

/** Knobs for {@link fundingEnvelope}; all default to the module constants. */
export interface FundingOptions {
  /** Recency window for reading censored actuals; default {@link DEFAULT_WINDOW}. MUST match the
   *  `window` the producing {@link recalibrate} call used, so magnitudes and the rate agree. */
  readonly window?: number;
  /** Censored-rate auto-widen threshold; default {@link CENSORED_WIDEN_RATE}. */
  readonly widenRate?: number;
  /** Headroom factor above the observed lower bound; default {@link MEASUREMENT_HEADROOM}. */
  readonly headroom?: number;
  /** Band floor for the TOKEN dimension; default {@link FUNDING_FLOOR_TOKENS}. */
  readonly floorTokens?: number;
  /** Band ceiling for the TOKEN dimension; default {@link FUNDING_CEILING_TOKENS}. */
  readonly ceilingTokens?: number;
}

/** The envelope a cast is FUNDED (run) under, plus whether headroom actually lifted it above the
 *  price. `envelope` is ≥ the priced envelope per dimension; `widened` is `true` iff some dimension
 *  came out strictly above its price (for an honest funding label / the caller's log). */
export interface FundingResult {
  readonly envelope: Budget;
  readonly widened: boolean;
}

/** Fund one dimension: clear the largest observed censored lower bound by `headroom`, never falling
 *  below the price. With no censored actual to read (pure cold-start), give the PRICE headroom so a
 *  first run still gets room to record. Reuses {@link positiveInt} for the budget-dimension contract. */
function fundDimension(priced: number, censoredActuals: readonly number[], headroom: number): number {
  const floor = censoredActuals.length > 0 ? Math.max(...censoredActuals) * headroom : priced * headroom;
  return positiveInt(Math.max(priced, floor));
}

/** Clamp a TOKEN funding value to the rational band `[floor, ceiling]` (E-053) — the OUTERMOST bound,
 *  applied AFTER the headroom `max(...)`. The floor lifts a too-tight p90 so a tail draw never starves a
 *  real cast; the ceiling caps runaway self-funding (the hard P7 wall). TOKENS ONLY — wall-clock keeps
 *  its E-038 headroom, never banded. Reuses {@link positiveInt} for the budget-dimension contract. */
function bandTokens(tokens: number, floor: number, ceiling: number): number {
  return positiveInt(Math.min(ceiling, Math.max(floor, tokens)));
}

/**
 * Derive the FUNDING envelope (the guard a cast runs under) from a {@link RecalibrateResult} and the
 * play's records. PURE/TOTAL. The price (`result.envelope`) is left untouched — this is a strict
 * post-processor, never a re-derivation (guard ≠ price, IA-8). A play is UNDER-CALIBRATED when it is
 * cold-start (`source: "prior"`) OR its windowed censored rate `censored / (successes + censored)`
 * (read from `result.confidence`) is ≥ `widenRate` — the percentile is provably under-bounding. When
 * under-calibrated, each dimension is funded at `max(priced, maxCensoredActual × headroom)`, reading
 * the windowed CENSORED runs' logged `totalTokens` / `wallClockMs` as lower bounds (with the
 * `priced × headroom` fallback when there is no censored history to read). When trusted-measured the
 * price is returned verbatim. `widened` flags whether headroom lifted any dimension above its price.
 */
export function fundingEnvelope(
  play: string,
  records: readonly RunRecord[],
  result: RecalibrateResult,
  opts: FundingOptions = {},
): FundingResult {
  const window = opts.window ?? DEFAULT_WINDOW;
  const widenRate = opts.widenRate ?? CENSORED_WIDEN_RATE;
  const headroom = opts.headroom ?? MEASUREMENT_HEADROOM;
  const floor = opts.floorTokens ?? FUNDING_FLOOR_TOKENS;
  const ceiling = opts.ceilingTokens ?? FUNDING_CEILING_TOKENS;
  const priced = result.envelope;

  // Scalar gate: `source` and the censored counts are run-outcome properties, not per-dimension,
  // so the under-calibration decision is shared — only the funding `max` below is per-dimension.
  const { successes, censored } = result.confidence;
  const sample = successes + censored;
  const censoredRate = sample > 0 ? censored / sample : 0;
  const underCalibrated = result.source === "prior" || censoredRate >= widenRate;

  // Trusted-measured + clean: the bound is earned from real successes — fund at the price, no
  // headroom (back-compat — a well-calibrated play is unchanged). The TOKEN dimension is still banded
  // to `[floor, ceiling]` — a too-tight measured p90 (the ~170k propose) floors so a tail draw never
  // starves a real cast; an over-ceiling honest p90 (none today) caps. Time passes through verbatim.
  if (!underCalibrated) {
    return { envelope: { timeMs: priced.timeMs, tokens: bandTokens(priced.tokens, floor, ceiling) }, widened: false };
  }

  // Re-window the censored runs to read their logged actual magnitudes — the lower bounds
  // `recalibrate` right-censored OUT of the percentile but which are the very floor to clear. Same
  // `window` as the producing recalibrate call, so these agree with the `confidence` rate above.
  const windowedCensored = forPlay(records, play)
    .slice(-window)
    .filter((r) => CENSORED_OUTCOMES.includes(r.outcome));
  const censoredTokens = windowedCensored.map(totalTokens);
  const censoredTimes = windowedCensored.map(wallClockMs).filter((ms): ms is number => ms !== null);

  const tokens = fundDimension(priced.tokens, censoredTokens, headroom);
  const timeMs = fundDimension(priced.timeMs, censoredTimes, headroom);

  // Honest flag: each funded dimension is `max(priced, …) ≥ priced`, so `widened` is true iff some
  // dimension came out STRICTLY above its price — i.e. headroom was actually applied. Computed on the
  // UN-banded tokens: the band is a bound, not the headroom signal (E-053 — `widened` keeps its
  // E-050 meaning), so flooring/capping never flips it.
  const widened = tokens > priced.tokens || timeMs > priced.timeMs;
  // The TOKEN dimension is banded to `[floor, ceiling]` as the outermost bound (after the headroom
  // max above); time keeps its E-038 headroom, unbanded.
  const envelope: Budget = { timeMs, tokens: bandTokens(tokens, floor, ceiling) };
  return { envelope, widened };
}

// ── Cold-start drive budget (T-060-02-01, E-060 finding #2) ─────────────────────────────
// The seed's cold-start budget envelope — the macro budget that funds a FRESH-SEED first drive
// (`vend steer → vend work`) to a real slice clear — MEASURED from the run-log fat tails, never a
// hand-picked constant (E-060: "calibrate from E-013/recalibrate tails, do not hand-pick"). The
// cold-start drive's `vend work` casts the propose→decompose CHAIN per signal, so the per-clear cost
// is the per-denomination SUM of those plays' recalibrated envelopes — exactly the `price` line
// `work.ts` already computes. This is that price, as a reusable pure derivation the seed default
// (T-060-02-02) reads, instead of the inflated hand prior the wallet refused to fund (the EXPECTED-
// OUTCOME "budget-shape finding": cold-start priced at ~120 min because there were no successes yet,
// so recalibrate fell back to the 4h hand prior, and the denomination-separate wallet (IA-8) refuses
// a pull whose price exceeds EITHER axis). Once real successes exist, the measured time is seconds,
// not the prior's hours — which is what makes the tight two-gesture `--budget` fundable.
//
// PURE/TOTAL, same stance as the rest of the module. It DELEGATES every statistical decision to
// `recalibrate` — so it is value-tier-percentile (IA-12) and censored-aware (IA-13) for FREE, and
// never re-implements percentile/censoring. `plays` and `prior` are PASSED IN, never imported: that
// keeps recalibrate.ts decoupled from `src/play/` (the play names) and from `src/shelf/` (the hand
// prior `budgetForTier`), exactly as `recalibrate` itself takes its `prior` rather than redefining
// budget policy. The returned `envelope` is the p90 PRICE (the honest quote, IA-8) — funding headroom
// (`fundingEnvelope`) is a separate per-cast guard applied in `work.ts`, never folded in here.

/** "Two-gesture cold-start macro budget" derivation. `envelope` is the per-denomination Σ of the
 *  drive plays' recalibrated envelopes; `source` is `"measured"` ONLY when EVERY constituent
 *  recalibrate was measured (a macro budget is only as earned as its weakest leg — one cold-start
 *  play ⇒ the aggregate is honestly `"prior"`); `perPlay` is the breakdown so a caller can label or
 *  inspect confidence per play without re-deriving. */
export interface ColdStartEnvelopeResult {
  readonly envelope: Budget;
  readonly source: "measured" | "prior";
  readonly perPlay: readonly { readonly play: string; readonly result: RecalibrateResult }[];
}

/** Per-denomination sum of two budgets — tokens and wall-clock summed INDEPENDENTLY (IA-8: never
 *  cross-add the axes). Private two-liner, not imported from `work.ts`'s `sumBudgets` — the
 *  no-shared-util idiom this module already follows (it inlines `totalTokens` rather than coupling). */
function sumEnvelopes(a: Budget, b: Budget): Budget {
  return { timeMs: a.timeMs + b.timeMs, tokens: a.tokens + b.tokens };
}

/**
 * Derive the seed's cold-start MACRO budget from the run-log tails. PURE/TOTAL. Recalibrates each of
 * the cold-start drive's `plays` at the value `tier` over `records` (delegating ALL percentile and
 * right-censoring semantics to {@link recalibrate} — IA-12/IA-13), then sums their envelopes
 * per-denomination into one `Budget` — the measured per-clear cost of the propose→decompose chain.
 * Aggregate `source` is `"measured"` iff every constituent recalibrate was measured; one cold-start
 * leg makes the whole macro honestly `"prior"`. `plays` and `prior` are passed in (never imported)
 * so this core stays decoupled from `src/play/` and `src/shelf/`. Empty `plays` ⇒ the single hand
 * `prior` as the floor (a zero-play sum would be an invalid `{0,0}` budget) — TOTAL, never a `NaN`.
 * The returned envelope is the PRICE (the honest p90 quote); funding headroom is a separate guard.
 */
export function coldStartEnvelope(
  plays: readonly string[],
  records: readonly RunRecord[],
  tier: ValueTier,
  prior: Budget,
  opts: RecalibrateOptions = {},
): ColdStartEnvelopeResult {
  if (plays.length === 0) return { envelope: prior, source: "prior", perPlay: [] };

  const perPlay = plays.map((play) => ({ play, result: recalibrate(play, records, tier, prior, opts) }));
  const envelope = perPlay.reduce<Budget>((acc, p) => sumEnvelopes(acc, p.result.envelope), { timeMs: 0, tokens: 0 });
  const source = perPlay.every((p) => p.result.source === "measured") ? "measured" : "prior";
  return { envelope, source, perPlay };
}

// ── Reference-class bias correction (T-013-03, IA-16) ───────────────────────────────────
// The OUTSIDE view: "we usually overestimate by ~80%." Where `recalibrate` bounds a play's
// cost from its OWN percentile history, `calibrate` learns the systematic ESTIMATE-vs-ACTUAL
// bias — the actual/allocated ratio distribution — and corrects a RAW estimate by it. Two
// levels (IA-16), combined by PARTIAL POOLING:
//   project level  — this {play, project}'s deviation (big epics here decompose long);
//   generic level  — the play's intrinsic bias pooled across projects (the outside view).
// Empirical-Bayes shrinkage `w = N/(N+K)` leans on the generic prior when this project's data
// is thin and shifts to project-specific as it accumulates — the two-level form of
// `recalibrate`'s cold start (a soft, monotonic version of its hard `minSuccesses` cliff). The
// hierarchy project → generic play prior → authored default falls out of the math, not a
// branch ladder: an empty sample learns the IDENTITY factor (no correction = the authored
// default), so both levels degrade gracefully to "leave the estimate alone."
//
// Same purity + same robust-statistics stance as the rest of this module: the (allocated,
// actual) pair's `allocated` half is the LOGGED envelope (T-013-01); only SUCCESSFUL runs that
// carry one contribute a ratio (censored runs are right-censored — IA-13 — and a run with no
// envelope has no known allocation); the factor is the MEDIAN ratio (never the mean — the fat
// tail is exactly what must not be averaged in). Tokens and wall-clock are biased
// INDEPENDENTLY, mirroring `recalibrate`'s two dimensions.

/** A learned estimate-vs-actual bias: the median actual/allocated ratio, per dimension.
 *  `< 1` ⇒ systematic OVER-estimate (correct down); `> 1` ⇒ UNDER-estimate (correct up);
 *  `1` ⇒ no learned bias. NOT a {@link Budget} — a ratio is not a positive-int dimension. */
export interface BiasFactor {
  readonly tokens: number;
  readonly timeMs: number;
}

/** A learned factor plus the sample size backing it — what {@link learnBiasFactor} returns
 *  and what {@link calibrate} takes as its generic (cross-project) prior, so the shrinkage
 *  weight and the `genericN` confidence can both be computed without re-deriving anything. */
export interface BiasPrior {
  readonly factor: BiasFactor;
  readonly n: number;
}

/** The corrected estimate plus the bias applied and how much data backed each level. */
export interface CalibrateResult {
  /** `estimate × pooledFactor`, per dimension, coerced to a positive integer (budget
   *  contract) — ready to hand to a real run. */
  readonly corrected: Budget;
  /** The POOLED factor actually applied (the partial-pooled blend of project & generic). */
  readonly factor: BiasFactor;
  /** Sample sizes: project-level (this {play, project}) and generic-level (the prior). */
  readonly confidence: { readonly projectN: number; readonly genericN: number };
}

/** Shrinkage strength `K` (the prior's equivalent sample size): the project must accrue
 *  ~K (allocated, actual) pairs before it outweighs the generic prior. Overridable per call. */
export const DEFAULT_SHRINKAGE = 5;

/** The no-bias factor — what an empty sample learns, i.e. the authored default ("leave the
 *  estimate alone"). The third fallback in the hierarchy, expressed as data, not a branch. */
export const IDENTITY_FACTOR: BiasFactor = { tokens: 1, timeMs: 1 };

/** Knobs for {@link learnBiasFactor} / {@link calibrate}. */
export interface CalibrateOptions {
  /** Recency window (mirrors {@link DEFAULT_WINDOW}); the factor is learned over at most the
   *  last N records of the filtered set. */
  readonly window?: number;
  /** Shrinkage strength `K`; default {@link DEFAULT_SHRINKAGE}. */
  readonly shrinkage?: number;
}

/** The TRUE median of an ASCENDING-SORTED, possibly-empty sample, or `null` when empty —
 *  the average of the two central order statistics for even n. PURE. Unlike `recalibrate`'s
 *  nearest-rank {@link percentile} (deliberately conservative on a fat TAIL), the bias factor
 *  is a CENTRAL-tendency estimate, so the textbook median is the honest centre (and it is
 *  still robust — one outlier ratio cannot drag it, IA-13). */
function medianOrNull(sortedAsc: readonly number[]): number | null {
  const n = sortedAsc.length;
  if (n === 0) return null;
  const mid = Math.floor(n / 2);
  return n % 2 === 1 ? sortedAsc[mid]! : (sortedAsc[mid - 1]! + sortedAsc[mid]!) / 2;
}

/**
 * Learn the estimate-vs-actual {@link BiasPrior} from a set of records. PURE. Considers only
 * SUCCESSFUL runs that carry a logged `envelope` (the `allocated` half of the pair — a
 * censored run is right-censored, IA-13; an envelope-less run has no known allocation), over
 * at most the last `window`. Per dimension the factor is the MEDIAN of the per-run
 * actual/allocated ratios (tokens always; wall-clock only when the duration parses AND the
 * allocated time is positive); a dimension with no usable pair falls back to `1` (no bias).
 * `n` is the TOKEN-pair count — the headline sample size (tokens are always present when an
 * envelope is; the time sample may be smaller). An empty sample ⇒ {@link IDENTITY_FACTOR},
 * `n: 0` — the authored default. The caller pools this at two levels: project-filtered for
 * the project factor, play-wide (across projects) for the generic prior.
 */
export function learnBiasFactor(records: readonly RunRecord[], opts: CalibrateOptions = {}): BiasPrior {
  const window = opts.window ?? DEFAULT_WINDOW;
  const usable = records
    .slice(-window)
    .filter((r) => r.outcome === "success" && r.envelope !== undefined && r.envelope.tokens > 0);

  const tokenRatios: number[] = [];
  const timeRatios: number[] = [];
  for (const r of usable) {
    const env = r.envelope!;
    tokenRatios.push(totalTokens(r) / env.tokens);
    const ms = wallClockMs(r);
    if (ms !== null && env.timeMs > 0) timeRatios.push(ms / env.timeMs);
  }

  const tokens = medianOrNull(tokenRatios.sort((a, b) => a - b)) ?? 1;
  const timeMs = medianOrNull(timeRatios.sort((a, b) => a - b)) ?? 1;
  return { factor: { tokens, timeMs }, n: tokenRatios.length };
}

/**
 * Correct a raw `estimate` envelope by this {play, project}'s learned bias, partial-pooled
 * toward the `genericPrior`. PURE. The project factor is learned from `projectRecords`
 * (filtered to the key — robust to an unfiltered caller); the pooling weight is
 * `w = projectN / (projectN + K)`, so per dimension `pooled = w·project + (1−w)·generic`.
 * When `projectN = 0` the weight is 0 AND the project factor is identity, so pooled = the
 * generic prior (pure outside view); when the generic prior is also empty its factor is
 * identity, so `corrected = estimate` (the authored default). The corrected dimensions are
 * positive integers (budget contract). Direction is data-driven — a factor `< 1` shrinks the
 * estimate (overestimate corrected down), `> 1` grows it.
 */
export function calibrate(
  estimate: Budget,
  key: { readonly play: string; readonly project: string },
  projectRecords: readonly RunRecord[],
  genericPrior: BiasPrior,
  opts: CalibrateOptions = {},
): CalibrateResult {
  const k = opts.shrinkage ?? DEFAULT_SHRINKAGE;
  const projectScoped = projectRecords.filter((r) => r.play === key.play && projectOf(r) === key.project);
  const project = learnBiasFactor(projectScoped, opts);
  const projectN = project.n;
  const genericN = genericPrior.n;

  const w = projectN / (projectN + k);
  const blend = (proj: number, gen: number): number => w * proj + (1 - w) * gen;
  const factor: BiasFactor = {
    tokens: blend(project.factor.tokens, genericPrior.factor.tokens),
    timeMs: blend(project.factor.timeMs, genericPrior.factor.timeMs),
  };

  const corrected: Budget = {
    tokens: positiveInt(estimate.tokens * factor.tokens),
    timeMs: positiveInt(estimate.timeMs * factor.timeMs),
  };
  return { corrected, factor, confidence: { projectN, genericN } };
}

/**
 * Render a {@link CalibrateResult} as an honest one-line correction label (IA-8 / IA-16). PURE.
 * Reads "× t<f> / m<f> · N project / M generic" (the token & time factors to 2dp, then how much
 * data backs each level); when neither level has data it reads "uncorrected (no data)" so the
 * user can never mistake a pass-through estimate for an earned correction.
 */
export function formatCorrectionLabel(result: CalibrateResult): string {
  const { projectN, genericN } = result.confidence;
  if (projectN === 0 && genericN === 0) return "uncorrected (no data)";
  const t = result.factor.tokens.toFixed(2);
  const m = result.factor.timeMs.toFixed(2);
  return `× t${t} / m${m} · ${projectN} project / ${genericN} generic`;
}
