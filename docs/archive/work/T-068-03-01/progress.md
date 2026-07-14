# Progress — T-068-03-01 orphan-epic-detector

## Status: implementation complete, gate green, commit deferred to Lisa

## Steps executed

### Step 1 — `src/graph/orphan.ts` (created) ✅
Pure detector module. Two exports:
- `isOrphanEpic(epic: EpicNode): boolean` — the single source of the orphan rule
  (`epic.stories.length === 0`), with the invariant comment explaining why that equals the AC's
  "zero child stories AND zero tickets" on a built graph.
- `findOrphanEpics(graph: WorkGraph): string[]` — `graph.epics.filter(isOrphanEpic).map(id)`;
  id-sorted (follows `buildGraph`'s sort), never throws.

Types-only import (`import type { EpicNode, WorkGraph } from "./model.ts"`) keeps the module
pure/fs-free. Zero `throw` statements. Header comment follows the model.ts / doctor-core.ts
house style (provenance, purity contract, the invariant, the NOT-here list).

### Step 2 — `src/graph/orphan.test.ts` (created) ✅
7 pure unit tests over real `buildGraph` fixtures (no fs):
1. childless epic → `["E-002"]` (primary AC).
2. fully-populated board → `[]` (second AC).
3. multiple orphans (declared out of order) → `["E-001","E-003"]` (id-sorted).
4. empty board → `[]` (vacuous).
5. story-exists-but-ticketless epic → `[]` (AND-collapse boundary; out-of-slice partial-mint).
6. deterministic + `not.toThrow` (returned-data / never-throws AC).
7. `isOrphanEpic` predicate true/false directly.

### Step 3 — gate ✅
- `bun test src/graph/orphan.test.ts` → **7 pass, 0 fail**.
- `bun run build` (`tsc --noEmit`) → clean.
- `bun run check` (baml:gen + typecheck + full suite) → **1578 pass, 1 skip, 0 fail** across
  107 files. The new module is additive; no regressions.

## Deviations from plan

- **No `lint`/format script exists.** structure.md / plan.md assumed a `bun run lint`; the repo
  has none — the real gate is `bun run check` (typecheck + test), per the project's build-gate
  convention. Corrected: ran `bun run check` instead. Style was matched to `model.ts` by hand
  (semicolons, 2-space, JSDoc per export); typecheck is clean.
- **Commit not performed from this session.** Per the repo's concurrency model (Lisa serializes
  commits across threads via file locking) and the standing rule against ad-hoc commits on the
  default branch, the working tree is left staged-ready for Lisa's orchestration rather than
  committed here. The change is self-contained (two new files, nothing modified) so the commit
  is a mechanical wrap-up. Suggested message:
  `feat(doctor): orphan-epic detector — flag epics with zero stories/tickets (T-068-03-01)`.

## Files touched

- `src/graph/orphan.ts` — **new** (49 lines incl. header).
- `src/graph/orphan.test.ts` — **new** (7 tests).

Nothing modified or deleted. No shared-file edge with T-068-03-02 (which will ADD an import of
`findOrphanEpics` into the doctor probe in its own ticket).

## Acceptance criteria — met

- [x] Over a fixture board with a childless epic the detector returns that epic id (test 1).
- [x] Over a fully-populated board it returns `[]` (test 2).
- [x] Pure unit test, no fs (all fixtures in-memory via `buildGraph`).
- [x] Never throws (zero `throw` statements; `not.toThrow` asserted) — returned-data house rule.
