# T-049-02 — Structure

The blueprint: file-level changes, the exact shape of the `runGraphConcurrent` edit, and the test
block. No new files; no deletions; no model change (the `when` field already exists from T-049-01).

## Files modified

### 1. `src/engine/graph-core.ts` — `runGraphConcurrent` ONLY

`DagEdge` is already imported (line 44, `type DagEdge`). No import change. `runGraph`, the cycle
guard, `byId`, the wave loop's budget/settle/debit, the SINKS, and the return are all **unchanged**.

**Change A — `inEdges` element type (line 317) carries the whole edge.**

```ts
const inEdges = new Map<NodeId, DagEdge[]>();   // was Map<NodeId, NodeId[]>
```

**Change B — push the whole edge (line 325).**

```ts
inEdges.get(edge.to)?.push(edge);               // was push(edge.from)
```

**Change C — wave-ready reads `edge.from` (line 346).**

```ts
const wave = order.filter(
  (id) => remaining.has(id) && (inEdges.get(id) ?? []).every((e) => decided.has(e.from)),
);
```

**Change D — the skip step becomes three-state (replaces lines 352–363).** Compute `halted`/`notTaken`
per wave node in one pass (memoized so the record loop doesn't re-evaluate predicates), then record with
halt precedence:

```ts
// SKIP: a wave node whose in-edges did not all FIRE — halted (an upstream did not proceed) or
// branch-not-taken (an upstream proceeded but this edge's `when` rejected its produced, E-049).
// Classified EXACTLY as runGraph (the sequential reference this must equal); halt takes precedence.
const classified = new Map<NodeId, { halted: NodeId[]; notTaken: NodeId[] }>();
const toSkip = wave.filter((id) => {
  const halted: NodeId[] = [];
  const notTaken: NodeId[] = [];
  for (const edge of inEdges.get(id) ?? []) {
    if (!proceeded.has(edge.from)) {
      halted.push(edge.from);
      continue;
    }
    if (edge.when !== undefined) {
      const p = producedAll.get(edge.from); // proceeded ⇒ present; defensive: undefined ⇒ not-firing
      if (p === undefined || !edge.when(p)) notTaken.push(edge.from);
    }
  }
  classified.set(id, { halted, notTaken });
  return halted.length > 0 || notTaken.length > 0;
});
const skipSet = new Set(toSkip);
for (const id of toSkip) {
  const { halted, notTaken } = classified.get(id) ?? { halted: [], notTaken: [] };
  const blockedBy = [...halted, ...notTaken];
  const reason =
    halted.length > 0
      ? `skipped — dependent on halted upstream ${halted
          .map((from) =>
            haltReasonOf.has(from) ? `'${from}' (${haltReasonOf.get(from)})` : `'${from}' (upstream skipped)`,
          )
          .join(", ")}`
      : `skipped — branch not taken: upstream ${notTaken
          .map((from) => `'${from}'`)
          .join(", ")} produced a result this edge's predicate rejected`;
  skipped.push({ id, blockedBy, reason });
  decided.add(id);
  remaining.delete(id);
}
```

The reason expressions are **copied verbatim** from `runGraph` (graph-core.ts 184–193) so the strings
are byte-identical across executors.

**Change E — the JOIN map reads `edge.from` (lines 393–398).**

```ts
const upstreams: NodeUpstreams = new Map(
  (inEdges.get(id) ?? []).flatMap((e) => {
    const p = producedAll.get(e.from);
    return p === undefined ? [] : [[e.from, p] as const];
  }),
);
```

**Untouched within `runGraphConcurrent`:** the wallet `let`, `authorizeWave`/`stopped`/budget-stop
records, `Promise.all` dispatch, SETTLE (`decideThread`), `debitWave`, deterministic assembly, SINKS,
`skipped.sort`, the `GraphResult` return (incl. `walletRemaining`).

## Why each existing path is preserved

- **No-`when` edges:** `edge.when === undefined` ⇒ never `notTaken`; `halted` is exactly the old
  `some(from => !proceeded.has(from))` set. So the two-state behavior is reproduced bit-for-bit when no
  predicate is present — every existing concurrency + wallet test is unaffected.
- **Budget path:** the classification runs before `authorizeWave`; `runnable = wave \ skipSet` now also
  excludes not-taken nodes, exactly as it already excludes halted ones. `authorizeWave`/`debitWave`
  receive a `runnable`/`dispatch` set and are otherwise blind to the reason a node was excluded.

### 2. `src/engine/graph-core.test.ts` — new cross-executor coverage

**Imports (extend the existing two import lines):**

```ts
import { runGraph, runGraphConcurrent, type GraphResult } from "./graph-core.ts";
import { allocate } from "../budget/wallet.ts";
import type { Budget } from "../budget/budget.ts";
```

(`validateDag`, `DagEdge`, `DagNode`, `DagSpec`, `NodeUpstreams` already imported; `summary`,
`recordingNode`, `neverNode`, `edge`, `spec`, `whenEq`, `whenNeq` already defined.)

**A `facets` projection** (the AC's definition of "equal" — cast set, skipped ids+reasons+blockedBy,
produced, outcome, halted), declared near the top of the new block:

```ts
const facets = (r: GraphResult) => ({
  cast: [...r.nodes.keys()].sort(),
  skipped: r.skipped.map((s) => ({ id: s.id, reason: s.reason, blockedBy: [...s.blockedBy] })),
  produced: Object.fromEntries(r.produced),
  outcome: r.outcome,
  halted: r.halted,
});
```

**A costed stub** for the budgeted case (mirrors graph-example.ts `costedStub` — `actuals` so
`debitWave` folds a real delta):

```ts
const costed = (id: string, produced: string, price: Budget): DagNode => ({
  id,
  cast: async () => ({
    runId: `run-${id}`, outcome: "success", materialized: true, produced,
    actuals: { usage: { input_tokens: price.tokens }, wallMs: price.timeMs },
  }),
});
```

**New `describe("runGraphConcurrent — conditional edges mirror runGraph (E-049, T-049-02)")`** cases:

1. **Equality on the AC fan-out** — the `predicated()` spec (1→{A,B}, mutually-exclusive `when`): run
   both executors; `expect(facets(concurrent)).toEqual(facets(sequential))`; spot-assert B is skipped
   "branch not taken", produced is `{A:"pa"}`, cast set `["1","A"]`.
2. **Multi-wave branch with a cascade** — 1→{A,B} predicated, A→C, B→D: B not-taken (wave 2), D
   cascade-skips (wave 3) via the halt path, C runs. Assert `facets` equal across executors; assert
   `skipped` ids `["B","D"]` with B="branch not taken", D="dependent on halted upstream".
3. **Branch-not-taken under a budgeted wallet** — the `predicated` spec with `costed` nodes + a wallet
   generously funded (nothing budget-stops). Assert `facets(concurrentBudgeted)` equals
   `facets(sequential)` (same skip+produced), AND `walletRemaining` is present and reflects only the
   cast nodes' debit (the not-taken branch never debited → remaining = funded − (root+A) tokens). Proves
   predicate firing composes with the E-048 wallet path, untouched.
4. **Back-compat equality (no `when`)** — a plain diamond (no predicates): `facets` identical across
   executors and unchanged from pre-E-049 (guards the two-state path).

## Ordering of changes

1. `graph-core.ts` `runGraphConcurrent` (A–E together — they typecheck only as a set: once `inEdges` is
   `DagEdge[]`, the reads must move to `edge.from`). → 2. tests. The model is already in place.

## Boundaries preserved

- Pure-core only: just `runGraphConcurrent` in the pure `graph-core.ts`; no `castGraph`/`graph.ts`/
  executor touch. The test stays a pure-function test (wallet algebra is pure; no spawn, no addon).
- `runGraph` untouched (the reference oracle). `topoSort`/`validateDag`/`decideThread`/the budget
  algebra untouched. No `GraphResult`/`SkippedNode` shape change, no new offense kind.
