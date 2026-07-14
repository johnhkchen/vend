# Structure — T-068-01-04 redenominate fixed ceilings

## File map

| file | action | responsibility |
|---|---|---|
| `src/ledger/recalibrate.ts` | modify | new cost-unit funding floor/ceiling and rationale |
| `src/ledger/recalibrate.test.ts` | modify | exact magnitude pins and cost-unit runaway proof |
| `src/shelf/gather.ts` | modify | new cost-unit tier hand priors and rationale |
| `src/shelf/gather.test.ts` | modify | exact tier-prior pins and shaped-action expectation |
| `src/play/chain-funding-band-e2e.test.ts` | modify if required | keep downstream funding-band integration proof denomination-correct |
| `docs/active/work/T-068-01-04/progress.md` | create during implementation | execution and verification record |
| `docs/active/work/T-068-01-04/review.md` | create after verification | reviewer handoff |

No production file is created or deleted. No ticket frontmatter is edited.

## `src/ledger/recalibrate.ts`

Only the two exported numeric values and their adjacent documentation change:

```ts
export const FUNDING_FLOOR_TOKENS = 175_000;
export const FUNDING_CEILING_TOKENS = 350_000;
```

The documentation will define the `tokens` value as cost units / fresh-input-token
equivalents and re-state the empirical calibration:

- old propose tail class around 170–176k parity -> approximately 83k cost;
- the 175k floor keeps about two times room for a real cast;
- old decompose runaway class around 700–733k parity -> approximately 328–345k cost;
- the 350k ceiling is the new hard P7 wall.

The following remain byte-for-byte behaviorally unchanged:

- `FundingOptions` interface and override semantics;
- `FundingResult` interface;
- `fundDimension`;
- `bandTokens`;
- the two `fundingEnvelope` paths;
- `widened` calculation;
- time funding and recalibration.

This preserves module boundaries: recalibrate remains pure and does not import budget's
weight vector. The raw run records have already been converted by `totalTokens` at their
read seam.

## `src/ledger/recalibrate.test.ts`

The existing `fundingEnvelope — rational band` suite remains the home of the proof.
Fixture changes:

- old 400k censored runaway input -> 200k cost-unit input; E-050 headroom computes 400k,
  which is above the 350k ceiling;
- old 450k in-band price -> 225k cost-unit price, inside `[175k, 350k]`;
- price/quote and wall-clock cases use the same 200k runaway input;
- exact constant assertions change to 175k and 350k.

The suite will continue to feed actual `recalibrate` output to `fundingEnvelope`; no fake
`RecalibrateResult` is introduced. Since `recordOf` writes fixture tokens to `input_tokens`,
the values are exact cost units under the confirmed input weight of 1.0.

The test names/comments will describe cost-unit magnitudes, avoiding assertions whose label
still claims 350k is the floor or 700k is the ceiling.

## `src/shelf/gather.ts`

`TIER_BUDGET` keeps its public type and time values. Only token fields change:

```ts
export const TIER_BUDGET: Record<ValueTier, Budget> = {
  keystone: { timeMs: 7_200_000, tokens: 40_000 },
  high: { timeMs: 7_200_000, tokens: 25_000 },
  standard: { timeMs: 3_600_000, tokens: 12_500 },
  leaf: { timeMs: 900_000, tokens: 4_000 },
};
```

The adjacent comment will say these are cost-unit hand priors, re-denominated from their
parity predecessors using the representative historical ~0.5 conversion. It will continue
to state that measured fat tails may later calibrate them and `--budget` overrides them.

No changes to `budgetForTier`, action shaping, parsing, ranking, menu persistence, or I/O.

## `src/shelf/gather.test.ts`

The `budgetForTier` suite will pin formatted outputs and exact token fields. The formatting
expectations are `2h/40k`, `2h/25k`, `1h/13k`, and `15m/4k` (the formatter rounds the exact
12,500 standard prior to whole thousands). The existing monotonic tier
assertion remains.

The `signalsToActions` high-tier expected action changes its token budget to 25,000. This is
not a separate behavior change; it is the same exported policy flowing through the pure
shaping function.

## `src/play/chain-funding-band-e2e.test.ts`

This test imports both funding constants, so exact equality assertions need no code change.
Any literal assertion or fixture whose correctness depends on the old band will be adjusted:

- compare floor behavior to `FUNDING_FLOOR_TOKENS`, not literal 350,000;
- use cost-unit language and new values in suite/test comments;
- keep wallet-price assertions unchanged because they demonstrate GUARD != PRICE and use
  explicit quoted-price fixtures, not the fixed band denomination.

If the new ceiling changes a fixture's intended branch, the fixture magnitude will be
re-expressed to preserve the same logical case rather than relaxing the assertion.

## Public interface and dependency direction

No symbol is added, removed, or renamed. Existing downstream imports remain:

```text
recalibrate constants -> chain/work funding consumers
TIER_BUDGET -> budgetForTier -> shelf action shaping
```

There is no new reverse dependency on `src/budget/budget.ts`. The prerequisite's weights are
the rationale and the counting definition; fixed policy values remain local to their owning
modules.

## Change ordering

1. Update funding constants and direct tests together.
2. Update tier priors and direct tests together.
3. Run targeted suites and repair denomination-sensitive downstream tests only.
4. Run typecheck/full gate.
5. Record progress and review artifacts.

Each production edit is paired with its direct proof. The implementation can be committed as
one atomic ticket because the two constant surfaces jointly satisfy one acceptance criterion
and an intermediate half-denominated checkout would be misleading.

## Non-goals

- No modification to `COST_WEIGHTS`, `countTokens`, or `totalTokens`.
- No change to historical JSONL.
- No recalibration percentile or censoring logic change.
- No wallet, spend, walk-away, or gate behavior change.
- No renaming of `Budget.tokens` or the exported `_TOKENS` constants.
- No re-denomination of independent explicit play budgets merely because their literals
  resemble a tier prior.
- No live metered cast.
