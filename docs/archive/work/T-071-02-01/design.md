# Design — T-071-02-01

## Decision

Add `src/play/lane-heat.ts` as a pure ledger consumer. It will aggregate `totalTokens` over the
last 100 ledger records by `seatOfExecution`, using every entry in `KNOWN_SEATS`. It will infer a
default only when the hottest lane has at least twice the burn of the coolest lane and the hottest
burn is positive. Otherwise it returns `null`. A decision contains the cooler `AgentSeat` and a
stable reason string naming the recent window, hot lane, cool lane, and their weighted burn.

## Goals

- Make a meaningful overflow decision from evidence already present in the ledger.
- Avoid routing when evidence is empty, balanced, or merely close.
- Reuse the canonical seat vocabulary and canonical cost derivation.
- Remain pure, deterministic, total, and safe on legacy records.
- Give the integration/provenance tickets a small stable return contract.

## Non-goals

- Do not load `.vend/runs.jsonl` in this module.
- Do not inspect wall-clock time or call a clock.
- Do not claim knowledge of reset-window quota fractions.
- Do not consume or synthesize 429/cap signals.
- Do not stamp tickets or run records.
- Do not resolve explicit agent overrides.
- Do not add seats or edit the routing registry.

## Option 1 — always choose the lower non-tied burn

Algorithm: sum burn by seat and select the minimum whenever minimum and maximum differ.

Advantages:

- Minimal code.
- Always spreads work toward the lower observed lane.
- Needs no policy constant beyond recency.

Disadvantages:

- A one-token difference would reroute.
- It cannot satisfy the meaningful distinction between “clearly hot” and “both cool.”
- It turns harmless measurement noise into durable routing provenance.
- It would imply precision the current substrate does not provide.

Decision: rejected.

## Option 2 — absolute quota or token threshold

Algorithm: mark a lane hot after a fixed number of weighted tokens or quota percentage.

Advantages:

- “Hot” would have a direct absolute interpretation.
- Both lanes could be independently classified cool or hot.

Disadvantages:

- No quota values or reset cadence are sourced in the repository.
- A raw token constant would not map reliably across lane plans.
- It violates the story's explicit relative-burn honest boundary.
- It would preempt the deferred lane-denominated-budget epic.

Decision: rejected.

## Option 3 — wall-clock reset-window filtering

Algorithm: compare record timestamps with `now` and include a fixed recent duration.

Advantages:

- Time is closer to real provider reset behavior than a record count.
- An options clock could keep the function testable.

Disadvantages:

- The reset duration is unsourced.
- Introducing `now` expands the API and makes identical ledger inputs time-dependent.
- Invalid timestamps introduce another evidence-loss branch.
- Repository recalibration already establishes append-tail windowing as minimal recency.

Decision: rejected.

## Option 4 — relative dominance over an append tail

Algorithm: take the last N records, aggregate cost-weighted burn for known seats, and infer only
when maximum burn is at least a named multiple of minimum burn.

Advantages:

- Uses only evidence present and sourced today.
- “Clearly hot” maps to a conservative, explainable imbalance.
- Close non-ties can honestly remain unrouted as both cool.
- A hard tail is deterministic and follows existing recency precedent.
- The threshold can later be replaced by sourced quota policy without changing callers.

Disadvantages:

- A record-count window is not a provider reset window.
- A 2x boundary is policy judgment, not measured quota.
- A zero-burn lane makes any positive peer decisive.

Decision: selected, with those limitations documented in code and review.

## Recency policy

- Define `LANE_HEAT_WINDOW = 100`.
- Slice the overall append-ordered ledger with `records.slice(-LANE_HEAT_WINDOW)`.
- Apply attribution during aggregation.
- This bounds work and prevents arbitrarily old burns dominating indefinitely.
- It intentionally uses the overall tail: the recent system activity horizon is shared by lanes.
- Empty, legacy-unattributed, and unknown-seat records contribute no lane burn.

## Heat policy

- Define `HOT_LANE_RATIO = 2`.
- Rank seat totals ascending by burn, preserving `KNOWN_SEATS` order as deterministic tie order.
- The first rank is the cooler candidate and last rank is the hotter candidate.
- If fewer than two known seats exist, return `null` defensively.
- If hottest burn is zero, return `null`.
- If hottest and coolest burns are equal, return `null`.
- If hottest burn is less than twice coolest burn, return `null`.
- Otherwise return the cooler seat and evidence reason.

This is not an absolute statement that a provider quota is exhausted. It is a relative routing
policy: one lane is decisively hotter than the available alternative within the observed horizon.

## Return contract

```ts
export interface InferredSeat {
  readonly seat: AgentSeat;
  readonly reason: string;
}

export function inferDefaultSeat(records: readonly RunRecord[]): InferredSeat | null;
```

The `seat` name is direct and easy for the integration ticket to pass to materialization. The
`reason` is direct and matches the next ticket's `seatInferred` “chosen seat + heat reason” schema.

## Reason format

Use one stable sentence:

`recent cost-weighted burn (last 100 records): hot=300 vs cool=100; hot lane is 3x hotter`

Numbers should use JavaScript's ordinary string form so fractional cost-weighted totals remain
honest rather than being rounded away. When the cooler burn is zero, say `positive burn vs zero`
rather than render an infinite ratio. The decision's seat field already names the chosen lane.

## Unknown and future seats

The ledger accepts raw future seat names; the current routing reader should not invent mappings for
them. Aggregation initializes from `KNOWN_SEATS` and ignores records whose seat is not a current key.
Adding a seat to `KNOWN_SEATS` automatically creates a bucket and includes it in ranking with no
reader source edit. Exact behavior with more than two equally cool lanes remains conservative:
ambiguous coolest ties return `null` rather than selecting by incidental order.

## Test design

- Build records through `buildRunRecord` so fixtures match normalized production records.
- Clearly hot: multiple attributed records yield a 3x imbalance and choose the cooler seat.
- Both cool: unequal 1.5x totals stay below the decisive 2x boundary and return `null`.
- Tied: equal positive totals return `null`.
- Empty: `[]` returns `null`.
- Unknown/unattributed: do not create known-lane burn.
- Cost weighting: construct equal raw token parity whose output-heavy lane has higher `totalTokens`.
- Recency: place an old hot record before 100 recent balanced records and expect `null`.
- Registry use: derive fixture seats from `KNOWN_SEATS`; production contains no lane literal.

## Compatibility

This is an additive module with no durable schema change. Existing callers and ledger bytes are
untouched. The later effect can adopt the function without needing filesystem behavior in the core.

