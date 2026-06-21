# T-049-02 — Review

**Ticket:** conditional-edges-in-concurrent-wave-dispatcher (S-049-01, E-049 conditional-dag-edges)
**Outcome:** complete. `runGraphConcurrent` (the wave dispatcher) now fires predicate edges identically
to the sequential `runGraph`: for the same predicated spec, the `GraphResult`'s cast-node set, skipped
ids+reasons, and produced map are byte-for-byte equal under both executors — including a multi-wave
branch and a branch-not-taken under a budgeted shared wallet. The E-048 wallet path and the
non-predicated (back-compat) path are unchanged. Build + full suite green. No commit (Lisa drives phase
transitions).

## What changed

| File | Change |
|---|---|
| `src/engine/graph-core.ts` | `runGraphConcurrent` ONLY: `inEdges` now `Map<NodeId, DagEdge[]>` (carries the edge so `when` is in scope); wave-ready + JOIN read `e.from`; the two-state wave-skip became a three-state in-edge classification (halted / not-taken / fired) memoized in `classified`, with the dual reason + halt precedence — reason strings copied verbatim from `runGraph`. |
| `src/engine/graph-core.test.ts` | +imports (`runGraphConcurrent`, `GraphResult`, `allocate`, `Budget`); +`facets` projection and `costed` stub; +4-case `describe` block asserting cross-executor equality. |
| `docs/active/work/T-049-02/*` | RDSPI artifacts. |

**No model change** — `DagEdge.when` shipped with T-049-01. **No `runGraph` change** — it is the
reference oracle this ticket is measured against. **No `castGraph`/`graph.ts` change** — it already
passes `edges` (incl. `when`) straight through, so it is predicate-transparent once the dispatcher reads
`when`.

`docs/active/tickets/T-049-01.md` and the T-049-01 source/docs appear in the working tree from the prior
ticket — not touched by this work.

## How it works

A wave node is formed only once **every** upstream is `decided` (proceeded / halted / budget-stopped /
skipped), so `proceeded` and `producedAll` are already final for each of its in-edges — exactly the
settled state `runGraph` reads when it reaches a node in topo order. The wave-skip step now classifies
each in-edge the same way `runGraph` does:

- **fired** — upstream proceeded AND (`when` absent OR `when(produced)` true);
- **halted** — upstream did not proceed → existing reason `skipped — dependent on halted upstream …`;
- **not-taken** — upstream proceeded but `when` rejected its produced → `skipped — branch not taken:
  upstream '<id>' produced a result this edge's predicate rejected`.

Halt takes precedence when both are present. A not-taken node lands in `skipSet`, so it is excluded from
`runnable` **before** the budget partition — never authorized, never dispatched, never debited. Its
downstream cascade-skips through the unchanged halt machinery (a skipped node never enters `proceeded`).
A `when`-less edge can never be not-taken, so the classification reduces to the old two-state set and
every pre-E-049 path is bit-for-bit preserved.

## Acceptance criteria — verification

Single AC, clause by clause (all in `graph-core.test.ts` → "runGraphConcurrent — conditional edges
mirror runGraph"):

- ✅ *runGraphConcurrent returns a GraphResult equal to runGraph's for the same predicated spec — same
  cast node set, same skipped ids+reasons, same produced map* — asserted via `facets(con)` `toEqual`
  `facets(seq)` in cases 1–4 (`facets` = cast keys, skipped {id,reason,blockedBy}, produced, outcome,
  halted).
- ✅ *including a multi-wave branch* — case 2: waves {1}→{A,B}→{C,D}, B not-taken in wave 2, D
  cascade-skips in wave 3; facets equal.
- ✅ *and a branch-not-taken under a budgeted wallet* — case 3: costed nodes + an `allocate`d shared
  wallet; facets equal the sequential run; `walletRemaining` reflects only the cast nodes' debit (the
  not-taken B never charged).
- ✅ *all existing E-046/E-048 concurrency + wallet tests still green* — full suite **1159 pass / 0
  fail** (T-049-01 baseline 1155; +4 new). `graph-example.test.ts` (the live wallet/concurrency proof)
  unchanged and green. `bun run build` clean.

## Test coverage & gaps

- **Covered:** cross-executor equality on the predicated fan-out, a multi-wave predicated branch with a
  cascade below the not-taken node, branch-not-taken composed with the budgeted wallet (incl. the wallet
  not moving on the un-dispatched branch), and a non-predicated diamond (back-compat). Oracle-based: the
  central assertion is *equality to `runGraph`*, so the test cannot drift from the reference semantics.
- **Pure-function test** — imports only `graph-core.ts` + `dag-core.ts` + the pure wallet/budget
  algebra; no live model, no spawn, no addon (house discipline).
- **Deliberately deferred (other tickets, not gaps here):** the end-to-end predicate through the impure
  `castGraph` shell → **T-049-03**.
- **Untested edge cases (low risk, parity with T-049-01, not in AC):**
  - A wave node with BOTH a halted and a not-taken in-edge → halt wins the reason (mirrors `runGraph`'s
    precedence; covered structurally by case 2's cascade but not as an isolated both-kinds-on-one-node
    assertion).
  - A predicated branch that is *also* budget-stopped in the same wave — the skip classification runs
    before `authorizeWave`, so a not-taken node never reaches the budget step; the inverse (a node that
    fires its predicate but is then budget-stopped) is the existing E-048 behavior, unchanged.

## Open concerns / notes for the reviewer

1. **Twin duplication is intentional.** The three-state classification now exists in BOTH `runGraph` and
   `runGraphConcurrent`. I kept them as parallel twins (the existing house pattern — they already
   duplicate the inEdges/proceeded/decideThread spine) rather than extracting a shared helper, because
   the two call sites differ in shape (sequential `continue` vs. wave `filter` + record loop) and a
   refactor would touch the T-049-01 reference. The reason **strings** are the contract; cross-executor
   equality tests pin them (a stronger guarantee than shared source). A shared `classifyInEdges` helper
   is a reasonable later cleanup once a third consumer appears.
2. **Reason strings are the cross-executor contract — keep them stable.** Both runners now emit the same
   not-taken/halt strings; the equality tests fail loudly if either drifts. T-049-03 (the `castGraph`
   worked example) will assert against these too.
3. **Predicate throws are not caught** — parity with `runGraph` and with injected casts (a throw
   propagates; totality is about the pure logic given well-behaved thunks). Unchanged stance from
   T-049-01.
4. **No commit** — the change sits in the working tree (one coherent, independently-green unit:
   `runGraphConcurrent` firing + its cross-executor tests); Lisa handles the phase transition and the
   sweep/commit per house convention.
