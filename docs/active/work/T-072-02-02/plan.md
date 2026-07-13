# Plan — T-072-02-02

## Step 1 — establish the integration fixture

Modify `SAMPLE_STREAM` in `src/engine/cast.test.ts` so its assistant message has a stable nested id.
This makes it a valid single-turn input for the dependency accumulator while preserving all fields
used by existing executor-seam tests.

Verification:

- existing stub-driven cast tests still compile;
- sample transcript JSON remains ordinary stream JSON;
- expected weighted spend is `7` because the assistant event carries seven input tokens.

## Step 2 — expose a deterministic live clock

Add optional `now?: () => number` to `CastOptions` in `src/engine/cast.ts`.

Implementation details:

- document that it controls only live elapsed progress;
- default it to `Date.now`;
- sample a start value immediately before stream callback construction;
- clamp negative elapsed time to zero.

Verification:

- TypeScript accepts all existing callers unchanged;
- the new integration test can supply deterministic samples;
- run-log timestamp behavior remains untouched.

## Step 3 — wire accumulator and formatter into `onMessage`

Import `accumulateCastProgress`, `EMPTY_CAST_PROGRESS`, and `formatCastProgress`.

Move effective max-turn resolution before stream setup. Build local progress state and an
executor-facing callback that:

1. folds the original message;
2. formats elapsed, budget token envelope, and effective turn count;
3. writes `\r\x1b[2K` plus the complete line;
4. forwards the same message to `makeStreamSink`.

Configure `makeStreamSink`'s legacy human writer as a no-op so no bare event rows remain.

Verification:

- captured output contains progress renderings;
- captured output does not contain `· system`, `· assistant`, or `· result`;
- capped and uncapped formatting remains delegated to the pure formatter.

## Step 4 — finish the line and transcript deterministically

Replace independent fire-and-forget transcript appends with an ordered local promise chain. Await the
chain in a `finally` around dispense, then append one newline if a progress row was written.

Verification:

- the transcript can be read immediately after `await castPlay`;
- all rows occur in stream order;
- timeout streams also terminate their live row;
- genuine executor errors continue to propagate after cleanup;
- no-message failures do not emit a blank progress line.

## Step 5 — add the acceptance test

Add a dedicated test to `src/engine/cast.test.ts` using:

- `tmp()`;
- `stubExecutor`;
- `captureStdout`;
- explicit `runId`;
- deterministic `now` samples.

Assertions:

- cast outcome is success;
- progress output includes the expected elapsed values;
- weighted spend changes from zero to seven on the assistant turn;
- envelope is the funded `1m` token budget;
- turn advances from zero to one;
- old event labels are absent;
- the refresh region ends with exactly one newline;
- the JSONL file contains exactly three rows;
- each row byte-equals `JSON.stringify` of the original fixture item;
- parsing those rows deep-equals the original fixture array.

## Step 6 — run focused verification

Run:

```bash
bun test src/engine/cast.test.ts src/engine/cast-core.test.ts
```

This checks both the new impure-shell integration and the dependency's pure contract.

If focused tests expose unrelated worktree failures, distinguish them from ticket-owned failures and
record the evidence honestly. Fix only ticket-owned regressions.

## Step 7 — run the repository gate

Run:

```bash
bun run check
```

The gate includes BAML code generation, typechecking, and the full test suite. Do not bypass hooks or
weaken tests.

## Step 8 — record implementation progress

Write `progress.md` with:

- completed steps;
- exact tests and results;
- deviations from this plan;
- ticket-owned files ready to commit;
- unrelated dirty-worktree files explicitly excluded.

## Step 9 — commit the meaningful source unit

Use only:

```bash
lisa commit-ticket \
  --ticket-id T-072-02-02 \
  --message "feat(engine): wire live cast progress line" \
  --include src/engine/cast.ts \
  --include src/engine/cast.test.ts
```

Do not use `git add`, ordinary `git commit`, or broad path inclusion.

After the command, verify:

- the commit exists;
- ticket-owned source is neither modified, staged, nor untracked;
- Lisa/other-ticket worktree changes remain intact and excluded.

## Step 10 — review

Write `review.md` in the attempt-private directory.

Review content:

- files changed;
- behavior delivered;
- test coverage and exact gate result;
- transcript preservation evidence;
- known limitations from the story boundary;
- open concerns requiring human attention, if any;
- commit identifier.

Then stop on this ticket. Do not edit ticket phase/status and do not begin another ticket.

## Atomicity rationale

The production wiring and its stub-executor acceptance proof are one meaningful source unit. Splitting
them would temporarily commit either unverified behavior or a failing test. The private phase
artifacts are not included because Lisa separately verifies and publishes them.
