# Review — T-076-02-01

## Outcome

PASS.

A provisioned reviewer that rejects during dispense or response parsing no longer rejects
`castPlay`.

The settlement now returns and records the existing `missing-capability` outcome, emits one
actionable amber andon, preserves the already-landed effect and captured diff, and never prints a
raw stack.

Valid reviewer pass/fail behavior and inert no-reviewer behavior remain unchanged.

Source commit:

```text
65675b96860001a71acd50eeba36d1c6be44ff28
fix(engine): andon reviewer settlement failures (T-076-02-01)
```

## Files changed

### `src/engine/cast-core.ts`

Added pure `settleCrossReviewFailure(base)`.

The helper relabels only the terminal outcome to `missing-capability`.

It deliberately preserves:

- `materialize`, because the effect already landed;
- play-gate evidence, because those gates already ran;
- `overEnvelope`, because primary budget evidence remains true.

It deliberately does not append a cross-vendor gate row. An unavailable/malformed reviewer did
not find a code defect and cannot honestly produce a review FAIL judgment.

### `src/engine/cast-core.test.ts`

Added a pure settlement test with materialization, named gate rows, and over-envelope state.

The test pins the exact one-field relabel and confirms the base verdict remains unchanged.

### `src/engine/cast.ts`

Added a private `CrossReviewFailure` presentation shape.

The existing resolved-reviewer branch now catches only failures from `dispenseReviewVerdict` and
the mapping of its valid return.

That boundary covers the ticket's three named operational classes:

- connection/fetch rejection from the reviewer executor;
- typed executor timeout;
- malformed reviewer response, which `dispenseReviewVerdict` converts to
  `CrossReviewResponseError`.

The caught value is reduced to safe one-line text. The code reads `Error.message`, never
`Error.stack`, and has a total fallback for arbitrary thrown values.

Endpoint presentation maps the stable reviewer executor ID to plain words:

- `openai-compat` → `OpenAI-compatible endpoint`;
- `claude` → `Claude Code executor`;
- future IDs → a generic named executor endpoint.

The OpenAI-compatible repair hint names both configuration variables, endpoint/auth checks, and
`vend doctor`:

```text
verify VEND_OPENAI_BASE_URL is reachable and VEND_OPENAI_API_KEY contains valid bearer auth when
required; run `vend doctor`
```

The live refusal line follows the established andon shape:

```text
· andon: missing-capability — reviewer seat 'codex' failed at OpenAI-compatible endpoint:
<cause> — <fix hint>
```

The actual output is one physical line; it is wrapped above only for readability.

After setting failure state, the function continues through the existing settlement, turn,
warning, record append, actuals, and summary code.

No bespoke early-return record was added, avoiding a second post-effect persistence path.

### `src/engine/cast.test.ts`

Added a throwing two-seat reviewer registry fixture.

Added an end-to-end cast test that uses:

- a successful primary Claude stub;
- the existing BAML-free file-writing fixture play;
- a real temporary Git repository and real diff capture;
- a configured OpenAI-compatible complement reviewer;
- a reviewer `dispense` that rejects with connection-refused text;
- captured stdout and the real JSONL append.

The test completes without tokens or network access.

## Acceptance assessment

### Throwing reviewer produces a named andon outcome

PASS.

The integration test awaits the whole cast to a returned summary. The reviewer rejection is
consumed rather than escaping as an unhandled/rejected cast promise.

The returned summary has:

```text
outcome: missing-capability
materialized: true
capturedDiff: .vend/artifacts/cross-review-unreachable.diff
```

`materialized: true` is intentional and honest: review occurs after the effect and patch capture.

Exactly one parsed ledger line exists and has `outcome: "missing-capability"`.

### Andon line printed; no stack

PASS.

Captured stdout contains `· andon: missing-capability` and the injected cause.

It contains neither:

- the valid-review `gate-failed` andon;
- `Error:`;
- a `\n    at ` stack-frame prefix.

External cause prose is collapsed to one line, so a multi-line error message cannot reopen a raw
stack-shaped surface.

### Reviewer seat, endpoint category, and fix hint

PASS.

The integration assertion pins all of:

- `reviewer seat 'codex'` from trusted local resolution;
- `OpenAI-compatible endpoint` in plain words;
- the connection-refused cause;
- `VEND_OPENAI_BASE_URL` in the fix;
- `run \`vend doctor\`` as the verification step.

The hint also names bearer authentication through `VEND_OPENAI_API_KEY` in production output.

### Successful review behavior unchanged

PASS.

The new operational failure value remains undefined for valid replies, so both valid arms continue
through the pre-existing `settleCrossReview` function.

No valid reply type, prompt, timeout calculation, gate name, verdict mapping, record field, or
summary field changed.

Pre-existing tests remain green for:

- passing review → success plus passed cross-vendor gate and attached verdict;
- refusing review → gate-failed plus failed cross-vendor gate and detail;
- no provisioned complement → success plus `crossReviewSkipped`;
- diff-irrelevant paths → no review disposition.

This is the E-073 compatibility oracle. The source diff confirms the valid mapping body is
byte-identical inside the new `try` arm.

### Full repository gate

PASS.

Both pre-commit and post-commit runs of `bun run check` produced:

```text
BAML generation: pass
TypeScript: pass
1737 pass
1 skip
0 fail
5411 assertions
```

The one skip is the existing acceptance integration requiring `dist/` build artifacts; it is not a
ticket waiver or regression.

## Durable-record assessment

The failure record preserves:

- captured diff reference;
- primary input/output usage (7/3 in the fixture);
- primary cost (`0.001` in the fixture);
- original passed fixture gate row;
- terminal timestamps and ordinary cast metadata through the shared append.

It omits:

- `crossVendorVerdict`, because there was no valid judgment;
- `crossReviewSkipped`, because a reviewer did resolve and was called;
- a fabricated failed cross-vendor gate row.

This distinguishes all three states cleanly: valid verdict, inert resolution, and operational
review failure.

## Purity and architecture assessment

The terminal outcome decision lives in the pure cast core and takes an existing plain `Verdict`.

The impure shell owns asynchronous catching, trusted routing facts, error normalization, stdout,
and persistence composition.

The implementation does not import a concrete executor adapter into the generic engine. Provider
category/hint selection is presentation over the stable executor ID already used for seat mapping.

The run log remains a passive sink with no new executor or cross-review dependency.

No retry, human approval, alternate reviewer routing, or endpoint mutation was added, preserving
the autonomous and executor-neutral design boundaries.

## Test coverage

### Test-first evidence

Before implementation, the new tests failed because:

- the pure helper was absent;
- the reviewer rejection escaped with its raw stack.

### Focused suite

```text
86 pass
0 fail
332 assertions
```

The focused suite covers pure settlement and the complete cast effect/diff/review/log path.

### Static checks

- `bun run build`: passed.
- `git diff --check` over all four ticket files: passed.

### Complete suite

The full repository suite passed twice around the isolated Lisa commit.

## Honest boundary and open concerns

This ticket catches reviewer dispense/parse failures only.

It does not yet guarantee a ledger line when unrelated settlement operations throw, such as patch
read or record assembly failures. `T-076-02-02` owns the general record-write-on-settlement-throw and
artifact/record consistency invariant.

It does not yet provide the field-shape no-listener-on-11434 characterization. `T-076-02-03` owns
that final composed proof.

The run-log schema records the countable `missing-capability` outcome but not the live cause/hint
text, matching the cited E-074 precedent. The actionable cause/hint is on the cast surface.

No live endpoint was exercised, by design. The failure path is hermetic and token-free; the later
characterization ticket owns real fetch semantics.

No critical issue remains within this ticket's acceptance boundary.

## Repository hygiene

- Commit `65675b9` contains exactly four ticket-owned source/test paths.
- All ticket-owned source paths are clean.
- The ordinary Git index is empty.
- Lisa-owned ticket, provenance, and published-work changes remain outside the source commit.
- All six private phase artifacts exist.
- The worker did not edit ticket phase/status.

The ticket is ready for Lisa's Review publication and completion confirmation. This worker must
remain on `T-076-02-01` and stop rather than starting the next story ticket.
