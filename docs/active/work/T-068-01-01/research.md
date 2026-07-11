# Research — T-068-01-01 confirm-pricing-cost-weights

## Ticket in one line

Pin the canonical cost-weight vector for the four token buckets — `{input, cache_read,
cache_creation, output}` — confirmed against current Claude pricing, exported from
`budget.ts` as the single source every cost-weighted count will read. This ticket ships
**only the vector + its unit test**; it does not rewire `countTokens`.

## Why this exists (from E-068 / S-068-01)

The budget meter (`countTokens`) sums all four token buckets **at parity** — every token
counts as 1.0. On a grown board, cache-read tokens dominate the sum (boilerplate-demo's
failed E-008 decompose: `cache_read=443,711` vs `input=14 + output=23,965`, ~4.5% real
work), yet a cache-read token costs ~a tenth of a fresh input token. So the counted "spend"
scales with turns × board-context-size while true dollar cost barely moves — a bigger board
inflates the meter past any fixed ceiling. E-008 failed 3/3 walk-away attempts at 25k/80k/
400k ceilings because the meter measured cached context, not cost.

The epic's fix is one shared **cost-weighted** accounting. This ticket is the keystone:
S-068-01's DAG runs T-068-01-01 **alone** first — the three consumers (`countTokens` in
budget.ts, `totalTokens` in run-log.ts, the fixed ceilings in recalibrate.ts/gather.ts) all
read the settled vector. Nothing can proceed until the weights are pinned and confirmed.

## The token buckets (the shape everything reads)

`budget.ts#Usage` (budget.ts:30-35) and its structural twin `run-log.ts#UsageInput`
(run-log.ts:69-74) declare the same four optional sub-counts:

- `input_tokens` — fresh (uncached) prompt tokens billed at full input rate.
- `output_tokens` — generated tokens.
- `cache_read_input_tokens` — prompt tokens served from the cache.
- `cache_creation_input_tokens` — prompt tokens written to the cache this request.

Every run already records all four in `runs.jsonl` via `normalizeUsage`
(run-log.ts:227-234) → `NormalizedUsage` (run-log.ts:77-82). **History recomputes for free**:
the buckets are read, never mutated (S-068-01 "Out of this slice").

## Current parity accounting (what changes downstream, not here)

`countTokens(usage)` (budget.ts:117-124) returns `input + output + cache_read +
cache_creation` — a flat sum, "a hard contract must not undercount." `run-log.ts#totalTokens`
(run-log.ts:548-551) is a deliberate **inline mirror** of the same definition, duplicated
(not imported) to preserve run-log's zero-coupling-to-`src/budget/` invariant (run-log.ts:19-24,
"DECOUPLED"). Both live behind the `num()` coercion idiom (`undefined`/non-finite → 0).

These two are the T-068-01-02 / T-068-01-03 consumers. **This ticket does not touch either.**

## Confirmed pricing basis (the numbers)

Source of truth: the project executor is Claude Opus 4.8 (`claude-opus-4-8[1m]`), and the
`claude-api` skill's model table (cached 2026-06-24) + prompt-caching economics.

| Bucket           | Opus 4.8 price | Ratio to input | Weight |
|------------------|----------------|----------------|--------|
| input            | $5.00 / MTok   | 1.0            | 1.0    |
| output           | $25.00 / MTok  | 25/5 = 5.0     | 5.0    |
| cache_read       | $0.50 / MTok   | 0.1× input     | 0.1    |
| cache_creation   | $6.25 / MTok   | 1.25× input    | 1.25   |

- **Output = 5× input** holds across the *entire* current lineup, not just Opus 4.8:
  Opus $5/$25, Sonnet 5 $3/$15, Haiku 4.5 $1/$5, Fable 5 $10/$50 — every one is a 1:5 ratio.
- **cache_read = 0.1× base input** and **cache_creation = 1.25× base input (5-min ephemeral
  TTL, the default)** are fixed API-wide multipliers, model-independent (prompt-caching.md
  economics; the 1-hour TTL write is 2×, but the ledger's `cache_creation_input_tokens`
  bucket does not distinguish TTL, and the executor uses the default 5-min ephemeral cache).

**Consequence:** because the vector is expressed as *ratios to input*, and the whole lineup
shares the 1:5 input:output ratio plus the fixed cache multipliers, the confirmed vector
`{1.0, 0.1, 1.25, 5.0}` is **model-invariant** — swapping executors later does not move it.

The S-068-01 "starting point" guesses were `{input 1.0, cache_read ~0.1, cache_creation 1.25,
output ~5}`. Confirmation lands **exactly** on those figures (the `~` resolves to precise
values, not merely close ones).

## Downstream consumers this vector will feed (mapped, not touched here)

- `budget.ts#countTokens` (T-068-01-02) — the canonical cost-weighted sum.
- `run-log.ts#totalTokens` (T-068-01-03) — the inline mirror; must weight identically.
- `recalibrate.ts` `FUNDING_FLOOR_TOKENS = 350_000` / `FUNDING_CEILING_TOKENS = 700_000`
  (recalibrate.ts:221/227) — parity-denominated ceilings that must be re-denominated to
  true-cost magnitude (T-068-01-04). recalibrate consumes `totalTokens` via `forPlay`/`map`
  (recalibrate.ts:152, 313, 494) and recomputes p90 envelopes for free.
- `gather.ts#TIER_BUDGET` (gather.ts:49-54) — cold-start hand priors `{keystone 80k, high 50k,
  standard 25k, leaf 8k}`, also parity-denominated (T-068-01-04).

## Test conventions (budget.test.ts)

`bun:test` (`describe`/`test`/`expect`), fabricated inputs only — "pure module … no spawn,
no fs, no clock" (budget.test.ts:12-14). Named imports from `./budget.ts`. Existing suites
pin documented constants directly (e.g. `TIMEOUT_HEADROOM` is asserted integer ≥2,
budget.test.ts:58-62) — the pattern for pinning a confirmed constant against silent drift.
This file "is the gate for `bun run check:test`."

## Constraints & assumptions

- **In scope:** export a documented `COST_WEIGHTS` object + a unit test asserting the four
  confirmed values and the pricing basis. Nothing else.
- **Out of scope (other tickets / slices):** editing `countTokens`/`totalTokens`; the
  ceiling re-denomination; any live metered cast; rewriting historical `runs.jsonl`.
- **Purity:** budget.ts imports nothing (no fs/clock/net); the vector must be a plain frozen
  literal, keeping the module pure.
- **Naming:** the field names should mirror the `Usage` sub-count stems (`input`, `output`,
  `cache_read`, `cache_creation`) so a consumer can key weights by bucket unambiguously.
