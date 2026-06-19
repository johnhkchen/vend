// The semantic-equivalence judge's PURE aggregation core (T-022-01, story S-022-01, epic E-022) —
// the meaning axis the consistency probe's dispersion (./consistency.ts + ./variance.ts) cannot
// read on its own.
//
// ./variance.ts's line-set Jaccard dispersion tells us a play's N outputs on a FIXED input
// *differ*; it cannot tell us whether the difference *matters*. This module classifies a play's
// divergent outputs as EQUIVALENT-DIVERSITY (the same intent / proposed work, worded differently —
// acceptable) vs GENUINE-DISAGREEMENT (they propose *different* things — a real inconsistency the
// gates exist to bound), with MIXED for a partial split. The classification + a summary score sit
// BESIDE the dispersion number (the impure harness, ./run-equivalence-judge.ts, prints both).
//
// THE SPLIT (the house rule, exactly as ./consistency.ts ↔ ./run-consistency-probe.ts): whether
// two outputs MEAN the same thing is a model judgment — impure and non-deterministic — so the
// impure judge harness casts the equivalence judgment (the dispense seam, src/executor/claude.ts)
// over the N collected outputs and hands THIS core already-formed PER-PAIR verdicts; this module
// only TALLIES them into a classification + score. So equivalence.test.ts is an ordinary
// pure-function test over fabricated verdicts, free of fs / addon / the live `claude` cast.
//
// PER-PAIR, NOT PER-SET (design D1): a verdict is over one unordered pair `{ i, j, equivalent }`,
// mirroring ./variance.ts's `PairDiff { i, j, distance }` — the dispersion the judge sits beside is
// itself a mean over unordered pairs, so the two reads align one-to-one.
//
// HONESTY (IA-8, the meter must not lie — the ./consistency.ts discipline): a score is e/P over the
// EXPECTED pair count, so a judge that returned too few verdicts cannot inflate it (missing
// evidence counts against equivalence); fewer than two outputs is a VACUOUS classification the
// formatter caveats; and a verdict count short of the expected pairs is surfaced, never silently
// read as agreement.
//
// PURE: no fs, clock, network, process, or addon — every export takes plain values and returns
// fresh ones. Imports nothing.

// ── the closed classification vocabulary (as-const → derived union; the PROBE_OUTCOMES idiom) ─────

/** The three meaning-axis classes a play's dispersion can fall into. The single source of the
 *  class names; a report only ever carries one of these (./consistency.ts's PROBE_OUTCOMES /
 *  ./rubric.ts's RUBRIC_DIMENSIONS precedent). */
export const EQUIVALENCE_CLASSES = ["equivalent-diversity", "genuine-disagreement", "mixed"] as const;
export type EquivalenceClass = (typeof EQUIVALENCE_CLASSES)[number];

// ── input + output types (all readonly — the variance.ts / consistency.ts immutability idiom) ─────

/**
 * One unordered pair's equivalence verdict — the unit the judge harness produces and this core
 * tallies. `i`/`j` index into the judged output set (`j > i`); `equivalent` is the model's call
 * (`true` ⇒ same intent / proposed work, reworded; `false` ⇒ they propose different things). The
 * optional `reason` is a one-phrase rationale the harness may carry for provenance (never required
 * by the tally). Mirrors ./variance.ts's `PairDiff`, with a boolean where it has a distance.
 */
export interface EquivalenceVerdict {
  readonly i: number;
  readonly j: number;
  readonly equivalent: boolean;
  readonly reason?: string;
}

/**
 * The whole judge read for one play's N outputs: the {@link EquivalenceClass}, a summary `score`
 * (the equivalence rate `e/P` ∈ [0,1]; 1 when there are no pairs — vacuous, never NaN), and the
 * evidence beside it (`n` outputs, the expected `totalPairs`, the `equivalentPairs` /
 * `divergentPairs` split, and `verdictsSeen` — how many verdicts actually arrived, so a short
 * judge reply is visible). The formatter reads all of it so a classification never reads as a bare
 * label.
 */
export interface EquivalenceReport {
  readonly classification: EquivalenceClass;
  readonly score: number;
  readonly n: number;
  readonly totalPairs: number;
  readonly equivalentPairs: number;
  readonly divergentPairs: number;
  readonly verdictsSeen: number;
}

// ── pure leaf helpers ──────────────────────────────────────────────────────────────────────────

/** The number of unordered pairs over `n` outputs: `n·(n−1)/2`, defined as 0 for `n < 2` (a
 *  single point — or none — has no pair to judge). Never negative, never NaN. */
function expectedPairs(n: number): number {
  return n < 2 ? 0 : (n * (n - 1)) / 2;
}

// ── the classification (the one public judgment) + its formatter ─────────────────────────────────

/**
 * Aggregate per-pair equivalence verdicts over a play's `n` outputs into a classification + score.
 * PURE. The denominator is the EXPECTED pair count `P = n·(n−1)/2` (NOT `verdicts.length`), so a
 * judge that returned too few verdicts cannot inflate the equivalence rate — missing evidence
 * counts against equivalence (the honest-pessimistic choice, IA-8).
 *
 * Classification (design D2): `total === 0` (n < 2) ⇒ vacuously `equivalent-diversity` (the
 * formatter caveats it); full equivalent coverage (`e === total`, `total > 0`) ⇒
 * `equivalent-diversity`; no equivalent pairs (`e === 0`) ⇒ `genuine-disagreement`; anything
 * partial — including all-equivalent verdicts that fall SHORT of full coverage — ⇒ `mixed`.
 */
export function classifyEquivalence(verdicts: readonly EquivalenceVerdict[], n: number): EquivalenceReport {
  const totalPairs = expectedPairs(n);
  const verdictsSeen = verdicts.length;
  const equivalentPairs = verdicts.filter((v) => v.equivalent).length;
  const divergentPairs = verdictsSeen - equivalentPairs;
  const score = totalPairs === 0 ? 1 : equivalentPairs / totalPairs;

  let classification: EquivalenceClass;
  if (totalPairs === 0) classification = "equivalent-diversity"; // vacuous — caveated by the formatter
  else if (equivalentPairs === totalPairs) classification = "equivalent-diversity"; // full equivalent coverage
  else if (equivalentPairs === 0) classification = "genuine-disagreement";
  else classification = "mixed";

  return { classification, score, n, totalPairs, equivalentPairs, divergentPairs, verdictsSeen };
}

/** Round a 0–1 score to a 2dp string (the ./consistency.ts headline format). */
function s2(x: number): string {
  return x.toFixed(2);
}

/**
 * Render an {@link EquivalenceReport} as one honest line for the findings note (E-022 / IA-8).
 * PURE. Leads with the classification + score, then the pair tally over the output count, and —
 * when the read is vacuous (n < 2) or the judge returned fewer verdicts than the expected pairs —
 * an explicit `⚠` caveat, so a "diversity" earned by too few outputs (or a truncated judge reply)
 * reads truthfully rather than as a clean win. Mirrors `formatConsistencyReport`.
 */
export function formatEquivalenceReport(r: EquivalenceReport): string {
  const head = `semantic equivalence: ${r.classification} (score ${s2(r.score)})`;
  const body = `${r.equivalentPairs} equivalent · ${r.divergentPairs} divergent of ${r.totalPairs} pairs over ${r.n} outputs`;
  const caveats: string[] = [];
  if (r.n < 2) caveats.push("fewer than 2 outputs — classification vacuous");
  if (r.verdictsSeen < r.totalPairs) caveats.push(`judge returned ${r.verdictsSeen} of ${r.totalPairs} pair verdicts`);
  const tail = caveats.length > 0 ? ` — ⚠ ${caveats.join("; ")}` : "";
  return `${head} (${body})${tail}`;
}
