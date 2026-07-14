# Structure — T-071-02-01

## Change inventory

### Create `src/play/lane-heat.ts`

Purpose: pure lane-burn aggregation and inferred-default-seat decision.

Imports:

- Value import `KNOWN_SEATS` from `./agent-seat.ts`.
- Type import `AgentSeat` from `./agent-seat.ts`.
- Value import `totalTokens` from `../log/run-log.ts`.
- Type import `RunRecord` from `../log/run-log.ts`.

Exports:

- `LANE_HEAT_WINDOW` — the append-tail record count.
- `HOT_LANE_RATIO` — the minimum decisive relative burn multiple.
- `InferredSeat` — `{ seat, reason }` result shape.
- `inferDefaultSeat(records)` — the public pure reader.

Internal organization:

1. Module contract and honest-boundary comments.
2. Imports.
3. Policy constants.
4. Public result interface.
5. Small burn-entry internal type.
6. Pure aggregation/ranking inside `inferDefaultSeat`.
7. Deterministic reason formatting helper if it improves readability.

Behavioral boundaries:

- No filesystem imports.
- No `loadRunLog` import.
- No clock or timestamp parsing.
- No executor imports.
- No lane string literals.
- No mutation of input records or `KNOWN_SEATS`.
- Unknown and absent execution seats are ignored.

### Create `src/play/lane-heat.test.ts`

Purpose: unit proof of all acceptance branches and load-bearing policy boundaries.

Imports:

- `describe`, `expect`, and `test` from `bun:test`.
- Reader exports from `./lane-heat.ts`.
- `KNOWN_SEATS` from `./agent-seat.ts`.
- `buildRunRecord`, `totalTokens`, and relevant run-log types.

Internal organization:

1. A compact `record` fixture builder with overridable seat and usage.
2. A helper for input-only burn records when convenient.
3. Describe block for decision branches.
4. Describe block for source-of-truth/cost/recency invariants.

Required cases:

- Hot first known lane returns second known lane.
- Hot second known lane returns first known lane.
- Both active but below 2x dominance returns null.
- Equal positive burn returns null.
- Empty ledger returns null.
- Unattributed and unknown-seat-only ledger returns null.
- Cost weighting changes the decision compared with parity counting.
- Old burn outside the tail does not affect the decision.
- Return reason names both evidence lanes and cost-weighted burn.

## Files deliberately unchanged

### `src/play/agent-seat.ts`

Already owns the canonical registry and type. The new reader consumes it.

### `src/log/run-log.ts`

Already owns `RunRecord.seatOfExecution` and `totalTokens`. No schema change belongs here.

### `src/play/decompose-effect.ts`

Ledger loading and inference injection belong to dependent ticket T-071-02-03.

### `src/play/materialize.ts`

Ticket stamping already accepts agent routing; no reader concern belongs here.

### `src/engine/play.ts` and `src/engine/cast.ts`

Provenance threading belongs to the later marker/integration tickets.

### Ticket frontmatter and shared work directory

Lisa owns phase/status changes and artifact publication. This attempt does not edit them.

## Public dependency direction

```text
agent-seat.ts ───────┐
                    ├──> lane-heat.ts ───> later decompose effect
run-log.ts ─────────┘
```

The run log remains a sink with no dependency on routing policy. The play-layer reader is the
consumer where the durable raw lane fact and current routing vocabulary may safely meet.

## Data flow

1. Caller has already loaded `readonly RunRecord[]`.
2. Reader takes the last `LANE_HEAT_WINDOW` records.
3. Reader initializes burn entries from `KNOWN_SEATS`.
4. Each recent record with a current known `seatOfExecution` adds `totalTokens(record)`.
5. Entries are ranked by burn without mutating the registry.
6. Ambiguous/insufficient evidence returns `null`.
7. Decisive relative heat returns the cooler `AgentSeat` and evidence reason.

## Multi-seat structural behavior

Although current acceptance concerns two lanes, enumeration is tuple-driven. Adding a registry
entry automatically creates and aggregates a new bucket. The decision requires a unique coolest
lane and a unique hottest lane before returning, preventing an arbitrary choice among tied lanes.
This makes registry growth safe without pretending the product has designed more-than-two policy.

## Reason ownership

The reader owns the reason because it owns the evidence calculation. The later marker schema stores
the string verbatim and the effect merely threads it. This avoids duplicating heat interpretation in
the effect or durable log.

## Commit unit

The production module and its colocated tests form one meaningful ticket-owned source unit. They
will be committed together with one `lisa commit-ticket` transaction and exactly two include paths.
Attempt artifacts remain private/uncommitted under Lisa's ignored attempt directory.

## Verification boundaries

- Focused: `bun test src/play/lane-heat.test.ts`.
- Static: `bun run build` or the build portion of the full gate.
- Required repository gate: `bun run check`.
- Hygiene: verify both source paths are clean after Lisa commit and unrelated dirt is unchanged.

