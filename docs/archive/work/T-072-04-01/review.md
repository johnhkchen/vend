# Review — T-072-04-01

## Outcome

Acceptance is met. The turn cap was binding over a different unit than the displayed `num_turns` value. The final run summary now compares like with like and labels Claude's external counter separately.

## Root cause

Vend's cap wiring is correct:

- decompose supplies `DECOMPOSE_MAX_TURNS = 15`;
- the cast loop resolves that default;
- the Claude executor emits `--max-turns 15`.

Claude Code 2.1.207 maintains separate counters:

- `--max-turns` bounds model/assistant loop iterations;
- terminal `num_turns` starts at one and advances with emitted user/tool-result messages.

One assistant turn can request several tools, so several user/tool-result messages can accrue inside one capped model iteration. The three successful live transcripts demonstrate the mismatch:

| Evidence run | Distinct assistant/model IDs | User/tool-result messages | `num_turns` / ledger `turnsUsed` | Cap |
|---|---:|---:|---:|---:|
| `run-2026-07-11T17-21-36-240Z` (E-068) | 8 | 16 | 17 | 15 |
| `run-2026-07-11T18-44-19-106Z` (E-069) | 9 | 15 | 16 | 15 |
| `run-2026-07-13T02-00-52-016Z` (E-072) | 9 | 17 | 18 | 15 |

For each run, the external result is exactly `1 + user/tool-result messages`, while distinct assistant/model IDs remain below the cap. The defect was the old `turnsUsed / maxTurns cap` presentation, not missing enforcement.

## Changes

### `src/engine/cast-core.ts`

- Added `TurnSummaryFormat`.
- Added pure `formatTurnSummary`.
- Same-unit normal output now reads, for example:
  - `· agent turns: 9 / 15 cap; executor conversation events: 18`
- An anomalous observed agent count above its configured cap renders separate facts instead of a fraction:
  - `· agent turns observed: 18; configured agent-turn cap: 15; executor conversation events: 18`
- Raw executor evidence is never clamped or rewritten.

### `src/engine/cast.ts`

- Replaced inline `· turns: N / cap` formatting with the pure formatter.
- Uses `progress.turns`, which already deduplicates repeated assistant stream blocks by message ID, as the cap-comparable observed agent-turn count.
- Keeps validated `result.num_turns` as `turnsUsed` for ledger compatibility.
- Labels that external count separately at settlement.

### `src/engine/cast-core.test.ts`

- Added an evidence-shaped characterization test: 9 observed agent turns, cap 15, executor count 18.
- Explicitly asserts the output does not contain `18 / 15 cap`.
- Added the defensive same-unit over-cap case and asserts it also cannot form an over-cap fraction.
- Covered uncapped, unobserved, and empty input shapes.

## Test coverage

- Existing `buildArgs` tests continue to pin that `--max-turns` is passed.
- Existing `resolveTurnsUsed` tests continue to pin validation and raw preservation of `num_turns`.
- New formatter tests pin the external-semantics characterization and the surface invariant requested by the ticket.
- Existing cast integration tests exercise the updated shell wiring with stub executors.
- Full gate: 1,662 pass, 1 declared skip, 0 fail.

## Acceptance assessment

- Root cause written up with the three 16/17/18 evidence runs: met.
- Test pins diagnosed Claude CLI semantics: met through the evidence-shaped pure formatter characterization, supported by existing argv tests.
- Successful summary cannot render an over-cap `N / cap` in like terms: met; the formatter only forms the fraction when observed agent turns are at or below the cap, and the anomalous branch is tested.
- `bun run check` green: met.

## Honest boundary and limitations

- No live metered cast was run; the story explicitly authorizes diagnosis from the existing ledger/transcripts, which provide three reproductions.
- Claude's external field remains named `turnsUsed` in the v1 ledger for backward compatibility. This ticket fixes the human-facing comparison; it does not migrate historical schema vocabulary.
- Distinct assistant message IDs are the observable proxy for capped model-loop iterations. This is supported by the three raw transcripts and by the existing live-progress implementation, but Vend still relies on Claude to enforce the cap.
- If a future Claude version changes either stream IDs or `num_turns` semantics, the separate labels and defensive formatter remain non-lying, though the characterization should be revisited during executor upgrades.
- `DECOMPOSE_MAX_TURNS` remains 15; the diagnosis did not invalidate that judgment.

## Open concerns

No critical issue remains for this ticket. The current installed CLI retains `--max-turns` internally even though its ordinary help surface did not list it in this environment; the existing successful executions and bundled flag definition confirm it is accepted. CLI upgrade validation remains normal executor-maintenance work, outside this slice.

## Commit

`e11d07ff1bc78535158697ab34e876f277003b91` — `fix(engine): make turn-cap summary compare honest units`

