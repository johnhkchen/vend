# Plan — T-074-02-01 underfunding decision core

## Goal

Land the smallest reusable, addon-free decision unit that warns on severe token
underfunding and stays silent for adequate/near-floor funding.

## Step 1 — Add the pure decision core

Create `src/shelf/underfunding-core.ts`.

Actions:

1. Document the module's counter-policy role and T-074-02-02 boundary.
2. Import `Budget` with `import type` only.
3. Export `UNDERFUNDING_FACTOR = 2`.
4. Add a private human-scale token formatter.
5. Export `underfundingWarning(funded, floor): string | null`.
6. Return `null` when funded tokens are at least half the measured floor.
7. Otherwise return a one-line warning with both values and “proceeding” semantics.

Verification:

- inspect import graph visually: no value imports;
- run TypeScript through the targeted/build gates after tests exist;
- confirm no I/O APIs occur in the file.

## Step 2 — Add fixture tests

Create `src/shelf/underfunding-core.test.ts`.

Actions:

1. Import only Bun test helpers, the `Budget` type, and the new core exports.
2. Add a plain budget fixture helper.
3. Pin `UNDERFUNDING_FACTOR` to 2 so policy drift is explicit.
4. Test the field-report case: 12.5k funded / 400k floor returns a warning.
5. Assert the warning names `12.5k`, `400k`, “measured floor,” and proceeding.
6. Test exact floor and above floor return `null`.
7. Test a near-floor allocation returns `null`.
8. Test exact half-floor returns `null`.
9. Test one token below half-floor warns.
10. Test time underfunding alone stays silent when tokens are adequate.

Verification:

```bash
bun test src/shelf/underfunding-core.test.ts
```

Expected: all new fixtures pass in an ordinary Bun process without addon initialization.

## Step 3 — Run static and focused verification

Actions:

1. Run the targeted test file.
2. Run `bun run build` for the full TypeScript graph.
3. Inspect the source diff.
4. Search the new core for forbidden effect imports/usages.

Verification criteria:

- typecheck green;
- targeted tests green;
- only the two intended source files changed for this ticket;
- no filesystem, clock, process, network, executor, BAML, ledger, or shell dependency;
- exact factor-boundary behavior is visible in tests.

## Step 4 — Commit the meaningful source unit

Use only Lisa's isolated commit mechanism:

```bash
lisa commit-ticket \
  --ticket-id T-074-02-01 \
  --message "feat(shelf): add underfunding warning decision" \
  --include src/shelf/underfunding-core.ts \
  --include src/shelf/underfunding-core.test.ts
```

Do not use `git add` or `git commit`.

Post-commit verification:

- `git status --short` shows neither source file modified/untracked/staged;
- unrelated Lisa/concurrent modifications remain untouched;
- `git show --stat --oneline HEAD` identifies only the intended unit if Lisa makes it
  current HEAD.

## Step 5 — Run the repository completion gate

Execute:

```bash
bun run check
```

This runs:

1. BAML code generation;
2. full TypeScript typecheck;
3. complete Bun test suite.

If generation changes a tracked generated file:

- inspect whether it is pre-existing/concurrent or caused by this ticket;
- do not absorb unrelated changes;
- the expected outcome is no ticket-owned generated change because this core does not
  touch BAML sources.

Acceptance verification:

- full gate exits zero;
- field-report fixture warns;
- adequately funded fixture is silent;
- no addon load occurs in the focused pure-core test;
- source work is committed.

## Step 6 — Document implementation progress

Write `progress.md` in the attempt-private work directory.

Record:

- completed source/test units;
- threshold and message actually implemented;
- commands and results;
- commit identifier/result;
- any deviations from this plan;
- unrelated working-tree state preserved.

Continue immediately to Review.

## Step 7 — Review

Inspect:

- committed diff;
- public API clarity;
- strict boundary semantics;
- message truthfulness;
- pure/addon-free dependency boundary;
- test coverage and missed cases;
- repository gate output;
- working-tree ownership.

Write `review.md` in the attempt-private work directory with an honest acceptance verdict.
Do not update ticket frontmatter or start the dependent ticket.

## Atomicity rationale

One source commit is appropriate:

- the function and its fixtures are one independently reviewable policy unit;
- splitting the test from the implementation would create an unverified intermediate
  commit;
- there are no shell or integration changes to separate;
- the dependent ticket consumes the settled export only after this unit lands.

## Risk controls

### Threshold ambiguity

Control: exported factor plus exact-boundary fixtures and design rationale.

### Accidental warning noise

Control: strict below-half comparison; floor, above-floor, near-floor, and exact-half
fixtures all require `null`.

### Message loses report precision

Control: fixture asserts 12,500 renders as `12.5k`, not rounded to `13k`.

### Scope creep into cold-start/wiring

Control: API accepts two concrete budgets only; no ledger/recalibration/shell imports.

### Native addon instability

Control: standalone core/test with only a type import from budget.

### Concurrent work contamination

Control: exact Lisa include paths and post-commit status inspection.
