# Research — T-072-02-01

## Ticket and story contract

- Ticket `T-072-02-01` adds the pure progress-line accumulator core.
- Parent story `S-072-02` owns the live cast progress line.
- This ticket is the first of two ordered tickets.
- `T-072-02-02` will wire the settled core into `cast.ts`.
- The line must show elapsed time, weighted spend against funding, and turns.
- The acceptance example is `elapsed 4m12s · 210k/500k · turn 7/15`.
- Spend must use the existing price-true token accounting.
- Usage-less and unknown message types must be harmless.
- Repeated stream events for one turn must not double-count.
- The story advances P4 and P7.
- The line makes autonomous work legible without adding an approval surface.
- The funded envelope remains a visible hard contract.

## Scope boundary

- Production scope is `src/engine/cast-core.ts`.
- Test scope is `src/engine/cast-core.test.ts`.
- No stdout refresh behavior belongs in this ticket.
- No changes to `src/engine/cast.ts` belong in this ticket.
- No changes to transcript writing belong in this ticket.
- No executor event additions belong in this story.
- No TUI, dashboard, detached mode, or notification behavior belongs here.
- No post-run summary changes belong here.
- The core must remain usable by the later impure wiring ticket.

## Existing pure/impure split

- `src/engine/cast-core.ts` contains cast decisions and stream projections.
- It has no filesystem, clock, process, or network value imports.
- Its `StreamMessage` import is type-only.
- `src/engine/cast.ts` owns filesystem paths, stdout, clocks, and execution.
- `makeStreamSink` is pure given injected writer and transcript sink edges.
- Today it renders every message with `formatMessage`.
- `cast.ts` writes each rendered message as a separate stdout line.
- The later ticket can replace only the live writer behavior.
- The transcript sink can remain byte-for-byte raw JSON.

## Stream transport shape

- `StreamMessage` is `{ type: string } & Record<string, unknown>`.
- It is intentionally open because the external JSON transport may evolve.
- `ResultMessage` narrows the terminal `result` message.
- Terminal `result.usage` is the final authoritative aggregate.
- The progress line instead needs incremental per-turn observations.
- Claude assistant events carry those at `message.usage`.
- The nested `message` object also carries a stable `message.id`.
- Stream consumers must validate these unknown nested values structurally.
- A type assertion alone would make malformed external JSON throwable.

## Observed transcript behavior

- Existing `.vend/transcripts/*.jsonl` files provide live ground truth.
- A single Claude assistant turn appears as multiple stream events.
- Thinking, text, and tool-use blocks can each produce an assistant event.
- Those events share one nested `message.id` for the turn.
- They also repeat the same nested `message.usage` object.
- Their outer `uuid` values differ, so outer UUID is not a turn key.
- A later turn receives a different nested `message.id`.
- Counting every assistant event would multiply spend and turn count.
- Deduplicating by nested message ID matches the executor's turn identity.
- Usage content alone is not a safe identity because two turns can cost alike.

## Non-assistant events

- System events such as `thinking_tokens` carry no turn usage.
- User events carry tool results and no assistant turn usage.
- Rate-limit and hook events carry no assistant turn usage.
- The result event carries aggregate usage, not a new turn.
- Adding result usage to assistant usage would double-count the whole run.
- Unknown event types must remain ignorable even if they contain lookalike fields.
- Assistant events without a usable ID or usage cannot be safely counted once.
- Ignoring an unidentifiable event is more honest than inventing a turn key.

## Budget accounting

- `src/budget/budget.ts` owns the `Usage` structural type.
- `countTokens` is the single definition of weighted spend.
- It weights input at 1.0 and output at 5.0.
- It weights cache reads at 0.1 and cache creation at 1.25.
- It rounds the weighted sum to an integer.
- Missing and non-finite usage buckets contribute zero.
- Reusing `countTokens` prevents the live line from drifting from settlement.
- The funded token envelope is `Budget.tokens`.
- The core only needs the numeric funded ceiling, not the whole budget object.
- Wall-clock funding is not part of the requested line denominator.

## Existing humane-unit idiom

- `src/shelf/menu.ts` formats token counts at human scale.
- Counts at least 1000 render as rounded whole thousands plus `k`.
- Smaller counts render as ordinary integers.
- The helper is private to the menu module.
- Importing `formatBudget` would couple the line to a combined time/token shape.
- The ticket asks to reuse the idiom, not necessarily that private function.
- The target spend example renders `210000` as `210k`.
- The target envelope example renders `500000` as `500k`.

## Elapsed and turn presentation

- The acceptance example renders 252 seconds as `4m12s`.
- This differs from menu allowance formatting, which chooses one whole unit.
- Live elapsed time needs compound units to show continued movement.
- The label prefix is explicitly `elapsed`.
- Turn count is one-based observed completed assistant messages.
- A known maximum renders as `turn used/max`.
- The existing `resolveMaxTurns` can produce an optional effective cap.
- When no cap exists, the truthful form can omit the denominator.

## Existing test conventions

- `src/engine/cast-core.test.ts` imports only the pure core.
- It already tests `formatMessage` and `makeStreamSink` with fixtures.
- Tests use Bun's `describe`, `test`, and `expect` APIs.
- Existing tests explicitly exercise malformed/unknown stream messages.
- A fixture sequence belongs naturally beside those stream tests.
- Focused verification is `bun test src/engine/cast-core.test.ts`.
- Repository verification is `bun run check`.
- No live cast is required; the story calls this ticket fixture-proven and free.

## Compatibility constraints

- Existing exports must remain intact for current callers and tests.
- The new API should be additive.
- The state must not mutate caller-owned values.
- Reducer output should be deterministic from state plus message.
- Formatting should be deterministic from state plus supplied elapsed/funding.
- The core must not read `Date.now()` or stdout.
- The later shell should inject elapsed milliseconds from its clock.
- Unknown messages should return the same state value or an equivalent state.
- Seen turn IDs are internal accumulator bookkeeping, not durable run data.

## Files and ownership

- Modify `src/engine/cast-core.ts` for the reducer and formatter.
- Modify `src/engine/cast-core.test.ts` for fixture-driven proof.
- Write phase artifacts only to this attempt-private directory.
- Lisa owns ticket frontmatter transitions and shared artifact publication.
- Existing modifications to active ticket files are not ticket-owned source edits.
- Source commits must use `lisa commit-ticket` with exact include paths.

## Research conclusions

- A unique nested assistant message ID is the available per-turn identity.
- Nested assistant usage is the available incremental spend source.
- The terminal result is excluded from accumulation.
- `countTokens` is the required accounting dependency.
- A pure immutable reducer plus a pure formatter matches repository boundaries.
- The next ticket can hold reducer state and inject clock/envelope/max-turn inputs.
- The acceptance can be proven entirely with a deterministic message fixture.
