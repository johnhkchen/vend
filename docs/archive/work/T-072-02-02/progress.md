# Progress — T-072-02-02

## Status

Implementation is complete and verified. The ticket-owned source unit is ready for transactional
commit through Lisa.

## Completed work

### 1. Deterministic clock seam

- Added `CastOptions.now?: () => number` in `src/engine/cast.ts`.
- Production behavior defaults to `Date.now`.
- The seam is limited to live elapsed progress.
- Existing durable ISO timestamps remain on their established clock path.

### 2. Effective envelope and turn-cap wiring

- Moved `resolveMaxTurns(opts.maxTurns, play.maxTurns)` before stream callback construction.
- The same resolved cap is now passed both to the executor and to the live formatter.
- The funded `budget.tokens` value is passed as the progress token envelope.
- No budget calculation or settlement logic changed.

### 3. Live progress composition

- Imported the dependency ticket's:
  - `accumulateCastProgress`;
  - `EMPTY_CAST_PROGRESS`;
  - `formatCastProgress`.
- Initialized local immutable progress state per cast.
- Wrapped the existing `makeStreamSink` path with an executor-facing `onMessage` callback.
- Each stream message now:
  1. folds into progress;
  2. samples elapsed time;
  3. formats the humane line;
  4. writes carriage-return + erase-line + full current content;
  5. forwards the original message unchanged to the existing serializer.
- Suppressed the legacy `formatMessage` live output edge, removing bare per-event lines.
- Added a single terminating newline after stream settlement when at least one refresh occurred.
- The newline cleanup runs on successful and timeout dispense paths.

### 4. Transcript completion

- Replaced fire-and-forget independent appends with a per-cast ordered promise chain.
- The synchronous executor callback contract remains unchanged.
- JSON serialization still belongs to `makeStreamSink`.
- Every serialized line is appended in callback order.
- `castPlay` now awaits the transcript chain before continuing, making the durable transcript
  complete when the returned promise resolves.

### 5. Stub-executor acceptance proof

- Added a stable nested id to the sample assistant message so it represents one identifiable turn.
- Added a dedicated `castPlay` integration test in `src/engine/cast.test.ts`.
- The test injects four clock samples: one start plus one per stream event.
- It asserts exact refresh bytes for:
  - `elapsed 12s · 0/1000k · turn 0`;
  - `elapsed 34s · 7/1000k · turn 1`;
  - `elapsed 56s · 7/1000k · turn 1`.
- It asserts the live region has exactly one newline.
- It asserts the old `· system`, `· assistant`, and `· result` rows are absent.
- It reads the JSONL transcript immediately after `await castPlay`.
- It asserts every line exactly equals `JSON.stringify` of its source fixture message.
- It parses the rows and asserts deep equality with the complete original fixture array.

## Verification

### Focused tests

Command:

```bash
bun test src/engine/cast.test.ts src/engine/cast-core.test.ts
```

Result:

- 71 passed;
- 0 failed;
- 222 expectations;
- no live executor and no token spend.

### Diff hygiene

Command:

```bash
git diff --check -- src/engine/cast.ts src/engine/cast.test.ts
```

Result: clean.

### Full repository gate — first attempt

Command:

```bash
bun run check
```

Result:

- BAML generation passed;
- TypeScript typecheck passed;
- 1,654 tests passed;
- 1 intentional test skipped;
- 1 test failed because `docs/active/tickets/T-072-01-02.md` changed between the read-only test's
  before/after snapshots.

The changed file is owned by another Lisa ticket and was visibly transitioning in the shared
worktree. The failure named only that external board mutation; ticket-focused tests remained green.

### Full repository gate — settled rerun

Command:

```bash
bun run check
```

Result:

- BAML generation passed;
- TypeScript typecheck passed;
- 1,655 tests passed;
- 1 intentional test skipped (`dist/` acceptance artifact absent);
- 0 failed;
- 5,071 expectations;
- 111 test files.

This is the authoritative final gate result.

## Deviations from plan

No implementation deviation from the chosen design.

The only execution variance was rerunning the repository gate after a concurrent, unrelated Lisa
ticket transition caused a snapshot-integrity test to observe a real external file change. The
settled rerun passed fully without code changes.

## Ticket-owned files

- `src/engine/cast.ts`
- `src/engine/cast.test.ts`

## Explicitly excluded shared-worktree changes

- `.lisa/provenance.jsonl`
- `docs/active/tickets/T-072-01-02.md`
- `docs/active/tickets/T-072-02-02.md`
- `docs/active/work/T-072-01-02/`
- `docs/active/work/T-072-02-02/`

These are Lisa/other-ticket state and are not source commit includes.

## Remaining step

Commit the two ticket-owned source paths with `lisa commit-ticket`, verify they are clean, then write
the Review artifact and stop on this ticket.
