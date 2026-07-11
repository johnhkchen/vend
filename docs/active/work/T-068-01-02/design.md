# Design — T-068-01-02 cost-weight-count-tokens

## The decision in one line

Rewrite `countTokens` as `Math.round(Σ bucket·COST_WEIGHTS[stem])` over the four buckets,
reading the frozen vector T-068-01-01 already exported; rewrite its doc comment to say the
count measures **cost** (input-equivalent tokens); fix `budget.test.ts` (add an E-008 recompute
fixture) and the two collateral `wallet.test.ts` fixtures. No new exports, no signature change.

## Decision 1 — where the weights come from

**Chosen: read the exported `COST_WEIGHTS` frozen singleton.**

```ts
return Math.round(
  num(usage.input_tokens)                 * COST_WEIGHTS.input +
  num(usage.output_tokens)                * COST_WEIGHTS.output +
  num(usage.cache_read_input_tokens)      * COST_WEIGHTS.cache_read +
  num(usage.cache_creation_input_tokens)  * COST_WEIGHTS.cache_creation
);
```

Rejected — **inline literal weights** (`… * 0.1 …`): duplicates the vector, defeats the entire
point of T-068-01-01 running ALONE as the keystone so all three consumers share one source. A
silent divergence between the inline number and the pinned vector is exactly the drift the
DAG shape was designed to prevent. The stem→field mapping (`cache_read` → `cache_read_input_tokens`)
is done here at the call site, precisely as `COST_WEIGHTS`'s doc says it should be (budget.ts:113-115).

## Decision 2 — integer vs floating-point return

**Chosen: `Math.round` the weighted sum to an integer.**

Rationale:
- `countTokens` has *always* returned an integer; its consumers treat the result as an integer
  token count — wallet `remaining`/`overshoot` balances, ledger `spent` figures, `check`'s
  `remaining`/`overage`. Returning a float would leak `44,371.1`-style dust into every balance
  and every rendered number, and accumulate float error across `debitWave` folds.
- The weighting is an *approximation of cost* to a tenth of an input token; sub-token precision
  is meaningless. Rounding to the nearest integer is the honest resolution of the estimate.
- The canonical AC case is exact: `cache_read:1000 → 1000·0.1 = 100.0 → 100`. No rounding
  artifact on the number the AC names.

Rejected — **return the raw float**: correctness-neutral for `check`'s comparison but pollutes
every downstream integer surface and serialized figure; no upside.

Rejected — **`Math.ceil` ("never undercount")**: the old "must not undercount" rationale was
about raw throughput and is explicitly *inverted* by this epic (we weight cache reads DOWN
because they cost less). Biasing every count up by up to ~1 token-equivalent has no cost meaning
and would make the E-008 fixture a hair less clean. `round` is the neutral, defensible choice.

Rejected — **`Math.trunc`/`Math.floor`**: would systematically undercount the cost estimate; no
reason to bias low either.

## Decision 3 — the doc comment must invert

The current comment (budget.ts:153-158) is now *wrong*, not just stale:

> "A hard contract must not undercount — every token in any bucket (incl. cache traffic) is a
> token the run moved through the model."

Under cost-weighting, cache traffic is deliberately counted at a fraction of its raw size. The
new comment states: the count is the run's **cost** in fresh-input-token-equivalents — each
bucket weighted by `COST_WEIGHTS` — so the hard contract (P7) enforces a number that tracks
dollars, not turns × cached-context (E-068). Keep the "single source of truth" note: the
runner/log still share this one notion of spend (run-log mirrors it in T-068-01-03).

## Decision 4 — test strategy (budget.test.ts)

The `countTokens` suite (budget.test.ts:19-48) and `check` suite (117-159) hardcode parity sums.
Recompute each expectation under the weights, and ADD the AC's proof fixture:

| existing test | old expect | new expect (cost-weighted) |
|---|---|---|
| sums all four sub-counts `{in100,out50,cr1000,cc20}` | 1170 | 100+250+100+25 = **475** |
| treats missing fields as 0 `{in100,out50}` | 150 | 100+250 = **350** |
| empty usage | 0 | **0** (unchanged) |
| cache-only `{cr800,cc200}` | 1000 | 80+250 = **330** |
| coerces non-finite `{in NaN, out10}` | 10 | **50** (10·5) |
| check ok `{in600,out100}` ceiling 1000 | spent 700 | spent **1100** → now > 1000 → adjust ceiling/case |
| check ok-boundary `{in600,out100}` ceiling 700 | spent 700 | spent **1100** → adjust ceiling to 1100 |
| check exhausted `{in600,out100}` ceiling 500 | spent 700, over 200 | spent **1100**, over **600** |
| check andon `{in100}` ceiling 10 | spent 100, over 90 | **100/over 90** (input-only, unchanged) |

Because output now weighs 5×, several `check` fixtures cross their ceiling differently — each is
re-derived so the branch it was written to exercise (ok / boundary / exhausted) still fires.
Rename the `countTokens` `describe`/test titles from "sums all four sub-counts" to
"cost-weights all four sub-counts" so the intent reads true.

**New E-008 recompute test** (the AC's headline proof), using a named fixture constant:

```ts
// boilerplate-demo's recorded failed E-008 decompose (E-068 field report). cache_creation
// is derived so the four buckets close the recorded 525,180 parity total exactly.
const E008 = { input_tokens: 14, output_tokens: 23_965,
               cache_read_input_tokens: 443_711, cache_creation_input_tokens: 57_490 };
```

Asserts: (a) old parity sum would be 525,180 (documents the regression baseline); (b)
`countTokens(E008)` === 236,073; (c) it is a large haircut — `< 0.5 × 525_180` and specifically
`< 400_000` ("a sane ceiling"), the AC's "not 525,180 parity units."

**Guard test:** `countTokens({cache_read_input_tokens: 1000})` === 100 (the AC's literal example,
`≈100 not 1000`), pinning that cache reads are counted at a tenth.

**Weights-are-actually-read test:** assert `countTokens` moves when a bucket does per its weight —
e.g. `countTokens({output_tokens: 1000}) === 5000` — so a future silent revert to parity fails.

## Decision 5 — the two wallet.test.ts fixtures

Correct the expected numbers only (not `wallet.ts`):
- `debit — Usage actual` (wallet.test.ts:107): `{in600,out100,cr300}` → 600+500+30 = **1130**;
  remaining `100_000 − 1130 = 98_870` (was 99_000).
- `debitWave mixed` (wallet.test.ts:217): `{in1000,out500}` → 1000+2500 = **3500**; with the
  `macro(_,20_000)` branch, tokens summed `23_500`, remaining `76_500` (was 78_500).

Add a one-line comment on each noting the number is the cost-weighted `countTokens` (so a future
reader doesn't "fix" it back to a parity sum). This is a fixture correction the countTokens change
*forces*; it does not touch wallet logic, honoring S-068-01's "wallet is NOT edited."

## What this deliberately does NOT do

- No change to `check`'s branch structure, `Usage`/`Budget` shapes, or any signature.
- No touch to `totalTokens` (T-068-01-03) or the ceilings (T-068-01-04) — the ceilings staying
  parity-denominated *after this ticket alone* is expected; the story closes that as a whole.
- No live metered cast; no mutation of `runs.jsonl`. Recompute is free and pure.

## Risk & mitigation

- **Risk:** a hidden consumer asserts an exact parity total we didn't catch. **Mitigation:** the
  empirical patch-and-run in Research enumerated the *complete* failure set (9 tests, 2 files);
  Plan re-runs the full suite as the gate, so any missed case surfaces immediately.
- **Risk:** rounding hides a real over-ceiling by <1 token. **Mitigation:** immaterial at the
  tens-of-thousands magnitudes the meter operates at; `round` is symmetric and documented.
