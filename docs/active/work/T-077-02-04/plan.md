# Plan — T-077-02-04 degrade-on-run-record

## Implementation sequence

### 1. Establish baseline and path ownership

- Record `git status --short` for the relevant source paths.
- Confirm no ticket-owned path is already modified by a concurrent ticket.
- Run the focused current advances, run-log, bare-code cast, and CLI tests if the shared tree is
  stable enough.
- Do not clean or stage unrelated changes.

Verification:

- relevant paths are clean before edits;
- baseline failures, if any, are identified as pre-existing/concurrent before implementation.

### 2. Add the pure advances report

- Import the canonical `DegradeDisposition` type into `decompose-epic-core.ts`.
- Add `AdvanceNormalization`.
- Implement `stripNonGoalAdvancesWithDispositions` by extending the existing ticket/index walk.
- Emit exact `strip` records for N-shaped removals and shared-classifier degradations.
- Preserve current plan identity behavior below the top-level plan, occurrence ordering, and input
  immutability.
- Reimplement `stripNonGoalAdvances` as the plan projection of the new report.

Tests:

- mixed known/non-goal/dangling input returns expected plan and records;
- duplicate occurrences retain indexed locations;
- clean input returns no dispositions;
- source plan stays unchanged;
- all existing plan-only tests remain green.

Focused command:

```bash
bun test src/play/decompose-epic.test.ts
```

### 3. Wire the concrete decompose play

- Change the concrete play output type to the normalization report.
- Parse once and return the report.
- Gate only `report.plan`.
- Materialize only `report.plan`.
- On successful effect completion, merge advances records before inline materializer records.
- Omit the effect field when the merged array is empty.
- Preserve failed effect outcomes without presenting them as cleared degradation.

Verification:

- `bun run build` proves registry/chain/probe/shelf consumers still accept the changed concrete
  output type;
- no BAML-generated file changes appear.

### 4. Add durable ledger normalization

- Define ledger-owned degradation action and disposition structural types.
- Extend `RunRecordInput` and `RunRecord` with the optional list.
- Add one atomic pure normalizer.
- Call it from `buildRunRecord` and `reviveRecord`.
- Canonically copy valid records and omit absent, empty, non-array, or partially malformed data.
- Keep the schema version unchanged.

Tests:

- exact mixed-action list survives build/serialize/readRuns;
- revived serialization is stable;
- absent and empty input preserve baseline bytes;
- extra nested properties do not persist;
- one malformed item omits the entire optional list but retains the run row;
- historical records still load without the field.

Focused command:

```bash
bun test src/log/run-log.test.ts
```

### 5. Thread effect data through the generic engine

- Extend `EffectResult` with the optional ledger-owned structural list.
- Extend `RunSummary` with the same optional list.
- Capture a nonempty effect report as soon as the effect result is observed.
- Spread it into the terminal append input.
- Spread it into the returned summary.
- Keep early refusals and effects with no records byte-compatible.
- Retain the data if later settlement presentation/capture work runs, without changing outcome
  precedence.

Verification:

- typecheck all generic plays;
- existing cast tests remain green;
- no concrete play import enters `src/engine` or `src/log`.

Focused command:

```bash
bun test src/engine/cast.test.ts src/log/run-log.test.ts
```

### 6. Upgrade the story-specific end-to-end fixture

- Change the addon-free decompose-shaped fixture to use the report-producing advances normalizer.
- Gate and materialize the report's plan.
- Return the merged advances and inline dispositions through `EffectResult`.
- Add a dangling advances cite that can be stripped while a valid advance keeps the ticket valuable.
- Assert successful materialization and annotated/stripped artifacts.
- Assert exact ordered data on `RunSummary`.
- Load the actual ledger with `loadRunLog` and assert the same exact data.
- Retain the structural missing-contract contrast and assert no marker appears.

Focused command:

```bash
bun test src/play/bare-code-cast.test.ts
```

### 7. Centralize the operator summary line

- Add a pure `formatRunSummaryLine` helper.
- Render degraded success as the exact `cleared; N cite(s) degraded` phrase.
- Retain the current output for clean success and failures.
- Replace every repeated CLI summary template with the helper.

Tests:

- degraded success exact string;
- count reflects list length;
- clean success and gate failure remain byte-compatible.

Focused command:

```bash
bun test src/cli.test.ts
```

### 8. First integrated verification

Run:

```bash
bun test src/play/decompose-epic.test.ts src/log/run-log.test.ts src/engine/cast.test.ts src/play/bare-code-cast.test.ts src/cli.test.ts
bun run build
git diff --check -- <ticket-owned paths>
```

Inspect:

- exact field names and ordering in serialized JSON;
- summary phrase spelling and punctuation;
- no unintended outcome, gate, BAML, or generated changes;
- no changes to unrelated dirty paths.

### 9. Commit meaningful source units through Lisa

Commit only after the relevant tests are green. Use commands shaped as:

```bash
lisa commit-ticket T-077-02-04 -m "..." --include <exact-path> ...
```

Before invoking, inspect `lisa commit-ticket --help` to confirm local CLI argument ordering.

Planned source units:

1. advances report and concrete play wiring;
2. durable ledger plus generic effect/cast transport;
3. end-to-end fixture plus operator summary formatter.

Do not include:

- `.lisa/provenance.jsonl`;
- ticket frontmatter;
- concurrent ticket changes;
- private attempt artifacts, unless Lisa explicitly owns them outside the source commit flow.

After each commit:

- inspect `git show --stat --oneline HEAD`;
- inspect `git status --short -- <included paths>`;
- ensure included paths are clean and no ticket file is staged.

### 10. Full gate

Run the repository gate from the shared current tree:

```bash
bun run check
```

If the gate fails:

- distinguish ticket regression from concurrent unrelated work using focused tests and diff/path
  ownership;
- fix only ticket-owned regressions;
- rerun focused checks before the full gate;
- never modify or discard another ticket's changes.

The ticket cannot receive a pass disposition unless the full gate is green, per AGENTS.md.

### 11. Final audit

- Read every committed diff for the ticket.
- Confirm acceptance literally:
  - a degrade cast materializes;
  - the exact ordered dispositions are in `runs.jsonl`;
  - `loadRunLog` revives them;
  - the final line says `cleared; N cite(s) degraded`;
  - structural defects still refuse.
- Confirm clean casts omit the new field.
- Confirm all ticket-owned source paths are committed and clean.
- Confirm no ordinary git index command was used.
- Record exact checks, commit ids, deviations, and remaining concerns in `progress.md`.

### 12. Review artifacts

- Write `review.md` with scope, file list, test evidence, acceptance matrix, compatibility, honest
  boundary, worktree hygiene, and open concerns.
- Write exactly one `review-disposition.json` object.
- Use pass only if implementation, commits, focused tests, full gate, and acceptance all succeed.
- Otherwise use block with a concrete actionable reason.
- Remain on this ticket and stop after Review; Lisa owns completion publication and seat release.

## Testing strategy summary

| Layer | Proof |
|---|---|
| Pure policy | advances normalizer emits exact occurrence records without mutation |
| Pure persistence | optional array normalizes, serializes, revives, and tolerates malformed history |
| Generic integration | effect data reaches terminal ledger and `RunSummary` |
| Concrete integration | advances and inline branches merge in lifecycle order |
| Operator presentation | exact degraded-clear phrase derives from returned records |
| Structural contrast | missing story contract still stops before effect and writes no marker |
| Repository | BAML codegen, strict typecheck, and full suite through `bun run check` |

## Risk controls

- Preserve the plan-only API to contain type migration.
- Use structural duck typing across play/engine/log boundaries.
- Normalize arrays atomically to keep counts honest.
- Omit empty optional fields for byte compatibility.
- Keep outcome taxonomy unchanged.
- Use the existing end-to-end stub executor so acceptance spends no tokens.
- Commit exact paths only through Lisa in a concurrent dirty worktree.

## Planned completion condition

The ticket is ready for pass only when the occurrence-level data produced by both appliers is the
same data returned by the cast, serialized in its one terminal row, revived by `loadRunLog`, and
counted in the exact operator summary phrase, while the structural contrast remains red and the
repository gate is green.
