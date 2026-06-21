# T-054-01 Structure — pure-errored-outcome-unit

_The shape of the code: files touched, exact edits, interfaces, ordering. Not code._

## Files

| File | Action | Why |
|---|---|---|
| `src/log/run-log.ts` | MODIFY | Add `"errored"` to `RUN_OUTCOMES`; extend the doc comment. |
| `src/engine/graph-core.ts` | MODIFY | Add the `NODE_ERRORED` const + the pure `erroredSummary` helper, both exported. |
| `src/engine/graph-core.test.ts` | MODIFY | Add a focused describe block proving the AC. |

No files created or deleted. No changes to `cast.ts` (`RunSummary` unchanged),
`chain-core.ts` (`decideThread` unchanged), or the runners (`runGraph` /
`runGraphConcurrent` untouched — that is T-054-02).

---

## Edit 1 — `src/log/run-log.ts` (the outcome vocabulary)

**Location:** the `RUN_OUTCOMES` tuple at `:48` and its doc comment at `:37-47`.

**Change A — the tuple.** Append `"errored"` as the last member:

```ts
export const RUN_OUTCOMES = ["success", "gate-failed", "timed-out",
  "budget-exhausted", "id-collision", "missing-capability", "errored"] as const;
```

Appended last so existing members keep their index positions. `RunOutcome` (`:54`)
derives automatically; `assertOutcome` (`:198`) and `reviveRecord` (`:364`) accept the
new value via their membership checks with no further edit.

**Change B — the doc comment.** Add one clause to the existing per-value mapping list
(after `missing-capability`, before `success`):

> `errored` ← a node's cast THREW (E-054 — the graph runner wraps the throw into a
> marked, non-proceeding node summary rather than crashing the wave);

No behavioral code in this file changes — only the tuple literal and prose.

---

## Edit 2 — `src/engine/graph-core.ts` (the pure primitive)

**Location:** a new exported section. Natural home: just **above** `SkippedNode`
(`:49`) or just below the imports — colocated with the other pure helpers
(`actualsDelta` is the existing pure helper precedent). It needs `RunSummary` (already
type-imported, `:42`) and `NodeId` (already type-imported, `:44`), and `RunOutcome`
(already type-imported, `:41`). **No new imports.**

**New public symbols:**

```ts
/** The terminal outcome a thrown node cast is marked with (E-054). A throw is not a
 *  crash: the runner wraps it into a non-proceeding summary carrying this outcome, so
 *  it routes through the SAME `decideThread` halt path every non-success uses. */
export const NODE_ERRORED: RunOutcome = "errored";

/**
 * Map a thrown node cast into a deterministic, NON-PROCEEDING {@link RunSummary} — the
 * single routing primitive both runners reuse (T-054-02) so a throw becomes a marked
 * node, never an uncaught rejection. PURE & DETERMINISTIC: `runId` is a pure function
 * of `id` (no clock/random), so the same throwing spec yields a byte-identical summary
 * under runGraph and runGraphConcurrent (the precondition T-054-03 leans on).
 *
 * The summary is truthful about a throw: `materialized: false` (nothing landed),
 * `produced` absent (nothing to thread ⇒ `decideThread` refuses ⇒ dependents skip via
 * the EXISTING halt-dependent-subgraph machinery), `actuals` absent (nothing measured ⇒
 * `actualsDelta` contributes {0,0}, no phantom wallet charge).
 */
export function erroredSummary(id: NodeId): RunSummary {
  return { runId: `errored:${id}`, outcome: NODE_ERRORED, materialized: false };
}
```

**Interface boundaries:**
- Input: `NodeId` (the throwing node's id, in scope at both runners' catch sites).
- Output: a `RunSummary` with `outcome === "errored"`, `produced === undefined`,
  `actuals === undefined`, `materialized === false`.
- Purity: no fs/clock/network/random; idempotent and referentially transparent.

**Internal organization:** `NODE_ERRORED` is the named constant so the literal
`"errored"` appears once and both the helper and future runner code reference the name.

---

## Edit 3 — `src/engine/graph-core.test.ts` (the proof)

**Location:** a new top-level `describe` block (placement: after the existing imports
and fixtures, e.g. near the top of the test bodies). 

**New import:** `decideThread` from `../engine/chain-core.ts` (currently NOT imported by
this file) and `{ erroredSummary, NODE_ERRORED }` from `./graph-core.ts` (extend the
existing import on `:4`).

**The block — `describe("erroredSummary — the pure throw→errored primitive (T-054-01)")`
with these tests:**

1. **"yields outcome 'errored' with produced undefined"** — call `erroredSummary("X")`;
   assert `.outcome === "errored"`, `.produced === undefined`, `.materialized === false`,
   `.actuals === undefined`, and `.runId` is a non-empty string (`"errored:X"`).
2. **"decideThread refuses it (proceed:false) — routes through the halt path"** — pass
   the errored summary to `decideThread`; assert `.proceed === false` and the `.reason`
   names the outcome (`contains "errored"` / `contains "not success"`), proving it takes
   the existing non-success halt branch unchanged.
3. **"is deterministic — same id ⇒ identical summary"** — `erroredSummary("X")` twice
   `toEqual` each other (the property T-054-03's cross-runner equality depends on), and
   different ids differ in `runId`.
4. **"NODE_ERRORED is a member of RUN_OUTCOMES"** — assert `RUN_OUTCOMES.includes(
   NODE_ERRORED)` (import `RUN_OUTCOMES` from `../log/run-log.ts`) so the constant and the
   tuple cannot drift apart.

These are pure-function assertions — **no runner is invoked**, no live model, no spawn —
satisfying the AC's "a graph-core unit test (no runner, no live model)".

---

## Ordering of changes (matters)

1. **Edit 1 first** (`RUN_OUTCOMES` gains `errored`). Until the union includes
   `"errored"`, `NODE_ERRORED: RunOutcome = "errored"` in Edit 2 will not typecheck.
2. **Edit 2 next** (the helper compiles against the widened union).
3. **Edit 3 last** (the test imports both and proves the AC).

Each edit is independently meaningful but they are committed together as one atomic unit
(the helper is meaningless without the value; the test is the value's proof).

## What is explicitly NOT in this ticket

- No try/catch in `runGraph` / `runGraphConcurrent` (T-054-02).
- No dual-runner equivalence test for a throwing spec (T-054-03).
- No new field on `RunSummary` (rejected in Design as scope creep).
- No change to `decideThread`, `castPlay`, or the ledger consumers.
