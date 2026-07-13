# Progress — T-072-03-02

## Status

Implementation, verification, and the Lisa source commit are complete. Only the
final review artifact remains.

## Baseline

Before source changes:

```bash
bun test src/cli.test.ts
```

Result:

- 113 tests passed;
- 0 tests failed;
- 211 expectations passed;
- one file executed.

`src/cli.ts` and `src/cli.test.ts` were clean. The only visible pre-existing
changes were Lisa-owned `.lisa/provenance.jsonl` and ticket frontmatter state.

## Test-first acceptance coverage

Added a subprocess suite to `src/cli.test.ts` that invokes:

```text
bun src/cli.ts run missing-play ignored.md --budget 40m,350k
bun src/cli.ts run missing-play ignored.md --budget 2400000,350000
```

The deliberately missing play reaches the name-based dispatcher but returns its
typed registry refusal before any cast starts. This keeps the harness free of
executor calls, tokens, run logs, transcripts, and board writes.

The test requires:

- exact stdout `funding ~40m/350k\n`;
- exact equality between raw and humane stdout;
- exactly one line per invocation;
- existing exit code `2`;
- existing typed unknown-play stderr.

## Red evidence

The first focused run after adding the test produced:

- 113 tests passed;
- 1 test failed;
- 212 expectations executed.

The sole failure showed expected stdout `funding ~40m/350k\n` versus actual
empty stdout. All pre-existing CLI tests remained green.

## Harness correction deviation

The initial harness argv accidentally omitted the literal `run` verb and thus
exercised the unknown-command parser refusal rather than the generic run
dispatcher. That was a test construction defect, not product behavior.

It was corrected before assessing the implementation by changing argv from:

```text
missing-play ignored.md --budget ...
```

to:

```text
run missing-play ignored.md --budget ...
```

The exact stderr expectation was then aligned with the existing typed registry
message:

```text
play "missing-play" is not registered — available: decompose-epic
```

No production change was made to accommodate the harness.

## `src/cli.ts` implementation

### Formatter reuse

Added a static value import of `formatBudget` from `src/shelf/menu.ts`.

This module is the existing pure, addon-free home of the shelf's humane budget
vocabulary. No time or token unit conversion logic was duplicated in the CLI.

### Pure line composition

Added private:

```ts
function formatFundingLine(budget: Budget): string {
  return `funding ~${formatBudget(budget)}`;
}
```

The helper is pure, accepts the parsed numeric budget, and leaves the newline and
write effect to the CLI shell.

### Dispatch arms

Added an explicit-budget write immediately before dispatch in:

- shelf `select`;
- `chain`;
- `expand`;
- `survey`;
- `steer`;
- required-budget `run`.

The optional arms guard on `parsed.budget !== undefined`. The required `run` arm
writes unconditionally after parsing and before calling `runPlay`.

Each write is exactly:

```ts
process.stdout.write(`${formatFundingLine(parsed.budget)}\n`);
```

### Preserved behavior

- The original `Budget` object continues into downstream calls unchanged.
- Implicit play, ledger-funded, and warranted defaults are unchanged and are not
  described as parsed input.
- A uniform chain or selection override receives one gesture-level line, not one
  line per downstream cast.
- `annotate` remains unchanged because it exposes no parsed budget.
- Exit codes, run summaries, halt errors, registry errors, and parse errors are
  unchanged.
- Formatter behavior and parser grammar are unchanged.

## Focused green verification

Commands:

```bash
bun test src/cli.test.ts
bun run build
git diff --check -- src/cli.ts src/cli.test.ts
```

Results:

- 114 tests passed;
- 0 tests failed;
- 213 expectations passed;
- TypeScript `tsc --noEmit` passed;
- diff hygiene passed.

The source diff contains 43 insertions across the two ticket-owned files:

- 12 lines in `src/cli.ts`;
- 31 lines in `src/cli.test.ts`.

## Acceptance state

- `--budget 40m,350k` CLI harness: PASS.
- Exact `funding ~40m/350k` line: PASS.
- One line: PASS through exact stdout.
- Derived through `formatBudget(parsed budget)`: PASS by implementation.
- Written before dispatch/cast call: PASS by call-site ordering.
- Raw `2400000,350000` output identical: PASS through direct subprocess result
  equality.
- No cast begins in the harness: PASS through registry miss before assembly.

## Repository-wide gate

Command:

```bash
bun run check
```

Result:

- BAML client generation passed with CLI version `0.223.0`;
- TypeScript passed;
- 1,665 tests passed;
- 1 test was intentionally skipped because local `dist/` artifacts were absent;
- 0 tests failed;
- 5,101 expectations passed across 111 files.

The new funding-echo subprocess test passed inside the full suite.

## Remaining work

Write `review.md` with final evidence and open concerns.

## Source commit

Committed through the required exact-path mechanism:

```text
feb8b3edbd2484bbff51c58da37687008868a1f3
feat(cli): echo parsed funding humanely (T-072-03-02)
```

Exact includes:

- `src/cli.ts`;
- `src/cli.test.ts`.

`git show` confirms the commit contains only those two paths and 43 insertions.
Both ticket-owned source paths are clean after commit. Lisa-owned provenance,
ticket phase, and published work-artifact changes remain outside the ticket
source commit as required.
