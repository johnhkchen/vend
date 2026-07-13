// The PURE GRAPH→PROJECTION core — the keystone of E-021's data/presentation split (T-021-05,
// story S-021-03). It composes the three landed legs into one function: `projectGraph(graph, spec)`
// renders the canonical work-graph (src/graph/model.ts) through a validated presentation spec
// (src/present/spec.ts) into a `Projection` — the graph's TICKETS grouped along `spec.groupBy`,
// each card colored under `spec.colorLanguage`, plus the `depends_on` LINKS between them. Same
// graph, many renders; calibration edits the spec, never the data. Grounded in
// docs/active/pm/linear-surface-prep.md §2a/§2b (the knobs) and the §1a field-mapping
// ("depends_on → visual links between cards").
//
// PURITY (house pattern, cf. spec.ts / translate.ts / model.ts): everything here is pure — map
// accumulation, deterministic sorts, string labels — no fs, clock, network, or native addon. The
// graph + spec imports are TYPE-ONLY (erased at runtime); the value imports (`deepFreeze`,
// `projectNode`, `stateChip`, `stateKey`, `humanizeTitle`, `scrubFace`) are all pure. So
// project.test.ts is an ordinary pure-function test over a fabricated frozen graph.
//
// ONE-WAY AUTHORITY (E-021 invariant): this layer READS the graph and never edits it. There is no
// write path to a node here — the result is a fresh, deeply-frozen `Projection` tree; the input
// graph object is returned to the caller reference-unchanged (the AC's teeth).
//
// COMPOSITION, NOT REINVENTION: per-card face/details is `projectNode` (T-021-04); the read-only
// guarantee is `deepFreeze` (T-021-01); state/label words are `stateChip`/`stateKey` (T-021-04).
// This file adds only what those don't: grouping, color tokens, and links.
//
// SCOPE / DEFERRALS (design D1/D5): a projection is over the graph's TICKETS — the leaf work items
// the designer steers; epics/stories supply group HEADER LABELS, not their own cards. `density` and
// `metaphor` are CARRIED onto the projection (self-describing) but their graduated effect is a v1
// deferral — the same stance T-021-04 took on `vocabulary` — rather than fabricating a semantic the
// PM docs do not pin down. Field-visibility/labels/vocabulary are already applied inside
// `projectNode`; this layer composes that result. `role`/`leverage` have no node field, so they
// degrade honestly: `role` → one group / one color; `leverage` → the `priority` proxy.

import type { WorkGraph, TicketNode } from "../graph/model.ts";
import { deepFreeze } from "../graph/model.ts";
import type { PresentationSpec, Grouping, Density, ColorLanguage, Metaphor } from "./spec.ts";
import { projectNode, stateChip, stateKey, humanizeTitle, scrubFace } from "./translate.ts";
import type { Card, PlainOverlay } from "./translate.ts";

// ── output types (all readonly — the model.ts / spec.ts immutability idiom) ──────────────────────

/** One ticket projected through one spec: its {@link Card} (face + details) plus the color token
 *  the spec's `colorLanguage` assigns. `card.id`/`card.kind` already identify the node. */
export interface ProjectedCard {
  readonly card: Card;
  /** A SEMANTIC color token (e.g. `"done"`, `"high"`), not a hex — the renderer owns the palette. */
  readonly color: string;
}

/** A partition of the projected cards under the `groupBy` axis: a stable `key`, a plain display
 *  `label`, and the cards (id-sorted) that fall in it. */
export interface ProjectionGroup {
  readonly key: string;
  readonly label: string;
  readonly cards: readonly ProjectedCard[];
}

/** A projected dependency edge — the §1a "depends_on → visual links between cards". Top-level (a
 *  dependency can cross group boundaries); only the authored `depends_on` direction is emitted (the
 *  inverse `blocks` is recoverable, never double-emitted — design D4). */
export interface ProjectionLink {
  readonly from: string;
  readonly to: string;
  readonly kind: "depends_on";
  /** Status-derived decision weight (E-056 edges-as-payload): `true` when the `from` ticket is not
   *  done (its `stateKey` ≠ `"done"`), so a renderer can give blocking edges visual weight. Purely
   *  derived from the frozen graph — no new data authority; same graph → same flag. */
  readonly blocked: boolean;
}

/** The whole graph projected through one spec: ordered groups of colored cards + the link set, with
 *  the governing knobs echoed so the projection is self-describing (a renderer needs no spec to read
 *  `metaphor`/`density`). Deeply frozen — the read-only half of the purity guarantee. */
export interface Projection {
  readonly groupBy: Grouping;
  readonly density: Density;
  readonly colorLanguage: ColorLanguage;
  readonly metaphor: Metaphor;
  readonly groups: readonly ProjectionGroup[];
  readonly links: readonly ProjectionLink[];
}

/** Optional authored plain-prose, keyed by node id, threaded through to {@link projectNode}. What a
 *  ticket has no entry for falls back / omits — the honest-empty discipline, unchanged. */
export type ProjectionOverlays = Readonly<Record<string, PlainOverlay>>;

// ── deterministic group ordering (natural reading order where an axis has one) ───────────────────

/** Reading order for the `status` axis (the mock's todo → doing → done). Unknown keys sort last. */
const STATUS_ORDER: Readonly<Record<string, number>> = Object.freeze({
  open: 0,
  ready: 0,
  in_progress: 1,
  done: 2,
});

/** Reading order for the `leverage` axis — highest leverage first (the demand.md ordering, applied
 *  to the `priority` proxy). Unknown keys sort last. */
const PRIORITY_ORDER: Readonly<Record<string, number>> = Object.freeze({
  critical: 0,
  high: 1,
  medium: 2,
  low: 3,
});

const UNKNOWN_ORDINAL = 9;

// ── group resolution (pure; design D2) ───────────────────────────────────────────────────────────

/** The partition key for a ticket under `spec.groupBy`. Every axis resolves from a real field:
 *  epic via ticket→story→epic, story via `storyId`, status via `stateKey`, leverage via `priority`,
 *  role to a single `"all"` (no node-level role — honest-empty, not invented). */
function groupKeyFor(ticket: TicketNode, graph: WorkGraph, spec: PresentationSpec): string {
  switch (spec.groupBy) {
    case "epic": {
      const story = graph.byId[ticket.storyId];
      const epicId = story && story.kind === "story" ? story.epicId : null;
      return epicId ?? "ungrouped";
    }
    case "story":
      return ticket.storyId;
    case "status":
      // Status is a true partition over normalized state: if every ticket has the same `stateKey`,
      // one group is expected. Stable subgroups on such a board require a separately designed
      // compound/secondary grouping policy, not invented status keys here.
      return stateKey(ticket);
    case "leverage":
      return ticket.priority;
    case "role":
      return "all";
  }
}

/** Capitalize a bare token for a display label (`high` → `High`). */
function capitalize(s: string): string {
  return s.length ? s.charAt(0).toUpperCase() + s.slice(1) : s;
}

/** The plain header label for a group key under `spec.groupBy`. Epic/story → the parent node's
 *  humanized, scrubbed title (via `byId`); status → the spec's state label; leverage → the
 *  capitalized priority; role → `"All"`. Resolved once per distinct key. */
function groupLabelFor(
  key: string,
  groupBy: Grouping,
  graph: WorkGraph,
  sample: TicketNode,
  spec: PresentationSpec,
): string {
  switch (groupBy) {
    case "epic":
    case "story": {
      const node = graph.byId[key];
      return node ? scrubFace(humanizeTitle(node.title)) || key : key;
    }
    case "status":
      // `sample` shares this key by construction, so its labeled chip is the group's label.
      return stateChip(sample, spec);
    case "leverage":
      return capitalize(key);
    case "role":
      return "All";
  }
}

/** The primary sort ordinal for a group key — natural order on status/leverage, else 0 so the
 *  secondary `localeCompare` on the key drives epic/story/role order. */
function groupOrdinal(groupBy: Grouping, key: string): number {
  if (groupBy === "status") return STATUS_ORDER[key] ?? UNKNOWN_ORDINAL;
  if (groupBy === "leverage") return PRIORITY_ORDER[key] ?? UNKNOWN_ORDINAL;
  return 0;
}

// ── color resolution (pure; design D3 — a semantic token, never a hex) ───────────────────────────

/** The color token a ticket carries under `spec.colorLanguage`: status → its state key, leverage →
 *  its priority, role → a single `"default"` (no node role). The renderer maps token → palette. */
function colorFor(ticket: TicketNode, spec: PresentationSpec): string {
  switch (spec.colorLanguage) {
    case "status":
      return stateKey(ticket);
    case "leverage":
      return ticket.priority;
    case "role":
      return "default";
  }
}

// ── links (pure; design D4) ──────────────────────────────────────────────────────────────────────

/** Project every ticket's `dependsOn` into `(from → to)` links, `(from,to)`-sorted for determinism.
 *  Load-time integrity guarantees each `to` is a real ticket; the `ticketIds` guard keeps the
 *  function correct on a hand-built fixture too. Only `depends_on` is emitted — `blocks` is its
 *  inverse and would double every edge. Each link carries a `blocked` flag (E-056): since `from` is
 *  always the loop ticket `t`, it is true exactly when `t` is not done (`stateKey(t) !== "done"`,
 *  the same done-authority the rest of the layer uses) — a per-source property, hoisted accordingly. */
function buildLinks(tickets: readonly TicketNode[]): ProjectionLink[] {
  const ticketIds = new Set(tickets.map((t) => t.id));
  const links: ProjectionLink[] = [];
  for (const t of tickets) {
    const blocked = stateKey(t) !== "done"; // `from` is `t`; reuse the done-authority, no lookup
    for (const dep of t.dependsOn) {
      if (ticketIds.has(dep)) links.push({ from: t.id, to: dep, kind: "depends_on", blocked });
    }
  }
  links.sort((a, b) => a.from.localeCompare(b.from) || a.to.localeCompare(b.to));
  return links;
}

// ── the projection (the one public entry) ────────────────────────────────────────────────────────

/**
 * Project the whole `graph` through `spec` (optionally with authored `overlays`) into a
 * {@link Projection}. PURE: reads the frozen graph and spec, allocates a fresh deeply-frozen result,
 * and never touches the graph — `graph` is returned to the caller reference-unchanged (E-021
 * one-way authority; the AC's teeth). The spec ROUTES everything: `groupBy` partitions the tickets,
 * `colorLanguage` colors each card, `face`/`details`/`labels`/`vocabulary` are applied per card by
 * {@link projectNode}. Same graph + same spec → byte-identical projection (deterministic sorts, no
 * clock/random — P5 consistency).
 */
export function projectGraph(
  graph: WorkGraph,
  spec: PresentationSpec,
  overlays: ProjectionOverlays = {},
): Projection {
  // 1. project each ticket into a colored card, bucketed by its group key (insertion order kept).
  const buckets = new Map<string, { sample: TicketNode; cards: ProjectedCard[] }>();
  for (const ticket of graph.tickets) {
    const card = projectNode(ticket, spec, overlays[ticket.id]);
    const projected: ProjectedCard = { card, color: colorFor(ticket, spec) };
    const key = groupKeyFor(ticket, graph, spec);
    const bucket = buckets.get(key);
    if (bucket) bucket.cards.push(projected);
    else buckets.set(key, { sample: ticket, cards: [projected] });
  }

  // 2. materialize groups: id-sort cards within, then order groups (natural ordinal, then key).
  const groups: ProjectionGroup[] = [];
  for (const [key, { sample, cards }] of buckets) {
    cards.sort((a, b) => a.card.id.localeCompare(b.card.id));
    groups.push({ key, label: groupLabelFor(key, spec.groupBy, graph, sample, spec), cards });
  }
  groups.sort(
    (a, b) =>
      groupOrdinal(spec.groupBy, a.key) - groupOrdinal(spec.groupBy, b.key) ||
      a.key.localeCompare(b.key),
  );

  // 3. links + 4. assemble and freeze.
  return deepFreeze({
    groupBy: spec.groupBy,
    density: spec.density,
    colorLanguage: spec.colorLanguage,
    metaphor: spec.metaphor,
    groups,
    links: buildLinks(graph.tickets),
  });
}
