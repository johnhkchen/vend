# T-049-02 — Research

**Ticket:** conditional-edges-in-concurrent-wave-dispatcher (story S-049-01, epic E-049 conditional-dag-edges)
**Phase scope:** the CONCURRENT `runGraphConcurrent` (the wave dispatcher) ONLY. T-049-01 already shipped
the predicate firing into the SEQUENTIAL `runGraph` and into the model (`DagEdge.when`). This ticket
mirrors that firing into the concurrent twin so a predicated spec yields a `GraphResult` whose cast-node
set, skipped ids+reasons, and produced map are identical under both executors — leaving the E-048
shared-wallet path and back-compat untouched.

## What already exists (the T-049-01 reference, descriptive)

### The model — `src/engine/dag-core.ts` (DONE, no change here)

- `EdgePredicate = (produced: string) => boolean` (line 63) and `DagEdge.when?: EdgePredicate`
  (line 77) are already in place. The edge payload a predicate reads is the upstream's `produced`
  string. `validateDag`/`topoSort` read only `from`/`to`, so a predicated spec validates `ok` and
  topo-sorts unchanged — the structural dependency `from→to` holds regardless of branch selection.
- **This ticket adds nothing to the model.** The `when` field is the shared contract both executors
  consume. The concurrent twin simply has not been taught to read it yet.

### The sequential reference — `runGraph` (`src/engine/graph-core.ts` 109–242)

The exact semantics this ticket must reproduce concurrently. T-049-01 changed `runGraph` so:

- `inEdges` is `Map<NodeId, DagEdge[]>` (line 138) — it carries the **whole edge** (so `when` is in
  scope), not just the from-id.
- The per-node loop classifies each in-edge into three states (lines 165–176): an edge **fires** iff
  its upstream `proceeded` AND (`when` absent OR `when(producedAll.get(from))` true); else it is
  **halted** (upstream did not proceed) or **not-taken** (proceeded but `when` rejected its produced).
- A node skips iff any in-edge did not fire (lines 182–196). **Halt precedence:** if any halted
  in-edge exists, the reason is the existing `skipped — dependent on halted upstream <causes>`; only
  when there is no halt and ≥1 not-taken does it get the new
  `skipped — branch not taken: upstream '<id>' produced a result this edge's predicate rejected`.
- A not-taken node is never added to `proceeded`, so its downstream closure cascade-skips through the
  **unchanged** halt machinery (reuse, not reinvention).
- The JOIN (lines 200–205) iterates `ins` and keys by `edge.from`.

These exact reason strings are the contract: the AC asks for `GraphResult` **equality** across the two
executors, so the concurrent reasons must be **byte-for-byte** the sequential ones.

### The concurrent twin — `runGraphConcurrent` (`src/engine/graph-core.ts` 291–460)

The wave dispatcher, **still on the pre-E-049 two-state model** (it was deliberately untouched by
T-049-01). Its shape:

- It keeps its **own separate** `inEdges` local — still `Map<NodeId, NodeId[]>` (line 317), pushing
  only `edge.from` (line 325). This is the single biggest divergence from `runGraph`: the predicate is
  **not in scope** here today.
- A **WAVE LOOP** (lines 344–428): each pass forms `wave` = remaining nodes whose every upstream is
  `decided` (line 345–347, reads `inEdges.get(id)` as from-ids). Then:
  - **SKIP** (lines 352–363): `toSkip` = wave nodes with any non-`proceeded` upstream; each is recorded
    with `skipped — dependent on halted upstream <causes>`, added to `decided`, removed from
    `remaining`. This is the two-state halt — **no not-taken notion yet.**
  - **AUTHORIZE** (lines 367–371): the runnable remainder (`wave \ skipSet`) is partitioned by
    `authorizeWave(wallet, runnable, priceOf)` into `dispatch` / `stopped` when a wallet is threaded
    (E-048); else `dispatch = runnable`.
  - **BUDGET STOP** (lines 375–387): each `stopped` node is a clean budget halt (recorded, never cast).
  - **RUN** (lines 391–403): `Promise.all` over `dispatch`; each builds its JOIN map from
    `inEdges.get(id)` as from-ids (lines 393–398).
  - **SETTLE** (lines 406–418): record summaries, run `decideThread`, populate `proceeded`/
    `producedAll`/`haltReasonOf`.
  - **DEBIT** (lines 422–427): `debitWave` folds the dispatched wave's actuals into the one wallet.
- After the loop: deterministic assembly in topo order, SINKS, `skipped.sort` to topo order (line 448),
  and the `GraphResult` (lines 451–459) — which carries `walletRemaining` **only** when a wallet was
  threaded.

### The timing invariant that makes this safe

A wave node is formed only once **every** upstream is `decided` (proceeded / halted-after-cast /
budget-stopped / skipped). So at wave-formation time, for each in-edge both `proceeded.has(edge.from)`
and `producedAll.get(edge.from)` are already final — exactly the state `runGraph` reads when it reaches
a node in topo order. **The predicate can therefore be evaluated at the same logical point**, against
the same settled `producedAll`, yielding the same classification. No new ordering is introduced.

### The E-048 shared-wallet seam (must stay untouched)

- `authorizeWave` (spend-core.ts) / `debitWave` (wallet.ts) are pure budget algebra; `allocate` funds a
  `Wallet`. The dispatcher authorizes `runnable` (already past the skip filter) and debits only
  `dispatch`. A not-taken node lands in `skipSet`, so it is **never** in `runnable`, **never**
  authorized, **never** debited — the wallet does not move on a branch that did not run. This is the
  desired composition: predicate firing happens strictly **before** the budget partition.

## The impure shell — `src/engine/graph.ts` `castGraph`

`castGraph` builds the `DagSpec` (injecting `adapt → castPlay`) and delegates to `runGraphConcurrent`,
passing `{wallet, priceOf}` when a wallet is supplied (lines 114–120). It passes `edges` straight
through — **including any `when` predicate** — so once `runGraphConcurrent` reads `when`, `castGraph`
needs **no change**: it is already predicate-transparent.

## Test landscape

- `src/engine/graph-core.test.ts` tests **only `runGraph`** (pure, no live model; imports just
  `graph-core.ts` + `dag-core.ts`). It already has the T-049-01 conditional-edge block (lines 211–293)
  with helpers `summary`, `recordingNode`, `neverNode`, `edge`, `spec`, and the `whenEq`/`whenNeq`
  predicate factories — all reusable here.
- `runGraphConcurrent` is currently exercised via `graph-example.test.ts` (the diamond + the
  shared-wallet fan-out from `graph-example.ts`, which uses `allocate`/`costedStub`). Those are the
  **E-046 concurrency + E-048 wallet tests** the AC says must stay green.
- To assert cross-executor equality in `graph-core.test.ts`, I must additionally import
  `runGraphConcurrent` (+ `GraphResult`) and `allocate` (+ `Budget`) — the file stays pure (the wallet
  algebra is pure; no spawn).

## Constraints & assumptions

- **Equality is the contract.** "Equal" per the AC = same cast-node key set, same skipped ids+reasons
  (+blockedBy), same produced map (NOT a full deep-equal — `walletRemaining` is present only on the
  budgeted concurrent path and absent on `runGraph`, by design).
- **Byte-identical reasons.** The not-taken and halt reason strings must match `runGraph`'s exactly.
- **Back-compat / wallet untouched.** A `when`-less edge classifies as fired (no `notTaken`), so every
  existing concurrency + wallet test must be byte-for-byte unchanged. Only the predicate path is new.
- **Determinism.** Both executors assemble in topo order; the new classification is a pure read over an
  already-deterministic `producedAll`, introducing no nondeterminism.
- **Purity/totality.** A throwing predicate is not caught (parity with `runGraph` and with injected
  casts); a defensive `producedAll.get(from) === undefined` guard keeps the one type-unprovable branch
  total (treat missing produced as not-firing rather than throw).
- **One local, separate from `runGraph`.** The two executors have independent `inEdges` locals
  (confirmed); changing the concurrent one cannot affect the sequential reference.
