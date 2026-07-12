# Plan — T-071-01-01

## Implementation sequence

### 1. Extend the input and durable record contracts

- Add optional `seatOfExecution?: string` to `RunRecordInput`.
- Add optional `seatOfExecution?: string` to `RunRecord`.
- Document raw preservation, absence semantics, and policy independence.
- Keep the field grouped with seat provenance metadata.

Verification:

- TypeScript accepts callers with and without the property.
- No import from the known-seat registry appears in the log module.

### 2. Add pure structural normalization

- Add `normalizeSeatOfExecution` next to the `seatDefaulted` normalizer.
- Accept only non-empty strings as structurally usable.
- Return accepted strings verbatim.
- Return `undefined` for absent or malformed values.
- Do not trim, lowercase, alias, default, or policy-check.

Verification:

- Source inspection shows the helper only performs structural checking.
- An intentionally unknown/raw string remains unchanged in unit tests.

### 3. Wire the pure write path

- Normalize `input.seatOfExecution` in `buildRunRecord`.
- Conditionally spread the property into the frozen record.
- Place it consistently after `seatDefaulted` and before timestamps.
- Preserve exact existing object construction when it is absent.

Verification:

- The `in` operator is false for an absent value.
- Exact serialization matches a pre-E-071 literal.
- A supplied value appears verbatim.

### 4. Wire the pure read path

- Normalize `r.seatOfExecution` in `reviveRecord`.
- Conditionally spread a structurally valid value into the rebuilt record.
- Omit historical absence and malformed optional values.
- Preserve all other useful record data.

Verification:

- `readRuns` returns a supplied raw seat unchanged.
- A historical line reads with the field omitted.
- A malformed optional value does not make the record skipped.

### 5. Add focused acceptance tests

- Add a `seatOfExecution` test group in `src/log/run-log.test.ts`.
- Use a raw value outside the current registry to prove no policy policing.
- Exercise the full `build → serialize → readRuns → revive` pure boundary.
- Assert marked reserialization is stable.
- Add a literal pre-E-071 line for exact byte comparison.
- Assert absent property omission before and after `readRuns`.
- Add malformed-read behavior consistent with optional metadata precedent.

Verification command:

```bash
bun test src/log/run-log.test.ts
```

Expected result:

- all run-log unit tests pass;
- no skipped/failing new test;
- no filesystem or live executor dependency.

### 6. Review the ticket-owned diff

- Inspect `git diff -- src/log/run-log.ts src/log/run-log.test.ts`.
- Confirm only the intended schema/test changes exist.
- Search for `seatOfExecution` to confirm both faces and tests are covered.
- Search imports to confirm `KNOWN_SEATS` is not coupled into run-log.
- Confirm unrelated working-tree changes are untouched.

Verification commands:

```bash
git diff -- src/log/run-log.ts src/log/run-log.test.ts
rg -n "seatOfExecution|KNOWN_SEATS" src/log/run-log.ts src/log/run-log.test.ts
git status --short
```

### 7. Run the repository gate

Run:

```bash
bun run check
```

Expected result:

- BAML code generation succeeds;
- TypeScript build succeeds;
- complete test suite succeeds.

If the gate fails:

- distinguish ticket regressions from unrelated concurrent failures;
- fix only ticket-owned regressions;
- record any genuine unresolved failure honestly in `progress.md` and `review.md`.

### 8. Commit the meaningful source unit through Lisa

Use only:

```bash
lisa commit-ticket \
  --ticket-id T-071-01-01 \
  --message "feat(log): record seat of execution (T-071-01-01)" \
  --include src/log/run-log.ts \
  --include src/log/run-log.test.ts
```

Do not use `git add`, ordinary `git commit`, or broad include paths. Confirm the
two ticket-owned files are no longer modified after the Lisa commit and unrelated
changes remain exactly as found.

### 9. Record implementation progress

Write `progress.md` in the private attempt directory with:

- completed steps;
- exact files changed;
- focused-test result;
- full-gate result;
- commit identifier/result;
- deviations, if any;
- remaining work (Review only after implementation completes).

### 10. Perform self-review

Review the committed diff and test evidence against every acceptance clause:

- written verbatim when supplied;
- omitted byte-identically when absent;
- survives `readRuns` round-trip;
- raw value is not policed against `KNOWN_SEATS`;
- full gate green;
- code/tests committed through Lisa.

Write `review.md` in the private attempt directory, surface any gaps honestly,
then stop on this ticket as the assignment requires.

## Atomicity rationale

The schema implementation and its direct test are one meaningful source unit.
Splitting them would create either an unverified production commit or a failing
test-only commit. The Lisa include list is exact and excludes all attempt/private
workflow files plus unrelated concurrent changes.

## Scope guard

If implementation reveals an opportunity to stamp the seat in `cast.ts`, do not
take it. That work is contractually assigned to dependent ticket `T-071-01-02`.
Likewise do not add a downstream heat reader or seat-selection behavior.
