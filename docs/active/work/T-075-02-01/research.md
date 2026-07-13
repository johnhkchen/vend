# Research — T-075-02-01 plain operator trust lines

## Assignment and contract

- The ticket is `T-075-02-01`, under story `S-075-02` and epic `E-075`.
- The ticket starts in `phase: research`; Lisa owns phase/status transitions.
- Phase artifacts belong in this attempt-private directory, not in
  `docs/active/work/T-075-02-01/`.
- Ticket-owned implementation commits must use `lisa commit-ticket` with exact
  repository-relative include paths.
- The repository already has Lisa-owned ticket frontmatter edits; those are not part of this
  ticket's implementation and must not be staged or included.
- The required repository gate is `bun run check` (BAML generation, TypeScript, full tests).

## Story boundary

- The story names exactly two operator-facing formatters:
  - `formatWalkAwayFindings` in `src/ledger/walk-away.ts`.
  - `homeLedgerLine` in `src/shelf/home.ts`.
- The story names exactly two test files:
  - `src/ledger/walk-away.test.ts`.
  - `src/shelf/home.test.ts`.
- Only wording is in scope.
- Numeric calculations, thresholds, result shapes, branch conditions, and the shared percentage
  renderer are explicitly outside the change.
- The honest-empty branches must remain honest and keep their meaning.
- Shelf confidence copy, the empty-board line, SVG face copy, and trust metric changes belong to
  other stories and are out of this slice.

## Product grounding

- Epic `E-075` is a vocabulary-and-honesty sweep over existing read surfaces.
- Its kitchen-table test is whether a person can say what a line means without learning Vend's
  internal shorthand first.
- The epic explicitly identifies four problematic tokens on this slice:
  `E1 walk-away`, `intervention bit unrecorded`, `censored`, and `andon rate`.
- The epic also says the honest content must not be softened while the vocabulary is simplified.
- This advances P5 because local output must be legible to its operator.
- This advances P3 because truthful labels are part of the gate contract.

## Audit data path

- `src/cli.ts` parses the read-only `vend audit` command.
- The audit dispatch lazily imports `auditWalkAway` and `formatWalkAwayFindings`.
- It reads records, builds a `WalkAwayReport`, formats it, and writes the returned string to stdout.
- No shell-specific presentation layer alters the formatter output afterward.
- Therefore the string literals inside `formatWalkAwayFindings` are the actual operator surface.

## Home data path

- `src/shelf/home-shell.ts` reads the run log and calls `auditWalkAway(records)`.
- It passes that report to `homeLedgerLine`.
- `renderHome` receives the already-rendered ledger string and appends it at the bottom of Home.
- `renderHome` does not inspect, recalculate, or relabel the ledger value.
- Therefore the string literals inside `homeLedgerLine` are the actual Home trust foot.

## Pure core boundary

- `auditWalkAway` is pure: it takes run records and options and returns a plain report.
- `formatWalkAwayFindings` is pure: it takes a report and returns a string.
- `homeLedgerLine` is pure: it takes the same report and returns a string.
- `renderHome` is a pure composition function.
- Filesystem reads and stdout writes remain in shell modules.
- This ticket does not need a new effect boundary or a new module.

## Shared report facts

- `WalkAwayReport.total` is the number of records in the selected audit slice.
- `report.play` is either a selected play name or `null`, rendered as `all plays`.
- `report.tier` selects the already-computed stop-rate allowance.
- `report.andonRate` is the fraction of all runs whose outcome is not `success`.
- `report.andonBudget` is the tier allowance for that fraction.
- `report.withinBudget` is already computed by the audit core.
- `report.outcomeMix.success` is the successful count.
- `report.outcomeMix.censored` counts `budget-exhausted` plus `timed-out` outcomes.
- Gate failures and ID collisions remain separately counted.
- Cost ratios use successful runs with usable envelopes; excluded records and medians are already
  determined before formatting.

## Intervention facts

- `intervention.reported` counts records carrying a recorded intervention answer.
- `intervention.intervened` counts recorded answers where a person stepped in.
- The displayed trust percentage is the complement: `1 - intervention.rate`.
- Its fraction is `reported - intervened` over `reported`.
- Trend values are also complemented before display.
- Forward and attested records are kept in separate sub-statistics.
- An empty sub-stat renders `none yet`, never `0%`.
- A report with no recorded answers renders an honest empty message, never a computed percentage.

## Percentage seam

- `pct` is exported by `src/ledger/walk-away.ts`.
- It uses `Math.round(r * 100)` and appends `%`.
- It returns an em dash for `null`.
- `formatWalkAwayFindings` calls `pct` for combined, trend, split, stop-rate, and allowance values.
- `homeLedgerLine` imports and calls that same function for combined and split values.
- This import is the structural no-drift seam required by the story.
- No duplicate percentage formatter exists in `home.ts`.

## Current audit wording and branches

- The heading currently starts with `E1 — walk-away trust`.
- The populated trust line is labeled `walk-away rate` and says `ran untouched`.
- The empty trust line says `no self-reports yet` and then
  `intervention bit unrecorded`.
- The provenance line is labeled `forward (live)` and `attested back-fill`.
- The stop frequency is labeled `andon rate` and compared with a tier `budget`.
- Its status is `✓ within` or `⚠ over`, followed by `gates working, not defects`.
- The result counts are labeled `outcome mix`.
- Budget exhaustion/timeouts are described as `censored (budget/timeout)`.
- Gate failures and ID collisions use their raw outcome identifiers.
- Cost is labeled `cost vs envelope`; the empty value says `no envelope data`.

## Current Home wording and branches

- Every branch begins `ledger   E1 walk-away`.
- With zero runs, the suffix is `— no runs yet`.
- With runs but no recorded intervention answer, the suffix is
  `— no self-reports yet (N run[s])`.
- With recorded answers, the line contains combined percent and fraction, then
  `forward` and `attested` percentages.
- Singular/plural logic exists only in the no-self-report branch.
- The populated branch uses the same complement and counts as the audit formatter.

## Existing test coverage

- `walk-away.test.ts` separately pins audit math for empty, successful, stopped, cost, intervention,
  filtering, windowing, and provenance cases.
- Its formatter tests currently use partial `toContain` checks for old labels.
- It covers populated and no-self-report/no-envelope branches.
- It covers exact provenance percentages and `none yet` for an empty partition.
- `home.test.ts` builds real reports from pure run-record fixtures.
- It covers a 62.5% combined value rounding to `63%` plus `50%`/`75%` split values.
- It compares those values with `formatWalkAwayFindings`, exercising the shared `pct` seam.
- It covers zero runs, no recorded answers, singular run grammar, and an empty provenance partition.
- It also covers Home composition order and empty board/shelf pass-through behavior.

## Constraints and risks

- Partial label assertions could allow an old forbidden token to remain elsewhere in the same output.
- Exact output assertions are useful where the branch is compact; explicit negative checks are useful
  across all formatter branches.
- Changing report field names or outcome enum names would exceed the copy-only story.
- Changing `pct`, arithmetic, thresholds, or report construction would violate acceptance even if
  displayed sample numbers happened to remain the same.
- The word `censored` remains valid in internal domain comments and other non-operator modules; this
  story targets rendered strings, not a repository-wide terminology migration.
- Comments and test descriptions that describe the old operator copy can become misleading after
  the label change, but semantic/domain comments should not be rewritten as if the underlying model
  changed.

## Repository state

- The worktree is shared with other Lisa activity.
- `docs/active/tickets/T-075-01-01.md` and `docs/active/tickets/T-075-02-01.md` are already modified.
- The latter modification is the Lisa-owned `ready` to `research` transition.
- No relevant source or test file was modified at the start of this attempt.
- Ticket work can be isolated with exact-path Lisa commits.

## Research conclusion

- This is a bounded pure presentation change over four owned files.
- Both surfaces already share their data and rounding behavior correctly.
- The implementation seam is label selection, not calculation.
- Tests need to pin the replacement language, forbid the four named output tokens, preserve empty
  meanings, and retain the existing cross-surface `63%`/`50%`/`75%` rounding proof.
