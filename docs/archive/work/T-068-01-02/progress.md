# Progress — T-068-01-02 cost-weight-count-tokens

## Status: COMPLETE — gate green (`bun run check`: 1584 pass / 0 fail)

## Steps executed (per plan.md)

- [x] **Step 1 — rewrite `countTokens` (src/budget/budget.ts:159-172).** Parity sum →
  `Math.round(Σ bucket · COST_WEIGHTS[stem])`, reading the frozen vector T-068-01-01 exported.
  Doc comment rewritten from the "must not undercount every token" framing to the cost framing
  (the count is the run's cost in fresh-input-token-equivalents; P7 now enforces dollars, not
  turns × cached-context; `Math.round` keeps it integer).
- [x] **Step 2 — budget.test.ts.** Re-derived the five `countTokens` expectations (475 / 350 /
  0 / 330 / 50); renamed the "sums" title to "cost-weights". Added a new
  `describe("countTokens — cost weighting")` block: the AC literal (`cache_read:1000` → 100),
  a per-bucket weights-are-read guard (`output:1000` → 5000; `cache_creation:1000` → 1250), and
  the **E-008 recompute** with a documented `E008_BUCKETS` fixture (parity 525,180 → cost
  236,073, `< 400_000`). Re-derived the `check` ok / boundary / exhausted numbers under the new
  magnitudes (spent 1100, overage 600 for the 600-in/100-out case).
- [x] **Step 3 — wallet.test.ts (forced collateral, not wallet logic).** Two fixtures corrected:
  `debit — Usage actual` remaining 99_000 → 98_870 (countTokens 1130); `debitWave mixed`
  remaining 78_500 → 76_500 (countTokens 3500). Each got a comment noting the cost math so a
  future reader doesn't revert it to a parity sum.
- [x] **Step 4 — gate.** `bun test` and `bun run check` green.
- [x] **Step 5 — commit.** See below.

## Deviations from plan

- **wallet.test.ts fixtures: 2, as predicted.** The Research patch-and-run enumerated exactly 9
  failing assertions across budget.test.ts (7) + wallet.test.ts (2); all resolved. No surprise
  consumer surfaced.
- **One flaky full-suite failure investigated and cleared.** A single run showed
  `walk-away.test.ts > median actual/allocated ratio` failing under full-suite parallelism. Root
  cause is NOT this change: `auditWalkAway` reads run-log's `totalTokens` (walk-away.ts:183),
  which this ticket does not touch (that is T-068-01-03). The test passes 17/17 in isolation
  (ran 3×) and the full suite passes deterministically on re-run (2× clean, plus the final
  `bun run check`). Recorded here as pre-existing test-isolation flakiness in the walk-away suite,
  out of this ticket's scope — no code owned here depends on it.

## Verification evidence

- `countTokens({cache_read_input_tokens: 1000}) === 100` ✓ (AC literal).
- E-008 buckets `{14, 23_965, 443_711, 57_490}` → parity 525,180, cost **236,073** (< 400,000) ✓
  (AC's "recomputes to a cost figure within a sane ceiling, not 525,180 parity units").
- `bun run check`: 1584 pass / 1 skip / 0 fail; `tsc --noEmit` clean.

## Not done (out of scope, by design)

- `totalTokens` (run-log.ts) — T-068-01-03.
- Fixed ceilings (recalibrate.ts / gather.ts) re-denomination — T-068-01-04. NOTE: after this
  ticket alone, ceilings remain parity-denominated; the story closes that gap as a whole.
- Any live metered cast; no mutation of `runs.jsonl`.
