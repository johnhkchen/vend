# T-054-02 Review — thread-throw-into-both-runners

_Handoff document. What changed, coverage, open concerns. Read this, not every diff._

## What this ticket delivered

The runner-wiring step of E-054: both graph runners now CATCH a thrown node cast and map
it to the `errored` node summary (T-054-01's `erroredSummary`) instead of letting the throw
escape. A throw is now a marked, contained node outcome — its dependents skip, independent
siblings keep running, and the runner promise resolves to a clean `GraphResult`. This
closes the last "a node throw crashes the run" gap on the E-046 graph substrate.

Commit: `f25d81c` — `feat(T-054-02): catch thrown casts into 'errored' summary in both graph runners`.

## Files changed (2 source + 6 work artifacts)

| File | Change |
|---|---|
| `src/engine/graph-core.ts` | `runGraph`: declare `let summary: RunSummary` and wrap the cast in `try/catch → erroredSummary(id)`. `runGraphConcurrent`: wrap the cast INSIDE the `dispatch.map` thunk in `try/catch → return [id, erroredSummary(id)]`. ~14 lines added (incl. comments); no logic moved, no signature changed. |
| `src/engine/graph-core.test.ts` | Added `throwingNode(id)` helper + a 4-test `describe` block (T-054-02). |
| `docs/active/work/T-054-02/*.md` | research / design / structure / plan / progress / review. |

### The behavioral change (both runners, same shape)

```ts
// runGraph
let summary: RunSummary;
try { summary = await node.cast(upstreams); }
catch { summary = erroredSummary(id); }

// runGraphConcurrent (inside the Promise.all dispatch thunk)
try { return [id, await node.cast(upstreams)] as const; }
catch { return [id, erroredSummary(id)] as const; }
```

After the catch, NOTHING else changed: `summaries.set` → `decideThread` → `proceeded` /
`haltReasonOf` → cascade-skip → `firstFail` all run on the substituted summary exactly as
they do for a node that *returned* `gate-failed`. That equivalence is why the change is
tiny and low-risk.

## Why a throw needs no new control flow

`erroredSummary(id)` carries `outcome: "errored"` (non-`success`) and no `produced`.
`decideThread` (`chain-core.ts:49`) refuses any non-`success` as its FIRST branch →
`{ proceed: false }` → the node never enters `proceeded` → dependents classify their
in-edge to it as `halted` and skip via the EXISTING machinery. The concurrent path's
post-settle DEBIT sees `actuals === undefined` → `actualsDelta` contributes `{0,0}` → no
phantom wallet charge. The only new code is the catch that turns the throw into that
summary; the routing is 100% reused.

## Test coverage

New block `a thrown cast becomes an 'errored' node, dependents skip, siblings survive
(T-054-02)` — 4 tests, pure stubs, **no runner spawn, no live model**. One spec shape
(A→{B(throws),C}, B→D) exercises all four AC clauses per runner:

1. **runGraph** — B is `errored` in `.nodes`; D absent from `.nodes` and present in
   `.skipped` (blockedBy ⊇ B, reason names the halted/errored upstream); C present, cast
   with `{A:"pa"}`; `outcome === "errored"`; `halted === true`; produced `{C:"pc"}`.
2. **runGraphConcurrent** — identical `assertAc`; proves the thrown thunk did NOT reject
   the `Promise.all` wave.
3. **runGraphConcurrent resolves** — explicit `.resolves.toBeDefined()` pinning AC#4 as a
   first-class property (would fail if the catch were outside the dispatch thunk).
4. **parity** — `facets(seq) === facets(con)` for the throwing spec; cast set `[A,B,C]`.

**Results:** graph-core suite **29 pass / 0 fail** (was 25). Full gate `bun run check`
(baml:gen + `tsc --noEmit` + `bun test`) → **1214 pass / 0 fail** (was 1210), typecheck
clean, baml clean, pre-commit hook green.

### Coverage gaps (intentional, owned elsewhere)

- **Formal dual-runner byte-equivalence for throwing specs** — test #4 gives a minimal
  parity sanity check; the FORMAL proof (the `facets`-equality matrix across throw shapes)
  is **T-054-03**'s ticket. Not a gap in this ticket's AC.
- **A throw under a budgeted wallet wave** — not separately tested here. The errored
  summary's `actuals === undefined` ⇒ `{0,0}` debit is an already-tested invariant of the
  E-048 budget algebra (`actualsDelta`); a throw cannot over-debit. Noted, not re-proven.
- **Error message observability** — see open concern #1; deliberately out of scope.

## Open concerns / notes for human attention

1. **The thrown error's message/stack is DISCARDED at the catch site** (bare `catch {}`).
   This is deliberate and inherited from T-054-01 Design Decision 2: a throw is made to
   behave like every other non-success, and the pure core must not perform I/O (no
   `console.error`). The andon a human sees is `decideThread`'s reason threaded into
   dependents' skip text (`… halted upstream 'B' (halted: step outcome 'errored' is not
   success)`) — which names the node and that it errored, but NOT why it threw. If richer
   diagnostics are wanted (an `error?: string` on `RunSummary`, or logging at the impure
   `castGraph` shell), that is a separate, justified change — **flagged, not done here** to
   avoid mutating a shared core type for a narrow ticket. Recommend the impure shell
   (`graph.ts`) capture and log the thrown value if/when operator-facing diagnostics matter.
2. **Purity preserved.** The catch is a pure value-substitution; `graph-core.ts` still
   imports only pure/type-only modules. The module's "pure given injected casts" contract
   is intact — verified by the test file loading no native addon and spawning nothing.
3. **`errored` records now actually appear.** T-054-01 made `errored` a valid `RunOutcome`
   but nothing emitted it; this ticket is the first emitter. The append-only ledger's
   `reviveRecord` already accepts the value (T-054-01), so no migration is needed.
4. **Concurrent containment is the stronger guarantee.** Pre-change, one thrown thunk
   rejected the whole `Promise.all`, discarding even sibling thunks that had already
   settled in the same wave. The in-thunk catch fixes this — a strict totality widening.

## Risk assessment: LOW

~14 lines across two existing functions; no signature, shared-type, gate, or ledger-consumer
change. The substituted summary travels a path both runners already execute and test for
`gate-failed`. `Promise.all` goes from "may reject" to "always resolves" — strictly more
total. Rollback is a 2-arm revert per runner with no migration. Full suite green (1214).
