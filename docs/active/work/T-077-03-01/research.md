# Research — T-077-03-01

## Ticket contract

- Ticket: `T-077-03-01`, `token-fraction-detect-after-label`.
- Parent story: `S-077-03`, `honest-progress-line`.
- Current phase at assignment: `research`.
- The acceptance surface is the live cast progress line.
- The required behavior is an in-line `(detect-after)` marker when live weighted
  token spend is greater than the funded token envelope.
- A pinned test must prove that the marker is present above the envelope and
  absent below it.
- The ticket advances P7 (budget is a hard contract) and P5 (local-first).

## Story boundary

- The story owns `formatCastProgress` in `src/engine/cast-core.ts`, its call site
  in `src/engine/cast.ts`, and regression coverage in `src/engine/cast-core.test.ts`.
- The story says the token segment and turn segment are distinct work slices.
- This ticket owns only the token segment.
- `T-077-03-02` owns the live-turn fraction regression test.
- The story explicitly rules out rewriting the turn counter.
- The summary line was already corrected by `T-072-04-01` and is out of scope.
- Token accounting semantics are out of scope.
- Executor behavior and the detect-after budget contract itself are out of scope.

## Existing progress state

- `CastProgress` is declared in `src/engine/cast-core.ts`.
- It contains `weightedTokens`, `turns`, and `seenMessageIds`.
- `EMPTY_CAST_PROGRESS` is the immutable zero value.
- `accumulateCastProgress` is a pure immutable fold over streamed executor
  messages.
- Only identifiable assistant messages with usage participate in the fold.
- Repeated message IDs are deduplicated.
- `weightedTokens` is increased using the canonical `countTokens` function from
  `src/budget/budget.ts`.
- Terminal result usage is intentionally not added to live progress because it
  is cumulative rather than another incremental turn.

## Existing formatting contract

- `CastProgressFormat` supplies `elapsedMs`, `tokenEnvelope`, and optional
  `maxTurns` as plain values.
- Its `tokenEnvelope` comment states that the value is the funded
  `Budget.tokens` ceiling in the same numeraire as weighted spend.
- `humanProgressTokens` normalizes non-finite values to zero, clamps negatives
  to zero, rounds values, and renders whole thousands with a `k` suffix.
- `humanElapsed` renders compact seconds, minutes, and hours.
- `formatCastProgress` is pure and currently renders one template:
  `elapsed <time> · <spent>/<envelope> · turn <count-or-fraction>`.
- The token fraction currently has no denomination label and no overshoot
  annotation.
- The comparison facts needed by the ticket are already present in the
  formatter arguments: `state.weightedTokens` and `opts.tokenEnvelope`.

## Impure shell wiring

- `src/engine/cast.ts` resolves the effective turn cap before execution.
- It initializes progress from `EMPTY_CAST_PROGRESS`.
- Each executor message is folded with `accumulateCastProgress`.
- The shell obtains elapsed time from its injectable clock.
- It calls `formatCastProgress` with the current progress, elapsed time,
  `budget.tokens`, and the effective `maxTurns`.
- The returned line replaces the current terminal row via carriage return and
  ANSI clear-line control.
- The raw message is still written to the durable transcript.
- The call site already provides the funded token ceiling; no new effectful
  input is missing.

## Existing tests

- Progress tests live in the `cast progress — per-turn weighted spend + humane
  line` describe block in `src/engine/cast-core.test.ts`.
- The primary fixture folds seven distinct assistant messages.
- Its weighted spend is 210,000 tokens against a 500,000-token envelope.
- The pinned expected line is currently
  `elapsed 4m12s · 210k/500k · turn 7/15`.
- This is an existing under-envelope example.
- Another test covers total no-op behavior for malformed and duplicate events.
- A formatting test covers seconds, hours, small token values, capped turns, and
  uncapped turns.
- There is no current over-envelope `formatCastProgress` assertion.
- The tests call the pure formatter directly and therefore spend no tokens and
  need no terminal or executor fixture.

## Related historical work

- `T-072-02-01` introduced the pure accumulator and formatter.
- Its design deliberately made weighted live spend use the canonical budget
  numeraire.
- `T-072-04-01` corrected only the final turn-summary line.
- Its design explicitly states that the live progress line remained unchanged.
- `formatTurnSummary` separately labels agent turns, configured cap, and
  executor conversation events.
- That summary code is adjacent but not part of this ticket.

## Repository and workflow constraints

- TypeScript runs on Bun with strict typechecking.
- `bun run check` is the repository gate: BAML codegen, typecheck, and all tests.
- Core logic belongs in pure functions; effects stay in the shell.
- Ticket phase artifacts belong in the attempt-private work directory.
- Lisa publishes admitted artifacts later; shared `docs/active/work` must not be
  written by this attempt.
- Ticket frontmatter phase and status are Lisa-owned and must not be edited.
- Ticket source changes must be committed with `lisa commit-ticket` and exact
  repository-relative include paths.
- The ordinary Git index must not be used for ticket work.

## Worktree observations

- The worktree already contains modified Lisa provenance and ticket files plus
  another ticket's untracked work artifacts.
- Those changes are not owned by this ticket.
- Exact-path commit isolation is required to preserve concurrent work.
- The ticket's likely source ownership is limited to
  `src/engine/cast-core.ts` and `src/engine/cast-core.test.ts`.

## Constraints and facts to preserve

- Overshoot means strictly greater than the envelope; equality is not an
  overshoot under the ticket wording.
- The comparison should use unformatted numeric facts, not rounded display
  strings.
- The token fraction's existing humane rounding remains part of the displayed
  surface.
- Existing elapsed and turn output is outside this ticket and should remain
  byte-stable.
- The marker describes detection after spend has occurred; it does not claim
  prevention.
- No live metered cast is required by the story's honest boundary.
- The deterministic pure formatter test is sufficient evidence for this slice.
