# T-046-02 — Progress

## Status: implementation complete, all gates green

| Step | State | Notes |
|------|-------|-------|
| 1 — Narrow `NodeCast` + add `NodeUpstreams` (`dag-core.ts`) | ✅ done | The edit T-046-01 explicitly deferred. 0-param fakes stay assignable → T-046-01's 18 tests untouched. Only consumer was `dag-core.ts` (grep-confirmed). |
| 2 — `runGraph` + `GraphResult` + `SkippedNode` (`graph-core.ts`, new) | ✅ done | Pure executor; reuses `decideThread` from `chain-core.ts`. `tsc --noEmit` clean. |
| 3 — `graph-core.test.ts` (new, fakes-only) | ✅ done | 12 tests; fan-out, join, diamond, halt-subgraph, sibling-independence, success-no-produced, empty, single, cyclic-refusal, determinism. |
| 4 — Full gate + docs | ✅ done | `bun run check` green (baml:gen + typecheck + 1117 tests). |

## What was built

- **`src/engine/dag-core.ts`** — added `NodeUpstreams = ReadonlyMap<NodeId, string>` and narrowed
  `NodeCast` from the wide `(...args)` placeholder to `(upstreams: NodeUpstreams) => Promise<RunSummary>`.
- **`src/engine/graph-core.ts`** (new, ~165 lines) — `runGraph(spec)`: topo walk that joins all
  upstreams' `produced` into each node's cast, fans a node's `produced` to every downstream, and
  skips exactly the transitive dependents of any node that does not proceed. `GraphResult`
  (per-node summaries, skipped list, terminal outcome, halted + reason, sink `produced`s) +
  `SkippedNode`.
- **`src/engine/graph-core.test.ts`** (new, 12 tests) — fakes-only, imports only `graph-core.ts` +
  `dag-core.ts` (both type-only-import the impure `cast.ts`), so no addon loads and nothing spawns.

## Deviations from plan

- **One test assertion corrected, not the code.** Plan step-3 case 6 (diamond, B failing) initially
  asserted C's `produced` surfaces. It does not — C is interior (C→D), only **sink** D is in the
  net output, and D was skipped → `produced` is correctly empty. The assertion was fixed to
  `produced.size === 0`; this is the honest sink semantic (the graph's net output is its leaves).
  No production change.
- Committing was deferred (no commit instruction in this session); changes are staged in the working
  tree. The four planned commit points are documented in `plan.md` for whoever lands them.

## Verification run

```
bun run check
  → baml:gen ok · tsc --noEmit clean · bun test: 1117 pass / 0 fail (2982 expect)
bun test src/engine/graph-core.test.ts → 12 pass / 0 fail
bun test src/engine/dag-core.test.ts   → 18 pass / 0 fail (unchanged by the NodeCast narrowing)
```
