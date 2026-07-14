# Structure — T-068-03-01 orphan-epic-detector

## Files

| File | Action | Purpose |
|------|--------|---------|
| `src/graph/orphan.ts` | **create** | The pure detector: `findOrphanEpics` + `isOrphanEpic`. |
| `src/graph/orphan.test.ts` | **create** | Pure unit test — both AC branches + edges, no fs. |

No files are modified or deleted. T-068-03-02 (`doctor-orphan-check`) will later ADD an import
of `findOrphanEpics` into the doctor probe; that is a separate ticket and a separate file, so
there is no shared-file edge between the two tickets beyond the (declared) dependency.

## `src/graph/orphan.ts` — module layout

Header comment (house style, cf. `model.ts` / `doctor-core.ts`):
- names the ticket/story/epic (T-068-03-01 / S-068-03 / E-068);
- states the pure/total/fs-free/never-throws contract (the returned-data house rule);
- states the load-bearing invariant: on a *built* `WorkGraph`, zero child stories ⟹ zero
  descendant tickets (a ticket reaches an epic ONLY via a story — `storyId` + `epicIdForStory`,
  both integrity-checked in `buildGraph`), so "zero stories" == the AC's "zero stories AND zero
  tickets";
- states what is NOT here (the doctor Check/hint/exit-code surface, T-068-03-02; auto-repair;
  chain-rollback).

Imports (types only — erased, keeps the module pure):
```ts
import type { EpicNode, WorkGraph } from "./model.ts";
```

Public surface (two exports):
```ts
export function isOrphanEpic(epic: EpicNode): boolean;   // the single-node predicate (orphan rule)
export function findOrphanEpics(graph: WorkGraph): string[]; // the board-scan → id list
```

Internal organization: `isOrphanEpic` is the one source of the orphan rule
(`epic.stories.length === 0`, with the invariant comment). `findOrphanEpics` is a thin
`filter(isOrphanEpic).map(id)` over `graph.epics`, so ordering follows the graph's id-sorted
`epics` with no extra sort. No private helpers, no module state, no side effects.

## `src/graph/orphan.test.ts` — test layout

Imports:
```ts
import { describe, expect, test } from "bun:test";
import { buildGraph, type RawNode } from "./model.ts";
import { findOrphanEpics, isOrphanEpic } from "./orphan.ts";
```

Fixture builders (copied from `model.test.ts` shape so the test reads like its neighbour):
```ts
const raw    = (file, data, body="") => ({ data, body, file });
const epic   = (id)             => raw(`${id}.md`, { id, title:`e-${id}`, status:"open", advances:["P1"] });
const story  = (id, tickets)    => raw(`${id}.md`, { id, title:`s-${id}`, type:"story", status:"open", priority:"high", tickets });
const ticket = (id, story, deps=[]) => raw(`${id}.md`, { id, story, title:`t-${id}`, type:"task", status:"open", priority:"high", phase:"ready", depends_on:deps });
```

Test cases (one `describe("findOrphanEpics")` + a small `describe("isOrphanEpic")`):

1. **AC — childless epic is returned by id.** A board with a populated epic (`E-001` →
   `S-001-01` → `T-001-01`) plus a childless epic (`E-002`, no stories, no tickets).
   `findOrphanEpics` returns `["E-002"]` exactly.
2. **AC — fully-populated board returns `[]`.** Every epic has ≥1 story with ≥1 ticket ⇒ `[]`.
3. **Multiple orphans returned in id-sorted order.** `E-003` and `E-001` both childless (plus a
   populated `E-002`) ⇒ `["E-001", "E-003"]` — proves order follows `buildGraph`'s id sort.
4. **Empty board → `[]`.** `buildGraph([],[],[])` ⇒ no epics ⇒ `[]` (vacuous, never throws).
5. **"Story exists but ticketless" is NOT an orphan.** An epic whose one story has an empty
   ticket list has `stories.length > 0` ⇒ NOT flagged (guards the AND-collapse boundary; the
   partial-mint that is out-of-slice).
6. **Never throws / pure.** Calling twice yields an equal array (deterministic), and the call
   over any fixture does not throw (structural — asserted by the suite completing, plus an
   explicit `expect(() => findOrphanEpics(g)).not.toThrow()`).
7. **`isOrphanEpic` predicate.** True for a storyless epic node, false for one with a story —
   asserts the predicate directly on `graph.byId[...]` / `graph.epics[...]` nodes.

All fixtures go through the real `buildGraph`, so the test exercises the detector against the
genuine frozen `WorkGraph` shape (not a hand-mocked object) — the same discipline `model.test.ts`
uses.

## Ordering of changes

Single atomic unit: `orphan.ts` and `orphan.test.ts` land together (a detector with no test is
not shippable under this repo's gate). No cross-file sequencing needed — one commit.

## Interfaces exposed to downstream (T-068-03-02)

`findOrphanEpics(graph: WorkGraph): string[]` — the doctor probe will call it after an (impure,
injected) `loadWorkGraph`, then map a non-empty result to a red `Check` naming the ids + a
fix-it hint and a non-zero exit. `isOrphanEpic` is available if the probe wants to describe a
single epic. Neither export carries any doctor vocabulary — the surface stays graph-only.

## Gate / build considerations

- `bun test` picks up `*.test.ts` automatically — the new test runs with no config change.
- `bun run build` (typecheck + bundle) must stay green: types-only import, `verbatimModuleSyntax`
  clean (`import type`), no new deps.
- `bun run lint` (format + lint): match the surrounding 2-space, no-semicolon-free style of
  `model.ts` (the repo uses semicolons — mirror `model.ts` exactly).
