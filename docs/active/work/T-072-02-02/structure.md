# Structure — T-072-02-02

## File ownership

### Modify `src/engine/cast.ts`

Purpose: wire the already-settled pure progress model into the real cast stream and terminal.

Import additions from `./cast-core.ts`:

- `accumulateCastProgress`;
- `EMPTY_CAST_PROGRESS`;
- `formatCastProgress`.

`CastOptions` addition:

- `readonly now?: () => number`;
- documented as a live-progress clock seam;
- omitted in production callers, defaulting to `Date.now`;
- deliberately not used to rewrite durable run timestamps.

`castPlay` stream setup changes:

- resolve the effective max-turn cap before constructing the callback;
- capture `now` and `progressStartedAt`;
- initialize local immutable progress state;
- initialize a `progressLineWritten` flag;
- initialize an ordered transcript-write promise chain;
- create the existing `makeStreamSink` for raw serialization, with its live writer suppressed;
- create the executor-facing `onMessage` wrapper;
- fold each message before rendering;
- write `\r\x1b[2K` plus the full humane progress string;
- forward the unchanged message to the serializer;
- append each serialized JSON line through the ordered promise chain.

`castPlay` dispense changes:

- keep the existing timeout classification behavior;
- add a `finally` block;
- await all transcript writes in that block;
- write one newline if a live progress row was emitted.

Unchanged in this file:

- missing-capability early return;
- prompt rendering;
- executor selection;
- timeout budget calculation;
- authoritative final usage metering;
- parsing, gates, effect, and outcome classification;
- post-run summary lines;
- run-log schema and append;
- `RunSummary`.

### Modify `src/engine/cast.test.ts`

Purpose: prove the ticket acceptance criterion through the existing stub executor.

Fixture adjustment:

- add a nested `message.id` to the sample assistant record;
- preserve its existing role, model, and usage fields;
- existing tests continue to use the same three-message sample.

New integration test:

- create an isolated temp root and explicit run id;
- inject deterministic clock samples;
- invoke `castPlay` through `captureStdout` and `stubExecutor`;
- assert success to establish the whole pipeline completed;
- inspect the raw captured stdout;
- verify refresh control and expected elapsed/spend/envelope/turn content;
- verify old bare event labels are absent;
- isolate output before the existing `effect` line and assert only one newline there;
- read the transcript immediately after the cast resolves;
- compare JSONL lines exactly to `SAMPLE_STREAM.map(JSON.stringify)`;
- parse the lines and compare the reconstructed messages deeply to `SAMPLE_STREAM`.

### Create private RDSPI artifacts

- `.lisa/attempts/T-072-02-02/1/work/research.md`
- `.lisa/attempts/T-072-02-02/1/work/design.md`
- `.lisa/attempts/T-072-02-02/1/work/structure.md`
- `.lisa/attempts/T-072-02-02/1/work/plan.md`
- `.lisa/attempts/T-072-02-02/1/work/progress.md`
- `.lisa/attempts/T-072-02-02/1/work/review.md`

These are assignment-owned but not source-commit includes. Lisa publishes admitted artifacts later.

## Files explicitly not modified

### `src/engine/cast-core.ts`

The dependency already supplies all required progress judgment. Its stream sink API is sufficient
when composed behind an executor-facing wrapper. Avoiding changes preserves dependency ownership and
keeps this ticket focused on the impure wiring.

### `src/engine/cast-core.test.ts`

The fixture tests already pin weighted per-turn accumulation, de-duplication, humane formatting,
malformed-message behavior, and stream serialization. This ticket adds the missing end-to-end shell
proof instead of duplicating those unit tests.

### Executor modules

No event or callback contract changes are needed. `onMessage` remains synchronous, ordered, and
executor-agnostic.

### Budget modules

The live path consumes the funded `budget.tokens`; weighting stays centralized in the pure core's
use of canonical `countTokens`.

### CLI and shelf modules

The cast line is below their dispatch boundary. No command option or menu behavior changes.

## Runtime data flow

```text
executor StreamMessage
        |
        v
cast.ts onMessage wrapper
        |-- accumulateCastProgress(previous, original message)
        |-- formatCastProgress(progress, elapsed/envelope/effective cap)
        |-- stdout.write(CR + erase + full line)
        `-- makeStreamSink(original message)
                |-- suppressed legacy human formatter output
                `-- JSON.stringify(original message)
                        `-- ordered appendFile(<runId>.jsonl)
```

At dispense settlement:

```text
await transcript write chain
        |
        `-- if any refresh occurred, stdout.write(newline)
                `-- existing parse/gate/effect/log/post-run output
```

## Public interface impact

Only one optional field is added:

```ts
interface CastOptions {
  readonly now?: () => number;
}
```

No return type, persisted schema, executor interface, play interface, or budget type changes.

## Invariants

- The accumulator never mutates the external message.
- The exact message passed by the executor is passed to `makeStreamSink`.
- JSON serialization occurs once per event through the existing serializer.
- Transcript append order equals executor callback order.
- `castPlay` does not resolve until transcript appends settle.
- One stream event causes one progress refresh and one transcript row.
- Stream events cause zero progress newlines.
- Stream completion causes at most one progress newline.
- No stream messages means no synthetic progress row or newline.
- Result usage remains excluded from incremental progress but included in authoritative settlement.

## Commit unit

The source and integration test form one meaningful ticket-owned unit because neither alone meets the
acceptance criterion. Commit exactly:

- `src/engine/cast.ts`
- `src/engine/cast.test.ts`

Use `lisa commit-ticket --ticket-id T-072-02-02` with repeated exact `--include` arguments.
