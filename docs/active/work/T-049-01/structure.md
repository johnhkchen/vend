# T-049-01 — Structure

The blueprint: file-level changes, interfaces, and the shape of the `runGraph` edit. No new files; no
deletions.

## Files modified

### 1. `src/engine/dag-core.ts` — add the predicate to the model (no logic change)

New exported type, above or beside `DagEdge`:

```ts
/** A branch predicate over an upstream node's `produced` result — decides whether THIS edge fires.
 *  Returns true ⇒ the edge threads `from` → `to`; false ⇒ the edge does not fire and `to`'s
 *  dependent subgraph cascade-skips as a branch-not-taken. PURE: a read over an already-produced
 *  string, injected like a node's `cast`. */
export type EdgePredicate = (produced: string) => boolean;
```

`DagEdge` gains one optional field (the only change to the interface):

```ts
export interface DagEdge {
  readonly from: NodeId;
  readonly to: NodeId;
  /** Optional branch predicate over the `from` node's `produced`. Absent ⇒ the edge ALWAYS fires
   *  (the pre-E-049 unconditional fan-out). NOT consulted by validateDag/topoSort — the structural
   *  dependency `from`→`to` holds regardless of runtime branch selection. */
  readonly when?: EdgePredicate;
}
```

`validateDag` and `topoSort` are **unchanged** — they read only `from`/`to`.

### 2. `src/engine/graph-core.ts` — `runGraph` only

**Import:** add `type DagEdge` to the existing `dag-core.ts` import.

**`SkippedNode.blockedBy` doc** widens (interface shape unchanged): from "in-edge upstream(s) that did
not proceed" to "in-edge upstream(s) whose edge did not fire — either the upstream did not proceed
(halted) or this edge's predicate rejected its produced (branch not taken)".

**`inEdges` map** changes element type to carry edge identity (the predicate):

```ts
const inEdges = new Map<NodeId, DagEdge[]>();   // was Map<NodeId, NodeId[]>
// ...
inEdges.get(edge.to)?.push(edge);               // was push(edge.from)
```

**The per-node loop body** (the only behavioral change) — replace the two-state halt check with a
three-state in-edge classification + dual reason:

```
for each id in order:
  ins = inEdges.get(id) ?? []
  halted: NodeId[] = []      // upstream did not proceed
  notTaken: NodeId[] = []    // upstream proceeded but this edge's `when` rejected its produced
  for each edge in ins:
    if !proceeded.has(edge.from):  halted.push(edge.from); continue
    if edge.when !== undefined:
      p = producedAll.get(edge.from)              // proceeded ⇒ present (defensive: undefined ⇒ not-firing)
      if p === undefined || !edge.when(p):  notTaken.push(edge.from)
  if halted.length > 0 || notTaken.length > 0:
    blockedBy = [...halted, ...notTaken]
    reason = halted.length > 0
      ? `skipped — dependent on halted upstream ${causes(halted)}`   // existing, unchanged
      : `skipped — branch not taken: upstream ${quote(notTaken)} produced a result this edge's predicate rejected`
    skipped.push({ id, blockedBy, reason }); continue
  // JOIN: every in-edge fired ⇒ gather upstreams' produced (iterate `ins`, key by edge.from)
  upstreams = new Map(ins.flatMap(e => producedAll.get(e.from) is set ? [[e.from, p]] : []))
  // ... CAST / decideThread / FAN-OUT exactly as today
```

`causes(halted)` is the existing `haltReasonOf`-enriched mapping (lifted verbatim). Everything after the
JOIN (cast, `firstFail`, `decideThread`, `proceeded`/`producedAll`/`haltReasonOf`, SINKS, return) is
**unchanged**.

### 3. `src/engine/graph-core.test.ts` — new coverage

**Import:** add `validateDag` from `./dag-core.ts` (the file already imports `DagEdge`/`DagNode`/etc.).

New `describe("runGraph — conditional edges select the taken branch (E-049, T-049-01)")` with cases:

1. **The AC fan-out** — `1→{A,B}` with mutually-exclusive `when` predicates over `1`'s produced: only
   the matching branch (`A`) is cast (assert via `recordingNode` calls), `B` is in `skipped`, only `A`'s
   leaf is in `produced`, `halted === true`.
2. **Distinct andon** — `B`'s reason `toContain("branch not taken")` and
   `.not.toContain("dependent on halted upstream")`; `blockedBy` contains `"1"`.
3. **validateDag ok** — `validateDag(predicatedSpec)` equals `{ ok: true }`.
4. **Back-compat** — an edge with no `when` still fires unconditionally (`B` cast with `{A:"pa"}`,
   `halted === false`).
5. **Cascade** — a not-taken `B` with a downstream `C` (`neverNode`): both in `skipped`; `B`'s reason is
   "branch not taken", `C`'s is "dependent on halted upstream" (reuse proven).

## Ordering of changes

1. `dag-core.ts` (type) → 2. `graph-core.ts` (`runGraph`) → 3. tests. Each step typechecks
independently: the type is additive, the runner change compiles against it, the tests exercise both.

## Boundaries preserved

- Pure-core/impure-shell split: only the pure cores (`dag-core.ts`, `graph-core.ts`) change; no
  `castPlay`/`graph.ts`/executor touch.
- `runGraphConcurrent` left correct (it still reads `inEdges` as from-ids — see Plan note: its own
  `inEdges` is a *separate* local; this ticket does not modify it; T-049-02 does).
- No new offense kinds, no `GraphResult` shape change, no `SkippedNode` shape change.
</content>
