# T-024-01 Plan — depleting-wallet

Ordered, independently-verifiable steps. Testing strategy and verification criteria.
The whole ticket is one pure module + its test — small enough for a single commit, but
sequenced so each step typechecks before the next.

## Testing strategy

- **Unit tests only** (`src/budget/wallet.test.ts`, `bun:test`). The module is pure —
  no integration or manual test needed (no I/O, no seam, no clock). This mirrors
  `budget.test.ts`, which is itself the gate for `check:test`.
- **Fabricated inputs only**: every fixture is a hand-built `Budget`/`Usage`. No spawn,
  no fs, no clock — same rule the budget/recalibrate tests state.
- **Branch coverage is the bar**: every exported function and every branch
  (fit/over/floor, Budget-vs-Usage narrow, each denomination's over case) has a test.
  The file is the gate; an uncovered branch is a gap to close before Review.
- **Verification gate**: `bun run check` (= `baml:gen` + `check:typecheck` +
  `check:test`) green. Plus `check:committed` / `check:head` at commit time.

## Steps

### Step 1 — Skeleton: types, `allocate`, `remaining`
- Create `src/budget/wallet.ts` with the module header comment (purity contract; the
  `assertPositiveInt`-vs-floor divergence; IA-8), the type-only `Budget`/`Usage` import
  plus `countTokens`, the `Wallet` and `DebitResult` interfaces, the local
  `assertPositiveInt` helper, `allocate`, and `remaining`.
- **Verify**: `bun run check:typecheck` green.
- *Independently verifiable*: yes (compiles standalone).

### Step 2 — Tests for Step 1
- Create `src/budget/wallet.test.ts` with the fixture builder and `describe("allocate")`
  (funds remaining == funded; `test.each([0,-1,NaN,1.5])` RangeError on timeMs and on
  tokens) + `describe("remaining")` (returns the live balance).
- **Verify**: `bun test src/budget/wallet.test.ts` green.

### Step 3 — `canAfford`
- Add `canAfford(wallet, predicted): boolean` (both-denomination `<=`).
- Add `describe("canAfford")`: affords fitting; refuses over-tokens; refuses over-time;
  **fits-on-tokens-not-time → false** and the mirror; exact-fit (both denoms ==) → true.
- **Verify**: typecheck + the new describe green.

### Step 4 — `debit` + helpers + `DebitResult`
- Add `floorNonNeg`, `overBy`, `actualToBudget` helpers; implement `debit` returning
  `{ wallet, overshoot }`, flooring each denomination and reporting per-denomination
  overshoot. Carry `funded` through unchanged; never mutate the input.
- Add `describe("debit")`:
  - fitting `Budget` actual depletes both denoms; overshoot `{0,0}`; **input wallet
    object unchanged** (immutability assertion — compare to a snapshot).
  - `Usage` four-field actual debits tokens by `countTokens`, leaves timeMs untouched.
  - **token overshoot** (the IA-8 load-bearing case): remaining tokens floors to 0,
    `overshoot.tokens` == overrun, time denom independent.
  - time overshoot: remaining timeMs floors to 0, `overshoot.timeMs` == overrun.
  - **sequence depletes monotonically to 0**: several debits, assert monot2onic decrease,
    reach exactly 0, final over-debit floors + reports overshoot.
- **Verify**: typecheck + `debit` describe green.

### Step 5 — `formatWallet` + format helpers
- Add local `fmtTokens` (k-suffix ≥ 1000) and `fmtMs` (human duration) helpers and
  `formatWallet` rendering BOTH denominations as `spent/funded · remaining`, never one
  bar. (`spent = funded − remaining` per denom.)
- Add `describe("formatWallet")`: truthful at fresh / mid / depleted; **both
  denominations present** (assert both glyphs and both numbers appear); spent reads
  `funded − remaining`; not a single combined figure.
- **Verify**: typecheck + `formatWallet` describe green.

### Step 6 — Full gate + commit
- **Verify**: `bun run check` fully green (baml:gen, typecheck, all tests). Also confirm
  no lint/format drift (the repo's `check` chain; format matches budget.ts style).
- Commit: `feat(wallet): pure depleting macro-wallet core (T-024-01)` — `wallet.ts` +
  `wallet.test.ts`. One atomic commit (one pure module + its test).
- Update `progress.md` as steps complete.

## Acceptance-criteria → step/test traceability

| AC (ticket) | Covered by |
|-------------|-----------|
| Pure Wallet + allocate/canAfford/debit/remaining/formatWallet over both denoms | Steps 1,3,4,5 |
| Immutable (debit returns new wallet) | Step 4 (immutability assertion) |
| Floors at zero, token overshoot honestly surfaced (IA-8 detect-after) | Step 4 (token-overshoot test) |
| Wall-clock treated as a hard wall | Step 3 (canAfford refuses over-time) + Step 4 (time floor) |
| Fresh wallet affords fitting / refuses over-cost per denom | Step 3 |
| The fits-on-tokens-not-time case | Step 3 |
| Sequence of debits depletes monotonically to zero | Step 4 (sequence test) |
| Actual overshoots remaining tokens → floors + reports overshoot | Step 4 (token-overshoot test) |
| `remaining` + `formatWallet` truthful at each step | Steps 2,5 |
| `bun run check:*` green; no I/O in core | Step 6 + purity by construction |

## Risks / watch-items

- **Float in `fmtTokens` k-suffix**: rendering `1.2k` introduces a `toFixed` — keep it in
  the *format* path only; never in the algebra (dimensions stay integers). Tests assert
  on substring presence, not exact float formatting, to avoid brittleness.
- **`Usage | Budget` narrow**: `{ timeMs, tokens }` is a `Budget`; ensure a `Usage` that
  happens to be `{}` (all-absent) narrows to the Usage branch (no `timeMs` key) → debits
  0 tokens, 0 time. Add a test if the narrow is non-obvious.
- **`canAfford` with non-finite predicted** returns false (safe-refuse); note in a
  comment rather than throwing, since the loop should never feed it NaN but refusal is
  the correct fail-safe direction.
