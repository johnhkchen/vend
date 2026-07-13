# Progress — T-074-02-02 wire counter-time underfunding warning

## Status

Implementation complete. Ticket-owned source and tests are committed. Focused verification,
typecheck, whitespace checks, and the full repository gate are green.

## Phase completion

- Research completed in `research.md`.
- Design completed in `design.md`.
- Structure completed in `structure.md`.
- Plan completed in `plan.md`.
- Implementation completed in two meaningful committed units.
- Review remains the final phase artifact.

## Implemented source unit 1 — shared funding counter

Created `src/shelf/funding-counter.ts`.

The module now exports:

```ts
fundingWarningFor(play, funded, records): string | null
withFundingCounter(play, funded, cast, opts?): Promise<T>
```

`fundingWarningFor`:

- accepts a plain play, funded budget, and already-read records;
- calls `shelfRows([play], records)`;
- uses the existing rarity-to-tier and recalibration path;
- suppresses `confidence.kind === "default"`;
- passes only a measured row envelope to `underfundingWarning`;
- performs no I/O.

`withFundingCounter`:

- defaults to the caller's project root or cwd;
- reads `<root>/.vend/runs.jsonl` through `loadRunLog`;
- emits no output for a null decision;
- emits exactly one newline-terminated warning for a severe measured mismatch;
- writes before invoking the cast callback;
- always invokes the callback;
- returns the callback result unchanged;
- never mutates or replaces the funded budget.

The wrapper accepts injected records and writer effects for addon-free testing. Threshold,
calibration, and message policy are not configurable.

## Implemented source unit 1 tests

Created `src/shelf/funding-counter.test.ts` with eight tests.

Pure decision coverage:

1. 12.5k funded versus three 400k measured successes returns the exact settled warning.
2. no records is cold start and silent;
3. two successes remain below the calibration threshold and silent;
4. 400k funded versus a 400k measured floor is silent;
5. records for a different play do not bleed into the target play.

Wrapper coverage:

6. event order is exact warning write followed by dispatch;
7. warned dispatch executes once and its result returns unchanged;
8. cold start performs no writes and still dispatches;
9. adequate measured funding performs no writes and still dispatches.

The numbered behavioral properties exceed the Bun test count because the main warned-case test
pins ordering, proceed behavior, funded-value preservation, and result passthrough together.

## Source unit 1 verification

Focused command:

```bash
bun test src/shelf/funding-counter.test.ts \
  src/shelf/underfunding-core.test.ts \
  src/shelf/shelf-row.test.ts
```

Result:

```text
32 pass
0 fail
51 expect() calls
```

Full pre-commit gate:

```text
1721 pass
1 skip
0 fail
5302 expect() calls
116 files
```

The skip is the existing release-acceptance integration requiring local `dist/` artifacts.

## Source unit 1 commit

Committed with Lisa's ticket-aware command and exact include paths:

```text
ca184a0576f5748cf2c3cde7672976b8302c6b62
feat(shelf): add shared funding counter
```

Commit paths:

```text
src/shelf/funding-counter.ts
src/shelf/funding-counter.test.ts
```

Commit stat: 2 files created, 172 insertions.

## Implemented source unit 2 — named/pressed dispatch wiring

Modified `src/play/dispatch.ts`.

Behavior now is:

1. registry lookup occurs first;
2. a miss returns the existing `no-play` result immediately;
3. a hit enters `withFundingCounter` with the resolved play and funded budget;
4. `assembleAndCast` is the callback;
5. the existing `ran` result shape is returned unchanged.

Consequences:

- `vend run <play>` reaches the warning seam;
- `vend <selection>` reaches the same seam through its existing `runPlay` call;
- unknown play output remains byte-identical and does not read/print counter state;
- project-root selection is shared by ledger read and cast assembly.

No change was needed in `src/shelf/press.ts` or `press-core.ts`; adding one there would have
duplicated warnings.

## Implemented source unit 2 — Steer wiring

Modified only the Steer branch of `src/cli.ts`.

The branch now:

1. loads the same shared funding-counter wrapper;
2. keeps explicit/default budget selection unchanged;
3. keeps the canonical explicit funding echo unchanged;
4. wraps `castSteer({ budget })` in the counter;
5. keeps summary printing and exit status unchanged.

The resulting output order for the field-report shape is:

```text
funding echo (when --budget was explicit)
underfunding warning
cast/executor output
run summary
```

Cold-start/default-confidence and adequately-funded casts add no bytes.

## Source unit 2 verification

Focused command:

```bash
bun test src/shelf/funding-counter.test.ts src/cli.test.ts src/shelf/press-core.test.ts
bun run build
```

Result:

```text
133 pass
0 fail
236 expect() calls
TypeScript typecheck passed
```

Full pre-commit gate after wiring:

```text
1721 pass
1 skip
0 fail
5302 expect() calls
116 files
```

## Source unit 2 commit

```text
359ec205c20707fa5f8a93ab75c7a4f8b00ac598
feat(cli): warn on measured underfunding before cast
```

Commit paths:

```text
src/cli.ts
src/play/dispatch.ts
```

Commit stat: 2 files changed, 9 insertions, 2 deletions.

## Final committed-state hygiene

- `git diff --check HEAD~2..HEAD` passed.
- Both ticket commits contain only exact planned source paths.
- All four ticket-owned source paths are clean after commit.
- Attempt phase artifacts remain in the private attempt workspace as required.
- Ticket frontmatter was not manually edited.

The worktree still contains concurrent Lisa/other-ticket changes. At final inspection these
included provenance, ticket/work publication, and T-074-01-02 doctor files. They were not edited,
staged, or included by this ticket's commits.

## Deviations from plan

One command-line correction only:

- the plan transcribed the ticket flag as `--ticket`;
- installed Lisa reported the canonical flag is `--ticket-id`;
- both successful commits used `--ticket-id T-074-02-02`.

No source, behavior, scope, file-boundary, or test-plan deviation occurred.

## Remaining

- Write `review.md`.
- Stop on this ticket and await Lisa completion handling.
