# Review — T-068-01-04 redenominate fixed ceilings

## Outcome

T-068-01-04 is implemented and acceptance-covered. The parity-denominated fixed policy
magnitudes now use the same fresh-input-token-equivalent cost denomination as E-068's
`countTokens` and run-log `totalTokens` paths.

Implementation commit:

```text
c548234 feat(budget): redenominate fixed ceilings in cost units (T-068-01-04)
```

The funding guard is now banded to `[175_000, 350_000]` cost units, and the tier hand priors
are now `40_000 / 25_000 / 12_500 / 4_000` from keystone through leaf. Wall-clock values,
recalibration logic, pricing, wallet authorization, and public interfaces are unchanged.

## Why these magnitudes

The prerequisite T-068-01-01 confirmed the cost weights `{ input: 1.0, cache_read: 0.1,
cache_creation: 1.25, output: 5.0 }`. Fixed policies cannot be converted with a universal
scalar because each run has a different bucket mix, so the values were re-derived from the
same historical workload classes that justified E-050/E-053:

| class | old parity magnitude | recorded cost magnitude | new policy |
|---|---:|---:|---:|
| upper propose / tail class | ~170–176k | ~83k | 175k floor |
| heavy decompose / runaway class | ~700–733k | ~328–345k | 350k ceiling |

The 175k floor retains approximately two-times room over the ordinary propose class. The
350k ceiling permits the observed honest heavy-finish magnitude with a small round-number
margin but rejects further headroom-driven self-funding. This preserves the E-053 semantics
under the price-true meter instead of merely changing the unit label.

The tier priors use the same representative one-half policy re-denomination so cold-start
defaults do not stay inflated in the old parity scale. Their leverage ordering and all time
allowances remain intact.

## Production changes

### `src/ledger/recalibrate.ts`

- `FUNDING_FLOOR_TOKENS`: `350_000` -> `175_000`.
- `FUNDING_CEILING_TOKENS`: `700_000` -> `350_000`.
- Comments now define the dimension as fresh-input-token-equivalent cost and cite the
  re-derived propose/decompose magnitudes.

No change to:

- `FundingOptions` or per-call overrides;
- `FundingResult`;
- `fundDimension` or `bandTokens`;
- either `fundingEnvelope` branch;
- the pre-band `widened` signal;
- wall-clock funding;
- recalibration percentiles, confidence, or labels.

The ceiling therefore remains the outermost post-headroom bound, exactly where P7 requires
the runaway wall.

### `src/shelf/gather.ts`

`TIER_BUDGET` now stores:

| tier | timeMs | tokens (cost units) |
|---|---:|---:|
| keystone | 7,200,000 | 40,000 |
| high | 7,200,000 | 25,000 |
| standard | 3,600,000 | 12,500 |
| leaf | 900,000 | 4,000 |

No change to `budgetForTier`, action shaping, ranking, parsing, rendering, persistence, or
the impure gather shell. Explicit `--budget` overrides are unaffected.

## Test changes

### `src/ledger/recalibrate.test.ts`

The existing rational-band suite now pins the new denomination and behavior:

- a below-floor measured price funds at exactly 175k;
- an in-band 225k price passes through unchanged;
- a 200k censored actual receives E-050 headroom to 400k and caps at exactly 350k;
- the cap leaves the quoted price and label untouched;
- wall clock remains unbanded; and
- both constants remain finite positive integers with floor below ceiling.

The fixtures still build real `RunRecord` values and feed real `recalibrate` results into
`fundingEnvelope`. Their token values land in `input_tokens`, whose weight is exactly 1.0,
so their stated values are exact cost units.

One older T-050 test now passes its already-defined `WIDE_BAND` option explicitly. Its
contract is uncapped headroom math; depending implicitly on the former 700k ceiling made that
isolation accidental. Default-band behavior remains proven in the E-053/E-068 suite.

### `src/shelf/gather.test.ts`

- Pins the exact four-tier token map in one assertion.
- Pins formatted outputs `2h/40k`, `2h/25k`, `1h/13k`, and `15m/4k`.
- Updates the shaped high-tier action from 50k to 25k.
- Retains the token/time ordering proof.

The standard stored value is exactly 12,500; the existing `humanTokens` helper rounds to
whole thousands, so its display is `13k`. No formatting behavior was changed by this ticket.

### `src/play/chain-funding-band-e2e.test.ts`

The integration fixtures were re-expressed in cost units:

- propose p90 `82_954`, representative tail `86_000`;
- censored decompose actual `328_141`, whose doubled headroom is `656_282` and therefore
  caps at 350k;
- unbanded price sum `202_954` versus banded funding sum `525_000`.

The test continues to prove the band flows through the real pure cast-funding composition,
while wallet authorization remains based on the honest price and the shelf quote remains
unmodified.

### `src/play/chain-propose-decompose-core.test.ts`

The E-050 uncapped-headroom case now passes the existing wide-band option explicitly, for the
same isolation reason as the recalibrate unit case. Production chain behavior was not changed.

## Acceptance criteria assessment

> FUNDING_CEILING_TOKENS/FUNDING_FLOOR_TOKENS and TIER_BUDGET carry cost-unit values with
> the E-053/E-050 rationale re-derived in cost terms; recalibrate.test.ts and gather.test.ts
> assert the new magnitudes and that fundingEnvelope still caps a runaway at the cost ceiling.

- ✅ Funding constants carry cost-unit values: 175k floor / 350k ceiling.
- ✅ The E-050/E-053 rationale is re-derived from recorded cost-unit workload classes in
  production comments and RDSPI artifacts.
- ✅ `TIER_BUDGET` carries 40k/25k/12.5k/4k cost-unit values with time unchanged.
- ✅ `recalibrate.test.ts` asserts both constants, below/in/above-band behavior, and exact
  runaway capping at 350k.
- ✅ `gather.test.ts` asserts all four exact tier magnitudes and their rendered/action flow.
- ✅ Downstream chain integration proves the new defaults reach the cast path without leaking
  into price/authorization.

## Verification

Targeted:

- `bun test src/ledger/recalibrate.test.ts src/shelf/gather.test.ts
  src/play/chain-funding-band-e2e.test.ts`
  - 92 pass
  - 0 fail
  - 215 assertions
- `bun test src/play/chain-propose-decompose-core.test.ts`
  - 11 pass
  - 0 fail
  - 28 assertions

Full gate:

- `bun run check`
  - BAML client generation: pass
  - TypeScript typecheck: pass
  - 1,591 tests pass
  - 1 test intentionally skipped (real-dist acceptance absent)
  - 0 failures
  - 4,733 assertions
- `git diff --check`: pass before commit.

The full gate briefly observed concurrent T-068-02-01 tests referencing `overEnvelope` before
that ticket's matching production type landed. No out-of-scope files were modified; after the
concurrent change caught up, the final full gate passed cleanly.

## Scope and compatibility

No public symbol was added, removed, or renamed. Existing imports of the funding constants
and `TIER_BUDGET` continue to work. The established `Budget.tokens` field name remains even
though its semantics are now cost units; renaming that system-wide public dimension is not
part of S-068-01.

Independent explicit play defaults with similar numeric literals were not changed. They are
not consumers of `TIER_BUDGET`, and changing them by numeric resemblance would violate the
story's disjoint-file boundary.

No historical run record was rewritten and no model was called. Recalibration reads the raw
recorded buckets through the cost-weighted `totalTokens` seam, so historical prices recompute
for free as intended by S-068-01.

## Open concerns and limitations

1. **The one-half mapping is a policy calibration, not a universal conversion.** Each run's
   exact parity-to-cost ratio depends on bucket mix. The chosen values summarize the observed
   classes that originally warranted the fixed boundaries. Future ledger evidence may justify
   recalibration, especially if workload mix or model pricing changes.
2. **Tier priors remain hand priors.** They are denomination-correct but not per-play measured
   estimates. `recalibrate` supersedes them once sufficient successful history exists.
3. **Standard display rounds.** The exact 12,500 prior appears as `13k` because the existing
   shelf formatter only displays whole thousands. Tests make both the stored value and display
   behavior explicit; no precision is lost in allocation.
4. **Input-equivalent units retain the `tokens` name.** This is compatible with existing APIs
   but can require explanation to readers expecting a raw throughput count. The new comments
   provide that explanation.

## Critical issues needing human attention

None. Acceptance is met, the final repository gate is green, the implementation is committed,
and unrelated concurrent work was preserved.
