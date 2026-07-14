# Review — T-079-01-02

## Verdict

Pass. `vend settle` is now a bare free CLI gesture that observes the canonical board, current
repository gate, canonical presweep, and structured work-review dispositions; delegates verdict
judgment to the committed settle core; prints the required one-screen result; and atomically advances
`.vend/last-settle.json`.

The fixture acceptance exits 0, shows all required facts, colors its named exception red with an exact
next action, leaves a preexisting `.vend/runs.jsonl` byte-identical, never invokes the configured
executor sentinel, and reports an empty delta on an immediate repeat.

The implementation is committed and all gates are green.

## Commit

```text
7ad2089abadb759b262d061c4cb7108183f95176
feat(settle): add free one-screen verdict command
```

Created with `lisa commit-ticket` and exactly these repository-relative includes:

- `src/settle/settle.ts`;
- `src/settle/settle.test.ts`;
- `src/cli.ts`;
- `src/cli.test.ts`.

Commit stat: 4 files changed, 700 insertions, 1 deletion. No ordinary-index commit command was used.
Exact ticket-owned status is clean after commit.

## Files changed

### Created: `src/settle/settle.ts`

This is the thin effect shell and pure presentation boundary over T-079-01-01's committed core.

It adds:

- `reviewConcernFromDisposition`, the strict pure parser for Lisa's stable pass/block artifact;
- `runSettle`, the cwd/root-injectable observation and marker-publication effect;
- `renderSettleResult`, the deterministic newline-terminated terminal formatter;
- ANSI red/reset constants used to pin exception coloring.

Its effects are deliberately narrow:

- canonical board read through `loadWorkGraph`;
- optional last-settle marker read;
- work-directory disposition discovery;
- current `bun run check` subprocess;
- Git porcelain read;
- one atomic marker write under `.vend`.

It imports no play, executor, budget, funding, or run-log module.

### Created: `src/settle/settle.test.ts`

Adds ten focused tests covering strict disposition parsing and the terminal grammar:

- pass -> no concern;
- reasoned block -> named concern and exact action;
- malformed present artifacts -> visible repair concern;
- delta/epic/gate/presweep/review lines;
- ANSI red/reset on every ordered exception;
- verbatim next actions;
- immediate-repeat empty delta;
- explicit no-concern/no-exception lines;
- typed malformed-marker refusal.

### Modified: `src/cli.ts`

Adds settle to:

- the free usage group;
- `ParsedCommand`;
- canonical verb suggestions;
- `parseArgs` routing;
- a dedicated no-argument parser;
- a lazy, executor-free dispatch arm.

The parser rejects every trailing argument, including `--budget`. The dispatch emits valid verdicts
to stdout with exit 0, typed marker refusals to stderr with exit 1, and concise operational errors to
stderr with exit 1.

### Modified: `src/cli.test.ts`

Adds parser/help coverage and a real fixture-repository subprocess acceptance test. The fixture uses
canonical board Markdown, a committed Git baseline, a deterministic seven-test repository gate, a
blocked structured review disposition, a Claude sentinel, and a preexisting run-ledger sentinel.

No file was deleted. No graph, presweep, settle-core, executor, run-log, board, hook, or seam source
was modified by this ticket.

## Design assessment

### Current gate truth

The shell runs `bun run check` inline and suppresses its multiline output into one current gate line.
This was chosen because the repository has no durable recorded repository-gate result. Cast-local
gate rows and old review prose cannot honestly establish current green state.

A parseable Bun `<n> pass` count becomes `<n> tests`; otherwise a successful command still reports
`bun run check passed`. Failure becomes typed gate data with the exact rerun/repair action. The gate
uses wall time but no tokens, preserving the story's definition of free.

### Canonical presweep

The shell does not parse `check:presweep` terminal text. It obtains one Git porcelain snapshot and
reuses `donePhaseIds` plus `classifySweep`, preserving phase-done authority and existing source/board
scope. Git runs after the repository gate completes so transient gate activity cannot be observed.

### Structured review concerns

Only present `review-disposition.json` artifacts are authoritative:

- canonical pass contributes nothing;
- reasoned block contributes its reason by name;
- malformed present data contributes a visible repair concern;
- missing legacy disposition is ignored.

`review.md` prose is intentionally not classified. It mixes blockers, limitations, future ideas,
and honest boundaries under varying headings; promoting those bullets would add new judgment the
epic explicitly forbids.

### Marker safety

The shell persists only the pure verdict's `nextMarker`. It uses an exclusive unique sibling temp
file and atomic rename. A malformed prior marker returns a typed refusal and is left untouched. Gate,
presweep, or review exceptions still advance the frontier because the board delta remains a valid
observation.

## Acceptance mapping

| Acceptance clause | Result | Evidence |
|---|---|---|
| Fixture `vend settle` exits 0 | Met | Real CLI subprocess assertion, first and second invocation |
| Delta line | Met | First output: `delta: first settle — T-900-01` |
| Per-epic cleared line | Met | First output: `epic: E-900 — 1/2 cleared` |
| Gate line | Met | Fixture gate output summarized as `gate: green — repository gate: 7 tests` |
| Presweep line | Met | Committed fixture reports one done ticket/source+board committed |
| Review concerns by name | Met | `T-900-01 — missing release proof` |
| Exceptions in red | Met | Exact ANSI prefix/reset asserted around the review exception |
| Exact next action | Met | Full record-passing instruction asserted byte-for-byte |
| Runs ledger untouched | Met | Preexisting sentinel bytes compared after both invocations |
| No executor invoked | Met | Configured sentinel file remains absent after both invocations |
| Marker advances | Met | Canonical version-1 marker bytes asserted after first invocation |
| Immediate repeat empty | Met | Second output contains `delta: none since last settle` |
| No `--budget` | Met | Exact parser usage result plus free-only help inventory |

## Test evidence

### Dependency baseline

```text
bun test src/settle/settle-core.test.ts
14 pass, 0 fail, 44 assertions
```

### Focused pre-commit and post-commit verification

```text
bun test src/settle src/cli.test.ts
153 pass, 0 fail, 460 assertions across 3 files
```

The same result passed after commit from HEAD.

### Type and whitespace checks

```text
bun run check:typecheck
exit 0

git diff --check -- <four ticket paths>
exit 0
```

### Full repository gate

```text
bun run check
exit 0
```

Results:

- BAML generation: green, 14 generated files;
- TypeScript: green;
- full Bun suite: 1,886 pass, 1 pre-existing integration skip, 0 fail;
- 6,089 assertions across 124 files.

## Pure-core / impure-shell assessment

The boundary holds:

- `settle-core.ts` remains the sole delta/clearance/exception/marker judge;
- `presweep-core.ts` remains the sole dirty-scope judge;
- `graph/load.ts` remains the sole board loader;
- `reviewConcernFromDisposition` and `renderSettleResult` are pure over plain values;
- `runSettle` is the thin world-touching composition;
- CLI only parses, routes, prints, and chooses the process exit.

The shell does not mutate the board or shared work artifacts. The only mutation is the durable local
continuation the story requires.

## Open concerns and limitations

1. **Inline gate latency is intentional.** `vend settle` reruns the full repository gate because no
   trustworthy current recorded result exists. On this repository that means several seconds rather
   than an instant readout. It remains token-free and honest. A future durable gate-result contract
   could replace the subprocess without changing the settle core.
2. **“One screen” is compact, not capped.** The renderer emits one line per epic and exception. A
   very large board may exceed a physical terminal viewport, but the command remains one finite
   print-and-exit result with no dashboard/pager state. Truncation would hide contract facts and was
   not introduced.
3. **Review prose is deliberately not machine-classified.** Pass reviews may document nonblocking
   limitations in Markdown; settle names only structured blocked/malformed dispositions. If richer
   concern reporting becomes necessary, the review artifact needs an authored structured concern
   schema first.
4. **Fixture-only boundary remains honest.** The test proves the complete command on a local
   repository but does not claim a live Lisa loop was observed. Event triggering is S-079-03.
5. **Operational Git/board/filesystem failure is distinct from verdict exceptions.** Such failures
   exit 1 without marker advancement because the shell could not honestly observe all required
   facts. They are covered by the concise CLI catch path, though the ticket's acceptance fixture is
   the green environment path.

None is blocking. No TODO or critical issue requires human attention.

## Final disposition

All acceptance clauses are met, the full gate is green, the source unit is committed with exact Lisa
includes, ticket-owned source paths are clean, and the remaining limitations stay within the story's
stated honest boundary. Ready for Lisa completion publication.
