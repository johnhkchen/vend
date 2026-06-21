# T-046-03 — Plan: implementation sequence

Four ordered steps, each independently verifiable. The two pure files (example + test) gate green on
their own; `graph.ts` is verified by `check:typecheck` (it is value-import-blocked from `bun test`).

## Step 1 — `src/engine/graph.ts`: the `castGraph` impure shell

**Do:**
- Header comment mirroring `chain.ts`: the impure shell over the pure core; the `adapt → castPlay`
  injection generalized to `NodeUpstreams`; the **no-`bun test`-value-import** rule; the asymmetry
  (it owns a concurrent wave dispatcher because `runGraph` is the sequential reference).
- `export * from "./graph-core.ts"` (one graph-surface import — the `chain.ts`/`cast.ts` pattern).
- `NodeOptions = CastOptions | ((upstreams: NodeUpstreams) => CastOptions)` (the `StepOptions` analog).
- `PlayNode<I, O>` = `{ id, play, budget, opts, adapt }` (the `PlayStep` analog, multi-upstream adapter).
- `castGraph(nodes, edges)`:
  - Build `DagNode[]`: each `cast = async (upstreams) => castPlay(n.play, await n.adapt(upstreams),
    n.budget, typeof n.opts === "function" ? n.opts(upstreams) : n.opts)`.
  - Run the **concurrent wave dispatcher** (private `runGraphConcurrent`): `topoSort` → cycle refusal
    (mirror `runGraph` exactly) → `inEdges`/`outDegree` over declared endpoints → wave loop with
    `Promise.all` over runnable ready nodes, `decideThread` for the halt gate → deterministic
    assembly (`outcome`/`produced`/`skipped` in topo order) → `GraphResult`.
- Guard every `Map.get` (`noUncheckedIndexedAccess`); filter `undefined` rather than `!`.

**Verify:** `bun run check:typecheck` clean. (No unit test — `chain.ts` discipline.) Confirm by grep
that no `*.test.ts` imports `graph.ts`.

## Step 2 — `src/engine/graph-example.ts`: the deterministic worked example

**Do:**
- Header: the deterministic substrate proof; STUB nodes (canned `RunSummary`s, NOT a live cast);
  drives the **pure** `runGraph` so it is importable + reproducible.
- `summary(outcome, produced?)` helper (the `graph-core.test.ts` shape).
- `recordingStub(id, produced)` → a `DagNode` whose `cast` records the `NodeUpstreams` it saw and
  returns `summary("success", produced)`, plus a captured `calls` ref.
- `diamondExample()` → builds the diamond `DagSpec` (nodes A,B,C,D; edges A→B, A→C, B→D, C→D) and
  returns `{ spec, seen }` where `seen[id]` is that node's recorded upstreams object.
- `runDiamondExample()` → `await runGraph(spec)`; return `{ upstreamsSeenByD, result }`.

**Verify:** importable, pure (type-only + `runGraph` + `dag-core`); covered by Step 3's test.

## Step 3 — `src/engine/graph-example.test.ts`: the proofs (AC#2 + AC#3)

**Do — AC#2 (worked example runs end-to-end):**
- `runDiamondExample()` → `result.nodes.size === 4` (all four ran); `seen.B === { A: "pa" }` and
  `seen.C === { A: "pa" }` (B, C are parallel branches off A's `produced`); **`seen.D === { B: "pb",
  C: "pc" }`** (the join receives BOTH upstreams); `Object.fromEntries(result.produced) === { D: "pd" }`;
  `result.halted === false`, `result.outcome === "success"`.

**Do — AC#3 (fails-vs-linear, the genuinely-non-linear proof):**
- Build the diamond's D as a recording node; run via `runGraph` → D's upstreams = `{ B: "pb", C: "pc" }`
  (2-entry join).
- Build a `ChainStep[]` linearization `[A, B, C, D]` (the only faithful topo orders are A,B,C,D / A,C,B,D)
  where each step's `cast(upstream)` records the single `upstream: string | undefined` it received;
  run via `runChain`. Assert D's step received **exactly one** ref (C's `produced`, the immediately
  prior step) — a single string, never both. `runChain` threads ONE `produced`; no linearization can
  feed D both.
- Assert the contrast directly: `runGraph` D-join size 2 vs `runChain` D-thread is a lone string.

**Verify:** `bun test src/engine/graph-example.test.ts` green; whole-file `bun test` green.

## Step 4 — Full gate + commit

**Do:**
- `bun run check` (baml:gen → typecheck → test) green — full suite, no regressions.
- `progress.md` updated per step; `review.md` on completion.
- Commit incrementally (per the workflow): one commit for the shell+example+test once green.

**Verification criteria (the ticket's ACs):**
- [ ] `castGraph` injects `adapt → castPlay` per node + runs ready nodes concurrently (Promise.all
      per wave); reuses `topoSort`/`decideThread`; not value-imported by any `bun test`.
- [ ] Deterministic worked example (≥1 fan-out + ≥1 join, stub nodes) runs end-to-end; join gets both.
- [ ] A test that fails against the linear engine — the 2-upstream join `runGraph` converges and
      `runChain`/`ChainStep[]` cannot express.
- [ ] No live model; `bun run check:*` green.

## Risks & mitigations

- **R1 — wave-loop ↔ `runGraph` divergence.** The shell's concurrent loop must match the sequential
  core's semantics. *Mitigation:* reuse `topoSort` + `decideThread` verbatim; mirror `runGraph`'s
  cycle/adjacency/skip code; assemble `outcome`/`produced`/`skipped` in **topo order** so the result
  is deterministic despite concurrent settle order. The semantics are covered by `graph-core.test.ts`.
- **R2 — accidental test value-import of `graph.ts`** (would pull the executor seam into `bun test`).
  *Mitigation:* example + test import `runGraph`/`runChain` only; grep-verify no `*.test.ts` touches
  `graph.ts`.
- **R3 — `noUncheckedIndexedAccess` on Map gets in the wave loop.** *Mitigation:* guard/filter
  `undefined`, never `!`, matching the house pattern in `graph-core.ts`.
