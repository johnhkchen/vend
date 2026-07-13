# T-075-03-01 Plan — cold-start confidence count

## Constraints carried into implementation

- Work only in `src/shelf/shelf-row.ts` and `src/shelf/shelf-row.test.ts`.
- Do not edit the story, ticket phase/status, ledger math, menu, or Home files.
- Preserve unrelated working-tree changes exactly as found.
- Keep the shelf module pure: plain values in, fresh values/string out.
- Read threshold and window values from `src/ledger/recalibrate.ts`.
- Keep default envelopes and the `~` prefix unchanged.
- Use Lisa's ticket commit path with exact include files.
- Run the complete `bun run check` gate before committing.

## Step 1 — establish focused baseline

Run:

```sh
bun test src/shelf/shelf-row.test.ts
bun run check:typecheck
```

Verification:

- the current shelf-row tests pass before edits;
- the current tree typechecks despite unrelated work;
- any pre-existing failure is recorded before implementation.

This creates a local signal for distinguishing ticket regressions from ambient branch state.

## Step 2 — add ledger-derived count types

In `src/shelf/shelf-row.ts`:

1. import `COLD_START_MIN_SUCCESSES` and `DEFAULT_WINDOW` with `recalibrate`;
2. add private integer-enumeration helpers;
3. export `ColdStartRunCount` as positive integers below the threshold;
4. export `MeasuredRunCount` as integers from threshold through window;
5. update `ShelfConfidence` to the three structural states.

Immediate verification:

```sh
bun run check:typecheck
```

Expected intermediate result:

- direct measured fixtures with counts 5 continue to compile;
- the existing measured-one fixture will fail if the measured range begins at 3;
- production mapping will fail until narrowed from `number`.

These expected errors guide the next implementation step and are not a stopping condition.

## Step 3 — centralize source/count mapping

In `src/shelf/shelf-row.ts`:

1. import `RecalibrateResult` type-only;
2. add `isColdStartRunCount`;
3. add `isMeasuredRunCount`;
4. add a private `shelfConfidence(result)` mapper;
5. handle the three valid source/count cases;
6. reject impossible source/count combinations with a diagnostic invariant error;
7. replace the inline `shelfRows` conditional with the mapper.

Verification criteria:

- zero prior maps to count-free default;
- positive sub-threshold prior maps to runs-bearing default;
- measured source maps to measured range;
- no record filtering or budget calculation appears in the new helper;
- the helper remains pure apart from throwing on impossible input.

Run:

```sh
bun run check:typecheck
```

Any remaining type failure should now be confined to tests that construct invalid measured
counts under the refined contract.

## Step 4 — render the two default labels

In `confidenceLabel`:

1. preserve measured rendering;
2. use property presence inside the default arm;
3. render count-free default as `(default — no runs yet)`;
4. render thin default as `(default — N run[s], measured at 3)`;
5. interpolate the threshold constant rather than a numeric literal.

Update surrounding comments so they no longer claim every default has no run field.

Verification criteria:

- zero wording is byte-for-byte unchanged;
- one uses singular “run”;
- two uses plural “runs”;
- measured rows still omit `~`;
- all default rows still include `~`;
- measured label punctuation remains unchanged.

## Step 5 — update mapping tests

In `src/shelf/shelf-row.test.ts`:

1. retain the zero-record expectation as `{ kind: "default" }`;
2. add one successful record and expect `{ kind: "default", runs: 1 }`;
3. update the two-success expectation to `{ kind: "default", runs: 2 }`;
4. keep the authored-envelope assertions for all prior cases;
5. retain the five-success measured assertion.

Focused run:

```sh
bun test src/shelf/shelf-row.test.ts
```

Expected result after renderer tests are also adjusted: green.

## Step 6 — add compile-time union gates

Import `ShelfConfidence` as a type in the test module.

Add a test named around discriminated-union honesty that contains:

- valid zero-default construction;
- valid thin-default counts 1 and 2;
- valid measured count at the threshold;
- `@ts-expect-error` for measured count zero;
- `@ts-expect-error` for runs-bearing default count zero.

Use `expect` on the valid values so the test is also a runtime positive control.

Verification:

```sh
bun run check:typecheck
```

The typecheck must pass because both `@ts-expect-error` directives are consumed. If either
invalid construction becomes legal, the directive itself becomes an error and the gate fails.

## Step 7 — update renderer and seam tests

Adjust the renderer suite:

1. keep the zero-default direct fixture;
2. remove the direct measured-one fixture because one is below the actual threshold;
3. add direct thin-default label tests for one and two;
4. keep the measured-five test;
5. retain zero-default “never measured” assertion;
6. add a real `shelfRows` seam with one success;
7. add a real `shelfRows` seam with two successes;
8. retain the real zero-record seam.

Focused verification:

```sh
bun test src/shelf/shelf-row.test.ts
bun run check:typecheck
```

Acceptance mapping:

- 1-run label: focused render/seam assertion;
- 2-run label: focused render/seam assertion;
- 0-run label: existing direct and seam assertions;
- measured-zero unconstructable: compile-time assertion;
- measured path preserved: five-run production mapping and renderer assertions.

## Step 8 — inspect the ticket diff

Run:

```sh
git diff -- src/shelf/shelf-row.ts src/shelf/shelf-row.test.ts
git diff --check -- src/shelf/shelf-row.ts src/shelf/shelf-row.test.ts
```

Review for:

- no hard-coded threshold in production or test expectations where the source constant can be
  interpolated;
- no ledger math duplication;
- no mutation or I/O;
- no accidental formatting or unrelated test churn;
- comments match the implemented type states;
- no whitespace errors.

## Step 9 — run the full repository gate

Run:

```sh
bun run check
```

This must complete all three repository gate stages:

1. BAML code generation;
2. TypeScript no-emit build;
3. full Bun test suite.

If codegen changes generated files, inspect them before proceeding. Do not include unrelated
generated changes in the ticket commit unless the ticket itself legitimately owns them; this
ticket is not expected to change BAML output.

If the full gate fails:

- diagnose whether the failure is in a ticket-owned file;
- fix only in-scope regressions;
- record any genuine ambient failure in `progress.md` and `review.md`;
- do not soften acceptance or commit a red result.

## Step 10 — write implementation progress

Create `.lisa/attempts/T-075-03-01/1/work/progress.md` containing:

- completed source changes;
- tests added or adjusted;
- commands run and outcomes;
- deviations from this plan;
- remaining work before review;
- exact acceptance status.

The artifact remains private to the attempt.

## Step 11 — commit the meaningful source unit

Once focused and full checks are green, run exactly:

```sh
lisa commit-ticket \
  --ticket-id T-075-03-01 \
  --message "fix(shelf): show thin cold-start run counts (T-075-03-01)" \
  --include src/shelf/shelf-row.ts \
  --include src/shelf/shelf-row.test.ts
```

Do not use `git add`, `git add -A`, or `git commit`.

Post-commit verification:

```sh
git status --short
git show --stat --oneline --summary HEAD
git diff -- src/shelf/shelf-row.ts src/shelf/shelf-row.test.ts
```

Required result:

- the commit contains only the two ticket-owned files;
- neither ticket-owned file remains modified, staged, or untracked;
- unrelated pre-existing dirty files remain present and untouched.

## Step 12 — review and stop

Create `.lisa/attempts/T-075-03-01/1/work/review.md` after the commit.

The review will include:

- commit identity;
- exact modified files;
- behavior and type-contract summary;
- focused/full verification evidence;
- acceptance-criterion checklist;
- coverage assessment;
- open concerns and honest limitations;
- confirmation that out-of-slice files were not changed.

After `review.md` exists, remain on `T-075-03-01` and stop. Do not start another ticket or edit
ticket phase/status; Lisa owns publication, completion confirmation, and seat release.
