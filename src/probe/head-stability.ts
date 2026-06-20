// The top-pick-stability probe's PURE core (T-023-01, story S-023-01, epic E-023) — the
// HEAD-ISOLATING sibling of ./equivalence.ts.
//
// ./equivalence.ts's judge compared WHOLE survey boards and read `genuine-disagreement` (0.00, N=3
// — obs 21783). But a board can disagree in its TAIL while agreeing on its HEAD, and the consistency
// contract (IA-1's single recommendation; IA-17 — consistency is GATED VALIDITY, not lexical
// identity) only cares whether the LOAD-BEARING #1 PULL flips run-to-run, not whether the tail
// re-orders. This module reads JUST the head: extract each board's #1 (and top-k) ranked signal and
// classify whether the head is stable across the N casts INDEPENDENTLY of tail order.
//
// THE SAME AGGREGATION, APPLIED TO HEADS (design D3): "are all the heads the same pull?" is exactly
// ./equivalence.ts's question scoped to the #1 signal — all head-pairs equivalent ⇒ stable, none ⇒
// flips, partial ⇒ mixed. So `classifyHeadStability` DELEGATES to `classifyEquivalence` for the
// honest-pessimistic e/P math (IA-8: denominator is the EXPECTED pair count, so a short judge reply
// cannot inflate the score) and only RE-MAPS the label into the head vocabulary. The per-pair unit
// is reused verbatim (`EquivalenceVerdict` — a per-pair equivalence boolean is the same unit whether
// the subject is a board or its head).
//
// TWO VERDICT SOURCES, ONE CLASSIFIER (design D2): the AUTHORITATIVE head comparison is semantic (two
// #1 picks worded differently can be the same pull — IA-17), produced live by the judge in the impure
// harness (./run-equivalence-judge.ts) over JUST the heads. `headVerdictsFromExactMatch` is the pure,
// DETERMINISTIC source — normalize-and-compare — that drives the fixtures and serves as the harness's
// lexical baseline. Both yield `EquivalenceVerdict[]`; both flow into the same tally.
//
// TAIL-INDEPENDENCE IS A PARSER PROPERTY: "tail re-order with a stable #1 ⇒ head-stable" is proven at
// the EXTRACTION layer — `extractTopPicks` pulls the same #1 regardless of how the tail is ordered —
// then classified. So the parser lives HERE (pure string work) and is unit-tested, not buried in the
// untested harness.
//
// PURE: no fs, clock, network, process, or addon. Imports ONLY the pure ./equivalence.ts — so
// head-stability.test.ts is an ordinary pure-function test (the ./consistency.ts ↔ ./variance.ts
// discipline). The live judge cast over the collected heads is the impure harness, NOT tested here.

import { classifyEquivalence, type EquivalenceClass, type EquivalenceVerdict } from "./equivalence.ts";

// ── the closed classification vocabulary (the EQUIVALENCE_CLASSES idiom) ──────────────────────────

/** The three classes a play's HEAD (its #1 pull) can fall into across N casts. The single source of
 *  the head-class names; a report only ever carries one of these. Maps 1:1 onto
 *  {@link EquivalenceClass}: stable ↔ equivalent-diversity, flips ↔ genuine-disagreement, mixed ↔
 *  mixed (see {@link LABEL_MAP}). */
export const HEAD_STABILITY_CLASSES = ["head-stable", "head-flips", "mixed"] as const;
export type HeadStabilityClass = (typeof HEAD_STABILITY_CLASSES)[number];

// ── output type (mirrors EquivalenceReport, head vocabulary) ──────────────────────────────────────

/**
 * The whole head read for one play's N boards: the {@link HeadStabilityClass}, a summary `score`
 * (the head-equivalence rate `e/P` ∈ [0,1] over the EXPECTED head-pairs; 1 when there are no pairs —
 * vacuous, never NaN), and the evidence beside it (`n` boards compared, the expected `totalPairs`,
 * the `stablePairs` / `flippedPairs` split, and `verdictsSeen` — how many verdicts actually arrived,
 * so a short judge reply is visible). The formatter reads all of it so a class never reads as a bare
 * label. The `stablePairs`/`flippedPairs` are the head-scoped rename of `EquivalenceReport`'s
 * `equivalentPairs`/`divergentPairs`.
 */
export interface HeadStabilityReport {
  readonly classification: HeadStabilityClass;
  readonly score: number;
  readonly n: number;
  readonly totalPairs: number;
  readonly stablePairs: number;
  readonly flippedPairs: number;
  readonly verdictsSeen: number;
}

// ── the parser (pure string work; keys on the `vend chain "…"` block — design D4) ─────────────────

/** Match each staged `vend chain "<what> — <why>"` pull line, capturing the quoted head text. This
 *  block is rendered top-ranked-first and IDENTICALLY by both the survey and steer effects
 *  (survey-effect.ts `renderStagedBoard` / steer-effect.ts `renderStagedSteer`), so one key serves
 *  both board-shaped plays. The quoted string is the clean `what — why` — no `**` to strip. */
const PULL_LINE = /vend chain "([^"]*)"/g;

/**
 * Extract a staged board's ranked top picks — the first `k` `what — why` heads, top-ranked first.
 * PURE. Keys on the `## Pull these` block's `vend chain "…"` lines (design D4), which both the survey
 * and steer effects render top-first. Returns the raw head text (trimmed, NOT normalized — callers
 * normalize for comparison; the raw head is preserved for display + the judge prompt).
 *
 * TOTAL on every edge: an empty / abstention board (`# Survey — no demand staged` /
 * `# Steer — nothing to stage`) has no pull lines ⇒ `[]`; `k <= 0` ⇒ `[]`; `k` beyond the board's
 * length ⇒ all heads. `k` defaults to 1 (the load-bearing #1 pull the contract is about).
 */
export function extractTopPicks(boardMarkdown: string, k = 1): string[] {
  if (k <= 0) return [];
  const heads: string[] = [];
  for (const m of boardMarkdown.matchAll(PULL_LINE)) {
    heads.push(m[1]!.trim());
    if (heads.length >= k) break;
  }
  return heads;
}

/** The single load-bearing head: a board's #1 ranked pull, or `null` when nothing is staged (an
 *  empty / abstention board). The accessor the harness's `extractHead` hook calls. PURE. */
export function topPick(boardMarkdown: string): string | null {
  return extractTopPicks(boardMarkdown, 1)[0] ?? null;
}

// ── the deterministic verdict source (design D2) ──────────────────────────────────────────────────

/** Collapse a head to its comparison form: trim, collapse internal whitespace, casefold. The lexical
 *  baseline's notion of "the same pull" — surface-form identity modulo whitespace/case. The judge
 *  (the harness's semantic source) is the authoritative comparison; this is the cheap deterministic
 *  one that drives the fixtures and the harness's `[lexical exact-match]` line. */
function normalizeHead(s: string): string {
  return s.trim().replace(/\s+/g, " ").toLowerCase();
}

/**
 * Build per-pair head verdicts by DETERMINISTIC exact (normalized) match — the pure verdict source
 * that mirrors what the judge produces semantically. PURE. For every unordered pair `{i, j}` (`j >
 * i`) over the `heads`, the verdict is `equivalent` iff the two heads are {@link normalizeHead}-equal.
 * Fewer than two heads ⇒ `[]` (no pair to compare — the tally reads this as vacuous). The output
 * drops straight into {@link classifyHeadStability}, exactly as the judge's verdicts do.
 */
export function headVerdictsFromExactMatch(heads: readonly string[]): EquivalenceVerdict[] {
  const norm = heads.map(normalizeHead);
  const out: EquivalenceVerdict[] = [];
  for (let i = 0; i < norm.length; i++) {
    for (let j = i + 1; j < norm.length; j++) {
      out.push({ i, j, equivalent: norm[i] === norm[j] });
    }
  }
  return out;
}

// ── the tally (delegates to classifyEquivalence, re-maps the label — design D3) ───────────────────

/** The 1:1 class map: head stability IS equivalence over heads, renamed. Annotated
 *  `satisfies Record<EquivalenceClass, …>` so adding an equivalence class without a head mapping is a
 *  COMPILE error, never a silent miss (the label-map-drift watch-item). */
const LABEL_MAP = {
  "equivalent-diversity": "head-stable",
  "genuine-disagreement": "head-flips",
  mixed: "mixed",
} as const satisfies Record<EquivalenceClass, HeadStabilityClass>;

/**
 * Aggregate per-pair HEAD-equivalence verdicts over a play's `n` boards into a head-stability
 * classification + score. PURE. DELEGATES the honest-pessimistic e/P arithmetic to
 * {@link classifyEquivalence} (the genuine shared contract — denominator is the EXPECTED pair count
 * `P = n·(n−1)/2`, so a judge that returned too few head verdicts cannot inflate stability; missing
 * evidence counts against it, IA-8) and re-maps the label into the head vocabulary via
 * {@link LABEL_MAP}. The pair fields are renamed to the head scope (`equivalentPairs → stablePairs`,
 * `divergentPairs → flippedPairs`).
 *
 * Classification follows equivalence exactly: `n < 2` ⇒ vacuously `head-stable` (the formatter
 * caveats it); all head-pairs equivalent at full coverage ⇒ `head-stable`; no equivalent head-pairs
 * ⇒ `head-flips`; anything partial — including all-stable verdicts SHORT of full coverage ⇒ `mixed`.
 */
export function classifyHeadStability(verdicts: readonly EquivalenceVerdict[], n: number): HeadStabilityReport {
  const base = classifyEquivalence(verdicts, n);
  return {
    classification: LABEL_MAP[base.classification],
    score: base.score,
    n: base.n,
    totalPairs: base.totalPairs,
    stablePairs: base.equivalentPairs,
    flippedPairs: base.divergentPairs,
    verdictsSeen: base.verdictsSeen,
  };
}

/** Round a 0–1 score to a 2dp string (the ./equivalence.ts headline format). */
function s2(x: number): string {
  return x.toFixed(2);
}

/**
 * Render a {@link HeadStabilityReport} as one honest line for the findings note (E-023 / IA-8). PURE.
 * Leads with the class + score, then the head-pair tally over the board count, and — when the read is
 * vacuous (n < 2) or the judge returned fewer verdicts than the expected head-pairs — an explicit `⚠`
 * caveat, so a "stable" earned by too few boards (or a truncated judge reply) reads truthfully rather
 * than as a clean win. Mirrors `formatEquivalenceReport`.
 */
export function formatHeadStabilityReport(r: HeadStabilityReport): string {
  const head = `top-pick stability: ${r.classification} (score ${s2(r.score)})`;
  const body = `${r.stablePairs} stable · ${r.flippedPairs} flipped of ${r.totalPairs} head-pairs over ${r.n} boards`;
  const caveats: string[] = [];
  if (r.n < 2) caveats.push("fewer than 2 boards — classification vacuous");
  if (r.verdictsSeen < r.totalPairs) caveats.push(`judge returned ${r.verdictsSeen} of ${r.totalPairs} head-pair verdicts`);
  const tail = caveats.length > 0 ? ` — ⚠ ${caveats.join("; ")}` : "";
  return `${head} (${body})${tail}`;
}
