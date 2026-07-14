# T-073-01-04 — Review

## Outcome

PASS. The ticket acceptance criterion is fully met.

The run ledger now supports an optional atomic cross-vendor verdict containing authoring seat,
reviewing seat, explicit pass/fail, and optional detail. The supported JSONL write/read round trip
preserves that value for a cross-reviewed run and emits no verdict key for a single-seat run.

The verdict is deliberately evidence only. It does not change the run's terminal outcome or block
materialization in this story; S-073-02 owns enforcement.

## Source commit

```text
e560ee62f21211c771c84e98693d3a0d459d097d
feat(run-log): record cross-vendor verdict
```

The commit was created with `lisa commit-ticket` and two exact repository-relative include paths.
No ordinary staging or commit command was used.

## Files modified

### `src/log/run-log.ts`

Added `CrossVendorVerdict`, a local structural durable contract:

- `authoringSeat: string`;
- `reviewingSeat: string`;
- `verdict: "pass" | "fail"`;
- optional `detail: string`.

Added optional `crossVendorVerdict` properties to both `RunRecordInput` and normalized `RunRecord`.

Added symmetric pure normalization:

- both seat provenances are required and non-empty;
- verdict accepts only the two settled values;
- detail is optional but must be non-empty when retained;
- unknown nested fields are discarded;
- a partial/malformed optional object is omitted atomically;
- malformed optional metadata does not invalidate an otherwise useful historical run.

The normalized field is conditionally spread in `buildRunRecord` and `reviveRecord`. Absence
therefore remains true omission in serialized JSON rather than `null`, an empty object, or a
fabricated pass.

No schema version, outcome vocabulary, generic gate-row shape, filesystem shell, or ledger
derivation changed.

### `src/log/run-log.test.ts`

Added five focused tests.

The acceptance test constructs the actual two-line JSONL representation:

- reviewed line: contains authoring seat, reviewing seat, `pass`, and detail;
- single-seat line: contains no `crossVendorVerdict` key.

It checks both the raw serialized line objects and the public `readRuns` result. The remaining tests
cover a failed verdict with detail, a detail-free pass, partial write input, and malformed read-side
optional metadata.

## Acceptance evaluation

Criterion:

> A run-log round-trip test shows the runs.jsonl line for a cross-reviewed cast carries the
> cross-vendor verdict with both seats and a pass/fail, while a single-seat run's line carries no
> such verdict.

Evidence:

- Cross-reviewed fixture run id: `xv-reviewed`.
- Authoring seat: `claude`.
- Reviewing seat: `codex`.
- Verdict: `pass`.
- Detail: `No blocking defect found`.
- The raw first JSONL line contains the exact nested object.
- The raw second JSONL line has no `crossVendorVerdict` property.
- `readRuns` revives two records and skips zero.
- The first revived record deep-equals the complete verdict.
- The second revived record has no verdict property.
- A second test proves the `fail` arm and its detail byte-stably round-trip.

Result: fully met with no filesystem fixture, subprocess, executor, network, or token spend.

## Verification

Focused verification:

```text
bun test src/log/run-log.test.ts
git diff --check -- src/log/run-log.ts src/log/run-log.test.ts
```

Focused result:

- 113 tests passed.
- 0 failed.
- 245 assertions.
- Whitespace check passed.

Full required gate:

```text
bun run check
```

Full result:

- BAML generation completed.
- TypeScript passed.
- 1,686 tests passed.
- 1 existing intentional release-artifact integration test skipped.
- 0 tests failed.
- 5,199 assertions across 113 files.

## Design quality assessment

The pure-core/impure-shell boundary remains intact. All new judgment is a pure normalization helper;
the existing `appendRunLog` filesystem wrapper is unchanged.

The log remains a sink. It imports neither `CrossReviewVerdict`, `AgentSeat`, the executor registry,
nor complement-resolution policy. Structurally local seat strings match the existing durable-fact
stance of `seatOfExecution` and keep executor agnosticism intact.

Atomic nesting avoids representable partial provenance across separate top-level keys. Tolerant
revival follows the established append-only policy: optional metadata damage loses only that
metadata, never the complete usable run.

Single-seat inertness is honest absence. The implementation does not infer a complement, assume a
review passed, or introduce a placeholder detail.

The additive optional field preserves source compatibility for all existing callers and data
compatibility for all historical ledger lines. Keeping schema version 1 matches established
repository practice for additive optional fields.

## Test coverage assessment

Coverage is proportional and pins every load-bearing branch:

- reviewed presence on the literal JSONL line;
- single-seat absence on the literal JSONL line;
- supported read round trip;
- both pass and fail discriminants;
- detail present and absent;
- incomplete write input;
- malformed optional read input;
- surrounding run survival;
- byte stability for a failed verdict.

No filesystem-level `appendRunLog` test was added. The impure wrapper only composes the fully tested
pure build/serialize functions with `mkdir` and `appendFile`, and this ticket changes none of that
shell. The raw serialized physical lines directly prove the acceptance's `runs.jsonl` shape.

## Open concerns and limitations

- No current cast orchestration invokes the reviewer and supplies this field. This ticket settles
  the durable contract; downstream composition maps the execution seat plus `CrossReviewVerdict`
  into it.
- The upstream failure member is named `reason`; the durable field is named `detail`. The caller
  must map that value explicitly.
- The run-log type does not enforce that authoring and reviewing seats differ. That is routing
  policy already owned by complement resolution, not durable-log validation.
- Detail is not required for durable fail values even though the upstream parser requires a fail
  reason. Runtime readers are tolerant by design; enforcement code should consume the upstream
  validated shape or decide its own evidence requirements.
- The verdict is non-blocking. A failed review can coexist with the current terminal `outcome` until
  S-073-02 implements autonomous refusal.

None of these limitations prevents the ticket criterion from being met.

## Explicitly out of slice

- Loading the captured diff artifact into the review operation.
- Invoking complement review from `castPlay`.
- Mapping review failure to `gate-failed`.
- Preventing materialization/settlement on failure.
- Adding new executors or routing seats.
- Per-playbook review rubric authoring.
- Live metered cross-vendor proof.
- Release-day gold-master bake-off.

## Repository hygiene

- Both ticket-owned source paths are committed and clean.
- The ordinary Git index is empty.
- Lisa-owned ticket, provenance, and publication paths were not included.
- All six phase artifacts exist in the attempt-private assignment directory.
- No public work artifact was directly authored by this agent.

The ticket is ready for Lisa's completion publication and seat release.
