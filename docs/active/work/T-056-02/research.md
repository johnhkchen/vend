# T-056-02 — Research: blocked-flag-on-projection-link

## Ticket in one line

Enrich `ProjectionLink` (src/present/project.ts:59) with a status-derived `blocked`
flag, computed purely inside `projectGraph`/`buildLinks` from the frozen graph — a
link is `blocked` when its `from` ticket is not done — so the projection IR carries
dependency-decision weight without any new data authority.

This is the first of the two coupled fixes in epic E-056 (edges-as-payload). The
sibling T-056-03 will give blocked edges visual WEIGHT in `projectionToSvg`. This
ticket touches the pure IR only; it does NOT touch the renderer or the preset default.

## The relevant surface

### `src/present/project.ts` — the pure graph→projection core

- `ProjectionLink` (lines 59–63): `{ readonly from, readonly to, readonly kind:
  "depends_on" }`. This is the IR type to enrich.
- `buildLinks(tickets)` (lines 185–195): the only producer of links. For every ticket
  `t`, for every `dep` in `t.dependsOn` that resolves to a real ticket, it pushes
  `{ from: t.id, to: dep, kind: "depends_on" }`, then sorts `(from,to)`. **Crucial
  observation: `from` is always `t.id`, and the loop variable `t` (a full `TicketNode`)
  is in scope at the push site.** So the `from` ticket's status is already available
  with no map/lookup: `blocked = stateKey(t) !== "done"`.
- `projectGraph(graph, spec, overlays)` (lines 208–245): the one public entry. Step 3
  calls `buildLinks(graph.tickets)`. Result is `deepFreeze`d. Pure: no fs/clock/random.
- `stateKey` is already imported (line 35) from `./translate.ts` and already used inside
  this file (lines 117, 171). No new import is needed.

### `src/present/translate.ts` — the "done" semantics

- `stateKey(node)` (lines 175–180): collapses raw status/phase into one of
  `open` / `in_progress` / `done`. The canonical done rule lives here:
  `done = node.status === "done" || (node.kind === "ticket" && node.phase === "done")`.
  So a ticket reads done if EITHER its `status` is `done` OR (being a ticket) its
  `phase` is `done`. Reusing `stateKey(t) === "done"` is the correct, single-source
  done test — it honors the phase:done convention the rest of the present layer uses.
  Hand-rolling `t.status === "done"` would silently disagree with the board.

### `src/graph/model.ts` — the node shape

- `TicketNode` (lines 65–80): has `readonly status: string`, `readonly phase: string`,
  `readonly dependsOn: readonly string[]`, plus a DERIVED `blocks` inverse. `status` and
  `phase` are plain mirror strings (no enum) — `stateKey` is the collapsing authority.
- `WorkGraph` is built by `buildGraph` and deeply frozen. The fabricated-graph test
  idiom (build via `buildGraph`, not a cast) is shared across the present tests.

## Consumers of `ProjectionLink` / `.links` (impact of adding a field)

Grepped `ProjectionLink` and `.links` across `src/`:

- `src/present/projection-svg.ts:149` — iterates `projection.links` to render `<line>`
  per edge. READS `from`/`to` only; adding a field does not break it. (T-056-03 will
  consume the new `blocked` flag here — out of scope for this ticket.)
- `src/present/projection-svg.test.ts:70` — `fakeProjection()` hand-builds a link
  literal `{ from, to, kind }`, but the whole object is cast `as unknown as Projection`
  (line 71), so a new REQUIRED field on the type does NOT cause a type error there.
- `src/present/svg-file.ts:116` and `svg-file.test.ts:118/122` — read
  `projection.links.length` only. Unaffected.
- `src/probe/rubric.ts:190/196` — reads `l.from`/`l.to` for dangler detection.
  Unaffected.
- `src/present/project.test.ts:117` — asserts
  `p.links).toEqual([{ from: "T-002-01", to: "T-001-03", kind: "depends_on" }])`. This
  assertion WILL change: the emitted link now also carries `blocked`. T-002-01 is `open`,
  so the expected link becomes `{ ..., blocked: true }`. This is the one existing
  assertion that must be updated, and it is in-scope (same file the AC targets).

The many other `{ from, to }` hits (src/engine/*, src/play/*) are unrelated `DagEdge` /
play-graph literals — a different type. Not touched.

## The existing test fixture (project.test.ts)

`miniGraph()` builds 5 tickets with exactly one cross-story dep: T-002-01 (status
`open`) depends_on T-001-03 (status `in-progress`). So the single emitted link has
`from = T-002-01`, which is `open` → not done → `blocked: true`. The fixture already
contains done tickets (T-001-01, T-002-02 with phase `done`) and in-progress/open ones,
so it is rich enough to fabricate both a blocked-true and a blocked-false link by adding
one more dependency edge between existing nodes — no new graph is required for the AC.

## Constraints / invariants in force

- **One-way authority (E-021):** the graph is READ, never written. `blocked` is derived
  from the frozen graph; nothing is written back to a node. Authority-guard + the
  reference-unchanged assertions must stay green.
- **Determinism (P5):** no clock, no random. `blocked` is a pure function of node status;
  byte-identical on repeat. `buildLinks` already sorts deterministically.
- **Composition, not reinvention:** reuse `stateKey` for "done"; do not re-derive.
- **noUncheckedIndexedAccess: true** (tsconfig) — array indexing needs `!` guards; not
  relevant here since we read the loop variable `t`, not an index.

## Open questions (resolved in Design)

1. Required vs optional `blocked` field on the IR? (Required — the IR always carries it.)
2. Compute from the in-scope `t` or via a status map keyed by `from`? (From `t` — `from`
   is `t.id` by construction; a map is redundant.)
3. Direction semantics — does "blocked" key off `from` or `to`? The AC pins it to `from`;
   the implementation follows the AC literally.
