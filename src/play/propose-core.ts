// The ProposeEpic play's PURE core (T-009-02, story S-009-01, epic E-009) — the play's
// testable judgment: the three PE gates (value → bounds → structural) over an EpicCard, the
// pure card→markdown renderer, and the epic-id mint. The addon-free mirror of gates.ts's
// `clear` (one level up — over a single CARD, not a WorkPlan) and materialize.ts's pure
// `renderTicketFile`.
//
// Split from the (future) impure ProposeEpic shell (T-009-03) for the house reason every
// play splits its core: the shell value-imports `b` from baml_client/sync_client, loading
// the BAML native addon whose once-driven reactor makes a `bun test` process flaky (obs
// 20213/20532). Keeping the gates + renderer + mint HERE — with the `EpicCard` and
// `GateVerdict` imports TYPE-ONLY (erased under verbatimModuleSyntax) — lets
// propose-core.test.ts exercise all of it as an ordinary pure-function test, no addon ever
// loaded (the gates.ts / materialize.ts / note-core.ts discipline). The ONLY runtime import
// is `detectCollisions` — itself the purest module in the tree (no BAML import at all), so
// the addon-free guarantee holds through it.
//
// PURE: no fs, clock, network, process, or native addon. The gates judge an already-parsed
// EpicCard; a STOP is RETURNED DATA (an expected andon), never a throw — the gates.ts house
// rule (a programmer error throws; an unworthy card is a returned STOP). The renderer's
// `alias()` is the one exception: an out-of-map enum member is enum/map DRIFT (a programmer
// error), so it throws RangeError exactly as materialize.ts's `alias` does.

import type { EpicCard } from "../../baml_client/index.ts";
import type { GateVerdict } from "../engine/play.ts";
import { detectCollisions } from "./id-guard.ts";

// ── the PE gate set ─────────────────────────────────────────────────────────────────────

/** The three PE gates, in value-priority order — the single source of ordering. `clear()`
 *  runs them in this sequence and a CLEAR echoes it. One level up from gates.ts's four:
 *  there is no `allocation` gate (a single card has no dependency DAG to keep acyclic). */
export const PE_GATE_NAMES = ["value", "bounds", "structural"] as const;
export type PEGateName = (typeof PE_GATE_NAMES)[number];

/**
 * What the pure gates need beyond the card. `charter` is greped at call time for the live
 * `P#`/`N#` ids (bounds) — alignment recomputed, never stored, so retiring an invariant
 * makes a dangling `advances` ref a detectable defect (charter §"How planning uses this
 * charter"). `existingEpicIds` is the live board (the `E-0XX` basenames under
 * docs/active/epic) — the structural gate's disjointness oracle and `nextEpicId`'s input.
 * T-009-03 builds this impurely (read charter, `listIdsIn(epicDir)`); the core stays pure.
 */
export interface ProposeClearContext {
  readonly charter: string;
  readonly existingEpicIds: readonly string[];
}

// ── member → alias maps (renderer support, the materialize.ts pattern) ──────────────────
// `b.parse` returns the enum MEMBER name ("Blue", "Permanent", "Rare"); card frontmatter /
// the stat-block want the lowercase card-model token — the `@alias` in propose.baml. These
// maps are fixed by those aliases (the single source of the mapping).

export const COLOR_ALIAS: Readonly<Record<string, string>> = {
  White: "white",
  Blue: "blue",
  Black: "black",
  Red: "red",
  Green: "green",
};

export const CARD_TYPE_ALIAS: Readonly<Record<string, string>> = {
  Sorcery: "sorcery",
  Permanent: "permanent",
};

export const RARITY_ALIAS: Readonly<Record<string, string>> = {
  Common: "common",
  Uncommon: "uncommon",
  Rare: "rare",
  Mythic: "mythic",
};

/** Map an enum member through one alias table, throwing on an unknown key — a programmer
 *  error meaning the BAML enum drifted from this map (the materialize.ts house rule: a
 *  wiring/drift error THROWS; it is never a silently-wrong card token). */
function alias(table: Readonly<Record<string, string>>, member: string, field: string): string {
  const a = table[member];
  if (a === undefined) {
    throw new RangeError(`renderCard: no alias for ${field} member ${JSON.stringify(member)} (enum/map drift)`);
  }
  return a;
}

// ── pure helpers ────────────────────────────────────────────────────────────────────────

/** A usable string field: present and non-blank after trimming (the gates.ts/note-core idiom). */
function nonEmpty(s: unknown): boolean {
  return typeof s === "string" && s.trim().length > 0;
}

/** Grep stable invariant/non-goal ids (`P1`, `N4`, …) out of a charter string — the
 *  gates.ts `matchIds` discipline, so the bounds gate derives its valid set from the LIVE
 *  charter at call time rather than a hardcoded list. */
function matchIds(text: string, prefix: "P" | "N"): Set<string> {
  const out = new Set<string>();
  for (const m of text.matchAll(new RegExp(`\\b${prefix}\\d+\\b`, "g"))) {
    if (m[0]) out.add(m[0]);
  }
  return out;
}

/** Render a list as a YAML flow array matching the hand-authored cards (`[]` / `[P1, P2]`),
 *  the materialize.ts `flowArray`. */
function flowArray(items: readonly string[]): string {
  return `[${items.join(", ")}]`;
}

/** True for an `advances` entry shaped like a non-goal id (`N4`), after trimming. The charter's
 *  non-goal set is a subset of these (they are all `N\d+`), so this shape test alone identifies
 *  every non-goal without needing the charter — the decompose-core `isNonGoalAdvance` twin. */
const isNonGoalAdvance = (claim: string): boolean => /^N\d+$/.test(claim.trim());

/**
 * Drop every non-goal (`N\d+`) entry from an epic card's `advances`, returning a NEW card (PURE —
 * never mutates the input). The EPIC-LEVEL half of the honey-kitchen field fix (#1): the propose
 * model recurrently mis-tags a whole card with `advances:<Nx>` on epics that are ABOUT respecting a
 * non-goal (an access gate ↔ N2 "one couple"), and the propose bounds gate then HALTS the entire
 * chain before decomposition — nothing materializes, so a retry can't recover it (unlike the
 * ticket-level variant). Stripping the code before gating lets a card that also advances a real
 * invariant clear; a card that named ONLY a non-goal collapses to an empty `advances` and honestly
 * trips the value gate (PE-3), the retry-able "advances nothing" verdict. Applied in the play's
 * `parse`, so the written `E-0XX.md` never carries the bogus code; the raw reply stays in the transcript.
 */
export function stripNonGoalAdvances(card: EpicCard): EpicCard {
  if (!Array.isArray(card.advances) || !card.advances.some(isNonGoalAdvance)) return card;
  return { ...card, advances: card.advances.filter((a) => !isNonGoalAdvance(a)) };
}

/** Epic-card id shape — `E-` + exactly three digits (the R6 granularity, one level up from
 *  the ticket/story ids). */
const EPIC_ID_RE = /^E-\d{3}$/;

/** The card frontmatter + body fields that must be present and non-empty for the card to
 *  materialize to a valid `E-0XX.md`. Enum-valued fields (`kind/type/rarity`) are checked
 *  for PRESENCE only — BAML guarantees the *value* is in-set, so re-checking duplicates the
 *  type (the gates.ts `REQUIRED_TICKET_FIELDS` rule). `color` is handled separately (it is
 *  an array, not a scalar). */
const REQUIRED_CARD_FIELDS = [
  "id",
  "title",
  "kind",
  "serves",
  "manaCost",
  "type",
  "rarity",
  "intent",
  "value",
  "doneLooksLike",
  "context",
] as const;

// ── the three gates: (card, ctx) => Offense | null ──────────────────────────────────────

/** One gate's finding: the offending unit + why, or `null` for "passed" (the gates.ts shape). */
interface Offense {
  readonly unit: string;
  readonly reason: string;
}

/**
 * VALUE — the card states value and names what it advances; nothing that advances nothing
 * nameable settles (overproduction is the worst waste — charter criterion 1, PE-4). The
 * demand signal is an INPUT, not a card field, so "traces to a signal" is checked here as
 * the presence of the value-bearing fields a worthwhile card must carry. A present-but-empty
 * SAP reply (blank-stringed card) fails here — the empty-degradation a parser cannot reject
 * (the note-core lesson, applied to a card).
 */
function valueGate(card: EpicCard): Offense | null {
  if (!nonEmpty(card.serves)) {
    return { unit: card.id || "<card>", reason: "no `serves` — the card must name the value it realizes (PE-4)" };
  }
  if (!Array.isArray(card.advances) || card.advances.length === 0 || !card.advances.every(nonEmpty)) {
    return { unit: card.id || "<card>", reason: "`advances` is empty — must name a charter value it advances (PE-3, never empty)" };
  }
  if (!nonEmpty(card.value)) {
    return { unit: card.id || "<card>", reason: "no `value` — the card must say what capability/quality it realizes" };
  }
  if (!nonEmpty(card.intent)) {
    return { unit: card.id || "<card>", reason: "no `intent` — the card must state the bigger-picture play (PE-6)" };
  }
  return null;
}

/**
 * BOUNDS — the `advances` claims actually hold and no non-goal is advanced (PE-5; the
 * charter's "detectable defect" rule, recomputed here — a faithful copy of gates.ts's
 * boundsGate over the card's `advances`). An entry naming a non-goal (`N\d+`) is incoherent
 * — you cannot *advance* a non-goal; a `P\d+`-shaped entry absent from THIS charter is a
 * dangling ref. Free-text entries (epic-outcome prose, no grep-able id) are human-judgment
 * territory and are not failed by rule. PE-5's "prerequisites named" is likewise semantic
 * (is this prose a real prerequisite?) — not purely decidable, so not rule-failed here.
 *
 * NON-GOAL BACKSTOP: the play strips `N\d+` codes from a card's `advances` in `parse`
 * (`stripNonGoalAdvances`, honey-kitchen field fix #1), the EPIC-LEVEL half of the fix — an
 * epic-level mis-tag halts the whole chain BEFORE decomposition, so a retry can't recover it.
 * On the normal path the non-goal branch below never fires; it is KEPT as defense-in-depth for a
 * caller that clears an un-normalized card directly (e.g. the propose-core unit tests).
 */
function boundsGate(card: EpicCard, ctx: ProposeClearContext): Offense | null {
  const invariants = matchIds(ctx.charter, "P");
  const nonGoals = matchIds(ctx.charter, "N");
  for (const claim of card.advances) {
    const ref = claim.trim();
    if (/^N\d+$/.test(ref) || nonGoals.has(ref)) {
      return { unit: card.id || "<card>", reason: `advances \`${ref}\` — cannot advance a non-goal (PE-5)` };
    }
    if (/^P\d+$/.test(ref) && !invariants.has(ref)) {
      return { unit: card.id || "<card>", reason: `advances \`${ref}\` — no such invariant in the charter (dangling ref)` };
    }
  }
  return null;
}

/**
 * STRUCTURAL — the last fixture on the way out (gates.ts orders it "only now"): valid card
 * frontmatter, and the minted epic id is DISJOINT from the live board. Required fields are
 * present + non-empty; `color` is a non-empty array (PE-3, "never empty" — the array
 * SAP-degrades to `[]`); the id is well-formed `E-0XX`; `kind === type` (the same axis
 * rendered twice must agree — T-009-01 D3); and the id collides with no existing epic —
 * `detectCollisions` reused verbatim (the E-004 guard at epic granularity).
 */
function structuralGate(card: EpicCard, ctx: ProposeClearContext): Offense | null {
  for (const field of REQUIRED_CARD_FIELDS) {
    if (!nonEmpty(card[field])) {
      return { unit: nonEmpty(card.id) ? card.id : "<card>", reason: `missing required field \`${field}\`` };
    }
  }
  if (!Array.isArray(card.color) || card.color.length === 0) {
    return { unit: card.id, reason: "`color` is empty — every card names at least one discipline (PE-3)" };
  }
  if (!EPIC_ID_RE.test(card.id)) {
    return { unit: card.id, reason: `id \`${card.id}\` is not a valid epic id (expected E-0XX)` };
  }
  if (card.kind !== card.type) {
    return { unit: card.id, reason: `\`kind\` (${card.kind}) and \`type\` (${card.type}) disagree — the same axis must match` };
  }
  const collisions = detectCollisions([card.id], ctx.existingEpicIds);
  if (collisions.length > 0) {
    return { unit: card.id, reason: `id \`${card.id}\` already on the board — must be disjoint (E-004 discipline)` };
  }
  return null;
}

// ── the public clearing function ────────────────────────────────────────────────────────

/** The ordered gate table — names match `PE_GATE_NAMES`, so value-ordering is encoded once. */
const GATES: ReadonlyArray<readonly [PEGateName, (card: EpicCard, ctx: ProposeClearContext) => Offense | null]> = [
  ["value", (c) => valueGate(c)],
  ["bounds", (c, ctx) => boundsGate(c, ctx)],
  ["structural", (c, ctx) => structuralGate(c, ctx)],
];

/**
 * Clear an EpicCard through the three value-ordered PE gates. Returns the FIRST gate's STOP
 * (the andon — the line stops, it does not accumulate findings or run later gates), or a
 * CLEAR echoing every gate name (so the cast loop logs one passed row per gate, parity with
 * DecomposeEpic). Returns the engine's play-agnostic `GateVerdict` so it drops straight into
 * `Play.gates` at registration (T-009-03), exactly as `clearNote` does — gates.ts's
 * `GateResult` is the same discriminated-union shape, structurally assignable to this.
 *
 * Reporting the highest-priority defect is the feature: a card that both advances nothing
 * (value) and collides (structural) is reported as a VALUE failure. A STOP is RETURNED DATA,
 * never a throw — an expected andon is data, not an exception (the gates.ts house rule).
 */
export function clear(card: EpicCard, ctx: ProposeClearContext): GateVerdict {
  for (const [gate, run] of GATES) {
    const offense = run(card, ctx);
    if (offense) return { status: "stop", gate, unit: offense.unit, reason: offense.reason };
  }
  return { status: "clear", cleared: [...PE_GATE_NAMES] };
}

// ── the epic-id mint ────────────────────────────────────────────────────────────────────

/**
 * Compute the next free epic id — `E-0XX`, one past the highest `E-NNN` on the board. PURE
 * and TOTAL: scans `existing` for `E-<digits>`, takes the numeric max, `+1`, zero-pads to
 * three. An empty/`E-`-less board → `E-001`. Tolerates ragged widths (`E-9` counts as 9).
 *
 * This is the id ASSIGNMENT the T-009-03 effect calls when it mints the card it writes —
 * kept OUT of the structural gate (a gate judges; it does not assign), but in this module so
 * both the disjointness CHECK (the gate) and the mint share one `existingEpicIds` source and
 * one definition of "the board". The AC's "structural … mints the next free id" is satisfied
 * by this pair living together.
 */
export function nextEpicId(existing: readonly string[]): string {
  let max = 0;
  for (const id of existing) {
    const m = /^E-(\d+)$/.exec(id.trim());
    if (m && m[1]) {
      const n = Number.parseInt(m[1], 10);
      if (n > max) max = n;
    }
  }
  return `E-${String(max + 1).padStart(3, "0")}`;
}

// ── the card renderer ───────────────────────────────────────────────────────────────────

/**
 * Render an EpicCard → the `E-0XX.md` markdown — frontmatter + the card stat-block + the
 * body. PURE (the materialize.ts `renderTicketFile` pattern): member→alias mapping, line
 * arrays joined with "\n", deterministic output. The frontmatter carries the epic-on-disk
 * fields (id/title/status/kind/advances/serves — E-009's shape); the stat-block carries the
 * four fields frontmatter omits (manaCost/color/type/rarity), so the markdown ROUND-TRIPS
 * every card field (the AC). A freshly proposed card is `status: open` — not yet cleared by
 * DecomposeEpic. A trailer names the play, the note-core honesty convention.
 *
 * Throws RangeError only on enum/alias drift (an out-of-map member) — a programmer error,
 * never an unworthy-card outcome (the materialize.ts rule).
 */
export function renderCard(card: EpicCard): string {
  const kindAlias = alias(CARD_TYPE_ALIAS, card.kind, "kind");
  const typeAlias = alias(CARD_TYPE_ALIAS, card.type, "type");
  const rarityAlias = alias(RARITY_ALIAS, card.rarity, "rarity");
  const colorAliases = card.color.map((c) => alias(COLOR_ALIAS, c, "color"));

  const frontmatter = [
    "---",
    `id: ${card.id}`,
    `title: ${card.title}`,
    "status: open", // a freshly proposed card — not yet cleared by DecomposeEpic
    `kind: ${kindAlias}`,
    `advances: ${flowArray(card.advances)}`,
    "serves: >",
    `  ${card.serves}`,
    "---",
  ].join("\n");

  const statBlock = [
    "```",
    `${card.title}   ${card.manaCost}`,
    `${typeAlias} — ${colorAliases.join(", ")}   (rarity: ${rarityAlias})`,
    "```",
    "",
    "_Proposed by Vend's `propose-epic` play._",
  ].join("\n");

  const body = [
    "## Intent — the bigger-picture play",
    "",
    card.intent,
    "",
    "## Value to the design",
    "",
    card.value,
    "",
    "## Done looks like",
    "",
    card.doneLooksLike,
    "",
    "## Context & constraints",
    "",
    card.context,
    "",
  ].join("\n");

  return `${frontmatter}\n\n${statBlock}\n\n${body}`;
}
