# Research — T-082-02-01 learned-window-capacity

## Assignment and phase state

- The ticket starts in `phase: research` and the assignment requires every remaining RDSPI phase.
- Phase artifacts belong only in `.lisa/attempts/T-082-02-01/1/work/` for this generation.
- Lisa owns publication and the ticket's phase/status frontmatter; this worker must not edit either.
- Ticket-owned source commits must use `lisa commit-ticket` with exact repository-relative includes.
- Ordinary `git add`, `git commit`, and broad staging are forbidden for this assignment.
- Review must produce both `review.md` and the exact-schema `review-disposition.json`.
- The worktree already contains Lisa-managed changes to provenance and active ticket files.
- Those pre-existing changes are outside this ticket-owned source unit and must remain untouched.

## Product and charter grounding

- Vend clears work into reusable, autonomous playbooks whose gates make probabilistic work dependable.
- P7 says budget is a hard contract, not a suggestion.
- The scarce unit for the current two-seat operator is provider quota per reset window.
- P5 says Vend remains local-first and owns its state on the operator's machine.
- This ticket therefore learns from the local append-only ledger only.
- It must not consult provider documentation, provider APIs, network state, or hard-coded plan limits.
- N2 excludes a live quota dashboard or monitoring surface.
- N4 excludes runtime interception, executor control, and mid-run rerouting.
- The output is an allocation fact derived from evidence, not a provider enforcement mechanism.

## Epic contract

- `E-082` upgrades lane heat from relative recent burn to learned quota-per-window evidence.
- The epic identifies today's limitation: relative heat cannot distinguish both-hot from both-cool lanes.
- It requires cap/429 events to become countable ledger evidence before capacity can be learned.
- It names cost-weighted ledger burn as the numerator for learning.
- It names cap-event cadence as the source for the reset-window duration.
- It explicitly refuses invented or provider-published quota values.
- It expects learned capacity to remain dormant until enough real cap evidence accumulates.
- It defers wallet-side quota denomination, live dashboards, and runtime rerouting.

## Parent-story contract

- `S-082-02` has two ordered tickets.
- This ticket creates a new pure capacity-learning module under `src/play/`.
- The module is a sibling of `lane-heat.ts` and consumes `RunRecord` values.
- The following ticket, `T-082-02-02`, is the sole writer of `lane-heat.ts`.
- That next ticket will rank lanes by the learned quota fraction and update provenance wording.
- Existing consumers already carry `InferredSeat.reason` verbatim into `seatInferred`.
- The story therefore needs no ledger-schema or downstream-consumer changes in this ticket.
- A lane without sufficient evidence must be explicitly unlearned.
- Existing relative heat remains the later fallback and is intentionally untouched here.

## Ticket acceptance

- Fabricated cap-marked ledgers must produce a learned window capacity for each evidenced lane.
- The same fixtures must produce a current quota fraction matching hand calculations.
- A lane with no cap evidence must return an explicit unlearned branch.
- The unlearned branch must expose no invented numeric capacity or quota fraction.
- Tests must reach these branches in a pure module.
- The module may not read files, obtain the current clock, or contact a provider.
- Repository-wide `bun run check` must remain green before the source unit is committed.

## Dependency delivered by T-082-01-01

- Commit `377ac7a` added `RunRecord.capWindowExhausted` as an optional structured marker.
- A complete marker has non-empty `signal` and `reason` strings.
- Build and revive normalize the pair atomically.
- Missing, partial, or malformed markers are omitted without losing the run row.
- Marker presence is the one-way positive fact; absence means no recorded cap event / historical unknown.
- The marker deliberately does not repeat lane, burn, or event time.
- Those facts remain single-sourced by the containing record.
- `seatOfExecution` supplies the lane.
- `usage` plus `totalTokens(record)` supplies cost-weighted burn.
- `endedAt` supplies the settlement/cap-event time.

## Run-record evidence surface

- `RunRecord.seatOfExecution?: string` preserves a raw non-empty routing lane.
- The ledger does not validate raw seats against the play layer's registry.
- Downstream readers must therefore admit only exact `KNOWN_SEATS` values.
- `RunRecord.capWindowExhausted` is optional and complete whenever present after normalization.
- `RunRecord.endedAt` is required and non-empty but is not guaranteed parseable by the type.
- Pure consumers must branch around invalid timestamps instead of propagating `NaN`.
- `RunRecord.usage` is normalized to finite numeric token buckets.
- `totalTokens(record)` is the canonical cost-weighted burn derivation.
- It weights input 1.0x, output 5.0x, cache read 0.1x, and cache creation 1.25x.
- It may return fractional cost-weighted token equivalents.
- Reusing it prevents a second quota-burn definition from drifting from budget accounting.

## Existing lane contract

- `src/play/agent-seat.ts` exports `KNOWN_SEATS` and the derived `AgentSeat` union.
- The current tuple contains `claude` and `codex`.
- It is routing metadata, not the Vend executor registry.
- The capacity module should enumerate this tuple instead of repeating lane literals.
- Unknown or future raw ledger seats must not become current known-lane capacity evidence.
- The ticket explicitly excludes adding lanes beyond `KNOWN_SEATS`.

## Existing lane-heat boundary

- `src/play/lane-heat.ts` is pure over already-loaded `RunRecord[]` values.
- It imports `totalTokens`, `KNOWN_SEATS`, and `AgentSeat` only.
- It currently aggregates the last 100 append-ordered records.
- It routes only for a unique hottest/coolest lane at a 2x or greater burn ratio.
- Its evidence reason names recent cost-weighted burn and the compared lane totals.
- Its header explicitly refuses to invent provider reset-window facts.
- `T-082-02-02`, not this ticket, will consume the learned-capacity result.
- No import from the new module into `lane-heat.ts` belongs in the current ticket.

## Time and recency facts

- Learning cadence requires record timestamps; an append-count tail cannot express reset duration.
- The ledger can contain concurrently settled rows, so append order need not equal event-time order.
- `Date.parse` is deterministic over the stored timestamp strings and does not access the clock.
- Sorting derived observations by parsed `endedAt` remains pure and avoids mutating caller input.
- A global latest valid ledger timestamp can define an honest ledger-as-of point.
- That point is sourced from the records and avoids injecting `Date.now()`.
- Using a per-lane latest timestamp would leave a dormant lane artificially hot forever.
- A shared ledger-as-of point lets old burn age out when another lane records later activity.
- With no later record, the result is honestly current only as of the ledger's last observation.

## What cap-to-cap evidence can prove

- One cap marker proves that a lane exhausted some window.
- One marker does not prove a cadence or identify a preceding reset boundary.
- Two valid, strictly time-ordered cap markers define one observed cap-to-cap interval.
- The interval duration is an observed cadence sample.
- Lane burn after the earlier cap and through the later cap is an observed window-capacity sample.
- The lower bound should be exclusive and the upper bound inclusive.
- That ownership assigns the later cap row's burn to the window it exhausted.
- It also avoids counting an earlier boundary row in two adjacent samples.
- Three cap markers define two adjacent samples; more history can accumulate more samples.
- Non-positive time gaps cannot establish a reset-window cadence and must not become samples.

## Capacity aggregation facts

- No provider-specific estimator exists elsewhere in the repository.
- The ticket asks for learned capacity, not a conservative policy buffer or prediction interval.
- Arithmetic means retain every observed interval and are directly hand-computable in fixtures.
- Averaging observed interval durations yields a learned reset-window cadence.
- Averaging cost-weighted burn within those intervals yields learned capacity per observed window.
- Zero observed mean capacity cannot support division into a quota fraction.
- Such evidence must stay explicitly unlearned rather than returning `NaN` or infinity.
- The raw sample count is useful evidence for future consumers and tests.
- No clamping is justified: current burn can honestly exceed the learned mean capacity.

## Current quota-fraction facts

- A quota fraction requires a numerator measured over the same learned duration as capacity.
- A rolling window ending at the global ledger-as-of timestamp provides that numerator.
- Its lower bound should be exclusive and upper bound inclusive, matching cap intervals.
- This makes a fixture whose latest row is a cap reproduce its observed capacity at fraction 1.
- Later records advance the window and can push the fraction above 1 without hiding overage.
- A later zero-burn observation can age prior burn out without any clock dependency.
- The current burn must include only the lane being evaluated.
- Records with invalid timestamps cannot be assigned to a learned or current time window.
- Unknown-seat and unattributed records can advance ledger time but contribute no known-lane burn.

## Pure-core conventions

- Pure readers accept plain readonly values and perform no filesystem loading themselves.
- Colocated `*.test.ts` files use `bun:test` and fabricated values.
- Ledger fixtures are normally built through `buildRunRecord` to exercise canonical normalization.
- Production functions should return immutable values and avoid mutating input arrays.
- Discriminated unions are established throughout the codebase for explicit outcome branches.
- A learned/unlearned union lets strict TypeScript prevent numeric access on the unlearned branch.
- The module can be addon-free with only run-log and agent-seat imports.

## Baseline verification

- `bun run check` passed before ticket source changes.
- BAML generation succeeded.
- TypeScript completed with no errors.
- The full suite reported 1,956 passing, 1 skipped, and 0 failed tests.
- This establishes a green branch baseline after dependency T-082-01-01.
- Generated BAML output remained unchanged after the gate.

## Relevant files

- `AGENTS.md` — repository workflow and commit rules.
- `docs/knowledge/rdspi-workflow.md` — six-phase artifact contract.
- `docs/knowledge/vision.md` and `charter.md` — P5/P7 and non-goal boundaries.
- `docs/active/epic/E-082.md` — learned-quota intent and exclusions.
- `docs/active/stories/S-082-02.md` — story contract and ticket DAG.
- `docs/active/tickets/T-082-02-01.md` — current acceptance criteria.
- `docs/active/tickets/T-082-02-02.md` — next consumer's expected quota-fraction surface.
- `src/log/run-log.ts` — marker, record, timestamp, and cost-weighted burn contracts.
- `src/play/agent-seat.ts` — canonical known-lane vocabulary.
- `src/play/lane-heat.ts` and `.test.ts` — sibling pure-reader and future integration seam.

## Research conclusion

The repository now contains all facts this ticket needs: exact known lanes, complete one-way cap
markers, canonical cost-weighted burn, and settlement timestamps. The missing unit is a pure,
clock-free learner that treats adjacent valid cap markers as observed window samples, averages
their cadence and burn, measures current rolling burn at the ledger's own latest timestamp, and
returns a discriminated unlearned result whenever the evidence cannot support a positive numeric
denominator. No ledger, heat, wallet, executor, or filesystem edit is required.
