# Progress — T-078-02-02

## Status

Implementation started after completing Research, Design, Structure, and Plan.

## Phase completion

- [x] Read assignment and repository instructions.
- [x] Read the parent story before ticket research.
- [x] Read the ticket, vision, and charter.
- [x] Map the shared detector and doctor architecture.
- [x] Write `research.md` in the attempt-private directory.
- [x] Write `design.md` in the attempt-private directory.
- [x] Write `structure.md` in the attempt-private directory.
- [x] Write `plan.md` in the attempt-private directory.
- [x] Implement standalone probe and unit tests.
- [x] Run first full gate and commit unit 1.
- [x] Wire CLI and extend smoke coverage.
- [x] Run second full gate and commit unit 2.
- [x] Perform final review and write both review artifacts.

## Confirmed baseline

- `T-078-02-01` exported `matchIds` from `src/gate/gates.ts`.
- `matchIds(charter, "P").size` is the shared distinct-label count seam.
- The live doctor command was green before this ticket in the current environment.
- The baseline doctor reported eight passing checks and exited zero.
- The current live charter contains P1 through P7.
- Existing unrelated Lisa worktree changes were observed and will be preserved.

## Planned commit units

1. `src/doctor/charter-convention-probe.ts` and its unit test.
2. `src/cli.ts` wiring and `src/doctor/doctor-cli.smoke.test.ts` coverage.

Each unit will be full-gate green before its exact-path `lisa commit-ticket` transaction.

## Deviations

None at implementation start.

## Unit 1 implementation

- Created `src/doctor/charter-convention-probe.ts`.
- Imported the landed `matchIds` seam rather than duplicating its regex.
- Added pure green/amber mapping with a distinct invariant count.
- Kept both states as passing checks so amber cannot affect the report exit code.
- Added a cwd-relative canonical charter reader behind an injected dependency.
- Made missing/unreadable charter state non-blocking amber with the same how-to.
- Created `src/doctor/charter-convention-probe.test.ts`.
- Focused result: 5 passed, 0 failed, 16 expectations.

## Unit 1 verification and commit

- Full gate passed: BAML generation, TypeScript, 1,824 tests passed, 1 skipped, 0 failed,
  5,916 expectations across 120 files.
- Committed only the two unit-1 paths through `lisa commit-ticket`.
- Commit: `7e445fa8ec7c081c04b02325570787ef35d01b04`.

## Unit 2 implementation

- Added a lazy import and concurrent call in the normal-workspace doctor branch.
- Appended the convention check after all existing doctor checks, preserving their relative order.
- Left the kitchen branch and cast preflight unchanged.
- Added cwd-backed labeled and unlabeled charter fixtures to the real CLI smoke suite.
- The labeled fixture proves green with two distinct labels despite a duplicate citation.
- The unlabeled fixture proves amber, the shared how-to, and exit zero.
- Focused combined result: 10 passed, 0 failed, 43 expectations across 2 files.

## Unit 2 verification and commit

- Second full gate passed: BAML generation, TypeScript, 1,826 tests passed, 1 skipped, 0 failed,
  5,927 expectations across 120 files.
- `git diff --check` passed for the two unit-2 files.
- Committed only the CLI and smoke-test paths through `lisa commit-ticket`.
- Commit: `28857a3aafb4fc1729a01c8a8303774ec87e79b6`.

## Plan deviations

No implementation deviation. The final test total is two higher than the first full gate because
unit 2 adds the two requested CLI smoke cases.

## Final verification

- Post-commit focused suites passed: 10 tests, 0 failures, 43 expectations.
- Live `bun run src/cli.ts doctor` passed with 9 checks and exit zero.
- Live convention line: `✓ charter convention: green — 7 labeled invariants found`.
- Both ticket commits pass `git diff --check`.
- `rg` confirms the new probe is wired only in the normal CLI doctor branch, not cast preflight.
- Ticket-owned source paths are clean after their Lisa commits.
- Remaining worktree changes are Lisa-managed ticket/provenance/publication state, not uncommitted
  source from this ticket.

## Completion

- [x] Acceptance criteria met.
- [x] Source and tests committed.
- [x] Full repository gate green.
- [x] `review.md` written in the attempt-private directory.
- [x] `review-disposition.json` written as pass.
