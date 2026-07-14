# Plan — T-068-01-04 redenominate fixed ceilings

## Implementation strategy

Change the two fixed policy surfaces in place, retain their existing public interfaces and
algorithms, and strengthen the direct tests so both exact new magnitudes and behavior are
visible. Then run the complete suite to identify downstream tests coupled to the old numeric
denomination.

## Step 1 — Re-denominate the funding band

Modify `src/ledger/recalibrate.ts`:

1. Set `FUNDING_FLOOR_TOKENS` to `175_000`.
2. Set `FUNDING_CEILING_TOKENS` to `350_000`.
3. Rewrite the two doc comments in cost-unit terms.
4. Preserve the E-050/E-053 reasoning: approximately two-times room over the ordinary
   propose class and a hard wall at the heavy decompose/runaway class.
5. Do not alter `fundingEnvelope`, `bandTokens`, option defaults, or time behavior.

Independent verification: build/typecheck should see no API change.

## Step 2 — Rebase the funding-band unit fixtures

Modify `src/ledger/recalibrate.test.ts` within the existing E-053 suite:

1. Rename test prose/comments from 350k/700k parity values to 175k/350k cost values.
2. Use a 200k censored actual so headroom computes 400k and the 350k ceiling binds.
3. Use 225k as an in-band measured price.
4. Retain the guard-versus-price snapshot proof.
5. Retain the wall-clock non-banding proof.
6. Pin exact constants at `175_000` and `350_000` while keeping finite-positive-integer and
   ordering assertions.

Run `bun test src/ledger/recalibrate.test.ts`.

Verification criteria:

- below-floor result equals 175k;
- in-band 225k passes unchanged;
- computed 400k runaway equals the 350k ceiling, not 400k;
- quoted result and wall clock remain unaffected;
- all pre-existing recalibration tests remain green.

## Step 3 — Re-denominate tier hand priors

Modify `src/shelf/gather.ts`:

1. Keep time fields unchanged.
2. Set token fields to `40_000`, `25_000`, `12_500`, and `4_000` for keystone, high,
   standard, and leaf respectively.
3. Rewrite the comment/examples to identify the values as cost-unit hand priors and record
   their historical re-denomination basis.
4. Leave `budgetForTier` and all action/menu logic unchanged.

Independent verification: direct calls to `budgetForTier` should return the same object
shape with only the token magnitudes changed.

## Step 4 — Pin all tier magnitudes in unit tests

Modify `src/shelf/gather.test.ts`:

1. Update formatted output expectations to `2h/40k`, `2h/25k`, `1h/13k`, `15m/4k`; the
   existing formatter rounds the exact 12,500 standard prior to whole thousands.
2. Add one exact `TIER_BUDGET` token-map assertion covering all four tiers.
3. Keep the monotonic keystone-versus-leaf assertion.
4. Update the shaped high-tier action expectation from 50k to 25k.

Run `bun test src/shelf/gather.test.ts`.

Verification criteria:

- all four magnitudes are exact and formatted correctly;
- time values remain unchanged;
- ordering remains monotonic;
- action shaping consumes the new high-tier prior without any logic change.

## Step 5 — Reconcile downstream funding-band integration proof

Inspect `src/play/chain-funding-band-e2e.test.ts` after the direct changes:

1. Replace old literal floor comparisons with imported constants.
2. Update denomination-specific comments and test names.
3. Adjust only fixtures whose old magnitude changes the intended logical branch.
4. Preserve the integration claims: chain resolution gets the floor/ceiling, wallet
   authorization uses price, and funding guard sums do not become the quote.

Run `bun test src/play/chain-funding-band-e2e.test.ts`.

Do not modify unrelated play defaults or tests whose explicit budgets do not consume either
policy constant.

## Step 6 — Full verification

Run in order:

1. `bun run check:typecheck` for the fast compile boundary.
2. `bun run check` for BAML generation, typecheck, and the complete test suite.
3. Inspect `git diff --check` for whitespace errors.
4. Inspect `git diff` and `git status --short` to ensure the ticket frontmatter was not
   changed by this work and unrelated pre-existing changes were preserved.

If a full-suite failure is an exact old-denomination expectation, update only the affected
test/comment and document the deviation. If it exposes a production consumer that truly owns
one of these constants, make the smallest coherent correction and record it before proceeding.

## Step 7 — Progress record and commit

Write `progress.md` with:

- each completed step;
- targeted/full test counts and outcomes;
- downstream files adjusted;
- deviations from this plan;
- known pre-existing worktree changes left untouched.

Commit the implementation and work artifacts atomically with a ticket-referencing message,
subject to the shared worktree remaining safe to stage selectively. Stage only files owned by
T-068-01-04; never stage unrelated Lisa/provenance, orphan-graph, or other ticket artifacts.

## Step 8 — Review handoff

Write `review.md` after implementation and verification. It must summarize:

- exact production/test files changed;
- the new values and their empirical rationale;
- acceptance-criterion coverage;
- targeted and full test results;
- open concerns, especially that a fixed one-half policy mapping summarizes variable bucket
  mixes and is not a universal per-run conversion;
- any critical issue needing human attention.

Stop after `review.md`; do not update ticket phase or status.

## Rollback shape

The change is constants/comments/tests only. A rollback restores the four prior token values
and the two prior band values together. Partial rollback is invalid because it would leave
cold-start and runaway policy in different denominations.
