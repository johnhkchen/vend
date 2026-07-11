# Design — T-068-01-04 redenominate fixed ceilings

## Decision

Re-denominate the token-only fixed policy values by the representative one-half conversion
shown by the historical E-050/E-053 run classes:

```text
funding floor:   350,000 parity -> 175,000 cost units
funding ceiling: 700,000 parity -> 350,000 cost units

keystone prior:  80,000 parity -> 40,000 cost units
high prior:       50,000 parity -> 25,000 cost units
standard prior:   25,000 parity -> 12,500 cost units
leaf prior:        8,000 parity ->  4,000 cost units
```

Keep all algorithms, interfaces, option names, time values, and guard-versus-price behavior
unchanged. Update the direct unit fixtures to demonstrate the new magnitudes and retain the
existing behavioral coverage, including a cost-unit runaway capped at exactly 350k.

## Why one-half is the policy conversion

There is no universal scalar from parity totals to cost totals: the true conversion is the
bucket-weighted formula and depends on each run's mix. Fixed ceilings nevertheless need
stable integers. The sound basis is therefore the population/class that originally warranted
each policy value, not algebra on an imaginary average token.

The old floor protected a roughly 170–176k parity propose. Current raw-bucket records put
the corresponding upper propose class at about 83k cost units. Doubling that class, matching
E-050's explicit headroom policy, lands near 166k; 175k preserves the original round-number
margin.

The old ceiling rejected a roughly 733k parity decompose self-funding class. Current heavy
decompose records recompute to roughly 328–345k cost units. A 350k ceiling sits immediately
above an honest finish in that class but caps further headroom-driven escalation. This is the
same P7 boundary expressed in the meter's new denomination.

Using the same one-half policy factor for `TIER_BUDGET` keeps cold-start priors internally
coherent with the band and preserves their relative leverage ratios. The priors remain hand
priors; they are not presented as measured per-play distributions.

## Options considered

### A. Historical-class re-denomination to `[175k, 350k]`, halve priors — chosen

Advantages:

- Preserves the original E-050/E-053 semantics against the same classes of work.
- Grounds both endpoints in raw bucket evidence already recorded in the ledger.
- Keeps a simple, reviewable relation between old and new fixed policy numbers.
- Puts the E-068 525k parity example comfortably inside a sane hard ceiling.
- Makes tier defaults and the funding band share the same denomination immediately.

Tradeoff: bucket mixes vary, so the one-half mapping is a policy calibration, not an exact
identity for every run. That limitation already exists whenever a fixed ceiling summarizes a
distribution and is stated in comments/tests rather than hidden.

### B. Leave the existing numbers unchanged — rejected

After `totalTokens` becomes cost-weighted, `[350k, 700k]` denotes approximately twice the
economic magnitude it did for the motivating runs. The floor would fund ordinary casts far
above their true-cost class and the ceiling would no longer reject the historical runaway
class. That violates the ticket's purpose and P7.

### C. Derive constants mechanically from `COST_WEIGHTS` at runtime — rejected

A single expression such as `OLD_CEILING * COST_WEIGHTS.cache_read` would assume all usage is
one bucket, while an arithmetic mean of the weights would assume an invented bucket mix.
Importing `COST_WEIGHTS` into recalibrate/gather would create coupling without yielding a
correct conversion. The constants encode policy over observed workload classes; the counting
functions encode per-run arithmetic.

### D. Replace fixed constants with dynamic ledger percentiles — rejected

`recalibrate` already dynamically prices plays. The funding band is deliberately an outermost
hard wall, and `TIER_BUDGET` is deliberately a cold-start fallback. Making either depend on
the ledger would erase the stable boundary they provide and expand scope into policy and I/O.

### E. Pick the exact maximum observed cost as the ceiling — rejected

Using 344,842.05 or another snapshot-specific maximum overfits one ledger state and produces
a falsely precise policy. A rounded 350k wall is explainable, stable, and provides a small
margin for an honest completion while still cutting off escalation.

## Funding test design

The E-053 test suite will be renamed in prose to cost-unit terminology while retaining its
structure:

- Below floor: five small measured successes produce a price below 175k; funding is 175k,
  `widened` remains false, and time is unchanged.
- Above ceiling: a prior-source record at 200k cost units receives `2x` headroom to 400k,
  then is capped at the 350k hard wall. This directly proves the ticket's runaway AC.
- In band: a measured 225k price passes through unchanged.
- Guard versus price: the capped funding result does not mutate the recalibrated price or
  label.
- Time independence: the token cap binds while time keeps its E-038 behavior.
- Overrides: existing synthetic 10k/20k coverage remains valid.
- Constants: exact pins move to 175k/350k and retain positive-integer/order assertions.

The downstream chain integration proof will replace its one literal old-floor assertion with
the imported constant and update old-magnitude comments/fixture wording. Its pricing/funding
logic remains unchanged.

## Tier test design

`gather.test.ts` will assert the four new formatted values:

- keystone `2h/40k`
- high `2h/25k`
- standard `1h/13k` (the stored value is exactly 12,500; the existing formatter rounds
  thousands for display)
- leaf `15m/4k`

The shaped high-tier action expectation moves from 50k to 25k. The existing ordering test
remains, and an exact object assertion will pin all four token magnitudes in one place so the
re-denomination cannot partially regress.

`formatBudget` already rounds token counts to whole thousands; no menu implementation change
is required, so 12,500 renders as `13k` while the exact-value assertion pins 12,500.

## Documentation stance

Comments next to the constants will state both the old motivating observation and its
cost-unit recomputation. Names retain the `_TOKENS` suffix for compatibility: throughout the
project `Budget.tokens` is the established field name even though its semantic unit is now
fresh-input-token-equivalent cost. Renaming the public budget dimension is a migration well
beyond this ticket.

## Compatibility and risk

The public API shapes are unchanged and imports continue to resolve. Consumers of the funding
constants automatically see the new guard. Consumers of `budgetForTier` automatically see
the new priors. Explicit per-call funding overrides and explicit play budgets are unaffected.

The main regression risk is an old exact numeric assertion outside the direct suites. Full
test execution is required to find those dependents. Changes will be limited to assertions
and comments whose premise is the old denomination; unrelated explicit budgets remain
untouched.
