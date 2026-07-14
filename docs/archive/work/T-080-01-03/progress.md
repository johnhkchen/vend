# Progress — T-080-01-03 settle surfaces cord failure

## Status

- Research: complete.
- Design: complete.
- Structure: complete.
- Plan: complete.
- Implement: complete.
- Review: complete.

## Baseline

- Required project, workflow, vision, charter, stack, story, ticket, epic, seam contract, dependency
  artifacts, settle source/tests, and Git history were read.
- Focused baseline:
  - command: `bun test src/settle/settle-core.test.ts src/settle/settle.test.ts`;
  - 33 pass;
  - 0 fail;
  - 127 expectations.
- `lisa commit-ticket --help` confirms repeated exact `--include` syntax.
- No ordinary Git staging or commit command has been used.

## Planned source unit

- `docs/knowledge/lisa-loop-settled-contract.md`
- `src/settle/settle-core.ts`
- `src/settle/settle-core.test.ts`
- `src/settle/settle.ts`
- `src/settle/settle.test.ts`

## Ownership boundary

Pre-existing/current Lisa-owned state is excluded from the source commit:

- `.lisa/provenance.jsonl`;
- `docs/active/tickets/T-080-01-03.md`;
- `docs/active/work/T-080-01-03/` publication state.

## Implementation checklist

- [x] Add pure trace parser and freshness policy.
- [x] Add cord field to typed verdict/input.
- [x] Read failure/claim filesystem mtimes in the shell.
- [x] Render exact normal verdict line.
- [x] Add pure policy tests.
- [x] Add renderer and lifecycle acceptance tests.
- [x] Update durable seam contract.
- [x] Run focused verification.
- [x] Inspect exact diff.
- [x] Run `bun run check`.
- [x] Commit exact source unit with Lisa.
- [x] Complete Review artifacts.

## Implementation log

### Pure policy

- Added a plain `SettleCordObservation` carrying optional trace bytes, trace mtime, and claim
  watermark mtime.
- Added `cordFailureReason` as a pure selector.
- The reader scans JSONL from newest to oldest, accepts only the exact timestamp/reason schema,
  validates canonical ISO timestamp text, and preserves the original admitted reason string.
- Blank, malformed, torn, and unrelated lines are skipped; invalid-only diagnostic state returns
  null rather than refusing settle.
- A trace is visible only when its mtime is usable and strictly newer than a usable claim watermark,
  or when no claim exists.
- Added `cordFailureReason: string | null` to normal typed verdicts.

### Effect shell

- Optional last-settle and failure-trace reads now include filesystem mtime.
- The atomically renamed loop claim retains the marker inode's mtime.
- `runSettle` uses the maximum prior last-settle/current marker mtime as its claim watermark.
- Existing claim restore, continuation write, claim consume, and refusal ordering is unchanged.
- The append-only failure log is read only and never rewritten or truncated.

### Terminal surface

- A fresh failure emits exactly `cord: last recording failed — <reason>` immediately after the loop
  line.
- The line is ordinary verdict context, not ANSI-red, not an exception, and not a refusal.
- No log or an equal/newer claim emits no cord line.

### Durable contract

- Updated the seam contract with tolerant read policy, filesystem freshness watermark, exact line,
  one-verdict acknowledgement behavior, and executable settle tests.
- Preserved the producer's append-only and no-delivery-guarantee boundaries.

## Verification log

- Focused baseline: 33 pass, 0 fail, 127 expectations.
- Focused result after implementation:
  - 41 pass;
  - 0 fail;
  - 166 expectations;
  - two settle test files.
- Standalone strict typecheck: `tsc --noEmit` green.
- `git diff --check` on all five planned paths: clean.
- Planned diff: 5 files changed, 311 insertions, 16 deletions.
- Full `bun run check`: green.
  - BAML generation completed;
  - `tsc --noEmit` passed;
  - 1,941 tests passed;
  - 1 test skipped because no `dist/` artifacts were present;
  - 0 tests failed;
  - 6,363 expectations completed;
  - 1,942 tests ran across 126 files in 17.81 seconds.

## Acceptance proof implemented

- Fresh trace newer than prior claim: lifecycle test returns a verdict and renders exact reason.
- No log: existing marker lifecycle explicitly proves null field and no cord line.
- Successful marker newer than trace: lifecycle test proves loop provenance, no cord line, and marker
  consumption.
- Verbatim reason: pure test preserves whitespace, tab, and embedded newline after JSON decoding.
- Never refusal: pure invalid-trace tests and lifecycle verdict-kind assertions prove diagnostic
  state is non-blocking.
- Immediate repeat: the warning verdict's new last-settle acknowledgement suppresses stale replay.

## Commit log

- Commit: `db93977d42f1c17c88b0d29c30502ee41fe1bf79`.
- Subject: `fix(settle): surface recorder cord failures`.
- Mechanism: `lisa commit-ticket --ticket-id T-080-01-03` with exact repeated includes.
- Exact committed paths:
  - `docs/knowledge/lisa-loop-settled-contract.md`;
  - `src/settle/settle-core.test.ts`;
  - `src/settle/settle-core.ts`;
  - `src/settle/settle.test.ts`;
  - `src/settle/settle.ts`.
- Commit summary: 5 files changed, 311 insertions, 16 deletions.
- Post-commit diff on all five paths is empty.
- Ordinary Git index is empty.
- No ordinary `git add` or `git commit` was used.

## Post-commit ownership state

Remaining worktree entries are Lisa-owned publication state only:

- modified `.lisa/provenance.jsonl`;
- modified `docs/active/tickets/T-080-01-03.md`;
- untracked `docs/active/work/T-080-01-03/`.

They were not staged or included.

## Deviations

- None at implementation start.
