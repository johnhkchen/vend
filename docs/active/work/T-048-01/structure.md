# T-048-01 Structure — file-level blueprint

The shape of the code (not the code). Per Design Decision 1, the wave algebra is split: `debitWave` extends
the wallet, `authorizeWave` extends the spend selector. Four files touched (two src, two test).

## Files modified

### 1. `src/budget/wallet.ts` — add `debitWave`

**Append after `debit` (after line 142), before `remaining`.** Reuses the file's existing private helpers
(`actualToBudget`) and the public `debit`; **no new exports of private helpers, no new imports** (`Usage`,
`Budget`, `countTokens` already imported; `DebitResult` already declared/exported).

Public surface added:
```ts
/**
 * Fold a CONCURRENT wave's settled actuals into the one wallet (E-048): tokens are SUMMED (every
 * branch's burn is real — detect-after, IA-8) but wall-clock is the MAX of the wave's actual times
 * (overlapping branches cost ~the longest, not their sum — summing would over-charge wall-clock). The
 * combined delta is debited via the single {@link debit} path, so the IA-8 floor + per-denomination
 * overshoot are computed exactly ONCE (the collective token overshoot, not per branch). A SINGLE-element
 * wave equals `debit(wallet, actual)` (max-of-one / sum-of-one), and an EMPTY wave is a no-op (delta
 * {0,0}). PURE / TOTAL.
 */
export function debitWave(wallet: Wallet, actuals: readonly (Usage | Budget)[]): DebitResult
```
Internal logic (no new helper needed — folds inline using `actualToBudget`):
- `let tokens = 0; let timeMs = 0;`
- `for (const a of actuals) { const d = actualToBudget(a); tokens += d.tokens; timeMs = Math.max(timeMs, d.timeMs); }`
- `return debit(wallet, { tokens, timeMs });`

Module-doc touch: extend the IA-8 header note (lines 13–20) with one line that the wave fold takes MAX
wall-clock / SUM tokens — keeping the file's documentation honest about both shapes.

### 2. `src/engine/spend-core.ts` — add `WaveAuthorization` + `authorizeWave`

**Append after `fitNext` (after line 102), before `shouldContinue`.** Reuses the existing `canAfford`
import (already imported at line 20) and the `Wallet` / `Budget` types. **No new imports.**

Public surface added:
```ts
/** The partition {@link authorizeWave} returns: the subset to dispatch CONCURRENTLY in this wave, and
 *  the rest hard-STOPPED at the wave boundary (the `fitNext` null-result generalized to a set — the
 *  wallet-exhausted stop at wave granularity). Generic over the candidate type `C`, like {@link fitNext}. */
export interface WaveAuthorization<C> {
  readonly dispatch: readonly C[];
  readonly stopped: readonly C[];
}

/**
 * GENERALIZE {@link fitNext} from picking ONE candidate to authorizing a whole READY-SET against one
 * shared wallet (E-048). Walks `readySet` IN THE GIVEN ORDER (already the topoSort declaration-order
 * tie-break — never re-sorted) and greedily dispatches each node that still fits:
 *   - wall-clock (MAX under concurrency): the node's predicted time ≤ remaining.timeMs — EACH-fits, no
 *     cumulative time (parallel branches don't sum wall-clock);
 *   - tokens (SUM): the running CUMULATIVE tokens incl. this node ≤ remaining.tokens — collective ceiling.
 * Expressed by affording the price against a per-node VIRTUAL wallet whose remaining tokens are depleted
 * by the cumulative-so-far (time left whole), reusing {@link canAfford}'s single `<=` / safe-refuse rule.
 * A node that does not fit goes to `stopped` and the walk CONTINUES (a later smaller node may still fit —
 * the `fitNext` skip-the-unaffordable-head behavior). PURE / TOTAL, generic over `C`.
 */
export function authorizeWave<C>(
  wallet: Wallet,
  readySet: readonly C[],
  priceOf: (c: C) => Budget,
): WaveAuthorization<C>
```
Internal logic:
- `const dispatch: C[] = []; const stopped: C[] = [];`
- `let cumulativeTokens = 0;`
- `const { funded, remaining } = wallet;`
- loop: `const price = priceOf(c);`
  `const virtual: Wallet = { funded, remaining: { tokens: remaining.tokens - cumulativeTokens, timeMs: remaining.timeMs } };`
  `if (canAfford(virtual, price)) { dispatch.push(c); cumulativeTokens += price.tokens; } else { stopped.push(c); }`
- `return { dispatch, stopped };`

## Files modified — tests

### 3. `src/budget/wallet.test.ts` — `describe("debitWave", …)`

Append a new `describe` block (after the existing `debit` blocks). Fabricated inputs only; reuses the
`macro` / `usage` builders already at the top. Cases (maps to AC):
- **all-fit, tokens SUM + time MAX:** wave `[macro(8_000, 30_000), macro(6_000, 20_000)]` on `fund(30_000,
  100_000)` → remaining `{ timeMs: 30_000 − 8_000 = 22_000, tokens: 100_000 − 50_000 = 50_000 }`; overshoot
  `{0,0}`. (Asserts time = funded − MAX(8k,6k), NOT funded − sum.)
- **single-element == debit (back-compat, Budget):** `debitWave(w, [a])` deep-equals `debit(w, a)` for a
  `macro(...)` actual.
- **single-element == debit (Usage):** same equivalence for a `usage({...})` actual (time untouched).
- **empty wave is a no-op:** `debitWave(w, [])` → wallet unchanged, overshoot `{0,0}`.
- **token overshoot surfaced ONCE:** wallet remaining `{ timeMs: 20_000, tokens: 5_000 }`, wave
  `[macro(1_000, 4_000), macro(1_000, 4_000)]` → tokens floor 0, overshoot.tokens = `8_000 − 5_000 = 3_000`
  (the collective overshoot, reported once), time remaining `20_000 − max(1k,1k) = 19_000`.
- **mixed Usage + Budget:** a `Budget` (with time) and a `Usage` (time 0) → tokens summed, time = the
  Budget's time (Usage contributes 0 to the max).

### 4. `src/engine/spend-core.test.ts` — `describe("authorizeWave", …)`

Append a new `describe` block (after `fitNext`). Reuses `fund` / `macro` / `priceTable` builders. Cases:
- **all-fit:** wallet `fund(60_000, 100_000)`, set `["A","B"]` priced `{A: macro(10_000, 20_000), B:
  macro(5_000, 10_000)}` → `dispatch = ["A","B"]`, `stopped = []`.
- **partial — token-stop (cumulative):** wallet `fund(60_000, 50_000)`, `["A","B"]` with `A: macro(10_000,
  40_000)`, `B: macro(10_000, 20_000)` → A fits (40k ≤ 50k), B overflows (40k+20k=60k > 50k) → `dispatch =
  ["A"], stopped = ["B"]`.
- **partial — time-stop (each-fits):** wallet `fund(10_000, 100_000)`, `A: macro(20_000, 10_000)` (time
  over), `B: macro(5_000, 10_000)` → `dispatch = ["B"], stopped = ["A"]` (time is each-fits, not
  cumulative; A stopped on time, B still dispatched — continue-after-stop).
- **continue-after-stop (non-monotone):** wallet `fund(60_000, 50_000)`, `["A","B","C"]`, `A: macro(10_000,
  30_000)` (fits, cum=30k), `B: macro(10_000, 40_000)` (30k+40k=70k > 50k → stopped), `C: macro(10_000,
  15_000)` (30k+15k=45k ≤ 50k → fits) → `dispatch = ["A","C"], stopped = ["B"]`.
- **none fit:** wallet `fund(5_000, 5_000)`, all prices over → `dispatch = [], stopped = [all]`.
- **empty ready-set:** `authorizeWave(w, [], priceTable({}))` → `{ dispatch: [], stopped: [] }`.
- **exact-fit boundary (`<=`):** cumulative tokens hitting remaining exactly still dispatches.

## Ordering of changes

1. `wallet.ts` `debitWave` → its tests (independent of spend-core).
2. `spend-core.ts` `authorizeWave` + `WaveAuthorization` → its tests.
3. `bun run check:typecheck` then `bun run check:test`.

No deletions. No interface changes to existing exports (`debit`, `fitNext`, `canAfford`, `DebitResult`,
`Wallet`, `Budget` all unchanged) — strictly additive, so the single-chain path is structurally untouched.
