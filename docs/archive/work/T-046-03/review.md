# T-046-03 — Review: `castGraph` shell + worked example + fails-vs-linear proof

The handoff document. Summarizes the change, maps it to the ACs, evaluates coverage, and surfaces the
open concerns a human reviewer should weigh.

## What changed

| File | Action | Summary |
|------|--------|---------|
| `src/engine/graph.ts` | **created** | The impure shell `castGraph` — injects `adapt → castPlay` per node and runs independent ready nodes CONCURRENTLY via a private wave dispatcher (`runGraphConcurrent`). Re-exports the pure graph surface. Value-imports `castPlay`; **not value-imported by any `bun test`**. |
| `src/engine/graph-example.ts` | **created** | The deterministic worked example — a diamond `A→{B,C}→D` of stub nodes driving the pure `runGraph`. Importable, no spawn, no addon. |
| `src/engine/graph-example.test.ts` | **created** | 4 tests: the worked example (AC#2) + the fails-vs-linear proof (AC#3), fakes-only. |

No files modified or deleted. `dag-core.ts`, `chain-core.ts`, `graph-core.ts` are untouched —
`castGraph` *reuses* `topoSort`, `decideThread`, and the `GraphResult`/`SkippedNode` shapes.

## AC-by-AC

- **AC#1 — `castGraph` injects `adapt → castPlay` per node + runs ready nodes CONCURRENTLY; pure core
  owns ordering/threading/halt; not value-imported by any `bun test`.** ✅
  - `castGraph` maps each `PlayNode` → a `DagNode` whose `cast` closes over `adapt → castPlay`
    (`graph.ts`), the `castChain` injection generalized to the `NodeUpstreams` join map.
  - Independent ready nodes are dispatched together with `Promise.all` per topological wave
    (`runGraphConcurrent`). Ordering = `topoSort`; halt gate = `decideThread` — both REUSED from the
    pure cores, not reimplemented.
  - Grep-confirmed: **no `*.test.ts` value-imports `graph.ts`** — the `chain.ts` discipline.
- **AC#2 — deterministic executable example (≥1 fan-out + ≥1 join, stub nodes) runs to completion;
  join receives both upstreams.** ✅ `runDiamondExample()` runs the diamond; the test asserts all four
  nodes ran, B and C are parallel branches off A's `produced`, and **D received `{ B: "pb", C: "pc" }`**.
- **AC#3 — a test that fails against the old linear engine.** ✅ The 2-upstream join `runGraph`
  converges is shown inexpressible by `runChain`/`ChainStep[]`: over the `[A,B,C,D]` linearization,
  `runChain` threads a single `produced` (D's step receives only `"pc"`, never both); the side-by-side
  test asserts `graphJoinSize (2) > maxRefsIntoAnyChainStep (1)`. The "genuinely non-linear" proof.
- **AC#4 — no live model; `bun run check:*` green.** ✅ Stubs only; full gate **1121 pass / 0 fail**.

## Test coverage

- New: 4 tests / 18 assertions in `graph-example.test.ts`, all pure (no addon, no spawn).
- Inherited: the join/fan-out/halt SEMANTICS `castGraph` relies on are covered by `graph-core.test.ts`
  (14 tests on the sequential `runGraph`) and `dag-core.test.ts` (`topoSort`/`validateDag`), plus
  `chain-core.test.ts` (`decideThread`). `castGraph` reuses these proven pieces verbatim.

### Coverage gaps (flagged)

1. **`castGraph`'s concurrent wave loop is not directly unit-tested.** By design (AC#1 / the `chain.ts`
   discipline) it value-imports `castPlay`, so no `bun test` can import it without spawning — exactly
   the situation for `castChain` (also untested, proven live). Its correctness rests on (a) reusing
   `topoSort` + `decideThread`, (b) mirroring `runGraph`'s tested cycle/adjacency/skip code, and (c)
   the deterministic example proving the same diamond under the sequential reference. **The actual
   parallel dispatch + the wave loop's own logic are proven only when a real-play graph is cast
   live** (E-046 scope: OUT here — a downstream metered proof).
2. **Concurrency is asserted structurally, not by wall-clock overlap.** The example proves the SHAPE
   that admits parallelism (independent B, C reading A's output); it does not measure B ∥ C timing
   (the stub example drives the sequential `runGraph`). The `Promise.all` dispatch lives in the
   untested shell per gap #1.

## Open concerns for the reviewer

- **Logic overlap between `runGraphConcurrent` and `runGraph`.** The cycle refusal, declared-endpoint
  adjacency, skip-cascade andons, and result assembly are deliberately mirrored so the concurrent twin
  matches the tested sequential reference. This is duplication of ~50 lines. A future refactor could
  extract the shared join/halt mechanics into a pure helper both consume (would also make the wave
  logic testable). Not done here: it would churn the shipped, green `runGraph` and exceeds this
  ticket's scope. **If a reviewer prefers zero duplication, that refactor is the follow-up.**
- **Determinism under concurrency.** `runGraphConcurrent` assembles `outcome`/`produced`/`skipped` in
  TOPO order (not settle order), so the `GraphResult` is deterministic despite nondeterministic cast
  settle order. Worth a reviewer's eye: a future per-node-cost or first-error-wins semantics would
  need to preserve this.
- **Scope honored:** conditional edges, cross-branch budget accounting, a live real-play graph cast,
  and the open-model runner remain OUT (E-046). N4 respected — the graph orchestrates Vend's own
  clearing plays; lisa still executes.

## Verdict

The substrate is proven: a typed DAG with fan-out + join runs end-to-end deterministically, the join
is delivered where a linear chain structurally cannot, and the impure shell wires real casts with
per-wave concurrency over the pure cores. Gate green (1121/0). The one material follow-up is the
optional de-duplication refactor noted above; the one inherent limit is that the concurrent shell —
like `castChain` — is proven live rather than unit-tested.
