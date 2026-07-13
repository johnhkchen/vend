# Design — T-072-03-01

## Decision summary

Extend `parseBudgetArg` with a small pure field parser that:

1. preserves the current raw integer path;
2. recognizes a strict decimal-number-plus-suffix grammar;
3. uses position-specific multiplier tables for time and tokens;
4. requires the converted result to be an integer;
5. retains the existing arity and malformed-field `RangeError` families.

No command parser, dispatch arm, formatter, budget enforcement function, or help
surface changes in this ticket.

## Design forces

- Raw `<ms>,<tokens>` input is an existing public CLI contract.
- Humane time and token fields use overlapping suffix vocabulary.
- The suffix `m` means minutes in field one and millions in field two.
- Decimal magnitude is required for `1.5m` tokens.
- Raw decimals such as `1.5,2000` are already rejected.
- The parser currently guarantees integer shape but does not guarantee positivity.
- Malformed fields already have a stable error category and message family.
- Every budget-bearing CLI route reuses this one parser.
- The story reserves funded-budget echo work for the next ticket.

## Option 1 — one combined regular expression

A single expression could match the full comma-delimited argument and capture
time quantity, time suffix, token quantity, and token suffix.

Advantages:

- One match operation.
- The complete humane grammar is visible in one place.
- Wrong forms fail early.

Disadvantages:

- It duplicates delimiter/arity handling already present in `parseBudgetArg`.
- It makes preserving the current wrong-arity error family harder.
- Optional raw and suffixed alternatives make the expression dense.
- Position-specific suffix rules become hard to read.
- Raw behavior can drift because all legacy input is forced through a new grammar.
- It couples the two independently convertible fields.

Decision: reject. Compactness does not outweigh compatibility and readability.

## Option 2 — strip a trailing suffix and call `parseFloat`

Each field could inspect its final character, choose a multiplier, and parse the
remaining prefix with `parseFloat`.

Advantages:

- Very little code.
- Naturally handles `1.5m`.
- Multiplier lookup can remain position-specific.

Disadvantages:

- `parseFloat` accepts valid numeric prefixes followed by junk.
- Inputs such as `40minutes` could be partially accepted depending on stripping.
- Unknown suffixes need separate and potentially inconsistent handling.
- It weakens the existing all-or-nothing parsing behavior.

Decision: reject. Prefix parsing is too permissive for a budget contract.

## Option 3 — normalize humane notation into raw strings

A normalization pass could rewrite `40m` to `2400000` and `350k` to `350000`,
then reuse the old `Number` and integer checks.

Advantages:

- The final validation remains unchanged.
- The returned `Budget` construction stays identical.

Disadvantages:

- String rewriting adds an intermediate representation with no domain value.
- Decimal multiplication still needs numeric work before normalization.
- Error attribution and unknown suffix handling remain separate concerns.
- It obscures the fact that each field has a typed unit vocabulary.

Decision: viable but not selected. Direct conversion is clearer.

## Option 4 — raw-first field conversion with strict suffix grammar

Introduce a private pure helper that receives:

- a trimmed field string;
- a read-only suffix-to-multiplier table.

The helper first performs the exact legacy raw conversion:

- `Number(field)`;
- accept when `Number.isInteger` is true.

If the raw branch fails, it matches the entire field against a strict suffixed
number grammar. A recognized suffix selects a multiplier; quantity times
multiplier must be an integer.

Advantages:

- Existing raw behavior is preserved before any new grammar is considered.
- Decimal raw values remain invalid.
- Suffixed decimal values can be valid after exact unit conversion.
- Unknown suffixes fail without partial parsing.
- Time and token suffix meanings are explicit at the call sites.
- The helper is pure and small enough to remain inside `src/cli.ts`.
- The final common integer guard retains one error path.

Disadvantages:

- Slightly more code than suffix stripping.
- The raw-first branch retains all existing `Number` syntax, including forms not
  explicitly documented as decimal digit strings.
- A strict suffix grammar makes lowercase suffixes the accepted vocabulary.

Decision: select. Compatibility is more important than redefining raw syntax.

## Chosen grammar

### Field structure

- Outer whitespace continues to be removed with `trim()`.
- Raw input continues through the existing `Number` semantics.
- A humane field is a signed decimal quantity followed immediately by one
  lowercase ASCII suffix.
- The decimal quantity requires digits before any decimal point.
- If a decimal point is present, it requires digits after the point.
- Whitespace between quantity and suffix is not accepted.
- Compound suffix sequences are not accepted.

### Time field multipliers

- `h` → `3_600_000` milliseconds.
- `m` → `60_000` milliseconds.
- `s` → `1_000` milliseconds.

### Token field multipliers

- `k` → `1_000` tokens.
- `m` → `1_000_000` tokens.

### Integer result

- The multiplied numeric result must satisfy `Number.isInteger`.
- This preserves `Budget`'s integer shape.
- A suffixed quantity that produces fractional milliseconds or tokens is
  malformed at the parser boundary.
- Positivity remains downstream, matching current behavior.

## Error behavior

- Wrong comma arity retains:
  `RangeError('--budget must be "<ms>,<tokens>", ...')`.
- Empty fields retain the malformed-field family.
- Raw non-integers retain the malformed-field family.
- Unknown or malformed suffix notation uses that same family.
- The constructor remains `RangeError`.
- The message continues to contain `fields must be integers`, preserving current
  tests and usage propagation.
- The wording is not expanded to enumerate units because the ticket requires the
  existing shape and existing callers surface the message directly.

## Helper boundary

The helper will be private to `src/cli.ts` because:

- only `parseBudgetArg` needs it;
- it is an implementation detail of the CLI grammar;
- there is no independently named domain abstraction in the story;
- exporting it would enlarge the API and test surface without need.

The helper returns `number | undefined`:

- number means a valid integer field;
- undefined means the caller should throw the existing shared error.

This keeps error construction centralized in `parseBudgetArg` and ensures both
fields produce identical error shape.

## Test design

Extend the existing `describe("parseBudgetArg")` suite rather than creating a
new file or integration harness.

Required assertions:

- Deep equality between `40m,350k` and `2400000,350000`.
- Exact object equality for `2h,1.5m`.
- Exact raw object equality for `2400000,350000`.
- `40x,350k` throws `RangeError`.
- Its message remains in the existing `integers` family.

Existing raw, whitespace, arity, blank, alphabetic, and decimal-raw tests remain
unchanged to act as regression coverage.

## Scope exclusions

- Do not add compound-duration parsing.
- Do not parse slash-delimited `formatBudget` output.
- Do not add uppercase aliases.
- Do not change positivity or budget-wall enforcement.
- Do not edit dispatch output; `T-072-03-02` owns it.
- Do not import `formatBudget` into `src/cli.ts` for this ticket.
- Do not rewrite all usage strings; that is not in ticket acceptance.
- Do not change the public `Budget` type.

## Alignment

- P2 improves because allocating a familiar budget needs less mental conversion
  while remaining part of the same pick-plus-budget gesture.
- P7 improves because human notation is converted deterministically into the same
  numeric hard-contract representation as raw input.
- Pure conversion and direct unit tests preserve the project's pure-core pattern.
