// The orphan-epic DETECTOR — a PURE board-hygiene scan over the built work-graph (T-068-03-01,
// story S-068-03 orphan-epic-hygiene, epic E-068 price-true-budget-units). It finds an epic
// left with zero child stories (⟹ zero descendant tickets — see the invariant below): the
// half-minted residue a terminally-failed `decompose-epic` leg leaves behind. Its consumer is
// the `vend doctor` board-hygiene check (T-068-03-02), which loads the board and turns a
// non-empty result into a red `Check` — so doctor goes non-green on a half-minted board instead
// of staying green on it.
//
// PURITY (the model.ts / doctor-core.ts discipline): the only import is a TYPE (erased under
// verbatimModuleSyntax), so this module touches no fs, clock, network, addon, or process. It
// reads the already-built, integrity-validated frozen WorkGraph and returns fresh data. So
// orphan.test.ts is an ordinary pure-function test over in-memory buildGraph fixtures.
//
// HOUSE RULE (doctor-core.ts / budget.ts): an offending outcome is RETURNED data, never thrown.
// "An orphan epic exists" is an expected finding — the whole point of a hygiene scan — modelled
// as a returned id list, not an exception. This module has ZERO throws and is TOTAL over any
// WorkGraph.
//
// THE INVARIANT that makes "zero child stories" == the ticket's "zero child stories AND zero
// tickets": buildGraph (model.ts) links a ticket to an epic ONLY through its parent story
// (ticket.storyId → story, story → epic by the epicIdForStory id convention), and a missing
// story/epic on either edge is a GraphIntegrityError thrown at build time. So on any validly
// built WorkGraph a ticket can reach an epic ONLY via an existing story — an epic with zero
// stories therefore has zero descendant tickets. Checking `stories.length === 0` is exactly the
// AC's "zero stories AND zero tickets" (an epic that HAS a story whose ticket-list is empty is a
// DIFFERENT partial-mint — it is not childless — and is out of this slice).
//
// NOT HERE: the doctor Check / fix-it hint / exit-code surface (T-068-03-02, the impure probe);
// auto-repair (deleting the card or re-casting decompose — metered/destructive, deferred); and
// the chain-rollback alternative (named-but-deferred). This module only REPORTS ids.

import type { EpicNode, WorkGraph } from "./model.ts";

/**
 * Is `epic` an ORPHAN — i.e. does it have no child stories? The single source of the orphan
 * rule. On a built {@link WorkGraph} a story is the only path from a ticket up to an epic (see
 * the module header's invariant), so zero stories ⟹ zero descendant tickets — this predicate is
 * exactly the ticket's "zero child stories AND zero tickets". PURE.
 */
export function isOrphanEpic(epic: EpicNode): boolean {
  return epic.stories.length === 0;
}

/**
 * Scan a built {@link WorkGraph} for orphan epics and return their ids. PURE, TOTAL, fs-free,
 * throws nothing (the returned-data house rule): the body is a `filter`/`map` over `graph.epics`
 * and a `.length` read, none of which can throw for any WorkGraph value. Order follows
 * `graph.epics`, which `buildGraph` returns id-sorted — so the output is id-sorted with no extra
 * sort. Returns `[]` when the board has no orphan (or no epics at all).
 */
export function findOrphanEpics(graph: WorkGraph): string[] {
  return graph.epics.filter(isOrphanEpic).map((epic) => epic.id);
}
