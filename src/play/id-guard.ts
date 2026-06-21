// Cross-board id-collision detector (T-004-01) — the pure heart of the E-004 guard.
//
// The four gates (gates.ts `allocationGate`) already guarantee no two ids WITHIN a
// generated WorkPlan collide. This extends uniqueness past the plan to the BOARD:
// given the ids a plan would materialize and the ids already living in
// docs/active/{stories,tickets}, return the ones that clash. materialize.ts writes
// blindly (mkdir -p + writeFile, no existence check — observation 20349), so a reused
// id silently clobbers a hand-authored file; this detector is what lets T-004-02 raise
// an andon before any write. T-004-02 composes it from runDecomposeEpic, between
// `classify` and `materialize` (obs 20351).
//
// PURE: no fs, clock, network, process, or native addon — it takes plain string arrays
// (the generated ids come from `plan.*.map(x => x.id)`, the existing ones from
// project-context's `listIds`) and returns a fresh array. NOT EVEN a type-only BAML
// import: it never sees a WorkPlan, only the ids extracted from one. This is the seam
// that keeps it the purest module in the tree and decoupled from materialize /
// project-context (AC#4). Total — it never throws; `[]` means clear.

/**
 * Return the ids in `generated` that already exist in `existing` — the cross-board
 * collisions. PURE and TOTAL. The result is DEDUPED (each colliding id at most once)
 * and ordered by first appearance in `generated`; `existing` is only a membership
 * oracle, never iterated for output. An empty result means "clear — safe to
 * materialize." Inputs are not mutated.
 */
export function detectCollisions(generated: readonly string[], existing: readonly string[]): string[] {
  const existingSet = new Set(existing);
  const seen = new Set<string>();
  const collisions: string[] = [];
  for (const id of generated) {
    if (existingSet.has(id) && !seen.has(id)) {
      seen.add(id);
      collisions.push(id);
    }
  }
  return collisions;
}

// Title-keyed adoption oracle (T-043-01) — the sibling of `detectCollisions`, one axis over.
//
// `detectCollisions` catches id REUSE (a generated id already on the board). It cannot catch a
// duplicate PROPOSAL: a retried propose-epic run re-mints a FRESH max+1 id, so two cards with the
// SAME TITLE both pass the collision guard (E-039's E-041/E-042 double-mint — verdict in
// work/T-039-02). The stable identity across a retry is the TITLE (the model re-mints `card.id`
// blind each run); this oracle is what lets `proposeEpicEffect` ADOPT an existing same-title epic
// instead of minting a second one.
//
// PURE and TOTAL — like `detectCollisions`, it never touches fs/clock/addon and never throws. It
// sees only `{id, title}` (structural, no BAML import), so the module stays the purest in the tree.

/** Normalize a title to its identity for matching — trim + lowercase. `renderCard` writes
 *  `title: <card.title>` verbatim, so the on-disk title already equals the card's; this is a cheap,
 *  total guard against incidental whitespace/case drift, not a slugifier the data doesn't need. */
function normalizeTitle(s: string): string {
  return s.trim().toLowerCase();
}

/**
 * Return the id of the first existing epic whose (normalized) title matches `title`, else `null`.
 * PURE and TOTAL. A non-null result is the id to ADOPT (the proposal was already minted — idempotent
 * retry); `null` means the title is new and the effect should mint `nextEpicId` as usual. A blank
 * target never adopts (returns `null` even against a blank-titled entry) — the structural gate already
 * requires a non-empty title; this is defense in depth. First-match (input order) is deterministic.
 * `existing` is a membership oracle only; inputs are not mutated.
 */
export function findExistingByTitle(
  title: string,
  existing: ReadonlyArray<{ readonly id: string; readonly title: string }>,
): string | null {
  const target = normalizeTitle(title);
  if (target === "") return null;
  for (const epic of existing) {
    if (normalizeTitle(epic.title) === target) return epic.id;
  }
  return null;
}
