# T-046-03 — Structure: `castGraph`, the impure shell + the worked example

The blueprint for the `chain.ts` analog at graph scale: the **impure shell** that wires real casts
and runs independent branches **concurrently**, plus the **deterministic worked example** and the
**fails-vs-linear proof** E-046's "Done looks like" requires.

Research & Design are folded into the ticket (it cites the exact coordinates to mirror); this
structure pins the file-level shape grounded in the read of `chain.ts`, `cast.ts`, `graph-core.ts`,
`dag-core.ts`, `graph-core.test.ts`, and `chain-propose-decompose.ts`.

## File-level changes

| File | Action | Why |
|------|--------|-----|
| `src/engine/graph.ts` | **create** | The impure shell: `castGraph` + `PlayNode`/`NodeOptions`. The DAG analog of `chain.ts`'s `castChain`/`PlayStep`. Value-imports `castPlay`; re-exports `graph-core.ts` so callers get ONE graph-surface import. **Not value-imported by any `bun test`** (the `chain.ts` discipline). |
| `src/engine/graph-example.ts` | **create** | The DETERMINISTIC worked example — a diamond `DagSpec` of **stub nodes** (canned `RunSummary`s) + a `runDiamondExample()` that drives the **pure** `runGraph`. No `castPlay`, no live model → importable + reproducible. |
| `src/engine/graph-example.test.ts` | **create** | Proves the worked example (AC#2) **and** the fails-vs-linear proof (AC#3). Fakes-only, pure (the `chain-core.test.ts`/`graph-core.test.ts` discipline). |

No deletions. `graph-core.ts`, `chain-core.ts`, `dag-core.ts` are **unchanged** — `castGraph` *reuses*
their `runGraph` (result shape), `topoSort` (ordering), and `decideThread` (the halt gate).

### The asymmetry vs `castChain` (the load-bearing structure decision)

`castChain` is ~12 lines because `runChain`'s **sequential** `await` IS the desired chain semantics
— a chain has no concurrency to add. A graph's desired semantics **add branch concurrency**, which
the pure `runGraph` deliberately does NOT provide (it `await`s each node one-at-a-time in topo order;
T-046-02's structure: *"Real concurrency of independent ready nodes is T-046-03's shell job"*).

Therefore `castGraph` cannot be a thin pass-through to `runGraph` — delegating would run B then C, not
B ∥ C. The shell owns a **concurrent wave dispatcher**, and honors *"the pure core owns
ordering/threading/halt"* by **reusing the pure decision primitives**, not reimplementing judgment:

- **ordering** → `topoSort(spec)` (dag-core.ts) — also the cycle authority.
- **halt** → `decideThread(summary)` (chain-core.ts) — the SAME per-edge gate `runGraph` uses.
- **threading/join** → the trivial `producedAll.get(from)` gather into a `NodeUpstreams` map.

`runGraph` remains the **tested sequential reference** for these exact semantics; `castGraph` is its
**concurrent twin** over the same primitives. Per AC#1 the twin is not unit-tested (it value-imports
`castPlay` → executor seam → spawn) — proven live downstream, exactly as `castChain` is.

## `graph.ts` public interface

```ts
import type { Budget } from "../budget/budget.ts";
import { castPlay, type CastOptions, type RunSummary } from "./cast.ts";  // value-import: NOT test-imported
import type { Play } from "./play.ts";
import { decideThread } from "./chain-core.ts";                            // REUSE the halt gate
import { topoSort, type DagEdge, type DagNode, type DagSpec, type NodeId, type NodeUpstreams } from "./dag-core.ts";
import type { GraphResult, SkippedNode } from "./graph-core.ts";

export * from "./graph-core.ts";   // one engine entry for the whole graph surface (the chain.ts/cast.ts pattern)

/** A node's cast options — STATIC, or DERIVED from its upstreams' produced map (the StepOptions
 *  analog: a join node may name its run-log subject from a threaded upstream ref). */
export type NodeOptions = CastOptions | ((upstreams: NodeUpstreams) => CastOptions);

/** One node of a graph: identity + the play + budget/opts + an `adapt` that builds the play's typed
 *  inputs from this node's upstreams' produced refs. The PlayStep generalized with identity and a
 *  NodeUpstreams (multi-upstream) adapter instead of a single `upstream: string | undefined`. */
export interface PlayNode<I, O> {
  readonly id: NodeId;
  readonly play: Play<I, O>;
  readonly budget: Budget;
  readonly opts: NodeOptions;
  readonly adapt: (upstreams: NodeUpstreams) => I | Promise<I>;
}

/** Cast a declared graph — inject `adapt → castPlay` per node, run independent ready nodes
 *  CONCURRENTLY (Promise.all per wave), thread/join/halt via the reused pure core. IMPURE
 *  (spawns); NOT unit-tested (its logic is the tested runGraph + decideThread + topoSort). */
export async function castGraph(
  nodes: readonly PlayNode<any, any>[],
  edges: readonly DagEdge[],
): Promise<GraphResult>;
```

`PlayNode<any, any>[]` carries the same documented type-erasure as `castChain`'s `PlayStep<any,any>[]`
and `AnyPlay` — a graph is heterogeneous; safety lives at each node's construction + the `adapt`/`opts`
seams.

### `castGraph` internals — the concurrent wave dispatcher

1. **Build the spec.** Map each `PlayNode` → `DagNode` whose `cast` closes over `adapt → castPlay`:
   `async (upstreams) => castPlay(n.play, await n.adapt(upstreams), n.budget, resolveOpts(n.opts, upstreams))`.
   This is the `castChain` injection, generalized to the `NodeUpstreams` join map.
2. **Order + cycle refusal.** `topoSort(spec)`; a `{ cycle }` is refused TOTALLY (cast nothing, every
   node skipped, `outcome: "gate-failed"`, `halted: true`) — byte-for-byte the `runGraph` cycle path.
3. **Adjacency.** `inEdges: to → from[]`, `outDegree` (sinks), over **declared** endpoints only —
   parity with `runGraph`/`topoSort`'s "unknown endpoint → ignored".
4. **Wave loop** over `proceeded`/`producedAll`/`summaries`/`skipped`/`haltReasonOf`/`decided`:
   - **wave** = remaining nodes whose every upstream is `decided` (non-empty for an acyclic order).
   - **skip** the wave nodes with a non-`proceeded` upstream (record `SkippedNode` + andon; cascades).
   - **CONCURRENCY:** `Promise.all` the runnable wave nodes — each gathers its `NodeUpstreams` join
     map and `await`s its `cast`. This is "run plays in parallel."
   - settle: `decideThread` each result → `proceeded`+`producedAll`, else `haltReasonOf`.
5. **Deterministic assembly** (independent of concurrent settle order): `outcome` = first non-success
   summary in **topo order** ?? `"success"`; `produced` = sink (`outDegree 0`) nodes in `producedAll`,
   topo order; `skipped` sorted by topo order; `halted`/`haltReason` from `skipped`.

## `graph-example.ts` — the deterministic worked example (AC#2)

A diamond **A → {B, C} → D** (≥1 fan-out at A, ≥1 join at D) of **stub** nodes returning canned
`RunSummary`s (the `graph-core.test.ts` `summary()` discipline), each recording the `NodeUpstreams`
it was cast with. Exports:

```ts
export interface DiamondTrace { readonly upstreamsSeenByD: Record<NodeId, string>; readonly result: GraphResult; }
export function diamondExample(): { spec: DagSpec; seen: Record<NodeId, Record<string, string>> };
export async function runDiamondExample(): Promise<DiamondTrace>;  // drives the PURE runGraph
```

Drives `runGraph` (the pure core) — **not** `castGraph` — so the module is importable by a `bun test`
and deterministic. The example proves the SHAPE the substrate enables (fan-out + join); the runtime
concurrency is `castGraph`'s, proven live.

## `graph-example.test.ts` — proofs (AC#2 + AC#3)

- **AC#2 (worked example):** run `runDiamondExample()` → all four nodes cast (`result.nodes.size === 4`);
  B and C each saw `{ A: "pa" }` (parallel branches off A's `produced`); **D saw `{ B: "pb", C: "pc" }`**
  (the join receives BOTH upstreams); `result.produced === { D: "pd" }`; not halted.
- **AC#3 (fails-vs-linear):** the same 4-node graph run two ways. Via `runGraph`, D's recorded
  upstreams = both B and C. Via `runChain` over ANY linearization `[A,B,C,D]` (each `ChainStep.cast`
  records the single `upstream: string | undefined` it receives), D's step receives **exactly one**
  upstream ref (the immediately-prior step's `produced`) — `runChain` structurally threads a single
  value, so no `ChainStep[]` linearization feeds D both B's and C's `produced`. Assert: `runGraph`
  delivers a 2-entry join where `runChain` delivers a 1-value thread. The "genuinely non-linear" proof.

## Purity & boundaries

- `graph.ts`: value-imports `castPlay` (the spawn) → like `chain.ts`, **no `bun test` value-imports it**.
  Reuses `topoSort` + `decideThread` (pure values) + the `GraphResult`/`SkippedNode` shapes.
- `graph-example.ts` + `graph-example.test.ts`: type-only + `runGraph`/`runChain`/`dag-core` (all
  type-only-importing the impure `cast.ts`) → load no addon, spawn nothing. NO LIVE MODEL.
- `bun run check:typecheck` + `check:test` green; respects N4 (the graph orchestrates Vend's own
  clearing plays; lisa still executes).
