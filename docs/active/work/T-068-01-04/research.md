# Research — T-068-01-04 redenominate fixed ceilings

## Ticket and story boundary

T-068-01-04 starts in `phase: research` and belongs to S-068-01, whose scope is the
token-accounting seam and the fixed magnitudes that sit on top of it. This ticket owns two
policy surfaces: the funding band in `src/ledger/recalibrate.ts` and the tier hand priors in
`src/shelf/gather.ts`, plus their tests. It does not own the weighting functions themselves.

The prerequisite T-068-01-01 pinned the canonical relative-cost vector in
`src/budget/budget.ts`: input `1.0`, cache read `0.1`, five-minute cache creation `1.25`,
and output `5.0`. T-068-01-02 and T-068-01-03 apply that vector to `countTokens` and the
run-log's deliberately inlined `totalTokens` mirror. At the current checkout both counting
paths are already cost-weighted, so every `RunRecord` is interpreted in input-token-equivalent
cost units without rewriting `.vend/runs.jsonl`.

S-068-01 explicitly excludes changes to recalibration, walk-away, spending, and wallet
algorithms: those consumers recompute from the newly weighted totals. It also excludes live
metered casts and historical ledger mutation. This ticket changes fixed magnitudes only.

No `AGENTS.md` exists under this repository or its parent directory. `CLAUDE.md` identifies
the Bun/TypeScript toolchain and points to the RDSPI workflow, but contains no additional
ticket-specific rules.

## Existing funding band

`src/ledger/recalibrate.ts` defines the measurement-funding seam after `recalibrate`:

- `MEASUREMENT_HEADROOM = 2` gives an under-calibrated cast twice its price or twice the
  largest censored actual, whichever is relevant.
- `CENSORED_WIDEN_RATE = 1/3` decides when a measured play is under-calibrated.
- `FUNDING_FLOOR_TOKENS = 350_000` is the minimum token guard.
- `FUNDING_CEILING_TOKENS = 700_000` is the maximum token guard.
- `FundingOptions.floorTokens` and `.ceilingTokens` permit per-call overrides.
- `bandTokens` applies the band after headroom as the outermost token bound.
- `fundingEnvelope` applies the band on both the trusted-measured early return and the
  under-calibrated return. Wall-clock funding is never banded.

The band is guard policy, not price policy. `fundingEnvelope` never mutates the
`RecalibrateResult`; callers authorize against the recalibrated price while individual casts
run under the funding guard. The `widened` flag is computed before banding so a floor or cap
does not change its E-050 meaning.

The current comments and values are denominated in the old parity sum. E-053 chose them from
two operational observations: a propose cast exhausted around 176k against a roughly 170k
price, and an under-calibrated decompose could self-fund around 733k. The floor was roughly
twice the ordinary propose magnitude; the ceiling rejected the decompose runaway class.

## Cost-unit evidence for the same classes

`.vend/runs.jsonl` retains all four raw usage buckets. Applying the prerequisite vector shows:

| observed class | parity total | cost-weighted total |
|---|---:|---:|
| propose success | 88,289 | 44,307 |
| propose success | 177,789 | 82,954 |
| propose success | 106,757 | 68,016 |
| decompose budget-exhausted | 919,211 | 328,141 |
| decompose success | 840,161 | 344,842 |

The largest current propose observation is approximately 83k cost units, close to half of
the old 170–176k parity exemplar. Twice that observation is approximately 166k. The
decompose runaway/finish class occupies approximately 328–345k cost units, close to half of
the old ~700–733k ceiling class.

E-068's boilerplate-demo evidence has the same shape: 525,180 old units are dominated by
443,711 cheap cache reads, with 23,965 output tokens and a cache-creation remainder. Under
the confirmed weights it lands around the low-to-mid 200k cost-unit range rather than above
the old parity ceiling. Raw totals cannot be converted by a universal mathematical scalar,
because each run has a different bucket mix, but the historical classes relevant to E-053
cluster around a one-half policy re-denomination.

## Existing funding tests

`src/ledger/recalibrate.test.ts` builds real frozen `RunRecord` fixtures through
`buildRunRecord`, then feeds real `recalibrate` results into `fundingEnvelope`. Its E-053
suite covers:

- below-floor measured funding;
- above-ceiling under-calibrated funding;
- an in-band value that passes through;
- guard/price separation;
- wall-clock non-banding;
- option overrides; and
- finite positive integer constants ordered floor below ceiling.

The fixtures put their `tokens` entirely in `input_tokens`. Therefore the fixture's stated
token number is also its cost-weighted number; no bucket conversion occurs inside these
specific tests. The current in-band fixture is 450k and the runaway fixture is 400k doubled
to 800k. Those magnitudes encode the old band and need corresponding fixture/comment changes
when the constants move.

`src/play/chain-funding-band-e2e.test.ts` is a downstream integration proof. It imports the
band constants, so most exact expectations follow automatically, but it also contains a
literal `>= 350_000` assertion and old-magnitude prose. The test proves that pricing and
funding remain distinct through chain budget resolution.

## Existing tier priors

`src/shelf/gather.ts` owns `TIER_BUDGET`, a `Record<ValueTier, Budget>` used by
`budgetForTier`. Current values are:

| tier | time | parity token prior |
|---|---:|---:|
| keystone | 2h | 80,000 |
| high | 2h | 50,000 |
| standard | 1h | 25,000 |
| leaf | 15m | 8,000 |

These are hand priors for cold start, not measured recalibrated prices. The tier remains the
budget signal, and `--budget` can override it. Time values are a separate dimension and are
not affected by token cost denomination.

`src/shelf/gather.test.ts` pins all four formatted defaults, asserts tier ordering, and pins
the high-tier value in a shaped action fixture. It therefore provides the direct regression
surface requested by the ticket.

Other modules contain independent play defaults or test fixtures with similar-looking
numbers. Examples include `propose-epic.ts`, `note.ts`, and engine/wallet fixtures. They are
not consumers of `TIER_BUDGET` and are outside this ticket's named scope. Similar numeric
spelling alone does not make them part of the tier-prior policy.

## Constraints and invariants

- The token denomination changes; wall-clock values do not.
- The funding band remains the outermost bound after E-050 headroom.
- `FUNDING_FLOOR_TOKENS < FUNDING_CEILING_TOKENS`; both remain finite positive integers.
- `fundingEnvelope` must still cap a computed runaway exactly at the ceiling.
- Guard and quoted price remain separate; no recalibration percentile changes.
- Tier ordering remains monotonic from leaf through keystone on tokens and time.
- The implementation is pure constants, comments, and deterministic tests; no live model,
  filesystem mutation, or ledger rewrite is required.
- The ticket frontmatter phase/status fields must remain untouched; Lisa advances them from
  artifacts.

## Verification surface

Targeted unit verification is `bun test src/ledger/recalibrate.test.ts
src/shelf/gather.test.ts`. Because the constants flow into chain integration tests and
formatted output, the final verification must also run the full project gate, `bun run
check`, which regenerates BAML, typechecks, and runs all tests.
