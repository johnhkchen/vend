// The PAPER RENDERER — the 4th and final leg of E-021's data/presentation split (T-021-06, story
// S-021-03). It turns a `Projection` (src/present/project.ts) into the MCP-INDEPENDENT paper
// artifact: a Mermaid decomposition tree + plain card faces (the designer view) and a collapsed
// founder/director brief. This is the RENDER CONTRACT a Linear renderer later executes — the same
// `Projection` IR, a second consumer. Grounded in docs/active/pm/linear-surface-mock.md (the
// canonical paper mock this reproduces IN SHAPE) and linear-surface-prep.md §1/§2.
//
// PURITY (house pattern, cf. project.ts / translate.ts / spec.ts): everything here is pure string
// building — deterministic walks, table lookups, joins — no fs, clock, network, or native addon. The
// graph/spec/projection imports are TYPE-ONLY where erasable; the value imports (`projectGraph`,
// `scrubFace`, `humanizeTitle`, `stateKey`) are all pure. So paper.test.ts is an ordinary
// pure-function test over a fabricated frozen graph, plus one live-board render for the AC.
//
// ONE-WAY AUTHORITY (E-021 invariant): this layer READS the graph + projection and never writes —
// no setter, no fs. It allocates strings and returns them; the graph object is reference-unchanged.
//
// HONEST-EMPTY (IA-4, the translate.ts/survey-core discipline): absence is reported as absence,
// never padded. An empty board, an epic with no stories, a story with no tickets, or an empty brief
// each render the literal `nothing here` placeholder — never a fabricated node. The authored brief
// prose (Direction, the one decision) is ROUTED from an optional input and OMITTED when absent; the
// renderer manufactures no editorial sentence (the line translate.ts's D1 draws).
//
// COMPOSITION, NOT REINVENTION: the decomposition tree walks the graph's OBJECT-ref containment
// (epic.stories → story.tickets, from model.ts); each ticket's plain title/face is the projected
// `Card` (T-021-04/05); state words/emoji come from `stateKey` (T-021-04). This file adds only what
// those don't: Mermaid emission, the blockquote face layout, and the brief table + state rollup.
//
// THE TREE COLORS BY STATE (design D3): a decomposition tree's universal reading is "where does it
// stand," so every node (epic/story/ticket) is colored + chipped by `stateKey`, INDEPENDENT of the
// card-level `colorLanguage` knob — which governs the board/faces, where calibration belongs.

import type { WorkGraph, EpicNode, StoryNode, TicketNode, AnyNode } from "../graph/model.ts";
import type { PresentationSpec } from "./spec.ts";
import { projectGraph } from "./project.ts";
import type { Projection, ProjectionGroup, ProjectedCard, ProjectionOverlays } from "./project.ts";
import { humanizeTitle, stateKey } from "./translate.ts";
import type { Card } from "./translate.ts";

// ── public option / narrative types ───────────────────────────────────────────────────────────────

/** Authored plain-prose for the founder brief — the mock's Direction paragraph and the single
 *  decision sentence. Both optional and ROUTED (never invented): what the caller doesn't supply,
 *  the brief omits. A future `steer`/`survey` output could supply these; the renderer must not
 *  fabricate them (honest-empty, cf. translate.ts's `PlainOverlay`). */
export interface BriefNarrative {
  readonly direction?: string;
  readonly decision?: string;
}

/** Options for the top-level {@link renderPaper}: the per-node authored `overlays` threaded to the
 *  projection (face prose) and the brief `narrative`. All optional — the honest-empty default. */
export interface RenderOptions {
  readonly overlays?: ProjectionOverlays;
  readonly narrative?: BriefNarrative;
}

// ── state vocabulary (private; the tree/brief color + chip language) ──────────────────────────────

/** State key → emoji chip (the mock's ✅ 🔄 ⬜). Unknown keys → no chip. */
const STATE_EMOJI: Readonly<Record<string, string>> = Object.freeze({
  done: "✅",
  in_progress: "🔄",
  open: "⬜",
  ready: "⬜",
});

/** State key → Mermaid `classDef` name. Unknown keys → `default`. */
const STATE_CLASS: Readonly<Record<string, string>> = Object.freeze({
  done: "done",
  in_progress: "active",
  open: "todo",
  ready: "todo",
});

/** Display-label (lowercased) → emoji, for the FACE chip — `face.state` is a spec display LABEL
 *  ("Done"), not a state key, so it is mapped separately from {@link STATE_EMOJI}. */
const LABEL_EMOJI: Readonly<Record<string, string>> = Object.freeze({
  done: "✅",
  "in progress": "🔄",
  "to do": "⬜",
  open: "⬜",
});

/** The single IA-4 placeholder — absence rendered as absence, never a fabricated node. */
const NOTHING = "nothing here";

// ── pure leaf helpers ─────────────────────────────────────────────────────────────────────────────

/** A Mermaid-safe node id: every non-alphanumeric becomes `_` (`T-021-06 → T_021_06`). */
export function sanitizeId(id: string): string {
  return id.replace(/[^A-Za-z0-9_]/g, "_");
}

/** A Mermaid node label: escape the chars that break `["…"]` syntax (`"`→`'`, `[`/`]`→`(`/`)`,
 *  newlines→spaces, collapse runs), then wrap. Pure and total. */
export function mmLabel(text: string): string {
  const safe = text
    .replace(/"/g, "'")
    .replace(/\[/g, "(")
    .replace(/\]/g, ")")
    .replace(/\s*\n\s*/g, " ")
    .replace(/\s{2,}/g, " ")
    .trim();
  return `["${safe}"]`;
}

/** State key → emoji chip; "" when unknown. */
function stateEmoji(key: string): string {
  return STATE_EMOJI[key] ?? "";
}

/** State key → Mermaid classDef name; "default" when unknown. */
function stateClass(key: string): string {
  return STATE_CLASS[key] ?? "default";
}

/** Display-label → emoji for a face chip; "" when unmapped. */
function labelEmoji(label: string): string {
  return LABEL_EMOJI[label.toLowerCase()] ?? "";
}

/** A plain count phrase for a card's details bucket (`"3 codes · 2 cites · BAML internals · raw
 *  ACs"`); "" when the bucket is empty (the `[ Details ▸ ]` line is then dropped — honest-empty). */
function detailsSummary(card: Card): string {
  const parts: string[] = [];
  const d = card.details;
  if (d.charterCodes?.length) parts.push(`${d.charterCodes.length} code${d.charterCodes.length === 1 ? "" : "s"}`);
  if (d.fileCites?.length) parts.push(`${d.fileCites.length} cite${d.fileCites.length === 1 ? "" : "s"}`);
  if (d.bamlInternals?.length) parts.push("BAML internals");
  if (d.rawAcceptanceCriteria) parts.push("raw ACs");
  return parts.join(" · ");
}

/** Flatten a projection's groups into an id → projected-card lookup, so the graph-walked tree can
 *  pull each ticket's projected (scrubbed, possibly overlay-authored) face. */
function cardIndex(projection: Projection): Map<string, ProjectedCard> {
  const m = new Map<string, ProjectedCard>();
  for (const g of projection.groups) for (const pc of g.cards) m.set(pc.card.id, pc);
  return m;
}

/** Roll a group's cards up to one state key (design D8): `in_progress` if any card is in progress,
 *  else `done` if all are done, else `open`. Expects a STATUS-colored projection (founderSpec), so
 *  `card.color` IS the state key. Mirrors the mock's "the one thing moving" reading. */
export function rollUpState(group: { readonly cards: readonly { readonly color: string }[] }): string {
  const colors = group.cards.map((c) => c.color);
  if (colors.some((c) => c === "in_progress")) return "in_progress";
  if (colors.length > 0 && colors.every((c) => c === "done")) return "done";
  return "open";
}

/** Title-case a single state key for a table cell (`in_progress → "In progress"`). */
function titleCaseState(key: string): string {
  const words = key.replace(/_/g, " ");
  return words.charAt(0).toUpperCase() + words.slice(1);
}

// ── the decomposition tree (graph containment + projected ticket faces) ───────────────────────────

/** Push one `ID["label"]:::class` declaration, deduped so a node shared across the walk is declared
 *  once. */
function declareNode(id: string, label: string, cls: string, seen: Set<string>, out: string[]): void {
  if (seen.has(id)) return;
  seen.add(id);
  out.push(`    ${id}${mmLabel(label)}:::${cls}`);
}

/** The plain label for a container node (epic/story): its humanized, scrubbed canonical title +
 *  state chip. Authored plain epic titles are not derivable, so we degrade honestly to the
 *  humanized title — never invent (honest-empty). */
function containerLabel(node: EpicNode | StoryNode): string {
  const key = stateKey(node);
  const emoji = stateEmoji(key);
  const title = humanizeTitle(node.title);
  return emoji ? `${title} ${emoji}` : title;
}

/** The plain label for a ticket node: its projected card's `plainTitle` (overlay-authored or
 *  humanized, already scrubbed), else a humanized fallback, + the state chip. */
function ticketLabel(ticket: TicketNode, index: Map<string, ProjectedCard>): string {
  const pc = index.get(ticket.id);
  const title = pc?.card.face.plainTitle ?? humanizeTitle(ticket.title);
  const emoji = stateEmoji(stateKey(ticket));
  return emoji ? `${title} ${emoji}` : title;
}

/** Recursively emit a container and its children as `PARENT --> CHILD` edges. An empty child list
 *  (an epic with no stories, a story with no tickets) emits a single `nothing here` leaf under the
 *  container instead of recursing into nothing — the IA-4 branch, never a fabricated node. */
function walkContainer(
  node: AnyNode,
  parentId: string | null,
  index: Map<string, ProjectedCard>,
  emptyCounter: { n: number },
  seen: Set<string>,
  out: string[],
): void {
  const id = sanitizeId(node.id);
  if (node.kind === "epic") {
    declareNode(id, containerLabel(node), stateClass(stateKey(node)), seen, out);
    if (parentId) out.push(`    ${parentId} --> ${id}`);
    if (node.stories.length === 0) return emitNothing(id, emptyCounter, out);
    for (const s of node.stories) walkContainer(s, id, index, emptyCounter, seen, out);
  } else if (node.kind === "story") {
    declareNode(id, containerLabel(node), stateClass(stateKey(node)), seen, out);
    if (parentId) out.push(`    ${parentId} --> ${id}`);
    if (node.tickets.length === 0) return emitNothing(id, emptyCounter, out);
    for (const t of node.tickets) walkContainer(t, id, index, emptyCounter, seen, out);
  } else {
    declareNode(id, ticketLabel(node, index), stateClass(stateKey(node)), seen, out);
    if (parentId) out.push(`    ${parentId} --> ${id}`);
  }
}

/** Emit a `nothing here` leaf under `parentId`, with a per-render unique id so multiple empty
 *  branches don't collapse into one shared Mermaid node. */
function emitNothing(parentId: string, counter: { n: number }, out: string[]): void {
  const id = `EMPTY_${counter.n++}`;
  out.push(`    ${id}${mmLabel(NOTHING)}:::empty`);
  out.push(`    ${parentId} --> ${id}`);
}

/**
 * Render the graph's epic→story→ticket containment as a Mermaid `graph TD` decomposition tree,
 * pulling each ticket's plain face from `projection`. PURE and DETERMINISTIC (the graph lists are
 * id-sorted upstream → byte-identical output, P5). Colored + chipped by STATE (design D3). An empty
 * board renders one `nothing here` under the root; an empty branch renders one under its container
 * (IA-4) — never a fabricated node.
 */
export function renderTree(graph: WorkGraph, projection: Projection): string {
  const index = cardIndex(projection);
  const out: string[] = [];
  const seen = new Set<string>();
  const counter = { n: 0 };

  out.push("```mermaid");
  out.push("graph TD");
  out.push("    classDef root   fill:#EDE7F6,stroke:#7E57C1,color:#311B92;");
  out.push("    classDef done   fill:#E8F5E9,stroke:#66BB6A,color:#1B5E20;");
  out.push("    classDef active fill:#FFF8E1,stroke:#FFB300,color:#E65100;");
  out.push("    classDef todo   fill:#ECEFF1,stroke:#90A4AE,color:#37474F;");
  out.push("    classDef empty  fill:#FAFAFA,stroke:#BDBDBD,color:#9E9E9E;");
  out.push("    classDef default fill:#FAFAFA,stroke:#BDBDBD,color:#37474F;");
  out.push("");
  declareNode("ROOT", "🛒 Vend — the project", "root", seen, out);

  if (graph.epics.length === 0) {
    emitNothing("ROOT", counter, out);
  } else {
    for (const e of graph.epics) walkContainer(e, "ROOT", index, counter, seen, out);
  }

  out.push("```");
  return out.join("\n");
}

// ── card faces (per-card blockquote; honest-empty per field) ──────────────────────────────────────

/** One projected card rendered as the mock's plain blockquote. Every line is OMITTED when its field
 *  is absent (`projectNode` already omits `why`/`breakdown` with no overlay/structure) — the
 *  honest-empty discipline, end to end. */
function faceBlock(pc: ProjectedCard): string {
  const f = pc.card.face;
  const lines: string[] = [];
  const title = f.plainTitle ?? "";
  const chip = f.state ? `${labelEmoji(f.state)} ${f.state}`.trim() : "";
  lines.push(`> **${title}**${chip ? ` · ${chip}` : ""}`);
  if (f.why) lines.push(`> *Why:* ${f.why}`);
  if (f.breakdown) lines.push(`> *What it breaks down to:* ${f.breakdown}`);
  const details = detailsSummary(pc.card);
  if (details) lines.push(`> *[ Details ▸ ]* — ${details}`);
  return lines.join("\n");
}

/**
 * Render every projected card as a plain face blockquote, in projection order (group order, then
 * id-sorted within — already deterministic from T-021-05). PURE. An empty projection renders a
 * single `*nothing here*` (IA-4).
 */
export function renderFaces(projection: Projection): string {
  const cards = projection.groups.flatMap((g) => g.cards);
  if (cards.length === 0) return `*${NOTHING}*`;
  return cards.map(faceBlock).join("\n\n");
}

/**
 * The designer view: the decomposition tree + the card faces, under their mock headings. PURE.
 */
export function renderDesignerView(graph: WorkGraph, projection: Projection): string {
  return [
    "## ◤ Designer view — the decomposition tree",
    "",
    renderTree(graph, projection),
    "",
    "### Card faces",
    "",
    renderFaces(projection),
  ].join("\n");
}

// ── founder/director brief (collapsed themes table + the one decision) ────────────────────────────

/** One `| Theme | State |` row for an epic-grouped projection group: the group's plain label +
 *  its rolled-up state (chip + title-cased word). */
function briefRow(group: ProjectionGroup): string {
  const key = rollUpState(group);
  const chip = stateEmoji(key);
  const state = `${chip} ${titleCaseState(key)}`.trim();
  return `| ${group.label} | ${state} |`;
}

/**
 * Render the founder/director brief — the collapsed "where it stands" view (same graph, grouped by
 * epic theme). PURE. Expects a STATUS-colored, epic-grouped projection (built by {@link founderSpec}
 * inside {@link renderPaper}) so per-epic state rolls up from `card.color` (design D8). The authored
 * `narrative.direction` / `narrative.decision` are ROUTED when supplied and OMITTED when absent
 * (honest-empty — the renderer invents no editorial prose). No groups → `*nothing here*` (IA-4).
 */
export function renderFounderBrief(projection: Projection, narrative: BriefNarrative = {}): string {
  const out: string[] = ["## ◤ Founder/director view — the brief", ""];
  if (narrative.direction) {
    out.push(`**Direction:** ${narrative.direction}`, "");
  }
  if (projection.groups.length === 0) {
    out.push(`*${NOTHING}*`);
    return out.join("\n");
  }
  out.push("| Theme | State |", "|---|---|");
  for (const g of projection.groups) out.push(briefRow(g));
  if (narrative.decision) {
    out.push("", `**The one decision waiting on you:** ${narrative.decision}`);
  }
  return out.join("\n");
}

// ── the composer (the one high-level entry) ───────────────────────────────────────────────────────

/** The mock's preset-header blockquote: echo the active spec knobs so the artifact is
 *  self-describing ("calibration edits this header, never the graph"). PURE. */
function presetHeader(spec: PresentationSpec): string {
  return [
    `> **Active preset (${spec.preset}):** \`vocabulary: ${spec.vocabulary} · density: ${spec.density} · ` +
      `metaphor: ${spec.metaphor} · color_language: ${spec.colorLanguage} · group_by: ${spec.groupBy}\``,
    "> *Same graph, different preset → the founder brief below. Calibration edits this header, never the graph.*",
  ].join("\n");
}

/** Derive the founder/director spec from the active spec: collapse to an epic-grouped, status-colored
 *  low-density view (design D7), so the brief's per-epic state rolls up cleanly. A `custom` preset
 *  marker — it is a derived view, not a built-in. */
function founderSpec(spec: PresentationSpec): PresentationSpec {
  return { ...spec, groupBy: "epic", colorLanguage: "status", density: "low", preset: "custom" };
}

/**
 * Render the whole MCP-independent paper artifact from the live `graph` under `spec`: the preset
 * header, the designer view (tree + faces, projected under `spec`), and the founder/director brief
 * (projected under {@link founderSpec}). PURE — `projectGraph` is called twice (cheap, pure) and the
 * graph is never touched (one-way authority). Reproduces linear-surface-mock.md IN SHAPE; honest-empty
 * (IA-4) throughout — an empty board renders `nothing here`, never a fabricated node.
 */
export function renderPaper(graph: WorkGraph, spec: PresentationSpec, opts: RenderOptions = {}): string {
  const designer = projectGraph(graph, spec, opts.overlays);
  const founder = projectGraph(graph, founderSpec(spec), opts.overlays);
  return [
    "# Paper — the Vend graph, rendered",
    "",
    presetHeader(spec),
    "",
    "---",
    "",
    renderDesignerView(graph, designer),
    "",
    "---",
    "",
    renderFounderBrief(founder, opts.narrative),
    "",
  ].join("\n");
}
