# Research — T-082-02-02 quota-fraction lane heat

## Ticket and story contract

- The ticket starts in `research` and belongs to `S-082-02`.
- The story upgrades default-seat inference from relative recent burn to learned quota fraction.
- The source of quota evidence is the local run ledger only.
- Provider-published quota constants and provider API lookups are out of scope.
- Wallet/budget algebra changes are out of scope.
- Runtime interception, retry, and mid-run rerouting are out of scope.
- The only requested policy consumer is `inferDefaultSeat`.
- Existing callers already propagate its returned reason into the ledger.
- The acceptance example is `claude at ~85% of learned window`.
- When capacity is unlearned, E-071 behavior must remain byte-compatible.
- The existing lane-heat test suite is the explicit fallback regression gate.
- The story advances P4 by routing without operator supervision.
- It advances P7 by reasoning in the provider window that actually exhausts.
- It remains local-first under P5 because all inputs are supplied `RunRecord` values.

## Current repository state

- `T-082-02-01` is complete at the current `HEAD` ancestry.
- Its source commit added `src/play/lane-capacity.ts` and its colocated tests.
- Lisa has modified `.lisa/provenance.jsonl` and this ticket file in the working tree.
- Those existing changes are orchestration-owned and must remain untouched.
- No ticket-owned source file is currently dirty.
- Ticket artifacts belong under this attempt-private directory.
- Lisa publishes admitted artifacts to `docs/active/work/T-082-02-02/` later.
- Ordinary `git add` and `git commit` are prohibited by the assignment.
- Source changes must be committed through `lisa commit-ticket` with exact includes.

## Existing lane-heat module

- `src/play/lane-heat.ts` is the current policy owner.
- It is a pure reader over an already-loaded `readonly RunRecord[]`.
- It performs no file-system access.
- It performs no clock access.
- It performs no executor or provider access.
- It imports `totalTokens` from `src/log/run-log.ts`.
- It imports `KNOWN_SEATS` and `AgentSeat` from `src/play/agent-seat.ts`.
- `LANE_HEAT_WINDOW` is `100` append-ordered records.
- `HOT_LANE_RATIO` is `2`.
- Relative aggregation builds one mutable burn accumulator per known seat.
- It scans only the final `LANE_HEAT_WINDOW` records.
- Unknown or absent raw `seatOfExecution` values contribute to no known lane.
- Burn is cost-weighted through the canonical `totalTokens` helper.
- The accumulators are sorted ascending by burn.
- The uniquely coolest lane becomes the candidate default.
- The uniquely hottest lane is the evidence source.
- All-zero heat returns `null`.
- Exact hottest/coolest ties return `null`.
- Future 3+-lane ambiguity at either extreme returns `null`.
- A hottest lane below the 2x ratio returns `null`.
- A zero-burn coolest lane can still route when another lane has positive burn.
- The return value is a frozen `{ seat, reason }` object.
- The current reason is a stable relative-burn sentence.
- Its exact form includes the 100-record window, both burns, and the multiple.

## Existing lane-heat tests

- `src/play/lane-heat.test.ts` contains the E-071 pure suite.
- Its fixtures derive the first two seats from `KNOWN_SEATS`.
- Tests fail loudly if fewer than two seats exist.
- Fixtures use `buildRunRecord`, not hand-cast raw record objects.
- The suite proves a 300-vs-100 imbalance chooses the cooler seat.
- It checks relative-reason substrings including `3x hotter`.
- It proves the ranking is symmetric.
- It proves a 150-vs-100 non-decisive difference returns `null`.
- It proves tied positive burn returns `null`.
- It proves an empty ledger returns `null`.
- It proves unknown and unattributed seats do not become heat.
- It proves cost weighting can reverse raw-token ordering.
- It proves only the bounded append tail contributes.
- It proves `KNOWN_SEATS` drives aggregation and the returned seat type.
- None of the existing fixtures carries cap markers.
- Therefore every existing test exercises the unlearned fallback after this ticket.
- Leaving those test bodies unchanged is a direct byte-compatibility proof.

## Learned capacity contract

- `src/play/lane-capacity.ts` is a sibling pure module.
- Its public entry point is `learnLaneCapacities(records)`.
- It returns `readonly LaneCapacity[]` in `KNOWN_SEATS` order.
- The returned array and every member are frozen.
- `LaneCapacity` is a discriminated union on `status`.
- A learned lane has `status: "learned"`.
- It carries `seat`, `windowMs`, `windowCapacity`, and `currentBurn`.
- It carries an unclamped `quotaFraction`.
- It carries a positive sample count.
- An unlearned lane has `status: "unlearned"`.
- It carries a reason but no numeric capacity or fraction.
- The unlearned reasons are insufficient evidence or non-positive capacity.
- Callers must narrow the union before accessing `quotaFraction`.
- The learner emits exactly one fact for each canonical known seat.
- Unknown raw seats never create output lanes.
- Adjacent valid cap markers define observed reset-window samples.
- Positive intervening cost-weighted burn defines sample capacity.
- Empty repeated cap events are ignored.
- Window cadence and capacity are arithmetic means across samples.
- Current burn uses the same learned window duration.
- Current burn is measured at the latest valid ledger event time.
- No current wall clock participates.
- Quota fraction is `currentBurn / windowCapacity`.
- The fraction deliberately remains above 1 when the evidence says so.
- The learner sorts valid timestamps without mutating caller order.
- Invalid timestamps cannot create window or current-burn evidence.

## Comparability boundary

- A quota fraction is comparable only with another sourced quota fraction.
- An unlearned lane has no defensible denominator.
- Treating an unlearned lane as fraction zero would invent maximum availability.
- Treating it as fraction one would invent exhaustion.
- Ignoring it while ranking learned lanes could route away from or toward incomplete evidence.
- The safe existing policy for an incompletely learned registry is relative burn.
- The existing relative policy can evaluate every known lane without quota invention.
- Requiring all known lanes to be learned makes the policy branch explicit and total.
- This also preserves the full E-071 behavior for fresh and marker-poor ledgers.

## Quota-ranking facts

- Smaller quota fraction means more of the learned window remains.
- Larger quota fraction means the lane is hotter in the binding denomination.
- The inferred default should therefore be the uniquely lowest fraction.
- Learned fractions are already finite and non-negative by the learner contract.
- Fractions are intentionally unclamped, so over-cap evidence must preserve ordering.
- Equal fractions contain no unique routing evidence.
- With future 3+ seat registries, a tied minimum is ambiguous.
- A tied maximum does not prevent identifying a unique coolest lane.
- Relative heat currently requires both extrema unique because its evidence is a hottest/coolest ratio.
- Quota ranking needs only a unique coolest lane to choose a default.
- No ticket or story text names an additional percentage threshold.
- Retaining the 2x threshold on fractions would preserve the supervision gap this epic closes.
- A learned absolute denomination permits direct ordinal ranking without raw-burn ratios.

## Evidence-string boundary

- `InferredSeat.reason` is plain stable provenance text.
- The lane-heat module owns its construction.
- `decomposeEffect` calls `inferDefaultSeat` only when `agent` is omitted.
- It uses the inferred `seat` as the effective materialization agent.
- It returns the entire inferred object as `seatInferred`.
- `cast.ts` copies `reported.seatInferred` without rewriting it.
- The terminal run record input receives that copied marker.
- `run-log.ts` validates and serializes the marker as `{ seat, reason }`.
- The ledger module intentionally imports no routing policy.
- Existing run-log tests prove arbitrary valid reason strings round-trip byte-stably.
- Existing cast integration tests prove the current relative reason flows end to end.
- No consumer source change is needed for the new reason to flow verbatim.
- A new cast integration fixture can prove the quota reason on the real path.

## Relevant integration test seam

- `src/engine/cast.test.ts` has a BAML-free decompose-shaped play.
- Its effect is the real `decomposeEffect`.
- Its executor and validation are fixture substitutes.
- `writeLaneHeat` writes normalized records to the production default ledger path.
- The existing omitted-agent cast test reads the terminal output ledger.
- It asserts every materialized ticket receives the inferred seat.
- It asserts the exact relative reason in `seatInferred`.
- That test has no cap markers and should remain an E-071 fallback proof.
- A sibling integration test can write cap-marked learned-window evidence.
- It can assert an exact quota reason survives materialization and settlement.
- This uses fabricated records and no provider tokens or live executor work.

## File ownership and likely surface

- `src/play/lane-heat.ts` must consume `learnLaneCapacities`.
- `src/play/lane-heat.test.ts` needs additive quota-path coverage.
- Its pre-existing tests should remain textually unchanged.
- `src/engine/cast.test.ts` is the established end-to-end provenance seam.
- No change is required in `lane-capacity.ts`.
- No change is required in `run-log.ts` or its schema.
- No change is required in `decompose-effect.ts`.
- No change is required in `cast.ts`.
- No change is required in materialization, budget, wallet, or executor modules.

## Verification constraints

- Focused pure tests should cover learned ranking and exact reason text.
- They should cover symmetric ranking.
- They should cover a quota ordering that disagrees with raw burn.
- They should cover equal learned fractions returning `null`.
- They should cover partial learning falling back without quota invention.
- Existing relative tests must continue passing unchanged.
- The cast integration test should prove verbatim ledger propagation.
- `bun run check` is the repository completion gate.
- Ticket-owned source paths must be clean after the Lisa commit.

## Research conclusion

- The repository already has all required evidence and propagation seams.
- This ticket is a pure policy integration plus focused tests.
- The main correctness boundary is learned-set completeness.
- The main compatibility boundary is retaining the current relative function unchanged as fallback.
- The main provenance boundary is exact reason construction in lane heat, not consumer rewrites.
