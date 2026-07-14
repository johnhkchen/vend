# Research — T-076-01-02 cross-review-skipped-marker

## Assignment and phase

- The ticket is `T-076-01-02`.
- Its parent story is `S-076-01`.
- The ticket begins in `research` phase.
- The assignment requires one continuous Research → Design → Structure → Plan → Implement →
  Review pass.
- Attempt artifacts belong under `.lisa/attempts/T-076-01-02/1/work/`.
- Lisa, not this worker, publishes admitted artifacts to `docs/active/work/T-076-01-02/`.
- Lisa, not this worker, updates ticket phase and status frontmatter.
- Ticket-owned source changes must be committed with `lisa commit-ticket` and exact `--include`
  paths.
- The ordinary Git index must not be used for ticket work.

## Product and charter context

- Vend is a local-first orchestrator for reusable, gated playbooks.
- The product promise is repeatability over probabilistic agent work.
- Gates are the contract that makes autonomous execution trustworthy.
- Story `S-076-01` advances P3 by making an inert cross-review gate observable rather than silent.
- The ticket also cites P7 because the ledger must distinguish requested gate behavior from actual
  gate behavior.
- The run remains autonomous: the marker records a missing capability; it does not ask a human for
  approval.
- Fresh installs must remain usable with one executor and no second live service.

## Story contract

- `S-076-01` is limited to complement resolution, the settlement wiring in `src/engine/cast.ts`,
  and the run-record marker in `src/log/run-log.ts`.
- Dependency ticket `T-076-01-01` already changed default complement resolution to be inert.
- With omitted configuration, only the Claude author capability is considered provisioned for
  cross-review.
- A live reviewer resolves only through an explicitly supplied `ExecutorRegistry` containing the
  author and exactly one complement seat.
- When a lane-ful author lands a captured diff and resolution returns `null`, cross-review would
  otherwise be applicable but cannot bind.
- That relevant-but-inert event must be represented by `crossReviewSkipped`.
- The marker must state why review did not bind and what condition would make it bind.
- A lane-less cast is outside the relevant cross-review path.
- A diff-less cast is outside the relevant cross-review path.
- Neither irrelevant path may gain a marker or otherwise change its serialized run record.
- Provisioned-but-unreachable reviewer behavior belongs to `S-076-02`, not this ticket.
- Doctor coverage and reviewer provisioning UI are also out of slice.

## Dependency result: complement resolution

- `src/cross-review/resolve-complement.ts` owns complement workflow policy.
- `resolveComplementExecutor` accepts the raw execution seat and an optional `ExecutorRegistry`.
- The omitted registry is now a private one-seat registry containing only `DEFAULT_EXECUTOR_ID`.
- The shipped `builtinExecutors` catalog is not treated as proof that every adapter is provisioned.
- Executor ids are projected to seats through `resolveSeatOfExecution`.
- Unknown executor ids do not become cross-review seats.
- The authoring seat must exist in the configured registry.
- Exactly one different configured seat must exist.
- Any absent, incomplete, stale, or ambiguous capability set returns `null`.
- Executor construction is lazy and occurs only after a sole complement has been selected.
- The resolver does not return a reason union; its inert state is represented only by `null`.
- Therefore `castPlay` can honestly record that resolution was inert, but cannot distinguish every
  internal null subcase without changing the dependency ticket's public contract.

## Cast settlement path

- `src/engine/cast.ts` is the impure orchestration shell.
- It resolves the author executor and projects its id to `seatOfExecution` before dispense.
- A successful play verdict authorizes `play.effect`.
- A successful effect can report artifacts.
- `captureEffectDiff` converts concrete landed artifact changes into a repository-relative diff
  reference under `.vend/artifacts/`.
- `capturedDiff` is absent when no artifact bytes differ.
- Cross-review currently runs inside the successful-effect block.
- The current applicability guard requires all of:
  - gates are enabled;
  - the effect reported `ok`;
  - `capturedDiff` is present;
  - `seatOfExecution` is present.
- Inside that guard, `resolveComplementExecutor` is called with the authoring seat.
- `CastOptions.crossReviewRegistry` is passed when explicitly supplied.
- Otherwise the resolver uses its inert one-seat default.
- When resolution returns a reviewer, `castPlay` reads the captured patch and calls
  `dispenseReviewVerdict`.
- A valid reviewer result becomes `crossVendorVerdict` with both seat provenances.
- `settleCrossReview` converts a complement refusal into `gate-failed` while preserving that the
  effect physically materialized.
- When resolution returns `null`, the current code performs no action and records no explanation.
- The requested marker belongs at this exact null branch because this is the first point where all
  applicability facts are true and missing reviewer resolution is known.
- Marking earlier would confuse lane-less or diff-less casts with missing reviewer capability.
- Marking later by inferring from absence of `crossVendorVerdict` would also confuse irrelevant
  casts, malformed replies, and historical records.
- `skipGates` bypasses the entire review applicability guard.
- An ungated run therefore does not reach complement resolution and is not a resolution-inert
  event for this ticket.

## Run-log schema pattern

- `src/log/run-log.ts` keeps ledger types local and imports nothing from executor or cross-review
  modules.
- This preserves the log as a passive sink rather than a policy collaborator.
- `SeatDefaulted` is a structured optional marker with three required non-empty strings.
- `SeatInferred` is a structured optional marker with two required non-empty strings.
- Each marker is declared independently in `RunRecordInput` and normalized `RunRecord`.
- Input comments describe the event, required facts, and absence/back-compat meaning.
- Record comments describe read-path preservation and malformed metadata behavior.
- `normalizeSeatDefaulted` validates all fields atomically.
- It rebuilds the object to select only schema fields and impose deterministic key order.
- Partial or malformed marker objects are omitted instead of invalidating an otherwise useful run.
- `buildRunRecord` normalizes the optional marker and conditionally spreads it into the record.
- `reviveRecord` applies the same normalization to parsed JSON.
- The read boundary silently drops malformed optional metadata while retaining the base record.
- `serializeRunRecord` is ordinary compact `JSON.stringify` plus one newline.
- Conditional spreads preserve byte compatibility when an optional marker is absent.
- `crossVendorVerdict` and `capturedDiff` use the same optional-field machinery nearby.
- The schema version remains `1`; additive optional fields have historically not bumped it.

## Existing run-log tests

- `src/log/run-log.test.ts` uses `baseInput` to fabricate complete valid records.
- The `seatDefaulted` suite is the closest acceptance pattern named by the ticket.
- It verifies build, serialize, revive, and byte-stable reserialization.
- It pins a literal pre-feature line for absent-marker byte compatibility.
- It verifies a historical line revives without synthesizing the marker.
- It verifies partial markers are omitted atomically.
- It verifies extra nested fields do not persist.
- It verifies malformed parsed metadata is dropped without losing the record.
- The `seatInferred` suite repeats this pattern through `readRuns`, the ledger read path named in
  acceptance.
- The `crossVendorVerdict` suite verifies both reviewed and inert records.
- A `crossReviewSkipped` suite can follow these established conventions without new test helpers.

## Existing cast tests

- `src/engine/cast.test.ts` provides token-free stub executors and temporary Git repositories.
- `boardPlanPlay` writes a story and ticket so `captureEffectDiff` has real patch bytes.
- `crossReviewRegistry` returns a two-seat configured registry with a primed reviewer.
- Passing and refusing cross-review tests cover the live reviewer path.
- The current single-seat test lands a real diff with a known Claude lane and an explicit
  Claude-only registry.
- It currently asserts success, ordinary gate evidence, and absence of `crossVendorVerdict`.
- That fixture already reaches the exact relevant-plus-null settlement branch this ticket owns.
- It is therefore the natural positive integration test for `crossReviewSkipped`.
- The earlier captured-diff test uses a stub executor whose id defaults to `stub`.
- `resolveSeatOfExecution("stub")` returns `undefined`, making that fixture lane-less while still
  producing a real diff.
- It can pin absence of `crossReviewSkipped` for the lane-less boundary.
- The no-op effect test uses a known execution path but produces no captured diff.
- It can pin absence of `crossReviewSkipped` for the diff-less boundary.
- These two negative fixtures directly cover the ticket's byte-compatibility condition at the
  serialized record boundary.
- Existing passing/refusing reviewer tests should also assert absence of the skipped marker so the
  marker and verdict cannot coexist unnoticed.

## Pure-core boundary

- No new classification judgment is needed in `cast-core.ts`.
- Applicability is already explicitly represented by the impure shell's guard.
- Resolution is already pure in `resolve-complement.ts`.
- Run-log normalization is pure and independently unit-tested.
- `castPlay` is the wiring seam that observes both captured effect bytes and resolved runtime
  capability.
- A fixed marker value at the null branch does not require filesystem, clock, network, or process
  policy in a new core module.
- The implementation can preserve the project's pure-core/impure-shell convention by keeping
  schema normalization pure and wiring only data in the shell.

## Workspace and commit constraints

- The worktree already contains Lisa-owned modifications to `.lisa/provenance.jsonl` and ticket
  frontmatter files.
- Those changes are not ticket-owned source work and must not be reverted or included.
- No ticket-owned source files were modified at Research time.
- The dependency source commit is `2067d90` and its completion publication is `e784645`.
- The implementation is expected to own only `src/log/run-log.ts`,
  `src/log/run-log.test.ts`, `src/engine/cast.ts`, and `src/engine/cast.test.ts`.
- Attempt artifacts remain private and are not included in source-unit commits.

## Research conclusions and constraints

- The positive stamp condition is already a precise branch: gates enabled, effect landed, diff
  captured, author lane known, resolver returned `null`.
- Lane-less and diff-less records must remain structurally and byte compatible through omission.
- A provisioned successful or refusing reviewer must carry `crossVendorVerdict`, not a skipped
  marker.
- The run-log marker should be an atomic structured optional object with required non-empty string
  fields and deterministic normalization.
- The marker must not import executor/cross-review types into the ledger.
- The read boundary must preserve valid markers and drop malformed optional markers without
  discarding their records.
- The schema version should remain unchanged, consistent with every nearby additive optional
  provenance field.
- No live or metered executor call is necessary to satisfy or verify this ticket.
