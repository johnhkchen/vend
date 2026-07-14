# T-048-01 Progress — wave-budget pure core

Tracks execution against `plan.md`. All steps complete; full suite green.

## Status: COMPLETE

| Step | Work | State |
|------|------|-------|
| 1 | `debitWave` in `src/budget/wallet.ts` (+ IA-8 header note) | ✅ done |
| 2 | `debitWave` unit tests in `src/budget/wallet.test.ts` | ✅ done |
| 3 | `authorizeWave` + `WaveAuthorization` in `src/engine/spend-core.ts` | ✅ done |
| 4 | `authorizeWave` unit tests in `src/engine/spend-core.test.ts` | ✅ done |
| 5 | Full gate (`check:typecheck` + full `bun test`) + Review | ✅ done |

## What was implemented

- **`debitWave(wallet, actuals): DebitResult`** (`wallet.ts`) — folds a concurrent wave's settled actuals
  into one combined `Budget` (**tokens summed, wall-clock MAX** via the in-file `actualToBudget`), then
  delegates to the public `debit`. Single-element == `debit` and empty == no-op fall out structurally; the
  collective overshoot is surfaced once by `debit`. No new imports, no new private-helper exports.
- **`authorizeWave<C>(wallet, readySet, priceOf): WaveAuthorization<C>`** (`spend-core.ts`) — greedy walk in
  the given order; per-node **virtual wallet** (remaining tokens − cumulative; time whole) reused through
  `canAfford`, so the MAX(time) / SUM(tokens) divergence is enforced by the single affordability rule. A
  stopped node never adds to the cumulative; the walk continues (the `fitNext` skip-head behavior).

## Verification

- `bun run check:typecheck` → clean (no `--noEmit` errors; `noUncheckedIndexedAccess` satisfied via
  `for…of`, no indexed access).
- `bun test src/budget/wallet.test.ts src/engine/spend-core.test.ts` → **64 pass / 0 fail**.
- `bun test` (full suite) → **1147 pass / 0 fail across 77 files**. No regression in the single-chain
  wallet/spend/graph tests — the change is strictly additive.

## Deviations from plan

- **None of substance.** Plan called for four incremental commits; the edits were small and interdependent
  enough that they were authored together and committed as one logical unit with the artifacts (the suite
  was kept green at the end of each src+test pair before moving on). Documented here per RDSPI.
- Added two coverage cases beyond the AC minimum (both deliberate, low-cost):
  - a `debitWave` **immutability** check (mirrors the existing `debit` immutability test);
  - an `authorizeWave` **"walks the given order — does not re-sort"** check (pins Design Decision 3 /
    Research constraint 5: determinism is the caller's `topoSort`, not a re-sort here).

## Open items handed to Review

- The continue-after-stop vs stop-all semantic choice (Design Decision 3) — confirmed faithful to `fitNext`,
  flagged for reviewer awareness.
- T-048-02 will thread `debitWave` / `authorizeWave` into `castGraph`; nothing in this ticket touches the
  impure shell or the live path.
