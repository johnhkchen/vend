# T-048-01 Design — wave-budget pure core

Explore options, decide with rationale, grounded in Research. Two pure functions:
`authorizeWave` (the `fitNext` generalization to a SET) and `debitWave` (the `debit` generalization to a
concurrent wave).

## Decision 1 — Placement: where do the two functions live?

The functions reuse private wallet internals. The placement options:

| Option | `authorizeWave` | `debitWave` | Cost |
|--------|-----------------|-------------|------|
| **(A) single new `src/engine/wave-budget.ts`** | here | here | `debitWave` needs `floorNonNeg`/`overBy`/`actualToBudget` — all **private** to wallet.ts → must export them (widen wallet's surface) OR re-implement the floor/overshoot/normalize math (duplicate the IA-8 algebra — a meter-lies risk). |
| **(B) split: `authorizeWave` → spend-core.ts; `debitWave` → wallet.ts** | beside `fitNext` (its base) | beside `debit` (its base) | **zero new exports**; each generalization sits next to the function it generalizes; reuses every private helper in-file. |

**Chosen: (B) split.** Rationale grounded in Research:
- `debitWave` IS a wallet operation — it folds settled actuals into the one wallet and reuses the IA-8
  floor/overshoot machinery (`floorNonNeg`, `overBy`, `actualToBudget`, and the public `debit`). The house
  pattern is **"the algebra lives with its denomination"**: wallet.ts owns debit math, spend-core.ts owns
  selection. The ticket explicitly permits "or extend the wallet."
- `authorizeWave` IS the `fitNext` generalization — a *selector* over a candidate set, generic over `C`,
  reusing `canAfford`. It belongs beside `fitNext` in spend-core.ts, sharing its imports (`canAfford`,
  `Wallet`, `Budget`) and its purity header.
- **Rejected (A):** a single `wave-budget.ts` reads tidy conceptually, but forces a lose-lose: either widen
  wallet.ts to export three helpers that exist precisely to keep the IA-8 math *encapsulated* (the meter
  must not lie ⇒ one place computes floor/overshoot), or re-implement that math in a second file (drift
  risk). The cohesion win of one file does not pay for puncturing the wallet's encapsulation. The wave
  algebra being two functions in two files is fine — `spend-core.test.ts` already imports from both wallet
  and spend-core.

## Decision 2 — `debitWave`: fold-then-delegate, not re-implement

`debitWave(wallet, actuals)` must SUM tokens and take the MAX wall-clock across a concurrent wave, floor at
0, surface per-denomination overshoot **once**, and a **single-element wave must equal `debit`**.

**Options for the debit math:**
- (i) Re-implement: loop actuals, manually floor/overshoot per denomination. → duplicates `debit`; two
  places compute the IA-8 floor/overshoot; single==debit becomes an *assertion we hope holds*.
- (ii) **Fold actuals into ONE combined `Budget` (tokens summed, timeMs maxed), then call the public
  `debit`.** → the combine is the *only* new math; `debit` does the floor/overshoot exactly once.

**Chosen: (ii) fold-then-delegate.** This makes the back-compat property **structural, not coincidental**:
- combine = `{ tokens: Σ actualTokens, timeMs: max actualTimes }` via the in-file `actualToBudget`
  (handles `Usage` → `countTokens` tokens + `timeMs: 0`, and `Budget` → both directly).
- `debitWave(w, [a]) === debit(w, a)` for ANY single actual (Usage or Budget): the fold of one =
  `actualToBudget(a)` exactly, and `debit` does the same normalization internally. **Single == debit falls
  out for free** — no special-casing.
- Empty wave → combine = `{ tokens: 0, timeMs: 0 }` → `debit(w, {0,0})` = no-op, overshoot `{0,0}`. The
  empty case needs no branch.
- Overshoot surfaced **once**: `debit` computes `overBy(combinedTokens, remaining.tokens)` on the *summed*
  delta — the collective overshoot, reported a single time, never per branch.

**Why MAX for wall-clock is correct (the epic's heart):** concurrent branches overlap, so the wave's
elapsed ≈ the longest branch, not the sum. Summing time (what plain sequential `debit` would do across the
set) would **over-charge** the wall-clock envelope — the exact bug E-048 names. `Usage` actuals contribute
`timeMs: 0`, which `Math.max` harmlessly ignores (a Usage has no time), so a mixed wave maxes only the real
times.

Signature: `debitWave(wallet: Wallet, actuals: readonly (Usage | Budget)[]): DebitResult` — mirrors
`debit`'s `Usage | Budget` input and reuses `DebitResult`.

## Decision 3 — `authorizeWave`: greedy walk with a virtual-remaining wallet

`authorizeWave<C>(wallet, readySet, priceOf): { dispatch, stopped }` — greedily fit the ordered ready-set
into the shared wallet, partitioning into the concurrently-dispatchable subset and the hard-stopped rest.

**The divergent affordability rule (from Research):**
- **wall-clock (MAX):** each node independently must fit `remaining.timeMs` — parallel branches don't sum
  time, so there is no cumulative time. Each-fits.
- **tokens (SUM):** a node fits only if `cumulativeTokens(incl. this node) <= remaining.tokens` — the
  collective sum is the ceiling.

**Options for expressing the per-node check:**
- (i) Inline two comparisons (`price.timeMs <= rem.timeMs && cumTokens + price.tokens <= rem.tokens`). →
  re-derives `canAfford`'s `<=` boundary + non-finite safe-refuse in a second place.
- (ii) **Build a per-node "virtual wallet"** whose `remaining = { tokens: rem.tokens - cumulativeTokens,
  timeMs: rem.timeMs }` and reuse `canAfford(virtual, price)`. → time uses full remaining (each-fits/MAX);
  tokens use remaining-minus-cumulative (sum); `canAfford` keeps the single `<=` boundary and the safe-
  refuse-on-non-finite in **one** place.

**Chosen: (ii) virtual-remaining + `canAfford`.** It reuses the one affordability definition (Research
constraint 6) and makes the MAX/SUM divergence explicit in the construction of `remaining`: time stays
whole (max), tokens deplete by cumulative (sum).

**Greedy continue-after-stop (not stop-all):** a node that doesn't fit goes to `stopped`, but the walk
**continues** — a later *smaller* node that still fits cumulatively is dispatched. This is the faithful
generalization of `fitNext`, which documents "SKIPS an unaffordable head to reach an affordable tail
(spend the wallet down)." It maximizes wallet utilization and never overspends (a stopped node never adds
to `cumulativeTokens`). The ticket's "head fits, a later node's tokens overflow → head dispatched, tail
stopped" is the common monotone case; continue-after-stop also handles the non-monotone case correctly.
- **Rejected stop-all-after-first-miss:** simpler, but strands a small affordable tail behind one large
  node — a regression against `fitNext`'s explicit skip semantics, leaving the wallet under-spent.

**Order:** walk `readySet` in the given order (already topo/declaration order from the caller's wave). Do
**not** re-sort — determinism is the caller's `topoSort` (Research constraint 5). `priceOf(c)` cached once
per node (it may be non-trivial; called for both the check and the cumulative add).

**Return type:** `WaveAuthorization<C> { readonly dispatch: readonly C[]; readonly stopped: readonly C[] }`
in spend-core.ts, generic over `C` like `fitNext`.

## Decision 4 — totality & edge behavior

- Empty ready-set → `{ dispatch: [], stopped: [] }` (loop body never runs). Total.
- A wallet with `remaining.tokens = 0` → every positive-token node stopped; a zero-token (but time-fitting)
  node would dispatch (`0 <= 0`), consistent with `canAfford`'s `<=`.
- Non-finite predicted price → `canAfford` returns `false` → node stopped (safe-refuse inherited).
- `debitWave` on already-empty wallet → floors stay 0, overshoot = full actual (inherited from `debit`).

## What is explicitly NOT in this ticket

Threading the shared wallet into `castGraph`, the wave-boundary hard stop, skipping stopped nodes'
subgraphs, and the deterministic worked example are **T-048-02**. `spendDown` and the linear path are
untouched. No live model, no seam, no fs/clock.

## Summary of the shape

```
src/budget/wallet.ts      + debitWave(wallet, actuals)      // fold (Σ tokens, max time) → debit
src/engine/spend-core.ts  + authorizeWave(wallet, set, priceOf) + WaveAuthorization<C>  // greedy via canAfford
```
Both pure, total, generic where `fitNext`/`debit` are; zero new exports from wallet's private helpers.
