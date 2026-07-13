# Structure — T-082-02-02 quota-fraction lane heat

## Change inventory

### Modify `src/play/lane-heat.ts`

- Import the learned-capacity provider.
- Preserve existing exported constants.
- Preserve the `InferredSeat` public interface.
- Preserve the existing relative reason bytes.
- Extract existing relative inference into a private helper.
- Add private quota formatting and ranking helpers.
- Make the exported function dispatch between learned and fallback paths.

### Modify `src/play/lane-heat.test.ts`

- Preserve all pre-existing tests unchanged.
- Add cap-marker and timestamp fixture helpers.
- Add a learned quota-fraction test group.
- Pin exact quota wording and fraction-based choice.
- Pin tie, partial-learning, symmetry, and over-cap behavior.

### Modify `src/engine/cast.test.ts`

- Add a helper that writes learned-capacity fixture records.
- Add one end-to-end quota inference test.
- Assert the exact reason in the settled `seatInferred` marker.
- Leave production consumer files unchanged.

### No created or deleted source files

The dependency already created the capacity module. This ticket integrates it at its only policy
consumer and adds coverage at established colocated seams.

## Production dependency graph

```text
readonly RunRecord[]
        |
        +-------------------------------+
        |                               |
        v                               v
learnLaneCapacities(records)     inferByRelativeBurn(records)
        |                               ^
        v                               |
all known lanes learned? ---- no -------+
        |
       yes
        v
inferByQuotaFraction(learned facts)
        |
        v
InferredSeat | null
        |
        v
decomposeEffect -> EffectResult.seatInferred -> cast settlement -> RunRecord.seatInferred
```

Only the first module in this chain changes. The downstream arrows already exist and copy the object
without translating its reason.

## `src/play/lane-heat.ts` imports

Existing imports remain:

```ts
import { totalTokens, type RunRecord } from "../log/run-log.ts";
import { KNOWN_SEATS, type AgentSeat } from "./agent-seat.ts";
```

Add:

```ts
import {
  learnLaneCapacities,
  type LearnedLaneCapacity,
} from "./lane-capacity.ts";
```

There is no cycle:

- lane heat imports lane capacity;
- lane capacity imports run log and agent seat;
- neither run log nor agent seat imports lane heat.

## Public surface

Keep these exports byte-compatible:

```ts
export const LANE_HEAT_WINDOW = 100;
export const HOT_LANE_RATIO = 2;

export interface InferredSeat {
  readonly seat: AgentSeat;
  readonly reason: string;
}

export function inferDefaultSeat(
  records: readonly RunRecord[],
): InferredSeat | null;
```

No consumer signature changes. No new public policy constant is needed because there is no quota
threshold.

## Existing relative types and helpers

Retain:

```ts
interface LaneBurn {
  readonly seat: AgentSeat;
  burn: number;
}
```

Retain `heatReason(hottest, coolest)` without changing concatenation, labels, numeric conversion, or
punctuation. Move the existing exported-function body into:

```ts
function inferByRelativeBurn(
  records: readonly RunRecord[],
): InferredSeat | null;
```

This helper owns:

- tail slicing;
- cost-weighted accumulation;
- relative sorting;
- extrema uniqueness checks;
- ratio threshold;
- relative reason construction;
- frozen return value.

Keeping the body intact isolates compatibility from quota policy.

## New learned narrowing

Use a type predicate local to the module:

```ts
function isLearned(
  capacity: LaneCapacity,
): capacity is LearnedLaneCapacity;
```

Alternatively, an inline predicate on `.every` is acceptable if TypeScript narrows the array for the
subsequent call. A named predicate is structurally clearer and independently readable.

The exported dispatcher shape is:

```ts
const capacities = learnLaneCapacities(records);
return capacities.every(isLearned)
  ? inferByQuotaFraction(capacities)
  : inferByRelativeBurn(records);
```

`inferByQuotaFraction` will still guard fewer than two facts so the function remains total if the
registry changes.

## New quota formatter

Add:

```ts
function quotaPercentage(quotaFraction: number): string;
```

Behavior:

- multiply by 100;
- round using `Math.round`;
- stringify without locale APIs;
- do not clamp.

Add:

```ts
function quotaReason(
  capacities: readonly LearnedLaneCapacity[],
  selected: AgentSeat,
): string;
```

The helper maps capacities in their canonical input order to:

```text
<seat> at ~<integer>% of learned window
```

It joins entries with `; `, prefixes `learned quota fraction: `, and suffixes
`; routing to <selected>`.

## New quota ranker

Add:

```ts
function inferByQuotaFraction(
  capacities: readonly LearnedLaneCapacity[],
): InferredSeat | null;
```

Internal organization:

1. Return `null` for fewer than two facts.
2. Copy and sort ascending by `quotaFraction`.
3. Read the first and second entries.
4. Return `null` when their fractions are equal.
5. Build the reason from the original canonical-order array.
6. Return a frozen `{ seat: coolest.seat, reason }`.

The original-order input supplies stable provenance. The ranked copy supplies policy selection. No
member is mutated.

## Exported function documentation

Update the doc comment to describe both evidence rungs:

- learned fractions are preferred only when the complete known registry is learned;
- otherwise relative E-071 heat remains the honest fallback;
- the function remains pure/total;
- exact ties remain unrouted;
- explicit caller override remains a consumer concern and is unchanged.

Update stale module-header statements that say absolute capacity is deferred. Keep the historical
origin of the relative fallback clear.

## `src/play/lane-heat.test.ts` fixture additions

Add a stable base timestamp and cap marker:

```ts
const QUOTA_BASE = Date.parse("2026-07-13T00:00:00.000Z");
const CAP_MARKER = {
  signal: "http-429",
  reason: "provider reset-window capacity exhausted",
} as const;
```

Add a helper that builds a record with:

- canonical or raw seat;
- minute offset;
- supplied usage;
- optional cap marker;
- `errored` outcome for capped rows and `success` otherwise;
- equal valid start/end timestamps.

Keep the existing `record` and `inputBurn` helpers unchanged so the fallback fixture path is not
rewritten.

## Pure quota fixture geometry

Primary fixture:

```text
minute 0:   claude cap boundary, burn 0
minute 100: claude cap, 100 input -> learned capacity 100
minute 200: claude current burn 85 -> fraction 85%

minute 0:   codex cap boundary, burn 0
minute 100: codex cap, 1000 input -> learned capacity 1000
minute 200: codex current burn 200 -> fraction 20%
```

Total raw burn is claude 185 versus codex 1200, so relative heat would choose claude. Learned quota
fraction must choose codex. This prevents a false-positive implementation that still ranks raw burn.

Expected exact reason:

```text
learned quota fraction: claude at ~85% of learned window; codex at ~20% of learned window; routing to codex
```

## Additional pure cases

- Reverse current fractions to prove symmetry.
- Use proportionally equal current/capacity values with unequal raw totals; expect `null`.
- Learn only the first lane and leave the second unlearned; expect the exact relative reason.
- Use a fraction above 1 and a lower peer fraction; prove no clamp creates a tie.
- Continue checking returned seats against `KNOWN_SEATS`.

No test should access fs, current time, an executor, or a provider.

## `src/engine/cast.test.ts` fixture addition

Add:

```ts
async function writeLaneQuota(root: string): Promise<void>;
```

It writes the primary fixture geometry to `DEFAULT_RUN_LOG_PATH` using `buildRunRecord` and
`serializeRunRecord`. The helper creates `.vend` exactly as `writeLaneHeat` does. It uses distinct run
ids and an E-082 fixture subject.

The helper should remain narrowly dedicated rather than adding optional mode flags to
`writeLaneHeat`; separate helpers keep E-071 fallback fixtures legible and unchanged.

## End-to-end test structure

Add a test adjacent to the current omitted-agent inference test:

1. Create a temp project.
2. Write learned quota fixture rows to the production ledger path.
3. Use a separate terminal output log path.
4. Cast `seatDefaultPlay()` with no explicit agent.
5. Assert successful settlement.
6. Assert every fixture ticket is stamped `agent: codex` exactly once.
7. Parse the terminal log row.
8. Assert exact `{ seat, reason }` marker equality.
9. Assert `reviveRecord` preserves the marker.
10. Assert no `seatDefaulted` field.

This covers the actual effect and settlement chain without live execution.

## No-change boundaries

### `src/play/lane-capacity.ts`

Its union, calculations, and immutability are consumed as settled.

### `src/play/decompose-effect.ts`

It already treats explicit `agent` as authoritative and returns inferred evidence verbatim.

### `src/engine/cast.ts`

It already copies the marker before terminal append.

### `src/log/run-log.ts`

The open string reason field already supports the new provenance. No version/schema change belongs.

### `src/budget/*`, `src/executor/*`, materialization

No quota wallet, provider behavior, or output schema changes.

## Commit units

### Commit 1 — pure policy

Exact includes:

```text
src/play/lane-heat.ts
src/play/lane-heat.test.ts
```

Run the focused lane-heat test before committing.

### Commit 2 — marker propagation proof

Exact include:

```text
src/engine/cast.test.ts
```

Run the focused cast test before committing.

## Completion structure

- Run `bun run check` after both commits.
- Confirm no ticket-owned path is modified, staged, or untracked.
- Record implementation and verification in private `progress.md`.
- Write private `review.md` and the exact JSON disposition.
- Do not modify ticket phase/status.
- Stop on this ticket after Review.
