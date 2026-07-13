# T-075-03-01 Progress — cold-start confidence count

## Current state

- Research: complete.
- Design: complete.
- Structure: complete.
- Plan: complete.
- Implementation: complete and committed through Lisa.
- Review: pending review artifact only.

## Baseline evidence

Before editing ticket-owned source:

```text
bun test src/shelf/shelf-row.test.ts
16 pass, 0 fail, 32 expect() calls
```

```text
bun run check:typecheck
exit 0
```

This established a green focused baseline despite unrelated dirty files in the shared tree.

## Production changes completed

Modified `src/shelf/shelf-row.ts` only.

### Ledger-owned constants threaded into the shelf

- Imported `COLD_START_MIN_SUCCESSES` from `src/ledger/recalibrate.ts`.
- Imported `DEFAULT_WINDOW` from the same module.
- Retained the existing `recalibrate` value import.
- Imported `RecalibrateResult` type-only.
- No new dependency edge beyond the existing ledger-to-shelf composition was introduced.

### Confidence count ranges

- Added an internal `Enumerate` type for bounded integer literals.
- Added an internal inclusive `IntegerRange` type.
- Exported `ColdStartRunCount`.
- Its current range is `1 | 2`, derived from the ledger threshold.
- Exported `MeasuredRunCount`.
- Its current range is 3 through 100, derived from threshold and default ledger window.
- Zero is not a member of either runs-bearing range.
- Existing positive literal fixtures such as measured `runs: 5` remain valid.

### Confidence union

`ShelfConfidence` now has three structural states:

1. measured with `MeasuredRunCount`;
2. default without a runs field for genuinely zero evidence;
3. default with `ColdStartRunCount` for thin-but-real evidence.

The `kind` field continues to identify envelope provenance. The presence of `runs` distinguishes
the two default evidence levels without relabeling either one as measured.

### Pure ledger-result mapping

- Added `isColdStartRunCount`.
- Added `isMeasuredRunCount`.
- Both predicates validate integer and ledger-bound ranges.
- Added private `shelfConfidence(result)` composition.
- Measured source plus a valid measured count maps to measured confidence.
- Prior source plus zero maps to count-free default.
- Prior source plus 1–2 maps to runs-bearing default.
- Impossible source/count combinations throw a diagnostic invariant error.
- `shelfRows` now delegates its confidence mapping to that helper.
- Envelope, name, summary, order, and record filtering behavior remain unchanged.

### Rendering

- Zero default remains exactly `(default — no runs yet)`.
- One successful cold-start run renders `(default — 1 run, measured at 3)`.
- Two successful cold-start runs render `(default — 2 runs, measured at 3)`.
- The threshold comes from `COLD_START_MIN_SUCCESSES`, not a production literal.
- Measured rows retain `(measured · N runs)`.
- The default `~` envelope prefix is unchanged.
- Layout, column sizing, budget formatting, empty shelf, and order are unchanged.

## Test changes completed

Modified `src/shelf/shelf-row.test.ts` only.

- Retained the zero-record mapping assertion.
- Added one-success mapping assertion with `{ kind: "default", runs: 1 }`.
- Updated two-success mapping assertion to `{ kind: "default", runs: 2 }`.
- Retained authored-budget assertions for all default cases.
- Added positive type constructions for empty default, thin 1, thin 2, and measured 3.
- Added `@ts-expect-error` for `{ kind: "measured", runs: 0 }`.
- Added `@ts-expect-error` for `{ kind: "default", runs: 0 }`.
- Replaced the now-invalid measured-one fixture with thin-default singular/plural labels.
- Added real mapping-to-render seams for one and two successful histories.
- Retained the real zero-history seam and all layout tests.

## Focused verification

After implementation:

```text
bun test src/shelf/shelf-row.test.ts
19 pass, 0 fail, 38 expect() calls
```

```text
bun run check:typecheck
exit 0
```

```text
git diff --check -- src/shelf/shelf-row.ts src/shelf/shelf-row.test.ts
exit 0
```

The focused suite grew by three tests and six expectations.

## Deviation from plan

The first post-edit typecheck reported:

```text
TS2367: comparison between MeasuredRunCount and 1 has no overlap
```

Cause: the old measured renderer retained singular grammar for a one-run measured fixture, but
the ledger threshold is three. The refined type correctly identified that branch as unreachable.

Resolution:

- removed the unreachable measured singular conditional;
- moved singular coverage to the real one-run default state;
- reran typecheck and focused tests successfully.

This is a type-driven cleanup consistent with the design, not a scope expansion.

## Scope preservation

- No changes to `src/ledger/recalibrate.ts`.
- No recalibration math or threshold changes.
- No changes to `src/shelf/menu.ts`.
- No changes to `src/shelf/home.ts` or `src/shelf/home.test.ts`.
- No run-log, budget, CLI, persistence, or executor changes.
- No ticket frontmatter phase/status edits.
- No ordinary Git staging or commits used.
- Unrelated dirty files remain untouched.

## Full repository gate

Command:

```text
bun run check
```

Result:

```text
BAML code generation: passed (14 files generated, no ticket diff)
TypeScript no-emit check: passed
Full Bun suite: 1749 pass, 1 skip, 0 fail, 5510 expect() calls
116 test files, 7.78 seconds
exit 0
```

The one skipped test is the repository's existing opt-in release acceptance test, which reports
that no `dist/` artifacts are present. It is unrelated to this ticket and is not a failure.

## Acceptance status after full gate

- 1-run thin default label: passing focused mapping/render tests.
- 2-run thin default label: passing focused mapping/render tests.
- 0-run default label: passing focused mapping/render tests.
- measured-zero unconstructable: passing TypeScript `@ts-expect-error` gate.
- default runs-bearing zero unconstructable: passing additional type gate.
- authored prior retained: passing focused tests.
- ledger threshold reused: implemented through direct constant import.
- full repository `bun run check`: passed.
- Lisa ticket commit: passed.
- review artifact: pending.

## Lisa ticket commit

Command:

```text
lisa commit-ticket \
  --ticket-id T-075-03-01 \
  --message "fix(shelf): show thin cold-start run counts (T-075-03-01)" \
  --include src/shelf/shelf-row.ts \
  --include src/shelf/shelf-row.test.ts
```

Result:

```text
59c23ad720cdd8e45a656c8b8d01484c76ffb94f
```

Post-commit inspection confirms:

- commit subject is `fix(shelf): show thin cold-start run counts (T-075-03-01)`;
- commit contains exactly `src/shelf/shelf-row.ts` and `src/shelf/shelf-row.test.ts`;
- ticket-owned production and test files have no remaining working-tree diff;
- the ordinary Git index is empty;
- unrelated Lisa/ticket/work state remains dirty and was not included;
- no ordinary `git add` or `git commit` was used.

## Remaining work

- Write `review.md` in the private attempt directory.
- Stop on this ticket and wait for Lisa completion publication/confirmation.
