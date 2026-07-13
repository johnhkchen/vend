# Plan — T-077-01-01

## Step 1 — Add production-policy imports to the impure-shell suite

Modify `src/engine/cast.test.ts` to value-import:

- `buildArgs` from `../executor/claude.ts`;
- `DECOMPOSE_MAX_TURNS` from `../play/decompose-epic-core.ts`.

Keep executor interfaces imported from the executor-neutral module. Do not import the concrete
decompose play or BAML runtime.

Verification:

- TypeScript resolves both imports.
- Existing test file remains loadable without invoking a live executor.

## Step 2 — Build the cap-hit fixture inside one integration test

Near the existing live-progress/transcript test, define test-local values:

- temporary root;
- stable run ID and run-log path;
- effect observation list;
- captured argv array;
- fifteen unique assistant messages based on `DECOMPOSE_MAX_TURNS`;
- one duplicate assistant message;
- one terminal `error_max_turns` result with `num_turns: 23`.

Construct a BAML-free play named `decompose-epic` with:

- `maxTurns: DECOMPOSE_MAX_TURNS`;
- trivial render and parse;
- clearing fixture gate;
- no-file successful effect.

Construct an injected Claude-identified executor whose `dispense`:

- computes `argv = buildArgs(opts)`;
- calls `opts.onMessage` for the entire fixture stream;
- returns the terminal result.

Verification:

- No network, subprocess, or environment call exists in the fixture.
- The terminal result object is both streamed and returned.

## Step 3 — Assert authored default reaches production argv

After casting, assert:

- the configured constant is 15 through the expected argv value;
- the exact argv is the base Claude print-mode array plus `--max-turns`, `15`.

Expected array:

```ts
[
  "-p",
  "--output-format",
  "stream-json",
  "--verbose",
  "--max-turns",
  "15",
]
```

Verification:

- Assertion is over production `buildArgs`, called with actual `castPlay` executor options.
- No test-local argv reimplementation exists.

## Step 4 — Assert accumulator and external count remain separate

Use captured stdout to assert the real settlement line contains:

`· agent turns: 15 / 15 cap; executor conversation events: 23`

Also assert it does not contain:

`23 / 15 cap`

Parse transcript rows and assert:

- assistant event count includes the duplicate;
- unique nested assistant IDs equal 15;
- the accumulator-derived settlement count therefore reflects unique IDs, not raw events.

Verification:

- These assertions run through the impure shell, not direct core calls.

## Step 5 — Assert cap-hit persistence and current settlement

Assert the last transcript row is the terminal result with:

- `type: "result"`;
- `subtype: "error_max_turns"`;
- `num_turns: 23`.

Read the run log and assert:

- one record exists;
- `play` is `decompose-epic`;
- `turnsUsed` is 23;
- outcome matches the returned summary and current cleared behavior.

Assert the effect observation proves current `castPlay` behavior consumed the returned result text
after the cap-hit subtype. Do not add or expect a new outcome/property.

Verification:

- Transcript demonstrates cap-hit recording.
- Ledger demonstrates the separate executor count.
- Summary/effect assertions document current behavior honestly.

## Step 6 — Run focused verification

Run:

```sh
bun test src/engine/cast.test.ts
```

If it fails:

- distinguish fixture errors from production behavior;
- adjust only the test unless evidence contradicts the ticket premise;
- if current behavior cannot satisfy acceptance without production changes, stop and block rather
  than expanding scope silently.

Then run:

```sh
bun run build
```

Verification:

- Focused test file passes.
- Typecheck is green.

## Step 7 — Run the authoritative gate

Run:

```sh
bun run check
```

This performs BAML generation, typecheck, and the full test suite.

Verification:

- Exit status is zero.
- Record exact pass/skip/fail counts in `progress.md` and `review.md`.
- Inspect `git status --short` afterward because BAML code generation can reveal drift.

## Step 8 — Commit the source unit through Lisa

Use only:

```sh
lisa commit-ticket \
  --ticket-id T-077-01-01 \
  --message "test(engine): characterize decompose max-turns seam" \
  --include src/engine/cast.test.ts
```

Do not use ordinary staging or commits.

Verification:

- Capture the returned commit identifier.
- `git status --short` shows no modified/untracked `src/engine/cast.test.ts`.
- Lisa-owned ticket metadata may remain modified and must not be touched.

## Step 9 — Write progress artifact

Create private `progress.md` documenting:

- implemented assertions;
- focused test result;
- build result;
- full gate result;
- exact Lisa commit command/include boundary;
- commit identifier;
- deviations from plan;
- remaining Review work.

Do not write to `docs/active/work/T-077-01-01/`.

## Step 10 — Review and disposition

Create private `review.md` containing:

- factual current seam behavior;
- test-only source summary;
- coverage and verification results;
- acceptance assessment;
- honest limitation that the actual subprocess remains unmetered/uninvoked;
- open concerns, especially that cap hit is transcript-only and currently not a distinct outcome.

Create `review-disposition.json` with exactly:

```json
{"disposition":"pass","reason":null}
```

only if all acceptance and verification conditions are met. Otherwise write the required block
shape with a non-empty actionable reason.

## Atomicity

The source implementation is one meaningful unit because all assertions form one requested
characterization. Splitting imports, fixture, or assertions into separate commits would leave
non-meaningful or failing intermediate states. One exact-path Lisa commit is therefore the correct
atomic boundary.

## Stop condition

After `review.md` and `review-disposition.json` are written, remain on T-077-01-01 and stop. Do not
start another ticket or perform Lisa-owned completion transitions.
