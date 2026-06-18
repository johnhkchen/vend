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
