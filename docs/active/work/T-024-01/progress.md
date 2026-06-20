# T-024-01 Progress — depleting-wallet

## Status: Implementation complete, all gates green

## Completed (vs plan)

- **Step 1 — skeleton** ✅ `src/budget/wallet.ts` created: module header (purity
  contract, IA-8, the `assertPositiveInt`-vs-floor divergence), type-only `Budget`/`Usage`
  import + `countTokens` value import, `Wallet` + `DebitResult` interfaces, local
  `assertPositiveInt`, `allocate`, `remaining`.
- **Step 2 — allocate/remaining tests** ✅ in `src/budget/wallet.test.ts`.
- **Step 3 — `canAfford`** ✅ both-denomination `<=`; tests cover fitting, over-tokens,
  over-time, **fits-on-tokens-not-time** + mirror, exact-fit boundary, depleted wallet.
- **Step 4 — `debit` + helpers** ✅ `floorNonNeg`, `overBy`, `actualToBudget`; flooring +
  per-denomination overshoot; tests cover fitting Budget, Usage path, all-absent Usage,
  **token overshoot (IA-8)**, time overshoot, immutability, monotonic-to-zero sequence.
- **Step 5 — `formatWallet`** ✅ `fmtTokens` (k-suffix) + `fmtMs` (human span); both
  denominations, `spent/funded · remaining left`, never one bar; tests cover fresh / mid /
  depleted / two-distinct-bars.
- **Step 6 — gate + commit** ✅ `bun run check` green (baml:gen, typecheck, 789 tests /
  28 new). Committed.

## Deviations from plan

- **`fmtMs(0)` → `"0s"`**: the plan's `fmtMs` would render a depleted-time remaining as
  `0ms`. Added a `ms === 0 → "0s"` special-case so the depleted readout reads cleanly
  (`⏱ 30m/30m · 0s left`). Pure format-path change; no algebra impact. Caught by the
  depleted-wallet `formatWallet` test on first run and fixed.

No other deviations. Module landed exactly as Structure specified.

## Verification

- `bun test src/budget/wallet.test.ts` → 28 pass, 0 fail.
- `bun run check` → baml:gen ok, `tsc --noEmit` clean, `bun test` 789 pass / 0 fail.
- Purity preserved: no fs/clock/network/process; type-only denomination imports +
  pure `countTokens`.
