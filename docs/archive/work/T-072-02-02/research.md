# Research — T-072-02-02

## Assignment and contract

- Ticket: `T-072-02-02`, `wire-live-line-into-cast`.
- Parent story: `S-072-02`, `live-cast-progress-line`.
- Current phase in ticket frontmatter: `research`.
- The assignment requires all remaining RDSPI phases in one continuous pass.
- Phase artifacts belong only in this attempt-private directory.
- Lisa owns ticket frontmatter transitions and later publication.
- Ticket-owned source must be committed with `lisa commit-ticket` and exact include paths.
- The single ticket acceptance criterion is an integration-level claim:
  - a cast through `cast.ts`'s stub executor emits one refreshing progress line;
  - the line carries elapsed time, weighted spend versus funded envelope, and turn count;
  - bare per-event lines are replaced;
  - the per-run JSONL transcript still contains every raw stream message unchanged.

## Story boundary

- The story is limited to the live cast surface in `src/engine/cast-core.ts` and
  `src/engine/cast.ts`.
- It reads existing executor stream events and adds no executor event types.
- The live spend is explicitly approximate and per-turn.
- The terminal result usage remains authoritative for final settlement.
- The raw transcript remains the durable source of truth.
- A dashboard, TUI, detached notification, shell-timeout repair, and post-run summary changes
  are outside the slice.
- The line is feedback, not a human approval surface, consistent with P4 and N2.

## Dependency state

- `T-072-02-01` has landed as commit `af44a8e`.
- It added the pure progress model to `src/engine/cast-core.ts` and fixture tests to
  `src/engine/cast-core.test.ts`.
- `CastProgress` contains:
  - `weightedTokens`;
  - `turns`;
  - `seenMessageIds` for per-turn de-duplication.
- `EMPTY_CAST_PROGRESS` is the immutable initial state.
- `accumulateCastProgress(state, msg)` recognizes assistant messages with a nested message id
  and usage, counts their usage once, and ignores result cumulative usage.
- `formatCastProgress(state, opts)` renders:
  `elapsed <time> · <weighted>/<envelope> · turn <used>[/<cap>]`.
- Token weighting delegates to `budget.ts`'s canonical `countTokens` and `COST_WEIGHTS`.
- The pure fixture already proves a representative line:
  `elapsed 4m12s · 210k/500k · turn 7/15`.

## Existing impure cast shell

- `src/engine/cast.ts` exports `castPlay` and owns process, filesystem, executor, and clock effects.
- `CastOptions` carries subject, project paths, model, max turns, run id, executor selection, and
  other cast controls.
- `castPlay` currently stamps `startedAt` using `new Date().toISOString()`.
- Before dispense it resolves project tools, renders the play prompt, creates the transcript
  directory, builds `onMessage`, resolves max turns, and resolves the executor.
- It passes `onMessage` and the budget-derived timeout to `executor.dispense`.
- After dispense it meters authoritative result usage, parses, gates, effects, logs, and prints
  post-run outcome lines.
- The effective max-turn value is already computed before dispense and is available to the live
  formatter.
- The funded token envelope is the `budget.tokens` argument already in scope.

## Existing stream fan-out

- `makeStreamSink` is defined in the pure core.
- It accepts injected `write(line)` and `sink(raw)` edges.
- For every `StreamMessage`, it currently:
  1. formats a compact event label with `formatMessage` and calls `write`;
  2. serializes the original object once with `JSON.stringify` and calls `sink`.
- `cast.ts` wires `write` to `process.stdout.write(line + newline)`.
- `cast.ts` wires `sink` to a fire-and-forget `appendFile(transcriptPath, raw + newline)`.
- Therefore the current live output is one physical line per stream event.
- The transcript is one JSON object per line and retains the full external record.
- `makeStreamSink`'s unit test pins both fan-out branches and in-order serialization.

## Executor stream contract

- `StreamMessage` is an open external JSON record with a required string `type`.
- `DispenseOptions.onMessage` is synchronous and optional.
- Executors must call it once per stream message, in order, before any timeout throw.
- The Claude stream consumer calls `onMessage` before recording terminal state.
- The injected stub executor in `cast.test.ts` follows the same ordering.
- The terminal `ResultMessage` is both streamed and returned by the stub.
- The existing sample stream has system, assistant, and result messages.
- Its assistant fixture currently has usage but no nested `message.id`, so the new accumulator
  correctly treats it as unidentifiable and does not count it as a turn.

## Terminal behavior

- A single updating terminal line can be represented with carriage return plus erase-line control,
  followed by the complete latest line.
- `\r` returns to the beginning of the current line.
- ANSI `\x1b[2K` erases the full current line, preventing stale suffixes when a later rendering is
  shorter.
- The refresh should not append `\n` for each event.
- A final newline is needed after dispense so existing post-run lines begin below progress.
- That newline also needs to occur on the timeout path because streamed messages precede the throw.
- If no stream message arrives, no progress row exists to terminate.

## Clock seam

- The pure formatter takes explicit `elapsedMs`; it never reads a clock.
- `cast.ts` is therefore the correct owner of clock access.
- A deterministic integration test needs an injected clock because synchronous stub messages would
  otherwise normally all render at zero elapsed time.
- There is no existing cast clock option.
- Adding an optional `now: () => number` to `CastOptions` preserves all callers while giving the
  impure shell a deterministic test seam.
- Existing ISO run timestamps can remain on their established path; the injected clock is only for
  live elapsed progress and does not rewrite ledger semantics.

## Test surface

- `src/engine/cast.test.ts` already provides:
  - temporary directories;
  - a stub executor;
  - sample stream messages;
  - `captureStdout` using a `process.stdout.write` spy;
  - end-to-end assertions through parse, gate, effect, and run logging.
- This is the named stub-executor harness in the ticket.
- The acceptance proof can be added there without spawning Claude or spending tokens.
- The test can inject a clock sequence, capture raw stdout, and read the transcript after the
  awaited cast returns.
- Exact transcript equality can compare parsed JSON objects to `SAMPLE_STREAM`, while exact text
  equality can compare JSONL lines to `SAMPLE_STREAM.map(JSON.stringify)`.
- The live assertion should verify refresh control, progress fields, one newline-terminated live
  row, and absence of the old bare event labels.

## Constraints and assumptions

- The worktree already contains Lisa-owned and other-ticket changes. They must not be modified or
  included.
- Ticket-owned source is expected to be `src/engine/cast.ts` and `src/engine/cast.test.ts`.
- The dependency's core files should remain unchanged unless wiring reveals a contract defect.
- No new package is required.
- No live metered cast is authorized or needed; the story names real-cast confirmation as a later
  counter-authorized observation.
- `bun run check` is the repository gate before completion.

## Research conclusion

The pure accounting and formatting judgment already exists and is tested. The missing work is an
impure-shell composition: fold each existing `onMessage`, render it with funded envelope, effective
turn cap, and elapsed clock, overwrite one terminal row, pass the same untouched message through the
existing transcript serializer, terminate the row once, and prove both surfaces through the existing
stub-executor integration harness.
