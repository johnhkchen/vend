# T-046-01 — Plan

Ordered, independently-verifiable steps. Testing strategy: this ticket is a PURE module, so
everything is unit-tested with `bun test` + `tsc --noEmit` (no live model, no integration test —
the live graph cast is T-046-03's deterministic stub example, downstream). Each step is committable.

## Testing strategy (whole ticket)

- **Unit only.** Pure functions over hand-built specs. Fakes: `node(id)` (a `DagNode` whose `cast`
  is never invoked), `edge(from,to)`. No `castPlay`, no spawn — the `chain-core.test.ts` discipline.
- **Verification bar:** `bun run check:typecheck` (tsc, exercises `noUncheckedIndexedAccess` /
  `verbatimModuleSyntax`) and `bun run check:test` (full suite) both green. The ticket's `bun run
  check:*` green.
- **Coverage target = the ticket's matrix:** linear · fan-out · join · diamond · disconnected ·
  cycle-rejected · dangling-edge · duplicate-node · empty. Plus determinism (sort twice, deep-equal)
  and totality (cycle returns, never hangs).

## Steps

### Step 1 — Model + skeleton (`dag-core.ts`)

Create `src/engine/dag-core.ts` with the header comment (purity discipline, scope: shape+ordering
only), the type-only `RunSummary` import, and the model: `NodeId`, `NodeCast`, `DagNode`, `DagEdge`,
`DagSpec`, `DagOffenseKind`, `DagOffense`, `DagValidation`, `TopoResult`. Stub `validateDag` and
`topoSort` signatures (return a placeholder that typechecks).
- **Verify:** `tsc --noEmit` green (types compile, imports erase).
- **Commit:** `feat(engine): typed DAG model (DagNode/DagEdge/DagSpec) — T-046-01`.

### Step 2 — `topoSort` (Kahn's, deterministic) + its tests

Implement `topoSort` per Structure §1: index nodes by declaration order, build indegree +
successors skipping edges with unknown endpoints, seed/process the ready queue in ascending index
order, return `{ order }` or `{ cycle: <unemitted ids> }`. Write the `topoSort` test group: linear,
fan-out, join, diamond, disconnected, single, empty, determinism, 2-cycle, 3-cycle, self-loop.
- **Verify:** `bun test src/engine/dag-core.test.ts` green; the determinism test (sort twice)
  passes; cycle tests return (no hang).
- **Commit:** `feat(engine): pure deterministic topoSort (Kahn's) + tests — T-046-01`.

### Step 3 — `validateDag` (total, all offenses) + its tests

Implement `validateDag` per Structure §2: duplicate-node scan, dangling-edge scan, then (only when
structurally sound) delegate cycle detection to `topoSort` and lift `{ cycle }` to a `cycle`
offense. Accumulate into a `DagOffense[]`; return `{ ok: true }` or `{ ok: false, offenses }`. Write
the `validateDag` test group: every clean shape → ok; dangling/duplicate/cycle each → the named
offense; a multi-fault graph → multiple offenses; empty → ok.
- **Verify:** `bun test src/engine/dag-core.test.ts` green; multi-fault accumulation asserted.
- **Commit:** `feat(engine): total validateDag (dangling/duplicate/cycle offenses) + tests — T-046-01`.

### Step 4 — Full-suite gate + AC sweep

Run the whole `bun run check:typecheck` and `bun run check:test`. Walk the ticket's Acceptance
Criteria line by line against the tests. Fix any gaps.
- **Verify:** full suite green; every AC box satisfied by a named test.
- **Commit:** none if clean (the work landed in Steps 1–3); otherwise a fixup commit.

## AC → test traceability (filled in Review)

| Acceptance criterion | Covered by |
|---|---|
| `DagNode/DagEdge/DagSpec` declared, pure module, type-only imports | Step 1; `tsc` + import audit |
| `validateDag` total; refuses dangling / duplicate / cycle as distinct named offenses | Step 3 tests |
| `topoSort` pure, total, deterministic — `order` for a DAG (stable tie-break) or `cycle` nodes | Step 2 tests (incl. determinism) |
| Unit-tested across linear/fan-out/join/diamond/disconnected/cycle/dangling/empty; no live model; `check:*` green | Steps 2–4 |

## Risks & mitigations

- **R1 — `noUncheckedIndexedAccess` friction:** every `nodes[i]`, `successors[i]`, `Map.get` is
  `T | undefined`. *Mitigation:* guard each access (the `chain-core.ts:96` pattern); prefer
  iterating values over indexing where possible.
- **R2 — non-deterministic order via Map iteration:** *Mitigation:* drive all ordering by numeric
  index into `spec.nodes`, never by Map/Set iteration (D4); the determinism test is the guard.
- **R3 — `validateDag` calling `topoSort` on a malformed graph:** *Mitigation:* structural checks
  first; `topoSort` itself made total (skips unknown-endpoint edges) so even a direct call is safe.
- **R4 — over-specifying `NodeCast` and forcing T-046-02 churn:** *Mitigation:* the opaque
  `(...args: readonly unknown[])` signature (D1) — narrowed later, not rewritten.

## Out of scope (guardrails)

No `runGraph` (T-046-02), no `castGraph`/concurrency/`adapt` (T-046-03), no real cast, no edits to
`chain-core.ts`/`chain.ts`, no live model.
