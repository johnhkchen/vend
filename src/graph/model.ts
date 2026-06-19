// The read-only work-graph MODEL — the PURE core of the canonical epic→story→ticket
// loader (T-021-01, story S-021-01, epic E-021 linear-presentation-surface). This module
// is the data side of E-021's data/presentation split: it turns the canonical board
// (docs/active/{epic,stories,tickets}/*.md + YAML frontmatter) into ONE typed, deeply
// frozen in-memory graph that the presentation projection reads from. One-way authority is
// the epic's hard invariant — so this module exposes NO write path: it parses, links,
// validates, FREEZES, and returns. There is no setter, no writer, no fs here at all.
//
// PURITY (house pattern, cf. materialize.ts / survey-core.ts / id-guard.ts): everything
// here is pure — parsing, coercion, linking, integrity, freezing — no fs, clock, network,
// or native addon. The ONE runtime global it uses is `Bun.YAML.parse`, which is
// deterministic (not the flaky BAML native addon the plays keep out of their cores), so
// model.test.ts stays an ordinary pure-function test over string/record fixtures. The
// IMPURE directory walk that feeds this lives in load.ts.
//
// EDGE MODEL (see design.md D2): containment edges are OBJECT references (epic.stories →
// StoryNode[], story.tickets → TicketNode[]) so the projection traverses without re-joining;
// cross/back references stay IDS (ticket.storyId, ticket.dependsOn/blocks). The object graph
// is therefore a TREE — no cycles — which makes deepFreeze a simple recursion.
//
// INTEGRITY (design.md D5): a canonical board with a dangling edge is CORRUPT DATA, the same
// class as materialize.ts's IdCollisionError — so buildGraph THROWS a typed GraphIntegrityError
// listing every unresolved edge / duplicate id, rather than returning a half-resolved graph the
// projection would render. Faithful-mirror rule: type/status/priority/phase are kept as plain
// STRINGS, never narrowed to unions — the live board carries values beyond the documented enums
// (type: chore/feature), and vocabulary validation is the projection's job, not the loader's.

// ── error classes (named, the materialize.ts IdCollisionError discipline) ────────────────────

/** A single file's frontmatter is malformed (no fence, not a mapping, a missing/wrong-typed
 *  required field). Carries the offending file so the andon names it. An EXPECTED, typed
 *  refusal — distinct from a generic fs error — thrown before the file enters the graph. */
export class GraphParseError extends Error {
  readonly file: string;
  constructor(file: string, reason: string) {
    super(`GraphParseError [${file}]: ${reason}`);
    this.name = "GraphParseError";
    this.file = file;
  }
}

/** One or more edges in the assembled graph fail to resolve (a ticket names a missing story,
 *  a story lists a missing ticket, a dangling depends_on, a story with no epic, a duplicate id).
 *  Collects ALL violations and throws once, so a corrupt board is reported in full. The graph
 *  analogue of IdCollisionError — an expected, typed refusal the caller can catch. */
export class GraphIntegrityError extends Error {
  readonly violations: readonly string[];
  constructor(violations: readonly string[]) {
    super(`GraphIntegrityError: ${violations.length} unresolved edge(s):\n- ${violations.join("\n- ")}`);
    this.name = "GraphIntegrityError";
    this.violations = violations;
  }
}

// ── node types (all readonly; string enums — faithful mirror) ────────────────────────────────

/** A parsed-but-unlinked file: its frontmatter mapping + the raw markdown body + its filename
 *  (for error context). The output of {@link parseFrontmatter}, the input to {@link buildGraph}. */
export interface RawNode {
  readonly data: Readonly<Record<string, unknown>>;
  readonly body: string;
  readonly file: string;
}

export interface TicketNode {
  readonly kind: "ticket";
  readonly id: string;
  readonly storyId: string;
  readonly title: string;
  readonly type: string;
  readonly status: string;
  readonly priority: string;
  readonly phase: string;
  readonly dependsOn: readonly string[];
  /** DERIVED inverse of dependsOn across the whole board (B blocks A iff A depends_on B), sorted. */
  readonly blocks: readonly string[];
  readonly body: string;
}

export interface StoryNode {
  readonly kind: "story";
  readonly id: string;
  /** Resolved via the id convention ({@link epicIdForStory}); non-null on a valid board. */
  readonly epicId: string | null;
  readonly title: string;
  readonly status: string;
  readonly priority: string;
  readonly tickets: readonly TicketNode[];
  readonly body: string;
}

export interface EpicNode {
  readonly kind: "epic";
  readonly id: string;
  readonly title: string;
  readonly status: string;
  readonly advances: readonly string[];
  readonly serves: string;
  /** The optional `kind:` frontmatter field (e.g. "permanent"); null when absent. */
  readonly kindLabel: string | null;
  readonly stories: readonly StoryNode[];
  readonly body: string;
}

export type AnyNode = EpicNode | StoryNode | TicketNode;

/** The whole canonical board as one frozen graph: the three node lists (id-sorted) plus a flat
 *  id→node index for O(1) lookup. `byId` is a frozen plain Record (not a Map) so a write attempt
 *  THROWS in strict mode — a frozen Map's `.set` would silently succeed (design.md D2). */
export interface WorkGraph {
  readonly epics: readonly EpicNode[];
  readonly stories: readonly StoryNode[];
  readonly tickets: readonly TicketNode[];
  readonly byId: Readonly<Record<string, AnyNode>>;
}

// ── frontmatter parsing (pure; uses the deterministic Bun.YAML global) ────────────────────────

const FENCE = /^---\n([\s\S]*?)\n---/;

/**
 * Split a markdown file into its leading YAML frontmatter (parsed) + the remaining body. PURE.
 * Throws GraphParseError when there is no leading `---` fence or the frontmatter is not a YAML
 * mapping. `Bun.YAML.parse` correctly strips inline `#` comments and handles folded `>` blocks
 * and flow arrays (verified against the live board), so no hand-rolled parser is needed.
 */
export function parseFrontmatter(text: string, file: string): RawNode {
  const m = text.match(FENCE);
  if (!m) throw new GraphParseError(file, "no leading --- frontmatter fence");
  let parsed: unknown;
  try {
    parsed = Bun.YAML.parse(m[1]!);
  } catch (e) {
    throw new GraphParseError(file, `invalid YAML frontmatter: ${(e as Error).message}`);
  }
  if (parsed === null || typeof parsed !== "object" || Array.isArray(parsed)) {
    throw new GraphParseError(file, "frontmatter is not a mapping");
  }
  const body = text.slice(m[0].length).replace(/^\n+/, "");
  return { data: parsed as Record<string, unknown>, body, file };
}

/**
 * The epic→story edge: derived PURELY by id convention (there is no `epic:` field anywhere and
 * no story-list in any epic — see research.md). A story `S-NNN[-MM]` belongs to epic `E-NNN`.
 * Single source of that rule. Throws GraphParseError on a non-`S-` id (a corrupt story file).
 */
export function epicIdForStory(storyId: string): string {
  const m = storyId.match(/^S-(\d+)/);
  if (!m) throw new GraphParseError(storyId, `story id is not S-NNN-shaped`);
  return `E-${m[1]}`;
}

// ── field coercers (boundary: turn unknown YAML into typed fields, fail loud) ──────────────────

function str(data: Readonly<Record<string, unknown>>, key: string, file: string): string {
  const v = data[key];
  if (typeof v !== "string" || v.trim().length === 0) {
    throw new GraphParseError(file, `field '${key}' must be a non-empty string`);
  }
  return v;
}

/** A descriptive text field — tolerated absent (returns ""). For non-structural prose (serves). */
function text(data: Readonly<Record<string, unknown>>, key: string): string {
  const v = data[key];
  return typeof v === "string" ? v.trim() : "";
}

/** An optional single string field (returns null when absent). For the epic `kind:` label. */
function optStr(data: Readonly<Record<string, unknown>>, key: string): string | null {
  const v = data[key];
  return typeof v === "string" ? v : null;
}

function strArray(data: Readonly<Record<string, unknown>>, key: string, file: string): string[] {
  const v = data[key];
  if (v === undefined || v === null) return [];
  if (!Array.isArray(v) || v.some((x) => typeof x !== "string")) {
    throw new GraphParseError(file, `field '${key}' must be a list of strings`);
  }
  return v as string[];
}

// ── coerced (flat, pre-link) field records ───────────────────────────────────────────────────

interface TData {
  id: string; storyId: string; title: string; type: string; status: string;
  priority: string; phase: string; dependsOn: string[]; body: string; file: string;
}
interface SData {
  id: string; title: string; status: string; priority: string; tickets: string[]; body: string; file: string;
}
interface EData {
  id: string; title: string; status: string; advances: string[]; serves: string;
  kindLabel: string | null; body: string; file: string;
}

function coerceTicket(r: RawNode): TData {
  return {
    id: str(r.data, "id", r.file),
    storyId: str(r.data, "story", r.file),
    title: str(r.data, "title", r.file),
    type: str(r.data, "type", r.file),
    status: str(r.data, "status", r.file),
    priority: str(r.data, "priority", r.file),
    phase: str(r.data, "phase", r.file),
    dependsOn: strArray(r.data, "depends_on", r.file),
    body: r.body,
    file: r.file,
  };
}

function coerceStory(r: RawNode): SData {
  return {
    id: str(r.data, "id", r.file),
    title: str(r.data, "title", r.file),
    status: str(r.data, "status", r.file),
    priority: str(r.data, "priority", r.file),
    tickets: strArray(r.data, "tickets", r.file),
    body: r.body,
    file: r.file,
  };
}

function coerceEpic(r: RawNode): EData {
  return {
    id: str(r.data, "id", r.file),
    title: str(r.data, "title", r.file),
    status: str(r.data, "status", r.file),
    advances: strArray(r.data, "advances", r.file),
    serves: text(r.data, "serves"),
    kindLabel: optStr(r.data, "kind"),
    body: r.body,
    file: r.file,
  };
}

// ── deep freeze (recursive; the tree shape guarantees termination) ────────────────────────────

/**
 * Recursively Object.freeze every plain object and array reachable from `value`, returning it.
 * The `isFrozen` guard makes shared references (a node appears in both its parent's child array
 * and in `byId`) cost nothing and terminates — there are no cycles, since every back/cross edge
 * is an id string, not an object. A frozen object/array throws on write in ESM strict mode (the
 * runtime half of the read-only guarantee; the `readonly` types are the compile-time half).
 */
export function deepFreeze<T>(value: T): T {
  if (value !== null && typeof value === "object" && !Object.isFrozen(value)) {
    Object.freeze(value);
    for (const key of Object.keys(value as object)) {
      deepFreeze((value as Record<string, unknown>)[key]);
    }
  }
  return value;
}

// ── the builder: coerce → guard dup → link (objects) → derive blocks → validate → freeze ──────

/**
 * Build the typed, deeply-frozen WorkGraph from the three raw node lists. PURE. The ONE place
 * the canonical DAG is assembled and validated. Ordering (design.md D5):
 *   1. coerce each list (fail fast with GraphParseError naming the file);
 *   2. duplicate-id guard across all nodes;
 *   3. derive `blocks` (the inverse of every depends_on edge);
 *   4. link containment as OBJECT refs, bottom-up (ticket → story → epic), collecting EVERY
 *      unresolved edge as a violation;
 *   5. if any violation → throw GraphIntegrityError listing all of them;
 *   6. assemble id-sorted lists + the byId index, deepFreeze, return.
 * Throws GraphParseError (malformed file) or GraphIntegrityError (unresolved edges); never
 * returns a partial or mutable graph.
 */
export function buildGraph(
  epicsRaw: readonly RawNode[],
  storiesRaw: readonly RawNode[],
  ticketsRaw: readonly RawNode[],
): WorkGraph {
  const violations: string[] = [];

  // 1. coerce
  const eData = epicsRaw.map(coerceEpic);
  const sData = storiesRaw.map(coerceStory);
  const tData = ticketsRaw.map(coerceTicket);

  // 2. duplicate-id guard (across every node kind)
  const seenIn = new Map<string, string>();
  for (const d of [...eData, ...sData, ...tData]) {
    const prior = seenIn.get(d.id);
    if (prior) violations.push(`duplicate id '${d.id}' (in ${prior} and ${d.file})`);
    else seenIn.set(d.id, d.file);
  }

  const epicIds = new Set(eData.map((e) => e.id));
  const storyIds = new Set(sData.map((s) => s.id));
  const ticketIds = new Set(tData.map((t) => t.id));

  // 3. derive blocks (B blocks A  iff  A depends_on B); validate depends_on resolves
  const blocksOf = new Map<string, string[]>();
  for (const t of tData) {
    for (const dep of t.dependsOn) {
      if (!ticketIds.has(dep)) {
        violations.push(`ticket '${t.id}' depends_on missing ticket '${dep}'`);
        continue;
      }
      const arr = blocksOf.get(dep) ?? [];
      arr.push(t.id);
      blocksOf.set(dep, arr);
    }
  }
  for (const arr of blocksOf.values()) arr.sort();

  // 4a. ticket nodes
  const ticketNodes = new Map<string, TicketNode>();
  for (const t of tData) {
    if (!storyIds.has(t.storyId)) violations.push(`ticket '${t.id}' references missing story '${t.storyId}'`);
    ticketNodes.set(t.id, {
      kind: "ticket",
      id: t.id, storyId: t.storyId, title: t.title, type: t.type, status: t.status,
      priority: t.priority, phase: t.phase, dependsOn: t.dependsOn,
      blocks: blocksOf.get(t.id) ?? [], body: t.body,
    });
  }

  // 4b. story nodes (child tickets as objects, epic resolved by convention)
  const storyNodes = new Map<string, StoryNode>();
  for (const s of sData) {
    const childTickets: TicketNode[] = [];
    for (const tid of s.tickets) {
      const tn = ticketNodes.get(tid);
      if (!tn) { violations.push(`story '${s.id}' lists missing ticket '${tid}'`); continue; }
      childTickets.push(tn);
    }
    const epicId = epicIdForStory(s.id);
    if (!epicIds.has(epicId)) violations.push(`story '${s.id}' has no epic '${epicId}'`);
    storyNodes.set(s.id, {
      kind: "story",
      id: s.id, epicId: epicIds.has(epicId) ? epicId : null, title: s.title,
      status: s.status, priority: s.priority, tickets: childTickets, body: s.body,
    });
  }

  // 4c. epic nodes (child stories as objects, grouped by convention, id-sorted)
  const storiesByEpic = new Map<string, StoryNode[]>();
  for (const sn of storyNodes.values()) {
    if (sn.epicId === null) continue;
    const arr = storiesByEpic.get(sn.epicId) ?? [];
    arr.push(sn);
    storiesByEpic.set(sn.epicId, arr);
  }
  const byId: Record<string, AnyNode> = {};
  const epicNodes: EpicNode[] = eData.map((e) => {
    const children = (storiesByEpic.get(e.id) ?? []).sort((a, b) => a.id.localeCompare(b.id));
    return {
      kind: "epic",
      id: e.id, title: e.title, status: e.status, advances: e.advances,
      serves: e.serves, kindLabel: e.kindLabel, stories: children, body: e.body,
    };
  });

  // 5. one andon for the whole corrupt board
  if (violations.length > 0) throw new GraphIntegrityError(violations);

  // 6. assemble (id-sorted), index, freeze
  const stories = [...storyNodes.values()].sort((a, b) => a.id.localeCompare(b.id));
  const tickets = [...ticketNodes.values()].sort((a, b) => a.id.localeCompare(b.id));
  epicNodes.sort((a, b) => a.id.localeCompare(b.id));
  for (const n of epicNodes) byId[n.id] = n;
  for (const n of stories) byId[n.id] = n;
  for (const n of tickets) byId[n.id] = n;

  return deepFreeze({ epics: epicNodes, stories, tickets, byId });
}
