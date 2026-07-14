# T-054-01 Progress — pure-errored-outcome-unit

_Implementation log. What was done, verification, deviations._

## Status: COMPLETE — all plan steps executed, gate green.

## Steps executed

### Step 1 — add `"errored"` to `RUN_OUTCOMES` ✅
- `src/log/run-log.ts:48` — appended `"errored"` as the last member of the tuple.
- `src/log/run-log.ts:37-47` — added the doc clause: `errored ← a node's cast THREW
  (E-054 …)`.
- The `RunOutcome` union widens automatically; `assertOutcome` / `reviveRecord` accept
  the new value via their existing membership checks (no per-value branch).

### Step 2 — add `NODE_ERRORED` + `erroredSummary` helper ✅
- `src/engine/graph-core.ts` — added, just above `SkippedNode`:
  - `export const NODE_ERRORED: RunOutcome = "errored";`
  - `export function erroredSummary(id: NodeId): RunSummary` returning
    `{ runId: \`errored:${id}\`, outcome: NODE_ERRORED, materialized: false }` — `produced`
    and `actuals` omitted (⇒ `undefined`).
- No new imports needed (`RunOutcome`, `RunSummary`, `NodeId` were already type-imported).

### Step 3 — add the unit test ✅
- `src/engine/graph-core.test.ts` — extended imports (`RUN_OUTCOMES`; `erroredSummary`,
  `NODE_ERRORED`; `decideThread`) and added the
  `describe("erroredSummary — the pure throw→errored primitive (T-054-01)")` block with 4
  tests: outcome/produced shape; `decideThread` refusal; determinism; constant↔tuple
  coherence.

### Step 4 — gate + commit ✅
- `bun test src/engine/graph-core.test.ts` → **25 pass / 0 fail** (was 21; +4 new).
- `bun run check` (baml:gen + `tsc --noEmit` + `bun test`) → **1210 pass / 0 fail**,
  typecheck clean, baml generated clean.
- Committed (see below).

## Verification against AC

> RUN_OUTCOMES gains an 'errored' value; a graph-core unit test (no runner, no live
> model) asserts the pure error helper yields outcome 'errored' with produced undefined,
> and that the existing decideThread refuses it (proceed:false) so it routes through the
> halt path unchanged.

- ✅ `RUN_OUTCOMES` gains `"errored"`.
- ✅ Pure graph-core unit test, no runner invoked, no live model, no spawn.
- ✅ Test asserts `erroredSummary(...).outcome === "errored"` and `.produced === undefined`.
- ✅ Test asserts `decideThread(erroredSummary(...)).proceed === false` with a reason
  naming the non-success outcome — the existing halt branch, unchanged.

## Deviations from plan

**None.** Two anticipated risks did NOT materialize, confirming the Research analysis:
- **R1 (a hidden exhaustive `switch` breaks the build):** did not occur — `tsc --noEmit`
  is clean. No `RunOutcome` switch with a `never` default exists.
- **R2 (`walk-away.ts` OutcomeMix snapshot asserts an exact key set):** did not occur —
  the full suite is green; no test pinned the mix's key set against the new `errored: 0`.

## Notes for downstream tickets

- T-054-02 catch sites (`runGraph` `:209`, `runGraphConcurrent` `:429-441`) should call
  `erroredSummary(id)` and `summaries.set(id, …)`; the existing `decideThread` →
  `haltReasonOf` → cascade-skip machinery then runs unchanged. The thrown error's
  *message* is the runner's to log at its catch site (deliberately NOT carried in the
  summary — see Design Decision 2 / Review open concerns).
- `erroredSummary` is exported and deterministic, so T-054-03 can assert byte-identical
  errored summaries across both runners.
