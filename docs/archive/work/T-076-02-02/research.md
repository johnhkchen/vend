# T-076-02-02 Research — ledger line and artifact survive settlement throw

## Assignment and workflow boundary

- The ticket is `T-076-02-02`, generation 1.
- Its current phase is `research`.
- The parent story is `S-076-02`, settlement-never-crashes-never-loses-the-ledger.
- The assignment requires all remaining RDSPI phases in one continuous pass.
- Attempt artifacts belong under `.lisa/attempts/T-076-02-02/1/work/`.
- Lisa publishes admitted artifacts to `docs/active/work/T-076-02-02/`.
- This worker must not edit ticket phase or status fields.
- Ticket-owned source commits must use `lisa commit-ticket` with exact relative includes.
- The ordinary Git index must not be used for ticket work.
- Completion means source, tests, and private workflow artifacts exist, the repository gate is
  green, the source unit is committed, and `review.md` is written.

## Product and story contract

- Vend is local-first, typed playbook orchestration.
- A run spends a bounded allocation and settles against authored gates.
- P7 makes the budget a hard contract in both directions.
- The ledger is where actual usage, cost, envelope, lane heat, and outcome become durable.
- A cast that spent tokens but left no row violates P7 even if its effect landed.
- Story `S-076-02` limits this work to the settlement tail of `src/engine/cast.ts` and the
  run-record/artifact write path.
- The settlement tail begins after an authorized effect lands.
- It includes diff capture, cross-review resolution/dispense, post-review settlement, terminal
  rendering, record assembly, and the append.
- The story names three invariants.
- Reviewer dispense failure becomes an existing amber `missing-capability` outcome.
- Any other settlement throw still leaves a ledger row.
- A captured diff and the ledger evidence describing it stay mutually auditable.
- Retrying review is out of scope.
- Successful reviewer verdict semantics are out of scope.
- The next ticket owns the full default-config no-network characterization.

## Dependency state

- `T-076-02-01` is complete in commit `65675b9` plus Lisa completion commit `b0513f0`.
- That ticket catches reviewer dispense and schema failures specifically.
- It maps them to `settleCrossReviewFailure` and the `missing-capability` outcome.
- It keeps already-observed usage, materialization, and captured diff facts.
- It intentionally does not catch unrelated settlement failures.
- Its review explicitly hands general record-write-on-throw and artifact consistency to this
  ticket.
- Existing reviewer pass, reviewer fail, inert resolution, and throwing-reviewer tests are the
  compatibility oracle for this change.

## Worktree state

- The branch is `main`, ahead of `origin/main` by the admitted E-076 work.
- `.lisa/provenance.jsonl` is already modified by Lisa.
- `docs/active/tickets/T-076-02-02.md` is already modified by Lisa.
- No ticket-owned source file was modified when this attempt began.
- No nested `AGENTS.md` exists below the repository root.
- Lisa-owned metadata must remain outside the ticket source commit.

## The cast shell before settlement

- `src/engine/cast.ts` exports the impure `castPlay` orchestrator.
- It resolves MCP tools before any dispense.
- It resolves and probes the primary executor before model work.
- Those two pre-dispense andon paths append zero-spend rows and return early.
- The ordinary model path creates a transcript and streams messages to it.
- Non-timeout primary-executor dispense failures still propagate before ordinary settlement.
- Timeout is represented as data and continues to ordinary logging.
- Returned usage is checked against the token envelope.
- The play parses the returned result and runs its authored gates.
- `classify` produces the base `Verdict`.
- A clear verdict authorizes the play effect.
- Contracted effect failures are returned as `EffectResult` data.
- Uncontracted effect throws propagate before the settlement tail.
- The current ticket does not broaden the pre-effect or effect-throw boundary.

## Effect and diff-capture ordering

- On an authorized path, `play.effect` runs first.
- A successful effect may report an `artifacts` list.
- `castPlay` then calls `captureEffectDiff` for those reported paths.
- `captureEffectDiff` is the impure Git/filesystem shell in `src/engine/cast-diff.ts`.
- It rejects artifact paths outside the project root.
- It checks whether the project is a Git worktree.
- It separates tracked and untracked artifact paths.
- Tracked changes use `git diff HEAD`.
- Untracked changes use `git diff --no-index /dev/null`.
- Empty patches produce no diff artifact and no reference.
- Non-empty patches are written to `.vend/artifacts/<sanitized-run-id>.diff`.
- The function returns that repository-relative reference only after `writeFile` resolves.
- `castPlay` copies the reference onto its local `capturedDiff` variable.
- The effect and generated business artifacts already exist before diff capture starts.
- The diff file is therefore settlement evidence, not the effect itself.

## Cross-review ordering

- Cross-review is relevant only when gates are enabled.
- The effect must have reported `ok: true`.
- A non-empty captured diff must exist.
- The primary executor must map to a known authoring lane.
- `resolveComplementExecutor` selects a configured opposite seat or returns `null`.
- A null resolution creates `crossReviewSkipped` data.
- A resolved reviewer causes `castPlay` to read the captured patch from disk.
- The patch read occurs outside the reviewer-specific try/catch added by `T-076-02-01`.
- The reviewer-specific catch begins only around `dispenseReviewVerdict`.
- Reviewer dispense, timeout, and malformed-reply errors become `CrossReviewFailure` data.
- A valid review becomes `crossVendorVerdict` data.
- A patch-read failure remains an unrelated settlement throw.
- Resolver factory failure also remains an unrelated settlement throw.

## Terminal settlement ordering

- `settleCrossReview` is a pure post-effect decision.
- A passing verdict appends one passed cross-vendor gate row.
- A refusing verdict appends one failed row and relabels the outcome `gate-failed`.
- `settleCrossReviewFailure` relabels only the outcome to `missing-capability`.
- Physical materialization remains true after review failure or refusal.
- The shell renders reviewer andons, seat-default notices, over-envelope warnings, turn summary,
  and reduced-grounding notice after the review path.
- Those writes and formatting calls are currently before `appendRunLog`.
- Any synchronous throw from those operations exits the cast before the row append.
- Model resolution, turn resolution, reduced-grounding projection, and timestamp creation also
  occur before the append.
- The ordinary append is reached exactly once on a successfully completed tail.

## Run-record assembly

- `src/log/run-log.ts` owns the append-only JSONL schema.
- `RunRecordInput` is the pre-normalization shell contract.
- `buildRunRecord` is pure and validates required identifiers, timestamps, and outcome.
- Optional structured fields are normalized atomically.
- `appendRunLog` is a thin filesystem wrapper around record building and serialization.
- The ordinary record contains the run id, play, subject, model, envelope, project, optional
  intervention/turn/seat facts, optional captured diff, review disposition, outcome, usage, cost,
  gate rows, and timestamps.
- `RUN_OUTCOMES` already contains `errored`.
- Existing documentation defines `errored` as a caught cast exception at graph level.
- The log writer can therefore persist an honest non-success outcome without schema-enum work.
- A post-effect settlement error is distinct from `missing-capability` unless it is the named
  reviewer failure already handled by `T-076-02-01`.

## Current failure modes

- A failure reading a captured patch rejects `castPlay` before `appendRunLog`.
- The diff file remains because it was written before the read.
- The ledger has no matching run id.
- A failure in complement resolution has the same ordering problem.
- A failure in pure settlement or terminal presentation has the same ordering problem.
- Any such failure loses recorded usage and cost despite completed primary dispense.
- The caller may later convert the rejection to an `errored` graph summary, but that summary is
  not appended by `castPlay` and does not repair the missing per-cast ledger row.
- If the diff path is removed between capture and append, the current record still writes
  `capturedDiff` without verifying that it resolves to an available file.
- That produces the inverse inconsistency: a row referencing missing evidence.
- The two field failures exhibited the first direction: an artifact with no row.

## Existing schema patterns

- Optional one-way facts are represented by omitted fields on ordinary records.
- `reducedGrounding` and `overEnvelope` are one-way booleans.
- `seatDefaulted`, `seatInferred`, and `crossReviewSkipped` are structured optional markers.
- Each structured marker requires a complete set of non-empty string fields.
- Malformed marker values are omitted without invalidating the useful base record.
- `buildRunRecord` reconstructs nested objects to drop unknown keys and stabilize ordering.
- `reviveRecord` applies the same tolerant optional-field normalization.
- Historical records remain readable because optional fields are absent by default.
- `capturedDiff` itself is currently normalized as any non-empty string.
- Run-log tests include build, serialize, read, and malformed-option round trips.

## Existing test seams

- `src/engine/cast.test.ts` already has hermetic stub executors.
- `initGitRepo` creates a temporary repository with a real HEAD and local test identity.
- `boardPlanPlay` writes a story and ticket and reports both as artifacts.
- That fixture exercises real diff capture without BAML or model tokens.
- A primary executor with id `claude` makes cross-review relevant.
- `crossReviewRegistry` provides a successful complement reviewer.
- `throwingCrossReviewRegistry` provides a reviewer whose dispense rejects.
- The current throwing-reviewer test proves the named reviewer failure resolves and logs.
- A registry factory is invoked synchronously immediately before the patch read.
- Tests can therefore disturb the captured diff after capture but before `readFile` without adding
  a production-only injection hook.
- `captureStdout` can observe terminal behavior while preserving async results or rejections.
- `Bun.file(path).exists()` is already used to assert artifact presence or absence.
- The full cast suite already checks the row reference equals the returned summary reference.

## Constraints and assumptions surfaced by the map

- The row append itself cannot be made infallible; disk-full or permission failure at the ledger
  path remains a real append failure.
- The ticket asks the append to survive settlement-path throws, not to promise storage success
  when the ledger destination itself is unwritable.
- Separate files cannot be made one filesystem transaction across arbitrary paths.
- Consistency therefore requires ordering plus explicit durable discrepancy data when evidence is
  unavailable, rather than claiming a cross-file atomic primitive exists.
- An honest error row must preserve primary usage, cost, materialization-adjacent facts, and the
  base gate evidence already known before the settlement error.
- A row must not keep `capturedDiff` when the referenced file is unavailable at append time.
- A discrepancy marker must retain the intended reference so an operator can diagnose what was
  lost without treating the missing file as available review evidence.
- General settlement errors must not be mislabeled as reviewer unavailability or gate failure.
- Successful, no-diff, inert-review, reviewer-pass, reviewer-fail, and reviewer-andon bytes should
  remain unchanged except for code organization necessary to establish the failure boundary.
- The pure-core/impure-shell rule favors pure record assembly and a narrow effectful availability
  check in `cast.ts`; run-log remains a data normalizer, not a filesystem verifier.

## Files directly relevant to the ticket

- `src/engine/cast.ts` — settlement orchestration, failure boundary, final append, returned summary.
- `src/engine/cast.test.ts` — full hermetic cast and real-Git failure proof.
- `src/log/run-log.ts` — optional discrepancy record schema and round-trip normalization.
- `src/log/run-log.test.ts` — pure discrepancy schema tests.
- `src/engine/cast-diff.ts` — current artifact write behavior and reference derivation.
- `src/engine/cast-core.ts` — existing pure verdict and review settlement decisions; no current
  filesystem knowledge.

## Research conclusion

- The defect is an ordering boundary, not a reviewer-specific classification defect.
- Primary usage and an effect may be complete while all durable settlement state is still local.
- Diff capture currently creates externally visible evidence before the sole ordinary ledger append.
- The append has no `finally`-equivalent protection from failures in the intervening tail.
- The run-log schema has established optional-marker conventions suitable for an auditable
  unavailable-artifact fact, but no such field exists yet.
- The repository already provides a natural, token-free way to cause a non-reviewer patch-read
  throw after real diff creation.
- The next phase must decide how to preserve the throw signal, choose the durable discrepancy
  shape, and place the single append without changing successful settlement semantics.
