# Progress — T-068-01-01 confirm-pricing-cost-weights

## Status: complete

All plan steps executed; `bun run check` green (EXIT=0).

## Done

- **Step 1 — budget.ts** ✓ Added `CostWeights` interface + frozen `COST_WEIGHTS` const with
  the full pricing-basis doc comment, immediately above `countTokens`. Values confirmed
  `{ input: 1.0, cache_read: 0.1, cache_creation: 1.25, output: 5.0 }`. No import added —
  module stays pure.
- **Step 2 — budget.test.ts** ✓ Extended the named import with `COST_WEIGHTS`; added
  `describe("COST_WEIGHTS")` with four tests: exact-vector pin, numeraire (input = 1.0),
  load-bearing relationships (output = 5× input; cache_read ≪ input ≈ 0.1×;
  cache_creation > input), and frozen-singleton.
- **Step 3 — gate + commit** ✓ `bun test src/budget/budget.test.ts` → 24 pass / 0 fail
  (20 prior + 4 new). Full `bun run check` → 1571 pass / 0 fail, EXIT=0. Committed atomically.

## Deviations from plan

None. Implemented exactly as designed.

## Confirmation record (the ticket's substance)

Ratios confirmed against current Claude pricing (executor Opus 4.8):

| bucket | Opus 4.8 $/MTok | ratio to input | weight |
|--------|-----------------|----------------|--------|
| input | $5.00 | 1.0 | **1.0** |
| output | $25.00 | 5.0 | **5.0** |
| cache_read | $0.50 | 0.1× | **0.1** |
| cache_creation | $6.25 | 1.25× (5-min TTL) | **1.25** |

The confirmed ratios land exactly on S-068-01's starting figures. They are **model-invariant**
(output = 5× input holds lineup-wide; cache 0.1×/1.25× are fixed API multipliers), so the
single pinned constant is correct rather than a per-model table.

## Notes for downstream (T-068-01-02/-03/-04)

- `COST_WEIGHTS` and the `CostWeights` type are now exported from `src/budget/budget.ts`.
- Keys are bucket stems; map stem → `Usage` field at the call site
  (`cache_read` → `cache_read_input_tokens`).
- `countTokens` / `totalTokens` / the ceilings are **unchanged** here — those are the
  disjoint consumer tickets.
