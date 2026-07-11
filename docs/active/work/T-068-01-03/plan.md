# T-068-01-03 — Plan

Single atomic change (one function body + its private constant + its tests). One commit.

## Step 1 — Add inline `COST_WEIGHTS` and cost-weight `totalTokens` in run-log.ts

- Insert the module-private, frozen `COST_WEIGHTS` constant immediately above `totalTokens`
  (structure.md §1), with the deliberate-mirror docstring citing budget.ts + the zero-coupling
  rationale.
- Rewrite `totalTokens`' body to the cost-weighted sum (structure.md §2); update its docstring
  (parity → cost-weighted; note the possibly-fractional result).
- **Verify:** no new `import` added; `COST_WEIGHTS` not exported; signature unchanged.

## Step 2 — Update the broken parity assertion in run-log.test.ts

- In `describe("derivations — wallClockMs and totalTokens")`, change the `totalTokens` expectation
  from `100+50+1000+20` to the cost-weighted `100·1 + 50·5 + 1000·0.1 + 20·1.25 = 475`, written
  as the weighted expression so intent is legible.

## Step 3 — Add the cost-weight tests

Add to / beside the derivations block:
- **fixture recompute:** boilerplate-demo E-008 buckets → assert `totalTokens ≈ 236,072.6`
  (computed from weight literals) and `< 525,180` (parity).
- **drift guard:** single-bucket records pin the ratios — `cache_read:1000 → 100`,
  `output:1000 → 5000`, `cache_creation:1000 → 1250`, `input:1000 → 1000`. A drift back to parity
  fails here.

## Step 4 — Add the recalibrate-recompute test (second AC)

- New `describe("totalTokens cost-reweight flows through recalibrate (T-068-01-03 AC)")`.
- Import `recalibrate` from `../ledger/recalibrate.ts` (read-only; no file overlap).
- Fixture: ≥3 `success` records for one play with cache-dominated usage; a generous `prior`
  budget so cold-start doesn't fire and the prior never dominates.
- Assert `recalibrate(play, recs, "standard", prior).envelope.tokens ===
  Math.ceil(costWeightedP90)` **and** `< parityP90`. Confirms cost-denominated envelopes from
  existing records with no re-run, independent of FUNDING band / countTokens ordering.

## Step 5 — Verify green

- `bun test src/log/run-log.test.ts` — the target suite green (AC: "run-log.test.ts stays green").
- `bun run check` — full typecheck + lint + tests, to confirm no consumer regressed and the
  fractional `totalTokens` breaks no downstream typing.
- Spot-confirm the two mirrors agree: run-log's inline weights == budget.test.ts's pinned
  `COST_WEIGHTS` literals (visual diff; both guarded by tests).

## Step 6 — Commit

Conventional message referencing the ticket, e.g.:
`feat(budget): cost-weight run-log totalTokens (inline mirror) (T-068-01-03)`

## Testing strategy

| Concern | Covered by |
|---|---|
| totalTokens is cost-weighted, not parity | updated derivations assertion + drift guard |
| cache-dominated record recomputes to a saner cost figure | E-008 fixture recompute test |
| the inline mirror matches budget's COST_WEIGHTS (no drift) | drift guard (pins same literals budget.test.ts pins) |
| recalibrate yields cost-denominated p90 with no re-run | recalibrate-recompute test (real `recalibrate`, unclamped) |
| write/read faces, forPlay, back-compat unaffected | existing suite stays green |
| downstream typing tolerates fractional totalTokens | `bun run check` |

## Rollback

Single-file source change with a pure body swap; revert the commit to restore parity. No data
migration, no schema change, no persisted-format impact (buckets untouched).

## Risks watched during implementation

- **Fractional-value surprise downstream** — check `bun run check` passes; `recalibrate.positiveInt`
  already `Math.ceil`s, ratios divide. If any consumer asserted an integer `totalTokens`, surface
  it (none found in research).
- **Accidental coupling** — re-read the import block after editing run-log.ts to confirm nothing
  from `src/budget/` crept in.
