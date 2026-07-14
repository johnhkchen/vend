# Progress — T-072-03-01

## Status

Implementation, verification, and exact-path source commit are complete. Review
is the only remaining phase.

## Completed work

### Required context

- Read `.lisa/attempts/T-072-03-01/1/work/assignment.md`.
- Read `AGENTS.md`.
- Read `docs/knowledge/rdspi-workflow.md`.
- Read `docs/knowledge/vision.md`.
- Read `docs/knowledge/charter.md`.
- Read `docs/knowledge/stack.md`.
- Read parent story `docs/active/stories/S-072-03.md` before the ticket.
- Read ticket `docs/active/tickets/T-072-03-01.md`.
- Inspected `src/cli.ts`, `src/cli.test.ts`, `src/shelf/menu.ts`, and the
  downstream budget integer contract.
- Confirmed `lisa commit-ticket` exact option syntax.

### Research, Design, Structure, Plan

- Wrote `research.md` in the private attempt directory.
- Wrote `design.md` in the private attempt directory.
- Wrote `structure.md` in the private attempt directory.
- Wrote `plan.md` in the private attempt directory.
- Continued between phases as required.

### Red acceptance test

Modified `src/cli.test.ts` first.

Added assertions for:

- `40m,350k` equivalence with `2400000,350000`;
- exact `2h,1.5m` conversion;
- exact unchanged raw result;
- malformed `40x,350k` `RangeError` constructor;
- existing `integers` message family.

Ran:

```bash
bun test src/cli.test.ts
```

Observed expected red result:

- 112 passed;
- 1 failed;
- the only failure was the new humane success test;
- the failure was the current `--budget fields must be integers` `RangeError` on
  `40m,350k`;
- the malformed-suffix acceptance test already passed through the desired error
  shape.

### Parser implementation

Modified `src/cli.ts`.

Added private immutable multiplier maps:

- time `h`, `m`, `s` to milliseconds;
- tokens `k`, `m` to counts.

Added private pure `parseBudgetField`:

- tries the existing `Number` plus integer path first;
- otherwise matches a strict full-field decimal-plus-lowercase-suffix grammar;
- resolves the suffix from the field-specific unit table;
- returns only integer scaled results;
- signals malformed fields with `undefined` so `parseBudgetArg` remains the owner
  of the established error.

Updated `parseBudgetArg`:

- retained comma arity validation;
- retained blank validation;
- routes time and token fields through their respective tables;
- retains the existing malformed-field `RangeError` message;
- retains the same `Budget` output shape;
- documents the expanded grammar and unchanged downstream positivity boundary.

### Focused green verification

Ran:

```bash
bun test src/cli.test.ts
bun run build
git diff --check -- src/cli.ts src/cli.test.ts
```

Results:

- focused CLI suite: 113 passed, 0 failed, 211 expectations;
- TypeScript `tsc --noEmit`: passed;
- diff whitespace check: passed.

Reviewed the exact diff. It contains only parser conversion behavior,
documentation, and direct acceptance tests. It contains no dispatch echo,
formatter, budget enforcement, or unrelated CLI changes.

### Full repository gate

Ran:

```bash
bun run check
```

Results:

- BAML client generation: passed, 14 files generated with no source diff;
- TypeScript check: passed;
- full suite: 1,664 passed, 1 skipped, 0 failed;
- total: 1,665 tests across 111 files, 5,099 expectations.

The one skipped test is the repository's intentional real-dist acceptance test
when no `dist/` artifacts exist.

### Working-tree audit before commit

- `src/cli.ts` and `src/cli.test.ts` are the only ticket-owned modified source
  paths.
- No ordinary-index path is staged.
- `.lisa/provenance.jsonl` and the ticket frontmatter are Lisa-owned changes.
- Lisa has begun publishing admitted artifacts under
  `docs/active/work/T-072-03-01/`; those files were not written directly by this
  worker and will not be included in the source commit.
- Concurrent/unrelated changes remain outside the exact source include list.

## Deviations from plan

- None in source design or scope.
- Lisa automatically admitted phase artifacts during the continuous pass, so the
  shared work path appeared in repository status. This is expected Lisa behavior;
  the worker continued writing only to the private attempt path.

## Source commit

Committed the meaningful parser-plus-tests unit using exactly:

```bash
lisa commit-ticket \
  --ticket-id T-072-03-01 \
  --message "feat(cli): parse humane budget units (T-072-03-01)" \
  --include src/cli.ts \
  --include src/cli.test.ts
```

Result:

- commit: `6855e085bb0ef683d5a2880552584ae929f5ebaf`;
- subject: `feat(cli): parse humane budget units (T-072-03-01)`;
- included paths: `src/cli.ts`, `src/cli.test.ts` only;
- diff summary: 2 files changed, 47 insertions, 8 deletions.

Post-commit audit:

- `src/cli.ts` is clean;
- `src/cli.test.ts` is clean;
- neither path is staged, modified, or untracked;
- `git show --name-only` lists exactly the two requested include paths;
- unrelated Lisa-owned provenance/frontmatter and admitted work artifacts remain
  untouched in the working tree.

## Remaining work

- Write `review.md`.
- Stop on this ticket and wait for Lisa completion handling.
