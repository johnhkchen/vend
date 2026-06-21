# T-049-02 — Design

Goal: teach `runGraphConcurrent` the same predicate firing `runGraph` already has, so a predicated spec
produces an **identical** `GraphResult` (cast set, skipped ids+reasons, produced) under both executors —
with the E-048 shared-wallet path and the non-predicated (back-compat) path byte-for-byte unchanged.

## The core insight (from Research)

`runGraph` and `runGraphConcurrent` already share the same join/fan-out/halt semantics over the same
primitives (`proceeded`, `producedAll`, `haltReasonOf`, `decideThread`, `skipped`). T-049-01 refined
`runGraph`'s **in-edge classification** from two states (fired / halted) to three (fired / halted /
not-taken). This ticket applies the *same refinement* to the concurrent twin's wave-skip step. Because a
wave node is formed only when every upstream is `decided`, the predicate is evaluated against the same
settled `producedAll` the sequential runner reads — so the classification is logically identical, only
the *location* differs (the wave's skip filter vs. the sequential loop's halt check).

## Decision 1 — Mirror, don't abstract: keep the two executors as parallel twins

**Chosen:** port `runGraph`'s three-state classification into `runGraphConcurrent`'s skip step inline,
keeping the two executors as deliberate twins (the existing house pattern — they already duplicate the
inEdges/proceeded/producedAll/decideThread spine).

**Rejected — extract a shared `classifyInEdges(ins, proceeded, producedAll)` helper** used by both
runners. Tempting (one definition of "fired/halted/not-taken", guaranteed reason parity), but: (a) the
two call sites differ in shape — `runGraph` classifies one node mid-loop and `continue`s; the concurrent
one classifies a *whole wave* in a `filter` predicate and records in a follow-up loop — so a shared
helper would return a `{halted, notTaken}` struct that each site unpacks differently anyway; (b) the
epic's spine is "reuse the existing skip machinery," and the existing machinery here is *the twin
structure itself*; (c) a refactor touching `runGraph` risks the T-049-01 reference this ticket is
measured against. The reason **strings** are the contract; I pin them with a cross-executor equality
test (Decision 4), which is a stronger guarantee than a shared helper (it proves equality of *output*,
not just of *source*). A shared helper is a reasonable later cleanup once a third consumer appears.

## Decision 2 — `inEdges` carries the whole `DagEdge` (mirror runGraph exactly)

`runGraphConcurrent.inEdges` becomes `Map<NodeId, DagEdge[]>` (was `Map<NodeId, NodeId[]>`), pushing the
whole `edge` (was `edge.from`). `DagEdge` is already imported in graph-core.ts. Three downstream reads
change from `from` to `edge.from`:

- **wave-ready** (`.every((from) => decided.has(from))` → `.every((e) => decided.has(e.from))`);
- **skip classification** (the rewritten block — Decision 3);
- **JOIN map** (`.flatMap((from) => …)` → `.flatMap((e) => …)` keyed by `e.from`).

This is the minimal change that puts `when` in scope at the skip step, and it makes the concurrent
`inEdges` structurally identical to the sequential one (twin parity).

## Decision 3 — The wave-skip step gains the three-state classification + dual reason

Today (lines 352–363) the skip step is two-state:

```
toSkip   = wave.filter(id => ins(id).some(from => !proceeded.has(from)))   // any non-proceeded upstream
record each toSkip with `dependent on halted upstream <causes>`
```

It becomes three-state, computing both `halted` and `notTaken` per wave node, recording with **halt
precedence**, exactly as `runGraph`:

```
for each id in wave:
  halted   = []   // upstream not in proceeded
  notTaken = []   // upstream proceeded but this edge's `when` rejected its produced
  for each edge in ins(id):
    if !proceeded.has(edge.from):  halted.push(edge.from); continue
    if edge.when !== undefined:
      p = producedAll.get(edge.from)            // proceeded ⇒ present; undefined ⇒ not-firing (defensive)
      if p === undefined || !edge.when(p):  notTaken.push(edge.from)
  if halted.length || notTaken.length:  → SKIP
     blockedBy = [...halted, ...notTaken]
     reason = halted.length
        ? `skipped — dependent on halted upstream ${halted.map(haltCause).join(", ")}`     // UNCHANGED
        : `skipped — branch not taken: upstream ${notTaken.map(q).join(", ")} produced a result this edge's predicate rejected`
```

`haltCause(from)` is the existing `haltReasonOf.has(from) ? "'from' (reason)" : "'from' (upstream
skipped)"` mapping — lifted verbatim so the halt reason stays byte-identical. The not-taken reason is
copied verbatim from `runGraph`. Both strings are now produced by both executors.

**Structural note:** `runGraphConcurrent` computes `toSkip` in a `filter` then records in a separate
`for` loop (it needs `skipSet` to exclude skipped nodes from `runnable`). To avoid classifying twice, I
compute a `classified: Map<NodeId, {halted, notTaken}>` while filtering, then read it back in the record
loop. This keeps a single classification pass (no double predicate evaluation — predicates may be
user-supplied and should run once per edge per wave, matching `runGraph`'s once-per-node).

## Decision 4 — Predicate fires BEFORE the budget partition (E-048 untouched)

The classification runs in the **skip step**, which already precedes `authorizeWave`. So:

- a **not-taken** node lands in `skipSet` ⇒ excluded from `runnable` ⇒ never authorized, never
  dispatched, never debited. The wallet does not move on a branch that did not run — the correct
  composition, and it requires **zero change** to the budget code (authorize/debit see a `runnable` set
  that simply no longer contains not-taken nodes, exactly as it already excludes halted nodes).
- a **budget-stopped** node remains a budget halt; its downstream still cascade-skips via the halt path.
- **precedence interaction:** a node with both a halted and a not-taken in-edge gets the halt reason
  (Decision 3) and never reaches the budget step regardless — no new interaction to reason about.

This is why the AC's "branch-not-taken under a budgeted wallet" works for free: the predicate decides
membership in `runnable` *upstream* of the wallet; the wallet logic is unchanged.

## Decision 5 — Equality is asserted on facets, not deep-equal

`runGraph` never sets `walletRemaining`; `runGraphConcurrent` with a wallet always does. So a naive
`toEqual(graphResult)` would fail on that one field by design. The AC defines equality as **cast-node
set + skipped ids&reasons + produced map** (+ outcome/halted, which follow). The tests compare those
facets via a small `facets(result)` projection, run on both executors for the same predicated spec. For
the budgeted case, the facets still equal `runGraph`'s, **and** `walletRemaining` is additionally
asserted to show the wallet path engaged and did not overspend (only cast nodes debited; the not-taken
branch contributed nothing).

## Decision 6 — Nothing else changes

- `topoSort`/`validateDag`/`decideThread`/`authorizeWave`/`debitWave` — untouched (read no `when`).
- `runGraph` — untouched (the T-049-01 reference; this ticket only reads it as the oracle).
- `graph.ts castGraph` — untouched (already predicate-transparent; passes `edges` straight through).
- `GraphResult`/`SkippedNode` shapes — unchanged (the not-taken reason is a string, per T-049-01's
  deliberate "string contract, not a typed kind" decision; consistency with the sequential reference).

## Net change surface

- `graph-core.ts` `runGraphConcurrent` only: `inEdges` → `DagEdge[]`; three `from`→`edge.from` reads;
  the two-state skip step → three-state classification + dual reason with halt precedence. ~20 lines,
  localized, structurally mirroring the already-shipped `runGraph` change.
- `graph-core.test.ts`: a new `describe` block asserting cross-executor equality on a predicated
  fan-out, a multi-wave predicated branch with a cascade, and a branch-not-taken under a budgeted
  wallet; plus a back-compat (no-`when`) equality guard. New imports: `runGraphConcurrent`,
  `GraphResult`, `allocate`, `Budget`.
- **Untouched:** model, `runGraph`, `castGraph`, the budget algebra, every existing test.
