# Research — T-081-01-01

## Contract and evidence boundary

- The parent story is `S-081-01`, the turn-unit seam from the executor stream through the
  terminal summary and into the append-only run ledger.
- This ticket is the evidence spike that precedes both implementation tickets.
- It changes no production accounting policy.
- Its acceptance contract is a replay of already-captured local transcripts against their real
  ledger rows, so no live or metered cast is needed.
- The story requires historical ledger rows to remain untouched.
- The story excludes the live-fold implementation itself; `S-081-02` owns that later change.
- The governing invariant is P7: a budget meter must use one honest unit from observation through
  durable recording.

## Existing turn data path

1. A play may expose `maxTurns`; decompose currently exposes 15.
2. `src/engine/cast.ts` resolves the effective cap before dispense.
3. `src/executor/claude.ts` renders that value as `--max-turns <n>`.
4. Every raw stream message is passed to `accumulateCastProgress`.
5. `src/engine/cast-core.ts` accepts an assistant record only when it has a nested non-empty
   `message.id` and an object `message.usage`.
6. The fold deduplicates those assistant records by `message.id`.
7. It does not inspect `parent_tool_use_id`.
8. Therefore main-loop and sidechain assistant IDs enter the same `progress.turns` set.
9. On settlement, `resolveTurnsUsed(result?.num_turns)` validates the terminal executor field.
10. `cast.ts` uses `progress.turns` in the human summary but spreads the terminal `num_turns` into
    ledger `turnsUsed`.

## Existing token data path

1. `accumulateCastProgress` charges only the first assistant event for each nested message ID.
2. The charge uses `countTokens`, the canonical weighted formula from `src/budget/budget.ts`.
3. The weights are input 1.0, output 5.0, cache read 0.1, cache creation 1.25.
4. User, system, rate-limit, result, malformed, unknown, and duplicate assistant events are no-ops.
5. The terminal `result.usage` is deliberately skipped as cumulative rather than incremental.
6. `formatCastProgress` rounds the accumulated value to a human whole-thousands label.
7. At settlement, budget checking and the ledger consume the terminal result usage.
8. `src/log/run-log.ts#totalTokens` mirrors the same four weighting factors.

## Prior characterization

- `T-072-04-01` established that Claude's `--max-turns` and terminal `num_turns` are unlike units.
- Three earlier ordinary transcripts showed `num_turns = 1 + user/tool-result records` while
  distinct assistant IDs stayed below the cap.
- `T-077-01-01` pinned that relationship through the real argv/cast shell using a stub transcript.
- `T-077-03-02` made the live denominator use the deduplicated assistant-ID count.
- Those tickets did not characterize embedded sidechain/subagent traffic.
- They also deliberately preserved `turnsUsed` as terminal `num_turns` for compatibility.

## 45-turn evidence transcript

The anomalous transcript is:

`run-2026-07-13T14-39-35-941Z`

It is a successful decompose of E-077 and has 522 JSONL lines. The real ledger row is line 32 of
`.vend/runs.jsonl`. That row records `turnsUsed: 2`, because the cast shell retained only the last
terminal result's `num_turns`.

Raw top-level message counts are:

| Type | Rows |
|---|---:|
| assistant | 156 |
| user | 81 |
| system | 278 |
| result | 5 |
| rate_limit_event | 2 |
| total | 522 |

The 156 assistant rows collapse to exactly 45 unique nested assistant message IDs. Splitting on
the top-level `parent_tool_use_id` yields:

| Stream class | Assistant rows | Unique assistant IDs | Source line span |
|---|---:|---:|---|
| parent/main (`parent_tool_use_id = null`) | 25 | 12 | 14–515 |
| sidechain `toolu_019…` | 16 | 4 | 21–232 |
| sidechain `toolu_015bd…` | 34 | 9 | 51–348 |
| sidechain `toolu_01P…` | 38 | 11 | 71–331 |
| sidechain `toolu_0155…` | 43 | 9 | 100–336 |
| all | 156 | 45 | 14–515 |

Thus the live numerator is exactly `12 main + 33 sidechain = 45`. The 15-turn configured cap
belongs to the parent dispense. Sidechain work has its own executor loops but the current fold
places all their assistant IDs into the parent's one flat set.

The transcript appends five result records at lines 518–522. Their `num_turns` values are
`10, 1, 1, 1, 2`; they sum to 15, not 45. All five lack `parent_tool_use_id`, so they cannot be
reliably assigned to the four sidechain labels from that field alone. The final line 522 is the
parent result Vend consumes, and it reports 2.

This distinguishes three real numbers that the signal had conflated:

- 45 = all unique assistant IDs admitted by the current flat fold;
- 12 = unique assistant IDs carrying no sidechain parent marker;
- 2 = final parent terminal `num_turns` stored in the ledger.

The raw transcript therefore refutes any reading that 45 itself came from terminal `num_turns`.
It came from sidechain-blind assistant-ID deduplication.

## Sidechain inflation verdict

Sidechain assistant IDs do inflate `progress.turns` in the evidence run.

- Current fold result: 45.
- Main-only replay: 12.
- Sidechain contribution: 33.
- Inflation over the parent-only observable: 275% of main-only, or 73.3% of the displayed 45.
- The main-only observable remains below the configured cap of 15.
- Removing only records with non-null `parent_tool_use_id` resolves the apparent 45/15 breach on
  this transcript without clamping or changing the cap.

## Token-gap evidence transcript and ledger

The token evidence is the canonical steer run:

`run-2026-07-13T17-07-45-166Z`

The transcript has 212 lines. Its real ledger row is line 33 of `.vend/runs.jsonl` and records:

| Bucket | Terminal ledger usage | Weight | Weighted contribution |
|---|---:|---:|---:|
| input | 2,994 | 1.0 | 2,994.00 |
| output | 22,026 | 5.0 | 110,130.00 |
| cache read | 416,183 | 0.1 | 41,618.30 |
| cache creation | 47,903 | 1.25 | 59,878.75 |
| total | | | 214,621.05 → 214,621 |

The live fold sees 35 assistant rows but only nine unique message IDs. The first-event buckets
summed across those nine IDs are:

| Bucket | Folded usage | Weight | Weighted contribution |
|---|---:|---:|---:|
| input | 2,994 | 1.0 | 2,994.00 |
| output | 63 | 5.0 | 315.00 |
| cache read | 416,183 | 0.1 | 41,618.30 |
| cache creation | 47,903 | 1.25 | 59,878.75 |
| unrounded total | | | 104,806.05 |

Because `countTokens` rounds each accepted assistant message before the outer sum, the exact
production replay is 104,807. `formatCastProgress` renders that as `105k`, matching the field
report. The terminal ledger calculation rounds once to 214,621, rendered informally as ~214k.
The live/ledger ratio is 0.4883; the ledger is 2.048× the live figure.

## Per-ID first-versus-final census

The nine accepted message IDs occupy lines 22–29, 38–41, 51–57, 61–65, 71–73, 75, 80–84,
96–100, and 209–210. For every one of the nine IDs, the first assistant row and final assistant
row carry byte-equivalent four-bucket usage values.

Therefore first-event deduplication contributes zero to this particular run's numeric gap:

- first-event fold: 104,807 after per-message rounding;
- final-event-per-ID fold: 104,807;
- difference: 0.

This is still a load-bearing fixture fact. Replacing “first event” with “last event” alone cannot
close the observed ~2× gap.

## Skipped-kind and terminal-residual census

The missing bucket is output only:

- input residual: 0;
- cache-read residual: 0;
- cache-creation residual: 0;
- output residual: `22,026 - 63 = 21,963` tokens;
- weighted residual: `21,963 × 5 = 109,815`;
- `104,806.05 + 109,815 = 214,621.05` exactly.

The transcript contains 150 skipped `system/thinking_tokens` records from lines 6–208. Summing
their `estimated_tokens_delta` gives 15,419 output-like tokens. That explains 77,095 weighted
units of the residual.

After accounting for those explicit thinking deltas, terminal-only output still contributes:

- `21,963 - 15,419 = 6,544` output tokens;
- `6,544 × 5 = 32,720` weighted units.

Thus the complete reconciliation is:

`104,806.05 folded assistant usage`
`+ 77,095 skipped thinking deltas`
`+ 32,720 terminal-only output residual`
`= 214,621.05 terminal weighted usage`.

The skipped terminal result is the only record that already carries the authoritative complete
four-bucket figure. The current fold's no-op treatment of result messages preserves correctness
against double-counting only if some other event contains a complete cumulative snapshot; this
transcript shows that no assistant event does.

## Constraints carried into Design

- A fixture must retain the `parent_tool_use_id` split; flattening it would erase the turn cause.
- A turn fixture must preserve 12 main and 33 sidechain unique IDs, with usage objects so the real
  accumulator accepts the records.
- A token fixture must preserve the nine accepted assistant snapshots, skipped thinking aggregate,
  and terminal usage so both 104,807 and 214,621 are replayable.
- Sanitized fixtures must omit prompts, generated prose, file contents, session UUIDs, and tool
  payloads.
- The spike should not edit `cast-core.ts`, `cast.ts`, or `run-log.ts`; those belong to the two
  dependent implementation stories.
- No source test should prematurely choose the later fix policy.

## Worktree state

- `docs/active/tickets/T-081-01-01.md` is already modified by Lisa's phase/lease machinery.
- That file is not ticket implementation work and must not be included in a ticket commit.
- The attempt work directory contains only Lisa launch/assignment files plus this phase artifact.
- Phase artifacts and evidence fixtures must remain under the private attempt path; Lisa publishes
  admitted artifacts to `docs/active/work/T-081-01-01/` after lease verification.
