# Design — T-082-02-02 quota-fraction lane heat

## Decision summary

`inferDefaultSeat` will use learned quota fractions only when every canonical lane has a learned
capacity fact. It will select the unique lowest fraction with no relative-ratio threshold and emit a
stable percentage-based reason. If any lane is unlearned, it will delegate to the pre-existing
relative-burn algorithm unchanged. Existing consumers remain untouched because they already copy the
returned reason verbatim into `seatInferred`.

## Goals

- Prefer the lane with the most remaining learned reset-window capacity.
- Use only locally observed cap-window evidence.
- Never synthesize a fraction for an unlearned lane.
- Preserve E-071 fallback results and exact reason bytes.
- Keep inference pure and total over supplied records.
- Keep the lane registry and token numeraire single-sourced.
- Make quota provenance legible to a human reviewing the ledger.
- Preserve over-cap fractions rather than clamping them.
- Prove the end-to-end marker path without modifying consumers.

## Non-goals

- No provider quota constants or API lookup.
- No confidence model, decay, or outlier rejection.
- No new wallet or budget dimension.
- No live quota monitor.
- No retry, interception, or mid-run rerouting.
- No new routing seats.
- No ledger schema change.
- No rewrite of historical records.
- No wall-clock refresh of current fraction.

## Option 1 — always use relative burn

Keep `inferDefaultSeat` unchanged and expose capacity elsewhere.

### Advantages

- Zero compatibility risk.
- No new branching in lane heat.

### Rejection

- It does not satisfy the ticket.
- It leaves the near-cap supervision gap open.
- It discards the learned denominator produced by the dependency ticket.
- Provenance remains in raw relative multiples.

## Option 2 — rank every lane, treating unlearned as zero

Map unlearned lanes to `quotaFraction = 0` and rank the combined set.

### Advantages

- Always returns a quota-shaped ranking.
- Makes unlearned lanes appear maximally available.

### Rejection

- Zero is a numeric quota claim unsupported by evidence.
- It violates the predecessor union's explicit honest-empty contract.
- It could route work into a lane whose true window is already exhausted.
- It would make absence of evidence stronger than measured evidence.

## Option 3 — rank learned lanes and ignore unlearned lanes

Compare only members with `status === "learned"`.

### Advantages

- Never invents a denominator.
- Uses available fraction evidence immediately.

### Rejection

- Excluding an unlearned lane from candidacy effectively assigns it an unstated policy value.
- The omitted lane might be the coolest or hottest lane.
- A single learned lane cannot establish a comparative default.
- The result would not rank the complete known-seat registry.
- Behavior would become sensitive to which provider happened to yield cap samples first.

## Option 4 — require all lanes learned, otherwise relative fallback

Narrow every returned capacity fact to the learned branch. If narrowing fails for any known lane,
run the E-071 algorithm over the same records.

### Advantages

- Every quota comparison has a sourced numerator and denominator.
- The full registry participates.
- Fresh and partially observed ledgers retain known behavior.
- No synthetic numeric default is required.
- This is directly compatible with the predecessor union.

### Cost

- Quota routing remains dormant until every known lane has sufficient local evidence.
- A learned lane cannot influence quota policy while a peer is unlearned.

### Decision

Choose Option 4. Dormancy is explicitly part of the story's honest boundary, while assigning a
number or implicit ordering to an unlearned lane would be dishonest.

## Quota selection policy

1. Call `learnLaneCapacities(records)` once.
2. Require at least two canonical capacity facts.
3. Narrow every fact to `LearnedLaneCapacity`.
4. If narrowing fails, execute the relative fallback.
5. Sort a copy ascending by `quotaFraction`.
6. Take the first member as the coolest candidate.
7. If the second member has the same fraction, the minimum is ambiguous; return `null`.
8. Otherwise return the unique coolest lane.

The sort does not mutate the frozen learner result. The predecessor guarantees finite,
non-negative fractions, and this ticket consumes them without revalidation or clamping.

## Why there is no 2x quota threshold

`HOT_LANE_RATIO` exists because raw burn has no absolute denominator. A 150-vs-100 raw difference
could be normal variation and says nothing about provider headroom. Learned fractions normalize each
lane against its observed window capacity. Keeping the 2x threshold after normalization would make
an 85%-used lane and a 50%-used lane look non-decisive, preserving the supervision gap this epic is
meant to close.

The learned path therefore uses ordinal ranking directly. Exact ties remain unrouted because they do
not identify a unique coolest lane. No additional near-cap threshold is introduced because the ticket
names no such threshold and asks the function to rank lanes by fraction.

## Tie behavior

- All learned fractions equal: `null`.
- Two or more lanes share the minimum: `null`.
- A unique minimum with a tied hotter group: choose the unique minimum.
- Over-cap values remain comparable as values greater than one.
- Registry order never breaks a minimum tie.

Only minimum uniqueness matters on the quota path. Unlike the relative ratio reason, quota evidence
does not need a unique hottest lane to justify the lane with the greatest remaining headroom.

## Fallback preservation

The current algorithm will move into a private `inferByRelativeBurn` helper without semantic edits.
The following stay identical:

- final-100-record slicing;
- `totalTokens` aggregation;
- unknown-seat filtering;
- all-zero behavior;
- hottest/coolest tie checks;
- 2x ratio threshold;
- zero-vs-positive wording;
- exact relative reason construction;
- frozen result shape.

The exported function becomes a dispatcher. Existing no-cap fixtures enter the fallback, so their
unchanged assertions pin byte compatibility.

## Quota reason format

Use one stable sentence:

```text
learned quota fraction: claude at ~85% of learned window; codex at ~20% of learned window; routing to codex
```

Properties:

- Each lane appears in canonical learner/registry order.
- Every fraction is rendered with `Math.round(fraction * 100)`.
- The `~` honestly signals display rounding.
- The words `learned window` identify the local evidence basis.
- The chosen lane is stated explicitly.
- Fractions above one render above 100%, preserving observed overage.
- No provider plan, reset duration, or invented quota number appears.

The exact example substring from acceptance is present when the fraction is `0.85`.

## Alternative reason formats considered

### Only name the hottest lane

Example: `claude at ~85% of learned window`.

Rejected as the complete format because it omits the chosen lane's comparative evidence. The phrase
will still appear inside the selected full sentence.

### Render raw decimals

Example: `claude=0.85`.

Rejected because the acceptance explicitly asks for human quota-fraction language and a percent-style
example.

### Clamp at 100%

Rejected because the capacity learner deliberately exposes unclamped fractions. Clamping would erase
meaningful overage and could create false ties.

### Use locale percentage formatting

Rejected because locale-sensitive output is unstable ledger provenance. Integer string construction
is deterministic.

## Module organization

`src/play/lane-heat.ts` will contain three policy layers:

1. Existing relative aggregation and reason helpers.
2. New quota percentage/reason and learned-ranking helpers.
3. Exported dispatch based on capacity completeness.

The module will import `learnLaneCapacities` as a runtime value and
`LearnedLaneCapacity` as a type. The run-log and seat imports remain because the fallback still owns
their canonical definitions.

## Pure test design

Add fixtures after the current relative fixtures/tests so the existing suite body remains unchanged.
Fabricated records will use normalized `buildRunRecord` values with explicit timestamps and cap
markers.

Cases:

1. Different absolute capacities where raw burn prefers one lane but quota fraction prefers the other.
2. Exact reason string containing `claude at ~85% of learned window`.
3. Symmetric quota ordering.
4. Equal quota fractions return `null`, even with unequal raw burn.
5. One learned and one unlearned lane executes the exact relative fallback.
6. Over-cap fractions are ranked unclamped.

The first case is the strongest policy test because it proves inference actually consumes the learned
denominator rather than coincidentally returning the same seat as relative heat.

## End-to-end test design

Add a cap-marked ledger fixture beside `writeLaneHeat` in `src/engine/cast.test.ts`. Drive the existing
BAML-free decompose-shaped play through real `decomposeEffect`, materialization, cast settlement, and
run-log serialization. Assert:

- materialized tickets use the quota-selected lane;
- the terminal `seatInferred.reason` equals the pure policy's exact reason;
- `reviveRecord` preserves the marker unchanged;
- no seat-default marker appears.

Keep the existing E-071 integration test unchanged so it continues proving the no-cap fallback reason.

## Commit design

Two meaningful Lisa transactions:

1. Pure policy unit: `src/play/lane-heat.ts` and `src/play/lane-heat.test.ts`.
2. Propagation proof: `src/engine/cast.test.ts`.

Each transaction will use exact repository-relative `--include` paths. No private attempt artifacts
will be included. The repository-wide gate will run after both units, and ticket-owned paths must be
clean before Review.

## Design acceptance mapping

- Rank by quota fraction: learned dispatcher plus unique-minimum selection.
- Quota wording: deterministic percentage reason.
- Verbatim marker: existing consumer path plus new cast integration assertion.
- Unlearned behavior: all-learned guard and untouched relative helper.
- Byte-compatible fallback: unchanged pre-existing lane-heat tests and existing exact cast reason.
- No invented quota: discriminated-union narrowing with no numeric substitute.
- P4/P7: autonomous choice in the learned binding denomination.
