// The VOCABULARY-TRANSLATION / FIELD-MAPPING layer — the third leg of E-021's data/presentation
// split (T-021-04, story S-021-02). It PROJECTS a canonical work-graph node (src/graph/model.ts)
// through a validated presentation spec (src/present/spec.ts) into a `Card`: a jargon-scrubbed
// FACE (the intent layer) plus a dev-layer DETAILS bucket (behind progressive disclosure). The
// render contract is docs/active/pm/linear-surface-prep.md §1a (field mapping), §1b (vocabulary
// policy), §1c (the worked T-018-01 before→after).
//
// PURITY (house pattern, cf. spec.ts / gates.ts / model.ts): everything here is pure — regex
// classification, string scrubbing, structural counting — no fs, clock, network, or native addon.
// The graph + spec imports are TYPE-ONLY (erased at runtime), so translate.test.ts is an ordinary
// pure-function test over plain records, free of the BAML/fs world.
//
// DIVISION OF LABOR (design D1): the plain PROSE of §1c ("Build the brain that reads a project…")
// is AUTHORED intent text — it cannot be derived from `steer-pure-core` + a jargon body by any
// pure function. So this layer's job is to ROUTE and GUARANTEE, never to invent: a caller supplies
// an optional `PlainOverlay`, and when it doesn't, the face omits `why`/`breakdown` rather than
// manufacturing them (the survey-core.ts honest-empty discipline). What MUST be code — the
// deterministic "no jargon leaks onto the face" guarantee and the spec-driven field routing — is.
//
// ONE CLASSIFIER, TWO USES (design D2/D3): `JARGON_CLASSES` is the single source of "what is
// jargon" (§1b's families as named regexes). It backs BOTH `scrubFace` (the write side — strips
// jargon from every face string) AND `jargonTokens`/`faceJargon` (the read side — the verdict the
// AC asserts empty). They cannot drift because they share the constant.
//
// ONE-WAY AUTHORITY (E-021 invariant): this layer READS the graph and never edits it. Calibration
// edits the spec (T-021-02/03), never the data (T-021-01). There is no write path to a node here.

import type { AnyNode } from "../graph/model.ts";
import type { PresentationSpec } from "./spec.ts";

// ── the §1b denylist as closed-set policy (as-const, the spec.ts idiom) ─────────────────────────

/** The jargon families of prep §1b, one named global regex each. The single source of "what is
 *  jargon": `scrubFace` strips these from the face; `jargonTokens` reports them. Class-based (not
 *  a literal word list) because each family is open-ended — there are many charter codes
 *  (`P1`…`PE-7`…`IA-9`) and infinitely many `*.ts` paths; the AC names representatives, not an
 *  exhaustive set. Every pattern carries `g` (required by `matchAll`); fresh `RegExp`s are built
 *  per call so the `lastIndex` of the `g` flag never leaks between calls. */
export const JARGON_CLASSES = {
  /** Charter codes: P5, PE-1, IA-7, R1/R3 (principle/invariant/requirement ids). */
  charterCode: /\b(?:PE-\d+|IA-\d+|P\d+|R\d+)\b/g,
  /** BAML / SAP — the authoring + parse internals. */
  bamlSap: /\b(?:BAML|SAP)\b/g,
  /** File cites: any `*.ts` path, or a `baml_src/…` path (play names live here too). */
  filePath: /\b[\w./-]*\.ts\b|\bbaml_src\/[\w./-]*/g,
  /** Raw phase tokens: `phase:done`, `phase: research` (the §1a "no phase:done raw" rule). */
  phaseRaw: /\bphase:\s*\w+\b/g,
} as const;

export type JargonClass = keyof typeof JARGON_CLASSES;

const CLASS_ORDER = Object.keys(JARGON_CLASSES) as JargonClass[];

/** All distinct matches of one class in `text`, in first-appearance order. */
function matchClass(text: string, cls: JargonClass): string[] {
  const { source, flags } = JARGON_CLASSES[cls];
  const re = new RegExp(source, flags);
  const out: string[] = [];
  const seen = new Set<string>();
  for (const m of text.matchAll(re)) {
    const tok = m[0];
    if (tok && !seen.has(tok)) {
      seen.add(tok);
      out.push(tok);
    }
  }
  return out;
}

// ── the classifier: read side (jargonTokens) + write side (scrubFace) ───────────────────────────

/** Every jargon token in `text`, across all classes, deduped in first-appearance order. The read
 *  side of the policy — the engine of {@link faceJargon}, the verdict the AC asserts is empty. */
export function jargonTokens(text: string): string[] {
  const out: string[] = [];
  const seen = new Set<string>();
  for (const cls of CLASS_ORDER) {
    for (const tok of matchClass(text, cls)) {
      if (!seen.has(tok)) {
        seen.add(tok);
        out.push(tok);
      }
    }
  }
  return out;
}

/** Strip every jargon token from a face string and tidy the wreckage (empty parens, doubled
 *  spaces, a space stranded before punctuation). The write side of the policy — every string that
 *  lands on the face passes through here, so the face is clean even if an overlay author slips a
 *  code in. Whitespace-only input → "". */
export function scrubFace(text: string): string {
  let out = text;
  for (const cls of CLASS_ORDER) {
    const { source, flags } = JARGON_CLASSES[cls];
    out = out.replace(new RegExp(source, flags), "");
  }
  return out
    .replace(/\(\s*\)/g, "") // parens emptied by a removed token
    .replace(/\(\s+/g, "(")
    .replace(/\s+([,.;:·)])/g, "$1") // space stranded before punctuation / close paren
    .replace(/\s{2,}/g, " ")
    .trim();
}

// ── charter-code translation table (§1b: "translate to the plain idea, or hide") ────────────────

/** Known charter codes → their plain idea (§1b verbatim where given). A future renderer can choose
 *  to SURFACE a translated principle on the face; the default face path HIDES (scrubs) instead,
 *  because choosing which codes to surface is a spec/authoring call, not the layer's (design D4).
 *  An unknown code maps to null → hide. */
export const CODE_PLAIN: Readonly<Record<string, string>> = Object.freeze({
  "PE-1": "every suggestion traces to something real — no invented work",
  P3: "nothing unworthy settles into execution",
  P5: "the same ask gives a consistent answer",
});

/** The plain idea for a charter code, or null when it should simply be hidden. */
export function translateCode(code: string): string | null {
  return CODE_PLAIN[code] ?? null;
}

// ── body extractors (route dev content → the details bucket) ────────────────────────────────────

/** Charter codes mentioned in a node body (deduped, appearance order). */
export function extractCharterCodes(body: string): string[] {
  return matchClass(body, "charterCode");
}

/** File-path cites in a node body (`*.ts`, `baml_src/…`). */
export function extractFileCites(body: string): string[] {
  return matchClass(body, "filePath");
}

/** BAML/SAP mentions plus `b.request.X` / `b.parse.X` call sites, deduped in appearance order. */
export function extractBamlInternals(body: string): string[] {
  const out: string[] = [];
  const seen = new Set<string>();
  const push = (tok: string) => {
    if (tok && !seen.has(tok)) {
      seen.add(tok);
      out.push(tok);
    }
  };
  for (const tok of matchClass(body, "bamlSap")) push(tok);
  for (const m of body.matchAll(/\bb\.(?:request|parse)\.\w+/g)) push(m[0]);
  return out;
}

/** The verbatim `## Acceptance Criteria` section (heading included) up to the next `## ` heading
 *  or end of body; "" when the section is absent. */
export function rawAcceptanceCriteria(body: string): string {
  const heading = body.match(/^##\s+Acceptance Criteria\b.*$/m);
  if (!heading || heading.index === undefined) return "";
  const start = heading.index;
  const rest = body.slice(start + heading[0].length);
  const nextRel = rest.search(/\n##\s+/);
  const section = nextRel === -1 ? rest : rest.slice(0, nextRel);
  return (heading[0] + section).trim();
}

// ── face / state helpers ────────────────────────────────────────────────────────────────────────

/** Kebab/snake canonical title → a plain sentence-cased string, then scrubbed. The `plain_title`
 *  fallback when no overlay supplies authored prose (`steer-pure-core → "Steer pure core"`). */
export function humanizeTitle(title: string): string {
  const words = title.replace(/[-_]+/g, " ").trim();
  const sentence = words.charAt(0).toUpperCase() + words.slice(1);
  return scrubFace(sentence);
}

/** Collapse a node's raw status/phase into one of the label keys (`open`/`in_progress`/`done`). A
 *  ticket whose phase is `done` reads as done even if its status is still `open` (the §1c "✅ Done"
 *  case). Hyphenated `in-progress` is normalized to the `in_progress` label key. */
export function stateKey(node: AnyNode): string {
  const done = node.status === "done" || (node.kind === "ticket" && node.phase === "done");
  if (done) return "done";
  if (node.status === "in-progress" || node.status === "review") return "in_progress";
  return node.status.replace(/-/g, "_");
}

/** The single §1a state chip: the spec's display label for the node's collapsed state, falling
 *  back to the bare key. Never emits a raw `phase:done` — it reads status/phase and returns a word
 *  (`"Done"`, or `"done"` when unlabeled), which the projection still scrubs for safety. */
export function stateChip(node: AnyNode, spec: PresentationSpec): string {
  const key = stateKey(node);
  return spec.labels.status[key] ?? key;
}

/** A plain structural summary of a node's decomposition: epic → "N stories", story → "N tickets",
 *  ticket → "depends on N · blocks M" (zero clauses dropped). "" when a ticket has neither. The
 *  `breakdown` fallback when no overlay supplies authored prose. */
export function structuralBreakdown(node: AnyNode): string {
  if (node.kind === "epic") return `${node.stories.length} stories`;
  if (node.kind === "story") return `${node.tickets.length} tickets`;
  const parts: string[] = [];
  if (node.dependsOn.length) parts.push(`depends on ${node.dependsOn.length}`);
  if (node.blocks.length) parts.push(`blocks ${node.blocks.length}`);
  return parts.join(" · ");
}

// ── the Card (the output; design D6) ─────────────────────────────────────────────────────────────

/** Authored plain-language intent text for a node (the §1c face prose). All optional — what the
 *  caller doesn't supply, the projection omits or falls back for; it never invents. */
export interface PlainOverlay {
  readonly plainTitle?: string;
  readonly why?: string;
  readonly breakdown?: string;
}

/** The intent layer — only the tokens the spec's `face` routed; every string is jargon-scrubbed. */
export interface FaceContent {
  readonly plainTitle?: string;
  readonly why?: string;
  readonly state?: string;
  readonly breakdown?: string;
}

/** The dev layer behind disclosure — only the tokens the spec's `details` routed. */
export interface DetailContent {
  readonly charterCodes?: readonly string[];
  readonly fileCites?: readonly string[];
  readonly bamlInternals?: readonly string[];
  readonly rawAcceptanceCriteria?: string;
}

/** One node projected through one spec: a clean face + a dev-layer details bucket. Frozen. */
export interface Card {
  readonly id: string;
  readonly kind: AnyNode["kind"];
  readonly face: FaceContent;
  readonly details: DetailContent;
}

// ── the projection (the one public entry) ────────────────────────────────────────────────────────

/**
 * Project `node` through `spec` (optionally with an authored `overlay`) into a {@link Card}. PURE.
 * The spec is the ROUTER: a field appears on the face iff its token is in `spec.face`, and in the
 * details bucket iff its token is in `spec.details` — that IS the field-visibility knob, so the
 * SAME node renders differently under DESIGNER_PRESET vs DEV_PRESET through one code path. Every
 * face string is run through {@link scrubFace} (the no-jargon guarantee); `why`/`breakdown` are
 * OMITTED when neither overlay nor structure supplies content (honest-empty — never invent prose).
 * Details fields are omitted when their extractor finds nothing. The result is deeply frozen (the
 * model.ts/spec.ts read-only idiom).
 */
export function projectNode(node: AnyNode, spec: PresentationSpec, overlay: PlainOverlay = {}): Card {
  const face: {
    plainTitle?: string;
    why?: string;
    state?: string;
    breakdown?: string;
  } = {};
  for (const token of spec.face) {
    if (token === "plain_title") {
      const v = scrubFace(overlay.plainTitle ?? humanizeTitle(node.title));
      if (v) face.plainTitle = v;
    } else if (token === "why") {
      if (overlay.why !== undefined) {
        const v = scrubFace(overlay.why);
        if (v) face.why = v;
      }
    } else if (token === "state") {
      const v = scrubFace(stateChip(node, spec));
      if (v) face.state = v;
    } else if (token === "breakdown") {
      const raw = overlay.breakdown ?? structuralBreakdown(node);
      const v = scrubFace(raw);
      if (v) face.breakdown = v;
    }
  }

  const details: {
    charterCodes?: readonly string[];
    fileCites?: readonly string[];
    bamlInternals?: readonly string[];
    rawAcceptanceCriteria?: string;
  } = {};
  for (const token of spec.details) {
    if (token === "charter_codes") {
      const a = extractCharterCodes(node.body);
      if (a.length) details.charterCodes = Object.freeze(a);
    } else if (token === "file_cites") {
      const a = extractFileCites(node.body);
      if (a.length) details.fileCites = Object.freeze(a);
    } else if (token === "baml_internals") {
      const a = extractBamlInternals(node.body);
      if (a.length) details.bamlInternals = Object.freeze(a);
    } else if (token === "raw_acceptance_criteria") {
      const s = rawAcceptanceCriteria(node.body);
      if (s) details.rawAcceptanceCriteria = s;
    }
  }

  return Object.freeze({
    id: node.id,
    kind: node.kind,
    face: Object.freeze(face),
    details: Object.freeze(details),
  });
}

// ── verdict seam (the budget.ts rule: an expected check is returned data, not a throw) ──────────

/** Every present face string joined — "the face" as one readable surface. */
export function faceText(card: Card): string {
  return [card.face.plainTitle, card.face.why, card.face.state, card.face.breakdown]
    .filter((s): s is string => s !== undefined)
    .join(" ");
}

/** Any jargon tokens that leaked onto the face — the AC predicate, which MUST be empty for any
 *  spec/overlay. Returned data, never a throw. */
export function faceJargon(card: Card): string[] {
  return jargonTokens(faceText(card));
}
