# Progress — T-080-01-02 recorder refusal leaves trace

## Status

- Research: complete.
- Design: complete.
- Structure: complete.
- Plan: complete.
- Implement: complete.
- Review: in progress.

## Baseline

- Read `AGENTS.md`, `docs/knowledge/rdspi-workflow.md`, and `docs/knowledge/vision.md`.
- Read parent story `S-080-01` before the ticket implementation.
- Read ticket `T-080-01-02`, charter, epic, dependent ticket, seam contract, producer, hook, and tests.
- Confirmed `lisa commit-ticket --help` exact include syntax.
- Confirmed pre-existing Lisa/concurrent modifications are outside ticket ownership:
  - `.lisa/provenance.jsonl`;
  - `docs/active/tickets/T-080-01-02.md`;
  - `docs/active/tickets/T-080-02-02.md`.
- No ordinary Git staging or commit command has been used.

## Planned source unit

- `docs/knowledge/lisa-loop-settled-contract.md`
- `src/seam/lisa-loop-settled-core.ts`
- `src/seam/lisa-loop-settled-core.test.ts`
- `src/seam/lisa-loop-settled.ts`
- `src/seam/lisa-loop-settled.test.ts`

## Implementation log

### Pure trace contract

- Added `.vend/lisa-loop-settled-failures.jsonl` as the exported local trace path.
- Added typed timestamp/reason failure values and deterministic JSONL serialization.
- Canonical ISO timestamp and nonblank reason validation stay in the pure core.
- JSON escaping preserves the exact reason while guaranteeing one physical line.
- Added exact bytes, embedded-control-character, and invalid-value tests.
- Red proof: focused core test initially failed because the named serializer export was absent.
- Green proof: core suite passes after implementation.

### Recorder effect and containment

- Added injected working-root and failure-only clock options.
- Absolute event project roots own their trace; invalid/missing project roots fall back to the
  trusted working root (`process.cwd()` by default).
- Refused complete events append exactly once and return typed refusal data.
- Marker publication errors clean temporary state best-effort, append exactly once, and return a
  typed `failed` outcome instead of rejecting.
- Ignored and successfully recorded events never append failure state.
- Trace-append failure is itself contained as optional result diagnostic data.
- The main recorder maps refused/failed results to process exit 1 without an uncaught throw, so the
  unchanged hook skips settle while still containing the failure from Lisa.
- Added exact two-refusal ordering/count proof and forced atomic-rename failure proof.
- Added a standalone-process test proving a relative-project refusal exits 1 with one trace record
  and no uncaught stack.
- Added automated `git check-ignore` proof.
- Preserved successful atomic replacement and real-hook success/consume coverage.

### Durable documentation

- Updated the seam contract with the exact path, JSONL shape, root selection, append/no-append
  cases, process/hook containment distinction, Vend ownership, and honest delivery boundary.
- Kept settle parsing/rendering/freshness explicitly assigned to T-080-01-03.

## Verification log

- Focused tests: 45 pass, 0 fail, 107 expectations across the two seam test files.
- Typecheck/build: `tsc --noEmit` green after explicit test-side result narrowing.
- `git check-ignore`: green; echoed `.vend/lisa-loop-settled-failures.jsonl`.
- `git diff --check`: green for all five ticket-owned paths.
- Full `bun run check`: green.
  - BAML client generation completed.
  - `tsc --noEmit` passed.
  - 1,933 tests passed.
  - 1 test skipped because no `dist/` artifacts were present.
  - 0 tests failed.
  - 6,324 expectations completed.
  - 1,934 tests ran across 126 files in 16.52 seconds.

## Commit log

- Created source commit `15cb09bbb1a877fc73157cc7782f120902a98126`.
- Subject: `feat(seam): trace Lisa recorder failures`.
- Mechanism: `lisa commit-ticket --ticket-id T-080-01-02` with exact repeated includes.
- Exact commit file list:
  - `docs/knowledge/lisa-loop-settled-contract.md`;
  - `src/seam/lisa-loop-settled-core.test.ts`;
  - `src/seam/lisa-loop-settled-core.ts`;
  - `src/seam/lisa-loop-settled.test.ts`;
  - `src/seam/lisa-loop-settled.ts`.
- Commit summary: 5 files changed, 319 insertions, 24 deletions.
- Post-commit diff for all five ticket-owned paths is empty.
- No ordinary Git staging/commit command was used.

## Deviations

- Added a standalone recorder subprocess test beyond the original plan's function-level assertions.
  Rationale: the acceptance says the recorder “exits without throwing”; process-level proof pins
  the distinction between deliberate exit status 1 and an uncaught exception.

## Remaining

1. Complete `review.md` and `review-disposition.json`.
2. Stop on this ticket for Lisa completion publication.

## Post-commit ownership state

The remaining status entries are Lisa/concurrent state, not ticket-owned source:

- modified `.lisa/provenance.jsonl`;
- modified `docs/active/tickets/T-080-01-02.md`;
- modified `docs/active/tickets/T-080-02-02.md`;
- untracked `docs/active/work/T-080-01-02/`;
- untracked `docs/active/work/T-080-02-02/`.

They were deliberately neither staged nor included. Lisa owns artifact admission and ticket
transitions.
