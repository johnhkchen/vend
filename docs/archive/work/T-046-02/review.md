# T-046-02 — Review: `runGraph`, the pure DAG executor core

## What changed

| File | Action | Lines | Summary |
|------|--------|-------|---------|
| `src/engine/dag-core.ts` | modified | +9 / −7 | Added `NodeUpstreams`; narrowed `NodeCast` to `(upstreams: NodeUpstreams) => Promise<RunSummary>` — the shape T-046-01 deferred to this ticket. |
| `src/engine/graph-core.ts` | **new** | ~165 | `runGraph` + `GraphResult` + `SkippedNode` — `runChain` generalized to a DAG. |
| `src/engine/graph-core.test.ts` | **new** | ~190 | 12 fakes-only tests proving join / fan-out / diamond / halt-subgraph / totality. |
| `docs/active/work/T-046-02/*` | new | — | research-via-ticket → structure, plan, progress, review. |

No deletions. `chain-core.ts` untouched — `runGraph` **reuses** its `decideThread`.

## How the three generalizations landed

1. **JOIN (the load-bearing change).** Each node's cast now receives a `NodeUpstreams` map keyed by
   from-node — built from its in-edges. Source ⇒ empty, linear ⇒ 1-entry, join ⇒ multi-entry. This
   is exactly what the linear engine structurally could not do (two upstreams into one node);
   `decideThread`'s single-`upstream` thread is the degenerate 1-edge case.
2. **FAN-OUT.** A proceeded node's `produced` is stored once in `producedAll` and read by *every*
   downstream's in-edge — automatic fan-out, no special case.
3. **HALT THE DEPENDENT SUBGRAPH.** A node runs iff *every* in-edge upstream is in `proceeded`.
   Because topo order decides upstreams first, a non-proceeding node's skip cascades through its
   whole transitive closure — while independent siblings (different upstreams) run unaffected. The
   per-edge gate is the reused `decideThread`, so the linear and graph halt semantics are identical.

## Acceptance criteria

- **AC#1 — topo walk, join threads multiple upstreams, fan-out reaches all downstreams.** ✅
  Tests: linear, fan-out, join (multi-entry map), diamond assert the *exact* `NodeUpstreams` each
  node was cast with.
- **AC#2 — per-edge halt skips only the dependent subgraph; siblings run; `GraphResult` shape.** ✅
  Tests: A-fails-cascades-B,C; fan-out-B-fails-C-runs; diamond-B-fails-D-skipped-C-runs;
  success-no-produced halt. `GraphResult` carries per-node `nodes`, `skipped` (+ `blockedBy` +
  reason), `outcome`, `halted`, `haltReason`, and sink `produced`s.
- **AC#3 — PURE given injected casts; fakes; no live model.** ✅ `graph-core.ts` imports two types
  (`RunOutcome`, `RunSummary`), one pure value (`decideThread`), and `dag-core.ts`. The test imports
  only `graph-core.ts` + `dag-core.ts` — it would fail to load (native addon) or hang if anything
  spawned; the cyclic-refusal test casts `neverNode`s and passes, proving nothing runs on a cycle.
- **AC#4 — `bun run check:*` green.** ✅ `bun run check`: baml:gen ok, `tsc --noEmit` clean,
  `bun test` 1117 pass / 0 fail.

## Test coverage

12 tests, every `runGraph` branch exercised: empty graph, single source, linear, fan-out, join,
diamond, three halt shapes (full-cascade, sibling-independent, diamond-partial), success-no-produced
halt, cyclic refusal, and a determinism check (declaration-order sink ordering). Plus the 18
unchanged `dag-core.test.ts` tests (the `NodeCast` narrowing is source-compatible with 0-param fakes).

**Gaps (by design, not omissions):**
- The impure path (`castGraph`, real `castPlay` injection, real concurrency of ready nodes) is
  **T-046-03** — out of scope here, exactly as `castChain` is untested in `chain-core.test.ts`.
- No multi-failure terminal-outcome ordering test beyond "first non-success in topo order"; the
  rule is simple and documented, but a reviewer wanting belt-and-suspenders could add a graph with
  two distinct failures to pin the "first" choice.

## Open concerns / notes for the reviewer

1. **Terminal `outcome` on a success-but-no-`produced` halt is `"success"` while `halted` is
   `true`.** This is deliberate parity with `runChain` (a chain that halts on no-`produced` also
   reports `outcome: "success"`, `halted: true`). The `halted` flag, not `outcome`, is the
   downstream-skipped signal. Flagged because a caller mapping *only* `outcome` → exit code would
   miss the halt — callers must check `halted` (same contract as the chain).
2. **Cyclic spec → `outcome: "gate-failed"`.** `RunOutcome` has no structural-refusal member, so the
   total fallback reuses `gate-failed` (a cycle fails the structural "gate"). `validateDag` is the
   real cycle authority and the T-046-03 shell should call it *before* `runGraph`; this branch only
   guarantees totality (no hang) if an unvalidated spec slips through. If a dedicated outcome is
   wanted, that is an `RUN_OUTCOMES` change beyond this ticket's scope.
3. **Dangling edges are ignored** (parity with `topoSort`'s "unknown endpoint → no dependency"),
   which could let a node with only a dangling out-edge be treated as a sink. Harmless on a
   validated graph (`validateDag` refuses dangling edges); documented in-code.
4. **Not committed.** No commit instruction was given this session; changes are staged in the
   working tree with four atomic commit points documented in `plan.md`.

## Risk assessment

Low. The change is additive (one new pure module + one source-compatible type narrowing), fully
covered by fakes, and leaves the linear chain and the T-046-01 substrate untouched. The full
1117-test suite is green.
