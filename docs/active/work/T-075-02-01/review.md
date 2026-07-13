# Review — T-075-02-01 plain operator trust lines

## Verdict

PASS. The ticket and story acceptance criteria are met. Both operator trust surfaces now use plain,
meaning-preserving wording; the named legacy jargon is absent from rendered populated and empty
branches; values and honest-empty distinctions are intact; Home and `vend audit` still render the
same whole percentages through the shared `pct` function. The required full gate is green and all
ticket-owned source/test changes are committed through Lisa.

## Scope delivered

Implemented the complete `S-075-02` slice and no adjacent E-075 slice:

- Full `vend audit` trust readout in `formatWalkAwayFindings`.
- Compact Home ledger foot in `homeLedgerLine`.
- Focused audit formatter tests.
- Focused Home formatter/composition tests.

Did not change:

- Shelf confidence labels.
- Empty-board copy.
- SVG/card-face filtering.
- Trust thresholds or metric definitions.
- Run-log schema.
- CLI grammar.
- Filesystem or stdout shells.

## Files changed

### `src/ledger/walk-away.ts`

Operator output now says:

- `run trust` instead of an experiment code.
- `finished without help` instead of a program-specific walk-away label.
- `not recorded yet (no one said whether anyone stepped in during N run[s])` for missing answers.
- `recorded at the time` and `filled in later` for provenance.
- `runs stopped before finishing` and `allowed` for the non-success rate and its tier threshold.
- `how runs ended`, with plain descriptions for each existing outcome count.
- `cost compared with plan`, `middle result`, and `no planned cost data` for cost comparison.

The formatter still receives the same `WalkAwayReport` and pushes the same number of logical lines
under the same conditions.

### `src/shelf/home.ts`

All three ledger-foot branches now begin `ledger   finished without help`.

- Zero runs still renders `no runs yet` and no percentage.
- Runs with no recorded answer still render unknown, now with a plain explanation and correct
  singular/plural grammar.
- Populated output keeps combined percent/fraction and both provenance percentages, using the same
  labels as the full audit.

`subPct`, `homeLedgerLine` branch ordering, and `renderHome` composition remain structurally intact.

### `src/ledger/walk-away.test.ts`

- Pins representative populated heading, help-free percentage/fraction, stop rate/allowance, all
  four end counts, and token/time cost ratios.
- Pins the no-answer and no-planned-cost messages.
- Pins both new provenance labels and the empty partition `none yet` label.
- Pins singular `1 run` grammar in audit's honest-empty branch.
- Rejects the four named legacy phrases in populated and empty formatter output.

### `src/shelf/home.test.ts`

- Pins populated, zero-run, no-answer, singular, and provenance-empty Home output.
- Rejects the four named legacy phrases across populated and empty Home lines.
- Derives expected 63%, 50%, and 75% strings with exported production `pct` and asserts the same
  values under corresponding labels in Home and the full audit.
- Keeps Home region ordering, board pass-through, shelf empty, ledger empty, and no-card-chrome
  coverage green with updated ledger anchors.

## Acceptance assessment

### Plain `vend audit` wording

PASS.

Every label produced by `formatWalkAwayFindings` was reviewed. Raw outcome enum labels and the
statistical `censored` label no longer appear in output. The report's exact counts remain visible
under conversational descriptions.

### Plain Home ledger wording

PASS.

The compact line no longer exposes the experiment code. Its combined and provenance meanings are
said directly. Empty lines remain explicit rather than manufacturing trust.

### No `E1 walk-away`

PASS.

Tests use a broader case-insensitive `E1[^\n]*walk-away` pattern so the old audit em-dash variant and
the old Home variant are both rejected.

### No `andon rate`

PASS.

Rendered output uses `runs stopped before finishing`. Internal `andonRate` fields/test names remain
unchanged by design because the story is an operator-copy slice, not a domain-model migration.

### No `censored`

PASS.

Rendered result counts say `hit budget or time limit`. The internal aggregate still correctly uses
`censored` to represent those two right-censored outcomes.

### No `intervention bit unrecorded`

PASS.

Both surfaces say no one reported whether anyone stepped in. Tests exercise the conditional branch,
including singular and plural counts.

### Numbers unchanged

PASS.

Review of the two-commit diff confirms no report construction, threshold, outcome aggregation,
ratio, median, complement, fraction, or trend expression changed. Existing and strengthened fixture
assertions pin representative values:

- Audit: 67% (2/3), 33% versus 10%, end counts 2/0/1/0, ×1.50 tokens, ×300.00 time.
- Home/full audit: 63%, 50%, and 75% across the same report.

The only expression added to output is singular/plural selection for audit's run noun; the numeric
value itself and honest-empty branch are unchanged.

### Honest-empty branches unchanged in meaning

PASS.

- Zero Home runs: explicit `no runs yet`, no percentage.
- Runs without a help answer: explicit unknown/not-recorded message, no percentage.
- Empty provenance partition: `none yet`, never `0%`.
- No comparable cost records: explicit `no planned cost data`, no ratio.

No branch condition moved and no null/zero substitution was introduced.

### Shared rounding seam

PASS.

- `home.ts` continues importing `pct` from `walk-away.ts`.
- `subPct` continues calling the imported function.
- `homeLedgerLine` continues calling it for the combined percentage.
- `formatWalkAwayFindings` continues calling the same function.
- The strengthened test calls `pct(5 / 8)`, proving 62.5% displays as 63% on both surfaces, and
  repeats the comparison for the two provenance values.

## Test evidence

### Focused baseline

- 29 passed.
- 0 failed.
- 78 assertions.

### Final focused suites

Command:

```bash
bun test src/ledger/walk-away.test.ts src/shelf/home.test.ts
```

Result:

- 31 passed.
- 0 failed.
- 87 assertions.

### Final repository gate

Command:

```bash
bun run check
```

Result:

- BAML generation passed.
- TypeScript no-emit typecheck passed.
- 1,746 tests passed.
- 1 acceptance test intentionally skipped because no `dist/` artifacts were present.
- 0 tests failed.
- 5,504 assertions across 116 files.
- Exit status 0.

`git diff --check` is clean across the complete two-commit ticket diff.

## Commits

All ticket-owned tracked changes were committed via `lisa commit-ticket` with exact include paths.

1. `cd0f49b87fd5b743ef772d00aa6a73bbb373d030` —
   `plain-language audit and Home trust lines`.
2. `b861c029e7a0a30ff3f13e75017c64f92a95f24f` —
   `polish missing-answer trust wording`.

The second commit is a focused pre-review correction: it makes both missing-answer explanations
more conversational and adds audit singular grammar coverage. All four owned paths are clean after
the second transaction.

## Worktree isolation

Concurrent Lisa state remains outside the commits:

- Provenance ledger changes.
- Lisa-managed ticket frontmatter changes.
- Lisa-published shared work artifacts for this and an adjacent ticket.

No ordinary Git index operation was used, and no unrelated change was reverted or swept into the
ticket commits.

## Coverage gaps and honest boundary

- No live `vend audit` process was run. This matches the story's honest boundary: pure string edits
  are fixture-proven, not live-audit-proven.
- Tests do not ban internal domain terminology in comments, types, or math tests. That is deliberate;
  the acceptance target is operator-rendered output, and precise internal terminology remains useful.
- Kitchen-table clarity is partly qualitative. The mechanical gate covers the named jargon plus
  exact replacement phrases and complete representative lines; a future UX ride-along may still
  refine tone without implying a correctness gap here.

## Open concerns

No blocking or critical concern.

One minor observation: the audit still displays the tier token (`[standard]`) and compact ratio
notation (`×1.50`). Neither was named by this story, and both carry necessary numeric context; they
were intentionally retained to keep scope and meaning stable.

## Final handoff

The implementation is honestly complete. No TODO remains inside `S-075-02`. Lisa should publish
this review artifact, advance the ticket, and produce the completion commit/seat release; this worker
must remain on `T-075-02-01` until that confirmation rather than starting adjacent work.
