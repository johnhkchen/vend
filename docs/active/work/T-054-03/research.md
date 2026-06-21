# T-054-03 Research — deterministic-dual-runner-throw-equivalence

_Descriptive map of the codebase as it stands at the start of this ticket. What exists,
where, how it connects. No solutions proposed._

## The ticket in one line

Prove that a throwing-node spec yields an **identical clean `GraphResult`** under the
sequential `runGraph` and the concurrent `runGraphConcurrent`, closing the last unbuilt
graph primitive on the E-046 DAG substrate and making the dispatcher total over node
behavior (success, non-success outcome, AND exception). This is a **test-only** ticket:
the behavior it asserts already ships — the work is the formal equivalence proof.

## What already exists (the inherited substrate)

### The two runners — `src/engine/graph-core.ts`

One module hosts BOTH executors over one pure core (header comment, lines 17-39):

- `runGraph` (T-046-02) — the SEQUENTIAL reference. Awaits each node one-at-a-time in
  topo order (`topoSort`). Correctness, not parallelism, is its contract.
- `runGraphConcurrent` (T-046-03) — its CONCURRENT twin. A wave dispatcher that
  `Promise.all`s each topological ready-set, optionally threading one shared wallet
  (E-048). Assembles the result in TOPO ORDER so the `GraphResult` is deterministic
  despite concurrent settle.

Both return the same `GraphResult` (lines 103-115):
```
nodes: ReadonlyMap<NodeId, RunSummary>   // one per CAST node (skipped absent)
skipped: readonly SkippedNode[]          // dependent-subgraph skips, topo-ordered
outcome: RunOutcome                      // first non-success in topo order, else success
halted: boolean                          // skipped.length > 0
produced: ReadonlyMap<NodeId, string>    // sink (out-degree-0) produced refs
haltReason?: string                      // first skip's cause when halted
walletRemaining?: Budget                 // ONLY on the budgeted concurrent path
```

### The throw-containment is ALREADY wired (T-054-02 — commit `f25d81c`)

Both runners catch a thrown cast and substitute the `errored` summary:

- `runGraph` cast site (graph-core.ts:236-241):
  ```ts
  let summary: RunSummary;
  try { summary = await node.cast(upstreams); }
  catch { summary = erroredSummary(id); }
  ```
- `runGraphConcurrent` cast site, INSIDE the `dispatch.map` thunk (graph-core.ts:475-479):
  ```ts
  try { return [id, await node.cast(upstreams)] as const; }
  catch { return [id, erroredSummary(id)] as const; }
  ```
  Placing the catch inside the thunk is load-bearing — `Promise.all` sees a RESOLVED
  member, so the wave never rejects and sibling thunks in the same wave keep their results.

### The pure throw→errored primitive (T-054-01 — commit `86f2739`)

`erroredSummary(id)` (graph-core.ts:68-70):
```ts
export function erroredSummary(id: NodeId): RunSummary {
  return { runId: `errored:${id}`, outcome: NODE_ERRORED, materialized: false };
}
```
- `outcome: "errored"` — a non-success `RunOutcome` (`NODE_ERRORED`, line 53).
- `produced` ABSENT — nothing threadable ⇒ `decideThread` refuses it ⇒ dependents skip.
- `actuals` ABSENT — nothing measured ⇒ `actualsDelta` ⇒ `{0,0}` ⇒ no phantom wallet charge.
- `runId: "errored:${id}"` — a **pure function of the node id**. No clock, no random.

This last property is the load-bearing precondition this ticket leans on: the same
throwing spec yields a **byte-identical** errored summary under both runners, so equivalence
is not merely structural — it is exact.

### The halt routing both runners reuse — `decideThread` (chain-core.ts:49-57)

```ts
if (summary.outcome !== "success") return { proceed: false, reason: `halted: step outcome '${summary.outcome}' is not success` };
```
The errored summary takes this FIRST branch — no new branch was added. A non-proceeding
node never enters `proceeded`, so its dependents classify their in-edge to it as `halted`
and cascade-skip via the EXISTING machinery (graph-core.ts:190-219 sequential; 395-433
concurrent). The skip reason names the upstream and threads `decideThread`'s reason, so a
dependent of an errored node reads `… halted upstream 'B' (halted: step outcome 'errored'
is not success)`.

### The outcome / vocabulary — `src/log/run-log.ts`

`RUN_OUTCOMES` (line 50) carries `"errored"` as its last member (added T-054-01); the
header comment (lines 46-48) documents `errored ← a node's cast THREW`. `RunSummary`
lives in `src/engine/cast.ts:101-120`; `produced`/`actuals` are both optional, exactly as
`erroredSummary` relies on.

## The equivalence test PATTERN already in the file

`src/engine/graph-core.test.ts` is a pure-function test — it imports ONLY `graph-core.ts`
+ `dag-core.ts` (+ wallet/budget types), loads no native addon, spawns nothing, NO LIVE
MODEL. Two facets-equality patterns already exist and are the template to mirror:

1. **E-049 block** (`runGraphConcurrent — conditional edges mirror runGraph`, lines
   340-474). Defines the cross-executor projection:
   ```ts
   const facets = (r: GraphResult) => ({
     cast: [...r.nodes.keys()].sort(),
     skipped: r.skipped.map((s) => ({ id: s.id, reason: s.reason, blockedBy: [...s.blockedBy] })),
     produced: Object.fromEntries(r.produced),
     outcome: r.outcome,
     halted: r.halted,
   });
   ```
   Then `expect(facets(con)).toEqual(facets(seq))`. The comment (lines 343-345) explains
   WHY a naive deep-equal is wrong: `walletRemaining` is present only on the budgeted
   concurrent path, so equality is asserted on the facet projection, not the whole object.

2. **T-054-02 block** (`a thrown cast becomes an 'errored' node…`, lines 476-548). Already
   has the spec shape this ticket needs — `mkParts()`: `A→{B(throws), C}`, `B→D`, with
   `throwingNode("B")`, `recordingNode` siblings, and `neverNode("D")` (throws if cast,
   proving the cascade-skip). Its test #4 (lines 542-547) does a MINIMAL parity check:
   `expect(facets(con)).toEqual(facets(seq))` for that throwing spec. The T-054-02
   review (review.md, lines 71-74) explicitly defers the FORMAL dual-runner
   byte-equivalence matrix to **this ticket** ("the FORMAL proof … is T-054-03's ticket").

### Test helpers available (graph-core.test.ts:16-60)

- `summary(outcome, produced?)` — a canned cast result.
- `recordingNode(id, result)` — records the `NodeUpstreams` it was cast with (proves JOIN).
- `neverNode(id)` — throws if cast (asserts a halt skipped it).
- `throwingNode(id)` — cast THROWS; the stimulus the runner must ABSORB (T-054-02 added it).
- `edge(from, to)` / `spec(nodes, edges)` — terse builders.
- `facets(r)` — defined twice (E-049 block + T-054-02 block); the cross-executor projection.

## Constraints & assumptions

- **No live model, no spawn.** The test process must stay pure (the chain-core.test.ts
  discipline). Only `graph-core.ts` + `dag-core.ts` (+ type-only) may be imported.
- **Determinism is provided, not engineered here.** `topoSort`'s declaration-order
  tie-break + `erroredSummary` being a pure fn of `id` mean the two runners already produce
  identical results; the ticket OBSERVES this, it does not have to make it true.
- **`walletRemaining` asymmetry.** `runGraph` never sets it; the unbudgeted concurrent path
  never sets it. A whole-object `toEqual` between the two unbudgeted runners would actually
  pass (both omit it), but the established idiom asserts on `facets` — which is also what
  makes the proof robust if a budgeted variant is added.
- **AC names four facets explicitly:** nodes / skipped / outcome / halted. The `facets`
  projection covers all four (plus `produced`), so the AC maps cleanly onto it.
- **The spec must have an independent sibling** (AC wording). The `mkParts()` shape's `C`
  (depends only on `A`, independent of the throwing `B`) satisfies this.

## What is NOT in scope

- Changing runner behavior — already shipped; this ticket adds tests only.
- Error message/stack observability — deliberately discarded at the catch site (T-054-02
  open concern #1); a separate, justified change if ever wanted.
- A throw under a budgeted wallet — the `{0,0}` debit is an already-tested E-048 invariant;
  may be added as a strengthening but is not required by the AC.
