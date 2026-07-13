# Structure — T-072-04-01

## Modified source files

### `src/engine/cast-core.ts`

- Add a small plain-value input interface for final turn-summary formatting.
- Add an exported pure `formatTurnSummary` function.
- Keep unit labels explicit:
  - `agent turns` for deduplicated assistant/model responses;
  - `agent-turn cap` for `maxTurns`;
  - `executor conversation events` for terminal `num_turns`/`turnsUsed`.
- Permit a same-unit fraction only when `agentTurns <= maxTurns`.
- Render anomalous over-cap observations as separately labeled values rather than a fraction.
- Return `undefined` only when neither an observed agent count nor an executor result count exists.

This remains in the pure core because formatting is judgment over plain values and needs direct unit coverage.

### `src/engine/cast-core.test.ts`

- Import `formatTurnSummary`.
- Add a focused test block for the final settlement formatter.
- Pin the evidence-shaped characterization (`agentTurns: 9`, `maxTurns: 15`, `executorReportedTurns: 18`).
- Assert the executor number remains visible but never shares the cap denominator.
- Pin the defensive over-cap branch and assert it cannot emit `18 / 15 cap`.
- Cover uncapped/absent-counter shapes as appropriate to make the formatter total and stable.

### `src/engine/cast.ts`

- Import `formatTurnSummary` from the pure core.
- Replace the inline terminal `· turns:` construction.
- Pass `progress.turns`, resolved `maxTurns`, and validated `turnsUsed` into the formatter.
- Write the line only when the formatter returns one.
- Keep ledger persistence of `turnsUsed` unchanged.

## Attempt artifacts

All phase artifacts belong under:

`.lisa/attempts/T-072-04-01/1/work/`

Files:

- `research.md`
- `design.md`
- `structure.md`
- `plan.md`
- `progress.md`
- `review.md`

Lisa publishes admitted artifacts later. Nothing is written directly to `docs/active/work/T-072-04-01/`.

## Files deliberately unchanged

- `src/executor/claude.ts`: argv wiring is correct; the bug is not flag omission.
- `src/executor/claude.test.ts`: its existing tests already pin the passed flag.
- `src/play/decompose-epic-core.ts`: cap judgment remains 15.
- `src/play/decompose-epic.test.ts`: the pin remains valid.
- `src/log/run-log.ts`: raw executor `num_turns` remains preserved as `turnsUsed`.
- `.vend/runs.jsonl` and `.vend/transcripts/**`: read-only evidence, not rewritten.
- Concurrent T-072-01-02 paths (`src/cli.ts`, `src/cli.test.ts`, its work artifacts): untouched.

## Dependency direction

- `cast.ts` continues to depend on `cast-core.ts`.
- The core needs no import from the impure shell.
- No executor-specific source import is added beyond the existing stream message type.
- No play-specific dependency enters the generic engine.

## Public interface

Conceptual shape:

```ts
interface TurnSummaryFormat {
  agentTurns?: number;
  maxTurns?: number;
  executorReportedTurns?: number;
}

function formatTurnSummary(values: TurnSummaryFormat): string | undefined;
```

The function assumes inputs already passed their owning validators/accumulators. It formats facts; it does not clamp, normalize, or mutate them.

## Change ordering

1. Add formatter tests first to state the external-semantics characterization and honesty invariant.
2. Add the formatter implementation in the pure core.
3. Wire the impure shell to the formatter without changing persistence.
4. Run focused tests.
5. Run the full project gate.
6. Commit exact ticket-owned source paths through Lisa.
7. Finish progress and review artifacts.

