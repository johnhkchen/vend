# Structure — T-072-03-01

## Change inventory

### Modify `src/cli.ts`

This file continues to own the public pure `parseBudgetArg` function.

Add two private, module-local multiplier tables near the parser:

- time suffix multipliers;
- token suffix multipliers.

Add one private pure numeric-field helper near `parseBudgetArg`.

Update `parseBudgetArg` to:

- preserve comma arity validation;
- preserve blank-field validation;
- trim each field once;
- invoke the helper with the correct position-specific table;
- use the existing malformed-field `RangeError` when either result is invalid;
- return the same `Budget` shape.

Update its documentation to describe both raw and humane forms without claiming
that parser-level positivity is enforced.

No command-routing or dispatch code changes.

### Modify `src/cli.test.ts`

Extend the existing `parseBudgetArg` describe block.

Add coverage for:

- equivalence of minute/thousand notation and raw notation;
- hour/decimal-million conversion;
- unchanged raw form;
- malformed suffix constructor and message family.

Retain every existing test in the block.

### Create private phase artifacts

Under `.lisa/attempts/T-072-03-01/1/work/`:

- `research.md`;
- `design.md`;
- `structure.md`;
- `plan.md`;
- `progress.md`;
- `review.md`.

These are attempt state, not ticket-owned source commit paths. Lisa publishes
admitted artifacts separately.

### Delete nothing

No source, test, documentation, or generated file is removed.

## Module boundary

`src/cli.ts` remains the boundary for translating external argv strings into
plain typed command values.

The conversion flow is:

```text
budget argument string
  -> comma arity check
  -> blank-field check
  -> time field + time unit table
  -> token field + token unit table
  -> shared integer-result check
  -> Budget { timeMs, tokens }
```

No impure operation enters this flow.

## Private data structures

Use immutable object literals for suffix multipliers.

Conceptual shape:

```ts
Readonly<Record<string, number>>
```

Time and token tables stay distinct even though both contain `m` because their
meaning is determined by field position.

The tables are implementation data, not exports.

## Private helper interface

Conceptual signature:

```ts
function parseBudgetField(
  field: string,
  units: Readonly<Record<string, number>>,
): number | undefined
```

Responsibilities:

- try the preserved raw numeric conversion;
- recognize the full humane field grammar;
- reject unsupported suffix keys;
- multiply quantity by the selected unit;
- return only integer results.

Non-responsibilities:

- delimiter handling;
- whitespace trimming beyond the already-trimmed field contract;
- choosing whether the field is time or tokens;
- constructing user-facing errors;
- checking positivity;
- applying wall-clock or token hard walls.

## Public interface

No new export is introduced.

The existing signature remains:

```ts
export function parseBudgetArg(s: string): Budget
```

The behavioral input domain expands, but its output type and error type remain
stable.

All current callers continue to receive numeric `Budget` values and require no
changes.

## Error ownership

`parseBudgetArg` remains the sole constructor of its two `RangeError` categories:

- wrong arity;
- malformed fields.

The helper signals invalid input with `undefined`; it does not throw.

This separation prevents helper-specific error messages from leaking through
the command-specific usage wrappers.

## Test organization

The test file already groups parser behavior at the top.

The new assertions remain in that group so reviewers can see the entire grammar
contract together.

Suggested cases:

```ts
expect(parseBudgetArg("40m,350k")).toEqual(
  parseBudgetArg("2400000,350000"),
);

expect(parseBudgetArg("2h,1.5m")).toEqual({
  timeMs: 7_200_000,
  tokens: 1_500_000,
});
```

For malformed suffix behavior, capture the call in an expectation twice or use
a small closure so both constructor and message family are pinned:

```ts
const malformed = () => parseBudgetArg("40x,350k");
expect(malformed).toThrow(RangeError);
expect(malformed).toThrow(/integers/);
```

## Dependency direction

- `src/cli.ts` continues to import only the `Budget` type for this behavior.
- It does not import `src/shelf/menu.ts`.
- It does not import budget enforcement functions.
- Tests import the public parser as before.
- No circular dependency is introduced.

## Change ordering

1. Add acceptance tests to expose the missing behavior.
2. Run the focused suite and confirm the new tests fail for the expected parser
   reason while existing tests remain green.
3. Add the private tables and helper.
4. Route the two fields through the helper.
5. Run focused and repository-wide verification.
6. Commit both ticket-owned source paths together through Lisa.

Tests may be written before implementation, but the ticket's meaningful source
unit is the completed parser behavior plus its tests. They will therefore share
one exact-path ticket commit.

## Files explicitly untouched

- `src/shelf/menu.ts`: formatter and later echo dependency.
- `src/budget/budget.ts`: hard-contract enforcement.
- command dispatch arms in `src/cli.ts`.
- ticket frontmatter: Lisa owns phase/status transitions.
- `docs/active/work/T-072-03-01/`: Lisa owns publication.
- unrelated Lisa provenance, ticket, and work files already modified by other
  activity in the shared tree.

## Verification boundary

Focused verification:

```bash
bun test src/cli.test.ts
```

Repository gate:

```bash
bun run check
```

Commit boundary:

```bash
lisa commit-ticket \
  --ticket-id T-072-03-01 \
  --message "feat(cli): parse humane budget units (T-072-03-01)" \
  --include src/cli.ts \
  --include src/cli.test.ts
```

Postcondition: both exact ticket-owned source paths are clean and no unrelated
path was staged or committed.
