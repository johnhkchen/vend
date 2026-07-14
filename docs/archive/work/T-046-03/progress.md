# T-046-03 — Progress

## Status: implementation complete, full gate green

All four planned steps done; `bun run check` green (typecheck + 1121 tests, 0 fail — up from 1117,
the 4 new tests added). No deviations from the plan.

## Step 1 — `src/engine/graph.ts` (the `castGraph` impure shell) — DONE

- `export * from "./graph-core.ts"` (one graph-surface import — the `cast.ts`/`chain.ts` pattern).
- `NodeOptions` (the `StepOptions` analog) + `PlayNode<I, O>` (the `PlayStep` analog, multi-upstream).
- `castGraph(nodes, edges)`: builds the `DagSpec` injecting `adapt → castPlay` per node, then drives
  the private `runGraphConcurrent` wave dispatcher.
- `runGraphConcurrent`: `topoSort` (ordering + cycle refusal mirroring `runGraph`) → declared-endpoint
  adjacency → **wave loop with `Promise.all`** over runnable ready nodes → `decideThread` halt gate →
  deterministic assembly (`outcome`/`produced`/`skipped` in topo order). Reuses `topoSort` +
  `decideThread`; returns the same `GraphResult` shape as `runGraph`.
- `noUncheckedIndexedAccess` honored: every `Map.get`/index guarded or filtered, no `!`.
- **Verified:** `bun run check:typecheck` clean; grep confirms **no `*.test.ts` value-imports
  `graph.ts`** (the chain.ts discipline).

## Step 2 — `src/engine/graph-example.ts` (deterministic worked example) — DONE

- Diamond `A → {B, C} → D` of STUB nodes (canned `RunSummary`s), each recording the `NodeUpstreams`
  it saw. Drives the **pure** `runGraph` (imported from `./graph-core.ts`, never `./graph.ts`).
- Exports `diamondExample()`, `runDiamondExample()`, `DiamondTrace`. Pure + importable; no addon, no spawn.

## Step 3 — `src/engine/graph-example.test.ts` (AC#2 + AC#3) — DONE

- **AC#2:** `runDiamondExample()` → all 4 nodes ran; B and C each saw `{ A: "pa" }` (parallel branches
  off A); **D saw `{ B: "pb", C: "pc" }`** (the join); sink output `{ D: "pd" }`; not halted.
- **AC#3:** `runGraph` converges D's 2-upstream join; `runChain` over the `[A,B,C,D]` linearization
  threads a SINGLE `produced` (D's step gets only `"pc"`, never both) — the join is inexpressible by
  `ChainStep[]`. A side-by-side test asserts `graphJoinSize (2) > maxRefsIntoAnyChainStep (1)`.
- **Verified:** 4 pass / 0 fail.

## Step 4 — full gate — DONE

- `bun run check` → baml:gen + `tsc --noEmit` + `bun test` → **1121 pass, 0 fail**.
- Commit pending (deferred to the workflow's commit step per the ticket).

## Deviations

None. The one judgment call (documented in structure.md): `castGraph` owns a concurrent wave
dispatcher rather than delegating to the sequential `runGraph` — required because `runGraph` awaits
nodes one-at-a-time (T-046-02's contract), so delegating would not give B ∥ C. The dispatcher reuses
the pure decision primitives (`topoSort`, `decideThread`) and assembles deterministically.
