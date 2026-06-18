# Structure — T-004-01 pure-id-collision-detector

The blueprint: which files change, the public interface, internal organization,
and ordering. Not code — the shape of it.

## Files

| File | Action | Why |
|------|--------|-----|
| `src/play/id-guard.ts` | **create** | The pure detector (AC#1). |
| `src/play/id-guard.test.ts` | **create** | Pinned colliding/disjoint/order/dedup tests (AC#2). |

No existing files are modified or deleted. In particular `materialize.ts`,
`project-context.ts`, `decompose-epic.ts`, and `gates.ts` are **untouched** —
T-004-02 composes this module; this ticket only adds it.

## `src/play/id-guard.ts` — internal organization

Top-to-bottom, mirroring the sibling modules' layout (header comment → exported
contract):

1. **File header comment** (~12 lines). States: the cross-board uniqueness role,
   the relationship to the in-plan `allocationGate` (this extends uniqueness past
   the plan to the board), and the purity note — PURE, takes plain `string[]`, no
   fs/clock/addon, *not even a type-only BAML import*. Calls out that T-004-02
   composes it from `runDecomposeEpic` between `classify` and `materialize`.

2. **`detectCollisions` — the single public export.** No helpers needed; the body
   is a `Set` + a guarded loop. Signature:

   ```ts
   export function detectCollisions(
     generated: readonly string[],
     existing: readonly string[],
   ): string[]
   ```

   Contract (from Design):
   - Returns ids present in BOTH inputs.
   - Deduped: each colliding id appears at most once (D3).
   - Ordered by first appearance in `generated` (D4).
   - Total: never throws; `[]` when disjoint or either input empty (D5/D6).
   - Pure: no side effects; inputs not mutated.

   Internal shape:
   - `const existingSet = new Set(existing)` — membership oracle.
   - `const seen = new Set<string>()` — dedup guard.
   - `const out: string[] = []`.
   - single `for (const id of generated)`: if `existingSet.has(id)` and
     `!seen.has(id)`, push and mark seen.
   - `return out`.

That is the whole module — one exported function, ~10 lines of body under a
documented header. No private helpers, no constants table.

## `src/play/id-guard.test.ts` — test plan shape

`bun:test` (`describe`/`test`/`expect`), matching `materialize.test.ts` style.
No baml imports at all (this module has none). Test groups:

1. **`describe("detectCollisions — cross-board intersection")`**
   - colliding fixture returns **exactly** the reused ids (AC#2). Fixture: a
     generated set sharing two ids with existing; assert `toEqual([...])` with the
     exact expected array (exact, not `toContain`, to pin both membership and order).
   - disjoint fixture returns `[]` (AC#2).
   - empty `generated` → `[]`; empty `existing` → `[]` (totality, D5/D6).

2. **`describe("order & dedup are pinned")`** (AC#2 "order/dedup behavior pinned")
   - order follows first appearance in `generated`: feed collisions whose order
     in `generated` differs from their order in `existing`; assert the result
     matches `generated`'s order, proving `existing` order is irrelevant.
   - a colliding id repeated in `generated` appears once: assert dedup.
   - a non-colliding id repeated in `generated` never appears (sanity).

3. **`describe("purity — inputs not mutated")`**
   - pass frozen (`Object.freeze`) input arrays / capture copies and assert the
     originals are unchanged after the call (the function takes `readonly` and
     must not mutate — cheap guarantee, makes purity executable).

## Public interface (the contract T-004-02 consumes)

The module exports exactly one symbol, `detectCollisions`. T-004-02 will:
- extract generated ids: `[...plan.stories.map(s => s.id), ...plan.tickets.map(t => t.id)]`,
- gather existing ids via `project-context`'s `listIds` (stories + tickets),
- call `detectCollisions(generated, existing)`,
- if the result is non-empty, raise the andon (refuse materialize, log outcome).

None of that composition lives here. The seam is the plain-array signature.

## Ordering of changes

Single atomic unit — module + test created together, committed once. There is no
internal sequencing (no dependency between sub-steps); the Plan phase records it
as one implement step with a verify gate. No changes to build config, no new
deps, no scaffolding.

## Boundaries honored

- **Purity:** no fs/clock/network/process/addon import; not even `import type`
  from baml. Verified by the test running as a plain pure-function test.
- **No coupling:** zero imports from `materialize.ts` / `project-context.ts` /
  `decompose-epic.ts` (AC#4).
- **Green bar:** additive only — the 114 existing tests are unaffected; new tests
  extend the suite (AC#3).
