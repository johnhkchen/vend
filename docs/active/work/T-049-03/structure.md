# T-049-03 — Structure

**Ticket:** branching-worked-example-through-castgraph (S-049-01, E-049)
The blueprint — file-level changes, exact shapes, ordering. Not code; the shape of the code.

## Files touched

| File | Change | Why |
|---|---|---|
| `src/engine/graph-example.ts` | ADD a router fixture + runner (the branching worked example) | The deterministic stub example the AC requires, extending the existing pattern |
| `src/engine/graph-example.test.ts` | ADD a `describe` block proving taken/not-taken selection end-to-end | The proof; asserts against the established reason contract |
| `docs/active/work/T-049-03/*` | RDSPI artifacts | Phase outputs |

No source under `src/engine/dag-core.ts`, `graph-core.ts`, or `graph.ts` changes — the feature is built;
this ticket only adds a worked example + its test. No new files, no deletions.

## `src/engine/graph-example.ts` — additions (append after the shared-wallet section)

### 1. A section header comment (mirrors the E-046/E-048 section banners)

A block comment in the house style explaining:
- This is the E-049 conditional-edges worked example: an author declares a branch ONCE on the edge; the
  not-taken subgraph is an observable skip.
- It drives the PURE `runGraphConcurrent` (the dispatcher `castGraph` delegates to) with recording
  stubs — NO `castPlay`, NO native addon, nothing spawned. `castGraph` is *predicate-transparent* (it
  passes `edges` incl. every `when` straight through, graph.ts:114), so this proves the exact
  end-to-end author path — the same way `runSharedWalletFanout` proves the E-048 wallet feature that
  also lives in `castGraph`. NO LIVE MODEL.

### 2. `branchingExample(route)` — the parametric router fixture

```
export function branchingExample(route: "go" | "stop"): {
  spec: DagSpec;
  seen: Record<NodeId, Record<string, string>[]>;   // live upstream records per node id
}
```

Internals:
- Five recording stubs via the EXISTING `recordingStub` (graph-example.ts:30):
  `R` produces `route` (the routing signal — "go" or "stop"); `T` produces `"pt"`; `TD` produces
  `"ptd"`; `N` produces `"pn"`; `ND` produces `"pnd"`.
- `spec.nodes = [R, T, TD, N, ND]` (declaration order; topoSort tie-breaks on it ⇒ deterministic).
- `spec.edges`:
  - `{ from: "R", to: "T", when: (p) => p === "go" }`
  - `{ from: "R", to: "N", when: (p) => p === "stop" }`
  - `{ from: "T", to: "TD" }`   (plain — the taken branch's downstream)
  - `{ from: "N", to: "ND" }`   (plain — the not-taken branch's dependent subgraph)
- Return `{ spec, seen: { R: r.calls, T: t.calls, TD: td.calls, N: n.calls, ND: nd.calls } }`.

The predicates close over nothing impure — they are pure reads over a string, exactly `EdgePredicate`.

### 3. `BranchingTrace` — the surfaced result shape (mirrors `DiamondTrace`)

```
export interface BranchingTrace {
  readonly upstreamsSeen: Record<NodeId, Record<string, string> | undefined>; // undefined ⇒ node never cast
  readonly result: GraphResult;
}
```

`undefined` for a node that never cast (its `calls` array is empty) is the load-bearing distinction
between "ran" and "skipped" — the diamond's `?? {}` collapse is deliberately NOT reused here, because
the skip is the whole point.

### 4. `runBranchingExample(route)` — the runner

```
export async function runBranchingExample(route: "go" | "stop"): Promise<BranchingTrace>
```

- `const { spec, seen } = branchingExample(route);`
- `const result = await runGraphConcurrent(spec);` — the dispatcher `castGraph` delegates to; no wallet
  (the predicate path is independent of budgeting), so the legacy concurrent path runs.
- Build `upstreamsSeen`: for each id in `seen`, `seen[id][0]` if the node was cast (one call in this
  fixture), else `undefined`.
- Return `{ upstreamsSeen, result }`.

### Imports

No import changes needed: `runGraphConcurrent`, `GraphResult`, `DagSpec`, `NodeId` are already imported
in graph-example.ts (lines 16-19). `recordingStub`, `summary` already defined.

## `src/engine/graph-example.test.ts` — additions (append a new describe block)

### Import change

Extend the existing import from `./graph-example.ts` (line 7) to add `runBranchingExample`. No new module
imports — stays within the pure-core discipline (no graph.ts).

### `describe("AC (E-049): an authored edge predicate routes the branch; the not-taken subgraph skips")`

Three tests:

**Test 1 — `route="go"`: the taken branch runs; the not-taken branch + its subgraph skip.**
- `const { upstreamsSeen, result } = await runBranchingExample("go");`
- Cast set: `[...result.nodes.keys()].sort()` ⇒ `["R", "T", "TD"]`; `result.nodes.has("N")` false,
  `.has("ND")` false.
- Routed data reached the taken branch: `upstreamsSeen.R === {}` (source), `upstreamsSeen.T === {R:"go"}`,
  `upstreamsSeen.TD === {T:"pt"}`. `upstreamsSeen.N` and `upstreamsSeen.ND` are `undefined` (never cast).
- Skips: `result.skipped.map(s => s.id).sort()` ⇒ `["N", "ND"]`.
- Andons: `N`'s reason `toMatch(/branch not taken/)` and `not.toMatch(/dependent on halted upstream/)`;
  `ND`'s reason `toMatch(/dependent on halted upstream/)` (cascade through the reused halt machinery).
- Clean route: `result.outcome === "success"`, `result.halted === true`.
- Net output: `Object.fromEntries(result.produced)` ⇒ `{ TD: "ptd" }`.

**Test 2 — `route="stop"`: the mirror image proves declare-once / route-by-data.**
- Cast set ⇒ `["N", "ND", "R"]` sorted; `T`/`TD` absent.
- `upstreamsSeen.N === {R:"stop"}`, `upstreamsSeen.ND === {N:"pn"}`; `T`/`TD` `undefined`.
- Skips ⇒ `["T", "TD"]`; `T`'s reason `branch not taken`, `TD`'s reason `dependent on halted upstream`.
- `produced` ⇒ `{ ND: "pnd" }`. `outcome === "success"`, `halted === true`.

**Test 3 — the two routes share ONE declared graph (the author declared the branch once).**
- Assert `branchingExample("go").spec.edges` and `branchingExample("stop").spec.edges` are structurally
  identical in `from`/`to` (the edge topology does not change with the route) — i.e. only R's produced
  data differs, the graph is the same. This pins the "declare once on the edge, route by data" claim.
- (Optional, lightweight: assert both specs are `validateDag`-clean — but validateDag is already proven
  predicate-agnostic in T-049-01; keep this test focused on edge-topology identity to avoid redundancy.)

## Ordering of changes

1. graph-example.ts: section comment → `branchingExample` → `BranchingTrace` → `runBranchingExample`.
2. graph-example.test.ts: extend import → add describe block.
3. `bun run build` (typecheck) → `bun test` (full suite green).

Each step is independently checkable; the test file change is meaningless until the example exists, so
the example lands first.

## Invariants preserved

- **Import discipline:** both files import only graph-core.ts (+ type-only cast.ts); neither value-imports
  graph.ts. Verified by inspection — no `from "./graph.ts"` appears.
- **Determinism:** stubs return canned summaries; no clock/random; topoSort declaration-order tie-break.
- **Contract reuse:** asserts against the EXISTING reason strings (`branch not taken`, `dependent on
  halted upstream`) from T-049-01/02 — the example cannot drift from the reference semantics.
- **No production code change:** the feature is built; this is purely an additive worked example + test.
