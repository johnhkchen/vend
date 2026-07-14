# Charter — `mdwc`

## Product

`mdwc` is a one-file command-line tool that counts the words in a single Markdown
file and prints the number. That is the whole product. It does one thing.

## Scope — complete and frozen

The tool is **finished**. It reads a `.md` file, strips the markup, counts the
words, prints the count, exits `0`. Every behavior it was meant to have, it has.
There is **no roadmap**, **no backlog**, and **no planned work**. The scope is
deliberately **frozen**: `mdwc` is intentionally tiny and is considered done.

## What "done" looked like (and was reached)

- Reads one Markdown file path from `argv` and prints the integer word count.
- Empty or absent file prints `0`, never an error.
- No flags, no config, no dependencies, no network, no state.

All of the above shipped and is captured on the board as `done`. Nothing remains
open. There is no unmet need, no rough edge anyone has reported, and no ambition
beyond the single counting behavior described here.

## Constraints

- The tool stays one file with no dependencies. Growing it is explicitly **out of
  scope** — `mdwc` is complete by design, not by neglect.
