# Design — T-075-04-01

## Decision summary

Introduce one pure, exported `formatSvgWriteLine` function in `src/cli.ts`.
The function will accept the SVG output path and the three numeric counts, select
the singular or plural form for each noun independently, and return the complete
line including its trailing newline. The existing SVG dispatch arm will pass the
`writeBoardSvg` result fields to this formatter and write the returned value to
stdout. `src/cli.test.ts` will assert the exact singular and plural lines.

## Design goals

- Correct `group`, `card`, and `link` independently.
- Preserve the existing output path, punctuation, ordering, and newline.
- Make the behavior testable without filesystem or process interception.
- Keep the existing `writeBoardSvg` result contract unchanged.
- Keep SVG projection and grouping behavior unchanged.
- Keep the code local to the CLI behavior that owns the wording.
- Satisfy the acceptance criterion with byte-exact CLI test assertions.
- Preserve the pure-core/impure-shell convention.
- Avoid expanding this grammar fix into a general inflection framework.

## Option 1 — inline ternaries in the dispatch string

Example shape:

```ts
`${result.groupCount} group${result.groupCount === 1 ? "" : "s"}`
```

### Advantages

- Smallest raw source edit.
- No additional exported symbol.
- The logic is visually adjacent to the stdout effect.
- No new function call at runtime.

### Disadvantages

- The complete behavior remains trapped inside `if (import.meta.main)`.
- A direct CLI unit test cannot invoke it without executing the command.
- Testing would require a subprocess, output interception, or implementation-text assertion.
- Three repeated inline conditions make the output expression harder to scan.
- The acceptance criterion specifically asks for a CLI test of the write line.
- A test that duplicates the ternary logic would not pin production behavior.

### Assessment

The production change is valid, but the testing seam is poor. This option would
either add unnecessary integration machinery or weaken the regression test.

## Option 2 — subprocess integration test of `vend svg`

The production line could remain inline while the test launches the CLI, points
it at a temporary output path, captures stdout, and inspects the completion line.

### Advantages

- Exercises parsing, graph loading, projection, file writing, and stdout together.
- Tests the literal user-visible command behavior end to end.
- Does not require exporting a formatter solely for a test seam.

### Disadvantages

- The live board does not naturally provide controlled one-count fixtures.
- The CLI has no graph injection option.
- Creating a temporary project board would add significant setup unrelated to grammar.
- The SVG effect tests already cover graph injection and output file behavior.
- Process spawning and filesystem setup would make a tiny deterministic behavior slower.
- Achieving both exactly-one and greater-than-one cases would be disproportionately complex.
- It would test many unrelated modules and fail for unrelated reasons.

### Assessment

This provides broader coverage than the ticket needs and conflicts with the
repository's existing pure CLI-test seam. It is not proportionate to the risk.

## Option 3 — formatter in `src/present/svg-file.ts`

Add a formatting helper beside `SvgFileResult`, then import it into the CLI and
test it in `svg-file.test.ts` or `cli.test.ts`.

### Advantages

- The helper could accept `SvgFileResult` directly.
- Count types and the result interface live in the same module.
- Formatting would stay close to the data it describes.

### Disadvantages

- The wording is CLI presentation, not file-output seam behavior.
- `svg-file.ts` currently owns loading, projection, rendering, and file writing.
- Adding terminal prose couples the present-layer effect to one consumer's copy.
- The acceptance criterion explicitly calls for a CLI test.
- Importing the effect module into the CLI test would widen its dependency surface.

### Assessment

The data proximity is attractive, but ownership is wrong. The result is neutral;
the CLI decides how to announce it.

## Option 4 — general pluralization utility module

Create a reusable helper such as `pluralize(count, singular, plural)` in a shared
formatting module and use it for the three nouns.

### Advantages

- Could support future CLI grammar corrections.
- Makes singular-selection logic reusable.
- Allows irregular plurals through an explicit plural argument.

### Disadvantages

- No broader reuse was found during research.
- A new module and test file increase the change surface for three regular nouns.
- Generic English inflection quickly grows beyond this ticket's contract.
- The CLI still needs a composition function or repeated calls in its dispatch arm.
- It risks turning a clean grammar edit into utility design work.

### Assessment

This is premature abstraction. A private local noun helper, if useful, is enough.

## Option 5 — pure CLI write-line formatter

Add an exported function with a narrow signature in `src/cli.ts` and call it from
the SVG dispatch arm.

Candidate interface:

```ts
export function formatSvgWriteLine(
  path: string,
  groupCount: number,
  cardCount: number,
  linkCount: number,
): string
```

### Advantages

- The CLI owns its user-visible wording.
- The function is pure over plain values.
- The adjacent CLI test can import it safely.
- Exact expected strings pin grammar, punctuation, order, path, and newline.
- The dispatch shell remains a thin `process.stdout.write(...)` effect.
- No dependency on the impure `svg-file.ts` module is added at import time.
- No new file or generic framework is required.

### Disadvantages

- Four positional parameters can be reordered accidentally.
- Exporting the helper expands the module's public testable surface.
- A direct formatter test is one layer below a true spawned-command integration test.

### Mitigations

- The call site uses named `result.*` fields in the same visible order as the signature.
- The function name is command-specific, preventing accidental general-purpose reuse.
- The returned string includes the newline, so stdout behavior is covered exactly.
- Existing SVG seam tests already cover the effectful layers omitted by this unit test.

### Assessment

This is the best fit for the repository and ticket. It separates deterministic
wording from the process effect without introducing a cross-module abstraction.

## Input shape decision

Two narrow signatures were considered within Option 5.

### Positional primitive values

- Keeps `src/cli.ts` independent of the `SvgFileResult` type.
- Preserves the lazy import boundary around `svg-file.ts`.
- Makes unit tests concise.
- Mirrors the literal fields needed by the line.

### Object parameter

An object such as `{ path, groupCount, cardCount, linkCount }` would reduce
positional-order risk. However, importing `SvgFileResult` at runtime is not needed,
and defining a duplicate CLI-only interface adds ceremony. A structural object
parameter could still be used without importing the type, but the function only
has one production call and two tests.

### Chosen shape

Use positional primitives. The call site will be formatted over multiple lines,
with each `result` field named explicitly and ordered to match the output.

## Plural selection rule

Use the ordinary count rule:

```ts
count === 1 ? singular : `${singular}s`
```

- Exactly one produces the singular noun.
- Zero remains plural.
- Every integer greater than one is plural.
- The three labels are regular English plurals.
- No irregular noun map is needed.
- No count validation is added because production values are array-derived.

A tiny private helper such as `countedNoun(count, noun)` can remove repetition
inside `formatSvgWriteLine`. Keeping it private avoids creating a generic API.

## Exact output contract

For all counts equal to one:

```text
wrote board.svg — 1 group, 1 card, 1 link\n
```

For representative counts greater than one:

```text
wrote board.svg — 2 groups, 3 cards, 4 links\n
```

The test will compare exact strings rather than using partial containment. This
also guards the established em dash, comma spacing, noun order, and newline.

## Mixed and zero behavior

The ticket requires count-one and count-greater-than-one cases. The formatter's
independent calls inherently support mixed counts, for example `1 group, 2 cards,
1 link`. Zero naturally produces `0 groups`, `0 cards`, and `0 links`.

A third mixed/zero assertion is optional. The core acceptance gate needs two
explicit assertions, and keeping the test focused avoids adding requirements not
named by the ticket. Independent noun formatting remains visible in the function.

## Error and compatibility posture

- The helper does not throw for normal numeric inputs.
- The path is interpolated unchanged.
- The SVG file is still written before the completion line is emitted.
- Exit status remains zero after a successful write.
- Errors from `writeBoardSvg` still propagate as before.
- CLI argument parsing remains byte-for-byte unchanged.
- SVG rendering and counts remain byte-for-byte unchanged.
- Only grammar changes when a returned count is exactly one.

## Chosen design

Implement the pure CLI formatter, backed by a private regular-noun helper. Test
the complete singular and plural lines in the existing SVG CLI describe block.
Wire the SVG dispatch arm to emit the formatter result. Do not touch grouping,
projection, SVG generation, or the file-output result contract.
