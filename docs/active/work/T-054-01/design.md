# T-054-01 Design — pure-errored-outcome-unit

_Options weighed against the research, one decision, with rationale and rejections._

## The two decisions this ticket forces

1. **What outcome value does a thrown cast map to?**
2. **What is the helper's signature and shape, and where does it live?**

---

## Decision 1 — the outcome value: a NEW `errored` member

### Options

- **A. Reuse an existing non-success outcome** (e.g. `gate-failed`). A throw is "just
  another non-success", so route it through a value that already exists.
- **B. Add a new `errored` member to `RUN_OUTCOMES`.** ✅ CHOSEN
- **C. Add `crashed`** (alternative name).

### Rationale

The ticket AC names the value explicitly: "RUN_OUTCOMES gains an **'errored'** value …
the pure error helper yields outcome **'errored'**". So the value is specified — B/C,
and B's spelling, is mandated. Beyond the AC, B is correct on the merits:

- **Honesty (IA-9 / the ledger contract).** Reusing `gate-failed` (Option A) would lie
  in the run log: a thrown executor (network drop, malformed tool call, executor bug —
  E-054 intent) is categorically different from a gate STOP. The ledger is append-only
  and forever; a conflated outcome can never be disentangled later. `RUN_OUTCOMES`'
  own doc comment establishes the discipline: each value maps to a *distinct* state a
  module produces. A throw is a new distinct state and earns a new name.
- **Research confirms the blast radius is nil.** No exhaustive `switch`/`never` over
  `RunOutcome` exists; `walk-away.ts`'s `OutcomeMix` is total by construction (seeded
  from `RUN_OUTCOMES`); the two membership boundaries (`assertOutcome`, `reviveRecord`)
  accept the new value automatically. Adding a member is cheap and safe.
- `errored` over `crashed` (C): the epic frontmatter uses "errored/failed node" and the
  AC says `errored`. "Crashed" implies the process died — the whole point is that it
  does NOT crash. `errored` reads as "this node's cast errored", which is precise.

### Rejected

- **A (reuse `gate-failed`)** — corrupts the ledger's outcome semantics, contradicts the
  AC, and erases the very distinction E-054 exists to surface (a throw vs a clean gate).
- **C (`crashed`)** — wrong connotation and not the AC's spelling.

### Placement of the value

`errored` goes into the `RUN_OUTCOMES` tuple in `src/log/run-log.ts`. It is appended
**last** so the existing members keep their positions (cosmetic, but it keeps any
order-sensitive snapshot of the tuple stable for prior members). The doc comment gains
one clause: `errored ← a node's cast THREW (E-054); the runner wraps the throw into a
marked summary`.

---

## Decision 2 — the helper: signature, shape, home

### Options for the home

- **A. In `graph-core.ts`, exported.** ✅ CHOSEN — the ticket cites `graph-core.ts`; both
  runners live there and will reuse it (T-054-02); the pure-core unit test already
  imports `graph-core.ts`.
- B. In `chain-core.ts` (next to `decideThread`). Rejected: the throw-wrapping is a
  graph-runner concern; `chain-core` is the linear primitive and need not know about it.
- C. In `cast.ts` (next to `RunSummary`). Rejected: `cast.ts` is the IMPURE shell
  (it value-imports the executor seam); a test importing it would risk spawning. The
  helper must stay on the pure side.

### Options for the signature

- **S1. `erroredSummary(id: NodeId): RunSummary`.** ✅ CHOSEN
- S2. `erroredSummary(id: NodeId, error: unknown): RunSummary` — also take the throw and
  fold its message into the summary.
- S3. S2 **plus** a new `error?: string` field on `RunSummary` to carry the message.

### Rationale for S1

The helper's one job is to produce a **routing-correct, deterministic** summary: a
throw must "behave like every other non-success". The existing machinery already
handles the rest:

- `decideThread` refuses any `outcome !== "success"` — so an `errored` summary routes
  through the halt path with **no special-casing**, exactly the AC.
- The runner records the skip-reason andon from `decideThread`'s `reason`
  (`haltReasonOf.set(id, decision.reason)`) — the **same** path a `gate-failed` or
  `timed-out` summary takes. A `gate-failed` summary does not carry the gate's full text
  into the summary either; it carries the *outcome*, and the andon is the generic
  decideThread reason. Consistency argues the errored summary should be **symmetric**:
  carry the outcome, not the error text.

So the error object is **not needed** to satisfy the AC, and threading it in (S2/S3)
buys nothing the existing machinery uses — while S3 additionally mutates a core type
(`RunSummary`) for a narrow ticket, touching every construction site's mental model.
The error's *content* is genuinely the runner's concern (T-054-02 has the `catch (e)`
context and can log it), not the pure primitive's.

### The shape

```ts
export const NODE_ERRORED: RunOutcome = "errored";

export function erroredSummary(id: NodeId): RunSummary {
  return {
    runId: `errored:${id}`,  // deterministic, pure fn of input — T-054-03 equality holds
    outcome: "errored",
    materialized: false,     // a throw landed nothing
    // produced omitted ⇒ undefined  → decideThread refuses, dependents skip
    // actuals omitted ⇒ undefined   → wallet does not move on an unmeasured throw
  };
}
```

- `runId` is a pure function of `id` (no clock, no random) so the same throwing spec
  yields a byte-identical summary under both runners — the precondition T-054-03 leans
  on. `cast.ts` itself synthesizes run ids, so a synthesized one here is in-house idiom.
- `materialized: false`, `produced: undefined`, `actuals: undefined` are the truthful
  values for a cast that threw: nothing landed, nothing to thread, nothing measured.
  `actualsDelta` in `graph-core.ts` already treats an absent `actuals` as `{0,0}` (no
  phantom charge), so a budgeted wave debits nothing for a throw — correct.

### Rejected

- **S2** — takes a parameter the helper does not use to satisfy the AC; the error
  message is not propagated through the existing halt machinery, so threading it in is
  dead weight at this layer. (If a future ticket wants richer andons, that is a
  deliberate, separately-justified change.)
- **S3** — scope creep: changes the shared `RunSummary` contract across the engine for a
  value no consumer reads in this epic. Flagged as a possible future enhancement in
  Review, not done here.

---

## Why this is grounded in the research, not assumption

- The "no exhaustive switch breaks" claim is from an actual grep of `src/**` for
  `RunOutcome`/`: never`/`switch.*outcome` (Research §"What consumes RunOutcome").
- The "decideThread already refuses non-success" claim is the verbatim first branch of
  `decideThread` (Research §"The halt gate").
- The "`produced`/`actuals` optional, fakes supported" claim is `RunSummary`'s own doc
  comments (Research §"The cast-result shape").
- The purity constraint and the test-substrate shape are from Research §"The test
  substrate" — the helper must be reachable without importing the impure `cast.ts`.

## Net change surface (preview of Structure)

1. `src/log/run-log.ts` — append `"errored"` to `RUN_OUTCOMES`; one doc-comment clause.
2. `src/engine/graph-core.ts` — add `NODE_ERRORED` const + `erroredSummary(id)` helper,
   both exported, with a doc comment tying them to E-054.
3. `src/engine/graph-core.test.ts` — a new describe block: the helper yields
   `errored`/`produced: undefined`, and `decideThread` refuses it.
