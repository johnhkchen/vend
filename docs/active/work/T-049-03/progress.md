# T-049-03 — Progress

**Ticket:** branching-worked-example-through-castgraph (S-049-01, E-049)
**State:** implementation complete, all gates green. No deviations from the plan.

## Steps executed

### Step 1 — router fixture + runner in `graph-example.ts` ✅
Appended after the shared-wallet section (graph-example.ts:164+):
- Section banner comment in the house style: states this is the E-049 conditional-edge worked example,
  that it drives the pure `runGraphConcurrent` (the dispatcher `castGraph` delegates to) with recording
  stubs, that `castGraph` is predicate-transparent (passes `edges`/`when` straight through), and that
  this proves the author path end-to-end without value-importing graph.ts. NO LIVE MODEL.
- `branchingExample(route: "go" | "stop")` — five `recordingStub`s (R produces `route`; T/"pt",
  TD/"ptd", N/"pn", ND/"pnd"); nodes `[R,T,TD,N,ND]`; edges `R→T when p==="go"`, `R→N when p==="stop"`,
  `T→TD`, `N→ND`. Returns `{ spec, seen }`.
- `BranchingTrace` interface — `upstreamsSeen` allows `undefined` (never-cast = skipped) + `result`.
- `runBranchingExample(route)` — runs `runGraphConcurrent(spec)` (no wallet), maps `seen[id][0]`
  (absent ⇒ `undefined`), returns the trace.

**Verify:** `bun run build` clean.

### Step 2 — proof in `graph-example.test.ts` ✅
- Extended the `./graph-example.ts` import with `runBranchingExample`, `branchingExample`.
- Added `describe("AC (E-049): an authored edge predicate routes the branch; the not-taken subgraph
  skips")` with three tests:
  1. **route "go"** — cast set `{R,T,TD}`; `T` saw `{R:"go"}`, `TD` saw `{T:"pt"}`; `N`/`ND` undefined
     + in `skipped`; `N` reason `/branch not taken/` & not `/dependent on halted upstream/`, `blockedBy
     === ["R"]`; `ND` reason `/dependent on halted upstream/` (cascade); `outcome==="success"`,
     `halted===true`; `produced==={TD:"ptd"}`.
  2. **route "stop"** — the mirror: cast set `{N,ND,R}`; `N` saw `{R:"stop"}`, `ND` saw `{N:"pn"}`;
     `T`/`TD` skipped with mirrored reasons; `produced==={ND:"pnd"}`.
  3. **one declared graph** — `branchingExample("go").spec.edges` and `("stop")` have identical
     `from`/`to` topology; pins "declare once on the edge, route by data."

**Verify:** `bun test src/engine/graph-example.test.ts` → 10 pass / 0 fail (7 prior + 3 new).

### Step 3 — full gate ✅
- `bun run build` — clean (`tsc --noEmit`).
- `bun test` — **1162 pass / 0 fail** across 77 files (1159 baseline from T-049-02 + 3 new).
- Import discipline confirmed by `grep`: neither graph-example.ts nor graph-example.test.ts value-imports
  `graph.ts`; both import only graph-core.ts + type-only cast.ts.

## Deviations
None. The plan was followed step for step.

## Notes
- No production source changed — `dag-core.ts`/`graph-core.ts`/`graph.ts` untouched; the E-049 mechanism
  was already built in T-049-01/02. This ticket is purely the additive worked example + its proof.
- No commit made — Lisa drives phase transitions and the sweep/commit per house convention.
