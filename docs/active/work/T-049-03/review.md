# T-049-03 — Review

**Ticket:** branching-worked-example-through-castgraph (S-049-01, E-049 conditional-dag-edges)
**Outcome:** complete. A deterministic stub-node branching worked example now proves the E-049 authored
edge predicate end-to-end on the path `castGraph` delegates to: an author declares the branch ONCE on
the edge, the taken branch (and its downstream) runs, and the not-taken branch AND its dependent
subgraph land in `skipped` with the established distinct andons. Build + full suite green. No commit
(Lisa drives phase transitions).

## What changed

| File | Change |
|---|---|
| `src/engine/graph-example.ts` | +section banner; +`branchingExample(route)` (parametric router fixture, 5 recording stubs, 2 predicated + 2 plain edges); +`BranchingTrace`; +`runBranchingExample(route)` driving `runGraphConcurrent`. No import changes. |
| `src/engine/graph-example.test.ts` | +imports (`runBranchingExample`, `branchingExample`); +3-test `describe` block (go-route, stop-route mirror, one-declared-graph). |
| `docs/active/work/T-049-03/*` | RDSPI artifacts. |

**No production-source change.** `dag-core.ts`/`graph-core.ts`/`graph.ts` are untouched — the E-049
mechanism shipped in T-049-01 (model + sequential `runGraph`) and T-049-02 (concurrent
`runGraphConcurrent`). This ticket is purely the additive author-facing proof the epic's "Done looks
like" requires.

The working tree also carries T-049-01/02 ticket + source/doc changes from the prior tickets — not
touched by this work.

## How it works / the key design call

`castGraph` (graph.ts) is **predicate-transparent**: it hands the caller's `edges` — every `when`
included — straight to `runGraphConcurrent` (graph.ts:114,120) and neither reads nor rewrites the
predicate. So the predicate threading an author declares end-to-end is delivered ENTIRELY by
`runGraphConcurrent`. The worked example therefore drives `runGraphConcurrent` directly with recording
stubs, which:
- proves the **exact** end-to-end author path (nothing about the predicate is simulated — it is the same
  dispatcher `castGraph` calls), and
- honors the AC's hard import discipline: `graph.ts` value-imports `castPlay` → the executor seam, so no
  `bun test` may value-import it. This is the identical strategy by which the E-048 shared-wallet feature
  (which also lives in `castGraph`) is proven — `runSharedWalletFanout` drives the same pure dispatcher.

The fixture is a **parametric router**: `R` produces a routing signal (`"go"`/`"stop"`); `R→T` carries
`when: p => p === "go"` and `R→N` carries `when: p => p === "stop"` (mutually exclusive over R's one
produced string). `T→TD` and `N→ND` are plain edges, so each branch has a downstream node and the
not-taken side proves the *dependent subgraph* cascade, not just the immediate handler. The edge
topology is identical for both routes — only R's data differs — which is the "declare the branch once,
route by data" claim made literal.

## Acceptance criteria — verification

Single AC, clause by clause (all in `graph-example.test.ts` → "AC (E-049): an authored edge predicate
routes the branch; the not-taken subgraph skips"):

- ✅ *graph-example.ts gains a branching example cast via castGraph with deterministic stub nodes* —
  `branchingExample`/`runBranchingExample` added; driven through `runGraphConcurrent`, the dispatcher
  `castGraph` delegates to (the predicate-transparency argument above). Recording stubs only — no live
  model, no spawn, no addon.
- ✅ *the authored edge predicate selects the taken branch* — go-route: cast set `{R,T,TD}`; `T` cast
  with the routed upstream `{R:"go"}`, `TD` with `{T:"pt"}`; `produced === {TD:"ptd"}`. stop-route is
  the mirror (`{N,ND,R}`, `produced === {ND:"pnd"}`).
- ✅ *the other subgraph lands in skipped end-to-end* — go-route: `skipped` ids `["N","ND"]`; `N` reason
  `/branch not taken/` and NOT `/dependent on halted upstream/`, `blockedBy === ["R"]`; `ND` reason
  `/dependent on halted upstream/` (the cascade through the reused halt machinery). Clean route:
  `outcome === "success"`, `halted === true`.
- ✅ *no test value-imports graph.ts (the castGraph discipline holds)* — confirmed by grep: both files
  import only graph-core.ts + type-only cast.ts; no `from "./graph.ts"`.
- ✅ *`bun run build` + full check gate green* — `tsc --noEmit` clean; **`bun test` 1162 pass / 0 fail**
  across 77 files (1159 baseline + 3 new).

## Test coverage & gaps

- **Covered:** taken-branch selection with the routed data threaded in; the not-taken handler as a
  branch-not-taken andon; the not-taken *dependent subgraph* as a cascade skip via the reused halt
  machinery; the clean `success`+`halted` outcome; the taken sink as the sole net output; both routing
  directions (proving the predicate is a pure data-driven read, not a hard-coded path); and the
  edge-topology identity across routes (declare once / route by data).
- **Oracle-style contract:** the andon assertions key on the EXISTING reason strings from T-049-01/02
  (`branch not taken`, `dependent on halted upstream`), so this example is a third consumer pinning those
  strings — it fails loudly if either drifts.
- **Pure-function discipline:** imports only graph-core.ts (+ type-only cast.ts); no graph.ts, no live
  model, no spawn, no native addon.
- **Deliberately NOT covered (out of scope, by design):**
  - A literal `castGraph(...)` invocation with fake plays + a stub executor. Rejected in Design (Option
    B): value-importing graph.ts breaks the AC's import discipline and would exercise `castPlay`'s
    render/parse/gate/effect/log pipeline, which the predicate never enters. The live concurrent
    `castGraph` shell remains proven downstream (E-046/E-047), as graph.ts:32-34 documents.
  - A predicated edge composed with a shared WALLET — already covered cross-executor in
    graph-core.test.ts (T-049-02, case 3). Re-proving it here would be redundant; this example
    deliberately runs the no-wallet path to isolate the predicate story.

## Open concerns / notes for the reviewer

1. **"Cast via castGraph" is proven via the dispatcher it delegates to, not the function symbol.** This
   is the one judgment call. It is forced by the AC's own "no test value-imports graph.ts" clause and is
   the established house precedent (the E-048 wallet proof does exactly this). The rationale is written
   into the module banner in graph-example.ts so a future reader does not "fix" it by importing graph.ts.
2. **Reason strings are the cross-ticket contract.** This example now joins graph-core.test.ts in pinning
   `branch not taken` / `dependent on halted upstream`. Keep them stable; a change must update all
   consumers together.
3. **`recordingStub` under concurrency.** Each stub pushes to its own `calls` array and every node casts
   at most once in this fixture, so `runGraphConcurrent`'s `Promise.all` introduces no ordering hazard —
   the same reliance the diamond and shared-wallet examples already make.
4. **No commit** — the change sits in the working tree as one coherent, independently-green unit (the
   worked example + its proof); Lisa handles the phase transition and the sweep/commit per house
   convention. With this ticket, S-049-01 / E-049 (conditional DAG edges) is end-to-end: model
   (T-049-01), both executors (T-049-01/02), and the author-facing worked example (T-049-03).
