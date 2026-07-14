# T-049-03 — Design

**Ticket:** branching-worked-example-through-castgraph (S-049-01, E-049)
**Decision in one line:** add a parametric stub-node *router* example to `graph-example.ts` driven
through `runGraphConcurrent` (the dispatcher `castGraph` delegates to), and prove in
`graph-example.test.ts` that the authored edge predicate selects the taken branch and the not-taken
branch + its dependent subgraph land in `skipped` — honoring the no-`graph.ts`-import discipline.

## The one real design question: how literally do we "cast via castGraph"?

The ticket says "cast via castGraph" and "prove the predicate threads through the impure castGraph
shell." The AC simultaneously requires "no test value-imports graph.ts." These pull in opposite
directions, so the design must resolve them deliberately.

### Option A — drive `runGraphConcurrent` with stub `DagNode`s (CHOSEN)

Build a predicated stub spec and run it through `runGraphConcurrent`, the pure dispatcher `castGraph`
delegates to. Assert the taken branch cast, the not-taken branch + its subgraph skipped.

- **For:** `castGraph` is *predicate-transparent* — it passes `edges` (incl. every `when`) straight to
  `runGraphConcurrent` (graph.ts:114,120) and neither reads nor rewrites `when`. The predicate threading
  an author declares is delivered ENTIRELY by `runGraphConcurrent`. So this proves the exact end-to-end
  path with nothing simulated.
- **For:** it is the EXISTING house precedent. The E-048 shared-wallet feature *also* lives in
  `castGraph`, and it is proven by `runSharedWalletFanout` driving `runGraphConcurrent` with costed
  stubs — never by importing `castGraph`. T-049-03 is the same shape for the predicate feature.
- **For:** honors the AC's import discipline with zero tension — imports only graph-core.ts.
- **Against:** it does not literally invoke the `castGraph` function symbol. Mitigated below.

### Option B — call `castGraph` with fake `PlayNode`s + a stub `Executor`

`CastOptions.executor` (cast.ts:82) is a real injection seam; one could hand `castGraph` fake plays
whose casts route through a stub executor.

- **Against (decisive):** the discipline is about the IMPORT, not just runtime spawning. Value-importing
  `graph.ts` pulls in `castPlay` → the executor seam (a native addon) at module-load time. The AC
  forbids exactly this. Even with a stub executor, `castPlay` still touches fs (transcripts, run log)
  and the import itself breaks the "no `bun test` imports graph.ts" rule stated in graph.ts:34.
- **Against:** it would test `castPlay`'s render/parse/gate/effect/log pipeline, which is NOT this
  feature — the predicate never enters `castPlay`; it lives in the dispatcher. Pure noise for the proof.
- **Against:** no existing example does this; it would be a novel, heavier discipline break for a worked
  example whose whole point is to be importable and spawn nothing.

### Option C — a new test that imports `graph.ts` behind a spawn guard

Rejected outright: directly violates the AC ("no test value-imports graph.ts"). Not considered further.

**Decision: Option A.** It proves the real end-to-end author path (predicate-transparent `castGraph` ⇒
`runGraphConcurrent`), matches the established shared-wallet precedent exactly, and satisfies the import
discipline the AC names. The "through castGraph" intent is honored by (a) driving the precise dispatcher
`castGraph` delegates to, and (b) a module doc comment that makes the delegation explicit — the same way
graph-example.ts:122 documents the shared-wallet example as the `castGraph` E-048 proof.

## The fixture shape: a parametric ROUTER (declare the branch once, route by data)

A playbook author's mental model is "one classifier fans out; a predicate on each edge picks the
branch." The fixture encodes exactly that and is PARAMETRIC on the routing signal, so the SAME declared
graph routes either way purely by data — the essence of a conditional edge.

```
                ┌─ when produced=="go"   ─→ T ─→ TD        (taken branch + its downstream)
  R(produces s) ┤
                └─ when produced=="stop" ─→ N ─→ ND        (not-taken branch + its dependent subgraph)
```

- `R` is the router/source; it produces the signal `s` (`"go"` or `"stop"`), chosen by the fixture arg.
- Edge `R→T` carries `when: p => p === "go"`; edge `R→N` carries `when: p => p === "stop"`. Mutually
  exclusive over R's single produced string — the author declared the branch ONCE, on the edges.
- `T→TD` and `N→ND` are plain (un-predicated) edges: each branch has a DOWNSTREAM node so we prove the
  not-taken side's *dependent subgraph* skips (the cascade), not just the immediate handler.

### Why parametric (`branchingExample(route)`)

Running it with `route="go"` vs `route="stop"` proves the predicate is a pure read over R's `produced`
and the identical graph routes differently by data alone. With `route="go"`:

- **Taken:** `R→T` fires; `T` casts (its recorded upstream is `{R:"go"}`), `TD` casts (upstream
  `{T:"pt"}`). Sink `TD` is in `produced`.
- **Not-taken:** `R→N` does not fire; `N` is in `skipped` with the `branch not taken` reason.
- **Cascade:** `ND`'s in-edge `N→ND` sees `N` never proceeded ⇒ `ND` is in `skipped` with the
  `dependent on halted upstream 'N'` reason. The whole not-taken subgraph is an observable skip.
- `route="stop"` is the mirror image (N/ND run; T/TD skip), proving symmetry.

### Why `recordingStub` (reuse, not a new primitive)

`recordingStub(id, produced)` (graph-example.ts:30) already records the `NodeUpstreams` each node was
cast with. That is precisely the evidence we need: a node that ran has a recorded call; a skipped node's
`calls` array is empty. No new stub kind is needed — `recordingStub` covers the whole fixture. R, T, TD,
N, ND are all recording stubs; the only new thing is predicated edges, which are pure data.

## What the tests assert (grounded in the established contract)

For `route="go"` (and a mirror case for `route="stop"`):
1. `nodes` cast set is exactly `{R, T, TD}` (the taken path); `N`, `ND` absent from `nodes`.
2. The taken branch saw the routed data: `T`'s recorded upstream is `{R:"go"}`, `TD`'s is `{T:"pt"}`.
3. `skipped` contains `N` and `ND`. `N`'s reason matches `/branch not taken/` and NOT
   `/dependent on halted upstream/`. `ND`'s reason matches `/dependent on halted upstream/` (the
   cascade through the reused halt machinery).
4. `result.outcome === "success"` and `result.halted === true` — a clean branch decision is a successful
   route, not a failure (no cast failed); the not-taken subgraph is honestly accounted as skipped.
5. `produced` (sinks) is exactly `{TD:"ptd"}` — the taken branch's leaf is the graph's net output.
6. Back-compat / determinism: an additional assertion that the same fixture is byte-identical run to run
   is unnecessary beyond what topoSort already guarantees; instead the mirror `route="stop"` case
   doubles as the "declare once, route by data" proof.

## Rejected fixture variations

- **A join sink fed by both branches** (`T→J ← N`): rejected — a join skips if EITHER upstream skips, so
  it would conflate "branch not taken" with "join blocked" and muddy the andon being demonstrated. The
  two independent downstreams (`TD`, `ND`) keep the taken and not-taken stories cleanly separated.
- **Single-node branches** (no `TD`/`ND`): rejected — would not demonstrate the *dependent subgraph*
  cascade, only the immediate not-taken handler. The cascade is the load-bearing "observable skip of the
  whole subgraph" the ticket names.
- **Reusing the diamond with predicates bolted on:** rejected — the diamond's semantics are about
  JOIN convergence (a different proof); overloading it would blur both. A dedicated router fixture reads
  as the author-facing branch story.
