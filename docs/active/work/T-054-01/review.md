# T-054-01 Review — pure-errored-outcome-unit

_Handoff document. What changed, coverage, open concerns. Read this, not every diff._

## What this ticket delivered

The pure-core prerequisite of E-054 (node-throw semantics): a deterministic `errored`
`RunOutcome` and a pure `erroredSummary(id)` helper that maps a thrown cast into a
marked, non-proceeding node summary. This is the **single routing primitive** both graph
runners will reuse in T-054-02 — no runner wiring is done here by design.

Commit: `86f2739` — `feat(T-054-01): add 'errored' RunOutcome + pure erroredSummary helper`.

## Files changed (3 source + 5 work artifacts)

| File | Change |
|---|---|
| `src/log/run-log.ts` | Appended `"errored"` to `RUN_OUTCOMES` (last member); one doc clause mapping `errored ← a thrown cast (E-054)`. |
| `src/engine/graph-core.ts` | Added exported `NODE_ERRORED` const + pure `erroredSummary(id: NodeId): RunSummary` helper (above `SkippedNode`). No new imports. |
| `src/engine/graph-core.test.ts` | Extended imports; added a 4-test `describe` block proving the AC. |
| `docs/active/work/T-054-01/*.md` | research / design / structure / plan / progress / review. |

### The helper (the whole behavioral change)

```ts
export const NODE_ERRORED: RunOutcome = "errored";

export function erroredSummary(id: NodeId): RunSummary {
  return { runId: `errored:${id}`, outcome: NODE_ERRORED, materialized: false };
}
```

`produced` and `actuals` are omitted (⇒ `undefined`): a throw landed nothing, threaded
nothing, measured nothing. `runId` is a pure function of `id` (no clock/random) so the
same throwing spec yields a byte-identical summary under both runners.

## Why a throw needs no new halt logic

`decideThread` (`chain-core.ts:50`) refuses any `outcome !== "success"` as its FIRST
branch. So an `errored` summary is refused (`proceed: false`, reason `halted: step
outcome 'errored' is not success`) with **zero changes** to the gate — and the existing
halt-dependent-subgraph cascade in both runners skips its dependents for free. This is
the load-bearing reuse the epic asked for ("reuse the existing machinery, don't
reimplement").

## Test coverage

New block `erroredSummary — the pure throw→errored primitive (T-054-01)` — 4 tests, pure
functions only, **no runner invoked, no live model, no spawn**:

1. `outcome === "errored"`, `produced === undefined`, `materialized === false`,
   `actuals === undefined`, `runId === "errored:X"` — the AC's "yields outcome 'errored'
   with produced undefined".
2. `decideThread(erroredSummary("X"))` → `{ proceed: false }`, reason contains `errored`
   and `not success` — the AC's "decideThread refuses it … routes through the halt path
   unchanged".
3. Determinism — `erroredSummary("X") toEqual erroredSummary("X")`; distinct ids ⇒
   distinct `runId` (guards T-054-03's later cross-runner byte-equality).
4. Constant↔tuple coherence — `RUN_OUTCOMES.includes(NODE_ERRORED)`.

**Results:** graph-core suite 25 pass / 0 fail (was 21). Full gate `bun run check`
(baml:gen + `tsc --noEmit` + `bun test`) → **1210 pass / 0 fail**, typecheck clean.

### Coverage gaps (intentional, owned by sibling tickets)

- **Runner behavior under a real throw** — a thrown thunk catching into the errored
  summary, dependents skipping, an independent sibling completing, the promise resolving
  (not rejecting). Owned by **T-054-02**.
- **Dual-runner equivalence** for a throwing spec. Owned by **T-054-03**.

These are not gaps in *this* ticket — the AC scopes it to the pure primitive. They are
named so the reviewer sees the boundary is deliberate.

## Open concerns / notes for human attention

1. **The thrown error's message is NOT carried in the summary.** `erroredSummary` takes
   only the node id. Rationale (Design Decision 2): a throw is made to "behave like every
   other non-success", and a `gate-failed`/`timed-out` summary likewise carries only its
   *outcome*, not full detail — the andon comes from `decideThread`'s reason. The error's
   content is the runner's to log at its `catch (e)` site (T-054-02). If richer
   observability is wanted later (e.g. an `error?: string` on `RunSummary`, or a `detail`
   on `SkippedNode`), that is a deliberate, separately-justified change — **flagged, not
   done here** to avoid mutating a shared core type for a narrow ticket.
2. **Ledger forward-compatibility.** `errored` is now a valid `RunOutcome`, but no runner
   *emits* it yet (T-054-02). The append-only ledger therefore gains no `errored` records
   until then; `reviveRecord` already accepts the value, so no migration is needed when
   they start appearing.
3. **`erroredSummary` lives in `graph-core.ts`, not a shared engine util.** It is
   graph-runner-specific (the linear `runChain` has no throwing-thunk story in scope). If
   a future linear-runner throw story emerges, consider hoisting — not needed now.

## Risk assessment: LOW

Pure value + pure helper; no runner, gate, ledger-consumer, or `RunSummary`-shape change.
Both Research-anticipated risks (a hidden exhaustive switch; a pinned OutcomeMix snapshot)
did not materialize — confirmed by a clean typecheck and full-suite green. Rollback is a
single `git revert` with no migration.
