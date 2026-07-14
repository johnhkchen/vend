# Progress — T-074-01-03

## Status

Implementation complete and committed.

Source commit:

```text
6f280182c0755905ba3e0cf919e0c445f52f3644
feat(engine): andon unreachable executor at cast time (T-074-01-03)
```

The commit was created only through `lisa commit-ticket` with four exact include paths.

No ordinary `git add`, `git add -A`, or `git commit` was used.

## Completed — Research

Read the assignment, AGENTS instructions, RDSPI workflow, canonical vision, parent story, ticket,
charter, dependency-ticket artifacts, executor boundary, cast core/shell, tests, doctor consumer,
and run-log contract.

Mapped the established required-MCP missing-capability early return and the exact place executor
selection previously flowed directly into `dispense()`.

Confirmed `Executor.probe()` is required, structured, shallow, unmetered, and implemented by both
built-in executors.

Confirmed `RunOutcome` and `RunSummary` already support `missing-capability`, so no persistence or
public result schema expansion was needed.

Wrote `research.md` to the attempt-private work directory.

## Completed — Design

Chose the existing pure `classify` function as the terminal judgment boundary.

Designed an optional `executorProbe` classifier input so current callers remain source-compatible
and an ok probe is inert.

Placed the non-ok probe branch ahead of timeout/gate/budget classification because no dispense is
authorized and play gates never run.

Designed the impure shell to probe the exact selected instance before render/transcript/dispense,
render the structured reason/hint, append one zero-spend record, and return immediately.

Rejected catching arbitrary dispense errors, reusing doctor, probing in selector construction,
fabricating gate evidence, and expanding the run-log schema.

Wrote `design.md` to the attempt-private work directory.

## Completed — Structure

Limited the source/test change to:

- `src/engine/cast-core.ts`;
- `src/engine/cast-core.test.ts`;
- `src/engine/cast.ts`;
- `src/engine/cast.test.ts`.

Specified the type-only dependency, classifier branch, moved resolution block, early append/return,
total detail formatter, and end-to-end fixture.

Wrote `structure.md` to the attempt-private work directory.

## Completed — Plan

Sequenced test-first classifier and integration regressions, implementation, focused verification,
scope inspection, full gate, Lisa commit, and review.

Defined the acceptance matrix for terminal priority, no dispense/effect, named cause/hint,
exactly-once persistence, zero spend, no transcript, passing-probe inertness, and repository gate.

Wrote `plan.md` to the attempt-private work directory.

## Completed — test-first red

Added a pure classifier case with:

- a non-ok executor probe;
- timeout set true;
- an exhausted budget;
- a stopped play gate.

The initial run correctly failed because the old classifier returned `timed-out` rather than
`missing-capability`.

Added a cast integration case whose failing probe returns the exact config-store/Keychain cause and
repair hint. Its `dispense()` throws if called.

The initial run correctly failed by reaching `dispense()`, proving the existing shell had no probe
gate.

Focused red evidence:

```text
82 pass
2 fail
276 assertions
```

The two failures were exactly the new classifier and cast refusal cases.

## Completed — pure core

Added a type-only import of `ExecutorProbeResult` to `cast-core.ts`.

Added optional `executorProbe` to `ClassifyInput`.

Added the first-priority non-ok branch returning:

```ts
{
  outcome: "missing-capability",
  materialize: false,
  gateLog: [],
}
```

The empty gate log is deliberate because play gates have not run.

An ok or absent result falls through all existing timeout/gate/budget branches unchanged.

The success regression now explicitly passes `{ ok: true }` and retains its original verdict.

## Completed — cast shell

Moved exact executor resolution to immediately after required-MCP resolution.

Preserved selection precedence: an injected instance wins, otherwise the existing id/env selector
is used.

Mapped execution seat from the exact selected instance and called its `probe()` once.

Fed the structured result into the pure classifier with neutral downstream facts.

On `missing-capability`, the shell now:

- renders one amber andon line;
- names the executor id;
- includes the trimmed probe reason;
- includes the trimmed actionable hint;
- falls back to stable actionable text if either optional field is blank;
- appends one run record;
- records empty usage, zero cost, and empty gate evidence;
- records a known execution seat when available;
- returns `materialized: false` with empty actual usage;
- returns before prompt render, transcript setup, dispense, parse, gates, effect, cross-review, and
  terminal append.

The normal post-dispense classifier receives the same successful probe result. Because the pure
branch is inert on ok, all prior post-dispense outcome behavior is unchanged.

## Completed — integration proof

The new cast test proves:

- probe called exactly once;
- dispense called zero times;
- effect called zero times;
- missing-capability summary;
- false materialization;
- empty summary usage;
- stdout contains the andon, executor id, exact reason, and exact hint;
- stdout contains no `Error:` stack header;
- transcript file does not exist;
- run log has exactly one line;
- record outcome is missing-capability;
- all four normalized usage counters are zero;
- cost is zero;
- gate results are empty;
- the known Claude execution seat is recorded.

The pre-existing successful stub cast remains green, proving the successful probe falls through the
full parse/gate/effect/log path.

## Focused green evidence

Command:

```bash
bun test src/engine/cast-core.test.ts src/engine/cast.test.ts
```

Result:

```text
84 pass
0 fail
297 assertions
```

## Scope inspection

`git diff --check` passed for all four ticket-owned paths.

Pre-commit scoped diff:

```text
src/engine/cast-core.test.ts | 19 lines changed
src/engine/cast-core.ts      |  8 lines changed
src/engine/cast.test.ts      | 62 lines changed
src/engine/cast.ts           | 67 lines changed
4 files changed, 142 insertions, 14 deletions
```

The deletions are the executor resolution/seat block moved earlier in `cast.ts`; the dispense
option construction itself was not altered.

No executor implementation, doctor, run-log, budget, funding, shelf, CLI, or configuration file
was changed.

## Full gate evidence

Command:

```bash
bun run check
```

Result:

```text
BAML generation: pass
TypeScript: pass
1723 pass
1 skip
0 fail
5324 assertions
```

The skip is the existing release-acceptance integration requiring built `dist/` artifacts.

No generated diff remained after BAML generation.

## Commit transaction

Command used:

```bash
lisa commit-ticket \
  --ticket-id T-074-01-03 \
  --message "feat(engine): andon unreachable executor at cast time (T-074-01-03)" \
  --include src/engine/cast-core.ts \
  --include src/engine/cast-core.test.ts \
  --include src/engine/cast.ts \
  --include src/engine/cast.test.ts
```

Returned commit:

```text
6f280182c0755905ba3e0cf919e0c445f52f3644
```

`git show --name-only` confirms exactly the four planned files are in the commit.

All four ticket-owned source/test paths are clean after the transaction.

## Deviations from plan

No functional deviation.

The plan allowed either a private formatter or tightly scoped inline construction. Implementation
used the private `executorProbeDetail` helper to keep optional-field fallback behavior centralized.

The run record includes `seatOfExecution` for a known selected executor. This was planned and keeps
the selected/probed lane auditable even though usage is zero.

## Working-tree ownership

The remaining modified/untracked paths are Lisa-controlled publication/transition state:

- `.lisa/provenance.jsonl`;
- `docs/active/tickets/T-074-01-03.md`;
- `docs/active/work/T-074-01-03/`.

They were not edited by the implementation patches, staged, committed, reverted, or included in
the ticket source transaction.

## Remaining

Write `review.md` and stop on this ticket.

No source work remains.
