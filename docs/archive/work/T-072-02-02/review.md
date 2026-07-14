# Review — T-072-02-02

## Outcome

Acceptance is met.

A cast through the real `castPlay` shell and injected stub executor now presents one terminal row
that is rewritten for every stream message. The row carries elapsed time, price-weighted incremental
spend against the funded token envelope, and the accumulated assistant turn count. The former bare
event-name rows are absent. The durable transcript retains every raw stream message, in order and
byte-equal to its `JSON.stringify` representation.

## Commit

- Commit: `91da20161d5cc6aa2b41a579307ccfd7d9966800`
- Subject: `feat(engine): wire live cast progress line`
- Created with `lisa commit-ticket`.
- Exact included paths:
  - `src/engine/cast.ts`
  - `src/engine/cast.test.ts`
- Ticket-owned paths are clean after commit.
- No ordinary `git add` or `git commit` was used.

## Files changed

### `src/engine/cast.ts`

Added the impure-shell wiring for the pure progress model landed by `T-072-02-01`.

Key changes:

- imports `EMPTY_CAST_PROGRESS`, `accumulateCastProgress`, and `formatCastProgress`;
- adds an optional millisecond `now` clock to `CastOptions`;
- resolves the effective turn cap before constructing the live stream callback;
- initializes one progress accumulator per cast;
- folds every executor `StreamMessage` into the accumulator;
- renders elapsed time, weighted spend/funded envelope, and turn/cap;
- refreshes with `\r\x1b[2K` and no per-event newline;
- terminates the live row once after dispense settles;
- retains `makeStreamSink` as the raw JSON serialization boundary;
- replaces fire-and-forget transcript appends with an ordered promise chain;
- awaits transcript completion before continuing after dispense.

No change was made to final result metering, token exhaustion classification, gates, effects,
settlement warnings, run-log schema, or `RunSummary`.

### `src/engine/cast.test.ts`

Extended the existing token-free stub-executor harness.

Key changes:

- the sample assistant message now carries a stable nested message id, making it an identifiable
  turn for the accumulator;
- a new acceptance test injects deterministic clock values;
- the test pins exact terminal refresh bytes across system, assistant, and result events;
- the test proves the turn and weighted-spend counters advance only on the assistant event;
- the test proves the live stream region contains exactly one newline;
- the test proves legacy bare system/assistant/result labels do not appear;
- the test reads the transcript immediately after the awaited cast;
- the test proves exact raw-line equality and parsed deep equality for every fixture event.

## Behavioral review

### Live surface

For the three-message fixture, the captured live bytes are logically:

```text
<refresh> elapsed 12s · 0/1000k · turn 0
<refresh> elapsed 34s · 7/1000k · turn 1
<refresh> elapsed 56s · 7/1000k · turn 1
<one final newline>
```

The first two apparent line breaks above are explanatory only: production emits carriage-return and
erase-line controls, so a terminal displays one physical row. Only the final newline is emitted.

The result event refreshes elapsed time but does not re-charge cumulative terminal usage, preserving
the dependency core's deliberate approximation model. Authoritative result usage still drives final
budget settlement.

### Transcript surface

The original message object is passed unchanged to `makeStreamSink`. That existing sink remains the
only place that serializes stream records. Each serialized line is appended through one promise
chain, so callback order is preserved and `castPlay` does not resolve with transcript writes still in
flight.

This is slightly stronger than the previous behavior, which launched appends without awaiting them.
It directly supports the story's assertion that the raw transcript is the durable source of truth.

### Timeout and failure cleanup

The transcript wait and final progress newline are in `finally` around executor dispense. Therefore:

- successful streams finish their transcript and line;
- timeout streams that emitted messages also finish their transcript and line before the andon;
- a timeout with no messages emits no synthetic blank progress row;
- genuine executor failures still propagate after stream cleanup.

## Test coverage

### Focused

```bash
bun test src/engine/cast.test.ts src/engine/cast-core.test.ts
```

- 71 passed
- 0 failed
- 222 expectations

This covers the new shell wiring plus the dependency's pure accounting, de-duplication, formatting,
malformed-event, and serializer behavior.

### Repository gate

```bash
bun run check
```

Final settled result:

- BAML client generation passed;
- TypeScript typecheck passed;
- 1,655 tests passed;
- 1 intentional skip because local `dist/` release artifacts were absent;
- 0 failures;
- 5,071 expectations across 111 test files.

An earlier gate attempt had one unrelated snapshot failure because Lisa changed
`docs/active/tickets/T-072-01-02.md` while the read-only presentation test was running. The failure
named that exact external file. A settled rerun passed without any ticket code change.

### Diff hygiene

`git diff --check` passed for both ticket-owned source paths. Post-commit verification confirms both
paths are clean and the commit contains only those paths.

## Acceptance checklist

- [x] Cast exercised through `cast.ts` with the stub executor harness.
- [x] One refreshing stdout row replaces N newline-delimited bare event rows.
- [x] Row carries elapsed time.
- [x] Row carries cost-weighted spend versus funded envelope.
- [x] Row carries turn count.
- [x] Old bare stream event labels are absent.
- [x] `.vend/transcripts/<runId>.jsonl` behavior is represented by the configurable transcript dir
  and explicit run id in the harness.
- [x] Every raw message is present in order.
- [x] Every transcript row is byte-equal to serialization of the original message.
- [x] Full repository gate is green.
- [x] Source and tests are committed transactionally.

## Open concerns and honest boundary

- No real metered Claude cast was run. The parent story explicitly reserves that confirmation for
  the next counter-authorized cast; this ticket's proof is fixture-based and spends no tokens.
- The row refreshes when executor messages arrive. It does not run an independent timer between
  messages, matching the ticket's requirement to drive it from `onMessage`.
- ANSI erase-line control is appropriate for the terminal live surface. Redirected stdout will
  contain those control bytes; non-terminal output policy is outside this story.
- Concurrent casts can still interleave shared stdout. Multi-run display coordination or a TUI is
  explicitly outside the slice.
- Mid-cast spend remains approximate because it is the sum of streamed per-turn usage; final result
  usage remains authoritative, as documented by the story.

No critical issue requires human attention for this ticket.

## Final assessment

The implementation stays within the story boundary and preserves the pure-core/impure-shell split.
It replaces event noise with a compact autonomous-feedback row, keeps the funded envelope honest,
and strengthens transcript durability without changing executor events or post-run semantics. The
acceptance criterion is fixture-proven, the complete repository gate is green, and the ticket-owned
source is committed.
