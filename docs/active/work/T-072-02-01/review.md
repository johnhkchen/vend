# Review — T-072-02-01

## Outcome

Acceptance is met. The repository now has a pure, tested accumulator that folds
existing streamed assistant messages into price-true weighted spend and turn
count, then renders the requested humane elapsed/spend/envelope/turn line.

Ticket-owned source was committed through Lisa as:

```text
af44a8eed14e33ca4f329697b9be63ed06dbd4d2
feat(engine): add cast progress accumulator core
```

The commit contains exactly two source paths.

## Files changed

### `src/engine/cast-core.ts`

Added:

- `CastProgress` — immutable accumulated state;
- `EMPTY_CAST_PROGRESS` — frozen reusable seed;
- `CastProgressFormat` — explicit elapsed/funding/turn-cap inputs;
- `accumulateCastProgress` — pure stream-message reducer;
- `formatCastProgress` — pure humane line formatter;
- private guarded assistant-turn extraction;
- private elapsed and token humane formatting helpers.

Changed:

- the existing budget import now value-imports canonical `countTokens` and
  type-imports `BudgetOutcome` plus `Usage`.

Unchanged:

- `formatMessage`;
- `makeStreamSink`;
- all outcome, gate, tool, model, and turn-cap decisions.

### `src/engine/cast-core.test.ts`

Added three tests:

1. The full seven-turn acceptance fixture.
2. Malformed, usage-less, unknown, result, and duplicate no-op behavior.
3. Seconds/hour/small-token/uncapped formatting behavior.

No file was created or deleted in production source.

## Core behavior

The reducer accepts a streamed message as one billable observed turn only when:

- its type is exactly `assistant`;
- it has an object-shaped nested `message`;
- the nested message has a non-empty string `id`;
- the nested message has object-shaped `usage`;
- that nested message ID has not already been seen.

The nested message ID is load-bearing. Existing live transcripts show that one
Claude turn is emitted several times for thinking, text, and tool-use blocks.
Those events have different outer UUIDs but share the same nested message ID and
usage. Deduplicating on the nested ID makes the fold turn-level rather than
event-level.

## Accounting review

Accepted usage is passed directly to `budget.ts`'s `countTokens`. The live line
therefore uses the same fresh-input-token-equivalent accounting as P7 settlement:

- input: 1.0;
- output: 5.0;
- cache read: 0.1;
- cache creation: 1.25.

No local weighting mirror was added. This avoids policy drift if the canonical
weights change later.

Terminal `result.usage` is deliberately ignored by the reducer. It is the
authoritative cumulative settlement figure, so adding it to per-turn usage would
double-count the completed run. The story honestly defines live spend as an
approximation that converges to that result.

## Exact acceptance evidence

The fixture contains seven distinct assistant message IDs. Each contributes:

```text
10,000 input × 1.0 + 4,000 output × 5.0 = 30,000 weighted units
```

Seven turns therefore produce 210,000 weighted units. The fixture also contains:

- a repeated event for `turn-1`;
- system and user messages without usage;
- a rate-limit event;
- terminal aggregate result usage;
- an unknown event with valid-looking nested ID and usage.

Only the seven unique assistant turns count. The exact asserted output is:

```text
elapsed 4m12s · 210k/500k · turn 7/15
```

This single assertion proves extraction, canonical weighting, deduplication,
elapsed formatting, funded-envelope formatting, and turn-cap formatting together.

## Defensive behavior

The reducer is total for the external JSON cases exercised:

- absent top-level type shape;
- missing nested message;
- null nested message;
- array nested message;
- missing message ID;
- missing usage;
- array usage;
- unknown message type;
- terminal result type;
- repeated accepted ID.

Every case returns a no-op without throwing. Duplicate/no-op transitions return
the same state reference, while accepted transitions return new frozen state.

## Purity and boundaries

The implementation preserves the repository's pure-core/impure-shell rule.

- No real clock is read; elapsed milliseconds are passed in.
- No funded budget is looked up; the token envelope is passed in.
- No stdout or transcript sink is touched.
- No executor message is mutated.
- No accumulator input state is mutated.
- No filesystem, network, or process dependency was added.

The only runtime dependency added is the pure canonical budget counter.

## Test results

Focused command:

```bash
bun test src/engine/cast-core.test.ts
```

Result:

- 59 passed;
- 0 failed;
- 131 expectations.

Full gate:

```bash
bun run check
```

Result:

- BAML generation passed;
- strict TypeScript check passed;
- 1,654 tests passed;
- 1 existing conditional test skipped because no `dist/` artifacts exist;
- 0 tests failed;
- 5,063 expectations.

No live cast or metered model call was needed or run.

## Coverage assessment

Coverage is strong for this ticket's pure scope:

- happy-path full line: covered;
- multiple unique turns: covered;
- repeated stream blocks: covered;
- cost weighting: covered through a vector where parity differs materially;
- unknown/usage-less/malformed messages: covered;
- terminal cumulative usage exclusion: covered;
- capped and uncapped turn display: covered;
- seconds, minutes, and hours elapsed display: covered;
- small and thousand-scale token display: covered.

The private helpers are tested only through public behavior, which keeps tests
coupled to the contract rather than implementation details.

## Open concerns and downstream handoff

### Wiring remains deliberately absent

`cast.ts` still prints one event label per message. `T-072-02-02` owns replacing
that live surface with one refreshing line while preserving every transcript raw
message. This ticket only settles the core API it will call.

Suggested downstream use:

```ts
let progress = EMPTY_CAST_PROGRESS;
progress = accumulateCastProgress(progress, msg);
const line = formatCastProgress(progress, {
  elapsedMs: now() - started,
  tokenEnvelope: budget.tokens,
  maxTurns,
});
```

The downstream test should continue to prove transcript byte preservation.

### Executor message availability

The current Claude stream supplies nested message IDs and per-turn usage. An
executor that emits assistant deltas without those fields will safely remain at
zero progress until its transport provides identifiable usage; the reducer will
not fabricate spend or turns. This matches the story's constraint to read
existing events rather than add new ones, but is worth retaining as an honest
boundary for future executor adapters.

### Small-state linear lookup

Deduplication uses a read-only string array and `includes`, with immutable copying
per accepted turn. Cast turn counts are small, so the clarity is preferable to a
mutable `Set`. If future workloads make turn counts large, this can be changed
behind the reducer contract with profiling evidence.

## Worktree hygiene

After the Lisa commit:

- both ticket-owned source paths are clean;
- neither is staged;
- no ticket-owned source remains untracked.

The remaining modified/untracked paths belong to Lisa transitions and concurrent
`T-072-01-01` work. They were not included in this ticket's commit.

## Final assessment

Green. The ticket's only acceptance criterion is fully met with deterministic,
free fixture evidence. No critical issue, TODO, or unmet clause remains in this
ticket. The downstream live-refresh behavior remains correctly isolated in
`T-072-02-02`.
