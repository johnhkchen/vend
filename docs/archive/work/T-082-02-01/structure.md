# Structure — T-082-02-01 learned-window-capacity

## Change inventory

Create exactly two ticket-owned source files:

1. `src/play/lane-capacity.ts`
2. `src/play/lane-capacity.test.ts`

Do not modify or delete any existing source file. In particular, leave `src/play/lane-heat.ts`,
`src/log/run-log.ts`, budget/wallet modules, and cast/materialization consumers unchanged.

## Production module responsibility

`src/play/lane-capacity.ts` owns one pure transformation:

```text
readonly RunRecord[]
        +
KNOWN_SEATS / totalTokens
        |
        v
one learned-or-unlearned capacity fact per known lane
```

It does not own ledger loading, marker classification, routing policy, provider policy, clocks,
rendering, persistence, or provenance stamping.

## Imports

The production module has exactly two import sources:

```ts
import { totalTokens, type RunRecord } from "../log/run-log.ts";
import { KNOWN_SEATS, type AgentSeat } from "./agent-seat.ts";
```

- `totalTokens` is the only runtime import from the ledger module.
- `RunRecord` and `AgentSeat` are type-only imports.
- `KNOWN_SEATS` is the only runtime lane vocabulary.
- No `node:fs`, process, executor, budget, network, or BAML import is allowed.
- Global `Date.parse` may parse stored evidence; `Date.now` must not appear.

## Exported result types

### `LearnedLaneCapacity`

Fields:

- `seat: AgentSeat` — exact canonical lane.
- `status: "learned"` — discriminant.
- `windowMs: number` — arithmetic mean of valid adjacent-cap durations.
- `windowCapacity: number` — arithmetic mean of canonical weighted burn per sample.
- `currentBurn: number` — weighted burn in the learned-duration rolling interval.
- `quotaFraction: number` — `currentBurn / windowCapacity`, intentionally unclamped.
- `samples: number` — number of valid adjacent-cap intervals.

### `UnlearnedLaneCapacity`

Fields:

- `seat: AgentSeat` — exact canonical lane.
- `status: "unlearned"` — discriminant.
- `reason` — a closed literal explaining why no number exists.

It deliberately has no `windowMs`, `windowCapacity`, `currentBurn`, `quotaFraction`, or `samples`.

### `LaneCapacity`

A union of the learned and unlearned interfaces. This is the element type returned to the next
ticket. Consumers must narrow before numeric use.

## Exported function

```ts
export function learnLaneCapacities(
  records: readonly RunRecord[],
): readonly LaneCapacity[]
```

Contract:

- Pure and deterministic for equal record values.
- Total over normalized records, including invalid timestamp strings.
- Returns exactly one element per `KNOWN_SEATS` entry.
- Preserves `KNOWN_SEATS` order.
- Never mutates input records or the input array.
- Returns a frozen array of frozen result objects.
- Never returns an invented capacity for insufficient evidence.

## Internal observation shape

Define a private timestamped observation interface:

```ts
interface TimedRecord {
  readonly record: RunRecord;
  readonly at: number;
  readonly index: number;
}
```

Purpose:

- Parse `endedAt` only once.
- Keep the original row for `seatOfExecution`, marker presence, and `totalTokens`.
- Retain original position for deterministic equal-time sorting.
- Exclude invalid timestamps at construction.

This is a derived view only; no record is cloned or changed.

## Internal sample shape

Define a private interval sample interface:

```ts
interface WindowSample {
  readonly durationMs: number;
  readonly burn: number;
}
```

Only positive-duration adjacent-cap pairs create samples. `burn` may initially be zero; the mean
capacity gate decides whether those samples support a learned denominator.

## Internal helper boundaries

### Timestamp extraction

A small helper parses `endedAt` and returns a finite epoch or `null`.

- Treat `NaN` as invalid.
- Prefer a finite-number check so impossible numeric results never enter calculations.
- No current time or timezone configuration is read.

### Observation ordering

Create a derived array from `records.map`/iteration, discard invalid timestamps, then sort by:

1. ascending `at`;
2. ascending original `index` for equal timestamps.

The sorted array supplies both global `asOf` and per-lane filtering.

### Lane projection

For each `AgentSeat`, filter sorted observations where `record.seatOfExecution === seat`.

- Unknown raw seats are ignored for lane burn.
- Unattributed records are ignored for lane burn.
- Both remain in the global sorted array and can advance ledger-as-of time.

### Cap extraction

From lane observations, select rows where `record.capWindowExhausted !== undefined`.

- Do not inspect marker strings.
- Marker normalization is already the ledger boundary's responsibility.
- Preserve time ordering from the lane observation array.

### Sample building

Walk adjacent cap observations by index.

- `previous` is cap `i - 1`.
- `current` is cap `i`.
- Skip if `current.at <= previous.at`.
- Duration is `current.at - previous.at`.
- Burn is the sum over lane observations with `at > previous.at && at <= current.at`.
- Push one `WindowSample` for every valid pair.

An internal `burnBetween` helper may centralize the exclusive/inclusive boundary rule for both
sample and current calculations.

### Arithmetic mean

A private helper sums numeric values and divides by non-empty length. Call it only after checking
that samples are non-empty. It does not round.

### Lane learning

A private `learnLaneCapacity` helper receives:

- canonical `seat`;
- that seat's ordered observations;
- global ledger `asOf`.

It returns one `LaneCapacity`:

1. Build adjacent-cap samples.
2. If none, freeze an `insufficient-cap-evidence` result.
3. Average durations and burns.
4. If mean capacity is not positive/finite, freeze `non-positive-capacity`.
5. Set `currentStart = asOf - windowMs`.
6. Sum lane burn in `(currentStart, asOf]`.
7. Divide by positive `windowCapacity`.
8. Freeze the learned result.

The learned pair itself guarantees a valid timestamp, so `asOf` exists whenever learning can
succeed. The top-level function may still represent no valid observations with a harmless sentinel
because every lane will return insufficient evidence before using it.

## Numerical invariants

- `durationMs > 0` for every admitted sample.
- `windowMs > 0` for every learned result.
- `windowCapacity > 0` and finite for every learned result.
- `currentBurn >= 0` for normalized usage.
- `quotaFraction >= 0` and finite for every learned result.
- `samples` is a positive integer.
- No learned numeric is rounded or clamped.

If defensive checks discover a non-finite or non-positive capacity, return unlearned rather than
letting invalid arithmetic escape.

## Test module responsibility

`src/play/lane-capacity.test.ts` pins the entire public contract using fabricated `RunRecord`
fixtures. It must not read source text as a substitute for behavior and must not touch filesystem,
clock, provider, executor, or BAML seams.

## Test imports

```ts
import { describe, expect, test } from "bun:test";
import { learnLaneCapacities } from "./lane-capacity.ts";
import { KNOWN_SEATS, type AgentSeat } from "./agent-seat.ts";
import {
  buildRunRecord,
  type RunRecord,
  type UsageInput,
} from "../log/run-log.ts";
```

`totalTokens` may also be imported if a test explicitly states the hand calculation, but expected
values should primarily be literal calculations that detect accidental weighting changes.

## Fixture helper structure

Create a deterministic `record` helper accepting:

- `seatOfExecution`;
- `endedAt`;
- `usage`;
- optional cap-marker flag.

It calls `buildRunRecord` with:

- stable incrementing run IDs;
- fixed play/epic/model/outcome;
- a valid `startedAt` no later than `endedAt` where practical;
- a complete cap marker only when requested.

The fixture marker may use stable strings such as `http-429` and `provider reset-window capacity
exhausted`; the learner tests presence, not marker text.

## Primary two-lane acceptance fixture

Construct a simple shared timeline with two cap events per known lane.

Example hand-computable shape:

- Claude caps at minute 0 and minute 10.
- Claude burn in `(0, 10]` is 1,000 weighted tokens.
- Codex caps at minute 0 and minute 20.
- Codex burn in `(0, 20]` is 2,000 weighted tokens.
- Later ordinary rows advance global as-of and contribute current burn.
- The learned windows therefore differ while quota fractions can be asserted independently.

The actual fixture should avoid accidental cross-window inclusion and pin exact numbers.

Assertions per learned lane:

- canonical seat;
- `status: "learned"`;
- exact `windowMs`;
- exact `windowCapacity`;
- exact `currentBurn`;
- exact `quotaFraction`;
- exact `samples`.

This directly satisfies the ticket's each-lane hand-computation clause.

## Additional branch tests

1. No cap markers:
   - returns one unlearned object per known lane;
   - asserts numeric learned keys are absent with the `in` operator.

2. Only one cap marker:
   - remains `insufficient-cap-evidence` because cadence is unknown.

3. Multiple adjacent intervals:
   - proves arithmetic mean of duration and burn;
   - proves `samples` counts intervals, not cap rows.

4. Canonical weighted burn:
   - output and/or cache usage produces a result raw parity summing would fail.

5. Invalid/equal timestamps:
   - cannot create a positive-duration sample;
   - stays explicitly unlearned instead of returning invalid numbers.

6. Unknown seat:
   - never creates an extra output lane or contributes known-lane burn.

7. Immutability/order:
   - input ordering/value remains unchanged;
   - result is frozen;
   - result seats equal `KNOWN_SEATS` order.

Tests may combine closely related branches to keep the suite focused while still covering every
decision path.

## No-change boundaries

### `src/play/lane-heat.ts`

No import or behavior change. The dependency ticket will integrate learned results and preserve
the relative fallback.

### `src/log/run-log.ts`

No schema, serialization, marker, timestamp, or burn change. This ticket is a pure consumer.

### `src/engine/*` and other play effects

No consumer change. Existing reason propagation is already verbatim and belongs to the next ticket.

### `src/budget/*`

No quota denomination or wallet algebra. The epic explicitly defers that surface.

## Implementation and commit units

The production module and its colocated tests form one meaningful atomic source unit. Neither is
useful or acceptance-complete alone. After focused and repository-wide gates pass, commit exactly:

```text
src/play/lane-capacity.ts
src/play/lane-capacity.test.ts
```

Use a single `lisa commit-ticket` invocation with ticket ID `T-082-02-01`. Private attempt artifacts
are not passed as includes; Lisa admits and publishes them separately.

## Structural conclusion

The change is a new leaf module and test with two existing inward dependencies and no current
consumer edge. Its public union is deliberately narrow for the next ticket, its private helpers
separate timestamp evidence, interval sampling, and result construction, and its file boundary
keeps all fs/clock/provider concerns out of the core.
