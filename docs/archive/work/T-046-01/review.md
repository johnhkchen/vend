# T-046-01 — Review

Handoff for a human reviewer: what changed, test coverage, AC traceability, and open concerns.
**Bottom line:** the typed DAG model + a pure, total, deterministic `topoSort` + a total
`validateDag` are implemented and fully unit-tested. `bun run check:typecheck` and `bun test`
(1105 pass, 0 fail) are green. No live model. Scope held to shape + ordering — no run, no shell.

## Files changed

| File | Action | Summary |
|---|---|---|
| `src/engine/dag-core.ts` | **created** | The pure DAG model (`DagNode`/`DagEdge`/`DagSpec`), `validateDag` (total), `topoSort` (Kahn's, deterministic). Type-only `RunSummary` import — no fs/clock/network/addon. ~190 lines. |
| `src/engine/dag-core.test.ts` | **created** | 18 pure-function tests across the full ticket matrix; fakes only, spawns nothing. |
| `docs/active/work/T-046-01/{research,design,structure,plan,progress,review}.md` | **created** | RDSPI artifacts. |

Untouched: `chain-core.ts`, `chain.ts`, `cast.ts` — T-046-01 is purely additive. T-046-02 will
generalize the chain's *logic* into `runGraph`, not by editing the chain.

## What was built

- **Model.** `NodeId = string` (transparent alias); `NodeCast = (...args: readonly unknown[]) =>
  Promise<RunSummary>` (opaque — this ticket reads only `id`; T-046-02 narrows it);
  `DagNode {id, cast}`, `DagEdge {from, to}`, `DagSpec {nodes, edges}`.
- **`topoSort(spec): { order } | { cycle }`** — Kahn's indegree BFS. Pure, total, deterministic.
  Tie-break: emit the smallest declaration-index ready node each step (pure node-declaration order).
  Edges with unknown endpoints are skipped (stays total on malformed input). A cyclic graph returns
  the un-emitted nodes as `{ cycle }` — detected and returned, never run, never hung. Empty →
  `{ order: [] }`.
- **`validateDag(spec): { ok } | { ok:false, offenses }`** — total, accumulates ALL faults as
  distinct named `DagOffense`s: `duplicate-node`, `dangling-edge`, `cycle`. The cycle check is
  delegated to `topoSort` (single cycle authority) and consulted only when the graph is
  structurally sound, so a dangling/duplicate fault can't mask or masquerade as a cycle.

## Test coverage

18 tests, all green. Coverage by area:

- **topoSort valid shapes:** empty, single, linear, fan-out (1→2), join (2→1), diamond, disconnected.
- **topoSort determinism:** same spec sorted twice → deep-equal; declaration-order tie-break asserted.
- **topoSort cycles:** 2-cycle, 3-cycle, self-loop, cycle + acyclic tail (only cyclic nodes reported).
- **validateDag clean:** all five valid shapes + empty → `{ ok: true }`.
- **validateDag offenses:** dangling-edge, duplicate-node, cycle each → the named offense; a
  multi-fault graph → multiple offenses (accumulation, not first-failure).

### AC → test traceability

| Acceptance criterion | Status | Evidence |
|---|---|---|
| `DagNode/DagEdge/DagSpec` declared; pure module; type-only imports (no fs/addon) | ✅ | `dag-core.ts` (only `import type { RunSummary }`); `tsc` green |
| `validateDag` total; refuses dangling / duplicate / cycle as distinct named offenses | ✅ | "validateDag — distinct named offenses" group (4 tests) |
| `topoSort` pure, total, deterministic — `order` for a DAG (stable tie-break) or `cycle` nodes | ✅ | "topoSort — valid shapes" + "determinism" + "cycles" groups |
| Unit-tested across linear/fan-out/join/diamond/disconnected/cycle/dangling/empty; no live model; `check:*` green | ✅ | full matrix present; 1105/1105 suite + typecheck green |

## Deviations from plan

One, documented in `progress.md`: the tie-break is implemented as smallest-ready-index selection
rather than a FIFO ready queue. FIFO conflated node-declaration order (seed) with edge-declaration
order (successor recording); the chosen rule makes the tie-break purely *node* declaration order —
exactly Design D4's stated intent and robust to edge ordering. No interface or scope change.

## Open concerns / notes for downstream (T-046-02, T-046-03)

1. **`NodeCast` is intentionally wide.** `(...args: readonly unknown[])` is a placeholder. T-046-02
   MUST narrow it to the real upstream-collection signature (a join receives several `produced`
   refs). Reviewers: this is the one spot deliberately under-typed; it is by design (avoids churning
   the just-shipped model), not an oversight.
2. **`topoSort` totality vs. `validateDag` refusal split.** `topoSort` degrades gracefully on
   malformed graphs (skips unknown-endpoint edges, never throws); `validateDag` is what *refuses*
   them. A caller that runs a graph (T-046-02) should validate FIRST, then sort — don't rely on
   `topoSort` alone to reject a malformed spec.
3. **`validateDag` suppresses the cycle check when structural faults exist.** Intentional (a
   dangling/duplicate graph's cycle status is ill-defined), but means a graph can need two
   validate→fix passes to surface a cycle hidden behind a structural fault. Acceptable for an
   author-time check; noted for transparency.
4. **O(n²) tie-break scan.** Negligible at playbook-graph scale (handful of nodes). If graphs ever
   grow large, swap the linear min-scan for an indexed ready-heap — but YAGNI for v1.
5. **No concurrency, no real cast here.** By scope. The parallel-branch execution and the
   fails-vs-linear worked example are T-046-03.

## Verification commands

```
bun run check:typecheck          # tsc --noEmit — green
bun test src/engine/dag-core.test.ts   # 18 pass, 0 fail
bun test                          # 1105 pass, 0 fail (full suite)
```
