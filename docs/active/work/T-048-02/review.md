# T-048-02 — Review: thread ONE shared wallet through castGraph's wave dispatcher

Handoff document. What changed, how it is proven, what a reviewer should scrutinize.

## What this ticket did

Wired T-048-01's pure wave-budget algebra (`authorizeWave` / `debitWave`) into the **concurrent wave
dispatcher** so a fan-out's parallel branches draw from **one shared wallet** with a correct hard stop
at the wave boundary — closing the cross-branch P7 leak the epic targets (two concurrent casts both
passing `canAfford` against the pre-wave balance and both spending). Plus a **deterministic worked
example** proving the shared wallet bounds spend where the old per-node budgets would have overspent.

## Files changed (4 source, 6 artifacts)

| File | Change |
|------|--------|
| `src/engine/graph-core.ts` | **Moved** `runGraphConcurrent` here from graph.ts and made it budget-aware (optional `ConcurrentBudget`); added `walletRemaining?: Budget` to `GraphResult`; added `actualsDelta` helper; rewrote the header to own both executors. Pure value-imports of `authorizeWave`/`debitWave`/`countTokens`. |
| `src/engine/graph.ts` | Shrank to a thin shell (262 → 121 lines): deleted the moved function, imports the dispatcher from graph-core.ts, added the opt-in `wallet?: Wallet` param to `castGraph` (builds `priceOf` from each `PlayNode.budget`). |
| `src/engine/graph-example.ts` | Added the budgeted fan-out worked example: `costedStub`, `budgetedFanoutExample`, `runSharedWalletFanout`, `runPerNodeFanout`. |
| `src/engine/graph-example.test.ts` | Added the AC#3 shared-vs-per-node describe block. |

`docs/active/work/T-048-02/{research,design,structure,plan,progress,review}.md` — the RDSPI artifacts.

## How the change works

`castGraph(nodes, edges, wallet?)`:
- **no wallet** → `runGraphConcurrent(spec)` — the legacy path, byte-for-byte its pre-E-048 self
  (every runnable node dispatched).
- **wallet** → builds `priceOf(id) = node.budget` and calls `runGraphConcurrent(spec, { wallet,
  priceOf })`.

In the budgeted dispatcher, per wave (after the upstream-halt cascade computes the runnable set):
1. `authorizeWave(wallet, runnable, priceOf)` → `{ dispatch, stopped }` (tokens cumulative-SUM,
   wall-clock each-fits-MAX — the IA-8 divergence, all in the pure primitive).
2. each `stopped` id → a clean `budget-stopped` `SkippedNode`, recorded in `haltReasonOf`, never cast,
   never `proceeded`, so its dependent subgraph cascade-skips (the runGraph halt semantics).
3. `Promise.all` over `dispatch` (the concurrent cast), settle via the reused `decideThread`.
4. `wallet = debitWave(wallet, dispatchedActuals).wallet` — the single immutable fold (tokens SUM,
   wall-clock MAX), threaded into the next wave.

Each wave authorizes against the **live, depleting** wallet, so the run converges to a clean stop once
nothing fits (`spendDown`'s wallet-exhausted, at wave granularity) while independent affordable work
still proceeds. `walletRemaining` carries the readout.

## Acceptance criteria

- [x] **`castGraph` threads ONE shared wallet** — authorize each ready-set, dispatch only the
  affordable subset, hard-stop + skip the rest, debit after settle, stop at the shared-wallet wall.
  (`runGraphConcurrent` budget path; `castGraph` opt-in `wallet`.)
- [x] **Single-chain / `spendDown` UNCHANGED** — a linear graph is single-node waves where
  `authorizeWave` == `fitNext` and `debitWave` == `debit` (T-048-01 equivalence, unit-tested).
  `spend.ts`, `wallet.ts`, `spend-core.ts` are **unmodified** (verified via `git status`); `vend work`
  untouched; the legacy no-wallet `castGraph` path unchanged.
- [x] **Deterministic worked example** (stub nodes, no live cast) — `graph-example.test.ts` AC#3:
  shared wallet stops branch C at the wave boundary (`walletRemaining` 10k/10k; spent 80k tokens /
  50k ms ≤ the 90k/60k envelope; clean success-but-halted), which the per-node legacy path would
  overspend (120k tokens > 90k). Total debited == bounded envelope (tokens summed, wall-clock max).
- [x] **`bun run check:*` green** — 1150 pass, 0 fail; typecheck clean.

## Test coverage

- **New (this ticket):** the budgeted dispatcher's *integration* — 3 worked-example tests driving the
  REAL `runGraphConcurrent` with costed stubs (no spawn, no model): the shared-wallet hard stop +
  bounded debit, the per-node overspend contrast, and the side-by-side bound-vs-breach.
- **Inherited (T-048-01):** `authorizeWave` partition + `debitWave` fold arithmetic are unit-tested in
  spend-core.test.ts (8 cases) and wallet.test.ts (8 cases); not re-proven here.
- **Gap — no live metered proof.** Out of scope by ticket ("no live model"); a budgeted live re-cast
  of E-047's diamond is an explicit downstream pull. The deterministic example proves the arithmetic;
  the concurrent SPAWNING path (`castGraph` → `castPlay`) is still only proven live by E-047's
  no-wallet cast — the wallet-threaded spawn path has no live exercise yet.

## Open concerns / notes for a reviewer

1. **graph-core.ts now hosts a concurrent executor.** Its identity widened from "sequential reference"
   to "both executors, pure-given-injected-casts." The `Promise.all` adds concurrency, not impurity
   (it awaits injected thunks; spawns nothing) — but a reviewer who relied on "graph-core = strictly
   sequential" should note the header rewrite. No new impure imports; `bun test` still imports it
   freely (and now exercises the concurrent twin).
2. **`walletRemaining` is the surfaced overshoot's only readout.** `debitWave` also returns a
   per-denomination `overshoot`; the dispatcher currently keeps only the resulting wallet, not the
   overshoot. If a caller needs to see the IA-8 detect-after token overshoot from the final wave, that
   would be a small additive field — deliberately omitted to keep `GraphResult` minimal for this slice.
3. **Per-wave (not global) stop.** A budget stop does not abort the whole run — later independent waves
   still authorize against the (now smaller) wallet. This is intentional (faithful to `spendDown`) and
   keeps total spend bounded, but means a graph with cheap independent leaves can keep running after a
   different branch hard-stopped. Documented in design.md Q4.
4. **`priceOf` totality.** A dispatched id is always a declared node, so `budgetById` always hits; the
   `{0,0}` fallback is dead-but-total. A zero-priced node would `canAfford` an empty wallet (`<=`) —
   harmless, matches `canAfford` semantics.

## Verdict

Implementation complete, all four ACs satisfied, gate green, back-compat verified. Ready for review.
