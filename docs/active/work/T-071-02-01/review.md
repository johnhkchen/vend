# Review — T-071-02-01

## Outcome

PASS. The ticket acceptance contract is met, the full repository gate is green, and the meaningful
source unit is committed through Lisa as 484a1a2398e2d916e1306620fc5985abfa880ead.

## Summary

Vend now has a pure inferred-default-seat reader over already-loaded run records. It derives its lane
set from KNOWN_SEATS, derives per-record cost from run-log's totalTokens, bounds recency to the
append-ordered ledger tail, and only returns a cooler seat when recent relative burn is decisive.
Empty, unattributed, tied, ambiguous, and close-burn inputs remain unrouted.

## Files created

### src/play/lane-heat.ts

Introduces:

- LANE_HEAT_WINDOW = 100.
- HOT_LANE_RATIO = 2.
- InferredSeat with readonly seat and reason.
- inferDefaultSeat(records).

The reader builds buckets from KNOWN_SEATS, examines only the last 100 overall ledger records, and
adds totalTokens(record) when record.seatOfExecution exactly matches a current known seat. It ranks a
fresh copy of the buckets and returns only a unique coolest lane against a unique hottest lane with
at least 2x relative burn.

The module is pure. It has no fs, clock, executor, process, or network behavior. It does not import
loadRunLog and does not claim to know provider reset windows or quota values.

### src/play/lane-heat.test.ts

Adds nine normalized fixture tests using buildRunRecord. The suite covers the positive inference in
both directions, both-cool, tied, empty, unknown/unattributed, cost weighting, recency, and registry
source-of-truth behavior.

No existing source file was modified. No file was deleted.

## Acceptance review

### Clearly hot fixture returns cooler seat plus heat reason

PASS.

A fixture gives the first KNOWN_SEATS lane 300 weighted units and the second 100. The function returns
the second seat. The reason names recent cost-weighted burn, both seat totals, and the 3x imbalance.
A symmetric case proves the decision is not biased toward one registry position.

### Both-cool returns null

PASS.

The both-active fixture has a 150-to-100 difference. Because this is below the explicit 2x decisive
relative threshold, inferDefaultSeat returns null. The reader does not route on small measurement
differences.

### Tied returns null

PASS.

Equal positive attributed burn returns null. With future registry growth, tied coolest or hottest
extrema also return null rather than choosing by incidental order.

### Empty ledger returns null

PASS.

An empty array produces initialized zero buckets and returns null. A separate test proves that a
ledger containing only legacy-unattributed and unknown raw future seats also yields null.

### Lane list comes from KNOWN_SEATS

PASS.

Production imports and maps KNOWN_SEATS; it contains no hard-coded seat names. The test derives its
fixtures and expected result from the tuple. Adding a seat creates and ranks a bucket without a
reader source edit. More-than-two policy remains conservative when extrema are ambiguous.

### Burn reuses run-log totalTokens

PASS.

Production directly imports totalTokens. A regression test gives one lane 100 input tokens and the
other 50 output tokens. Raw parity would call the first lane hotter; totalTokens prices the output
as 250 input-token equivalents, so the reader correctly identifies the second as decisively hotter
and selects the first. This test would fail if aggregation silently reverted to raw parity.

### bun run check green

PASS.

- BAML generation passed.
- TypeScript typecheck passed.
- 1,639 tests passed.
- 1 expected skip.
- 0 failures.
- 4,960 expectations passed.

## Architecture assessment

The pure-core/impure-shell boundary is preserved. inferDefaultSeat accepts plain already-loaded
records and returns plain decision data. The later effect ticket retains ownership of loadRunLog and
materialization. The run log remains decoupled from routing policy; this play-layer consumer is the
correct place to join raw execution-seat provenance with the current routing registry.

The dependency direction is one-way:

`agent-seat + run-log -> lane-heat -> later effect`

No durable schema or existing output bytes change in this ticket.

## Heat policy assessment

The 2x threshold is deliberately a relative dominance policy, not a measured provider quota fact.
That judgment is necessary to distinguish a “clearly hot” fixture from a merely unequal both-cool
fixture with the substrate currently available. It is named, tested, and documented so it cannot
masquerade as hidden quota knowledge.

The 100-record tail follows the repository's existing bounded append-tail recency convention. It is
not a provider reset window. S-071-02 explicitly defers quota-per-reset-window denomination and cap
capture, so adding a clock duration or absolute token threshold here would have exceeded the honest
boundary.

## Test coverage assessment

Coverage is proportionate for a pure decision core and exercises each return boundary:

- decisive heat at and above policy threshold;
- non-decisive unequal activity;
- exact tie;
- no records;
- no attributable known-seat evidence;
- canonical weighted burn rather than raw counts;
- eviction of old evidence;
- tuple-derived seat identity.

The reason text is partially asserted at every load-bearing fact without pinning irrelevant sentence
punctuation. Input records are produced through the real run-log builder, so normalized usage and
optional seat semantics match production.

No filesystem test is needed because the module performs no filesystem work. No effect integration
test belongs here; T-071-02-03 owns ledger loading, explicit override, materialization, chain reuse,
and record-marker threading.

## Compatibility and risk

The change is additive and currently has no caller. It cannot alter existing mint behavior until the
dependent integration ticket adopts it.

The main policy risk is that a count-based 100-record horizon can differ from a real provider reset
window. This is visible and intentionally constrained by the story's honest boundary. The deferred
quota/reset work can replace or augment the policy when sourced facts exist.

A second risk is that zero observed burn on one known lane makes any positive peer decisively hotter.
That is appropriate for relative evidence but does not prove the positive lane is near quota. The
reason says only “positive burn vs zero,” avoiding a false infinite-ratio or quota claim.

A third risk is future registries with more than two lanes. The aggregation automatically includes
them, satisfying the no-reader-edit property. The uniqueness checks decline ambiguous extrema rather
than silently selecting an arbitrary lane. Full multi-lane scheduling policy remains outside the
current two-lane story.

## Commit and workspace hygiene

- Commit: 484a1a2398e2d916e1306620fc5985abfa880ead.
- Commit includes exactly the two new source/test files.
- Commit was made through lisa commit-ticket.
- No ordinary index staging or git commit was used.
- Ticket-owned source paths are clean.
- Unrelated workspace changes were preserved.
- Ticket frontmatter was not manually transitioned.
- Artifacts were written to the private attempt path; Lisa owns publication.

## Open concerns and known limitations

No blocking concern remains for this ticket.

Known limitations are intentional and assigned elsewhere:

- no 429/cap signal;
- no sourced reset-window duration;
- no lane quota denominator;
- no live mid-run rerouting;
- no ticket stamping;
- no seatInferred durable marker;
- no explicit --agent override integration;
- no per-ticket inference.

## Human review focus

Reviewers should focus on three load-bearing decisions:

1. The named 2x relative threshold is appropriate for “clearly hot” while close activity stays cool.
2. The overall 100-record tail is the intended recency horizon until reset facts exist.
3. The returned field name seat and reason shape align with the dependent marker/effect tickets.

Within the current story contract, the implementation is complete and honestly bounded.

