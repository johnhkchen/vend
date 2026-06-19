# T-021-05 — Design: pure-graph-spec-to-projection

_Options, tradeoffs, the decision and its rationale. Grounded in research.md._

## The decision in one line

A pure `projectGraph(graph, spec, overlays?) → Projection` in a new file `src/present/project.ts`.
It projects the graph's **tickets** into `projectNode`-built cards, **grouped** along `spec.groupBy`,
each card carrying a **color token** under `spec.colorLanguage`, plus top-level **links** from
`ticket.dependsOn`. It reuses `projectNode` (face/details), `deepFreeze` (read-only result),
`stateChip`/`humanizeTitle` (labels), and **adds nothing the graph could already provide** — same
graph, many renders, graph untouched.

## D1 — What is a "card" in the projection? (scope: tickets)

The graph has three node kinds. A projection could project all three, or one altitude.

- **Option A — project every node (epics + stories + tickets) into a flat card set.** Most general,
  but `depends_on` links exist only between tickets, epics have no epic-parent (so `group_by: epic`
  is undefined for an epic), and the grouping axes mix poorly across kinds. Over-general for the AC.
- **Option B — project the TICKETS as cards; epics/stories become group LABELS (CHOSEN).** Tickets
  are the leaf work items the designer steers (the mock's expandable leaves; Linear's issues). Every
  grouping axis resolves cleanly for a ticket: `epic`→ticket→story→epic, `story`→`storyId`,
  `status`→state, `leverage`→`priority`. `depends_on` links are ticket→ticket — exactly the link
  domain. Epics/stories supply the group **header label** via `byId`, not their own cards.

**Chosen: B.** It is the cleanest mapping of every knob onto a real node field, matches the
Linear "issues grouped under headers" shape, and makes the AC's "regroup by `group_by`" a crisp,
testable regrouping of one fixed card set. Projecting epic/story faces as their own cards is a
follow-on (a `tree` metaphor concern), explicitly deferred — not load-bearing for this AC.

## D2 — Grouping: one key function, two outputs (key + label)

For each ticket, `groupBy` yields a **key** (the partition id) and the group yields a **label**
(the plain header). Resolution per axis, all from real fields:

| `groupBy` | key | label |
|---|---|---|
| `epic` | `ticket → story.epicId` (via `byId`) | epic node's `humanizeTitle(title)`, scrubbed |
| `story` | `ticket.storyId` | story node's `humanizeTitle(title)`, scrubbed |
| `status` | `stateKey(ticket)` (`open\|in_progress\|done`) | `stateChip(ticket, spec)` (the spec label) |
| `leverage` | `ticket.priority` | the priority word, capitalized |
| `role` | `"all"` | `"All"` |

`stateKey` is **promoted to `export`** in `translate.ts` (the one reuse-seam change) so the state
group-key and the color-key share the single source of "what state is this," never drifting from
`stateChip`. A missing epic/story label (corrupt board can't happen — integrity is validated at
load) falls back to the bare key. **Role** degrades to a single `"all"` group: the honest-empty
choice over inventing a per-ticket role the graph does not carry (research §grounding).

## D3 — Color: a semantic TOKEN, not a hex

`colorLanguage` assigns each card a **color token** (a string the renderer maps to a palette, like
the mock's `classDef done`), keeping the pure core renderer-agnostic:

- `status` → `stateKey(ticket)` (`done` / `in_progress` / `open` / …)
- `leverage` → `ticket.priority` (`critical` / `high` / …)
- `role` → `"default"` (no node role — single color, mirrors D2's role degradation)

Returning a token, not `#E8F5E9`, is the same altitude call T-021-04 made (a typed `Card`, not a
rendered string): the projection decides *what color means*, the renderer decides *which pixels*.
Rejected: baking hex into the projection — it bakes a palette the renderer owns into the data.

## D4 — Links: `depends_on` as projected edges

Each ticket's `dependsOn` becomes `ProjectionLink { from: ticket.id, to: dep, kind: "depends_on" }`.
Because we project **all** tickets (D1) and load-time integrity guarantees every `dependsOn` target
is a real ticket, every edge resolves — no dangling link is possible. Links are a **top-level**
array (not nested in a group) because a dependency can cross group boundaries (a ticket in epic A
depends on one in epic B) — the mock's arrows span the tree. Sorted `(from, to)` for determinism.
`blocks` is the derived inverse of `dependsOn`; emitting both would double every edge, so we emit
only the authored `depends_on` direction (the inverse is recoverable, the §1a contract names
`depends_on`).

## D5 — Density: plumbed, graduated effect deferred (the T-021-04 precedent)

`density` (`low|medium|full`) means "how much per card." The presets contradict a naive
"low = fewer fields" reading (`DESIGNER_PRESET` is `density: low` yet routes all four face fields),
and the PM docs do not pin a precise field-count semantic. Rather than **fabricate** one that
conflicts with `spec.face` (which already governs field-visibility), density is **carried onto the
`Projection`** so a renderer / future iteration can act on it, with its graduated trimming a
documented v1 deferral. This is the exact stance T-021-04 took on `vocabulary` (`mixed`/`technical`
plumbed but unconditional for v1) — honesty over an invented semantic. `metaphor` is carried for the
same reason: the projection is metaphor-agnostic structured data; tree/board/timeline is a render
decision. Field-visibility, labels, and vocabulary are **already applied** inside `projectNode`, so
this layer does not re-handle them — it composes the per-node result.

## D6 — Output shape: `Projection` (groups + links + echoed knobs)

```ts
interface ProjectedCard  { card: Card; color: string }
interface ProjectionGroup { key: string; label: string; cards: readonly ProjectedCard[] }
interface ProjectionLink  { from: string; to: string; kind: "depends_on" }
interface Projection {
  groupBy: Grouping; density: Density; colorLanguage: ColorLanguage; metaphor: Metaphor;
  groups: readonly ProjectionGroup[];   // ordered; cards id-sorted within
  links:  readonly ProjectionLink[];    // top-level; cross-group; (from,to)-sorted
}
```

`card` already carries `id`/`kind`, so `ProjectedCard` adds only `color`. The knobs are **echoed**
onto the projection so it is self-describing (a renderer reads `metaphor`/`density` without the
spec). Result is **`deepFreeze`d** (reusing model.ts's export) — the read-only idiom, and half of
the purity guarantee. Group ordering: `status` and `leverage` get a fixed reading order
(`open→in_progress→done`; `critical→high→medium→low`) via small ordinal maps, since those axes have
a natural order the mock relies on; `epic`/`story`/`role` sort by key (`localeCompare`, the
model.ts id-sort idiom).

## D7 — Purity & the AC's reference-unchanged teeth

`projectGraph` reads the frozen `graph` and frozen `spec`, builds a **new** frozen `Projection`,
and never touches the graph — there is no write path to a node here (E-021 one-way authority). The
AC test asserts `graph` (and `graph.tickets`) is the **same `===` reference** before and after two
projections, and that projecting under `groupBy: epic` vs `story` yields **different group
structures** from that one unchanged graph. Purity also gives same-inputs→identical-output: no
clock/random/fs, deterministic sorts, so re-projecting is byte-identical (P5 consistency).

## What is explicitly rejected / deferred

- **No rendering** (Mermaid/Linear/TUI/hex palette) — downstream; we emit tokens + structure.
- **Epic/story cards** — v1 projects tickets; parent nodes are headers (a `tree`-metaphor follow-on).
- **Graduated density / metaphor layout** — plumbed, not applied (D5), the vocabulary precedent.
- **Per-node `role`/`leverage` invention** — degrade to single group / priority proxy (honest-empty).
- **`blocks` links** — derivable inverse of `depends_on`; not double-emitted (D4).
- **No fs in the core** — the AC test loads the live graph via `loadWorkGraph` (impure, at the test
  boundary, the load.test.ts smoke precedent); `projectGraph` itself stays pure.
