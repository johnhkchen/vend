# Plan — T-075-04-01

## Objective

Correct the `vend svg` completion line so each of `group`, `card`, and `link`
uses singular grammar at count one and plural grammar otherwise. Pin the exact
user-visible line in the adjacent CLI test while leaving SVG counts, grouping,
rendering, filesystem behavior, parsing, and exit behavior unchanged.

## Preconditions

- Parent story and ticket contract have been read.
- Vision, charter, stack, and RDSPI workflow have been read.
- The relevant source and tests have been mapped.
- The existing count producer has been confirmed correct.
- The worktree's unrelated dirty paths have been recorded.
- `src/cli.ts` and `src/cli.test.ts` are clean before implementation.
- `lisa commit-ticket --help` has confirmed exact include syntax.

## Step 1 — add the pure formatter

Modify `src/cli.ts` near the existing pure CLI formatting helpers.

1. Add a private helper that formats a count plus a regular noun.
2. Make singular selection depend on `count === 1`.
3. Make all other values select the plural `s` suffix.
4. Add exported `formatSvgWriteLine`.
5. Accept path, group count, card count, and link count as plain values.
6. Compose the exact established write-line shape.
7. Include the trailing newline in the returned value.
8. Add a concise doc comment describing the pure grammar boundary.

Verification after Step 1:

- TypeScript syntax is valid.
- The function performs no effects.
- The path and counts appear once and in the established order.
- Each noun is formatted independently.

## Step 2 — wire the dispatch shell

Modify the SVG command arm in `src/cli.ts`.

1. Remove only the inline unconditional plural template.
2. Call `formatSvgWriteLine` with the four fields from `result`.
3. Pass that returned string directly to `process.stdout.write`.
4. Retain `process.exit(0)`.
5. Retain the lazy imports and `writeBoardSvg` arguments.

Verification after Step 2:

- No argument parsing changes are present.
- No output path manipulation changes are present.
- No count calculations move into the CLI.
- Successful SVG execution still performs one stdout write and exits zero.

## Step 3 — add the CLI regression tests

Modify `src/cli.test.ts`.

1. Import `formatSvgWriteLine` from `./cli.ts`.
2. Add a focused formatter describe block beside the SVG parser tests.
3. Add an exact singular assertion using counts `1, 1, 1`.
4. Expect `1 group, 1 card, 1 link` in the full line.
5. Add an exact plural assertion using distinct counts greater than one.
6. Expect `2 groups, 3 cards, 4 links` in the full line.
7. Include the expected trailing newline in both assertions.

Verification after Step 3:

- The singular test would fail against the pre-change implementation.
- The plural test preserves the existing behavior for N greater than one.
- Distinct plural counts prove the fields are ordered correctly.
- The exact comparison pins punctuation and spacing as well as noun grammar.

## Step 4 — run focused verification

Run:

```bash
bun test src/cli.test.ts
```

Expected result:

- all CLI tests pass;
- the new singular test passes;
- the new plural test passes;
- importing `src/cli.ts` triggers no dispatch effects.

If the targeted test fails:

- inspect only the formatter, call site, import, and new expectations;
- correct the smallest relevant source unit;
- rerun the targeted test before continuing.

## Step 5 — inspect the source diff

Run a scoped diff over:

```text
src/cli.ts
src/cli.test.ts
```

Review criteria:

- only the intended helper, formatter, call-site, import, and tests changed;
- no unrelated reformatting is present;
- no ticket frontmatter changed by the worker;
- no grouping or SVG modules changed;
- the output format is byte-identical for plural counts;
- the output line is grammatical for singular counts.

## Step 6 — run the repository gate

Run:

```bash
bun run check
```

This verifies:

1. BAML code generation completes.
2. TypeScript typechecking completes.
3. The full Bun test suite passes.

The gate must be green before commit. If BAML generation modifies generated
files, inspect whether those are expected tool output. Do not include unrelated
generated or pre-existing paths in this ticket commit.

## Step 7 — record implementation progress

Write `progress.md` in the private attempt directory.

Record:

- completed implementation steps;
- exact source files changed;
- focused test outcome;
- full gate outcome;
- any deviations from this plan;
- commit command and resulting commit identifier;
- remaining work before review.

Progress documentation is not a substitute for a green gate or source commit.

## Step 8 — commit the meaningful source unit

Commit only the two ticket-owned source paths:

```bash
lisa commit-ticket \
  --ticket-id T-075-04-01 \
  --message "fix(cli): pluralize svg write counts" \
  --include src/cli.ts \
  --include src/cli.test.ts
```

Do not use:

- `git add`;
- `git add -A`;
- ordinary `git commit`;
- broad include paths;
- unrelated Lisa or board paths.

The implementation and adjacent test are one atomic source unit, so one commit
transaction is appropriate.

## Step 9 — verify post-commit state

Run read-only status and history checks.

Confirm:

- the new commit is at HEAD or otherwise recorded by Lisa's transaction;
- `src/cli.ts` has no uncommitted ticket-owned changes;
- `src/cli.test.ts` has no uncommitted ticket-owned changes;
- neither source file is staged;
- pre-existing unrelated changes remain outside the commit;
- attempt-private phase artifacts remain available for Lisa publication.

If ticket-owned source remains dirty, resolve it before Review. The assignment
forbids leaving ticket-owned files modified, staged, or untracked.

## Step 10 — Review phase

Write `review.md` in the private attempt directory.

The review will cover:

- exact source changes;
- exact output behavior before and after;
- test coverage and results;
- acceptance criterion evaluation;
- story boundary compliance;
- unchanged interfaces and effects;
- commit details;
- open concerns or limitations.

Then write `review-disposition.json` with exactly one of:

```json
{"disposition":"pass","reason":null}
```

or, only if an actionable blocker remains:

```json
{"disposition":"block","reason":"<non-empty actionable reason>"}
```

## Acceptance mapping

Ticket acceptance:

> A cli test asserts the write line reads '1 group, 1 card, 1 link' at count 1
> and the plural forms at N>1.

Implementation evidence:

- production SVG stdout uses `formatSvgWriteLine`;
- singular exact-string test covers count one for all three nouns;
- plural exact-string test covers counts greater than one for all three nouns;
- the full repository gate passes;
- source and tests are committed together through Lisa.

## Scope guard

Do not modify:

- status-axis grouping behavior;
- `DESIGNER_PRESET`;
- `projectGraph`;
- `writeBoardSvg` count calculation;
- SVG layout or output bytes;
- board content or frontmatter;
- CLI command naming;
- package dependencies or Bun version.

Any discovered grouping issue is sibling-ticket information, not a reason to
expand T-075-04-01.

## Completion criteria

- `formatSvgWriteLine` is pure and used by the real SVG dispatch arm.
- Singular count output is exact and grammatical.
- Greater-than-one output remains exact and plural.
- Targeted CLI tests pass.
- `bun run check` passes.
- Exact ticket-owned source paths are committed with `lisa commit-ticket`.
- No ticket-owned source is left dirty or staged.
- `progress.md`, `review.md`, and `review-disposition.json` exist privately.
- Review disposition is honest and matches the verified result.
