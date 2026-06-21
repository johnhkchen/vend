# T-046-01 — Structure

The blueprint: file-level changes, public interfaces, internal organization, and ordering. Not
code — the shape of the code. Grounded in the Design decisions.

## Files

| File | Action | Why |
|---|---|---|
| `src/engine/dag-core.ts` | **CREATE** | Pure model + `validateDag` + `topoSort` (D7) |
| `src/engine/dag-core.test.ts` | **CREATE** | Full pure-function test matrix (D7) |
| `src/engine/chain-core.ts` | untouched | The chain stays; T-046-02 generalizes its *logic*, not by editing it |
| `src/engine/cast.ts` | untouched | `RunSummary` imported type-only |

No deletions. No edits to existing modules — T-046-01 is purely additive.

## `src/engine/dag-core.ts` — public surface

Header comment (mirror `chain-core.ts`): state the pure-core ⊥ impure-shell split, the purity
discipline (type-only imports, no fs/clock/network/addon, total functions), and that this module
owns SHAPE + ORDERING only — it spawns nothing, casts nothing (T-046-02 owns the run).

```
import type { RunSummary } from "./cast.ts";   // type-only, erased (purity)

// ── Identity & the cast payload ───────────────────────────────────────────
export type NodeId = string;                    // D6 — transparent alias
// D1 — opaque cast payload; this ticket reads only `id`. T-046-02 narrows this.
export type NodeCast = (...args: readonly unknown[]) => Promise<RunSummary>;

// ── The typed graph model ─────────────────────────────────────────────────
export interface DagNode { readonly id: NodeId; readonly cast: NodeCast; }
export interface DagEdge { readonly from: NodeId; readonly to: NodeId; }
export interface DagSpec { readonly nodes: readonly DagNode[]; readonly edges: readonly DagEdge[]; }

// ── Validation (total) ────────────────────────────────────────────────────
export type DagOffenseKind = "dangling-edge" | "duplicate-node" | "cycle";
export interface DagOffense {
  readonly kind: DagOffenseKind;
  readonly detail: string;                      // the andon string
  readonly nodes: readonly NodeId[];            // the offending id(s)
}
export type DagValidation =
  | { readonly ok: true }
  | { readonly ok: false; readonly offenses: readonly DagOffense[] };

export function validateDag(spec: DagSpec): DagValidation;   // D5 — total, all offenses

// ── Topological sort (pure, total, deterministic) ─────────────────────────
export type TopoResult =
  | { readonly order: readonly NodeId[] }
  | { readonly cycle: readonly NodeId[] };

export function topoSort(spec: DagSpec): TopoResult;          // D3/D4 — Kahn's, declaration-order
```

### Internal organization of `dag-core.ts`

1. **`topoSort` (the cycle authority, D2/D3/D4)** — Kahn's indegree BFS:
   - Build `idToIndex: Map<NodeId, number>` from `spec.nodes` (declaration order = index).
   - `indegree: number[]` and `successors: number[][]`, both indexed by node position. Iterate
     `spec.edges` in order; an edge whose `from`/`to` is not a known id is SKIPPED (degrades
     gracefully — `validateDag` is what refuses it; D4 totality). Self-guard every `Map.get` and
     array index for `noUncheckedIndexedAccess`.
   - Seed `queue` with every index whose `indegree === 0`, **in ascending index order**
     (declaration-order tie-break, D4). Process FIFO; on pop, push `spec.nodes[i].id` to `order`,
     decrement each successor's indegree, enqueue any that hit 0 — appended in ascending index order
     to keep determinism.
   - If `order.length === spec.nodes.length` → `{ order }`. Else the un-emitted nodes are the cyclic
     remainder → `{ cycle: <their ids, declaration order> }`.
   - Empty graph → `{ order: [] }` (vacuous).

2. **`validateDag` (D5)** — accumulate offenses, never throw:
   - **duplicate-node:** scan `spec.nodes`; any `id` seen twice → one `duplicate-node` offense
     naming the repeated id(s).
   - **dangling-edge:** build the id set; any edge with `from` or `to` not in it → a `dangling-edge`
     offense naming the edge's unknown endpoint(s). One offense per offending edge.
   - **cycle:** only when the graph is structurally sound (no dup/dangling — D2 ordering subtlety),
     call `topoSort`; if it returns `{ cycle }`, lift to a `cycle` offense naming the cycle nodes.
   - Return `{ ok: true }` when the offense list is empty, else `{ ok: false, offenses }`.

3. Small private helpers as needed (e.g. an indegree-builder) — kept pure, not exported.

## `src/engine/dag-core.test.ts` — structure

Mirror `chain-core.test.ts`: `import { describe, expect, test } from "bun:test"`, import the model
+ functions from `./dag-core.ts`. A tiny `node(id)` fake builds a `DagNode` with a throwaway `cast`
(it is never invoked — T-046-01 never runs anything), and `edge(from, to)` builds a `DagEdge`. No
`RunSummary` construction needed beyond the cast's unused return type.

Test groups:
- **`topoSort` — valid shapes:** linear path (order is the unique chain); fan-out 1→{2,3} (root
  first, siblings in declaration order); join {1,2}→3 (3 last); diamond 1→{2,3}→4 (1 first, 4 last,
  2 before 3); disconnected (two independent subgraphs, all nodes present, declaration order
  preserved); empty graph → `{ order: [] }`; single node → `{ order: [id] }`.
- **`topoSort` — determinism:** the same spec sorted twice returns deep-equal `order` (stable
  tie-break assertion on a fan-out).
- **`topoSort` — cycle:** a 2-cycle and a 3-cycle each return `{ cycle }` containing exactly the
  cyclic nodes (no `order` key); a self-loop (a→a) returns `{ cycle: [a] }`. Asserts it RETURNS
  (does not hang/throw).
- **`validateDag` — clean:** every valid shape above → `{ ok: true }`.
- **`validateDag` — offenses:** dangling edge (unknown `to`) → one `dangling-edge` offense naming
  it; duplicate node id → `duplicate-node`; cycle → `cycle`; a graph with MULTIPLE faults → multiple
  offenses (proves accumulation, not first-failure). Each offense's `kind` and `nodes` asserted.
- **`validateDag` — empty:** `{ nodes: [], edges: [] }` → `{ ok: true }` (vacuous).

## Ordering of construction

`topoSort` is written and tested first (it is the cycle authority `validateDag` depends on, D2),
then `validateDag` on top of it. Within the file the export order can read model → validate →
toposort for readability; the dependency (validate → toposort) is satisfied at call time regardless
of source order.

## Invariants this structure preserves

- **Purity:** only a type-only `RunSummary` import; no runtime imports, no fs/clock/addon.
- **Totality:** neither exported function throws; `topoSort` never hangs on a cycle.
- **Determinism:** all iteration is index/declaration-order driven (D4).
- **Scope:** no `runGraph`, no `castGraph`, no concurrency, no real cast — those are T-046-02/03.
