# Progress — T-068-01-04 redenominate fixed ceilings

## Status

Implementation complete. Direct, downstream, and repository-wide verification are green.

## Completed work

### Step 1 — funding band re-denominated

`src/ledger/recalibrate.ts` now exports:

- `FUNDING_FLOOR_TOKENS = 175_000`
- `FUNDING_CEILING_TOKENS = 350_000`

The adjacent comments now define the values as fresh-input-token-equivalent cost units and
carry the E-050/E-053 empirical rationale: the old ~170–176k parity propose class is ~83k in
cost units, while the old ~700–733k heavy decompose class is ~328–345k in recorded cost.

No funding algorithm, interface, override, price, percentile, censoring, or time behavior
changed.

### Step 2 — funding proofs rebased

`src/ledger/recalibrate.test.ts` now proves:

- below-floor measured funding lands at exactly 175k;
- a 200k censored actual receives 2x headroom to 400k and is capped at exactly 350k;
- 225k is in-band and passes through;
- guard remains separate from price/label;
- wall-clock remains unbanded; and
- both new constants are finite positive integers with floor below ceiling.

One older T-050 headroom test was made explicit about its existing isolation intent by passing
the already-defined `WIDE_BAND`; otherwise the new default 350k wall correctly caps its 529,732
synthetic headroom result.

### Step 3 — tier priors re-denominated

`src/shelf/gather.ts` keeps time values unchanged and now stores:

| tier | time | cost-unit prior |
|---|---:|---:|
| keystone | 2h | 40,000 |
| high | 2h | 25,000 |
| standard | 1h | 12,500 |
| leaf | 15m | 4,000 |

The comment names the values as cost units and records the representative historical ~0.5
policy conversion. No gather/action/menu algorithm changed.

### Step 4 — tier tests pinned

`src/shelf/gather.test.ts` adds an exact four-tier token map and updates the formatted/action
expectations. The standard 12,500 value renders `13k` because the pre-existing formatter
rounds to whole thousands; the exact assertion prevents that display rounding from obscuring
the stored value.

### Step 5 — downstream funding integration reconciled

`src/play/chain-funding-band-e2e.test.ts` re-expresses its historical fixtures in cost units:

- propose p90 82,954 with a representative 86,000 tail;
- decompose censored actual 328,141, whose 2x headroom is capped at 350k;
- band sum 525k remains distinct from the 202,954 price sum.

It continues to prove the band flows through `fundedStepDefault`/`resolveStepBudgets`, wallet
authorization remains price-based, and the quote remains untouched.

`src/play/chain-propose-decompose-core.test.ts` had the same old E-050 isolation dependency as
the recalibrate suite. Its one uncapped-headroom case now passes the existing `WIDE_BAND`
option explicitly.

## Verification record

### Green

- `bun test src/ledger/recalibrate.test.ts src/shelf/gather.test.ts
  src/play/chain-funding-band-e2e.test.ts` — **92 pass, 0 fail, 215 assertions**.
- `bun test src/play/chain-propose-decompose-core.test.ts` — **11 pass, 0 fail,
  28 assertions**.
- `bun run check:typecheck` — green before the concurrent T-068-02-01 test-only edits landed.
- First `bun run check` reached the full suite after successful BAML generation and typecheck:
  **1584 pass, 1 skip, 1 fail**. The sole failure was this ticket's old T-050 isolation
  fixture; it was corrected and its owning suite is now green.
- `git diff --check` — green.
- Final `bun run check` after the concurrent field/type caught up — **1591 pass, 1 skip,
  0 fail, 4733 assertions**; BAML generation and TypeScript typecheck green.

### Transient shared-checkout gate condition (resolved)

After the above correction, a second `bun run check` regenerated BAML successfully but stopped
at typecheck because concurrent T-068-02-01 added `overEnvelope` tests to
`src/log/run-log.test.ts` before adding that field to `RunRecordInput`/`RunRecord`. TypeScript
reported nine `TS2551`/`TS2561` errors on that unrelated field. The concurrent ticket then
added the matching production fields; the final full gate is green. Its files are outside
S-068-01/T-068-01-04 and were not edited here.

## Deviations from plan

1. Design initially described the exact 12,500 standard prior as rendering `12.5k`. Inspection
   of `humanTokens` showed it rounds to whole thousands. Design/Structure/Plan were corrected
   before production implementation; the stored value remains exactly 12,500 and renders `13k`.
2. Two older E-050 tests depended implicitly on the former high default ceiling while their
   comments said they isolated headroom with a wide band. Both now pass the pre-existing
   `WIDE_BAND` option explicitly.
3. The final gate briefly observed concurrent T-068-02-01 tests ahead of their production
   type. No out-of-scope repair was attempted; after that ticket caught up, the gate passed.

## Worktree ownership

Ticket-owned paths are the six source/test files listed above and this work directory.
Pre-existing/concurrent `.lisa/provenance.jsonl`, ticket phase transitions, E-068 cards,
T-068-02-01 run-log tests, and orphan-graph files were preserved and are not part of this
implementation.
