# T-054-02 Structure — thread-throw-into-both-runners

_The blueprint: which files change, exact edit sites, public surface, ordering. Not code._

## Files touched

| File | Change | Public surface impact |
|---|---|---|
| `src/engine/graph-core.ts` | Wrap the `cast` call in `runGraph` and in `runGraphConcurrent` with try/catch → `erroredSummary(id)` on throw. | NONE — internal to two existing exported functions; signatures unchanged. |
| `src/engine/graph-core.test.ts` | Add a `throwingNode(id)` helper + a new `describe` block with per-runner throw tests. | Test-only. |

No new files. No deletions. No changes to `run-log.ts`, `chain-core.ts`, `cast.ts`,
`dag-core.ts`, `wallet.ts`, `spend-core.ts` — all already provide what this ticket needs.

## Edit 1 — `runGraph` cast site (`graph-core.ts`, currently ~:230-234)

CURRENT:
```ts
const node = byId.get(id);
if (node === undefined) continue; // unreachable (id ∈ order ⊆ declared); guards the Map lookup
const summary = await node.cast(upstreams);
summaries.set(id, summary);
if (firstFail === undefined && summary.outcome !== "success") firstFail = summary;
```

AFTER (shape, not final code):
- Declare `summary` as `RunSummary`.
- `try { summary = await node.cast(upstreams); } catch { summary = erroredSummary(id); }`
- A one-line comment: a thrown cast becomes the errored node summary (T-054-01 helper) and
  routes through the SAME decideThread/halt path below — never propagates out of runGraph.
- Everything from `summaries.set(id, summary)` onward is UNCHANGED.

Invariant preserved: `summary` is always assigned before use (both arms assign), so no
"used before assigned" TS error; the downstream `firstFail`/`decideThread` lines see a
normal `RunSummary` either way.

## Edit 2 — `runGraphConcurrent` cast site (`graph-core.ts`, currently ~:452-464)

CURRENT (inside `Promise.all(dispatch.map(async (id) => { … }))`):
```ts
const node = byId.get(id);
if (node === undefined) return [id, undefined] as const; // unreachable
return [id, await node.cast(upstreams)] as const;
```

AFTER (shape):
- Keep the `node === undefined` guard returning `[id, undefined]`.
- `try { return [id, await node.cast(upstreams)] as const; }`
  `catch { return [id, erroredSummary(id)] as const; }`
- A one-line comment: a thrown thunk becomes the errored summary so `Promise.all` sees a
  RESOLVED member (the wave never rejects) and the throw cascade-skips dependents via the
  existing halt machinery — parity with runGraph.

Invariant preserved: the `cast` array's element type stays `readonly [NodeId, RunSummary |
undefined]`; `erroredSummary(id)` is a `RunSummary`, so the existing settle loop
(`for (const [id, summary] of cast)`, skip-if-undefined) is unchanged. The DEBIT step
(`actualsDelta(summaries.get(id))`) sees `actuals === undefined` on an errored summary ⇒
contributes `{0,0}` ⇒ no phantom charge. No change needed there.

## Edit ordering (within `graph-core.ts`)

Edits 1 and 2 are independent (different functions, no shared local). Either order. Both
rely on `erroredSummary` — already imported/defined in this module (T-054-01), so NO new
import line is required. Confirm by grep that `erroredSummary` is in scope (it is defined
in the same file, `:68`).

## Edit 3 — test helper `throwingNode` (`graph-core.test.ts`, near the other helpers ~:48)

A `DagNode` whose `cast` throws a real `Error`:
```ts
const throwingNode = (id: string): DagNode => ({
  id,
  cast: async () => { throw new Error(`cast for '${id}' threw (T-054-02 stub)`); },
});
```
Placed beside `neverNode`/`recordingNode`. Intent comment: UNLIKE `neverNode` (throws to
assert it was NOT called), `throwingNode`'s throw is the stimulus the runner must ABSORB
into an `errored` summary.

## Edit 4 — new test block (`graph-core.test.ts`, appended after the last describe ~:464)

`describe("runGraph / runGraphConcurrent — a thrown cast becomes an 'errored' node, dependents skip, siblings survive (T-054-02)", …)`.

Shared spec factory used by both runners — a fan-out + cascade that exercises all four AC
clauses in ONE shape:

```
        A (source, success, "pa")
       / \
   throws  C  (independent sibling — success, "pc")
  (B)       
   |
   D  (dependent of B — neverNode: must NOT be cast)
```
Edges: A→B, A→C, B→D. B is `throwingNode`; C is `recordingNode` (proves it ran with
`{A:"pa"}`); D is `neverNode` (proves the cascade skipped it, never cast). A is a
`recordingNode` source.

Test cases (the block):
1. **runGraph** — `const r = await runGraph(mkSpec());`
   - `r.nodes.get("B")?.outcome` === `"errored"` (AC#1);
   - `r.nodes.has("D")` === false AND `r.skipped.map(s=>s.id)` includes `"D"`, with
     `r.skipped.find(D).reason` containing `"errored"` / `"halted upstream"` and
     `blockedBy` containing `"B"` (AC#2);
   - `r.nodes.has("C")` === true (sibling completed) and the recordingNode's `calls`
     === `[{A:"pa"}]` (AC#3 — it actually ran with its JOIN);
   - the `await` returned a `GraphResult` (AC#4 — did not reject); `r.outcome` ===
     `"errored"` (first non-success in topo order); `r.halted` === true.
2. **runGraphConcurrent (legacy / no wallet)** — same spec, same assertions. Additionally
   asserts the wave did NOT reject (the harder concurrent guarantee).
3. **runGraphConcurrent does not reject — explicit** — `expect(runGraphConcurrent(mkSpec())).resolves.toBeDefined()` (or a try/catch asserting no throw), pinning AC#4 as a
   first-class property, not just an incidental of test #2 completing.
4. **(optional, de-risks T-054-03)** — `facets(seq)` vs `facets(con)` equal for the
   throwing spec, showing the two runners already agree. Kept minimal; the FORMAL
   equivalence proof is T-054-03's ticket.

Each `mkSpec()` builds FRESH nodes (recordingNode/neverNode close over per-call `calls`
arrays), matching the existing block's `mkSpec` pattern so running both runners does not
cross-contaminate recorded calls.

## Public interfaces — unchanged

- `runGraph(spec): Promise<GraphResult>` — same signature; now TOTAL over throwing casts.
- `runGraphConcurrent(spec, budget?): Promise<GraphResult>` — same; `Promise.all` now
  always resolves.
- `GraphResult`, `RunSummary`, `RUN_OUTCOMES`, `decideThread`, `erroredSummary` — all
  unchanged (consumed, not modified).

## Verification surface

- `bun test src/engine/graph-core.test.ts` — the new block + the existing 25 stay green.
- `bun run check` — baml:gen + `tsc --noEmit` (the `summary` declare-then-assign and the
  `catch`-arm types must typecheck) + full `bun test` (no regression in the 1210).
