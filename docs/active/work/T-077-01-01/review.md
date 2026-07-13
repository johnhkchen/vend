# Review — T-077-01-01

## Outcome

Acceptance is met. A committed, deterministic impure-shell test now characterizes the live
decompose max-turns seam from authored play default through production argv construction, streamed
progress accumulation, terminal executor result, transcript persistence, and run-log settlement.

The ticket made no production behavior change.

## What the test proves

### The decompose default binds at the argv seam

The test imports `DECOMPOSE_MAX_TURNS` from the addon-free production decompose core and assigns it
to a BAML-free play named `decompose-epic`.

That play runs through `castPlay`, which resolves the play default and passes it to the injected
executor as `DispenseOptions.maxTurns`. The executor calls production `buildArgs` on those exact
options. The test asserts the complete resulting argv:

```text
-p --output-format stream-json --verbose --max-turns 15
```

This closes the impure-shell pass-through gap left by the older direct `buildArgs` tests. It also
pins the corrected architecture: `claude -p` subprocess argv, not an Agent SDK `query()` call, and
an authored play default rather than a user-facing CLI flag.

### The live accumulator counts deduplicated assistant IDs

The fixture streams sixteen assistant events with fifteen distinct nested `message.id` values. One
assistant object is repeated to represent multiple stream blocks belonging to the same model
response.

The exact raw messages pass through `castPlay`'s production `onMessage` callback. The transcript
assertions prove both input facts:

- sixteen raw assistant events are preserved;
- the set of nested assistant IDs has size fifteen.

The final production summary then reports:

```text
· agent turns: 15 / 15 cap; executor conversation events: 23
```

That is an impure-shell observation of the actual accumulator state, not a direct unit call to
`accumulateCastProgress`.

### turnsUsed retains the external num_turns unit

The terminal fixture result carries `num_turns: 23`. The test asserts the durable run record carries
`turnsUsed: 23` unchanged.

It also asserts stdout never contains `23 / 15 cap`. This extends T-072-04-01's pure formatter
diagnosis into the real cast shell: the accumulator-derived count and executor terminal count remain
separate facts with separate labels.

### Cap-hit behavior is recorded exactly as it exists

The terminal fixture result has `subtype: "error_max_turns"`. The executor streams that result
through the same callback used for every live Claude stream message and returns it to `castPlay`.

The test reads the durable transcript and asserts its last row includes:

```json
{"type":"result","subtype":"error_max_turns","num_turns":23}
```

This is the current cap-hit record at the executor seam.

The test also pins the rest of current behavior honestly:

- `castPlay` does not branch on terminal result subtype;
- it meters usage, parses returned result text, and runs gates;
- with valid text, in-budget usage, and a clear gate, it runs the effect;
- the returned summary and run log both settle as `success`;
- there is no dedicated cap-hit field or outcome in the run log.

This is characterization, not endorsement. Changing that handling belongs to the later repair and
resume slices named by S-077-01.

## Source changes

### `src/engine/cast.test.ts`

- Imported production `buildArgs`.
- Imported production `DECOMPOSE_MAX_TURNS` from the addon-free core.
- Added one 106-line integration characterization.
- Reused existing temporary-root and stdout-capture infrastructure.
- Added no shared helper, dependency, production export, or runtime branch.

No other source file changed.

## Pure-core / impure-shell assessment

The repository's boundary remains intact:

- Production decisions stay in existing pure functions.
- The cast shell remains the effectful coordinator.
- The test injects the executor effect edge and supplies plain stream values.
- Production `buildArgs` supplies the argv decision; the test does not duplicate its logic.
- File reads are confined to test verification of the actual transcript and run log.

No new logic was placed in the impure shell.

## Test coverage

The new test covers the ticket acceptance as one cohesive path:

- play default resolution;
- cast-to-executor option threading;
- production Claude argv building;
- stream callback execution;
- assistant ID deduplication;
- terminal subtype transcript recording;
- terminal `num_turns` validation/logging;
- final turn summary labels;
- current parse/gate/effect/classification behavior.

Existing coverage continues to provide narrower oracles:

- `src/executor/claude.test.ts` pins general `buildArgs` flag composition and omission.
- `src/engine/cast-core.test.ts` pins accumulator totality and deduplication directly.
- `src/engine/cast-core.test.ts` pins `resolveTurnsUsed` validation.
- `src/engine/cast-core.test.ts` pins honest final turn-summary formatting.
- the surrounding `cast.test.ts` tests pin transcript order, run-log writes, timeout behavior, and
  executor injection.

## Verification results

Focused shell suite:

- `bun test src/engine/cast.test.ts`
- 22 passed
- 0 failed
- 238 expectations

Typecheck:

- `bun run build`
- exit 0

Authoritative gate:

- `bun run check`
- BAML generation succeeded
- typecheck succeeded
- 1,752 passed
- 1 declared skip
- 0 failed
- 5,547 expectations
- 1,753 tests across 116 files

The declared skip is the existing release acceptance integration that requires local `dist/`
artifacts. It is unrelated to this ticket.

## Acceptance assessment

Ticket criterion:

> A committed characterization test drives a decompose cast through the real executor argv seam
> and asserts buildArgs emits `--max-turns 15` (DECOMPOSE_MAX_TURNS), the live accumulator counts
> distinct deduped assistant message-ids while turnsUsed captures the executor's num_turns (a
> different unit), and cap-hit at the seam is recorded.

Assessment:

- Committed characterization test: met in `0fad893e54bf39af46efaba52bdc4056917f1898`.
- Decompose-shaped cast through `castPlay`: met.
- Real production argv builder invoked on received executor options: met.
- `--max-turns 15` sourced from `DECOMPOSE_MAX_TURNS`: met.
- Raw assistant events versus distinct deduplicated IDs: met with 16 versus 15.
- Accumulator result observed at the impure summary surface: met with `15 / 15 cap`.
- Terminal external unit captured as `num_turns: 23`: met.
- Run-log `turnsUsed: 23`: met.
- Unlike counters never form `23 / 15 cap`: met.
- Cap-hit recording: met through terminal transcript subtype `error_max_turns`.
- No production behavior changes: met.
- Full gate green: met.

## Commit review

Commit:

`0fad893e54bf39af46efaba52bdc4056917f1898`

Message:

`test(engine): characterize decompose max-turns seam`

Committed through `lisa commit-ticket` with the single exact include:

- `src/engine/cast.test.ts`

The commit contains one file and 106 insertions. No Lisa ticket metadata, shared work artifact, or
concurrent ticket file entered the commit.

## Honest limitations

- The test does not launch the installed Claude CLI. That remains deliberately outside the
  deterministic test suite because it is metered, authenticated, version-dependent, and cannot be
  forced reliably to hit exactly this cap.
- The test characterizes the actual Vend seam with a controlled external message fixture; it does
  not prove every future Claude version retains the same `error_max_turns` subtype.
- `num_turns` remains named `turnsUsed` in the v1 run-log schema. This ticket preserves backward
  compatibility and labels its unit honestly only on the existing surface.
- The transcript is currently the only durable place that explicitly records `error_max_turns`.
  The run log records its `num_turns` and current outcome but not its subtype.
- Current behavior can settle a parseable, clear, in-budget `error_max_turns` result as success.
  This ticket pins that behavior and does not add a repair action or resumable state.

## Open concerns

No issue blocks this ticket.

The transcript-only nature of cap-hit and the success classification are important inputs for
S-077-04's next-repair-action work. Any later implementation should use the terminal subtype rather
than infer cap-hit from `turnsUsed >= maxTurns`, because T-072-04-01 and this test establish that
those values use different units.

Future Claude CLI upgrades should retain or revise this characterization fixture when their terminal
subtype contract changes. That is executor-maintenance work, not part of this characterization.

## Disposition

Pass. Acceptance is fully met, the source unit is committed, and the authoritative gate is green.
