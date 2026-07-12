# Research — T-071-02-01

## Assignment and phase state

- The ticket starts in `phase: research` and the assignment requires all remaining RDSPI phases.
- Phase artifacts belong only in `.lisa/attempts/T-071-02-01/1/work/`.
- Lisa, not this worker, owns ticket phase/status transitions and publication to `docs/active/work/`.
- Ticket-owned source commits must use `lisa commit-ticket` with exact include paths.
- The repository has unrelated modified and untracked Lisa/config files; none are ticket-owned.

## Product and story contract

- Vend turns reusable agent process into autonomously runnable playbooks.
- P4 requires the cooler-lane choice to happen without live operator supervision.
- P7 requires routing to respect measured capacity rather than treating budget as a hint.
- P6 requires the reader to derive its lane vocabulary from the routing contract, not executor names.
- Parent story `S-071-02` owns the inferred-default-seat path from ledger read through mint and provenance.
- This ticket is only the pure reader at the head of that path.
- The integration ticket will load the ledger, call this reader, stamp tickets, and record provenance.
- Explicit `--agent` override behavior and materialization are outside this ticket.
- Capturing 429/cap signals, quota values, and reset cadence is explicitly deferred.
- The story's honest boundary says this slice measures relative recent burn, not quota fraction.

## Acceptance contract

- Export a pure `inferDefaultSeat` reader.
- A clearly hot lane must yield the cooler seat and a heat reason.
- Both-cool, tied, and empty-ledger inputs must return `null`.
- Lane enumeration must come from `KNOWN_SEATS`.
- Cost-weighted burn must come from run-log's existing `totalTokens` derivation.
- Unit tests and the full `bun run check` gate must pass.

## Existing seat contract

- `src/play/agent-seat.ts` is the canonical routing-seat module.
- `KNOWN_SEATS` is a readonly tuple currently containing two seats.
- `AgentSeat` is derived from that tuple.
- `findUnknownSeat` performs exact runtime membership checking.
- The module is pure and addon-free.
- The reader should import the tuple and type rather than repeat either lane literal.

## Existing ledger contract

- `src/log/run-log.ts` owns the append-only run ledger schema and pure derivations.
- `RunRecord` contains normalized usage, outcome, timestamps, and optional metadata.
- Dependency ticket T-071-01-01 added optional `seatOfExecution?: string`.
- Absence of `seatOfExecution` means historically unknown, not a default lane.
- The ledger deliberately preserves non-empty raw seat strings without routing-policy policing.
- A downstream reader therefore owns matching raw values to known routing seats.
- Unknown/raw future seats must not contribute to current known-lane heat.
- Record order is append order, so a tail slice is the established recency mechanism.

## Cost derivation

- `totalTokens(record)` is pure and exported by `src/log/run-log.ts`.
- It weights fresh input, output, cache read, and cache creation by relative cost.
- Output counts 5x, cache reads 0.1x, and cache creation 1.25x relative to input.
- It can return fractional values.
- Reusing it is required to avoid a second or parity-counted notion of burn.
- `RunRecord.usage` is already normalized, so the reader needs no usage coercion.

## Existing recency precedent

- `src/ledger/recalibrate.ts` treats the append-ordered ledger tail as the recent horizon.
- Its `DEFAULT_WINDOW` is 100 records after domain filtering.
- It uses a hard record window rather than a wall-clock interval or exponential decay.
- That approach stays pure and does not require a clock.
- Lane heat has no sourced reset cadence, so a timestamp/reset-window algorithm would invent policy.
- A bounded ledger tail is therefore the available honest meaning of “recent.”

## Pure-core conventions

- Pure readers take already-loaded `readonly RunRecord[]` values.
- Files performing pure decisions live alongside their domain under `src/play/` or `src/ledger/`.
- Unit tests are colocated as `*.test.ts` and use `bun:test`.
- Tests commonly create ledger fixtures through `buildRunRecord` rather than unsafe casts.
- Production functions return plain immutable-compatible values and perform no fs/clock/network work.
- Thin effects such as `loadRunLog` are composed by callers and are not pulled into pure cores.

## Relevant boundaries

- New production file named by the story: `src/play/lane-heat.ts`.
- Expected colocated test: `src/play/lane-heat.test.ts`.
- No edit to `agent-seat.ts` is needed because it already exports the vocabulary.
- No edit to `run-log.ts` is needed because it already exposes the record type, seat field, and burn helper.
- No edit to `decompose-effect.ts`, `materialize.ts`, `play.ts`, or `cast.ts` belongs to this ticket.

## Ambiguities surfaced

- No absolute quota, reset cadence, or cap marker exists in the current slice.
- Therefore “hot” cannot honestly mean a known fraction of quota.
- Returning a cooler seat for every non-equal pair would overreact to measurement noise.
- “Clearly hot” and “both cool” imply a dominance boundary, but the ticket provides no numeric one.
- The result reason has no schema yet beyond being a string consumed by the following marker ticket.
- Current vocabulary contains exactly two seats, while the no-reader-edit clause asks iteration to be data-driven.

## Constraints for design

- The threshold must express relative dominance only.
- It must be named, directly testable, and documented as policy.
- Zero burn versus positive burn must avoid division-by-zero ambiguity.
- Exact ties must return `null`.
- Near/effectively balanced non-ties must return `null` as both cool.
- Empty and unattributed-only ledgers must return `null`.
- The input array and records must not be mutated.
- Reasons should be deterministic and stable enough for provenance tests.
- Unknown `seatOfExecution` values should be ignored, not mapped or rejected.

## Verification surface

- Focused unit tests can prove every acceptance branch without filesystem effects.
- A weighted-usage fixture can distinguish `totalTokens` from raw parity counting.
- A recency fixture can prove old heat falls out of the window.
- A source-of-truth test can derive expectations from `KNOWN_SEATS` rather than hard-code enumeration logic.
- Full `bun run check` covers BAML generation, TypeScript, and the complete repository suite.

## Research conclusion

The repository already contains both required inputs: canonical known seats and a canonical
cost-weighted run burn. The missing unit is a small pure consumer that windows append-ordered
records, aggregates only known attributed lanes, detects a decisive relative imbalance, and
returns a deterministic seat/reason decision without reading files or inventing quota facts.

