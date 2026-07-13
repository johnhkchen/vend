# Research — T-072-03-01

## Assignment and phase state

- The ticket is `T-072-03-01`, `parse-humane-budget-units`.
- Its current phase is `research`, so all six RDSPI phases remain.
- Phase artifacts must be written only under
  `.lisa/attempts/T-072-03-01/1/work/`.
- Lisa owns ticket phase/status transitions and publication into
  `docs/active/work/T-072-03-01/`.
- Ticket source commits must use `lisa commit-ticket` with exact
  repository-relative include paths.
- The ordinary Git index and unrelated working-tree changes must not be touched.

## Parent story contract

- The parent is `S-072-03`, `humane-budget-units`.
- The story concerns two surfaces in `src/cli.ts`:
  - parsing human budget notation;
  - echoing a funded budget through the existing `formatBudget` formatter.
- The story splits those surfaces into two serialized tickets.
- This ticket owns the load-bearing pure parser change.
- `T-072-03-02` depends on this ticket and owns the funding echo.
- The accepted input examples are:
  - `40m,350k`;
  - `2h,1.5m`;
  - the existing raw `<ms>,<tokens>` form.
- Time suffixes in the story ceiling are `h`, `m`, and `s`.
- Token magnitude suffixes in the story ceiling are `k` and `m`.
- Compound durations such as `1h30m` are explicitly out of scope.
- Budget enforcement semantics are explicitly out of scope.
- The live spend line and its formatting are owned by another story.

## Ticket acceptance

- `parseBudgetArg("40m,350k")` must deep-equal
  `parseBudgetArg("2400000,350000")`.
- `parseBudgetArg("2h,1.5m")` must return
  `{ timeMs: 7200000, tokens: 1500000 }`.
- The raw input form must continue to round-trip unchanged.
- `parseBudgetArg("40x,350k")` must throw the existing `RangeError` shape.
- These behaviors must be asserted in `src/cli.test.ts`.

## Current parser

- `parseBudgetArg` is exported from `src/cli.ts`.
- It is documented and implemented as a pure function.
- It first splits the input on commas.
- It requires exactly two fields.
- Wrong arity throws `RangeError` with the message family
  `--budget must be "<ms>,<tokens>"`.
- It explicitly rejects blank fields before numeric coercion.
- Blank or non-integer fields throw `RangeError` with the message family
  `--budget fields must be integers`.
- Each trimmed field is currently passed through `Number`.
- `Number.isInteger` is the final parser-level shape check.
- Positive integer enforcement is intentionally downstream in the budget module.
- Therefore values such as zero and negative integers are currently parser-valid.
- This ticket must not silently move that downstream contract into CLI parsing.

## Parser consumers

- `parseBudgetArg` is the common budget parser for all CLI budget surfaces.
- It is used by run, chain, expand, survey, steer, shelf selection, and envelope
  parsing paths.
- Those command-specific parsers catch its errors and turn them into usage results.
- Extending this one pure function therefore makes humane notation available to
  all existing budget-bearing commands without changing their shells.
- No filesystem, clock, network, executor, or BAML dependency is involved.

## Current tests

- `src/cli.test.ts` imports `parseBudgetArg` directly.
- The existing `parseBudgetArg` suite checks raw integer parsing.
- It also checks surrounding whitespace on raw fields.
- It checks wrong arity separately from malformed fields.
- It checks alphabetic fields, a blank token field, and a decimal raw time field.
- Existing assertions use `.toThrow(/integers/)` for malformed fields.
- No current test checks the exact error message.
- No current test checks the error constructor explicitly.
- The ticket specifically calls for the existing `RangeError` shape, so the new
  malformed-suffix assertion must preserve both constructor and message family.

## Existing budget types and enforcement

- `Budget` is defined in `src/budget/budget.ts` as numeric `timeMs` and `tokens`.
- Downstream `assertPositiveInt` requires a positive finite integer when the run
  actually consumes the budget.
- `Number.isInteger` also rejects infinities and `NaN` in the parser.
- Unit multiplication must still produce integers to preserve the parser's
  existing guarantee.
- Decimal token magnitudes are required by `1.5m`.
- Decimal raw time is currently rejected and must remain rejected.
- The grammar therefore needs to distinguish suffixed decimal quantities from
  unsuffixed raw integers.

## Existing humane formatting vocabulary

- `src/shelf/menu.ts` exports `formatBudget`.
- Its time output uses `h`, `m`, or `s`.
- Its token output uses `k` for counts of at least one thousand.
- The story additionally requires `m` as an accepted token magnitude.
- The formatter is not needed to parse input and is not owned by this ticket.
- Importing it into the parser would reverse the natural dependency and would not
  provide parsing behavior.

## Grammar constraints visible from the contract

- The delimiter remains one comma.
- The first field is always time.
- The second field is always tokens.
- The same letter `m` has position-dependent meaning:
  - minutes in the time field;
  - millions in the token field.
- A raw field is an integer numeric string after trimming.
- A humane field has a numeric quantity followed by one supported suffix.
- `1.5m` proves decimal quantities are supported for token magnitude notation.
- `40x` proves unknown suffixes must not be accepted by loose numeric parsing.
- Compound or mixed-unit fields are not part of the accepted grammar.

## Repository and concurrency state

- The dependency commit `T-072-01-02` is present in Git history.
- `src/cli.ts` and `src/cli.test.ts` are clean at research time.
- The working tree contains Lisa-owned changes to provenance and ticket files.
- Another active ticket has files under `docs/active/work/T-072-04-01/`.
- Those changes are unrelated and must be preserved.
- Exact-path Lisa commits allow this ticket to avoid concurrent files.

## Verification surfaces

- The focused pure suite is `bun test src/cli.test.ts`.
- The repository-wide gate is `bun run check`.
- `bun run check` performs BAML generation, TypeScript checking, and the full test
  suite according to `AGENTS.md`.
- The full gate must be green before the ticket source commit.
- After committing, the exact ticket-owned source paths must be clean.

## Observed boundaries and assumptions

- Help/usage strings still describe the raw notation, but this ticket's acceptance
  names only parser behavior and tests.
- The parent story assigns only parsing and a later echo; help copy is not named.
- No new public module is required by the stated acceptance.
- The pure-core/impure-shell house rule is already satisfied by keeping conversion
  inside `parseBudgetArg` and tests beside the existing parser tests.
- Error compatibility means malformed humane notation should flow through the same
  malformed-field `RangeError` family as current non-integer input.
