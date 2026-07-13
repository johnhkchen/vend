# T-076-02-02 Review — ledger line and artifact survive settlement throw

## Outcome

Acceptance is met.

A cast whose post-effect settlement tail throws now appends one honest `errored` ledger row before
the original exception returns to its caller. Primary usage, cost, base gate evidence, and any
already-observed settlement facts survive the throw.

Captured diff evidence now has two auditable terminal states:

- an accessible diff is recorded through ordinary `capturedDiff`;
- an unavailable expected diff is omitted as a false reference and recorded through a structured
  `artifactDiscrepancy` marker.

Diff publication itself now uses a temporary sibling plus atomic rename, so a failed capture write
cannot expose a partial final `.vend/artifacts/<run>.diff` path.

Commit:

```text
018a590 fix(engine): preserve ledger across settlement errors (T-076-02-02)
```

## Files changed

| File | Change |
|---|---|
| `src/engine/cast.ts` | guarded the complete post-effect settlement tail; appends in `finally`; rethrows unexpected settlement errors after append; reconciles artifact availability |
| `src/engine/cast.test.ts` | added a real-Git patch-read failure proving the general ledger and discrepancy invariants |
| `src/engine/cast-diff.ts` | changed final diff publication to temporary write plus same-directory rename and cleanup |
| `src/log/run-log.ts` | added optional `ArtifactDiscrepancy` build/revive schema support |
| `src/log/run-log.test.ts` | added complete, absent, partial, malformed, and extra-key marker coverage |

No source file was created or deleted.

The pure verdict core in `src/engine/cast-core.ts` was intentionally unchanged.

## Settlement behavior

Primary execution facts are snapshotted before the guarded tail:

- real or fallback model id;
- executor-reported turns;
- usage buckets;
- total cost;
- reduced-grounding marker state.

The play effect remains outside the guard. This preserves the pre-existing boundary for an
uncontracted effect throw, where the engine cannot know whether an ambiguous effect partially
landed.

After a resolved effect, the guarded tail owns:

- diff capture;
- effect-result projection and presentation;
- complement resolution;
- captured patch read;
- reviewer dispense;
- reviewer settlement;
- terminal andon/warning/turn rendering.

An unexpected throw from that region is caught only long enough to establish durable settlement.
The row outcome becomes `errored`; already-observed gate rows remain; and the exact thrown value is
preserved.

The finally block reconciles artifact state, stamps the final timestamp, and calls the ordinary
append exactly once. Once the append succeeds, the original thrown value is rethrown.

This preserves both contracts:

- the ledger truth: tokens and effect-adjacent evidence are countable;
- the control-flow truth: an unrelated programming or filesystem defect still fails loudly.

A dedicated `settlementThrew` boolean avoids treating `throw undefined` as “no error.”

## Reviewer compatibility

The reviewer-specific behavior from `T-076-02-01` remains nested inside the general guard.

A provisioned reviewer that fails during dispense or verdict parsing still:

- resolves the cast rather than rejecting;
- records `missing-capability`;
- retains materialization and captured diff;
- emits the actionable reviewer andon;
- does not fabricate a failed cross-vendor gate row;
- does not claim `crossReviewSkipped`.

A valid passing reviewer remains success with attached verdict and passed review gate.

A valid refusing reviewer remains `gate-failed` with attached verdict and failed review gate.

A null complement resolution remains success plus `crossReviewSkipped`.

The focused suite exercised all four paths after the refactor.

## Artifact consistency

### Successful publication

`captureEffectDiff` now:

1. assembles the complete patch;
2. writes it to a unique temporary sibling;
3. renames that sibling to the final `.diff` destination;
4. returns the reference only after rename succeeds.

On write or rename failure, temporary cleanup is best-effort and the original error escapes into
the general settlement guard. No final reference was returned, and no partial final path was
published.

Existing real-Git coverage proves the normal branch still writes a non-empty final patch and uses
the same repository-relative reference on summary and row.

### Unavailable captured evidence

At terminal append, `reconcileCapturedDiff` checks a known captured reference.

If accessible, the ordinary row retains `capturedDiff`.

If unavailable, the row omits `capturedDiff` and writes:

```json
{
  "artifactDiscrepancy": {
    "reference": ".vend/artifacts/settlement-read-failure.diff",
    "reason": "captured-diff-unavailable-at-settlement"
  }
}
```

The record therefore never claims that this cast's already-known missing path is usable review
evidence. The expected reference remains countable and diagnosable.

## Run-log schema

Added public data type:

```ts
export interface ArtifactDiscrepancy {
  readonly reference: string;
  readonly reason: string;
}
```

It is optional on both `RunRecordInput` and normalized `RunRecord`.

The ledger module remains decoupled from filesystem and engine code. It validates and preserves
data supplied by the cast shell; it does not perform artifact existence checks itself.

Normalization requires both fields as non-empty strings, reconstructs their deterministic key
order, and drops unknown nested keys. Partial or malformed optional metadata is omitted without
losing the otherwise useful row.

Historical and ordinary rows do not synthesize the field. No schema-version bump was needed under
the repository's established optional-field evolution pattern.

## Acceptance proof

### Settlement-tail throw leaves an honest row

The new cast test uses no production hook and no model tokens.

It creates a real temporary Git repository, casts `boardPlanPlay` through the primary stub, writes
real story/ticket artifacts, and captures their real patch. Its configured complement factory then
removes the captured patch immediately before the production patch read.

Observed behavior asserted by the test:

- `castPlay` rejects with `ENOENT`;
- reviewer dispense never occurs;
- exactly one row exists;
- row outcome is `errored`;
- primary usage is input 7/output 3;
- cost is 0.001;
- original fixture gate evidence survives;
- no false reviewer verdict or skipped marker exists.

This is a non-reviewer settlement failure: the throw originates from the patch read, outside the
reviewer-specific dispense catch.

### Artifact/record consistency

The same test asserts:

- the final diff is absent;
- `capturedDiff` is absent from the row;
- the exact expected reference appears under `artifactDiscrepancy`;
- the stable reason appears;
- `reviveRecord` preserves the marker.

Existing successful capture coverage asserts the paired branch: final artifact exists and the row
contains its exact reference.

The diff publisher's rename ordering closes the partial-final-name failure window during capture.

## Verification

### Red characterization

Before production changes, the targeted run produced:

```text
1 pass
2 fail
```

The full-cast failure reproduced the missing-ledger defect: reading `runs.jsonl` failed with
`ENOENT` after the settlement patch read rejected.

### Targeted post-implementation

```bash
bun test src/log/run-log.test.ts src/engine/cast.test.ts \
  --test-name-pattern "artifactDiscrepancy|non-reviewer settlement throw"
```

```text
3 pass
0 fail
21 expect() calls
```

### Complete focused suites

```bash
bun test src/log/run-log.test.ts src/engine/cast.test.ts
```

```text
141 pass
0 fail
459 expect() calls
```

### Static checks

```bash
bun run build
git diff --check -- <five ticket source/test paths>
```

Both passed.

### Mandatory gate

`bun run check` passed before the source commit and again at committed `HEAD` `018a590`.

```text
1740 pass
1 skip
0 fail
5432 expect() calls
116 test files
```

The sole skip is the pre-existing release acceptance integration requiring absent `dist/`
artifacts. It is unrelated to this ticket.

## Acceptance mapping

| Criterion | Result | Evidence |
|---|---|---|
| unit test throws from settlement tail | pass | real production patch read rejects `ENOENT` |
| run record still written | pass | exactly one JSONL row asserted after rejection |
| honest outcome | pass | row outcome `errored`, actual usage/cost and base gate retained |
| diff path writes artifact and row together | pass | existing successful real-Git capture test |
| unavailable diff records discrepancy | pass | no `capturedDiff`; exact structured marker round-trips |
| failed diff write cannot publish partial final name | pass | temporary sibling plus atomic rename ordering |
| full gate green | pass | two `bun run check` executions, including committed state |

## Honest boundary and open concerns

An unwritable ledger destination can still prevent the row from landing. A filesystem that refuses
the JSONL append cannot simultaneously be used to record that refusal. The ticket guards throws in
the settlement path before the append; it does not claim storage can never fail.

Artifact availability verification and JSONL append are separate filesystem operations. This
ticket prevents inconsistency produced by the cast's own ordering and detects an artifact already
missing at settlement. It does not claim protection from an unrelated external process deleting the
file after the final availability check.

Uncontracted `play.effect` throws retain prior behavior because the effect boundary cannot honestly
classify whether partial work landed. That boundary is outside the parent story's named
“effect landing to run-record write” tail.

`T-076-02-03` still owns the no-network, no-listener-on-11434 default-config characterization with
real reviewer resolution/fetch semantics and a mocked primary executor.

No critical issue remains within this ticket's acceptance boundary.

## Repository hygiene

- Commit `018a590` contains exactly the five ticket-owned source/test paths.
- Ticket-owned source paths are clean after commit.
- The ordinary Git index is empty.
- No ordinary `git add` or `git commit` was used.
- Lisa-owned ticket, provenance, and published-work changes remain outside the source commit.
- Ticket phase/status was not edited by this worker.
- All six private RDSPI artifacts exist.

This ticket is ready for Lisa Review publication and completion handling. The worker remains on
`T-076-02-02` and stops here rather than starting `T-076-02-03`.
