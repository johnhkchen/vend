# Design — T-077-01-01

## Decision to make

The ticket needs one committed characterization that observes the whole decompose max-turns seam
without changing behavior or invoking a live model. The design must connect the authored default,
the impure cast shell, the production argv builder, the stream accumulator, terminal `num_turns`,
and cap-hit persistence in one deterministic test.

## Required facts

The test must prove these facts together:

1. The decompose play default is `DECOMPOSE_MAX_TURNS = 15`.
2. The value received by the executor becomes `--max-turns 15` through production `buildArgs`.
3. Live progress counts distinct assistant message IDs, ignoring duplicate blocks.
4. Terminal `num_turns` is retained separately as run-log `turnsUsed`.
5. A terminal `error_max_turns` subtype is durably recorded at the seam.
6. Current settlement behavior is characterized, not changed.

## Option A — Run the installed Claude CLI in the test

Construct the real decompose play and allow `ClaudeExecutor` to spawn `claude -p` with a small
fixture prompt and `--max-turns 15`.

Advantages:

- Exercises the actual process boundary.
- Delegates cap-hit generation to the installed CLI.
- Observes the external implementation rather than a fixture.

Rejected because:

- It spends subscription credits and is not hermetic.
- Authentication, CLI version, model behavior, and local configuration would make the gate flaky.
- A prompt cannot reliably force exactly 15 model iterations or an `error_max_turns` result.
- The repository has intentionally kept live `dispense` outside the unit suite since T-001-02.
- Loading the concrete decompose play also loads the BAML runtime/native addon.
- This would violate the project's deterministic, local gate discipline.

## Option B — Unit-test the pure functions independently

Add or reuse assertions in `claude.test.ts` and `cast-core.test.ts` for `buildArgs`,
`accumulateCastProgress`, `resolveTurnsUsed`, and `formatTurnSummary`.

Advantages:

- Small, fast, and maximally isolated.
- Most individual facts already have direct coverage.
- No impure edges or runtime concerns.

Rejected because:

- It would redo T-015 and T-072 coverage.
- It would not prove that `castPlay` resolves the decompose default and hands it to the executor.
- It would not prove the same injected stream drives progress, transcript, and ledger together.
- The parent story explicitly requests the impure shell that T-072-04-01 left out.

## Option C — Add dependency injection to Claude `dispense`

Refactor the production Claude executor so tests can inject a spawn function or argv observer, then
instantiate a `ClaudeExecutor` in `cast.test.ts`.

Advantages:

- Lets a test use the concrete executor class without launching a process.
- Could inspect the exact arguments passed to a fake child process.
- May provide broader future transport-test flexibility.

Rejected because:

- It changes production code solely for a characterization that existing seams can express.
- It expands ticket scope and source ownership.
- It introduces a new process abstraction despite the story's no-production-change boundary.
- The behavior under test is `buildArgs`, already the canonical production argv projection.
- A fake child would add substantial stream/stdio machinery without increasing the factual claim.

## Option D — Impure cast test with injected executor plus production argv builder

Create a BAML-free decompose-shaped play fixture whose `maxTurns` is the production
`DECOMPOSE_MAX_TURNS`. Inject an `Executor` whose `dispense` implementation:

- receives the exact `DispenseOptions` produced by `castPlay`;
- calls production `buildArgs(opts)` and records the argv;
- streams a controlled cap-hit sequence through the real `opts.onMessage` callback;
- returns the same terminal `error_max_turns` result.

Then assert stdout, transcript, run log, effect, and returned summary.

Advantages:

- Exercises the real impure `castPlay` wiring requested by the story.
- Exercises the real production argv function, not a copied projection.
- Uses the real decompose cap constant.
- Preserves exact production accumulator, formatter, transcript, and logging code.
- Remains token-free, network-free, subprocess-free, and deterministic.
- Requires one test-only file change and no behavior change.

Chosen.

## Fixture play design

The fixture will be explicitly decompose-shaped but BAML-free:

- `name: "decompose-epic"` to exercise decompose run-record labeling.
- `maxTurns: DECOMPOSE_MAX_TURNS` to use authored policy rather than a duplicated literal.
- `render` returns a stable fixture prompt.
- `parse` wraps the result text in a plain object.
- `gates` returns a clear verdict with a named fixture gate.
- `effect` records the parsed text and reports a successful no-file effect.
- `budget` uses the existing high test envelope.
- `card` uses an ordinary static fixture value.

The fixture does not claim to test BAML rendering or board materialization. Those are outside the
executor seam and already covered elsewhere.

## Stream fixture design

Use a sequence shaped like the field report:

- one `system/init` message;
- assistant messages with IDs `cap-turn-1` through `cap-turn-15`;
- repeat at least one assistant ID to represent multiple blocks for a single response;
- give every assistant message object-shaped usage so it is eligible for accumulation;
- one terminal result with `subtype: "error_max_turns"`, parseable result text, cumulative usage,
  and `num_turns: 23`.

The 15 versus 23 values are deliberately unlike:

- 15 is the number of distinct assistant IDs and equals the configured agent-loop cap.
- 23 is the executor's separate conversation-event count.
- A repeated assistant event proves raw event count is not the accumulator unit.

## Cap-hit recording contract

The test will not invent a new run-log field. It will pin current behavior at both durable surfaces:

- The transcript's terminal JSON line carries `subtype: "error_max_turns"`.
- The run log carries `turnsUsed: 23` from terminal `num_turns`.

It will also assert current classification:

- because the seam returns the result, the result text parses, gates clear, and usage is within the
  envelope, `castPlay` currently settles `outcome: "success"` and runs the effect;
- the run log has no dedicated cap-hit field or distinct cap-hit outcome.

This is intentionally descriptive. A later resume/repair story can use the characterized raw
subtype as the basis for behavior changes.

## Argv assertion

The injected executor will store `buildArgs(opts)` before streaming. The assertion will verify the
relevant production argv suffix or complete expected array. Since the fixture declares no tool,
model, effort, or system options, the exact expected argv is stable:

`["-p", "--output-format", "stream-json", "--verbose", "--max-turns", "15"]`

This proves the value that reached the executor is the value the real Claude builder binds.

## Accumulator assertion at the impure shell

The test should avoid reaching into local `progress` state. It will observe the state through the
existing settlement formatter in captured stdout:

`· agent turns: 15 / 15 cap; executor conversation events: 23`

That line is produced only after:

- the real `onMessage` callback folds every fixture message;
- duplicate IDs are ignored by the production accumulator;
- terminal `num_turns` is validated separately;
- the impure shell supplies both facts to the production formatter.

The transcript can additionally assert that raw assistant event count exceeds 15 while its unique
nested IDs equal 15, making deduplication visible from the durable inputs.

## Compatibility and scope

- No production exports or runtime behavior change.
- No run-log schema change.
- No cap policy change.
- No new dependency.
- No live executor call.
- No ticket or story edits.
- Existing pure tests remain unchanged.
- One new integration test in `src/engine/cast.test.ts` is the entire ticket-owned source unit.

## Risks and mitigations

### Process-global stdout spy

Risk: another concurrently running test could write to stdout during capture.

Mitigation: reuse the suite's established `captureStdout` helper and keep assertions targeted to a
stable contained substring rather than the full refreshing row sequence.

### Large repeated stream fixture

Risk: handwritten arrays obscure the intended distinct-ID count.

Mitigation: generate the 15 unique assistant messages from the production constant and insert one
explicit duplicate. Derive transcript assertions from parsed lines.

### Extra properties passed to `buildArgs`

Risk: `DispenseOptions` contains prompt, callback, and timeout fields not declared by `buildArgs`.

Mitigation: TypeScript structural typing permits a variable with extra properties; `buildArgs`
destructures only its known flags. If type checking objects, project only `maxTurns`, but prefer the
whole received options to keep the seam assertion direct.

### Misstating external semantics

Risk: calling `num_turns` a cap breach would repeat the T-072 units error.

Mitigation: assertions use separate labels and require `turnsUsed` to retain 23 unchanged.

## Design decision

Add one deterministic impure-shell characterization to `src/engine/cast.test.ts`. It will drive a
decompose-default-shaped cast through injected executor options, invoke production `buildArgs`,
stream a terminal cap-hit result, and assert the real stdout/transcript/run-log consequences. No
production code will change.
