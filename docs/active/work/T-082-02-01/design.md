# Design — T-082-02-01 learned-window-capacity

## Decision summary

Add `src/play/lane-capacity.ts`, a pure learner over already-loaded `RunRecord` values. It will
return one discriminated result for every entry in `KNOWN_SEATS`. A lane is learned only when it
has at least one valid interval formed by two strictly time-ordered cap markers and the mean burn
of its intervals is positive. Learned results carry the mean observed window duration, mean
cost-weighted capacity, current rolling-window burn, current quota fraction, and sample count.
Every other case returns an explicit unlearned result with no numeric capacity or fraction.

## Public contract

```ts
export interface LearnedLaneCapacity {
  readonly seat: AgentSeat;
  readonly status: "learned";
  readonly windowMs: number;
  readonly windowCapacity: number;
  readonly currentBurn: number;
  readonly quotaFraction: number;
  readonly samples: number;
}

export interface UnlearnedLaneCapacity {
  readonly seat: AgentSeat;
  readonly status: "unlearned";
  readonly reason: "insufficient-cap-evidence" | "non-positive-capacity";
}

export type LaneCapacity = LearnedLaneCapacity | UnlearnedLaneCapacity;

export function learnLaneCapacities(
  records: readonly RunRecord[],
): readonly LaneCapacity[];
```

The exact reason names may be kept minimal, but the discriminant and absence of numeric learned
fields on the unlearned member are load-bearing. The following heat ticket can branch on
`status === "learned"` and strict TypeScript will prevent accidental quota invention.

## Evidence model

For one known lane:

1. Parse each record's `endedAt` once into an event timestamp.
2. Retain the timestamp for the ledger-as-of calculation even if the row has no known lane.
3. Retain a lane observation only when `seatOfExecution` exactly equals the lane.
4. Retain a cap boundary only when that lane observation has `capWindowExhausted`.
5. Sort lane observations by timestamp, preserving source order as a deterministic tie-breaker.
6. Pair adjacent cap boundaries with strictly increasing timestamps.
7. Treat `(previousCap, currentCap]` as one observed reset-window sample.
8. Sum `totalTokens(record)` for lane observations inside those bounds.
9. Average all positive-duration sample durations into `windowMs`.
10. Average all corresponding burns into `windowCapacity`.

The marker supplies occurrence, the row supplies lane/time/burn, and the algorithm supplies only
aggregation. It does not reinterpret marker `signal` or `reason`; settlement already classified it.

## Current-fraction model

The current result is explicitly ledger-current, not wall-clock-current:

- `asOf` is the maximum valid `endedAt` timestamp across the supplied ledger.
- The current interval is `(asOf - windowMs, asOf]`.
- `currentBurn` is the lane's canonical cost-weighted burn within that interval.
- `quotaFraction = currentBurn / windowCapacity`.
- The fraction is not clamped to `[0, 1]`.

This model keeps the core deterministic and clock-free. A cap at the latest timestamp participates
in the same duration-aligned rolling interval that produced the learned sample, so a simple stable
fixture reads exactly 1. Later ledger observations age old burn out. If burn exceeds the historical
mean, a value above 1 remains visible instead of being falsely presented as exactly full.

## Interval-boundary decision

Use an exclusive lower bound and inclusive upper bound for both learned and current windows.

- It assigns the current cap row to the window that it exhausted.
- It excludes the previous cap boundary row from the next capacity sample.
- It prevents a boundary row from being double-counted in adjacent samples.
- It makes adjacent sample ownership deterministic even when a cap row has nonzero usage.
- It gives the rolling current numerator the same semantics as the learned denominator.

Rows with the exact same timestamp as the lower cap are excluded. Rows at the upper cap timestamp
are included, regardless of source tie order, because timestamps cannot prove sub-event order.

## Aggregation decision

Use arithmetic means across every valid adjacent-cap sample.

- Every observed window contributes equally to learned per-window capacity.
- The result is transparent enough to reproduce by hand in unit tests.
- It uses accumulated marker history rather than silently preferring one recent sample.
- It avoids inventing confidence weights or provider-specific decay.
- Fractional weighted-token values remain valid and need no rounding.
- The sample count exposes how much interval evidence backed the learned result.

Duration and burn are averaged independently. Each adjacent cap pair is the observable unit called
a window by this ticket. Normalizing burn by duration would instead estimate a burn rate and then
reconstruct capacity through an additional model not requested by the story.

## Ordering decision

Use parsed event time, with original record index as a stable tie-breaker, rather than ledger append
order alone.

- Cap cadence is inherently temporal.
- Concurrent casts can settle and append in an order that differs from their end timestamps.
- Sorting a derived array does not mutate caller input.
- The original index makes output deterministic for equal timestamps.
- Equal cap timestamps still cannot form a positive-duration sample.

The public output order remains `KNOWN_SEATS` order, so callers get the same canonical registry
ordering as the existing lane-heat aggregation.

## Invalid-evidence decision

- An invalid `endedAt` row contributes neither burn nor a cap boundary.
- It also cannot advance the ledger-as-of point.
- A marked row with an unknown or missing seat does not count toward a known lane.
- Fewer than two valid cap boundaries yields `insufficient-cap-evidence`.
- Two cap boundaries with no positive time gap also yield `insufficient-cap-evidence`.
- A non-positive mean observed burn yields `non-positive-capacity`.
- No branch emits `NaN`, infinity, zero as an invented denominator, or a default quota.

The module is total over normalized `RunRecord` values. It does not throw for unusable optional
evidence because historical/partial knowledge is a normal state of the local ledger.

## Immutability decision

- Do not mutate `records` or any nested record.
- Build internal timestamped observation arrays.
- Freeze each public result object.
- Freeze the result array.

The repository does not require deep freezing every transient, but immutable public results make
the learned evidence safe to pass into later inference without accidental policy mutation.

## Option 1 — hard-code provider quotas and reset durations

This would map each lane to a published or assumed plan limit, then divide recent burn by it.

Advantages:

- A single cap event would not be necessary.
- Values could be available immediately on a fresh ledger.
- Reset arithmetic would be simple.

Rejected because:

- It violates the explicit never-invent-provider-quota rule.
- It breaks P5 by making local operation depend on external plan facts or stale copied facts.
- Seat identifiers are allocation lanes, not guaranteed provider-plan identifiers.
- Provider plans and quotas are mutable external policy.
- The story requires dormancy until evidence accrues.

## Option 2 — learn from the first ledger row through one cap marker

This would sum all lane burn before the first cap and call it one window.

Advantages:

- One cap marker could produce a capacity number.
- It uses only local records.
- The algorithm is small.

Rejected because:

- The ledger may begin in the middle of a provider reset window.
- The first row is not evidence of a reset boundary.
- One marker supplies no cadence.
- The result would convert an arbitrary history prefix into a provider quota fact.
- Explicit unlearned is more honest than false precision.

## Option 3 — use only the latest adjacent-cap interval

This would set duration and capacity from the two most recent cap markers.

Advantages:

- It adapts immediately if provider behavior changes.
- It avoids older observations affecting current estimates.
- It is very easy to explain.

Rejected because:

- The ticket says accumulated markers become a learned fact.
- It discards valid local evidence without a sourced decay policy.
- One anomalous or incomplete interval would dominate the result.
- The next ticket benefits from a stable aggregate rather than maximum recency sensitivity.

## Option 4 — median duration and capacity

This would use medians to resist anomalous cap intervals.

Advantages:

- Robust against outliers.
- Preserves a representative observed sample.

Rejected for this slice because:

- No outlier model or minimum evidence count is specified.
- Even-sized medians introduce another averaging convention.
- Arithmetic mean more directly describes accumulated observed capacity.
- A later ticket can change the estimator only with new evidence and acceptance.

## Option 5 — burn rate multiplied by learned cadence

This would estimate burn/time for each interval, aggregate rates, then multiply by an aggregated
duration to reconstruct capacity.

Advantages:

- It can normalize intervals of unequal duration.
- It resembles a statistical rate model.

Rejected because:

- Cap-to-cap intervals are the story's observed reset-window units, not arbitrary exposure periods.
- Rate normalization adds a model beyond direct observed burn.
- A low-activity long interval can distort rate without disproving exhausted capacity.
- Direct per-interval burn remains the least assumptive sourced fact.

## Option 6 — accept a caller-supplied `now`

This would compute current burn against an explicit time argument.

Advantages:

- The result could age while no new run is appended.
- Tests would remain deterministic with a fixed argument.

Rejected for the current contract because:

- The ticket asks for a pure module over fabricated ledgers and forbids clock access.
- A caller-supplied time introduces a fact outside the ledger evidence.
- The story repeatedly describes the local ledger as the sole source.
- Ledger-current semantics are honest and sufficient for the following inference ticket.

## Option 7 — compute current burn since the most recent cap only

This would reset the numerator immediately after a cap boundary.

Advantages:

- It mirrors an event-sourced reset counter.
- It is simple to calculate.

Rejected because:

- A cap event marks exhaustion, not the provider's later reset instant.
- Immediate zero would claim fresh quota at the exact observed exhaustion point.
- Learned cadence would not participate in the current calculation.
- A cadence-aligned rolling interval preserves the exhausted burn until time evidence ages it out.

## Testing design

The colocated test suite will construct all rows with `buildRunRecord` and no filesystem helpers.

- A two-lane fixture will give each lane two cap boundaries and intervening weighted usage.
- Cap times will make window durations easy to compute by hand.
- Current ledger time will be advanced with ordinary records so current burn differs by lane.
- Assertions will pin `windowMs`, `windowCapacity`, `currentBurn`, and `quotaFraction` exactly.
- A weighted-output/cache fixture will prove `totalTokens` is reused instead of raw token parity.
- An empty/no-cap lane will assert the exact unlearned object and absence of numeric fields.
- A one-cap lane will remain unlearned because it has no cadence interval.
- Multiple intervals will prove arithmetic averaging and sample count.
- Input immutability and canonical output order will be pinned.
- Focused tests plus full `bun run check` form the implementation gate.

## Scope controls

- Create only `src/play/lane-capacity.ts` and `src/play/lane-capacity.test.ts`.
- Do not modify `lane-heat.ts`; its integration belongs to `T-082-02-02`.
- Do not modify the run-log marker or schema.
- Do not load `.vend/runs.jsonl`.
- Do not change budget/wallet algebra.
- Do not add provider constants, network calls, dashboards, or executor behavior.
- Commit the two source paths together through one exact-path `lisa commit-ticket` transaction.

## Design conclusion

Adjacent cap markers are the only sourceable reset-window boundaries now available. Treating their
positive-time intervals as samples, averaging their observed duration and cost-weighted burn, and
measuring a same-duration rolling numerator at the ledger's own latest timestamp produces a small,
deterministic capacity fact. A discriminated unlearned branch preserves the most important promise:
where the local history cannot prove quota, Vend returns no quota number at all.
