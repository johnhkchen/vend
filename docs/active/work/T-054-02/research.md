# T-054-02 Research — thread-throw-into-both-runners

_Descriptive map of the territory. What exists, where, how it connects. No solutions._

## The ticket in one line

Wrap each node's `cast` invocation in BOTH graph runners (`runGraph`, `runGraphConcurrent`)
in a try/catch so a thrown thunk becomes the `errored` node summary (T-054-01's
`erroredSummary`) and cascades through the EXISTING halt-dependent-subgraph machinery
instead of propagating uncaught (sequential) or rejecting the whole `Promise.all` wave
(concurrent). This is the runner-wiring step of E-054; T-054-01 already built the pure
primitive, T-054-03 will prove dual-runner equivalence.

## What T-054-01 already delivered (the substrate this ticket consumes)

- `src/log/run-log.ts:48` — `RUN_OUTCOMES` gained `"errored"` (last tuple member); the
  `RunOutcome` union widened; `assertOutcome`/`reviveRecord` accept it via their existing
  membership checks. **No further run-log change is needed here.**
- `src/engine/graph-core.ts:53` — `export const NODE_ERRORED: RunOutcome = "errored";`
- `src/engine/graph-core.ts:68` — `export function erroredSummary(id: NodeId): RunSummary`
  returning `{ runId: \`errored:${id}\`, outcome: NODE_ERRORED, materialized: false }`,
  with `produced` and `actuals` absent (⇒ `undefined`). PURE & DETERMINISTIC.
- `src/engine/graph-core.test.ts:55-82` — 4 pure-function tests proving the primitive.

The helper is exactly what a catch site should produce: marked `errored`, non-proceeding
(`decideThread` refuses any non-`success`), measured nothing (`actuals` absent ⇒
`actualsDelta` contributes `{0,0}` ⇒ no phantom wallet charge under a budgeted wave).

## The two cast sites (where a throw escapes today)

Both live in `src/engine/graph-core.ts`. Line numbers are the CURRENT file (post-T-054-01).

### Sequential — `runGraph` (`graph-core.ts:232`)

```ts
const node = byId.get(id);
if (node === undefined) continue;
const summary = await node.cast(upstreams);     // :232  ← NO try/catch
summaries.set(id, summary);
if (firstFail === undefined && summary.outcome !== "success") firstFail = summary;
// ... decideThread(summary) → proceeded/producedAll OR haltReasonOf ...
```

A `cast` that throws propagates uncaught straight out of `runGraph`, rejecting its
returned promise. Every already-recorded summary, every independent sibling's completed
work, the partial `GraphResult` — all discarded. This is the bug E-054 closes.

### Concurrent — `runGraphConcurrent` (`graph-core.ts:452-464`)

```ts
const cast = await Promise.all(
  dispatch.map(async (id) => {
    const upstreams: NodeUpstreams = new Map(/* JOIN */);
    const node = byId.get(id);
    if (node === undefined) return [id, undefined] as const;
    return [id, await node.cast(upstreams)] as const;   // :462  ← NO try/catch
  }),
);
```

`Promise.all` rejects on the FIRST rejecting member, so one thrown thunk aborts the whole
wave — even sibling thunks dispatched in the SAME wave that already settled successfully
have their results thrown away (the wave's `cast` array is never assembled). Worse than
the sequential case: the throw also kills concurrent in-flight work, not just downstream.

## How a non-proceeding summary already cascades (the machinery to REUSE)

The whole point of T-054-01's design: once a throw becomes an `errored` summary, the
EXISTING code routes it with no new branch. Both runners, after casting, do:

```ts
summaries.set(id, summary);
const decision = decideThread(summary);          // chain-core.ts:49 — REUSED gate
if (decision.proceed) { proceeded.add(id); producedAll.set(id, summary.produced); }
else { haltReasonOf.set(id, decision.reason ?? "did not proceed"); }
```

- `decideThread` (`chain-core.ts:49`) refuses any `outcome !== "success"` as its FIRST
  branch → an `errored` summary returns `{ proceed: false, reason: "halted: step outcome
  'errored' is not success" }`. The node never enters `proceeded`.
- Dependents classify their in-edge to a non-`proceeded` upstream as `halted`
  (`runGraph` `:191`, `runGraphConcurrent` `:390`) → they land in `skipped` with the
  andon `skipped — dependent on halted upstream 'X' (halted: step outcome 'errored' …)`.
- `firstFail` (`:234` seq; `:494-497` con assembly) picks the errored summary as the
  run's terminal `outcome` if it is first non-success in topo order.
- An INDEPENDENT sibling (no path from the throwing node) is untouched — it casts and
  proceeds normally. This is the join/fan-out/halt contract already proven for
  `gate-failed` in `graph-core.test.ts:147-207` and `:178` (diamond with B failing).

So a throw, once caught into `erroredSummary(id)`, is behaviorally identical to a node
that cast and returned `gate-failed` — a case both runners already handle and test. The
ONLY missing wiring is the try/catch that turns the throw into that summary.

## The budgeted-wave interaction (concurrent path, E-048)

`runGraphConcurrent` may thread a shared `Wallet`. After settle it debits
`actualsDelta(summaries.get(id))` for each DISPATCHED id (`:483-488`). An errored summary
has `actuals === undefined` ⇒ `actualsDelta` returns `{ tokens: 0, timeMs: 0 }` (`:282-286`)
⇒ the wallet does not move on the throw. A throw that consumed real tokens before failing
is NOT measured here (the pure core only sees what the thunk returns; a throwing thunk
returns nothing) — this is consistent with T-054-01's "measured nothing" stance and is a
known observability limitation, not a correctness bug for the budget invariant (a throw
cannot over-debit; at worst it under-counts un-returned spend).

## The test substrate — `graph-core.test.ts`

A pure-function test (imports only `graph-core.ts` + `dag-core.ts` + `chain-core.ts` +
`wallet.ts`/`budget.ts` — all pure or type-only). NO native addon, NO spawn, NO live model.
Reusable helpers already present:
- `summary(outcome, produced?)` — fabricate a `RunSummary`.
- `recordingNode(id, result)` — a `DagNode` that records its upstream JOIN map and returns
  a canned summary (proves an independent sibling actually ran with the right inputs).
- `neverNode(id)` — a `DagNode` whose cast THROWS if invoked (proves a node was skipped).
- `edge(from,to)`, `spec(nodes,edges)` — spec builders.
- `facets(r)` — the `GraphResult` projection used for cross-executor equality (cast-node
  set, skipped ids+reasons+blockedBy, produced, outcome, halted) — present in the
  `runGraphConcurrent` conditional-edges describe block (`:336`).

What is MISSING: a helper for a node whose cast THROWS *to be caught* (the inverse of
`neverNode`, which throws to assert it was NOT called). The new tests need a
`throwingNode(id)` whose throw must be caught by the runner. `neverNode` cannot serve —
its throw means "test fails"; the new node's throw means "runner must absorb it".

## Assumptions & constraints

- **Purity preserved.** The catch must not add fs/clock/network/console. It maps the
  thrown value to `erroredSummary(id)` and continues — a pure transformation. No logging
  in the pure core (the error's *message* is deliberately not surfaced — T-054-01 Design
  Decision 2; flagged again here as a known limitation).
- **No new outcome branch.** The errored summary routes through `decideThread` exactly as
  every other non-success — the reuse the epic mandates.
- **Both runners must stay byte-equivalent** for a throwing spec (the precondition
  T-054-03 leans on). `erroredSummary` being a pure fn of `id` already guarantees the
  summary is identical; this ticket must ensure the catch is placed so both produce the
  same `GraphResult` (same cast-node set, same skips, same outcome).
- **The runner promise must RESOLVE, never reject** — the AC's hard requirement for both
  runners. The catch must be inside the awaited unit (the for-loop body for `runGraph`;
  each `dispatch.map` thunk for `runGraphConcurrent`, so `Promise.all` sees a resolved
  member, not a rejection).
- Check gate: `bun run check` (baml:gen + `tsc --noEmit` + `bun test`); baseline green
  (graph-core suite 25 pass; full suite 1210 pass per T-054-01).
