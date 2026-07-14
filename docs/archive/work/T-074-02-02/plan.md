# Plan — T-074-02-02 wire counter-time underfunding warning

## Goal

Make every selected/named dispatch and the direct steer gesture evaluate severe token
underfunding against the play's recalibrated measured floor immediately before casting, emit the
settled warning when appropriate, and always continue with the caller's funded budget.

## Step 1 — add pure counter decision tests

Create `src/shelf/funding-counter.test.ts` with addon-free stubs.

Build helpers:

1. `makeStubPlay(name, budget, rarity)` returns a valid play contract.
2. `recordOf(play, tokens, duration, outcome)` returns a canonical run record.
3. `measuredRecords(play, floorTokens)` returns at least three successful samples whose selected
   percentile is the desired floor.

Add tests first for:

- no records returns no warning;
- two successes remain cold-start and return no warning;
- three measured 400k successes plus 12.5k funding returns the exact predecessor warning;
- measured 400k floor plus 400k funding returns no warning;
- measured records for a different play return no warning.

Verification:

```bash
bun test src/shelf/funding-counter.test.ts
```

Expected initial state: import/function missing until Step 2.

## Step 2 — implement pure provenance composition

Create `src/shelf/funding-counter.ts`.

Implement `fundingWarningFor`:

1. call `shelfRows([play], records)`;
2. take the sole row;
3. return `null` for default confidence;
4. call `underfundingWarning(funded, row.envelope)` for measured confidence.

Do not:

- call `recalibrate` directly;
- copy rarity mapping;
- modify funded or floor values;
- print from the pure function.

Verification:

```bash
bun test src/shelf/funding-counter.test.ts
```

## Step 3 — add wrapper ordering/proceed tests

Extend `funding-counter.test.ts` for `withFundingCounter`.

Use injected records and writer to capture events:

```text
warning:<exact text>
dispatch
```

Pin:

- field-report warning occurs before callback;
- callback still executes once;
- callback result is returned unchanged;
- callback observes the same funded budget supplied by the caller;
- cold start produces only `dispatch`;
- adequate measured funding produces only `dispatch`;
- silent paths write zero bytes, not a blank line.

Verification:

```bash
bun test src/shelf/funding-counter.test.ts
```

## Step 4 — implement the impure wrapper

In `funding-counter.ts`, implement `withFundingCounter`.

Production defaults:

1. root is `opts.projectRoot ?? process.cwd()`;
2. records come from `loadRunLog({ path: join(root, DEFAULT_RUN_LOG_PATH) })`;
3. output goes through `process.stdout.write`;
4. warning gains one trailing newline at the boundary;
5. callback is always awaited and returned.

Test overrides:

- `opts.records` bypasses disk;
- `opts.write` captures text.

Verification:

```bash
bun test src/shelf/funding-counter.test.ts src/shelf/underfunding-core.test.ts src/shelf/shelf-row.test.ts
```

## Step 5 — verify first source unit and commit

Run:

```bash
git diff --check -- src/shelf/funding-counter.ts src/shelf/funding-counter.test.ts
bun run check
```

Commit only the new counter unit:

```bash
lisa commit-ticket \
  --ticket T-074-02-02 \
  --message "feat(shelf): add shared funding counter" \
  --include src/shelf/funding-counter.ts \
  --include src/shelf/funding-counter.test.ts
```

Confirm both paths are clean afterward.

## Step 6 — wire named dispatch

Modify `src/play/dispatch.ts`.

1. import `withFundingCounter`;
2. preserve registry miss early return;
3. wrap the registry-hit `assembleAndCast` call;
4. pass `lookup.play`, `opts.budget`, and `opts.projectRoot`;
5. preserve the existing `{ kind: "ran", summary }` result.

Structural proof:

- no-play never reaches the counter;
- press reaches the counter through `runPlay`;
- named CLI run reaches the counter through `runPlay`;
- warning write precedes callback invocation.

## Step 7 — wire steer

Modify only the steer branch of `src/cli.ts`.

1. lazily import `withFundingCounter`;
2. retain budget selection;
3. retain the existing explicit funding echo;
4. replace direct `castSteer({ budget })` await with the wrapper;
5. keep summary rendering and exit status unchanged.

Do not move the funding echo into the wrapper. It is a separate, existing acknowledgement surface.

## Step 8 — focused wiring verification

Run:

```bash
bun test src/shelf/funding-counter.test.ts
bun test src/cli.test.ts src/shelf/press-core.test.ts
bun run build
```

Inspect the diff to confirm:

- `press.ts` did not gain duplicate output;
- `runPlay` wraps only successful lookup;
- steer uses the same wrapper;
- budgets are passed through unchanged;
- no other command branch changed.

## Step 9 — full gate and wiring commit

Run:

```bash
git diff --check -- src/play/dispatch.ts src/cli.ts
bun run check
```

Commit only wiring paths:

```bash
lisa commit-ticket \
  --ticket T-074-02-02 \
  --message "feat(cli): warn on measured underfunding before cast" \
  --include src/play/dispatch.ts \
  --include src/cli.ts
```

Confirm both paths are clean afterward.

## Step 10 — progress artifact

Write `progress.md` with:

- implementation steps completed;
- exact tests and results;
- exact commit ids and included paths;
- any deviations from this plan;
- worktree hygiene, including pre-existing unrelated changes.

## Step 11 — final verification

Run from committed state:

```bash
bun run check
git status --short
git log --oneline -6
```

Acceptance checklist:

- severe measured mismatch prints exact warning;
- warning precedes callback/dispatch;
- callback proceeds and result is preserved;
- cold start writes nothing;
- adequate measured funding writes nothing;
- press and named run share dispatch wiring;
- steer uses the same counter wrapper;
- no auto-funding or blocking was introduced;
- ticket-owned source is committed and clean.

## Step 12 — review artifact

Write `review.md` summarizing:

- files created and modified;
- public/internal interfaces;
- behavioral ordering;
- tests and full gate result;
- commit ids;
- acceptance verdict;
- limitations, especially that the real ~400k live field-report cast remains deferred as the story
  explicitly states.

Stop on this ticket after writing Review. Do not alter ticket frontmatter or start another ticket.
