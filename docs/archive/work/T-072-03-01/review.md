# Review — T-072-03-01

## Outcome

PASS. The ticket acceptance criteria are fully met.

`parseBudgetArg` now accepts the story's humane time and token suffixes while
preserving raw integer parsing and the established malformed-field `RangeError`
shape. The implementation is pure, fully covered by direct unit tests, green
under the repository gate, and committed through Lisa with exact ticket-owned
paths.

## Commit

- Commit: `6855e085bb0ef683d5a2880552584ae929f5ebaf`.
- Subject: `feat(cli): parse humane budget units (T-072-03-01)`.
- Commit method: `lisa commit-ticket`.
- Exact includes:
  - `src/cli.ts`;
  - `src/cli.test.ts`.
- No ordinary Git staging or commit workflow was used.
- Both ticket-owned paths are clean after commit.

## Files changed

### `src/cli.ts`

Added private time multipliers:

- `h` → 3,600,000 milliseconds;
- `m` → 60,000 milliseconds;
- `s` → 1,000 milliseconds.

Added private token multipliers:

- `k` → 1,000 tokens;
- `m` → 1,000,000 tokens.

Added private pure `parseBudgetField`, which:

- tries the legacy raw `Number` plus `Number.isInteger` behavior first;
- only then attempts strict suffixed decimal notation;
- matches the complete field rather than a numeric prefix;
- uses a position-specific multiplier table;
- accepts only conversions that produce integer budget values;
- returns `undefined` for the public parser to map to its existing error.

Updated `parseBudgetArg` to use the helper for each field and updated its
documentation to name the supported suffixes and unchanged downstream positivity
boundary.

No command dispatch or impure behavior changed.

### `src/cli.test.ts`

Extended the existing direct parser suite with:

- humane-to-raw equivalence;
- exact hour plus decimal-million conversion;
- explicit raw-result regression coverage;
- malformed suffix `RangeError` constructor coverage;
- malformed suffix existing-message-family coverage.

No test file was created because the existing suite is the direct and appropriate
home for this pure parser contract.

## Acceptance assessment

### `40m,350k` equals raw input

PASS.

The test directly compares:

```ts
parseBudgetArg("40m,350k")
parseBudgetArg("2400000,350000")
```

with deep equality.

### `2h,1.5m` exact result

PASS.

The test pins:

```ts
{ timeMs: 7_200_000, tokens: 1_500_000 }
```

### Raw form unchanged

PASS.

The helper tries the existing raw conversion before the new suffix grammar. The
test also directly pins `2400000,350000` to its unchanged numeric object.

Existing raw whitespace tests and raw decimal rejection remain green.

### Malformed `40x,350k` error shape

PASS.

The test asserts both:

- the constructor is `RangeError`;
- the message matches the existing `integers` family.

Unknown suffixes cannot be partially parsed because the suffix grammar is anchored
to the complete field and the suffix must exist in the field-specific table.

## Verification evidence

### Test-first evidence

Before implementation:

- 112 focused tests passed;
- 1 focused test failed;
- the only failure was the newly added humane-success acceptance case;
- malformed suffix behavior already passed the required error assertions.

This demonstrated that the test exercised the missing behavior rather than an
already-satisfied path.

### Focused green gate

Commands:

```bash
bun test src/cli.test.ts
bun run build
git diff --check -- src/cli.ts src/cli.test.ts
```

Results:

- 113 passed, 0 failed, 211 expectations;
- TypeScript passed;
- diff hygiene passed.

### Repository gate

Command:

```bash
bun run check
```

Results:

- BAML generation passed;
- TypeScript passed;
- 1,664 tests passed;
- 1 test intentionally skipped because local `dist/` artifacts were absent;
- 0 tests failed;
- 5,099 expectations passed across 111 test files.

## Compatibility review

- Public function signature is unchanged.
- `Budget` output shape is unchanged.
- Raw values still use the legacy conversion path first.
- Wrong comma arity retains its existing distinct error.
- Blank and malformed fields retain the existing error constructor/message family.
- Positivity remains downstream, so this parser does not alter hard-wall semantics.
- All existing budget-bearing command parsers benefit through their existing
  shared `parseBudgetArg` call sites.
- No new imports or module dependencies were introduced.

## Scope review

The implementation stays inside `T-072-03-01` and the parent story boundary.

Deliberately not implemented:

- compound duration grammar such as `1h30m`;
- uppercase unit aliases;
- slash-delimited formatter output parsing;
- budget hard-wall or detect-after changes;
- funding echo output;
- live spend formatting;
- help/usage copy changes.

The funding echo remains owned by dependent ticket `T-072-03-02`; no work on that
ticket was started.

## Test coverage assessment

Coverage is proportionate and complete for the ticket acceptance:

- required successful humane forms are directly pinned;
- required raw compatibility is directly pinned;
- required malformed suffix behavior is directly pinned;
- prior arity, blank, alphabetic, whitespace, and raw-decimal cases remain green;
- all command-specific parser regression tests passed through the shared parser.

No integration test is necessary for this pure exported function. The full CLI
suite provides indirect caller coverage, while the direct suite isolates unit
conversion behavior without executor or filesystem dependencies.

## Open concerns and limitations

No blocking concern or acceptance gap remains.

Known intentional limitations:

- humane suffixes are lowercase only;
- decimal notation is accepted only on the suffixed path;
- converted values must resolve to integers;
- the raw path retains legacy JavaScript `Number` syntax for compatibility;
- CLI usage strings continue to show raw `<ms>,<tokens>` notation because help
  copy was not assigned to this ticket or story acceptance.

These limitations are consistent with the explicit story ceiling and the chosen
compatibility-first design.

## Working-tree handoff

Ticket-owned source is clean. Remaining visible working-tree state belongs to
Lisa's provenance, ticket phase/frontmatter handling, and admitted phase artifact
publication. None was included in the ticket source commit.

Review is complete. Stop on `T-072-03-01`; Lisa owns completion publication and
seat release.
