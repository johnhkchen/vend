# T-021-05 — Structure: pure-graph-spec-to-projection

_File-level changes, module boundaries, public interfaces, ordering. The shape, not the code._

## Files

| File | Change | Why |
|---|---|---|
| `src/present/translate.ts` | **modify** | Promote `stateKey` from private → `export` (the one reuse seam — state group-key + color-key share it with `stateChip`). No behavior change. |
| `src/present/project.ts` | **create** | The pure `(graph, spec) → Projection` core. ~180 lines, the spec.ts/translate.ts mould. |
| `src/present/project.test.ts` | **create** | Unit tests over a fabricated mini-graph + the AC's live-graph regroup test. |

No deletions. No change to `model.ts`, `spec.ts`, `presets.ts`, `load.ts` — this layer composes
their public surfaces.

## `src/present/project.ts` — module layout

Header comment first (the house pattern: purity note, one-way authority, reuse map, scope/deferrals
per design D5). Then, top to bottom:

### 1. Imports (type-only graph + spec; value imports for reused pure fns)

```ts
import type { WorkGraph, AnyNode, TicketNode } from "../graph/model.ts";
import { deepFreeze } from "../graph/model.ts";
import type { PresentationSpec, Grouping, Density, ColorLanguage, Metaphor } from "./spec.ts";
import { projectNode, stateChip, stateKey, humanizeTitle, scrubFace } from "./translate.ts";
import type { Card, PlainOverlay } from "./translate.ts";
```

`deepFreeze`, `projectNode`, `stateChip`, `stateKey`, `humanizeTitle`, `scrubFace` are all pure —
the file stays pure (no fs/clock/addon).

### 2. Output types (all `readonly`; the design D6 shape)

- `ProjectedCard { card: Card; color: string }`
- `ProjectionGroup { key: string; label: string; cards: readonly ProjectedCard[] }`
- `ProjectionLink { from: string; to: string; kind: "depends_on" }`
- `Projection { groupBy; density; colorLanguage; metaphor; groups[]; links[] }`

`ProjectionOverlays = Readonly<Record<string, PlainOverlay>>` — the optional id→authored-prose map
passed through to `projectNode`.

### 3. Ordinal maps (deterministic group ordering, design D6)

```ts
const STATUS_ORDER: Record<string, number>    // open/ready 0, in_progress 1, done 2, else 9
const PRIORITY_ORDER: Record<string, number>  // critical 0, high 1, medium 2, low 3, else 9
```

Private constants. A key absent from the map sorts last (ordinal 9) then by `localeCompare` — a
total, deterministic order for any value the live board carries (faithful-mirror: statuses beyond
the documented enums are possible).

### 4. Group resolution (pure helpers)

- `groupKeyFor(ticket, graph, spec): string` — the design-D2 switch over `spec.groupBy`:
  - `epic` → `graph.byId[ticket.storyId]` → its `epicId` (guarded; `"ungrouped"` if unresolved)
  - `story` → `ticket.storyId`
  - `status` → `stateKey(ticket)`
  - `leverage` → `ticket.priority`
  - `role` → `"all"`
- `groupLabelFor(key, graph, spec): string` — the matching label per axis (epic/story title via
  `byId` + `humanizeTitle`+`scrubFace`; status → `stateChip`; leverage → capitalized priority;
  role → `"All"`). Resolved once per distinct key, not per card.
- `groupOrdinal(groupBy, key): number` — `STATUS_ORDER`/`PRIORITY_ORDER` for status/leverage, else
  `0` (so the secondary `localeCompare` on key drives epic/story/role order).

### 5. Color resolution (pure)

- `colorFor(ticket, spec): string` — the design-D3 switch over `spec.colorLanguage`:
  `status → stateKey`, `leverage → priority`, `role → "default"`.

### 6. Links (pure)

- `buildLinks(tickets): ProjectionLink[]` — flat-map each ticket's `dependsOn` into
  `{ from: id, to: dep, kind: "depends_on" }`, sorted by `(from, to)`. Every `to` is a real ticket
  (load-time integrity), so no resolve/filter is strictly needed; a defensive `ticketIds.has(dep)`
  guard is kept so the function is also correct on a hand-built fixture graph.

### 7. The public entry

```ts
export function projectGraph(
  graph: WorkGraph,
  spec: PresentationSpec,
  overlays: ProjectionOverlays = {},
): Projection
```

Body order:
1. For each `ticket` in `graph.tickets`: build `card = projectNode(ticket, spec, overlays[id])`,
   `color = colorFor(ticket, spec)`, `key = groupKeyFor(ticket, graph, spec)` → accumulate into a
   `Map<key, ProjectedCard[]>`.
2. Materialize groups: for each key, `{ key, label: groupLabelFor(key, …), cards: id-sorted }`;
   sort groups by `(groupOrdinal, key.localeCompare)`.
3. `links = buildLinks(graph.tickets)`.
4. Assemble `{ groupBy: spec.groupBy, density: spec.density, colorLanguage: spec.colorLanguage,
   metaphor: spec.metaphor, groups, links }` and `return deepFreeze(...)`.

`graph.tickets` is read, never mutated; no node object is written. The only allocation is the new
`Projection` tree.

## `src/present/translate.ts` — the one-line change

`function stateKey(node: AnyNode): string` → `export function stateKey(node: AnyNode): string`.
Doc comment unchanged. `project.ts` imports it; `translate.ts`'s own callers (`stateChip`) are
unaffected. No test churn in `translate.test.ts` (only an addition is possible, not required).

## `src/present/project.test.ts` — test surface

- **Fixtures** — a small hand-built frozen `WorkGraph` (2 epics → ~3 stories → ~5 tickets with a
  cross-story `dependsOn` edge and mixed status/priority), built inline via `buildGraph` from
  `model.ts` so it is a real frozen graph (not a cast), reusing the `load.test.ts` fixture idiom.
- **Grouping** — one test per axis (`epic`/`story`/`status`/`leverage`/`role`) asserting the group
  keys + card partition; `role` → exactly one `"all"` group.
- **Color** — `colorLanguage: status` vs `leverage` puts different tokens on the same card.
- **Links** — the cross-story `depends_on` edge appears once, `(from,to)`-correct; `blocks` is not
  double-emitted.
- **Purity / freeze** — projection is frozen; the input `graph` is `===` and `Object.isFrozen`
  before and after; two projections from one graph are independent objects.
- **AC block** — `loadWorkGraph()` the live board; project under `{...DESIGNER_PRESET, groupBy:
  "epic"}` and `{...DESIGNER_PRESET, groupBy: "story"}`; assert (a) group structures differ, (b)
  `graph === graph` and `graph.tickets === graph.tickets` across both calls (reference-unchanged),
  (c) same spec twice → identical projection (determinism / P5).

## Ordering of changes

1. `export stateKey` in `translate.ts` (unblocks the import).
2. `project.ts` types → helpers → `projectGraph`.
3. `project.test.ts` fixtures → unit tests → AC block.
4. `bun run check` green.

Each step is independently typecheckable; the test file compiles only after `projectGraph` exists.
