# T-073-01-04 — Research

## Assignment and phase

- The ticket begins in `research`.
- The assignment requires all remaining RDSPI phases in one continuous pass.
- Attempt-private phase artifacts belong under `.lisa/attempts/T-073-01-04/1/work/`.
- Lisa owns ticket phase/status transitions and publication into `docs/active/work/`.
- Ticket-owned source must be committed with `lisa commit-ticket` and exact include paths.
- The worktree already contains Lisa-owned changes to `.lisa/provenance.jsonl` and the ticket file.
- Those files are not source owned by this implementation and must remain untouched by the commit.

## Story contract

- Parent story: `S-073-01`, route the diff for cross-review.
- The story spans diff capture, complement-seat resolution, review dispense, parsing, and persistence.
- This ticket is the final serial ticket in that story.
- Its dependency, T-073-01-03, settled the in-memory review verdict shape.
- The story requires the ledger to carry authoring seat, reviewing seat, pass/fail, and detail.
- A run without a resolvable complement must carry no cross-review verdict.
- The verdict is non-blocking in this story.
- Making a failed review produce `gate-failed` belongs to S-073-02.
- Live cross-vendor execution is explicitly deferred and metered.
- Current verification must remain fixture-driven and free.

## Ticket acceptance

- The one acceptance criterion is a run-log round trip.
- A cross-reviewed cast's JSONL line must carry both seats and pass/fail.
- A single-seat run's JSONL line must carry no verdict.
- The criterion names the durable line, not a UI rendering or live executor call.
- It therefore exercises write normalization, serialization, and read revival.

## Existing cross-review value

- `src/cross-review/review-core.ts` owns the pure reviewer contract.
- `CrossReviewVerdict` is a discriminated union.
- Pass is `{ verdict: "pass", reviewingSeat }`.
- Fail is `{ verdict: "fail", reviewingSeat, reason }`.
- The reviewing seat uses `AgentSeat` at the cross-review policy boundary.
- The model is not allowed to supply its own seat provenance.
- `src/cross-review/review.ts` attaches the reviewing seat from `ComplementExecutor`.
- A failure reason is trimmed and required to be non-empty.
- A pass currently has no reason/detail value.
- T-073-01-03 deliberately left run-log schema and persistence out of its slice.

## Existing routing provenance

- `src/engine/cast-core.ts` maps resolved executor ids to execution seats.
- `claude` maps to `claude`.
- `openai-compat` maps to `codex`.
- Unknown executor ids map to `undefined`, preserving honest absence.
- `src/engine/cast.ts` stamps `seatOfExecution` on the run record when known.
- `src/cross-review/resolve-complement.ts` treats absent, unknown, or single-seat routing as inert.
- Thus authoring-seat provenance exists separately from the parsed review verdict.

## Existing run-log boundary

- `src/log/run-log.ts` is an append-only JSONL sink.
- It deliberately imports neither executor nor budget policy modules.
- Structurally compatible input types are declared locally.
- `RunRecordInput` is the pre-normalization caller contract.
- `RunRecord` is the normalized durable/read contract.
- `buildRunRecord` is pure and asserts required identity/outcome fields.
- Optional fields are normalized and omitted when absent or malformed.
- `serializeRunRecord` emits exactly one compact JSON object plus newline.
- `reviveRecord` is pure, total, and tolerant of historical or malformed optional metadata.
- `readRuns` parses JSONL and reports skipped invalid lines.
- `appendRunLog` is the thin filesystem wrapper over build and serialize.
- Schema version remains `1`; additive optional fields have historically not incremented it.

## Optional structured-field precedents

- `SeatDefaulted` is a local structured ledger type with three required strings.
- `SeatInferred` is a local structured ledger type with two required strings.
- Their normalizers treat each nested value atomically.
- Partial or malformed optional structures are omitted rather than partially admitted.
- Valid structures are rebuilt field-by-field, dropping unknown nested keys.
- The write path and revive path both use the same normalization helper.
- Absence keeps older/ordinary records byte-compatible.
- `capturedDiff` and `seatOfExecution` similarly preserve optional raw facts.
- One-way booleans are omitted unless true; this verdict is not a one-way boolean.

## Existing tests

- `src/log/run-log.test.ts` tests the pure run-log boundary with fabricated inputs.
- It uses `baseInput` to create a complete minimal record.
- Round-trip tests commonly use build → serialize → `readRuns` or `reviveRecord`.
- Optional metadata sections cover valid round trips, absence, malformed inputs, and legacy lines.
- Tests assert byte compatibility for absent optional fields where relevant.
- The suite avoids filesystem, clocks, executors, subprocesses, and network calls.
- This pattern is sufficient to prove the exact `runs.jsonl` line shape.

## Relevant file ownership

- `src/log/run-log.ts` is the sole schema/write/read implementation to modify.
- `src/log/run-log.test.ts` is the sole focused proof file to modify.
- `src/cross-review/review-core.ts` already exposes the upstream runtime value and need not change.
- `src/cross-review/review.ts` already verifies provider-neutral stub review behavior and need not change.
- `src/engine/cast.ts` does not currently compose cross-review invocation.
- The ticket criterion is specifically the ledger round trip, while the next story owns clear-path composition.

## Constraints and assumptions

- The ledger should remain executor-agnostic and must not import `AgentSeat` or `CrossReviewVerdict`.
- Seat strings in the log are durable facts, not routing-policy validation points.
- The durable verdict must include authoring seat because upstream `CrossReviewVerdict` does not.
- Pass/fail should remain explicit data rather than be inferred from `detail` or `gateResults`.
- Detail must be optional because the settled pass value has no reason.
- A fail can map its required upstream `reason` into durable `detail` at composition time.
- An absent verdict must result in no JSON key at all.
- A malformed optional verdict must not invalidate an otherwise useful historical run.
- The next story can consume the durable verdict without changing its persisted shape.

## Verification baseline

- Focused test command: `bun test src/log/run-log.test.ts`.
- Type gate is included in the repository's required `bun run check`.
- Required final gate: `bun run check`.
- Whitespace validation can be run on the exact two source paths.

## Research conclusion

The ticket lands at one established seam: add one atomic optional structured fact to the local
run-log contracts, normalize it on write and revive, and prove both presence and absence through
the JSONL round trip. No executor, routing, cast classification, or live review behavior belongs
in this unit. The additive field must preserve old/single-seat line shape by complete omission.
