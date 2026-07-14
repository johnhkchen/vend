# Progress — T-081-01-01

## Status

Implementation evidence and full repository verification are complete.

## Phase completion

| Phase | Artifact | Status |
|---|---|---|
| Research | `research.md` | complete |
| Design | `design.md` | complete |
| Structure | `structure.md` | complete |
| Plan | `plan.md` | complete |
| Implement | `progress.md`, `root-cause.md`, fixtures | complete |
| Review | `review.md`, `review-disposition.json` | pending |

## Implemented artifact set

Created:

- `root-cause.md` — primary acceptance note;
- `fixtures/README.md` — provenance, sanitization, expected replay;
- `fixtures/turn-sidechain-excerpt.jsonl` — 45 assistant-ID census plus five terminal results;
- `fixtures/token-spend-excerpt.jsonl` — nine-ID endpoint census, thinking aggregate, terminal usage.

No production source or test file was changed.

## Turn evidence extraction

Source:

- `.vend/transcripts/run-2026-07-13T14-39-35-941Z.jsonl`;
- `.vend/runs.jsonl` line 32.

Observed:

- 522 source transcript rows;
- top-level counts: 156 assistant, 81 user, 278 system, five result, two rate-limit;
- 45 unique nested assistant IDs;
- 12 null-parent/main IDs;
- 33 non-null-parent/sidechain IDs;
- sidechain group sizes 4, 9, 11, 9;
- terminal result `num_turns` sequence 10, 1, 1, 1, 2;
- real ledger `turnsUsed: 2` from the final result.

Fixture syntax/count receipt:

```text
50 fixtures/turn-sidechain-excerpt.jsonl
assistantRows=45
uniqueIds=45
mainIds=12
sideIds=33
groups=MAIN:12, sidechain-1:4, sidechain-2:9, sidechain-3:11, sidechain-4:9
results=[10,1,1,1,2]
```

## Token evidence extraction

Source:

- `.vend/transcripts/run-2026-07-13T17-07-45-166Z.jsonl`;
- `.vend/runs.jsonl` line 33.

Observed:

- 212 source transcript rows;
- 35 assistant rows / nine unique IDs;
- first and last four-bucket usage are identical for all nine IDs;
- 150 system thinking-token records, summed delta 15,419;
- terminal result at source line 212;
- live bucket totals 2,994 input / 63 output / 416,183 cache read / 47,903 cache create;
- terminal totals 2,994 / 22,026 / 416,183 / 47,903;
- output-only residual 21,963;
- post-thinking terminal residual 6,544.

Fixture syntax/count receipt:

```text
19 fixtures/token-spend-excerpt.jsonl
assistantRows=17
uniqueIds=9
thinkingAggregate=15419 across 150 source rows
terminal num_turns=20
```

## Production-function replay

Both fixtures were parsed and replayed with an ephemeral Bun command importing:

- `src/engine/cast-core.ts#accumulateCastProgress`;
- `src/engine/cast-core.ts#EMPTY_CAST_PROGRESS`;
- `src/budget/budget.ts#countTokens`.

Receipt:

```json
{"turnsAll":45,"turnsMain":12,"spendTurns":9,"spendWeighted":104807,"terminalWeighted":214621,"endpointDiff":0,"thinkingDelta":15419,"terminalOutputResidual":6544}
```

All assertions passed.

## Source-line cross-check

An independent ephemeral Bun check loaded both real source transcripts and both fixtures.

For the turn fixture it checked:

- every cited assistant line is an assistant source record;
- every retained null/non-null parent class matches the source;
- every cited result line has the retained `num_turns`.

For the token fixture it checked:

- all four retained buckets equal the source at every endpoint line;
- all four terminal buckets equal source line 212;
- the source thinking record count is 150;
- their summed delta equals the fixture's 15,419 aggregate.

Receipt:

```json
{"turnRowsCrossChecked":50,"tokenRowsCrossChecked":19,"thinkingRowsCrossChecked":150}
```

## Sanitization check

Searched both fixture files for:

- `msg_`;
- `toolu_`;
- `session_id`;
- `request_id`;
- `uuid`;
- `signature`;
- `content`;
- absolute `/Users/` paths.

No match was found.

## Deviations from Plan

No material deviation.

One wording correction was made explicit in the root-cause note: the signal's “45” shorthand is
not terminal `num_turns`. The transcript proves 45 is the flat assistant-ID fold; the five result
`num_turns` values total 15 and the final parent result is 2. Reporting that distinction is
required for an honest reconciliation rather than preserving the premise's ambiguous noun.

## Commit handling

No `lisa commit-ticket` call was made because the spike created no repository source unit outside
the private attempt work directory. The assignment explicitly reserves publication of admitted
attempt artifacts for Lisa after lease verification. Ordinary git staging and commits were not
used.

Lisa's modification to `docs/active/tickets/T-081-01-01.md` remains untouched and excluded.

## Full repository gate

Command:

```bash
bun run check
```

Receipt:

```text
baml-cli generate --from baml_src
Generated 14 baml_client files with CLI 0.223.0
tsc --noEmit
bun test v1.3.13
1941 pass
1 skip (declared release acceptance test: no dist artifacts)
0 fail
6376 expect() calls
1942 tests across 126 files
```

Exit status: 0.

The generated BAML client remained clean. `git diff --check` also passed.

## Worktree ownership after gate

`git status --short` showed only:

- Lisa's modified `docs/active/tickets/T-081-01-01.md`;
- Lisa's watcher-created `docs/active/work/T-081-01-01/` publication directory.

The published Research, Design, Structure, and Plan files were checksum-identical to their private
attempt sources when inspected. The shared directory was not edited or staged manually.

## Remaining

1. Write `review.md`.
2. Write exact `review-disposition.json`.
3. Stop on this ticket.
