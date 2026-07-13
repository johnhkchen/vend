# Progress — T-076-02-01

## Status

Implementation is complete, committed, and green.

Source commit:

```text
65675b96860001a71acd50eeba36d1c6be44ff28
fix(engine): andon reviewer settlement failures (T-076-02-01)
```

The commit was created with `lisa commit-ticket` and exact include paths only.

## Completed work

### Research

- Read the parent story before the ticket contract.
- Read vision, charter, stack, and the complete RDSPI workflow.
- Mapped `castPlay` from primary dispense through effect, diff capture, review, settlement,
  run-record append, and summary construction.
- Identified the uncaught `dispenseReviewVerdict` await as the common boundary for transport,
  timeout, and malformed-response failures.
- Confirmed E-074's `missing-capability` outcome and amber andon as the required precedent.
- Confirmed valid E-073 pass/fail and inert T-076-01 behavior that must remain unchanged.

### Design

- Chose a narrow catch around reviewer dispense/parse only.
- Kept operational failure distinct from a valid review FAIL.
- Chose a pure outcome relabel that preserves landed-effect facts and original gate evidence.
- Kept cause/fix prose on stdout and reused the existing durable outcome, avoiding schema churn.
- Rejected retry, skipped-marker reuse, fabricated review verdicts, and broad settlement catches.

### Structure and plan

- Limited source ownership to four existing engine files.
- Defined a pure `settleCrossReviewFailure` helper.
- Defined one hermetic cast integration proof using the existing real diff-capture fixture.
- Planned a single meaningful source commit after the full repository gate.

### Test-first red

Added tests before production implementation and ran:

```bash
bun test src/engine/cast-core.test.ts src/engine/cast.test.ts
```

Observed the intended failures:

- `settleCrossReviewFailure` export was absent;
- the throwing reviewer rejection escaped `castPlay`;
- Bun printed the raw `ConnectionRefused` error stack from the failed test.

Result:

```text
18 pass
2 fail
1 error
154 assertions
```

This demonstrated that the new test exercised the shipped defect rather than passing vacuously.

### Pure core implementation

Added `settleCrossReviewFailure(base)` to `src/engine/cast-core.ts`.

The helper:

- returns `outcome: "missing-capability"`;
- preserves `materialize`;
- preserves original play-gate rows;
- preserves the optional over-envelope warning;
- does not mutate its input;
- does not invent a cross-vendor gate result.

Added a focused test with all preservation facts observable.

### Cast shell implementation

Added a `CrossReviewFailure` presentation value to `src/engine/cast.ts`.

Wrapped only the `dispenseReviewVerdict` call and valid-verdict mapping in `try/catch`.

On rejection, the shell now:

- trusts the already-resolved reviewer seat;
- maps `openai-compat` to plain `OpenAI-compatible endpoint` wording;
- collapses the error message to one line;
- never reads or prints `Error.stack`;
- supplies an endpoint/auth configuration hint and points to `vend doctor`;
- settles via the pure failure helper;
- continues through the ordinary append and summary path.

The returned summary honestly retains `materialized: true` and the captured diff because both
already existed before review failed.

The ledger retains primary usage/cost, captured diff, and original gate rows while recording
`outcome: "missing-capability"`.

No `crossVendorVerdict` or `crossReviewSkipped` value is fabricated.

### Integration proof

Added a configured two-seat registry whose OpenAI-compatible reviewer throws during dispense.

The test asserts:

- awaited `castPlay` resolves to a summary;
- reviewer dispense was called once;
- outcome is `missing-capability`;
- physical materialization and captured diff remain present;
- stdout names `codex` and `OpenAI-compatible endpoint`;
- stdout carries the connection-refused cause and concrete fix hint;
- stdout has neither the valid-review gate-failed line nor a stack;
- the captured patch exists and is non-empty;
- exactly one run-record line exists;
- usage, cost, captured diff, and original gate row survive;
- review verdict and skipped marker are absent.

## Verification evidence

### Focused green

```bash
bun test src/engine/cast-core.test.ts src/engine/cast.test.ts
```

```text
86 pass
0 fail
332 assertions
```

This includes the unchanged valid pass, valid fail, inert-resolution, diff-capture, timeout,
budget, progress, and primary-executor andon cases.

### Static checks

```bash
bun run build
git diff --check -- src/engine/cast-core.ts src/engine/cast-core.test.ts src/engine/cast.ts src/engine/cast.test.ts
```

Both passed.

### Full gate before commit

```bash
bun run check
```

```text
BAML generation: pass
TypeScript: pass
1737 pass
1 skip
0 fail
5411 assertions
```

The skip is the existing release-acceptance integration that requires absent `dist/` artifacts.

### Commit

Committed with:

```bash
lisa commit-ticket \
  --ticket-id T-076-02-01 \
  --message "fix(engine): andon reviewer settlement failures (T-076-02-01)" \
  --include src/engine/cast-core.ts \
  --include src/engine/cast-core.test.ts \
  --include src/engine/cast.ts \
  --include src/engine/cast.test.ts
```

### Post-commit gate

Ran `bun run check` again from commit `65675b9`.

```text
1737 pass
1 skip
0 fail
5411 assertions
```

## Deviations from plan

No material implementation deviation.

The endpoint-specific hint was encoded as presentation text in the generic cast shell rather than
adding a value import from the concrete OpenAI adapter. This avoids a new runtime dependency from
the executor-agnostic engine onto one provider implementation while retaining the exact actionable
environment-variable guidance.

Lisa published the completed phase artifacts into `docs/active/work/T-076-02-01/` and advanced the
ticket phase while this implementation continued. Those Lisa-owned files were not written or
included by this worker's source commit.

## Repository hygiene

- All four ticket-owned source paths are committed and clean.
- The ordinary Git index is empty.
- Remaining ticket/provenance/public-work changes are Lisa-owned phase machinery.
- No ticket phase or status field was edited by this worker.
- No source work remains.

## Remaining

- Write the Review artifact.
- Stop on this ticket and wait for Lisa's completion publication/seat release.
