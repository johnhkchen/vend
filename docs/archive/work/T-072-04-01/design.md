# Design — T-072-04-01

## Decision to make

The cap is binding in Claude's agent-loop unit, while terminal `num_turns` is a different counter. The design must keep both observations honest without implementing a second executor loop or falsifying historical data.

## Option A — Clamp `turnsUsed` to `maxTurns`

Render and/or persist `Math.min(num_turns, maxTurns)`.

Advantages:

- The old fraction can never exceed the cap.
- Smallest textual surface change.

Rejected because:

- It destroys the executor's observed result.
- The ledger would cease to be raw evidence and calibration could silently change.
- It hides the diagnosed semantic mismatch rather than naming it.
- It violates the project's preference for honest degradation over cosmetically green output.

## Option B — Treat the cap as unenforced and implement a Vend-side kill

Count streamed messages and terminate the executor when a Vend counter reaches 15.

Advantages:

- Vend would own enforcement independently of Claude CLI semantics.

Rejected because:

- The diagnosis shows Claude already enforces its own model-loop cap.
- Vend cannot safely kill on raw stream events or tool results without reproducing executor internals.
- Killing from `onMessage` would complicate the executor abstraction and risk discarding valid work.
- The story's honest boundary explicitly prefers characterization and labeling when the cause is Claude CLI semantics.

## Option C — Remove the cap from the summary

Continue logging `turnsUsed`, but print only `· turns: N`.

Advantages:

- No false fraction.
- Minimal code.

Rejected because:

- It makes a configured hard contract invisible at settlement time.
- It loses useful comparison with the already-visible live agent-turn progress.
- P7 is better served by naming both the observed capped-unit count and the external result counter.

## Option D — Label the unlike counters separately

Use the live accumulator's deduplicated assistant count as `agent turns`, pair that with `maxTurns` only when it is safe to do so, and separately label terminal `num_turns` as an executor-reported conversation-event count.

Advantages:

- Preserves raw `num_turns`/`turnsUsed` for the ledger.
- Shows a same-unit numerator alongside the agent-turn cap.
- Explains why an external count may be numerically larger without claiming a budget breach.
- Requires only a pure formatter plus a thin call-site change.
- Keeps executor-specific semantics at the presentation seam rather than changing generic outcome policy.

Chosen.

## Formatting contract

Introduce a pure formatter in `cast-core.ts` that accepts plain values:

- observed agent turns from `progress.turns`;
- optional configured `maxTurns`;
- optional executor-reported `num_turns` after `resolveTurnsUsed` validation.

Normal capped output should identify the same-unit fraction and the different external metric, for example:

`· agent turns: 9 / 15 cap; executor conversation events: 16`

An uncapped output should omit a denominator:

`· agent turns: 9; executor conversation events: 16`

If the observed agent-turn count itself exceeds a configured cap (possible with a non-Claude/custom executor or malformed stream), the formatter must not emit an over-cap fraction. It should label the values separately:

`· agent turns observed: 18; configured agent-turn cap: 15; executor conversation events: 18`

That branch is an honesty guard, not clamping: the anomaly remains visible.

If there is no terminal `num_turns`, the formatter may still report observed agent turns/cap. If there were no stream-observed assistant turns and no external count, no turn-summary line is necessary.

## Characterization strategy

The test should pin the diagnosed semantics rather than trying to execute Claude:

- Feed the formatter a representative evidence shape: 9 agent turns, cap 15, executor count 18.
- Assert it renders two explicitly named units and never `18 / 15`.
- Feed an anomalous same-unit shape: 18 observed agent turns, cap 15.
- Assert it renders separate observed/configured labels and no over-cap fraction.
- Retain existing argv tests proving the flag is passed and existing `resolveTurnsUsed` tests proving raw result preservation.

This is a characterization test because the executor semantics are external. No metered/live CLI test belongs in the deterministic gate.

## Why the live accumulator is suitable

`accumulateCastProgress` counts distinct assistant message IDs, not thinking/text/tool-use fragments. Those IDs correspond to distinct assistant/model responses in the evidence transcripts. That is the observable counter aligned with the model-loop concept bounded by `--max-turns`.

The design does not claim the stream counter is an independent enforcement mechanism. Claude remains authoritative for enforcement; the count is used for honest presentation only.

## Compatibility

- `turnsUsed` remains stored exactly as before.
- No run-log schema changes are required.
- `DECOMPOSE_MAX_TURNS` remains 15 and its existing tests remain unchanged.
- Executor interfaces and argv remain unchanged.
- The live progress line remains unchanged.
- Only the final settlement line changes wording and unit separation.

