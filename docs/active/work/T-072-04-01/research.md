# Research — T-072-04-01

## Contract and boundary

- The parent story is `S-072-04`, whose scope is only the turn-cap seam between the generic cast loop and the Claude executor.
- The story keeps `DECOMPOSE_MAX_TURNS` at 15 unless diagnosis shows that the underlying judgment used the wrong unit.
- A live metered cast is explicitly unnecessary: the existing ledger and transcripts contain three successful reproductions.
- Cross-play turn policy, retry/escalation on cap hit, and other plays' caps are out of scope.
- The governing principles are P3 (gates are the contract) and P7 (budget is a hard contract). A displayed cap must not imply enforcement over a different measurement.

## Existing data path

1. `src/play/decompose-epic-core.ts` exports `DECOMPOSE_MAX_TURNS = 15`.
2. The concrete decompose play exposes that value as `play.maxTurns`.
3. `src/engine/cast.ts` resolves `opts.maxTurns ?? play.maxTurns` through `resolveMaxTurns`.
4. The same resolved number is passed to `executor.dispense({ maxTurns })` and to the live-progress formatter.
5. `src/executor/claude.ts` maps `maxTurns` to `--max-turns <n>` in `buildArgs`.
6. `dispense` spawns the CLI without a shell, so argv is not rewritten between Vend and Claude.
7. The terminal Claude result carries `num_turns`; Vend validates it through `resolveTurnsUsed` and records it as `turnsUsed`.
8. `src/engine/cast.ts` currently renders `· turns: ${turnsUsed} / ${maxTurns} cap` when both values exist.

## Existing tests and boundaries

- `src/executor/claude.test.ts` pins argv construction, including `--max-turns` presence, composition, omission, and zero behavior.
- `src/engine/cast-core.test.ts` pins effective-cap precedence and validation of the external `num_turns` field.
- The same file owns pure tests for live-progress accumulation and formatting.
- `src/engine/cast.test.ts` exercises the impure cast shell with injected stub executors and captures stdout where needed.
- The house pattern keeps decisions/formatting in `cast-core.ts` and filesystem/process/clock work in `cast.ts`.
- No implementation currently centralizes the final turn-summary string in a pure formatter.

## Ledger evidence

The successful reproductions in `.vend/runs.jsonl` are:

| Run | Epic | Outcome | `turnsUsed` | Configured decompose cap |
|---|---|---|---:|---:|
| `run-2026-07-11T17-21-36-240Z` | E-068 | success | 17 | 15 |
| `run-2026-07-11T18-44-19-106Z` | E-069 | success | 16 | 15 |
| `run-2026-07-13T02-00-52-016Z` | E-072 | success | 18 | 15 |

The cap is not stored in the run record. Its value is established by the pinned decompose play default, which is the value the cast path resolves and hands to Claude for these runs.

## Transcript evidence

The corresponding `.vend/transcripts/<run-id>.jsonl` files preserve the raw Claude stream. Counting their message types gives:

| Run | distinct assistant message/request IDs | emitted `user` tool-result messages | terminal `num_turns` |
|---|---:|---:|---:|
| E-068 success | 8 | 16 | 17 |
| E-069 success | 9 | 15 | 16 |
| E-072 success | 9 | 17 | 18 |

For all three evidence runs, `num_turns = 1 + emitted user/tool-result messages` exactly. It is not the number of distinct assistant/model responses.

The assistant stream can repeat one message ID across thinking, text, and tool-use blocks. `accumulateCastProgress` already deduplicates those events by nested assistant message ID, yielding a model-response count rather than a stream-event count.

## Claude behavior at the seam

- The installed evidence-run CLI identifies itself in transcript init messages as Claude Code 2.1.207.
- Its executable retains the documented `--max-turns` definition: maximum agentic turns, early-exiting after the configured number in print mode.
- Inspection of that executable's bundled loop shows a separate model-loop turn counter used for max-turn enforcement.
- The result-emission path initializes its `num_turns` counter at one and increments it for emitted `user` messages.
- A single model response may request multiple tools, each producing a separate user/tool-result message. Therefore the result counter can exceed the model-loop cap without the cap failing to bind.
- This matches the transcript evidence: only 8–9 distinct assistant/model message IDs occurred, while 15–17 tool-result messages inflated `num_turns` to 16–18.

## Root cause

Vend correctly passes the configured cap to Claude. The mismatch is not a dropped flag.

The defect is a units error at presentation time:

- `--max-turns` constrains agent/model loop iterations.
- terminal `num_turns` reports a different conversation-event-derived count.
- Vend labels the latter as though it were the former by rendering `turnsUsed / maxTurns cap`.

Both facts are useful, but they cannot occupy one fraction.

## Constraints for change

- Do not clamp or rewrite the external `num_turns`; that would corrupt ledger evidence.
- Do not raise `DECOMPOSE_MAX_TURNS`; 15 remains the intended agent-loop bound.
- Do not reimplement Claude's enforcement in Vend.
- Preserve the live progress counter, which already deduplicates assistant IDs and is the closest observable value to the capped agent-turn unit.
- Make final summary formatting pure and directly testable.
- Preserve uncapped casts and results where either observable count is absent.
- Ensure even anomalous/custom executors cannot produce a misleading `N / cap` fraction with `N > cap`.

## Current worktree state

- The ordinary worktree contains unrelated modifications from T-072-01-02, including `src/cli.ts` and `src/cli.test.ts`.
- This ticket can avoid those paths entirely.
- Ticket commits must use `lisa commit-ticket` with exact include paths; ordinary staging and commits are prohibited by the assignment.

