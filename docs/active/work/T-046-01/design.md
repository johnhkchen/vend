# T-046-01 — Design

Decisions for the typed graph model + pure toposort, grounded in the Research map. Each decision
names the options weighed, the codebase reality that picks the winner, and what is rejected.

## D1 — The `DagNode.cast` signature (the forward-coupling problem)

**Tension (Research §"cast member"):** the ticket scopes the cast's *input* signature to T-046-02,
but `DagNode` must declare `cast` now. Over-specify → churn next ticket; under-specify → lose
safety.

- **Opt A — copy `ChainStep` exactly:** `cast: (upstream: string | undefined) => Promise<RunSummary>`.
  *Rejected.* This bakes in the SINGLE-upstream thread that T-046-02 exists to replace (a join takes
  *several*). It would make T-046-01 ship the very limitation the story generalizes, then force an
  edit to the just-shipped type.
- **Opt B — generic over the cast's argument:** `interface DagNode<C = unknown> { id: NodeId; cast:
  C }`. *Rejected as overkill* — a free type parameter on the model leaks into `DagSpec`,
  `validateDag`, `topoSort` (none of which touch `cast`), polluting every signature for a field none
  of them read.
- **Opt C (CHOSEN) — opaque cast type, this ticket reads only `id`.** Declare `cast` with a
  deliberately wide, forward-named signature: `cast: NodeCast` where `type NodeCast = (...args:
  readonly unknown[]) => Promise<RunSummary>`. T-046-01's validation/toposort touch ONLY `id` and
  the edges; `cast` rides along as opaque payload (exactly as `ChainStep.cast` is opaque to
  `runChain`'s sequencing). T-046-02 narrows `NodeCast` to its real upstream-collection signature
  without changing `DagNode`'s shape. **Why it wins:** matches the ticket's "here a node is
  `{id,cast}`" literally; keeps `DagSpec`/`validateDag`/`topoSort` free of any cast-shaped type;
  imports `RunSummary` type-only, preserving purity. The wide arg list is honest — this ticket
  genuinely does not know or care how a node is cast.

## D2 — One cycle algorithm, two presentations (DRY the detector)

Research §constraint 3: `validateDag`'s cycle offense and `topoSort`'s `{ cycle }` are the same
fact. Options:

- **Opt A — two independent cycle detections** (validate does its own, toposort does its own).
  *Rejected* — duplicated graph traversal, two places to drift.
- **Opt B (CHOSEN) — `topoSort` is the single cycle authority; `validateDag` calls it.**
  `topoSort` runs Kahn's algorithm and is the one place that decides acyclic-vs-cyclic. `validateDag`
  performs the *structural* checks it alone can do (dangling edges, duplicate ids) and then delegates
  the cycle check to `topoSort`, lifting a `{ cycle }` result into a named offense. **Why:** one
  traversal, one source of truth; the two surfaces stay consistent by construction.
  - *Ordering subtlety:* a duplicate id or dangling edge can make a naive toposort misbehave, so
    `validateDag` runs the structural checks FIRST and only invokes the cycle check on a
    structurally-sound graph. `topoSort` called directly on a malformed graph must still be TOTAL
    (never throw/hang) — see D4.

## D3 — Toposort algorithm: Kahn's (BFS) over DFS

- **Opt A — DFS post-order + recursion-stack cycle flag.** Viable, but recursion risks stack depth
  on long chains and the cycle-node extraction (which nodes form the cycle) is fiddlier.
- **Opt B (CHOSEN) — Kahn's algorithm (indegree BFS).** Compute indegree per node; seed a ready
  queue with indegree-0 nodes **in declaration order**; repeatedly pop, append to `order`, decrement
  successors' indegree, enqueue newly-zeroed nodes (again preserving declaration order). If `order`
  covers all nodes → `{ order }`; if some nodes never reach indegree 0 → those are exactly the
  cyclic remainder → `{ cycle }`. **Why:** iterative (no stack risk); the indegree-0 ready set makes
  the **stable declaration-order tie-break** (ticket AC) natural — siblings in a fan-out enter the
  queue in the order their nodes were declared; cycle extraction is the leftover set, no extra pass.

## D4 — Determinism & the stable tie-break

The ticket demands `topoSort` be deterministic with a stable tie-break (declaration order) so a
fan-out's ready siblings have a reproducible order. Decision: **index nodes by their position in
`spec.nodes`** and drive every queue/iteration by that index, never by `Map`/`Set` insertion-order
assumptions or object-key order. Adjacency is built by iterating `spec.edges` in declaration order.
Result: same `DagSpec` → byte-identical `order`. This also makes `topoSort` total on malformed input
(D2 subtlety): an edge to/from an unknown id is simply ignored by the indegree pass (it cannot
contribute a real dependency), so toposort never throws — `validateDag` is what *refuses* such a
graph; `topoSort` alone degrades gracefully.

## D5 — `validateDag` offense shape: distinct, named, total (mirror `decideThread`)

Mirror `chain-core.ts`'s `ThreadDecision` discipline (Research §halt): distinct, named, never
throws.

- **Return type:** `DagValidation = { ok: true } | { ok: false; offenses: DagOffense[] }`, where
  each `DagOffense = { kind: "dangling-edge" | "duplicate-node" | "cycle"; detail: string; nodes:
  readonly NodeId[] }`. **Why a list, not first-failure:** a malformed graph can have several
  independent faults (two dangling edges, a dup AND a cycle); reporting all at once is the loud
  andon the house style wants. `kind` is a closed union so each offense is a *distinct named* fault,
  not a stringly-typed blob.
- **Rejected:** throwing on the first offense (violates total), or a single boolean (loses which
  fault and where — the andon must name the offending nodes).

## D6 — `NodeId` type & identity

- **Opt A — `NodeId = string`** (a transparent alias). *Chosen.* The chain identifies nothing
  (steps are positional); the graph needs stable identity, and a plain string id is what `DagEdge`
  references and what `RunSummary`/run-log subjects already are. A branded/opaque id buys no safety
  the validation doesn't already enforce (duplicate-id and dangling-edge checks ARE the id
  integrity) and would force casts at every call site. Keep it a documented `string` alias for
  readability.

## D7 — File placement & boundaries

- **New file `src/engine/dag-core.ts`** — the pure model + `validateDag` + `topoSort`. Mirrors
  `chain-core.ts` placement/naming. Type-only imports (`RunSummary`). No shell, no `castGraph` (that
  is T-046-03), no `runGraph` (T-046-02).
- **New file `src/engine/dag-core.test.ts`** — the full pure-function test matrix, mirroring
  `chain-core.test.ts` (fakes only, no spawn).
- **Rejected:** extending `chain-core.ts` in place — the graph is a distinct primitive; co-locating
  would muddy the chain's tested surface and the import graph. A fresh `*-core.ts` is the
  established pattern (cast-core, spend-core, chain-core).

## Decision summary

| Concern | Decision |
|---|---|
| `cast` field | Opaque `NodeCast` type; this ticket reads only `id` (D1) |
| Cycle detection | Single authority in `topoSort`; `validateDag` delegates (D2) |
| Algorithm | Kahn's indegree BFS (D3) |
| Determinism | Index-driven by `spec.nodes` declaration order (D4) |
| Validation | Total, list of distinct named offenses (D5) |
| Identity | `NodeId = string` alias (D6) |
| Placement | New `dag-core.ts` + `dag-core.test.ts` (D7) |
