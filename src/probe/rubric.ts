// The 'GOOD ENOUGH' RUBRIC SCORECARD's PURE core (T-021-09, story S-021-04, epic E-021) — a
// probe over the RENDERED DESIGNER PRESET, mirroring the consistency probe's pure-core ↔
// impure-harness split (./consistency.ts ↔ ./run-consistency-probe.ts). It scores one designer
// render across the five rubric dimensions — comprehension, structure, density, language,
// navigability — and returns a per-dimension {@link Scorecard}: the "good enough" gate the
// designer view must clear (advances P1, rubric-pass).
//
// THE SPLIT (the house rule, exactly as consistency.ts): the impure harness
// (./run-rubric-probe.ts) loads the live board, projects + renders it under DESIGNER_PRESET,
// and hands THIS pure core the two finished views — the render string and its `Projection`. All
// judgment lives here; the harness is the instrument, not unit-tested. So rubric.test.ts is an
// ordinary pure-function test over `buildGraph` fixtures, free of fs.
//
// REUSE, NOT REINVENTION (the central decision, design D3): the LANGUAGE dimension IS
// translate.ts's `faceJargon` — the predicate documented there as "MUST be empty for any
// spec/overlay". scrubFace cleans every face on the write side; this probe is the INDEPENDENT
// verifier that the one-classifier-two-uses guarantee held end to end. There is no second
// jargon regex here — that would let "what is jargon" drift from its single source.
//
// PURE: no fs, clock, network, process, or addon — every export takes plain values and returns
// fresh ones. Imports only the pure translate.ts verbs (`faceJargon`/`faceText`) and the
// projection/card TYPES (erased at runtime). One-way authority (E-021): reads the render +
// projection, never a node; there is no write path here.
//
// HONESTY (IA-4 / IA-8): an empty board (no cards/groups/links) is a VACUOUS pass per dimension
// — score 1, never NaN, never a fabricated failure — and every score carries its evidence (the
// failing card ids / reasons in `failures`) so a pass reads truthfully, never as a bare number.

import type { Projection, ProjectedCard } from "../present/project.ts";
import { faceJargon, faceText } from "../present/translate.ts";

// ── the closed-set rubric vocabulary (as-const → derived union; the spec.ts idiom) ───────────────

/** The five 'good enough' dimensions, in scorecard order. The single source of the dimension
 *  names; the scorecard always carries all five (consistency.ts's PROBE_OUTCOMES precedent). */
export const RUBRIC_DIMENSIONS = [
  "comprehension",
  "structure",
  "density",
  "language",
  "navigability",
] as const;
export type RubricDimension = (typeof RUBRIC_DIMENSIONS)[number];

// ── output types (all readonly — the model.ts / spec.ts immutability idiom) ──────────────────────

/** One dimension's verdict: a 0..1 `score` (never NaN), a hard `pass`, a one-phrase human
 *  `detail`, and the `failures` evidence (card ids / reasons) so a verdict never reads as a bare
 *  number (IA-8 — the meter must not lie). */
export interface DimensionScore {
  readonly dimension: RubricDimension;
  readonly score: number;
  readonly pass: boolean;
  readonly detail: string;
  readonly failures: readonly string[];
}

/** The whole 'good enough' read of one designer render: every dimension (all five, in
 *  {@link RUBRIC_DIMENSIONS} order) plus the rolled-up gate `pass` = every dimension passed. */
export interface Scorecard {
  readonly dimensions: readonly DimensionScore[];
  readonly pass: boolean;
}

// ── density face-volume budget (design D4: "too much per card", per the density knob) ────────────

/** Max characters of joined face text a card may carry under each `density` knob. `low` (the
 *  designer default) is terse — a title + short why + state chip; `full` is unbounded. The
 *  mechanical proxy for the density promise, calibrated against the live designer faces. */
const DENSITY_CHAR_BUDGET: Readonly<Record<string, number>> = Object.freeze({
  low: 240,
  medium: 480,
  full: Number.POSITIVE_INFINITY,
});

// ── pure leaf helpers ─────────────────────────────────────────────────────────────────────────────

/** Flatten a projection's groups into the flat card list every face-level dimension scores. */
function allCards(projection: Projection): ProjectedCard[] {
  return projection.groups.flatMap((g) => g.cards);
}

/** A clean/total ratio defined as 1 for an empty set — a vacuous pass, never NaN (the
 *  consistency.ts zero-safety discipline). */
function ratio(clean: number, total: number): number {
  return total === 0 ? 1 : clean / total;
}

// ── per-dimension scorers (each pure; mechanical and deterministic — no model judgment) ──────────

/** LANGUAGE — the AC's hard mechanical gate: fails iff ANY card carries an untranslated-jargon
 *  token on its face. IS translate.ts's `faceJargon` (design D3), folded across every card. */
function scoreLanguage(cards: readonly ProjectedCard[]): DimensionScore {
  const failures: string[] = [];
  for (const pc of cards) {
    const tokens = faceJargon(pc.card);
    if (tokens.length > 0) failures.push(`${pc.card.id}: ${tokens.join(", ")}`);
  }
  const clean = cards.length - failures.length;
  return {
    dimension: "language",
    score: ratio(clean, cards.length),
    pass: failures.length === 0,
    detail:
      failures.length === 0
        ? `${cards.length} face(s) carry no jargon`
        : `${failures.length} of ${cards.length} face(s) carry untranslated jargon`,
    failures,
  };
}

/** COMPREHENSION — a card is comprehensible iff it has a non-empty PLAIN TITLE and a STATE chip
 *  (the minimum to know what it is and where it stands, without dev context). */
function scoreComprehension(cards: readonly ProjectedCard[]): DimensionScore {
  const failures: string[] = [];
  for (const pc of cards) {
    const f = pc.card.face;
    const missing: string[] = [];
    if (!f.plainTitle || f.plainTitle.trim().length === 0) missing.push("plain title");
    if (!f.state || f.state.trim().length === 0) missing.push("state");
    if (missing.length > 0) failures.push(`${pc.card.id}: missing ${missing.join(" + ")}`);
  }
  const clean = cards.length - failures.length;
  return {
    dimension: "comprehension",
    score: ratio(clean, cards.length),
    pass: failures.length === 0,
    detail:
      failures.length === 0
        ? `${cards.length} face(s) name a plain title + state`
        : `${failures.length} of ${cards.length} face(s) miss a plain title or state`,
    failures,
  };
}

/** DENSITY — each card's joined face text stays within the per-density character budget; a
 *  low-density designer face that balloons into a wall of prose fails. */
function scoreDensity(projection: Projection, cards: readonly ProjectedCard[]): DimensionScore {
  const budget = DENSITY_CHAR_BUDGET[projection.density] ?? Number.POSITIVE_INFINITY;
  const failures: string[] = [];
  for (const pc of cards) {
    const len = faceText(pc.card).length;
    if (len > budget) failures.push(`${pc.card.id}: ${len} chars`);
  }
  const clean = cards.length - failures.length;
  return {
    dimension: "density",
    score: ratio(clean, cards.length),
    pass: failures.length === 0,
    detail:
      failures.length === 0
        ? `${cards.length} face(s) within the ${projection.density} budget`
        : `${failures.length} of ${cards.length} face(s) exceed the ${projection.density} budget`,
    failures,
  };
}

/** STRUCTURE — the decomposition is legible: the render emits the Mermaid tree, and every
 *  projection group carries a non-empty header label. */
function scoreStructure(render: string, projection: Projection): DimensionScore {
  const treeOk = render.includes("```mermaid") && render.includes("graph TD");
  const unlabelled = projection.groups.filter((g) => g.label.trim().length === 0).map((g) => g.key);
  const failures: string[] = [];
  if (!treeOk) failures.push("no decomposition tree in the render");
  for (const key of unlabelled) failures.push(`group ${key}: no label`);
  const labelledGroups = projection.groups.length - unlabelled.length;
  const pass = treeOk && unlabelled.length === 0;
  // Score: a present tree is half, fully-labelled groups the other half (1 when no groups).
  const score = (treeOk ? 0.5 : 0) + 0.5 * ratio(labelledGroups, projection.groups.length);
  return {
    dimension: "structure",
    score,
    pass,
    detail: pass
      ? "decomposition tree present; every group labelled"
      : "decomposition tree or a group label is missing",
    failures,
  };
}

/** The three section headings the paper artifact must carry to be navigable — the stable
 *  substrings paper.test.ts also asserts (resilient to surrounding heading chrome). */
const REQUIRED_HEADINGS = ["Designer view", "Card faces", "Founder/director view"] as const;

/** NAVIGABILITY — you can find your way: the render carries its three section headings, and no
 *  dependency link dangles (every endpoint resolves to a projected card). */
function scoreNavigability(render: string, projection: Projection): DimensionScore {
  const cardIds = new Set(allCards(projection).map((pc) => pc.card.id));
  const missingHeadings = REQUIRED_HEADINGS.filter((h) => !render.includes(h));
  const danglers = projection.links.filter((l) => !cardIds.has(l.from) || !cardIds.has(l.to));
  const failures: string[] = [];
  for (const h of missingHeadings) failures.push(`missing heading: ${h}`);
  for (const l of danglers) failures.push(`dangling link: ${l.from} -> ${l.to}`);
  const pass = missingHeadings.length === 0 && danglers.length === 0;
  const headingScore = ratio(REQUIRED_HEADINGS.length - missingHeadings.length, REQUIRED_HEADINGS.length);
  const linkScore = ratio(projection.links.length - danglers.length, projection.links.length);
  return {
    dimension: "navigability",
    score: 0.5 * headingScore + 0.5 * linkScore,
    pass,
    detail: pass
      ? "all section headings present; every link resolves"
      : "a section heading is missing or a link dangles",
    failures,
  };
}

// ── the scorecard (the one public entry) + its formatter ─────────────────────────────────────────

/**
 * Score one DESIGNER render across the five rubric dimensions. PURE. `render` is the
 * `renderPaper(graph, DESIGNER_PRESET)` artifact; `projection` is the `projectGraph(graph,
 * DESIGNER_PRESET)` that produced it (the harness builds both). Returns a {@link Scorecard} whose
 * `dimensions` are always all five in {@link RUBRIC_DIMENSIONS} order, and whose `pass` is the
 * "good enough" gate — every dimension passed. An empty board is a vacuous pass throughout
 * (IA-4); the language gate fails on any face jargon (the AC's teeth, via `faceJargon`).
 */
export function scoreDesignerRubric(render: string, projection: Projection): Scorecard {
  const cards = allCards(projection);
  const dimensions: DimensionScore[] = [
    scoreComprehension(cards),
    scoreStructure(render, projection),
    scoreDensity(projection, cards),
    scoreLanguage(cards),
    scoreNavigability(render, projection),
  ];
  return { dimensions, pass: dimensions.every((d) => d.pass) };
}

/** Round a 0..1 score to a whole-percent string (the consistency.ts headline format). */
function pct(x: number): string {
  return `${Math.round(x * 100)}%`;
}

/**
 * Render a {@link Scorecard} as the findings block: a headline "good enough" verdict, then one
 * honest line per dimension (`✓/✗ name — detail (score%)`), appending the failure evidence when
 * a dimension fails. PURE. Mirrors `formatConsistencyReport`'s one-truthful-read discipline.
 */
export function formatScorecard(card: Scorecard): string {
  const head = `rubric — good enough: ${card.pass ? "yes" : "no"}`;
  const lines = card.dimensions.map((d) => {
    const mark = d.pass ? "✓" : "✗";
    const evidence = d.failures.length > 0 ? ` [${d.failures.join("; ")}]` : "";
    return `  ${mark} ${d.dimension} — ${d.detail} (${pct(d.score)})${evidence}`;
  });
  return [head, ...lines].join("\n");
}
