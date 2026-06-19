# T-021-05 — Research: pure-graph-spec-to-projection

_Descriptive map of what exists and how it connects. No solutions here._

## The ticket

The pure core E-021 has been building toward: a `(graph, spec) → projection` function that
applies **grouping, density, field-visibility, labels, color-language** to produce the
**face / details / links** projection. _Same graph, many renders._ The single AC:

> The function is pure (same inputs → identical projection, graph arg untouched); a test renders
> the live graph under two specs differing only in `group_by` and asserts the projection regroups
> while the underlying graph object is reference-unchanged.

Advances P5 (consistency), P1, `data-presentation-split`. Depends on T-021-01, T-021-02, T-021-04
— all three landed and committed.

## The three dependencies (all present, all pure)

### T-021-01 — `src/graph/model.ts` + `load.ts` (the DATA side)

- `WorkGraph { epics, stories, tickets, byId }` — all `readonly`, **deeply frozen** (`deepFreeze`,
  exported). Containment is OBJECT refs (`epic.stories → StoryNode[]`, `story.tickets →
  TicketNode[]`); cross/back edges stay IDS (`ticket.storyId`, `ticket.dependsOn`, `ticket.blocks`).
- `TicketNode` carries `storyId, type, status, priority, phase, dependsOn[], blocks[], body`.
  `StoryNode` carries `epicId` (resolved by id convention), `tickets[]`. `EpicNode` carries
  `stories[]`. `byId: Record<string,AnyNode>` is the O(1) index — the ticket→story→epic walk.
- `deepFreeze<T>(value): T` is **exported** and reusable — recursive `Object.freeze`, terminates on
  the tree shape. This is the read-only idiom every sibling reuses.
- `load.ts` exposes `loadWorkGraph(opts?) → Promise<WorkGraph>`; default root is `process.cwd()`,
  reading `docs/active/{epic,stories,tickets}`. A live-board smoke test already exists in
  `load.test.ts` — the AC's "live graph" has an established loading path.

### T-021-02 — `src/present/spec.ts` (the SPEC side)

- `PresentationSpec { preset, vocabulary, density, face[], details[], groupBy, metaphor, labels,
  colorLanguage }` — all `readonly`, frozen. The seven §2a/§2b knobs.
- Closed sets as `as-const` tuples → unions + membership oracles: `GROUPINGS = [epic, story,
  status, role, leverage]`, `COLOR_LANGUAGES = [leverage, status, role]`, `DENSITIES = [low,
  medium, full]`, `METAPHORS = [tree, board, timeline]`, `FACE_FIELDS`, `DETAIL_FIELDS`.
- `validateSpec` (verdict) / `parseSpec` (throw). `DESIGNER_PRESET` (groupBy `story`,
  colorLanguage `leverage`) and `DEV_PRESET` (groupBy `epic`, colorLanguage `status`) are exported
  frozen fixtures — two specs that **already differ in `groupBy`**, ready for the AC test.

### T-021-04 — `src/present/translate.ts` (the per-NODE projection)

- `projectNode(node, spec, overlay?) → Card` — the per-node half already done. `Card { id, kind,
  face: FaceContent, details: DetailContent }`, frozen. Face = the `spec.face` tokens, scrubbed;
  details = the `spec.details` tokens, extracted from `body`. This is the field-visibility +
  labels + vocabulary knobs **already implemented per node**.
- Reusable helpers: `humanizeTitle`, `scrubFace`, `stateChip(node, spec)` (the labeled state
  display), `structuralBreakdown`, `faceJargon`/`faceText` (the leak predicate), `PlainOverlay`.
- `stateKey(node)` exists but is **private** — it collapses status/phase to `open|in_progress|done`
  label keys. The state group-key + color-key want this; it is the one reuse seam that needs
  promoting to `export`.

## What this ticket adds (the gap)

`projectNode` covers **one node's face + details**. Nothing yet:

1. **Groups the graph** along the `groupBy` axis (`epic | story | status | role | leverage`).
2. Emits **links** — the §1a "`depends_on` → visual links between cards (arrows), not an ID list."
   Links live only between tickets (`ticket.dependsOn`).
3. Assigns a **color token** per card under `colorLanguage` (`leverage | status | role`).
4. Carries **density** (`low | medium | full`) — "how much per card."

`grep` confirms no `projectGraph` / `Projection` / grouping / color-language code anywhere; this is
a clean new surface.

## Grounding the under-specified axes (constraints)

The graph nodes carry **no `role` or `leverage` field** — those knob values name axes with no
direct column on a node. The real proxies that DO exist:

- **leverage** — `priority` (`critical|high|medium|low`) is the node's leverage proxy; the codebase's
  leverage ordering (`TIER_RANK` in `survey-core.ts`, reused by `steer-core.ts`) is a separate
  demand-board concept, not a per-ticket field. On the graph, `priority` is the only leverage signal.
- **status** — `stateKey` collapses status/phase to a canonical key; `stateChip` gives the label.
- **role** — there is genuinely **no node-level role**. `role` is a SEAT concept (`presets.ts`
  `SEATS = [designer, dev]`), an attribute of the VIEWER, not the work item. Grouping/coloring "by
  role" has no per-node grounding — the honest-empty discipline (survey-core) says don't invent one.

The mock (`linear-surface-mock.md`) renders epics→stories→tickets as a tree with color classes
(`done`/`active`/`root`) and `depends_on` as arrows, grouped by epic for the founder brief — the
concrete render this projection must be able to drive. Color in the mock is a **semantic class
token** (`classDef done …`), not a hex baked into the data — the renderer owns the palette.

## House patterns this must honor

- **Purity** (model.ts/spec.ts/translate.ts): no fs/clock/network/addon; type-only graph+spec
  imports; the result deeply frozen via the exported `deepFreeze`.
- **One-way authority** (E-021 invariant): READ the graph, never edit it — the AC's
  reference-unchanged assertion is this invariant made testable.
- **Reuse over reinvention**: `projectNode` for every card; `deepFreeze` for the result;
  `stateChip`/`humanizeTitle`/`scrubFace` for labels; `DESIGNER_PRESET`/`DEV_PRESET` as the AC's
  two-specs-differing-only-in-groupBy fixtures.
- **Honest-empty**: where an axis has no grounding (role), degrade to a single group rather than
  fabricate a per-node value.
