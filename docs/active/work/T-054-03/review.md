# T-054-03 Review — deterministic-dual-runner-throw-equivalence

_Handoff document. What changed, coverage, open concerns. Read this, not every diff._

## What this ticket delivered

The closing step of E-054: the FORMAL proof that a throwing-node spec yields an **identical
clean `GraphResult`** under both graph runners. With this, the dispatcher is provably TOTAL
over node behavior — success, non-success outcome, AND exception all route to the same
deterministic result in both the sequential `runGraph` and the concurrent
`runGraphConcurrent`. This is the last unbuilt graph primitive on the E-046 DAG substrate.

**Test-only.** No runtime behavior changed — the throw-containment shipped in T-054-02
(`f25d81c`) via `erroredSummary` + per-cast `try/catch` in both runners. This ticket proves
that behavior's cross-runner equivalence, determinism, and budget-neutrality.

Commit: `650e639` — `test(T-054-03): formal dual-runner throw-equivalence …`.

## Files changed (1 source-test + 5 work artifacts)

| File | Change |
|---|---|
| `src/engine/graph-core.test.ts` | Added one `describe` block (`dual-runner throw-equivalence … (T-054-03)`) — 4 tests across 2 nested describes. +~95 lines. No production source touched. |
| `docs/active/work/T-054-03/*.md` | research / design / structure / plan / progress / review. |

## The proof, in four tests

Spec shape (`mkSpec()`, fresh nodes per call): `A→{B(throws), C}`, `B→D` — a throwing node
(`B`), an INDEPENDENT sibling (`C`, depends only on `A`), and a cascade dependent (`D`, a
`neverNode` that throws if cast, so the skip is a hard assertion).

1. **Full-projection equivalence** — `expect(facets(con)).toEqual(facets(seq))`. The whole
   cross-executor projection (cast keyset / skipped / produced / outcome / halted) is
   byte-identical. `cast === ["A","B","C"]`.
2. **Per-facet, AC-named** — for BOTH runners in one loop: nodes (B `errored`, D absent, C
   present), skipped (D, reason contains `halted upstream` + `errored`, `blockedBy ⊇ B`),
   outcome (`errored`), halted (`true`), produced (`{C:"pc"}`).
3. **Determinism** — repeated `runGraph` runs are byte-equal; repeated `runGraphConcurrent`
   runs are byte-equal. This makes observable the load-bearing precondition: `erroredSummary`
   is a pure function of the node id (`runId: "errored:${id}"`), so there is nothing
   non-deterministic for the two runners to disagree on.
4. **Budgeted-wallet strengthening** — `runGraphConcurrent(spec, {wallet, priceOf})` over a
   costed throwing spec with a generously-funded 200k/100k wallet: facets still equal the
   sequential run, B is still `errored`, and `walletRemaining === {175_000, 89_000}` —
   i.e. funded − A − C. The throwing B debited NOTHING (its `actuals === undefined` ⇒ the
   E-048 `actualsDelta` contributes `{0,0}`), so a throw can never over-charge the wallet.

### Why the two runners agree (the mechanism, for the reviewer)

A thrown cast is caught at each runner's cast site and replaced by `erroredSummary(id)` —
`outcome: "errored"` (non-success), no `produced`, no `actuals`. `decideThread` refuses any
non-success on its FIRST branch, so the node never enters `proceeded`; its dependents
classify their in-edge to it as `halted` and cascade-skip via the EXISTING machinery.
Both runners assemble the result in TOPO ORDER (`topoSort`'s declaration-order tie-break),
so the concurrent settle order is invisible in the output. Same spec + same (pure) casts ⇒
identical `GraphResult`.

## Test coverage

- **graph-core suite:** **33 pass / 0 fail** (was 29; +4), 157 expect() calls. Pure
  stubs only — no live model, no spawn, no native addon (the chain-core.test.ts discipline).
- **Full gate** `bun run check` (baml:gen + `tsc --noEmit` + `bun test`): **1218 pass /
  0 fail** (was 1214; +4), typecheck clean, baml generated clean, pre-commit hook green.

### Coverage notes (intentional boundaries)

- **`walletRemaining` is excluded from `facets`** — by design, exactly as the E-049 block
  does. It is present only on the budgeted concurrent path, so a naive whole-object
  `toEqual` between a sequential and a budgeted run would fail spuriously. Test 4 asserts
  `walletRemaining` separately and explicitly.
- **Error message/stack is not asserted** — it is deliberately discarded at the catch site
  (T-054-02 open concern #1, inherited from T-054-01 Design Decision 2). The andon a human
  sees is `decideThread`'s reason threaded into the dependent's skip text — which this
  ticket asserts contains both `halted upstream` and `errored`. Richer diagnostics remain a
  separate, justified change at the impure shell (`graph.ts`), not here.
- **Overlap with T-054-02 test #4** — that test was an explicit *de-risk* owned by T-054-02;
  this block is the *formal* proof and additionally covers determinism, the per-facet AC
  mapping, and the budgeted path. The overlap is a few lines in a pure test file —
  acceptable, and the two have distinct owners/framings so neither silently weakens the other.

## Open concerns / notes for human attention

1. **None blocking.** This is an additive, pure test block over already-shipped behavior;
   rollback is deleting the block. No signature, shared-type, gate, or ledger-consumer change.
2. **E-054 is now closeable.** T-054-01 (the pure `errored` primitive), T-054-02 (both
   runners catch throws), and T-054-03 (formal dual-runner equivalence) together make the
   graph runner total over node behavior including exceptions. If the epic tracks a
   "graph cast always returns a clean GraphResult" done-criterion, this ticket is its
   evidence.
3. **The `errored` outcome is now exercised end-to-end in tests but not yet in a LIVE cast.**
   `erroredSummary` is emitted only by the pure runners; the impure `castGraph` shell
   (graph.ts) inherits the containment for free (it calls these runners), but no live-model
   test forces a real cast to throw. That is consistent with the whole graph-core test
   discipline (the live proof is the impure shell's, exercised when a real diamond is cast)
   and is not a gap in this ticket's AC.

## Risk assessment: VERY LOW

~95 lines of pure test, zero production source change. Proves an equivalence the runners
already satisfy; cannot regress runtime behavior. Full suite green (1218/0), typecheck and
baml clean, pre-commit hook passed.
