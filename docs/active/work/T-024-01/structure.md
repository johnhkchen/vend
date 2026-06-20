# T-024-01 Structure — depleting-wallet

The shape of the code. File-level changes, public interface, internal organization,
ordering. Not the code itself.

## Files

| File | Action | Why |
|------|--------|-----|
| `src/budget/wallet.ts` | **create** | The pure depleting-wallet module (D1). |
| `src/budget/wallet.test.ts` | **create** | The unit-test gate (mirrors `budget.test.ts`). |

No other files change. T-024-01 is leaf: nothing imports the wallet yet (T-024-02/03
do). No edits to `budget.ts`, `recalibrate.ts`, `cast.ts`, or `cli.ts`.

## `src/budget/wallet.ts` — public interface

Ordering top→bottom (mirrors budget.ts: header comment → types → constants → helpers →
exported functions):

### Module header comment
States: macro-wallet foundation (E-024 P7); PURE (no fs/clock/network/process, does not
import the seam); reuses `Budget`/`Usage`/`countTokens` from budget.ts and does NOT
duplicate them; the **one deliberate divergence** — `allocate` guards positive-int (a
fund of 0 is a caller error) but debited `remaining` floors at 0 (a spent wallet is
legitimately 0), so the wallet uses a local non-negative floor distinct from budget's
`assertPositiveInt`. Names IA-8 as the constraint (two denominations, tokens
detect-after / wall-clock hard wall).

### Imports
```ts
import { type Budget, type Usage, countTokens } from "./budget.ts";
```
Types erased; `countTokens` is the pure value import (one source of truth for token
counting).

### Types (exported)
```ts
export interface Wallet {
  readonly funded: Budget;     // macro allocation, set once by allocate
  readonly remaining: Budget;  // live depleting balance, floors at 0 per denomination
}

export interface DebitResult {
  readonly wallet: Wallet;     // remaining after the debit, floored at 0 both denoms
  readonly overshoot: Budget;  // amount actual exceeded remaining, per denom (0 if fit)
}
```

### Internal helpers (not exported)
- `assertPositiveInt(n: number, label: string): void` — **local copy** of budget's guard
  (positive finite integer; throws `RangeError`). Local rather than imported because
  budget does not export it; keeps the wallet self-contained. Used only by `allocate`.
- `floorNonNeg(n: number): number` → `Math.max(0, n)` — the debited-remaining coercion
  (0 allowed; the deliberate divergence from `assertPositiveInt`). Applied per
  denomination after subtraction.
- `overBy(actual: number, remaining: number): number` → `Math.max(0, actual - remaining)`
  — the per-denomination overshoot.
- `actualToBudget(actual: Usage | Budget): { tokens: number; timeMs: number }` —
  normalizes the debit input: if `"timeMs" in actual` treat as `Budget`
  (`{ tokens: actual.tokens, timeMs: actual.timeMs }`); else treat as `Usage`
  (`{ tokens: countTokens(actual), timeMs: 0 }` — Usage has no time, so 0 debit on
  time). Returns a plain delta both denominations.

### Exported functions
```ts
export function allocate(macro: Budget): Wallet
```
Validates `macro.timeMs` and `macro.tokens` via local `assertPositiveInt`; returns
`{ funded: macro, remaining: macro }`. (Reuses the same frozen `Budget` for both — both
are `readonly`, never mutated.)

```ts
export function canAfford(wallet: Wallet, predicted: Budget): boolean
```
`predicted.tokens <= wallet.remaining.tokens && predicted.timeMs <= wallet.remaining.timeMs`.
Honest per denomination; `<=` (exact fit affords). No validation of `predicted` beyond
the comparison — a non-finite predicted naturally fails the `<=` (returns false), which
is the safe direction (refuse). Document that.

```ts
export function debit(wallet: Wallet, actual: Usage | Budget): DebitResult
```
1. `delta = actualToBudget(actual)`.
2. Per denomination: `newRemaining = floorNonNeg(remaining − delta)`;
   `over = overBy(delta, remaining)`.
3. Return `{ wallet: { funded, remaining: { tokens, timeMs } }, overshoot: { tokens, timeMs } }`.
`funded` carried through unchanged (immutable). Input `wallet` never mutated.

```ts
export function remaining(wallet: Wallet): Budget
```
Returns `wallet.remaining` (stable accessor; callers do not reach into the struct).

```ts
export function formatWallet(wallet: Wallet): string
```
One line, **both denominations**, never one bar (IA-8). Per denomination shows
spent / funded and remaining. Internal format helpers:
- `fmtTokens(n)` → k-suffixed when ≥ 1000 (e.g. `60k`, `999`, `1.2k`) — mirror any
  existing token formatting if present in `src/present/`; otherwise a small local helper.
- `fmtMs(n)` → human duration (`30m`, `18m`, `45s`) — small local helper.
Composition example (final glyphs/spacing finalized in Implement):
`◇ 40k/100k · 60k left   ⏱ 12m/30m · 18m left`. Spent = `funded − remaining` per denom.

## Internal organization & invariants

- **Immutability**: no function mutates its `Wallet` argument; `debit` builds fresh
  `Budget` objects for `remaining` and `overshoot`. `funded` is shared by reference
  (safe — `readonly`).
- **Two denominations never conflated**: every denomination computed independently;
  `formatWallet` and `overshoot` keep them separate. No code path sums tokens + ms.
- **Floor invariant**: after any `debit`, `remaining.tokens ≥ 0` and
  `remaining.timeMs ≥ 0`. Exactly one of `{remaining_d == 0, overshoot_d == 0}` need not
  hold — but `remaining_d > 0 ⟹ overshoot_d == 0` and `overshoot_d > 0 ⟹ remaining_d == 0`
  per denomination (you can't both have leftover and overshoot on the same denom).
- **Monotonic depletion**: a sequence of non-negative debits never increases remaining on
  either denomination.

## `src/budget/wallet.test.ts` — test map

Mirror `budget.test.ts`: `import { describe, expect, test } from "bun:test";`, a fixture
builder `const macro = (timeMs, tokens): Budget => ({ timeMs, tokens })`, fabricated
inputs only (no spawn/fs/clock). One `describe` per function; every branch covered.

- **`allocate`**: funds remaining == funded; `test.each([0,-1,NaN,1.5])` throws
  `RangeError` for invalid timeMs and for invalid tokens.
- **`canAfford`**: fresh wallet affords a fitting cast (both denoms under); refuses
  over-tokens; refuses over-time; **the fits-on-tokens-not-time case** (tokens fit, time
  doesn't → false) and its mirror (time fits, tokens don't → false); exact-fit affords
  (`<=` boundary, both denoms equal remaining → true).
- **`debit` — fitting**: `Budget` actual under remaining depletes both denoms by the
  exact amount; overshoot `{0,0}`; input wallet unchanged (immutability assertion).
- **`debit` — Usage path**: a `Usage` four-field actual debits tokens by
  `countTokens(usage)`, leaves timeMs untouched, overshoot tokens 0.
- **`debit` — token overshoot (the load-bearing IA-8 case)**: actual tokens > remaining
  → remaining tokens floors to 0, `overshoot.tokens` == the overrun; time denom
  independent.
- **`debit` — time overshoot**: actual timeMs > remaining → remaining timeMs floors to 0,
  `overshoot.timeMs` == overrun (defensive symmetry).
- **`debit` — sequence depletes monotonically to zero**: apply several debits; assert
  remaining decreases monotonically and reaches exactly 0; a final over-debit floors and
  reports overshoot.
- **`remaining`**: equals the live balance after each step (truthful).
- **`formatWallet`**: truthful at fresh / mid-depletion / depleted; shows BOTH
  denominations (assert both glyphs/numbers present); never one bar (assert it isn't a
  single combined figure). Spent reads `funded − remaining`.

## Ordering of changes

1. `wallet.ts` types + `allocate` + `remaining` (the skeleton).
2. `canAfford`.
3. `debit` + `DebitResult` + helpers (`actualToBudget`, `floorNonNeg`, `overBy`).
4. `formatWallet` + format helpers.
5. `wallet.test.ts` alongside, growing per function (can be written test-first per step).
6. `bun run check` green.

Steps 1–4 are independently typecheckable; tests can be authored test-first or
immediately after each function. The whole ticket is one commit-sized unit (one pure
module + its test).
