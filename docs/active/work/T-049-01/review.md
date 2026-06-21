# T-049-01 — Review

**Ticket:** predicate-on-dagedge-sequential-rungraph (S-049-01, E-049 conditional-dag-edges)
**Outcome:** complete. Optional edge predicates added to the model; the sequential `runGraph` fires only
predicate-holding edges; the branch-not-taken is an observable `skipped` with a distinct andon. Build +
full test suite green. No commit made (Lisa drives phase transitions).

## What changed

| File | Change |
|---|---|
| `src/engine/dag-core.ts` | +`EdgePredicate` type; +optional `when?` on `DagEdge` (doc'd). No logic change — `validateDag`/`topoSort` read only `from`/`to`. |
| `src/engine/graph-core.ts` | `runGraph` only: `inEdges` now `Map<NodeId, DagEdge[]>`; two-state halt check → three-state in-edge classification (halted / not-taken / fired) + dual reason with halt precedence; JOIN iterates edges. `SkippedNode.blockedBy` doc widened. |
| `src/engine/graph-core.test.ts` | +`validateDag` import; +5-case `describe` block for conditional edges. |
| `docs/active/work/T-049-01/*` | RDSPI artifacts. |

`docs/active/tickets/T-049-01.md` shows in the diff but was **already modified at session start** (Lisa's
phase staging) — not touched by this work.

## How it works

An in-edge `from→to` now **fires** iff `from` proceeded (the existing `decideThread` gate) **and** its
`when` predicate (if any) holds over `from`'s `produced` string. A node casts iff every in-edge fires.
An un-fired in-edge is one of two kinds:
- **halted** — upstream did not proceed → existing reason `skipped — dependent on halted upstream …`;
- **not-taken** — upstream proceeded but `when` rejected its produced → new reason
  `skipped — branch not taken: upstream '<id>' produced a result this edge's predicate rejected`.

Halt takes precedence when both are present. A not-taken node never enters `proceeded`, so its
downstream closure cascade-skips through the **unchanged** halt machinery — the epic's "reuse, don't
reinvent" spine. An edge with no `when` reduces exactly to the pre-E-049 unconditional fan-out.

## Acceptance criteria — verification

The single AC, clause by clause (all in `graph-core.test.ts` → "conditional edges select the taken branch"):
- ✅ *1→{A,B} with mutually-exclusive predicates runs ONLY the matching branch* — `recordingNode` calls
  prove A cast with `{1:"go-A"}`, B never cast; `nodes.size === 2`; `produced === {A:"pa"}`.
- ✅ *not-taken node present in `result.skipped`* — `skipped` ids `["B"]`.
- ✅ *reason reads 'branch not taken', textually distinct from 'dependent on halted upstream'* —
  `toContain("branch not taken")` + `not.toContain("dependent on halted upstream")`.
- ✅ *validateDag still ok for the predicated spec* — `expect(validateDag(graph)).toEqual({ok:true})`.
- ✅ *`bun test` green* — full suite **1155 pass / 0 fail** (baseline ~1150; +5 new). `bun run build` clean.

Plus two guard cases beyond the AC: back-compat (un-predicated edge unchanged) and cascade reuse
(not-taken `B`'s downstream `C` skips via the existing halt path).

## Test coverage & gaps

- **Covered:** taken/not-taken selection, distinct andon, `validateDag` pass, back-compat, multi-hop
  cascade below a not-taken node. Pure-function test — no live model, no spawn, no addon (house
  discipline: imports only `graph-core.ts` + `dag-core.ts`).
- **Deliberately deferred (other tickets, not gaps here):**
  - `runGraphConcurrent` predicate firing → **T-049-02** (confirmed untouched: its `inEdges` is still
    `NodeId[]`; full suite green proves no regression).
  - End-to-end predicate through the impure `castGraph` shell → **T-049-03**.
- **Untested edge cases (low risk, documented in code, not in AC):**
  - A node with BOTH a halted and a not-taken in-edge → halt wins the reason (design Decision 3). No
    test; the precedence is simple and commented.
  - A JOIN where one in-edge fires and another is not-taken → node skips (branch-not-taken). Implied by
    the classification; not separately asserted.

## Open concerns / notes for the reviewer

1. **Predicate throws are not caught** — parity with how `runGraph` treats injected `cast` thunks (a
   throw propagates; totality is about the pure logic given well-behaved thunks). If a future caller
   wants a thrown predicate to degrade to "not-taken", that's a deliberate follow-up, not a silent gap.
2. **Reason is a string contract, not a typed kind** — the AC asks for a *textually distinct* reason and
   every consumer reads `reason` as a string. If a downstream later needs to switch on "branch-not-taken"
   structurally, add a `SkippedNode.kind` then (scope the epic explicitly defers).
3. **No commit** — the change sits in the working tree; Lisa handles phase transition and the sweep/commit
   per house convention. The change is one coherent, independently-green unit (model + runGraph + tests).
4. **T-049-02 must mirror this exactly** — it asserts `runGraphConcurrent` returns a `GraphResult` equal
   to `runGraph`'s for the same predicated spec, so this ticket's reasons/skip-shape are the reference
   contract. Keep the not-taken reason string stable.
</content>
