# T-021-05 — Review: pure-graph-spec-to-projection

_Handoff: what changed, test coverage, open concerns. What a reviewer needs without the diffs._

## What this delivers

The keystone of E-021's data/presentation split: a single pure function `projectGraph(graph, spec,
overlays?) → Projection`. It composes the three landed legs — the frozen `WorkGraph` (T-021-01),
the validated `PresentationSpec` (T-021-02), and per-node `projectNode` (T-021-04) — into "same
graph, many renders." The graph's **tickets** are projected into colored cards, **grouped** along
`spec.groupBy`, with `depends_on` **links** between them. Calibration edits the spec; the graph is
never touched.

## Files changed

| File | Change | Notes |
|---|---|---|
| `src/present/translate.ts` | modified | `stateKey` promoted private → `export`. One modifier; no behavior change. |
| `src/present/project.ts` | **new (~210 lines)** | The pure core: output types, ordinal maps, resolvers (`groupKeyFor`/`groupLabelFor`/`groupOrdinal`/`colorFor`/`buildLinks`), and `projectGraph`. |
| `src/present/project.test.ts` | **new** | 13 cases: per-axis grouping, color, links, overlays, freeze/determinism, the live-graph AC block. |

No other files touched. `model.ts`/`spec.ts`/`presets.ts`/`load.ts` are composed via their public
surfaces only.

## How the AC is satisfied

> Pure (same inputs → identical projection, graph arg untouched); a test renders the live graph
> under two specs differing only in `group_by` and asserts the projection regroups while the
> underlying graph object is reference-unchanged.

- **Pure** — no fs/clock/random/addon; type-only graph+spec imports; deterministic sorts; result
  `deepFreeze`d. The AC test re-projects under the same spec and asserts `toEqual` (identical).
- **Graph untouched** — `projectGraph` reads `graph.tickets`/`byId` and allocates a fresh
  `Projection`; no node is written (E-021 one-way authority). The AC test captures `graph.tickets`
  by reference, runs two projections, and asserts `graph.tickets === ticketsRefBefore` and
  `Object.isFrozen(graph)` afterward.
- **Regroups** — the AC test loads the **live board** via `loadWorkGraph()`, projects under
  `groupBy: epic` vs `story` (DESIGNER_PRESET base), and asserts the two group key-sets differ while
  covering the identical ticket set — the projection regroups, the graph does not.

## Test coverage

`bun run check` → **685 pass, 0 fail** (672 baseline + 13 new), typecheck clean.

- **Grouping** — one test per axis. `epic`/`story`/`status`/`leverage` partition correctly with the
  intended ordering (status: open→in_progress→done; leverage: critical→high→medium→low). `role`
  yields the single honest `"all"` group.
- **Color** — `status` vs `leverage` put different tokens on the *same* card (`done` vs `high`);
  `role` → uniform `"default"`.
- **Links** — the one cross-story `depends_on` edge appears exactly once, `(from→to)`-correct;
  `blocks` is verified *not* double-emitted.
- **Overlays** — an authored `why` for one ticket lands on its face; others omit it (honest-empty
  preserved through the graph-level entry).
- **Purity/freeze** — deeply frozen result (frozen-push throws); same inputs → identical projection.

Fixtures are a real `buildGraph`-built frozen graph (not a cast), so the freeze/reference assertions
exercise genuine immutability. The single impure touch — `loadWorkGraph()` in the AC block — is at
the test boundary, the established `load.test.ts` live-board precedent; the function under test is
pure.

### Coverage gaps (honest)

- No test for a **corrupt/empty board** path — not applicable: `projectGraph` is total over any
  valid `WorkGraph`, and an empty graph yields empty groups/links (trivially correct, untested).
- The `group_by: epic` **`"ungrouped"`** fallback (a ticket whose story has no epic) is unreachable
  on a load-validated graph (integrity guarantees the epic resolves), so it is defensive-only and
  not unit-tested. Acceptable: it cannot fire on a real graph.

## Open concerns / known limitations (v1 deferrals, not defects)

1. **Graduated `density` is plumbed, not applied** (design D5). `density` is echoed onto the
   `Projection` so a renderer can read it, but it does not yet trim fields — the presets contradict
   a naive "low = fewer fields" reading and the PM docs do not pin a precise semantic. This mirrors
   T-021-04's identical stance on `vocabulary`. A follow-on once the render contract pins density.
2. **`metaphor` is carried, not laid out** — tree/board/timeline is a render decision; the
   projection is metaphor-agnostic structured data.
3. **Tickets-only cards** (design D1). Epics/stories are group *headers*, not their own cards. A
   `tree`-metaphor view that wants epic/story faces is a follow-on; not load-bearing for this AC.
4. **`role` grouping/coloring degrades to a single group/token** — there is no node-level role
   (it's a seat concept), so this is the honest-empty choice, deliberately, not a stub. If a future
   ticket wants per-ticket role, that requires a new node field or a seat→ticket mapping upstream.

## Flags for human attention

None blocking. The one judgment call worth a glance: **density/metaphor carried-but-unapplied** —
confirm that matches the intended phasing (the projection is render-contract-ready; the renderer is
a later epic). Everything the AC names is implemented, tested, and green.
