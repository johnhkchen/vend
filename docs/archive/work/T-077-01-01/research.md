# Research — T-077-01-01

## Assignment and contract

- The attempt assignment requires all remaining RDSPI phases in one continuous pass.
- Phase artifacts belong only in `.lisa/attempts/T-077-01-01/1/work/`.
- Lisa, not this worker, publishes admitted artifacts to `docs/active/work/T-077-01-01/`.
- Lisa also owns ticket `phase` and `status` transitions; the ticket frontmatter must not be edited.
- Ticket-owned source changes must be committed only through `lisa commit-ticket` with exact
  repository-relative `--include` paths.
- The ticket is currently in Research.
- Its parent story is `S-077-01`, `max-turns-seam-characterization`.
- The story scope is characterization only; it explicitly excludes production behavior changes.
- The sole acceptance criterion asks for one committed impure-shell characterization test.

## Product grounding

- Charter P4 requires autonomous work to proceed against gates rather than live supervision.
- Charter P7 makes the allocated budget a hard contract.
- Vision non-goal N4 says Vend orchestrates and executors execute.
- This ticket supports those principles by making the external executor boundary factual before
  later stories label or react to it.
- It must not add a Vend-owned execution loop or alter Claude's cap semantics.
- It must not change the turn counter, cap value, cap-hit handling, token label, or resume behavior.

## Corrected external seam model

- Vend does not use the Claude Agent SDK or an SDK `query()` function.
- The Claude executor is `src/executor/claude.ts`.
- Its live transport is a `claude -p` subprocess spawned without a shell.
- `dispense` builds an argv array, passes it to `node:child_process.spawn`, writes the prompt to
  stdin, consumes newline-delimited stream JSON, and returns the terminal result message.
- `--max-turns` is not a Vend CLI flag in this path.
- It is an authored play default on the decompose play.
- The executor seam remains budget-agnostic except for its wall-clock timeout latch.

## Decompose default path

1. `src/play/decompose-epic-core.ts` exports `DECOMPOSE_MAX_TURNS = 15`.
2. `src/play/decompose-epic.ts` assigns that value to `decomposeEpicPlay.maxTurns`.
3. `src/engine/cast.ts` calls `resolveMaxTurns(opts.maxTurns, play.maxTurns)`.
4. A per-cast override wins; otherwise the play default is used.
5. The resolved value is passed to `executor.dispense({ maxTurns, ... })`.
6. `ClaudeExecutor.dispense` delegates to the free `dispense` function.
7. Claude `dispense` calls `buildArgs({ maxTurns, ... })`.
8. `buildArgs` appends `--max-turns` and the stringified value when the value is truthy.
9. For the decompose default, the resulting argv contains `--max-turns`, `15`.

## Existing argv coverage

- `src/executor/claude.test.ts` directly tests `buildArgs`.
- It covers composition with model, effort, and system prompt.
- It covers a max-turns-only argv.
- It covers absent max turns and the existing falsy-zero behavior.
- Those are pure builder tests, not a cast-shell threading test.
- T-015-01 intentionally left `castPlay`'s pass-through untested.
- T-072-04-01 fixed presentation using a pure formatter and explicitly left out an impure-shell
  stdout assertion.
- This ticket exists to close that live-path characterization gap without invoking a metered model.

## Cast-shell stream path

- `src/engine/cast.ts` creates the executor-facing `onMessage` callback.
- Each message first folds through `accumulateCastProgress`.
- The callback renders a refreshing progress line and sends the raw message to `makeStreamSink`.
- The sink serializes exact JSON into the per-run transcript.
- Transcript appends are promise-chained to preserve message order.
- The cast awaits all transcript writes before continuing past executor settlement.
- Therefore an injected executor can exercise the real impure shell deterministically while the
  production `buildArgs` function supplies the real argv projection.

## Accumulator semantics

- `accumulateCastProgress` lives in `src/engine/cast-core.ts`.
- It accepts only stream messages with `type === "assistant"`.
- The nested `message` must be a non-array object.
- The nested message must carry both a non-empty string `id` and object-shaped `usage`.
- The fold ignores malformed, usage-less, unknown, user, system, and terminal result messages.
- It stores assistant message IDs in `seenMessageIds`.
- A repeated ID is a no-op by reference: it neither adds usage nor increments turns.
- A new ID increments `turns` once and adds price-weighted usage once.
- The observable live counter is therefore distinct deduplicated assistant message IDs.
- It is not a count of every stream event.

## Terminal result and turnsUsed

- The external Claude terminal result type exposes optional `num_turns`.
- After `executor.dispense` returns, `castPlay` calls `resolveTurnsUsed(result?.num_turns)`.
- The validator retains only finite, non-negative integers.
- When present, the validated value is written unchanged as `turnsUsed` in the run log.
- The accumulator's `progress.turns` is not written to `turnsUsed`.
- T-072-04-01 diagnosed these as different units.
- Evidence showed distinct assistant IDs below 15 while terminal `num_turns` reached 16, 17, and 18.
- Its final formatter now labels the first as agent turns and the second as executor conversation
  events rather than placing the latter over the cap.

## Cap-hit behavior already present

- The Claude seam deliberately returns terminal result messages for every subtype.
- It throws only when no terminal result is observed or another transport failure occurs.
- Historical executor design explicitly names `error_max_turns` as a result subtype the caller
  must be able to observe.
- A raw terminal `error_max_turns` message passed to `onMessage` is serialized into the transcript.
- `castPlay` does not currently branch on `result.subtype`.
- It still meters terminal usage, parses `result.result`, runs gates, and classifies from timeout,
  token outcome, and gate verdict.
- If the returned text parses and gates clear within budget, current behavior settles as success
  and may run the effect even though the transcript records `error_max_turns`.
- The run-log schema does not copy the terminal subtype into a dedicated cap-hit field.
- Thus current cap-hit recording is the durable raw transcript, not a distinct run outcome.
- That absence must be described honestly; changing it belongs to later work.

## Existing integration-test pattern

- `src/engine/cast.test.ts` is the impure-shell integration suite.
- It injects structural `Executor` stubs through `CastOptions.executor`.
- Stubs call the real `opts.onMessage` callback and return a typed terminal result.
- Tests use temporary project roots, transcript paths, and run-log paths.
- `captureStdout` safely spies on and restores `process.stdout.write`.
- The suite already proves progress output and exact raw transcript preservation.
- It imports BAML generated symbols only as types where possible.
- Loading the concrete decompose play would load the BAML runtime/native addon and is unnecessary
  for a seam-only characterization.
- A BAML-free decompose-shaped fixture can carry the real `DECOMPOSE_MAX_TURNS` constant and the
  production play name while using trivial parse/gate/effect functions.

## Test construction constraints

- The test should import the production `buildArgs` from `src/executor/claude.ts`.
- The injected executor can call `buildArgs(opts)` on the exact `DispenseOptions` received from
  `castPlay`, capturing the argv that the real Claude executor would construct.
- The test should use `DECOMPOSE_MAX_TURNS` rather than duplicating literal policy in fixture setup.
- It should stream 15 distinct assistant IDs and at least one duplicate.
- It should return and stream a terminal result with `subtype: "error_max_turns"`.
- Its `num_turns` should deliberately use a larger value, matching the observed unlike-unit shape.
- It should assert the transcript contains the cap-hit subtype.
- It should assert the ledger retains the larger `num_turns` as `turnsUsed`.
- It should assert stdout reports 15 agent turns against the cap and the larger external count under
  its separate label.
- It should assert the current settlement outcome rather than silently implying a new one.

## Repository and ownership state

- HEAD was `3b72f91` at Research time.
- The worktree contained two modified ticket files: `T-077-01-01.md` and `T-077-02-01.md`.
- Their only diffs were Lisa phase transitions from `ready` to `research`.
- They are not ticket-owned implementation files and must remain untouched.
- No ticket-owned source file was modified at the start of the attempt.
- The likely only source file for this ticket is `src/engine/cast.test.ts`.

## Verification boundary

- Focused verification is `bun test src/engine/cast.test.ts`.
- Type verification is `bun run build`.
- The authoritative repository gate is `bun run check`.
- The test must be token-free and make no network or subprocess call.
- The production argv builder is pure, so calling it inside the stub proves the cast-to-argv data
  path while leaving the actual metered spawn outside the deterministic suite.

## Research conclusion

- The required characterization can be completed with one test-only source unit.
- Production behavior already exposes all relevant facts: resolved cap in executor options, real
  argv construction, deduplicated stream accumulation, raw `num_turns` logging, and raw terminal
  subtype transcript persistence.
- The missing piece is a single impure-shell test that observes those facts together on a
  decompose-default-shaped cast.
- No production change is warranted by this ticket's scope or acceptance criterion.
