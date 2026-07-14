# Design — T-075-02-01 plain operator trust lines

## Decision summary

Replace the formatter literals in place with a shared plain-language vocabulary while preserving
the existing report object, branches, interpolated values, arithmetic, and imported `pct` helper.
Update the two existing unit suites to pin the new copy, reject the four named legacy tokens in
rendered output, and retain the cross-surface rounding proof.

## Design goals

1. A reader should understand the trust lines without knowing Vend experiment names or factory
   vocabulary.
2. The new words must state the same facts as the old words.
3. Empty data must remain visibly unknown, never appear as zero or success.
4. Home and `vend audit` must use the same words for the same provenance concepts.
5. Home and `vend audit` must keep deriving displayed percentages through `pct`.
6. No underlying audit behavior may move in this copy-only slice.

## Options considered

### Option A — Replace literals in the two existing formatters

Change only user-facing string fragments, retaining the current expressions and control flow.

Advantages:

- Matches the story's copy-only boundary.
- Keeps the established pure-core architecture.
- Makes the diff directly auditable against numeric and branch regressions.
- Requires no new public API.
- Preserves the structural `pct` seam already shared by both surfaces.
- Lets tests cover the actual strings operators receive.

Costs:

- Some concept labels remain duplicated between the compact and full views.
- Future copy changes still need coordinated edits in two functions.

Assessment: best fit. The story deliberately combines the two surfaces in one ticket so the small
duplication can be updated and reviewed together.

### Option B — Introduce shared label constants or a trust-copy module

Create constants for headings, provenance names, and empty messages, then import them in both
formatters.

Advantages:

- Reduces literal duplication.
- Makes some future vocabulary drift mechanically harder.

Costs:

- Adds an abstraction for a handful of presentation phrases with different punctuation and detail
  needs on each surface.
- Does not remove the need for each formatter to compose its own line.
- Expands module/public-interface scope beyond the ticket.
- The meaningful no-drift contract is percentage calculation, already enforced by shared `pct`.

Assessment: rejected as unnecessary structure for this bounded copy pass.

### Option C — Post-process old formatter output

Keep old output internally and replace jargon tokens in a final string transformation.

Advantages:

- Small apparent edit.
- Could centralize a vocabulary map.

Costs:

- Couples correctness to exact old substrings.
- Makes grammar awkward after token replacement.
- Can leave partially translated lines.
- Obscures whether numbers and phrases still describe the same concepts.
- Adds a transformation stage where direct, readable strings suffice.

Assessment: rejected. Directly authored output is easier to trust and test.

### Option D — Rename report fields and domain concepts

Rename `andonRate`, `censored`, intervention types, or audit APIs to plain terms throughout the code.

Advantages:

- Internal and external vocabulary would align.

Costs:

- Violates the story's pure string-edit boundary.
- Touches calculation code and unrelated consumers.
- Conflates operator copy with precise internal statistical/domain terminology.
- Creates behavior risk without improving this surface beyond direct labels.

Assessment: rejected as explicitly out of scope.

## Chosen vocabulary

The following is the operator-copy contract for this ticket.

| Current rendered concept | New rendered wording | Meaning retained |
|---|---|---|
| `E1 — walk-away trust` | `run trust` | This block summarizes trust across runs. |
| `walk-away rate` | `finished without help` | Complement of recorded intervention rate. |
| `intervention bit unrecorded` | `runs did not say whether anyone stepped in` | Missing answers stay unknown. |
| `forward (live)` / `forward` | `recorded at the time` | Answer captured with the run. |
| `attested back-fill` / `attested` | `filled in later` | Answer added retrospectively. |
| `andon rate` | `runs stopped before finishing` | Fraction of non-success outcomes. |
| `budget` on stop-rate line | `allowed` | Tier allowance, not a spending amount. |
| `gates working, not defects` | `checks working as intended` | A stop is a control action, not hidden failure. |
| `outcome mix` | `how runs ended` | Counts by terminal result. |
| `success` | `finished` | Successful terminal runs. |
| `censored (budget/timeout)` | `hit budget or time limit` | Same two-outcome subset. |
| `gate-failed` | `stopped by a check` | Existing gate-failed count. |
| `id-collision` | `duplicate run ID blocked` | Existing collision count. |
| `cost vs envelope` | `cost compared with plan` | Actual/allotted ratio. |
| `median` | `middle result` | Same already-computed statistic. |
| `no envelope data` | `no planned cost data` | No usable success/allocation comparison. |

## Why these words

- “Finished without help” says what the percentage counts; it avoids making the reader decode the
  project-specific “walk-away” program name.
- “Recorded at the time” and “filled in later” explain provenance as timing, which is the material
  distinction the split protects.
- “Runs stopped before finishing” describes the numerator of the existing non-success rate without
  requiring Toyota vocabulary.
- “Allowed” distinguishes the stop-rate threshold from the time/token budget operators allocate to
  a run.
- “Hit budget or time limit” expands the exact two outcomes aggregated in `censored`.
- “Stopped by a check” and “duplicate run ID blocked” retain the reason counts without exposing enum
  spelling.
- “Cost compared with plan” is shorter and more conversational than “cost vs envelope” while still
  identifying a ratio against the allocation.

## Audit output design

### Heading

Keep scope, total, singular/plural behavior, and tier in their current order:

`run trust · <scope> · <N> run[s] [<tier>]`

Only the leading experiment/jargon label changes.

### No recorded help answers

Render:

`finished without help: not recorded yet (<N> runs did not say whether anyone stepped in)`

This retains both facts: no trust percentage is available, and total runs still exist.

### Recorded help answers

Keep the existing percentage, untouched fraction, trend values, arrow, and 100% goal. Replace the
label with `finished without help`. Replace provenance labels with `recorded at the time` and
`filled in later`. Keep `none yet` for an empty provenance partition.

### Stop allowance

Render the same rate and threshold as:

`runs stopped before finishing: <rate> vs <allowance> allowed — <mark> (checks working as intended)`

Keep the existing `✓ within` / `⚠ over` choice and condition.

### End counts

Render all four existing counts in the existing order under `how runs ended`. No count is merged,
removed, or recomputed.

### Cost comparison

Keep token/time ratios, sample size, and singular/plural logic. Translate the label and the word
`median`; translate the empty label without manufacturing a ratio.

## Home output design

### No runs

`ledger   finished without help — no runs yet`

The explicit zero-data meaning and absence of a percentage are unchanged.

### Runs without recorded answers

`ledger   finished without help — not recorded yet (<N> run[s] did not say whether anyone stepped in)`

Keep existing run-count interpolation and singular/plural logic.

### Populated

`ledger   finished without help <pct> (<untouched>/<reported>)   └ recorded at the time <pct> · filled in later <pct>`

The Home line stays compact but uses the same provenance words as the full readout.

## Testing design

- Continue constructing reports through `buildRunRecord` and `auditWalkAway`; do not fabricate
  formatter-only objects that might drift from the core.
- Pin representative populated output labels and exact numeric fragments.
- Pin honest-empty audit and Home wording.
- Assert output does not contain any of the four story-named legacy tokens.
- Retain the empty provenance `none yet` assertion.
- In Home's cross-surface test, derive expected displayed percentages with exported `pct` and assert
  the same values occur in both Home and audit output.
- Keep composition tests, updating only their ledger anchor strings.

## Non-changes

- No change to `auditWalkAway`.
- No change to `WalkAwayReport` or its nested types.
- No change to `TIER_ANDON_BUDGET`.
- No change to `pct`, `ratio`, `subWalk`, or `subPct` calculations.
- No change to filtering, windows, cost samples, provenance partitioning, or outcome aggregation.
- No change to CLI parsing or Home shell I/O.
- No change to sibling E-075 stories.

## Risks and mitigations

- Risk: a forbidden term survives in a less obvious branch.
  Mitigation: negative assertions over populated and empty formatter outputs.
- Risk: provenance meaning becomes vague.
  Mitigation: use timing-explicit paired labels on both surfaces.
- Risk: copy edit accidentally changes interpolation.
  Mitigation: make line-for-line literal edits and preserve all expressions; pin sample values.
- Risk: cross-surface rounding drifts later.
  Mitigation: preserve the shared import and test both outputs against values produced by `pct`.

## Final decision

Use Option A. Translate every operator-facing label in the two formatter blocks into the vocabulary
above, update only their focused tests, run targeted suites, then run the full `bun run check` gate.
