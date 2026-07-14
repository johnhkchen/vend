# Design — T-072-02-02

## Decision drivers

The design must satisfy five properties together:

1. The live surface is one refreshing row, not one newline per executor event.
2. The row is derived from the dependency ticket's pure accumulator and formatter.
3. Every original stream message still reaches the transcript serializer unchanged and in order.
4. Elapsed-time behavior is deterministic in the stub-executor test.
5. Existing post-run output and executor behavior remain outside the change.

## Option A — replace `makeStreamSink` in `cast.ts`

Build a new `onMessage` closure directly in `cast.ts` that folds progress, prints the line, and calls
`JSON.stringify` plus `appendFile` itself.

Advantages:

- Direct access to the raw message for accumulation.
- Minimal callback indirection.
- Straightforward terminal refresh control.

Disadvantages:

- Duplicates the established two-surface serialization seam.
- Makes `makeStreamSink` unused by the production cast path.
- Risks transcript formatting drift from its pure unit test.
- Contradicts the ticket's wording to drive the accumulator from the existing sink path.

Decision: rejected.

## Option B — extend `makeStreamSink` with progress policy

Change the pure sink API so it owns accumulator state, elapsed time, envelope, cap, and progress
formatting.

Advantages:

- One callback owns both surfaces.
- Could be unit-tested in the core.

Disadvantages:

- Pulls stateful clock policy and cast-specific presentation into a previously generic serializer.
- Either makes the pure sink impure or requires a broad new options contract.
- Reopens the dependency ticket's settled module unnecessarily.
- Blurs the pure-core/impure-shell boundary: the core should calculate a line, while the shell owns
  when and how terminal bytes are written.

Decision: rejected.

## Option C — compose a progress wrapper around `makeStreamSink`

Keep `makeStreamSink` as the transcript serialization boundary. In `cast.ts`, construct it with a
no-op live writer and the real raw sink, then wrap it in the actual executor `onMessage` callback:

1. fold the message into progress;
2. sample elapsed time;
3. write a carriage-return/erase-line/full-render refresh;
4. hand the same message object to `makeStreamSink` for serialization and persistence.

Advantages:

- Uses the pure accumulator and formatter exactly as designed.
- Preserves `makeStreamSink` as the single source for raw JSON serialization.
- Does not change the already-landed dependency files.
- Keeps terminal controls in the impure shell.
- The same original object flows to the transcript path without mutation.
- Easy to prove through the existing stub harness.

Disadvantages:

- `makeStreamSink` still computes `formatMessage` before calling the no-op writer.
- The no-op writer is slightly indirect.

The extra pure string formatting is negligible compared with executor work and is preferable to an
API expansion whose only purpose would be suppressing it.

Decision: chosen.

## Refresh protocol

Each stream message writes:

`\r\x1b[2K` + `formatCastProgress(...)`

There is no newline per message. The complete line is rewritten on every event, so a terminal shows
one row whose content converges as assistant turns arrive. Erasing before rewriting prevents stale
characters if a display value becomes shorter.

After `executor.dispense` settles, one newline is emitted if and only if at least one progress refresh
was written. The newline belongs in `finally`, ensuring timeout streams are terminated before the
andon output. A genuine executor failure also leaves the terminal cursor in a clean state before the
error propagates.

## Progress state

`cast.ts` initializes a local variable from `EMPTY_CAST_PROGRESS`. Every message reassigns it with
`accumulateCastProgress`; the pure function remains immutable. Formatting receives:

- `elapsedMs = max(0, now() - progressStartedAt)`;
- `tokenEnvelope = budget.tokens`;
- `maxTurns = resolveMaxTurns(opts.maxTurns, play.maxTurns)`.

The effective turn cap must be resolved before building the callback, moving that existing resolution
slightly earlier without changing its precedence.

The progress start timestamp is sampled immediately before the execution stream is wired. It measures
the live dispense interval rather than preflight registry and render work, matching what the line can
actually observe.

## Clock injection

Add optional `CastOptions.now?: () => number`.

- Production default: `Date.now`.
- Test: a deterministic monotonic fixture.
- Scope: live progress elapsed time only.
- Existing `startedAt` and `endedAt` ISO ledger stamps remain unchanged to avoid broadening the
  ticket into run-log clock refactoring.

The option is public because `castPlay` is the public impure boundary and the integration harness
needs deterministic control without global clock mocking.

## Transcript durability

The current sink starts fire-and-forget appends. That makes it possible for `castPlay` to resolve
before the acceptance test can safely read all transcript bytes, and makes the phrase "still record
every raw message" harder to establish at the function boundary.

Use a local promise chain:

- initialize `transcriptWrites = Promise.resolve()`;
- for each serialized raw line, extend the chain with `appendFile`;
- await the chain in the same `finally` that terminates the progress row.

This preserves executor callback synchronicity and message order while guaranteeing that an awaited
cast has completed its transcript writes. It also propagates transcript I/O failure instead of
silently losing durable evidence.

## Integration test design

Add a dedicated acceptance test in `src/engine/cast.test.ts`.

- Give the sample assistant message a stable nested id so it represents one countable turn.
- Inject the existing stub executor.
- Inject clock samples that yield known elapsed values for system, assistant, and result events.
- Capture stdout for the awaited cast.
- Assert the stream region contains refresh controls and progress renderings.
- Assert it contains no old `· system`, `· assistant`, or `· result` event rows.
- Assert exactly one newline terminates the refreshing region before normal post-run lines.
- Read `<transcriptDir>/<runId>.jsonl` immediately after return.
- Assert each raw line exactly equals `JSON.stringify` of the corresponding input message.
- Parse the lines and assert deep equality with the source fixture.

## Compatibility

- Existing callers omit `now` and behave normally.
- `makeStreamSink` retains its API and pure tests.
- Result metering, gates, effects, log records, and summaries are untouched.
- The transcript path and JSONL schema are unchanged.
- Unknown or usage-less events still trigger a visual elapsed refresh while leaving spend and turn
  state unchanged.
- No TUI or interactive approval mechanism is introduced.

## Risks and mitigations

- ANSI bytes appear in redirected output: this already is a terminal-oriented live surface, and the
  ticket explicitly requests a refreshing line. Tests pin exact control bytes.
- Clock values could move backward: clamp elapsed to zero at the shell boundary.
- Append errors could mask executor errors from `finally`: transcript durability is a first-class
  contract; surfacing an I/O failure is preferable to silently claiming persistence.
- Concurrent casts share stdout and can interleave: existing cast output already shares stdout;
  multi-cast display orchestration is outside this story.

## Chosen design

Compose the dependency's accumulator/formatter around the existing stream serializer, inject a
live-only clock through `CastOptions`, refresh with carriage-return plus erase-line, await ordered
transcript appends, and pin the complete behavior in the existing token-free stub-executor harness.
