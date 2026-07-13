# Plan — T-072-03-01

## Goal

Extend the pure CLI budget parser so supported human time/token suffixes convert
to the same numeric `Budget` values as raw milliseconds/tokens, while preserving
raw behavior and existing error shape.

## Constraints carried into implementation

- Work only in `src/cli.ts` and `src/cli.test.ts` for ticket-owned source.
- Keep parsing pure.
- Preserve raw `Number` plus integer semantics.
- Keep positivity enforcement downstream.
- Keep time and token unit vocabularies position-specific.
- Do not implement compound durations.
- Do not implement the funded-budget echo owned by `T-072-03-02`.
- Do not update ticket frontmatter or shared work artifacts.
- Do not touch unrelated working-tree changes.
- Commit only through `lisa commit-ticket` with exact includes.

## Step 1 — Add acceptance tests

Modify the existing `parseBudgetArg` suite in `src/cli.test.ts`.

Add a test for humane conversion that asserts:

- `40m,350k` deep-equals the result of `2400000,350000`;
- `2h,1.5m` equals `{ timeMs: 7_200_000, tokens: 1_500_000 }`.

Make the raw form explicit in the same coverage or retain an exact raw assertion
that proves its result remains unchanged.

Add a malformed-suffix test that asserts:

- `40x,350k` throws `RangeError`;
- the thrown message remains in the current `integers` family.

Verification:

```bash
bun test src/cli.test.ts
```

Expected intermediate result:

- new humane success assertions fail;
- the malformed suffix already fails through the correct error family;
- existing parser and CLI tests remain green apart from the new success cases.

If failures show an unrelated baseline problem, record it before changing source.

## Step 2 — Add private unit conversion data

Modify `src/cli.ts` near `parseBudgetArg`.

Add immutable module-local multiplier maps:

- time: h/m/s to milliseconds;
- tokens: k/m to scalar counts.

Use numeric separators for large constants where that improves readability.

Do not export the maps.

Verification:

- TypeScript accepts the map types.
- No public API or dependency changes.

## Step 3 — Add the pure field helper

Implement a private helper with a `number | undefined` result.

Algorithm:

1. Convert the field with `Number`.
2. If that result is an integer, return it unchanged.
3. Match the entire field against the strict suffixed numeric grammar.
4. If it does not match, return `undefined`.
5. Resolve the suffix in the passed table.
6. If unsupported, return `undefined`.
7. Multiply numeric quantity by its unit multiplier.
8. Return it only when the result is an integer.

Important regression behavior:

- `1.5` without a suffix remains invalid.
- `1.5m` with the token table becomes `1_500_000`.
- `40x` remains invalid.
- blank fields remain handled before the helper.
- negative raw integers retain their prior parser behavior.

## Step 4 — Integrate helper into `parseBudgetArg`

Trim both fields.

Call the helper with:

- time field and time table;
- token field and token table.

If either is `undefined`, throw the exact existing malformed-field `RangeError`.

Return `{ timeMs, tokens }` with no downstream changes.

Update the parser doc comment to mention supported humane forms and that the
function still guarantees integer shape rather than positivity.

## Step 5 — Focused verification

Run:

```bash
bun test src/cli.test.ts
```

Acceptance criteria for the focused suite:

- all tests pass;
- humane equivalence passes;
- decimal million passes;
- raw behavior passes;
- wrong arity passes;
- malformed suffix throws the pinned constructor/message family;
- existing command parse tests remain unaffected.

Review the exact source diff after the test:

```bash
git diff -- src/cli.ts src/cli.test.ts
```

Check that no echo, formatter, enforcement, or unrelated CLI behavior entered the
diff.

## Step 6 — Repository-wide gate

Run:

```bash
bun run check
```

The gate must complete with:

- BAML code generation successful;
- TypeScript check successful;
- full test suite successful.

If the gate changes generated files, determine whether they are expected. This
ticket should not own generated BAML output, so unexpected generated diffs must
not be included.

Record the exact test counts and any warnings in `progress.md`.

## Step 7 — Commit the meaningful source unit

Confirm the Lisa CLI syntax with the already inspected help output, then run:

```bash
lisa commit-ticket \
  --ticket-id T-072-03-01 \
  --message "feat(cli): parse humane budget units (T-072-03-01)" \
  --include src/cli.ts \
  --include src/cli.test.ts
```

This is one meaningful unit because the parser behavior and direct acceptance
tests form one atomic change.

Do not use `git add`, `git commit`, or an ordinary-index workflow.

## Step 8 — Post-commit audit

Run read-only checks:

```bash
git status --short
git status --porcelain=v1 -- src/cli.ts src/cli.test.ts
git log -1 --oneline
```

Verify:

- both ticket-owned source paths are clean;
- the new commit contains only those exact paths;
- unrelated Lisa and concurrent-ticket changes remain present and untouched;
- no ticket-owned source file is staged, modified, or untracked.

Optionally inspect:

```bash
git show --stat --oneline HEAD
git show --name-only --format= HEAD
```

## Step 9 — Complete artifacts

Write `progress.md` with:

- completed implementation steps;
- red/green focused test evidence;
- full-gate evidence;
- commit identifier and exact included paths;
- deviations, if any;
- remaining work, which should be only review.

Write `review.md` with:

- change summary;
- file inventory;
- acceptance-by-acceptance assessment;
- test coverage and command results;
- compatibility and scope assessment;
- open concerns or limitations;
- explicit statement if acceptance is not fully met.

After `review.md`, stop on this ticket. Lisa handles artifact admission, ticket
completion publication, and seat release.

## Definition of done for this attempt

- All six private phase artifacts exist.
- Ticket acceptance is met in `src/cli.test.ts`.
- `bun run check` is green.
- Ticket-owned source is committed through Lisa with exact paths.
- Ticket-owned source paths are clean afterward.
- Review is honest about any remaining limitations.
- No dependent ticket work has started.
