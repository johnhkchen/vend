# Progress — T-075-02-01 plain operator trust lines

## Status

Implementation, including the pre-review singular-grammar refinement, is complete, verified, and
committed. Review remains.

## Pre-review plan adjustment

The original audit empty branch interpolated `${report.total} runs` without singular handling. The
first implementation retained that expression, which would make the newly plain sentence read
`1 runs` for a one-run report. That conflicts with the story's “every line” kitchen-table criterion
even though the number and honest-empty branch remain correct.

Adjustment before proceeding:

- Rephrase both surfaces' missing-answer explanation as
  `no one said whether anyone stepped in during N run[s]`.
- Add/preserve singular grammar assertions.
- Keep the same branch predicates, count, and unknown/no-percentage meaning.
- Rerun focused and full gates.
- Commit the audit/Home wording and tests as an exact-path follow-up.

## Completed phase artifacts

- `research.md` — mapped story scope, data paths, formatter branches, shared `pct` seam, tests, and
  concurrent worktree constraints.
- `design.md` — selected direct literal replacement and established the plain vocabulary contract.
- `structure.md` — bounded the change to four existing files and one exact-path commit unit.
- `plan.md` — sequenced baseline, source/test edits, focused/full checks, Lisa commit, and review.

All artifacts were written to the attempt-private work directory as assigned. No artifact was
manually written to `docs/active/work/T-075-02-01/`; Lisa independently materialized shared work
state during the attempt.

## Baseline

Command:

```bash
bun test src/ledger/walk-away.test.ts src/shelf/home.test.ts
```

Result before implementation:

- 29 passed.
- 0 failed.
- 78 assertions.
- 2 test files.

This established that the owned surface was green before copy edits.

## Source work completed

### `src/ledger/walk-away.ts`

- Replaced the experiment-coded heading with `run trust`.
- Replaced “walk-away rate” with the explicit fact `finished without help`.
- Replaced the missing intervention-bit phrase with a plain explanation that no one said whether
  anyone stepped in during the counted runs.
- Replaced provenance labels with:
  - `recorded at the time`.
  - `filled in later`.
- Replaced the factory term for non-success frequency with `runs stopped before finishing`.
- Replaced threshold `budget` copy with `allowed`, avoiding confusion with allocated spend.
- Replaced the raw outcome/statistical line with:
  - `finished`.
  - `hit budget or time limit`.
  - `stopped by a check`.
  - `duplicate run ID blocked`.
- Replaced cost-envelope/median labels with `cost compared with plan` and `middle result`.
- Replaced the honest cost-empty label with `no planned cost data`.
- Updated the formatter-adjacent documentation to quote the new operator copy.

No report construction, field, threshold, arithmetic, helper logic, or export changed.

### `src/shelf/home.ts`

- Replaced `ledger   E1 walk-away` with `ledger   finished without help` in all three branches.
- Kept the zero-run message `no runs yet` and its no-percent behavior.
- Reworded the runs-without-answers branch while retaining total and singular/plural behavior.
- Replaced compact provenance labels with the same `recorded at the time` / `filled in later` pair
  used by the full audit readout.
- Updated quoted documentation/examples.

`subPct`, its imported `pct` seam, both branch predicates, the `walkAway` expression, and
`renderHome` remain unchanged.

## Test work completed

### `src/ledger/walk-away.test.ts`

- Updated formatter expectations to the new heading and all plain labels.
- Pinned the populated numeric output:
  - 3 runs.
  - 67% finished without help (2/3).
  - 33% stopped versus 10% allowed.
  - outcome counts 2/0/1/0.
  - token ratio ×1.50 and time ratio ×300.00 over 2 finished runs.
- Pinned the no-answer and no-planned-cost branches.
- Pinned new provenance labels and the `none yet` branch.
- Added negative assertions covering the four ticket-named legacy phrases in both populated and
  honest-empty formatter output.

### `src/shelf/home.test.ts`

- Updated populated and empty Home expectations to new wording.
- Added a production `pct` import for explicit expected percentage strings.
- Retained and strengthened cross-surface rounding proof:
  - `pct(5 / 8)` => 63% in Home and audit.
  - `pct(1 / 2)` => 50% in Home and audit.
  - `pct(3 / 4)` => 75% in Home and audit.
- Retained the empty provenance `none yet` / never `0%` proof.
- Added forbidden-phrase assertions across populated, zero-run, and no-answer Home lines.
- Updated Home composition anchors without changing board, shelf, or layout behavior.

## Focused verification

First post-edit combined run exposed one test-only mismatch:

- 29 passed, 1 failed.
- The singular grammar implementation rendered
  `(1 run did not say whether anyone stepped in)`.
- The old assertion searched for the now-noncontiguous substring `(1 run)` including its immediate
  closing parenthesis.
- The implementation was correct; the assertion was updated to pin the complete singular phrase.

This was the only plan deviation and did not require a source behavior change.

Final focused command:

```bash
bun test src/ledger/walk-away.test.ts src/shelf/home.test.ts
```

Focused result after the main implementation unit:

- 30 passed.
- 0 failed.
- 86 assertions.
- 2 test files.

After the pre-review grammar adjustment, the same command produced the final focused result:

- 31 passed.
- 0 failed.
- 87 assertions.
- 2 test files.
- The added audit assertion pins `1 run`, matching the existing Home singular proof.

Additional checks:

- `git diff --check` over the four owned files: clean.
- Exact diff inspection: only formatter literals, adjacent documentation, and focused tests changed.
- Static search found legacy domain terms only in internal comments/fields/calculation code; no
  operator formatter literal retains them.

## Full repository gate

Command:

```bash
bun run check
```

Completed stages:

- BAML client generation with CLI 0.223.0.
- `tsc --noEmit`.
- Full `bun test` suite.

Result after the main implementation unit:

- 1,745 passed.
- 1 intentionally skipped acceptance test because no `dist/` artifacts were present.
- 0 failed.
- 5,503 assertions.
- 1,746 tests across 116 files.
- Exit status 0.

The full gate was rerun after the singular-grammar refinement. Final result:

- 1,746 passed.
- 1 intentionally skipped acceptance test because no `dist/` artifacts were present.
- 0 failed.
- 5,504 assertions.
- 1,747 tests across 116 files.
- Exit status 0.

BAML generation produced no ticket-owned tracked diff.

## Commit

Used the required exact-path Lisa transaction:

```bash
lisa commit-ticket \
  --ticket-id T-075-02-01 \
  --message "plain-language audit and Home trust lines" \
  --include src/ledger/walk-away.ts \
  --include src/ledger/walk-away.test.ts \
  --include src/shelf/home.ts \
  --include src/shelf/home.test.ts
```

Main commit:

`cd0f49b87fd5b743ef772d00aa6a73bbb373d030`

Commit contents:

- `src/ledger/walk-away.ts`.
- `src/ledger/walk-away.test.ts`.
- `src/shelf/home.ts`.
- `src/shelf/home.test.ts`.

Post-commit exact-path status is clean for all four owned files.

Pre-review grammar follow-up used the same four exact include paths and message
`polish missing-answer trust wording`.

Follow-up commit:

`b861c029e7a0a30ff3f13e75017c64f92a95f24f`

It contains only the two formatter phrases/comments and their two focused test updates. Post-follow-up
exact-path status is clean for all four owned files.

## Concurrent state preserved

The following non-owned worktree state remained after the commit and was not staged, reverted, or
included:

- `.lisa/provenance.jsonl` modified by Lisa activity.
- `docs/active/tickets/T-075-02-01.md` modified by Lisa phase handling.
- `docs/active/tickets/T-075-03-01.md` modified by another Lisa ticket.
- `docs/active/work/T-075-02-01/` materialized by Lisa.
- `docs/active/work/T-075-03-01/` materialized by the adjacent Lisa ticket.

No ordinary `git add` or `git commit` command was used.

## Remaining

- Review committed diff against every ticket/story acceptance clause.
- Write `review.md` in the attempt-private directory.
- Stop on this ticket and wait for Lisa completion confirmation.
