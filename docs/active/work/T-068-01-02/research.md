# Research — T-068-01-02 cost-weight-count-tokens

## Ticket in one line

Replace `budget.ts#countTokens`'s parity sum with the **cost-weighted** sum over the four
token buckets, using the `COST_WEIGHTS` vector pinned by T-068-01-01, so the hard-contract
number measures **cost**, not cached context. Update `budget.test.ts` and keep the suite green.

## Why this exists (from E-068 / S-068-01)

`countTokens` today sums `input + output + cache_read + cache_creation` **at parity** — every
token counts as 1.0. On a grown board cache-read tokens dominate the sum (boilerplate-demo's
failed E-008 decompose: `cache_read=443,711` vs `input=14 + output=23,965`, ~4.6% real work)
yet a cache-read token costs ~a tenth of a fresh input token. So the counted "spend" scales
with turns × board-context-size while true dollar cost barely moves — a bigger board inflates
the meter past any fixed ceiling. E-008 failed 3/3 walk-away attempts (25k/80k/400k) because
the meter measured cached context, not cost (P7's hard contract enforcing the wrong number).

T-068-01-01 (DONE) already pinned the vector this ticket consumes. This ticket is the first of
the three DISJOINT consumers in S-068-01's fan-out; it owns **only** `countTokens` in
`budget.ts`. Sibling `totalTokens` (run-log.ts, T-068-01-03) and the fixed ceilings
(recalibrate/gather, T-068-01-04) are other tickets on other files.

## What already exists (the ground T-068-01-01 laid)

`budget.ts` already exports the settled, frozen, documented vector (budget.ts:112-151):

```ts
export const COST_WEIGHTS: CostWeights = Object.freeze({
  input: 1.0, cache_read: 0.1, cache_creation: 1.25, output: 5.0,
});
```

Keys are the `Usage` sub-count **stems** (`cache_read` → `cache_read_input_tokens`), by design
"so a consumer maps stem → field at the call site" (budget.ts:113-115). `CostWeights` interface
is exported too. The pricing basis (Opus 4.8 $5/$25 in/out, 0.1× read, 1.25× create) is cited
in-file and unit-pinned in `budget.test.ts:50-79`. **This ticket adds no new constant** — it
rewires the one function to read the constant that is already there.

## The function to change (budget.ts:153-166)

```ts
export function countTokens(usage: Usage): number {
  return (
    num(usage.input_tokens) +
    num(usage.output_tokens) +
    num(usage.cache_read_input_tokens) +
    num(usage.cache_creation_input_tokens)
  );
}
```

- `num()` (budget.ts:60-62) coerces `undefined`/non-finite → 0; keep it — the four buckets are
  all optional (`Usage`, budget.ts:30-35).
- The doc comment currently says "must not undercount — every token … is a token the run moved
  through the model." That rationale **inverts** under this ticket: we deliberately weight cache
  reads DOWN because they cost less. The comment must be rewritten to say the count measures
  **cost** (input-equivalent tokens), not raw throughput.

## Consumers of `countTokens` (the blast radius — verified empirically)

`countTokens` is the single definition of "spent," so every downstream number moves with it —
which is exactly E-068's intent (one shared cost-weighted accounting). Call sites:

- `check()` (budget.ts:173-187) — `spent = countTokens(usage)` vs the ceiling. Same file.
- `wallet.ts` `actualToBudget` (wallet.ts:90-96) — a `Usage` actual debits `countTokens`.
- `spend.ts:133`, `graph-core.ts:294`, `graph-example.ts:158` — sum `countTokens` across steps.

None of these consumers' **logic** changes (S-068-01: they "recompute for free"). Their **test
fixtures**, where they encode parity arithmetic over non-input buckets, do change.

### Empirical breakage (patched countTokens → cost-weighted, ran `bun test`, reverted)

Baseline: `1578 pass / 0 fail`. With the cost-weighted body, exactly **9 fail**, in two files:

- **`budget.test.ts`** (7) — the `countTokens` suite (4) and the `check` suite (3): every
  assertion whose expected number is a parity sum over output/cache buckets. THIS FILE is mine
  to rewrite (the ticket AC names it).
- **`wallet.test.ts`** (2) — `debit — Usage actual` (line 107) and `debitWave … mixed Usage +
  Budget` (line 217): the only two wallet fixtures that feed a `Usage` with output/cache buckets
  through `countTokens`. Every other wallet case uses `macro` (a `Budget` actual) and bypasses
  `countTokens`, so it is untouched.

**Nothing else breaks.** `spend.test.ts`, `graph-core.test.ts`, `cast.test.ts`, `run-log.test.ts`
all carry tokens as `input_tokens` only ("tokens carried as input_tokens so countTokens == that
count", graph-core.test.ts:358 et al.) — weight 1.0, so their numbers are unchanged. This
confirms the DAG's disjoint-file claim holds at the source level; the only cross-file collateral
is two `wallet.test.ts` fixtures, which are test-data corrections, not `wallet.ts` logic edits.

## The E-008 recompute fixture (AC's proof number)

The AC wants a test over "boilerplate-demo's recorded E-008 four buckets" recomputing to a cost
figure "within a sane ceiling (not 525,180 parity units)." boilerplate-demo is an external repo;
its buckets are NOT in this repo's `.vend/runs.jsonl`. The recorded figures (E-068 field report):

| bucket          | tokens   | source                                      |
|-----------------|----------|---------------------------------------------|
| input           | 14       | epic/research (cited)                        |
| output          | 23,965   | epic/research (cited)                        |
| cache_read      | 443,711  | epic/research (cited)                        |
| cache_creation  | 57,490   | **derived**: 525,180 − 14 − 23,965 − 443,711 |
| **parity total**| 525,180  | recorded `spent`                             |

cache_creation is derived so the four buckets close the recorded parity total exactly (the field
report cites input/output/cache_read and the total). Cost-weighted:

```
14·1.0 + 23,965·5.0 + 443,711·0.1 + 57,490·1.25
= 14 + 119,825 + 44,371.1 + 71,862.5  =  236,072.6  → round 236,073
```

≈**236k** cost units vs **525k** parity — a 55% haircut, and now output (51%) + cache_creation
(30%) dominate instead of cache_read (was 85%). The fixture will assert this number and that it
sits below a sane ceiling. (Note: 236k < 400k but > 80k — whether the ceiling itself moves is
T-068-01-04's job, out of this ticket; here we only prove the *recompute* is cost-shaped.)

## Design questions surfaced (decided in design.md)

1. **Integer vs float return.** The weighted sum is fractional (e.g. 44,371.1). `countTokens` has
   always returned an integer and downstream wallet balances/ledger figures are integers. →
   `Math.round` at the boundary (leaning). The canonical AC case (`cache_read:1000` → 100) is
   exact either way.
2. **Reuse `COST_WEIGHTS` vs inline literals.** Must read the frozen vector (single source of
   truth; S-068-01 built T-068-01-01 precisely so all consumers share it).
3. **Whether editing `wallet.test.ts` violates "wallet is NOT edited."** No — the story bars
   editing wallet *module logic*; correcting two parity-based test fixtures to the new cost
   semantics is required to keep the gate green and is not a logic change.

## Constraints & assumptions

- **Purity preserved.** budget.ts imports nothing (no fs/clock/net). Reading a frozen in-module
  constant keeps it pure.
- **In scope:** `countTokens` body + doc comment; `budget.test.ts` rewrites + E-008 fixture; the
  two `wallet.test.ts` fixture corrections. **Out:** `totalTokens` (T-068-01-03), ceilings
  (T-068-01-04), any live metered cast, rewriting `runs.jsonl`.
- **Gate:** `bun test` and `bun run check` must be green (budget.test.ts "is the gate for
  `bun run check:test`," budget.test.ts:15).
