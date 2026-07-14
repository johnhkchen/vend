# T-054-01 Research — pure-errored-outcome-unit

_Descriptive map of the codebase territory this ticket touches. No solutions here._

## The ticket in one line

Add a deterministic `errored` `RunOutcome` plus a **pure helper** that maps a thrown
cast into a marked, non-proceeding node summary — the single routing primitive both
graph runners will reuse (in T-054-02). This is the pure-core prerequisite of E-054;
no runner wiring happens here.

## Where the relevant code lives

| Concern | File | Symbols |
|---|---|---|
| The outcome vocabulary | `src/log/run-log.ts` | `RUN_OUTCOMES` (const tuple), `RunOutcome` (union), `assertOutcome`, `reviveRecord` |
| The cast-result shape | `src/engine/cast.ts` | `RunSummary` (`runId`, `outcome`, `materialized`, `produced?`, `actuals?`) |
| The shared halt gate | `src/engine/chain-core.ts` | `decideThread(summary): ThreadDecision` |
| The two graph runners + pure core | `src/engine/graph-core.ts` | `runGraph`, `runGraphConcurrent`, `GraphResult`, `SkippedNode` |
| Pure-core unit tests | `src/engine/graph-core.test.ts` | 21 tests, `summary()`/`recordingNode()`/`neverNode()` helpers |

## RUN_OUTCOMES today (`src/log/run-log.ts:48`)

```ts
export const RUN_OUTCOMES = ["success", "gate-failed", "timed-out",
  "budget-exhausted", "id-collision", "missing-capability"] as const;
export type RunOutcome = (typeof RUN_OUTCOMES)[number];
```

It is a `const` tuple; `RunOutcome` is the derived literal union. The doc comment
(lines 37–47) explains each value maps to a state another module already produces
(`timed-out ← ClaudeTimeoutError`, `gate-failed ← a gate verdict`, etc.). There is
**no `errored`/`crashed` value** — confirmed by go-and-see (obs 23900). The runner
classifies; the log records.

Two boundaries read this tuple at runtime:
- `assertOutcome` (`:198`) — the WRITE boundary, throws `RangeError` on an unknown label.
- `reviveRecord` (`:364`) — the READ boundary, drops a record with an unknown outcome.

Both are membership checks against `RUN_OUTCOMES`, so adding a value to the tuple
extends what they accept automatically — no per-value branch to update.

## What consumes `RunOutcome` across the codebase

Grep over `src/**/*.ts` (excluding tests) for `RunOutcome` / `RUN_OUTCOMES` /
`switch.*outcome` / `: never` surfaced these consumers. **None is an exhaustive
`switch` with a `never` default** — so adding a union member does not create a
compile error anywhere. The notable consumers:

- `src/ledger/walk-away.ts:48,167` — `OutcomeMix = Record<RunOutcome, number>`, seeded
  via `Object.fromEntries(RUN_OUTCOMES.map((o) => [o, 0]))`. A new outcome becomes a
  new key seeded `0`. **Total by construction** — adding `errored` just widens the mix.
- `src/ledger/recalibrate.ts:60` and `walk-away.ts:44` — `CENSORED_OUTCOMES: readonly
  RunOutcome[] = ["budget-exhausted", "timed-out"]`. A plain array literal. `errored`
  is NOT a censored (ran-to-the-envelope) outcome, so it correctly stays out — no edit.
- `src/engine/spend-core.ts`, `spend.ts`, `cast-core.ts`, `play.ts`, `chain-core.ts`,
  `graph-core.ts`, `decompose-epic-core.ts` — all type-only or pass-through uses of the
  union (a field typed `RunOutcome`, or `outcome !== "success"` checks). No value
  enumeration, no exhaustiveness assertion.

So the blast radius of adding `errored` to the tuple is: the type widens, the two
membership boundaries accept it, the outcome-mix gains a zero-seeded key. Nothing breaks.

## The halt gate — `decideThread` (`src/engine/chain-core.ts:49`)

```ts
export function decideThread(summary: RunSummary): ThreadDecision {
  if (summary.outcome !== "success") {
    return { proceed: false, reason: `halted: step outcome '${summary.outcome}' is not success` };
  }
  if (summary.produced === undefined || summary.produced.length === 0) {
    return { proceed: false, reason: "halted: step succeeded but surfaced no `produced` reference to thread" };
  }
  return { proceed: true };
}
```

This is the load-bearing observation for the whole epic: `decideThread` is already
**total over every non-success outcome** — its first branch is `outcome !== "success"`.
So a summary carrying `outcome: "errored"` is refused (`proceed: false`) with the
reason `halted: step outcome 'errored' is not success`, with **zero changes** to
`decideThread`. The errored summary "routes through the halt path unchanged" — exactly
the AC's wording. Confirmed by obs 23900.

## The cast-result shape — `RunSummary` (`src/engine/cast.ts:101`)

```ts
export interface RunSummary {
  readonly runId: string;
  readonly outcome: RunOutcome;
  readonly materialized: boolean;   // did the effect land
  readonly produced?: string;       // artifact ref to thread downstream; absent ⇒ nothing
  readonly actuals?: CastActuals;   // measured cost; optional so hand-built fakes stay valid
}
```

A throw produced nothing materialized, nothing to thread, and measured nothing —
so a synthetic errored summary is `{ runId, outcome: "errored", materialized: false }`
with `produced`/`actuals` absent (`undefined`). `produced` being optional is what lets
the AC assert "produced undefined". `actuals` being optional (line 116–119 doc: "so a
hand-built RunSummary fake stays valid") is precedent that synthesizing a partial
summary off the cast path is a supported, intended use.

## How the runners consume summaries (context for T-054-02, NOT this ticket)

Both runners (`graph-core.ts`) cast a node then call `decideThread`:
- `runGraph` (`:209`): `const summary = await node.cast(upstreams);` in a topo for-loop,
  **no try/catch** — a throw propagates uncaught out of `runGraph`.
- `runGraphConcurrent` (`:429-441`): casts inside `Promise.all(dispatch.map(...))` —
  a thrown thunk rejects the whole `Promise.all`, killing the wave and discarding the
  partial `GraphResult`.

After casting, each records `summaries.set(id, summary)`, then `decideThread`: on
`proceed` adds to `proceeded` + records `producedAll`; else records `haltReasonOf`,
which feeds the skip-reason andons of dependents. **A node that does not proceed
already cascade-skips its dependent subgraph** via existing machinery (`graph-core.ts`
classify/skip loop, `:165-196` sequential, `:362-401` concurrent).

This is why T-054-01 only needs to supply the errored summary: once a throw becomes
a non-proceeding summary, the existing halt-dependent-subgraph machinery does the rest.
Wrapping the cast sites in try/catch is **T-054-02's** job; proving dual-runner
equivalence is **T-054-03's**. This ticket builds and unit-proves the primitive only.

## The test substrate — `graph-core.test.ts`

A pure-function test: imports only `graph-core.ts` + `dag-core.ts` (both type-only-import
the impure `cast.ts`), so the process loads no native addon and spawns nothing.
Existing helpers: `summary(outcome, produced?)` fabricates a `RunSummary`;
`recordingNode`/`neverNode` build `DagNode`s; cross-runner equivalence is asserted via a
`facets()` projection of `GraphResult`. `decideThread` is exported from `chain-core.ts`
and is currently NOT imported by this test file — a new import will be needed.

## Assumptions & constraints

- **Purity must hold.** The helper lives in (or is imported by) `graph-core.ts`, whose
  every import is a TYPE or a pure value. The helper must be pure: no fs/clock/network.
- **No RunSummary shape change is required by the AC** (outcome + produced-undefined +
  decideThread refusal). Adding fields would be scope creep across a core type.
- **`errored` is a terminal, non-re-cast outcome** (E-054 non-goal: no retry/backoff).
- **Deterministic.** Same input ⇒ byte-identical summary, so T-054-03's cross-runner
  equality can hold. A synthesized `runId` must therefore be a pure function of inputs.
- The check gate is `bun run check` (baml:gen + typecheck + test); baseline is green
  (graph-core suite: 21 pass).
