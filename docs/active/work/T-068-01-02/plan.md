# Plan — T-068-01-02 cost-weight-count-tokens

Ordered, independently verifiable steps. The whole change lands as one atomic commit (the suite
is only green once source + both test files agree), but the steps below are sequenced so each is
checkable before the next.

## Step 1 — rewrite `countTokens` (source)

`src/budget/budget.ts:159-166`: replace the parity sum with
`Math.round(Σ bucket · COST_WEIGHTS[stem])` (see structure.md for exact body). Rewrite the doc
comment (budget.ts:153-158) to the cost framing.

- **Verify:** `bun run check:types` (or `bun run build`) — typechecks; no signature change so no
  type fallout. `bun test src/budget/budget.test.ts` now RED in the enumerated places only.

## Step 2 — update `budget.test.ts` (primary artifact)

`src/budget/budget.test.ts`:
1. Re-derive the five `countTokens` expectations (475 / 350 / 0 / 330 / 50); rename the "sums" title.
2. Add `describe("countTokens — cost weighting")` with: AC literal (`cr:1000`→100), weights-read
   guard (`out:1000`→5000), and the E-008 recompute using an `E008_BUCKETS` top-of-file const
   (parity 525,180 documented; cost 236,073; `< 400_000`).
3. Re-derive the `check` ok / boundary / exhausted numbers (design.md table). Leave the input-only
   andon case, `COST_WEIGHTS`, `timeoutMsFor`, invalid-ceiling suites untouched.

- **Verify:** `bun test src/budget/budget.test.ts` — GREEN. Manually confirm the E-008 test
  actually asserts 236,073 (recompute by hand: 14 + 119,825 + 44,371.1 + 71,862.5 = 236,072.6 →
  round 236,073).

## Step 3 — fix the two `wallet.test.ts` fixtures

`src/budget/wallet.test.ts`:
- line 113: `tokens: 99_000` → `98_870`; add cost-math comment.
- line 224: `tokens: 78_500` → `76_500`; update the `// tokens:` comment to 3_500.

- **Verify:** `bun test src/budget/wallet.test.ts` — GREEN.

## Step 4 — full-suite gate

- `bun test` — expect `1578 pass / 0 fail` again (same count as baseline; no tests added net to
  the count that would fail — the 3 new budget assertions raise pass count, `expect()` calls rise).
- `bun run check` — types + lint + format + tests, the real project gate.

- **Verify:** both green. If any test outside the enumerated set fails, STOP and investigate — the
  Research patch-and-run said the failure set is exactly these 9 assertions across 2 files; a
  surprise means a consumer we didn't map.

## Step 5 — commit

One commit, message:
`feat(budget): cost-weight countTokens over the four buckets (T-068-01-02)`
Body: parity sum → `Math.round(Σ bucket·COST_WEIGHTS)`; E-008 recomputes 525,180 → 236,073;
budget.test.ts rewritten + E-008 fixture added; two wallet.test.ts fixtures corrected to cost
semantics (no wallet logic change). Trailer per repo convention.

## Testing strategy

- **Unit (owned here):** `budget.test.ts` is the gate for `bun run check:test`. Coverage:
  - every `countTokens` branch (each bucket present, empty, non-finite coercion);
  - the cost-weighting itself (per-bucket weight actually applied — the `out:1000`→5000 guard
    catches a silent revert to parity);
  - the AC's literal example and the E-008 recompute (the headline proof number);
  - `check`'s ok / boundary / exhausted branches under the new magnitudes.
- **Collateral (corrected, not owned):** the two `wallet.test.ts` cost fixtures.
- **No integration/live test.** The recompute is pure and free (buckets → number); the epic's
  live metered decompose is explicitly deferred, authorized at the counter (S-068-01 honest
  boundary). Nothing here spends a token.

## Rollback

Single-file source change; `git revert` the commit restores parity `countTokens` and the old
fixtures together. No migration, no persisted state touched (`runs.jsonl` is read-only here).

## Done when

- `countTokens({cache_read_input_tokens:1000}) === 100`.
- E-008 buckets recompute to 236,073 (< 400,000), asserted in `budget.test.ts`.
- `bun test` and `bun run check` green.
