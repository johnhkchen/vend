# Progress — T-004-01 pure-id-collision-detector

## Status: complete

All three plan steps executed; full green bar verified.

## Steps

### Step 1 — `src/play/id-guard.ts` ✅
Created the module exactly per Structure/Design: header comment (purity +
cross-board role + T-004-02 seam), single `detectCollisions` export, `Set`
membership oracle + `seen` dedup guard + first-appearance-order loop, total (no
throw). No baml import, no fs/clock/addon. `bun run check:typecheck` → clean.

### Step 2 — `src/play/id-guard.test.ts` ✅
Created three `describe` blocks: intersection (exact reused ids via `toEqual`,
disjoint `[]`, empty-input `[]`×2), order & dedup pinned (order follows
`generated` not `existing`; repeated colliding id once; repeated non-colliding id
absent), purity (frozen inputs unchanged). 8 tests, all green.

### Step 3 — green bar + commit ✅
- `bun run check:typecheck` → no errors.
- `bun test src/play/id-guard.test.ts` → 8 pass / 0 fail.
- `bun test` (full) → **122 pass / 0 fail** (was 114; +8, no regression).
- Committed module + test as one atomic change.

## Deviations from plan

None. The plan was followed step for step. The function body landed at ~10 lines
as Structure predicted; no private helpers were needed.

## Notes for T-004-02 (the downstream composer)

- Call seam: `detectCollisions([...plan.stories.map(s => s.id),
  ...plan.tickets.map(t => t.id)], existingIds)` where `existingIds` comes from
  `project-context`'s `listIds` over stories + tickets. Non-empty result ⇒ raise
  the andon (refuse materialize, log a collision outcome) BETWEEN `classify` and
  `materialize` in `runDecomposeEpic` (obs 20351).
- The result is already deduped and plan-ordered, suitable for a human-facing
  andon message verbatim.
