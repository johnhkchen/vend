# Research — T-077-03-02

## Assignment and workflow constraints

- The ticket is `T-077-03-02`, `live-turn-fraction-regression-test`.
- Its current phase is `research`; Lisa owns ticket phase and status transitions.
- Phase artifacts belong in this attempt-private work directory.
- They must not be written directly to `docs/active/work/T-077-03-02/`.
- Ticket-owned source commits must use `lisa commit-ticket` with exact repository-relative includes.
- Ordinary `git add` and `git commit` are not permitted for this assignment.
- The shared worktree already contains changes from Lisa and another ticket.
- Those existing changes are outside this ticket and must remain untouched.
- The repository gate is `bun run check`.
- The project convention is pure core and impure shell.

## Story contract

The parent story is `S-077-03`, `honest-progress-line`.

Its scope names two existing surfaces:

- the pure `formatCastProgress` formatter in `src/engine/cast-core.ts`;
- the `castPlay` call site in `src/engine/cast.ts`.

The story also limits test work to `src/engine/cast-core.test.ts`.

The story acceptance has two independent clauses:

1. label a live token-envelope overshoot as detect-after;
2. pin the live turn fraction as deduplicated agent turns over `maxTurns`.

Ticket `T-077-03-01` completed the first clause. Its committed production change adds
`(detect-after)` to an over-envelope token fraction, and its unit test is already present in
`src/engine/cast-core.test.ts`.

This ticket owns only the second clause. The story explicitly says the live turn fraction is
already correct. This is a characterization/regression-test slice, not a production rewrite.

The story's honest boundary records that a literal `23/15` live fraction is not reproducible from
current production code. It also excludes changes to turn execution, the cap, and token accounting.

## Charter grounding

The ticket advances P7, “Budget is a hard contract.” The displayed fraction is part of the user's
understanding of the turn budget, so numerator and denominator must use the same unit.

The story also invokes N4, “Not an executor.” Vend presents and orchestrates the executor seam; this
slice does not replace Claude's agent loop or reinterpret its external counters.

The vision says gates make probabilistic work dependable. Here the regression test is the gate that
preserves an already-honest budget display.

## Prior diagnosis: T-072-04-01

`T-072-04-01` diagnosed the original summary-line mismatch.

The executor's configured `--max-turns` value bounds assistant/model loop iterations. Claude's
terminal `num_turns` value counts a different conversation-event unit. It starts at one and advances
with user/tool-result messages, so it can legitimately exceed the agent-turn cap.

The earlier evidence runs showed:

- deduplicated assistant/model IDs below the cap;
- terminal `num_turns` values of 16, 17, and 18;
- a configured cap of 15.

The summary repair therefore pairs `progress.turns` with `maxTurns` and labels the terminal value
separately as executor conversation events.

The existing summary regression test in `src/engine/cast-core.test.ts` uses:

- `agentTurns: 9`;
- `maxTurns: 15`;
- `executorReportedTurns: 18`.

It asserts the complete summary and also asserts that the line does not contain `18 / 15 cap`.

## Dependency characterization: T-077-01-01

This ticket depends on the completed `T-077-01-01` seam characterization.

That test drives a decompose-shaped cast through `castPlay` and production `buildArgs`. It pins that
the effective play default reaches the executor as `--max-turns 15`.

Its fixture supplies sixteen raw assistant stream events with fifteen distinct nested
`message.id` values. One assistant event is duplicated. The live accumulator reports fifteen turns,
demonstrating that raw stream event count is not the live numerator.

The terminal result supplies `num_turns: 23`. The durable run record preserves that as
`turnsUsed: 23`, demonstrating that terminal `num_turns` is not the live numerator either.

The final summary prints agent turns as `15 / 15 cap` and executor conversation events as `23`.
The dependency therefore establishes the exact factual distinction this ticket is required to pin
on the live formatter.

## Pure progress model

`src/engine/cast-core.ts` defines `CastProgress` with three facts:

- `weightedTokens`;
- `turns`;
- `seenMessageIds`.

`EMPTY_CAST_PROGRESS` begins at zero weighted tokens, zero turns, and an empty ID list.

The private `assistantTurn` extractor accepts only records where:

- `type` is exactly `assistant`;
- `message` is a non-array object;
- `message.id` is a non-empty string;
- `message.usage` is a non-array object.

`accumulateCastProgress` is pure and immutable. Unknown, malformed, usage-less, and duplicate-ID
events are no-ops. A first-seen assistant ID increments `turns` by one and adds weighted usage.

Terminal `result.usage` is intentionally ignored by this fold because it is cumulative rather than
an incremental assistant turn.

The open `StreamMessage` transport shape permits terminal fields such as `num_turns`, but
`accumulateCastProgress` does not read them.

## Live formatter

`formatCastProgress` takes a `CastProgress` value and explicit formatting options:

- `elapsedMs`;
- `tokenEnvelope`;
- optional `maxTurns`.

When `maxTurns` is present, the turn segment is formed directly from `state.turns` and
`opts.maxTurns` as `turn N/M`.

When `maxTurns` is absent, the turn segment is `turn N`.

The formatter has no parameter for executor `num_turns`. It therefore cannot render that external
counter unless a caller has already corrupted the `CastProgress` state.

The current production formatter does not include the summary formatter's defensive over-cap
branch. Its correctness relies on the established accumulator/cap seam: the live numerator is the
deduplicated assistant count that the cap bounds.

## Impure call site

`castPlay` resolves one effective cap with:

`resolveMaxTurns(opts.maxTurns, play.maxTurns)`.

That same `maxTurns` value is used in both places relevant to this ticket:

- passed to `formatCastProgress` for the refreshing live line;
- passed to `executor.dispense`, which reaches Claude's `--max-turns` argv.

For every stream message, the callback first folds the message into `progress`, then formats the
line using the updated progress and effective cap, writes it to stdout, and sends the raw message to
the transcript sink.

No result-derived `num_turns` is available to or consulted by the live formatter call. Terminal
`num_turns` is resolved later for final accounting and persistence.

## Existing tests

The `cast progress` describe block already has coverage for:

- seven distinct assistant IDs with a duplicate stream block;
- exact weighted token accumulation;
- the exact live line `turn 7/15`;
- malformed and duplicate messages as no-ops;
- capped and uncapped formatting;
- token detect-after labeling.

The first fixture contains a terminal result with cumulative usage but does not carry a high
`num_turns`. It proves deduplication and formatting independently, but it does not express the
specific unlike-counter regression named by this ticket.

The later `formatTurnSummary` describe block carries the negative invariant
`not.toContain("18 / 15 cap")`, but that assertion applies to the settled summary line rather than
the refreshing live line.

The impure `cast.test.ts` dependency test already checks stdout does not contain `23 / 15 cap`.
The ticket and story nevertheless request a pure formatter regression in `cast-core.test.ts`, where
the unit relationship can be pinned directly and cheaply.

## Relevant file ownership

The expected ticket-owned source surface is:

- `src/engine/cast-core.test.ts`.

No production change is required by the acceptance criterion or current code behavior.

The following are relevant but observational for this ticket:

- `src/engine/cast-core.ts`;
- `src/engine/cast.ts`;
- `src/engine/cast.test.ts`;
- `src/executor/claude.ts`;
- `src/play/decompose-epic-core.ts`.

## Constraints and assumptions surfaced

- The test must use a terminal executor count greater than the cap so the forbidden fraction is
  meaningful.
- The test must derive the live numerator through `accumulateCastProgress`, not hand-author a
  `CastProgress.turns` value, to pin the deduplication relationship.
- The fixture must contain at least one duplicate assistant ID to distinguish agent turns from raw
  assistant stream events.
- The test must call `formatCastProgress`, not only `formatTurnSummary` or `castPlay`.
- The asserted live line should expose the cap-comparable numerator and denominator together.
- An explicit `<= maxTurns` assertion can state the cap relationship independently of string shape.
- No external process, filesystem, clock, BAML addon, or network access is needed.
- A focused `bun test src/engine/cast-core.test.ts` can verify the source unit before the full gate.
- The source file is currently clean, so an exact one-file ticket commit can isolate the change.
