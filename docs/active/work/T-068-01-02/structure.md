# Structure — T-068-01-02 cost-weight-count-tokens

The blueprint: three files touched, all in-place edits. No files created or deleted. No new
exports, no signature changes, no new module boundaries — the seam T-068-01-01 established
(`COST_WEIGHTS` exported from `budget.ts`) is consumed exactly where it was designed to be.

## File 1 — `src/budget/budget.ts` (MODIFY, the only source change)

### `countTokens` body (budget.ts:159-166)

Replace the parity sum with the cost-weighted sum, reading `COST_WEIGHTS` (already exported in
the same module, budget.ts:146-151), wrapped in `Math.round`:

```ts
export function countTokens(usage: Usage): number {
  return Math.round(
    num(usage.input_tokens)                * COST_WEIGHTS.input +
    num(usage.output_tokens)               * COST_WEIGHTS.output +
    num(usage.cache_read_input_tokens)     * COST_WEIGHTS.cache_read +
    num(usage.cache_creation_input_tokens) * COST_WEIGHTS.cache_creation
  );
}
```

- Keeps `num()` coercion (each bucket optional; `undefined`/non-finite → 0).
- `COST_WEIGHTS` is declared ABOVE `countTokens` in the file, so no reordering needed.
- Return type stays `number`; the value stays an integer (via `Math.round`).

### `countTokens` doc comment (budget.ts:153-158)

Rewrite from the "must not undercount every token" framing to the cost framing: the result is
the run's cost in fresh-input-token-equivalents, each bucket weighted by `COST_WEIGHTS`, so the
P7 hard contract enforces a number that tracks dollars not turns × cached-context (E-068). Retain
the "single source of truth — runner/log share this notion of spend" sentence.

### Nothing else in budget.ts moves

`Usage`, `CostWeights`, `COST_WEIGHTS`, `num`, `check`, `timeoutMsFor`, andon codes — all
unchanged. `check` (budget.ts:173-187) automatically inherits cost units because it calls
`countTokens`; its own code is untouched.

## File 2 — `src/budget/budget.test.ts` (MODIFY, primary test artifact)

Named in the ticket AC ("budget.test.ts updated and green"). Changes, all within existing
`describe` blocks plus one new block:

1. **`describe("countTokens")`** (lines 19-48): re-derive all five expected numbers under the
   weights; rename the "sums all four sub-counts" title to "cost-weights all four sub-counts."
   New expectations: `{in100,out50,cr1000,cc20}`→475; `{in100,out50}`→350; `{}`→0;
   `{cr800,cc200}`→330; `{in NaN,out10}`→50.

2. **NEW `describe("countTokens — cost weighting")`** (inserted after the existing countTokens
   block): the three intent tests —
   - AC literal: `countTokens({cache_read_input_tokens: 1000})` toBe `100`.
   - weights-are-read guard: `countTokens({output_tokens: 1000})` toBe `5000`.
   - **E-008 recompute**: a top-of-file `E008_BUCKETS` fixture const + comment; assert parity
     baseline 525,180, cost recompute 236,073, and `< 400_000` (and `< 0.5 × 525_180`).

3. **`describe("check — ok branch")`** (117-135) and **`describe("check — exhausted branch")`**
   (137-159): re-derive the `spent`/`ceiling`/`remaining`/`overage` numbers so each test still
   exercises its intended branch (see design.md's table). The input-only andon case (`{in100}`)
   is unchanged (weight 1.0).

4. `COST_WEIGHTS`, `timeoutMsFor`, `check — invalid ceiling` suites: **untouched.**

## File 3 — `src/budget/wallet.test.ts` (MODIFY, forced collateral)

Two fixture-number corrections only; `wallet.ts` itself is NOT touched (S-068-01 invariant).

1. `debit — Usage actual` (wallet.test.ts:107-115): `{in600,out100,cr300}` → countTokens 1130;
   `out.wallet.remaining.tokens` 99_000 → **98_870**. Add a comment: cost-weighted (600·1 +
   100·5 + 300·0.1).

2. `debitWave … mixed Usage + Budget` (wallet.test.ts:217-226): `{in1000,out500}` → 3500;
   summed with the 20_000 macro branch → 23_500; `remaining.tokens` 78_500 → **76_500**. Update
   the inline `// tokens:` comment to the cost math.

## Ordering of changes

1. budget.ts `countTokens` (source) — do first; the suite goes red in a known, enumerated way.
2. budget.test.ts — bring the primary artifact green (including the new E-008 fixture).
3. wallet.test.ts — bring the two collateral fixtures green.
4. `bun test` + `bun run check` — the gate.

Each is independently committable, but steps 1-3 land as one commit (the suite is only green
after all three); the change is atomic by nature — the source edit forces the test edits.

## Interfaces & invariants preserved

- `countTokens(usage: Usage): number` — identical signature, integer return.
- Purity of budget.ts — no new imports (reads an in-module const).
- Disjoint-file DAG — no edit to run-log.ts, recalibrate.ts, gather.ts, wallet.ts, spend.ts,
  or any engine source. Only budget.ts source changes; the two other files are test data.
