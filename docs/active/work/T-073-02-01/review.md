# T-073-02-01 — Review

## Outcome

PASS. The ticket acceptance criterion is fully met.

A diff-bearing cast now autonomously obtains the configured complement-seat review before final
settlement. A structured FAIL prevents the run from settling as cleared: summary and ledger both
report `gate-failed`, and the ledger carries the refusing cross-vendor verdict plus a failed gate
row. PASS retains success with the verdict and passed gate row attached. A one-seat registry remains
cross-review inert and clears with its prior record shape.

No human approval step was introduced.

## Source commit

```text
8dde3c0c3de2738a8b9c653984a86991ddcae19b
feat(engine): enforce cross-review settlement gate
```

The commit was created through `lisa commit-ticket` with four exact source/test include paths. No
ordinary-index staging or commit was used.

## Files modified

### `src/engine/cast-core.ts`

Added the pure post-effect settlement policy.

`CROSS_VENDOR_REVIEW_GATE` gives ledger evidence a stable name. `settleCrossReview` accepts the
initial classifier result and an optional durable cross-vendor verdict:

- no verdict returns the base result unchanged;
- pass appends a passed `cross-vendor-review` row;
- fail appends a failed row and forces terminal `gate-failed`;
- previous play gate evidence stays ordered before the new row;
- materialization and one-way over-envelope facts remain honest.

The function is separate from `classify` because classification authorizes the effect, while a Git
diff exists only after that effect reports its artifacts. This separation names the two decisions
instead of overloading `materialize` with contradictory pre/post-effect meanings.

### `src/engine/cast-core.test.ts`

Added three pure truth-table cases:

- absent review is inert by identity;
- pass preserves clear and appends passed evidence;
- fail blocks clear while preserving the landed-effect fact and reason detail.

### `src/engine/cast.ts`

Composed the S-073-01 substrate into the generic cast shell.

After a successful gated effect yields a captured diff, the shell:

1. resolves the unique configured complement from the actual execution seat;
2. reads the captured patch artifact;
3. renders review context from authored play identity/purpose and play-gate evidence;
4. dispenses the existing context-complete one-turn review operation;
5. maps trusted seat provenance and pass/fail detail into the durable verdict;
6. applies pure settlement;
7. writes one final ledger line and returns the same terminal outcome.

An optional `crossReviewRegistry` supports hermetic configured-seat fixtures. Production callers
remain source-compatible and use the built-in registry.

Review is skipped when gates are explicitly skipped, the effect fails, no patch is produced, the
authoring lane is unknown, or no unique complement resolves. Complement construction itself is
deferred until all earlier conditions hold.

A fail prints an autonomous andon. The previous over-envelope “gates cleared” message now prints
only for a final success, avoiding contradictory stdout after a review refusal.

### `src/engine/cast.test.ts`

Added a primed, recording two-seat registry fixture and three cast-path tests using real temporary
Git repositories and zero-token stub executors.

The failure test proves prompt composition, complement invocation, summary refusal, ledger refusal,
nested verdict provenance/detail, failed gate evidence, and supported revival.

The pass test proves successful settlement with attached verdict and passed evidence.

The one-seat test proves inertness: unchanged success and original gate rows, with no nested field.

## Acceptance evaluation

Criterion:

> A cast whose stub reviewer refuses resolves to a gate-failed outcome and does not settle as
> cleared; a passing verdict clears with the verdict attached; a single-seat run clears unchanged.

### Refusal

Met.

- Authoring seat: `claude`.
- Reviewing seat: `codex` through stub `openai-compat`.
- Reviewer verdict: fail.
- Reviewer detail: `acceptance proof is missing`.
- `RunSummary.outcome`: `gate-failed`.
- Ledger outcome: `gate-failed`.
- Ledger nested verdict: both seats, fail, detail.
- Ledger review row: failed with the same detail.
- No human input or approval occurs.

### Pass

Met.

- Reviewer verdict: pass.
- `RunSummary.outcome`: success.
- Ledger outcome: success.
- Nested verdict retains authoring and reviewing seats.
- Passed review gate row is attached.

### Single seat

Met.

- Complement resolver receives a registry containing only Claude.
- Cast outcome remains success.
- Original fixture gate row remains the entire gate row set.
- `crossVendorVerdict` remains absent.

## Semantic note: settlement versus materialization

The failed test reports `materialized: true`. This is intentional and honest, not a softened
refusal. Cross-review evaluates the captured Git diff, and that diff can only be created after the
play's effect writes and reports artifacts. The repository has no transactional effect/rollback
contract. Therefore FAIL blocks successful settlement (`gate-failed`) while `materialized` records
the physical fact that the reviewed effect landed.

The follow-on demonstration can rely on terminal outcome and ledger evidence to prevent downstream
clearing. It must not claim cross-review provides filesystem rollback.

## Verification

Focused verification:

```text
bun test src/engine/cast-core.test.ts src/engine/cast.test.ts
bun run build
git diff --check -- src/engine/cast-core.ts src/engine/cast-core.test.ts src/engine/cast.ts src/engine/cast.test.ts
```

Focused result:

- 82 tests passed.
- 0 failed.
- 275 assertions.
- Typecheck and whitespace checks passed.

Full required gate after the final edit:

```text
bun run check
```

Full result:

- BAML generation completed.
- TypeScript passed.
- 1,692 tests passed.
- 1 existing intentional release-artifact integration test skipped.
- 0 failed.
- 5,231 assertions across 113 files.

## Design-quality assessment

The pure-core/impure-shell boundary is preserved. Cross-review settlement is a total plain-value
function. Registry resolution, file loading, executor invocation, stdout, and ledger append remain
in the shell.

The ledger remains a sink. Enforcement consumes its structural verdict type but does not move
workflow policy into `run-log.ts`.

Executor agnosticism is preserved. The integration depends on `ExecutorRegistry`, complement
resolution, and `Executor.dispense`; it imports no concrete reviewing adapter.

Single-seat inertness is represented as absence, not a fabricated pass. Reviewer seat provenance
comes from local routing, not model output. Failure reason maps explicitly into durable detail.

Gate evidence is additive. Existing authored play rows remain visible, followed by the review gate,
which explains how a run whose original gates passed can still settle as `gate-failed`.

## Test-coverage assessment

Coverage pins every ticket branch and the most important composition facts:

- pure absent/pass/fail settlement;
- real patch production and loading;
- author-to-complement seat projection;
- stub review invocation and prompt content;
- failed summary/ledger agreement;
- passed summary/ledger agreement;
- nested verdict round-trip;
- gate row ordering and detail;
- one-seat absence semantics;
- no network or token spend.

Malformed reviewer output and complement resolution have dedicated upstream unit tests. This ticket
does not duplicate those exhaustive parsers; it exercises their validated output through cast.

## Open concerns and limitations

- Cross-review is post-effect settlement, not rollback. Failed artifacts remain available for
  audit/correction; downstream orchestration must key on the non-success outcome.
- Reviewer usage/cost is not added to the authoring executor's usage fields. Upstream explicitly
  deferred review metering, and this ticket's proof uses zero-cost stubs.
- The generic review rubric uses the play's required purpose and emitted gate evidence. Authored
  per-playbook review rubrics remain intentionally out of slice.
- A reviewer transport or schema error still propagates as an operational error rather than being
  fabricated into pass/fail. That preserves upstream honesty but is not a clean ledger outcome in
  this ticket.
- Live second-vendor endpoint behavior remains unproven and requires explicit metered authorization.

None of these limitations prevents the ticket criterion from being met.

## Explicitly out of slice

- Transactional effect staging or rollback.
- Per-playbook rubric authoring.
- Adding or modifying executors.
- Human review/approval UI.
- Live metered cross-vendor proof.
- The intentionally-bad/good end-to-end demonstration owned by `T-073-02-02`.
- Release-day gold-master bake-off.

## Repository hygiene

- All ticket-owned source/test paths are committed and clean.
- Lisa-owned ticket/provenance changes were not included.
- Attempt artifacts were written only under the assigned private directory; Lisa mirrored admitted
  phase artifacts to the shared work path.
- No ordinary Git index work was performed.
- The ticket is ready for Lisa completion publication and seat release.
