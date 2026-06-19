// The any-play consistency probe's PURE core (T-019-01, story S-019-01, epic E-019) — the
// generalization of the decompose-only variance core (./variance.ts) into a SINGLE-ARM,
// run-to-run consistency read over ONE play cast N× on a FIXED input.
//
// The core promise of Vend is CONSISTENCY: gates turn a natively probabilistic process into a
// repeatable one. ./variance.ts measured that as a PAIRED gated-vs-ungated reduction for one play
// (decompose). THIS module measures the run-to-run consistency a user actually GETS from any one
// play: cast it N× on a fixed grounded input and report (a) the OUTPUT VARIANCE — the dispersion
// of the produced (signal) outputs, reusing ./variance.ts's `dispersion` primitive verbatim — and
// (b) the OUTCOME MIX: how many casts produced a signal, honestly abstained (honest-empty, IA-4),
// or were censored (budget-exhausted). The honest-empty RATE on a grounded input is the play's
// over-eagerness/abstention behavioral signal.
//
// CLASSIFICATION IS NOT HERE — and deliberately so. Whether a cast `success` was a real signal or
// an honest abstention is PLAY-SPECIFIC (survey's empty board CLEARS and materializes a "no demand
// staged" note; expand's empty signal STOPs). A pure cross-play "is the output blank" test would be
// WRONG for survey and would couple this core to specific plays' effect prose. So the impure sweep
// harness (./run-consistency-probe.ts) does the per-play classification and hands THIS core an
// already-labelled `{outcome, output}` list; this module only TALLIES + disperses. The same split
// ./variance.ts uses (impure harness feeds the pure judgment), and the only part unit-tested.
//
// PURE: no fs, clock, network, process, or addon. Imports ONLY the `dispersion` primitive (+ its
// type) from ./variance.ts — itself pure — so consistency.test.ts is an ordinary pure-function test.

import { dispersion, type SetDispersion } from "./variance.ts";

/**
 * The three probe-level outcome buckets (NOT the run-log's `RunOutcome` — this is the probe's
 * consistency vocabulary): a cast produced a real `signal`, honestly abstained (`honest-empty`,
 * IA-4), or was censored before producing anything of value (`budget-exhausted` — the fat-tail
 * mode; the harness folds other non-success andons here and prints the raw `RunOutcome` tally
 * separately so the fold is never silent). The impure harness assigns one per cast.
 */
export const PROBE_OUTCOMES = ["signal", "honest-empty", "budget-exhausted"] as const;
export type ProbeOutcome = (typeof PROBE_OUTCOMES)[number];

/** One cast's classified result: the probe outcome the harness assigned, and the materialized
 *  output text (or `null` when nothing landed). The unit the pure core tallies + disperses. */
export interface ProbeResult {
  readonly outcome: ProbeOutcome;
  /** Materialized output; `null` when nothing landed (censored / abstained-with-no-file). */
  readonly output: string | null;
}

/** The outcome histogram over a set of casts: the total, the per-bucket counts, and the per-bucket
 *  rates (count/total). Rates are over ALL casts (so the honest-empty rate is the over-eagerness
 *  denominator the ticket wants), defined as 0 when there are no casts — never NaN. */
export interface OutcomeMix {
  readonly total: number;
  readonly counts: Readonly<Record<ProbeOutcome, number>>;
  readonly rates: Readonly<Record<ProbeOutcome, number>>;
}

/** The whole probe read for one play: the variance of the produced (signal) outputs, beside the
 *  outcome mix — so a low variance earned by mostly abstaining (a tiny signal arm) can never read
 *  as a clean win (the counts are right there; the formatter caveats a too-small signal arm). */
export interface ConsistencyReport {
  /** Dispersion over the SIGNAL outputs only (honest-empty / budget-exhausted runs produce no
   *  signal to disperse — including them would conflate "abstained" with "disagreed"). */
  readonly variance: SetDispersion;
  readonly mix: OutcomeMix;
}

/** A fresh zeroed per-bucket counter — the single source of "every bucket starts at 0", so the
 *  mix always carries all three keys even when a bucket never occurred. */
function zeroCounts(): Record<ProbeOutcome, number> {
  const c = {} as Record<ProbeOutcome, number>;
  for (const o of PROBE_OUTCOMES) c[o] = 0;
  return c;
}

/**
 * Tally a list of classified results into an {@link OutcomeMix}. PURE. Every bucket is present
 * (zeroed if absent); rates are `count/total`, defined as 0 for an empty list (no divide-by-zero —
 * the ./variance.ts discipline). Totals over the full set, not just the produced ones.
 */
export function outcomeMix(results: readonly ProbeResult[]): OutcomeMix {
  const counts = zeroCounts();
  for (const r of results) counts[r.outcome]++;
  const total = results.length;
  const rates = zeroCounts();
  if (total > 0) for (const o of PROBE_OUTCOMES) rates[o] = counts[o] / total;
  return { total, counts, rates };
}

/**
 * The headline read of the single-arm probe. PURE. Disperses ONLY the `signal` outputs (a `signal`
 * whose output is somehow `null` is defensively dropped from the dispersion set but still counted
 * in the mix), and tallies the full set into the mix. `variance.dispersion === 0` over identical
 * signals is the hoped result (the play is run-to-run consistent on this input); a high dispersion
 * is the inconsistency the gates exist to bound. Totals over every edge: all-censored (empty signal
 * arm ⇒ dispersion 0, n 0), all-abstained (same), a single signal (n 1 ⇒ dispersion 0, not NaN).
 */
export function consistencyReport(results: readonly ProbeResult[]): ConsistencyReport {
  const signalOutputs = results
    .filter((r) => r.outcome === "signal" && r.output !== null)
    .map((r) => r.output as string);
  return { variance: dispersion(signalOutputs), mix: outcomeMix(results) };
}

/** Round a 0–1 ratio to a whole-percent string (the ./variance.ts headline format). */
function pct(x: number): string {
  return `${Math.round(x * 100)}%`;
}

/** Round a dispersion to 2dp for display. */
function d2(x: number): string {
  return x.toFixed(2);
}

/**
 * Render a {@link ConsistencyReport} as one honest line for the findings note (T-019-02 / IA-8).
 * PURE. Leads with the signal-output dispersion + its member count, then the outcome mix
 * (signal/honest-empty/budget-exhausted counts) and the honest-empty rate, and — when the signal
 * arm is too small to disperse — an explicit caveat, so a "consistent" read earned by abstention
 * (few signals) reads truthfully rather than as a clean win. Mirrors `formatVarianceReport`.
 */
export function formatConsistencyReport(r: ConsistencyReport): string {
  const head = `run-to-run signal dispersion: ${d2(r.variance.dispersion)} over ${r.variance.n}`;
  const c = r.mix.counts;
  const body = `signal ${c.signal} · honest-empty ${c["honest-empty"]} · budget-exhausted ${c["budget-exhausted"]} (of ${r.mix.total})`;
  const heRate = `honest-empty rate ${pct(r.mix.rates["honest-empty"])}`;
  const caveat = r.variance.n < 2 ? " — ⚠ signal arm too small to disperse — dispersion not meaningful" : "";
  return `${head} (${body}; ${heRate})${caveat}`;
}
