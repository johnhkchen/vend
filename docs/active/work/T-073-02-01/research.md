# T-073-02-01 — Research

## Assignment and contract

- The ticket begins in `research` and requires all six RDSPI phases in one pass.
- Attempt artifacts belong only under `.lisa/attempts/T-073-02-01/1/work/`.
- Lisa owns ticket phase/status transitions and publication into `docs/active/work/`.
- Ticket-owned source commits must use `lisa commit-ticket` with exact include paths.
- The parent story is `S-073-02`, whose scope is the run-level clear/refuse decision.
- The ticket advances P3 (gates are the contract) and P4 (autonomous gating).
- Acceptance requires fail, pass, and no-complement behaviors on the cast/clear path.

## Parent-story boundary

- `S-073-02` consumes the cross-review substrate delivered by `S-073-01`.
- A FAIL must settle as `gate-failed`, never `success`.
- A PASS must settle successfully and retain the cross-vendor verdict.
- No complement must leave the cast unchanged and omit cross-review evidence.
- No human approval or interactive step is permitted.
- The proof in this ticket is fixture-based and token-free.
- Live second-vendor review, new executors, and per-playbook rubric authoring are excluded.
- `T-073-02-02` follows this ticket and owns the explicit bad-diff/good-diff demonstration.

## Existing cast path

- `src/engine/cast.ts` is the impure generic orchestration shell.
- It resolves the authoring executor and maps its id to `seatOfExecution`.
- It dispenses, meters, parses, gates, and calls pure `classify`.
- A clearing classifier verdict authorizes `play.effect`.
- The effect reports written artifacts.
- `captureEffectDiff` creates `.vend/artifacts/<run>.diff` only for a landed non-empty change.
- The shell currently records `capturedDiff` and `seatOfExecution` on the ledger.
- It currently performs no complement resolution, diff loading, review dispense, or verdict enforcement.
- `RunSummary` currently surfaces outcome, materialization, produced reference, diff, and actuals.

## Existing pure decision core

- `src/engine/cast-core.ts` owns `classify` and gate-row translation.
- `classify` handles timeout, play-gate STOP, token exhaustion, and ordinary success.
- Timeout outranks all other outcomes.
- A play-gate STOP maps to `gate-failed` and `materialize: false`.
- Explicit gate clear can retain a detect-after token overshoot with `overEnvelope: true`.
- The classifier runs before the effect because play gates judge parsed output.
- Cross-review cannot run at that point because its required captured diff does not yet exist.
- `src/engine/cast-core.test.ts` pins the classifier truth table without effects or addons.

## Existing cross-review substrate

- `src/cross-review/resolve-complement.ts` maps an execution seat to exactly one configured other seat.
- Resolution is inert for unknown, absent, one-seat, stale, or ambiguous configurations.
- It accepts an injectable `ExecutorRegistry`, which supports hermetic stub tests.
- `src/cross-review/review.ts` dispenses a context-complete adversarial prompt through `Executor.dispense`.
- `dispenseReviewVerdict` constrains the reviewer to one turn and returns a validated union.
- PASS carries `reviewingSeat`.
- FAIL carries `reviewingSeat` and a required non-empty `reason`.
- Malformed reviewer output throws `CrossReviewResponseError`; it is not silently treated as pass or fail.
- `src/cross-review/review-core.ts` owns prompt rendering and response parsing.

## Existing ledger substrate

- `src/log/run-log.ts` already declares durable `CrossVendorVerdict`.
- The durable value contains authoring seat, reviewing seat, pass/fail, and optional detail.
- `RunRecordInput` and `RunRecord` both carry optional `crossVendorVerdict`.
- Build, serialize, revive, and read round trips are already covered.
- Missing verdict means no review ran; it is not equivalent to pass.
- `RUN_OUTCOMES` already includes `gate-failed`; no outcome migration is needed.
- Generic `gateResults` can represent an added cross-review row.
- The ledger remains a sink and must not own enforcement policy.

## Existing test seams

- `src/engine/cast.test.ts` injects an authoring `Executor` into `castPlay`.
- It creates temporary projects and real temporary Git repositories.
- `boardPlanPlay` writes story/ticket artifacts and therefore produces a captured diff.
- Stub executors already return deterministic terminal messages without network or token spend.
- Existing diff tests use an executor id of `stub`, which maps to no execution seat and is review-inert.
- A new test can use author id `claude` and an injected registry containing `claude` plus a stub `openai-compat` reviewer.
- Raw JSONL assertions and `reviveRecord` are already local test patterns.

## Sequencing constraint

- The authored output must clear its original play gates before the effect runs.
- The effect must land before its Git patch can be captured.
- Complement review therefore occurs after effect/diff capture and before final ledger settlement.
- A review failure can truthfully change terminal outcome to `gate-failed`.
- It cannot truthfully claim the effect never wrote; `RunSummary.materialized` must remain the physical effect fact.
- Rollback is not part of the story and would be unsafe in a shared working tree.
- “Blocking clear” therefore means blocking successful settlement, not transactional filesystem rollback.

## Rubric evidence available at integration

- Per-playbook rubric authoring is explicitly outside this slice.
- The cast has the play identity/summary and the actual play gate rows.
- The reviewer prompt contract accepts caller-supplied `rubricContext` as plain text.
- The integration can render a deterministic rubric from play name, play summary, and gate evidence.
- This avoids inventing a new Play interface field and keeps the authoring contract unchanged.

## Constraints and risks

- Ordinary casts with a known seat and captured diff will now attempt the configured complement review.
- Tests must inject the registry so no real endpoint is contacted.
- A no-diff effect has nothing to review and remains inert.
- A one-seat registry remains inert by resolver contract.
- Review timeout can reuse the original cast budget latch; no separate budget contract is specified.
- Reviewer usage is not currently included in authoring usage/cost; that was explicitly deferred upstream.
- A failed review should add durable failed gate evidence, not erase the original passing gate rows.
- A passing review should add a passed cross-review row and attach the nested verdict.
- Existing single-seat/no-review bytes should remain unchanged apart from unrelated timestamps.

## Files in scope

- `src/engine/cast-core.ts`: pure post-effect cross-review settlement decision and evidence row.
- `src/engine/cast-core.test.ts`: fail/pass/absent truth table.
- `src/engine/cast.ts`: resolve complement, load diff, dispense review, settle outcome, append verdict.
- `src/engine/cast.test.ts`: cast-path tests using author/reviewer stubs and one-seat inertness.

## Files not requiring change

- `src/log/run-log.ts`: durable shape and normalization already exist.
- `src/cross-review/review.ts`: dispense and parsing contract already exist.
- `src/cross-review/resolve-complement.ts`: injectable complement resolution already exists.
- `src/engine/play.ts`: no new authoring field is in slice.
- CLI and concrete executors: generic cast composition covers them.

## Research conclusion

The required pieces exist but are not composed. The missing work is a post-effect settlement seam:
resolve a complement for a known execution seat, read the captured patch, obtain a structured
verdict, translate it into a durable cross-vendor value and gate row, and let failure relabel the
terminal run outcome to `gate-failed`. The pure decision should be isolated from filesystem and
executor effects; the cast shell should preserve honest physical materialization while refusing
successful settlement.
