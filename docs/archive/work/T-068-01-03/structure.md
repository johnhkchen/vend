# T-068-01-03 — Structure

## Files touched

| File | Change | Why |
|---|---|---|
| `src/log/run-log.ts` | **modified** | Add inline `COST_WEIGHTS` mirror; rewrite `totalTokens` to a cost-weighted sum |
| `src/log/run-log.test.ts` | **modified** | Update the parity `totalTokens` assertion; add cost-weight, fixture-recompute, drift-guard, and recalibrate-recompute tests |

No files created or deleted. No other file in the repo is touched (disjoint-files invariant with
T-068-01-02 / T-068-01-04).

## `src/log/run-log.ts` — the two edits

### 1. New module-private constant `COST_WEIGHTS`

Placed immediately **above** `totalTokens` (near line 543, in the read-face derivations block),
so the weight vector reads adjacent to the one function that uses it.

```ts
/**
 * Cost-weight vector for the four token buckets, priced RELATIVE to a fresh input token
 * (numeraire 1.0). A DELIBERATE INLINE MIRROR of budget.ts's exported `COST_WEIGHTS`
 * (T-068-01-01) — duplicated, not imported, to preserve run-log's zero-coupling invariant
 * (this module imports NOTHING from src/budget/; see the header note and `totalTokens`).
 * The two copies are kept in lockstep by matching unit tests on both sides (a silent drift
 * back to parity or to wrong ratios fails a guard); if budget's vector ever changes, this
 * mirror changes with it. Basis (confirmed against current Claude pricing, Opus 4.8):
 * input $5/MTok→1.0, output $25/MTok→5.0 (lineup-wide 1:5), cache_read $0.50/MTok→0.1
 * (0.1× read multiplier), cache_creation $6.25/MTok→1.25 (1.25× write multiplier).
 */
const COST_WEIGHTS = Object.freeze({
  input: 1.0,
  cache_read: 0.1,
  cache_creation: 1.25,
  output: 5.0,
});
```

- **Private** (no `export`) — an implementation detail of the derivation, like `num`. The public
  surface is unchanged.
- **Frozen** — matches budget's frozen singleton and the module's immutability posture.
- Type is the inferred readonly literal object; no need to import/re-declare a `CostWeights`
  interface (that lives in budget.ts and importing it would re-couple). The four-key shape is
  local and self-evident.

### 2. Rewrite `totalTokens`

```ts
/**
 * Derived total COST-WEIGHTED tokens for a record: each usage bucket weighted by its cost
 * relative to a fresh input token ({@link COST_WEIGHTS}), NOT a parity sum. PURE. This is the
 * same definition as budget's cost-weighted `countTokens` (the single notion of "spent"); it is
 * inlined here rather than imported to preserve run-log's zero-coupling invariant (run-log ⊥
 * budget). Cache reads dominate a grown board's raw token sum but cost ~a tenth of a fresh input
 * token, so weighting by cost makes the meter measure cost, not cached context (E-068). May
 * return a fractional value (the weights are fractional); consumers `Math.ceil`/divide as needed
 * — there is no integer contract on this derivation. `usage` is already normalized (every
 * sub-count finite), so no re-coercion is needed here.
 */
export function totalTokens(r: RunRecord): number {
  const u = r.usage;
  return (
    u.input_tokens * COST_WEIGHTS.input +
    u.output_tokens * COST_WEIGHTS.output +
    u.cache_read_input_tokens * COST_WEIGHTS.cache_read +
    u.cache_creation_input_tokens * COST_WEIGHTS.cache_creation
  );
}
```

Signature, export, and name **unchanged** — a pure body swap. Every consumer keeps its call site.

## `src/log/run-log.test.ts` — the test edits

All under (or adjacent to) the existing `describe("derivations — wallClockMs and totalTokens")`
block (lines 590-615).

1. **Update the existing parity assertion** (line 612-614): `totalTokens(rec)` over
   `{100, 50 out, 1000 read, 20 create}` changes from `100+50+1000+20 (=1170)` to the
   cost-weighted `100·1 + 50·5 + 1000·0.1 + 20·1.25 = 100+250+100+25 = 475`. Assert `475`,
   computed inline from the weights so it reads as intentional.

2. **Add: cache-dominated fixture recompute (primary AC).** Build a record with the
   boilerplate-demo E-008 buckets `{input:14, output:23_965, cache_read:443_711,
   cache_creation:57_490}`. Assert `totalTokens` equals the cost-weighted figure (≈236,072.6) and
   is **strictly less than** the parity sum 525,180 — the "recomputes to a saner cost figure"
   clause. Compute the expectation from the weight literals inline.

3. **Add: drift guard.** Assert `totalTokens` over a single-bucket record equals that bucket ×
   its weight — e.g. `cache_read_input_tokens:1000 → 100` (mirrors budget's
   `countTokens({cache_read:1000}) ≈ 100`), and `output:1000 → 5000`. Pins the ratios so a silent
   drift back to parity fails here, keeping the two mirrors in lockstep.

4. **Add: recalibrate recomputes in cost units, no re-run (second AC).** New small `describe`.
   Import `recalibrate` (+ `percentile` for the hand-check if useful) from
   `../ledger/recalibrate.ts` — a read-only import, no file overlap with T-068-01-04. Build ≥3
   cache-dominated `success` fixture records for one play, call
   `recalibrate(play, records, "standard", prior)` with a generous `prior`, and assert
   `result.envelope.tokens` equals `Math.ceil(costWeightedP90)` **and** is strictly below the
   parity p90 of the same records. Uses `recalibrate()` (raw percentile, unclamped) so it is
   independent of FUNDING_FLOOR/CEILING (T-068-01-04) and of `countTokens` (T-068-01-02).

## Ordering of changes

1. Edit `run-log.ts` (constant + function) — compiles standalone.
2. Update the existing failing assertion in `run-log.test.ts`.
3. Add the new tests.
4. Run `bun test src/log/run-log.test.ts` and the full `bun run check`.

## Interfaces / boundaries

- **Public API unchanged:** `totalTokens(r: RunRecord): number` — same signature, same export.
- **No new exports** from run-log.ts (the weight vector stays private).
- **No new import** into run-log.ts (zero-coupling held).
- **New test-only import:** run-log.test.ts → recalibrate.ts (`recalibrate`). Test files may
  cross module boundaries; this couples the *test*, not the *module*, and carries no
  ordering risk (justified in design.md).
