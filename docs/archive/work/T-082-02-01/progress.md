# Progress — T-082-02-01 learned-window-capacity

## Status

Implementation is complete and committed. The primary implementation was followed by one
committed-diff evidence-quality fix: repeated cap failures with no intervening burn do not count as
reset-window samples. Focused tests, strict typecheck, and the final full repository gate are green;
both ticket-owned source paths are clean.

## Completed source unit

Created:

- `src/play/lane-capacity.ts`
- `src/play/lane-capacity.test.ts`

No existing source file was edited for this ticket.

## Production behavior implemented

- Exported `learnLaneCapacities(records)` as a pure reader over already-loaded `RunRecord` values.
- Enumerates exact canonical lanes from `KNOWN_SEATS`.
- Parses stored `endedAt` evidence without consulting a current clock.
- Sorts a derived timestamped view without mutating caller input.
- Treats adjacent, strictly increasing cap-marker timestamps as observed window samples.
- Uses `(previousCap, currentCap]` boundary ownership.
- Reuses run-log's `totalTokens` for canonical cost-weighted burn.
- Averages observed cap-to-cap durations into `windowMs`.
- Averages observed cap-to-cap burn into `windowCapacity`.
- Uses the latest valid ledger timestamp as the shared ledger-as-of point.
- Measures `currentBurn` over `(ledgerAsOf - windowMs, ledgerAsOf]`.
- Exposes unclamped `quotaFraction = currentBurn / windowCapacity`.
- Exposes the number of observed interval samples.
- Returns frozen results in canonical lane order.
- Returns explicit `status: "unlearned"` results for insufficient cap/cadence evidence.
- Rejects empty cap-to-cap intervals: a repeated cap failure with no finite positive intervening
  burn does not prove a provider reset and cannot dilute learned cadence/capacity.
- Returns explicit unlearned where no positive observed interval supports a denominator.
- Unlearned values contain no numeric capacity or quota-fraction fields.

## Tests implemented

Seven focused tests cover:

1. Both canonical lanes learning different hand-computed durations, capacities, current burns, and
   quota fractions from one fabricated cap-marked ledger.
2. Out-of-order input records, proving timestamp ordering rather than append-order mutation.
3. Multiple adjacent cap intervals, proving arithmetic mean cadence/capacity and sample count.
4. Output-token and cache-creation weighting, proving canonical `totalTokens` rather than raw parity.
5. No-cap evidence, proving exact explicit unlearned objects and absent numeric keys.
6. One-cap evidence, proving one event cannot invent cadence.
7. Zero-burn repeated-cap evidence, proving it is not admitted as a reset-window sample.
8. Equal and invalid timestamps, proving they create no cadence sample.
9. Unknown raw seats, proving output remains exactly `KNOWN_SEATS`.
10. Caller-order preservation and frozen public results.

## Verification so far

Focused command:

```text
bun test src/play/lane-capacity.test.ts
```

Result:

- 7 pass
- 0 fail
- 18 assertions

Typecheck command:

```text
bun run check:typecheck
```

Result: pass.

Diff hygiene:

- `git diff --check` over both ticket paths passed.
- The primary two-path unit was committed through `lisa commit-ticket` as `4327220`.
- Commit inspection proved it contains exactly the two planned source paths.
- No ticket-owned ordinary index entries exist.

Full gate before the primary commit:

- `bun run check` passed.
- 1,972 pass, 1 skip, 0 fail, 6,478 assertions.
- The count includes concurrent sibling-ticket tests present in the shared worktree.

Final gate before the focused fix commit:

- `bun run check` passed.
- 1,972 pass, 1 skip, 0 fail, 6,478 assertions.

Lisa commits:

1. `432722053871a5f19dc0180e77ef9d6ce56cd27a` — `feat(play): learn lane window capacity`
   - exact includes: `src/play/lane-capacity.ts`, `src/play/lane-capacity.test.ts`
2. `ae9a7b34de11d4278ff14dfe71b04a0b9fab1551` — `fix(play): ignore empty cap intervals`
   - exact includes: `src/play/lane-capacity.ts`, `src/play/lane-capacity.test.ts`

Both commit path lists were inspected. Each contains only the two ticket-owned paths. The ordinary
Git index is empty and both source paths are clean after the second commit.

## Concurrent worktree state

During implementation, another Lisa ticket began changing:

- `src/engine/cast-core.ts`
- `src/engine/cast-core.test.ts`
- `src/engine/cast.ts`
- `src/engine/cast.test.ts`
- `docs/active/tickets/T-082-01-02.md`
- shared active work/provenance paths

Those files are consistent with the sibling `T-082-01-02` settlement-detection ticket and are not
owned by this ticket. They have not been read as implementation inputs, edited, staged, or selected
for this ticket's commit. Exact `--include` paths will isolate the capacity source unit.

## Deviations from Plan

- Committed-diff review added one evidence-quality rule not explicit in the original Plan: an
  adjacent cap pair must have positive finite intervening burn. This is necessary because the
  settlement marker can recur on repeated 429 casts inside the same exhausted provider window; an
  empty pair proves no reset and is not a capacity sample.
- The public contract and two-file scope are unchanged.
- The live worktree contains more concurrent Lisa activity than at Research baseline. This is an
  expected repository concurrency condition, not a ticket scope change.

## Remaining Implement work

- None. Continue immediately to Review.
