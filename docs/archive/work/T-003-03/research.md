# T-003-03 — Research: pure-selection-minilanguage

> Descriptive map of the codebase as it bears on the selection parser. What exists,
> where, how it connects. No solutions proposed here.

## The ticket in one line

A pure parser `parseSelection(s, menuLength) -> number[]` for the press half of the
`vend <sel>` gesture. It turns a tiny mini-language (`1,2,4-6`) into the picked
1-indexed positions, deduped and sorted, or throws a typed `SelectionError` on
anything invalid. No I/O, no dependency on the menu or CLI modules (rule R5 — it
runs in parallel with the menu work, T-003-01/02).

## Where this sits in E-003

E-003 (`docs/active/epic/E-003.md`) is the CLI counter: bare `vend` renders a ranked
shelf (`.vend/menu.json`); `vend <sel>` resolves the selection against that menu and
dispatches. The mini-language is specified in the epic intent (lines 30–33):

> comma-separated, `a-b` inclusive range, 1-indexed, deduped, whitespace-tolerant
> (`1,2,4-6 → [1,2,4,5,6]`); an invalid or out-of-range index is a hard error,
> never a guess.

The decomposition (epic lines 74–86) places this ticket as the **pure core** of story
S-003-02 (`selection-and-dispatch`). T-003-04 is its impure convergence: it resolves
the parsed indices against the persisted menu and dispatches each pick as its own
budgeted run. So **this ticket owns parsing only** — *not* resolution against a real
menu, *not* dispatch, *not* the `--budget` flag. It takes `menuLength: number` as a
plain parameter precisely so it never imports the menu module (R5: disjoint files →
parallelizable). T-003-04 will pass `menu.actions.length` at the boundary.

## The house "pure core + impure verb" pattern

The codebase has a settled, repeatedly-applied shape (obs 20402; see `id-guard.ts`,
`materialize.ts`, `claude.ts`). Relevant facts:

- **`src/play/id-guard.ts`** — the closest sibling and the template to mirror. A single
  pure, total function `detectCollisions(generated, existing): string[]`. No fs, clock,
  network, process, or native addon. `readonly string[]` inputs, fresh array out, inputs
  never mutated. A long header comment states the purity contract explicitly. **This
  ticket is the same species** except it *throws* instead of being total.

- **`src/play/id-guard.test.ts`** — an ordinary `bun:test` pure-function test. Uses
  `describe`/`test`/`expect(...).toEqual(...)` (exact arrays, not `toContain`, so order
  AND membership are pinned). A `purity` describe block freezes the inputs with
  `Object.freeze` and asserts a non-throwing call leaves them unchanged. This is the
  coverage bar to match.

## The typed-error convention

Two error classes already exist; both are the pattern to follow:

- **`src/play/materialize.ts:85` — `IdCollisionError extends Error`**: a `readonly`
  structured field (`collisions: readonly string[]`), a human message built in `super(...)`,
  and `this.name = "IdCollisionError"`. Header comment notes it is "distinguished by type
  so a genuine fs failure is not misread as a clean andon." The lesson: errors carry
  machine-branchable structure, not just a string — the boundary (T-003-04) will want to
  tell the user *which* field was bad.

- **`src/executor/claude.ts:92` — `ClaudeTimeoutError extends Error`**: same shape.

- **`materialize.ts:105` `alias()`** throws a `RangeError` on enum/map drift — the house
  rule "caller/wiring error THROWS; it is never silently wrong." Selection parsing is the
  same: a bad index is a hard error, never a coerced guess (epic: "never a guess").

## Toolchain constraints that shape the code

From `tsconfig.json` and `package.json`:

- **Bun + `bun:test`.** Tests import `{ describe, expect, test } from "bun:test"`.
- **`strict: true`, `noUncheckedIndexedAccess: true`.** Index access yields `T | undefined`;
  destructuring regex groups must be guarded or asserted.
- **`verbatimModuleSyntax: true`** — type-only imports must use `import type`. This module
  has *no* imports at all (pure, self-contained), so this is moot here but governs the test
  file's import of the error class (value import, not type-only).
- **`allowImportingTsExtensions: true`** — intra-repo imports carry the `.ts` suffix
  (`from "./id-guard.ts"`). Follow suit.
- **`moduleDetection: force`** — every file is a module.
- Scripts: `bun run check:test` (= `bun test`) and `check:typecheck` (= `tsc --noEmit`)
  are the two green-bar gates named in the acceptance criteria.

## Current state of `src/shelf/`

The directory **does not yet exist** — `find src -type f` shows no `src/shelf/*`. T-003-01
(menu model) and this ticket both create files under it in parallel; they share no files
(menu.ts vs select.ts), which is exactly why R5 allows them to run concurrently. So this
ticket **creates `src/shelf/` and `src/shelf/select.ts` from scratch** alongside its test.
No existing file in the tree imports anything I will write; the only future consumer is
T-003-04 (not yet built).

## The mini-language, enumerated from the spec

Parsing surface, gathered from epic lines 30–33 and the acceptance criteria:

- **Fields** are comma-separated.
- A field is either a **single index** `n` or an **inclusive range** `a-b`.
- **1-indexed.** `0` is invalid (out of range below).
- **Range** `a-b` expands to `a, a+1, …, b` inclusive.
- **Whitespace-tolerant** — ` 1, 2 , 4-6 ` is valid; tolerance plausibly extends around the
  range dash (`4 - 6`).
- Output is **deduped and sorted** ascending (`4-6,5 → [4,5,6]`; `1,1 → [1]`).
- **Hard errors** (a typed `SelectionError`, never coercion):
  - `0` and any index `> menuLength` — out of range.
  - a **reversed** range (`6-4`).
  - a **non-integer** field (`a`, `1.5`, empty field from a trailing comma).
  - (implied) a **malformed** range shape (`1-2-3`, `3-`, `-3`).

## Assumptions / open questions surfaced (not decided here)

- **Empty input.** `parseSelection("", n)` — the press requires *a* selection; an empty
  string is plausibly a hard error, not `[]`. (Design decides.)
- **Reversed vs out-of-range precedence** when both apply (`6-4`, menuLength 5): which
  error wins is a deterministic choice to be made and documented in Design.
- **Leading zeros** (`01`): integer or not. Design decides whether `\d+` accepts it.
- **`menuLength` validity.** The boundary passes `menu.length` (a non-negative int). Whether
  to separately validate `menuLength` or let out-of-range checks absorb a `0`/negative is a
  Design call; the pure function need not own the menu's invariants.
