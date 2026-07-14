# T-054-02 Design — thread-throw-into-both-runners

_Options, tradeoffs, decision with rationale. Grounded in the Research map._

## The decision in one line

In each runner, wrap ONLY the `await node.cast(...)` call in a `try/catch`; on throw,
substitute `erroredSummary(id)` for the thrown value and let the existing
record→`decideThread`→cascade-skip path run unchanged. No other code moves.

## What must be true when done (from the AC)

For BOTH `runGraph` and `runGraphConcurrent`, given a spec with a throwing node, an
independent sibling, and a transitive dependent of the thrower:

1. the throwing node appears in `GraphResult.nodes` as an `errored` entry;
2. its transitive dependents land in `skipped` with a recorded reason;
3. an independent sibling node still completes;
4. the runner promise RESOLVES to a clean `GraphResult` — never rejects;
5. proven with NO live model (pure stubs only).

## Design Decision 1 — WHERE to put the catch

### Option A (CHOSEN): wrap only the `cast` call, smallest possible try-block

`runGraph`:
```ts
let summary: RunSummary;
try {
  summary = await node.cast(upstreams);
} catch {
  summary = erroredSummary(id);
}
summaries.set(id, summary);   // everything downstream is UNCHANGED
```

`runGraphConcurrent` (inside `dispatch.map`):
```ts
try {
  return [id, await node.cast(upstreams)] as const;
} catch {
  return [id, erroredSummary(id)] as const;
}
```

- **Pro:** the try-block contains exactly the one impure, throw-capable line. Everything
  after (`summaries.set`, `firstFail`, `decideThread`, fan-out, debit) executes on the
  substituted summary identically to a node that returned `gate-failed` — a path both
  runners already prove. Minimal blast radius; the diff is ~4 lines per runner.
- **Pro:** `Promise.all` sees a RESOLVED member (the thunk returns `[id, errored]`), so
  the wave never rejects and sibling thunks in the same wave keep their results (AC#4 for
  the concurrent path — the harder half).
- **Pro:** symmetric across both runners — same substitution, same downstream — which is
  precisely what makes T-054-03's byte-equivalence hold.
- **Con:** the thrown error's message is discarded (not carried into the summary). See
  Decision 2 — this is deliberate and inherited from T-054-01.

### Option B (REJECTED): wrap a larger region (the whole loop body / whole thunk)

Catch around `summaries.set` + `decideThread` + fan-out too.
- **Rejected:** those lines are pure and cannot throw on a substituted summary; widening
  the try-block only obscures WHICH line is the throw source and risks accidentally
  swallowing a genuine programming error (e.g. a future bug in `decideThread`). The
  minimal block is more honest and more debuggable.

### Option C (REJECTED): a top-level `try` around the entire runner body

One catch at the function boundary returning a degenerate `GraphResult`.
- **Rejected:** loses the cascade entirely — a throw would abandon the topo walk, so
  independent siblings AFTER the thrower never run (violates AC#3) and dependents are not
  individually marked `skipped` (violates AC#2). The whole value of E-054 is per-node
  containment, which only a per-cast catch delivers.

## Design Decision 2 — WHAT the catch produces (and what it drops)

The catch maps the thrown value to `erroredSummary(id)` and NOTHING else. The error's
message/stack is not captured.

- **Rationale (inherited, T-054-01 Decision 2):** a throw is made to "behave like every
  other non-success". A `gate-failed`/`timed-out` summary carries only its *outcome*, not
  full failure detail; the human andon comes from `decideThread`'s reason, threaded into
  the dependents' skip reasons. Carrying the error string would require either mutating the
  shared `RunSummary` core type (an `error?: string` field) or a side-channel — both are
  out of this narrow ticket's scope and are flagged for a separate, justified change.
- **Purity (load-bearing):** the pure core must not `console.error` or otherwise perform
  I/O. Swallowing-into-a-value keeps `graph-core.ts` pure (the discipline the whole module
  header defends). The impure SHELL (`castGraph` in `graph.ts`, run-log writers) is where
  error-message logging belongs if/when added — out of scope here.
- **Known limitation (flagged for Review):** an operator reading the ledger sees `errored`
  but not *why* the thunk threw. Acceptable for E-054's "a throw is a marked node, not a
  crash" goal; richer error observability is a deliberate follow-on.

## Design Decision 3 — catch binding style

Use a bare `catch {` (no binding) since the caught value is intentionally unused. This
matches the "drop the message" decision and avoids an unused-variable lint. TypeScript's
`useUnknownInCatchVariables` is moot when there is no binding. If a future ticket captures
the message, it becomes `catch (e) { … }` then.

## Design Decision 4 — the test approach

A NEW `describe` block in the existing `graph-core.test.ts` (not a new file), mirroring the
existing E-049 cross-executor block. Reasons:
- The file is already the canonical home for pure-core runner tests (25 tests, all the
  helpers live here). A throw test is the same category.
- T-054-03 (dual-runner equivalence for a throw) will want the `facets()` projection that
  already lives in this file — keeping the throw tests here lets T-054-03 extend rather
  than re-import.

New helper `throwingNode(id)` — a `DagNode` whose `cast` throws a real `Error`. Distinct
from `neverNode` (whose throw asserts "must not be called"): `throwingNode`'s throw is the
stimulus the runner must ABSORB. Keeping them separate keeps each helper's intent legible.

Per-runner coverage (AC says "proven for both"): the same spec shape run through `runGraph`
AND `runGraphConcurrent`, asserting on each: throwing node is an `errored` entry in
`.nodes`; dependent in `.skipped` with a reason naming the halted upstream; independent
sibling present in `.nodes` (and, via a recordingNode, actually cast with its real JOIN);
the promise resolved (the `await` returned a `GraphResult`, never threw). Plus: the runner
does NOT reject — asserted by the test simply completing the `await` and, defensively, an
explicit "resolves not rejects" assertion via `.resolves`/try.

## What is explicitly OUT of scope

- **Carrying the error message** (Decision 2) — separate, justified change.
- **Dual-runner byte-equivalence for a throwing spec** — that is T-054-03; this ticket
  proves per-runner behavior. (The tests here will naturally be near-identical across
  runners, which de-risks T-054-03, but the formal `facets`-equality assertion is its job.)
- **Retry/backoff on a throw** — E-054 non-goal; `errored` is terminal.
- **Changing `decideThread`, `RunSummary`, or `RUN_OUTCOMES`** — all already correct from
  T-054-01; touching them would be regression surface for zero benefit.

## Why this is low-risk

The substituted `errored` summary travels the SAME code path as a returned `gate-failed`
summary, which both runners already execute and test (`graph-core.test.ts:147-207`,
`:385-412`). The change adds a `try/catch` whose catch arm produces a value that path
already handles. No new state, no new branch in `decideThread`, no shared-type change. The
concurrent path's `Promise.all` goes from "may reject" to "always resolves", strictly
widening totality. Rollback is a 2-line revert per runner.
