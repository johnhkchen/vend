# Research — T-072-01-01

## Ticket contract

- Ticket: `T-072-01-01`, `help-command-and-grouped-usage`.
- Parent story: `S-072-01`, `cli-teaches-itself`.
- Current phase on entry: `research`.
- Ticket-owned production and test scope is `src/cli.ts` and `src/cli.test.ts`.
- The ticket advances P2: the normal run remains a small, discoverable gesture.
- The ticket acceptance requires both `parseArgs(["--help"])` and
  `parseArgs(["help"])` to produce a successful `help` command.
- The direct-execution shell must print the regrouped command banner and exit zero.
- A test in `src/cli.test.ts` must prove every real command is represented in one
  of two groups, free or metered, with no missing command.
- The story explicitly excludes the unknown-command suggestion, which belongs to
  dependent ticket `T-072-01-02`.
- The story also excludes command behavior changes and changes outside `src/cli.ts`.

## Product constraints

- The Vend vision describes the run as “pick + budget + go”; discoverability is
  useful only if it does not introduce another interactive negotiation.
- The help surface is read-only, local, deterministic, and token-free.
- The story's “honest boundary” classifies the requested behavior as FREE and
  fixture-proven. No live model call or executor integration is needed.
- Existing command behavior is not to change. The work is routing and presentation.
- The story corrects the survey premise: the current banner already names all
  requested commands. Completeness is not presently the defect; grouping and a
  successful help route are.

## `src/cli.ts` structure

- `src/cli.ts` is both the CLI entry point and the home of pure argument parsing.
- Imports at the top are kept light so parser tests and cheap commands avoid loading
  the executor graph and BAML native addon.
- `VERSION` is the only static value import used by a global informational flag.
- `USAGE` is an exported string constant near the top of the file.
- `ParsedCommand` is an exported discriminated union used by the parser and shell.
- `parseArgs` is exported, pure, and consumes argv without Bun/script prefixes.
- Command-specific parsing helpers return either their command shape or `usage`.
- The bottom `if (import.meta.main)` block is the impure dispatch shell.
- Dispatch is a sequence of discriminant checks. Read-only commands write to stdout
  and explicitly call `process.exit(0)`.
- Parse failures write an optional error plus `USAGE` to stderr and exit 2.

## Current usage banner

- `USAGE` currently starts immediately with the detailed `vend run` syntax.
- It then lists `chain`, `expand`, `annotate`, `survey`, and `steer`.
- It lists `svg`, `shelf`, `init`, `doctor`, `user-guide`, and `--version`.
- It lists `envelope` and `audit`.
- It ends with the existing “new here?” `vend user-guide` hint.
- All entries are visually one flat sequence using `usage:` then indentation.
- There are no “free” or “metered” headings.
- The banner does not advertise `help` itself.
- The bare browse gesture (`vend`) and selection gesture (`vend <selection>`) are
  implemented but not represented as explicit lines in the current banner.
- The story's enumerated grouping treats selection as metered and does not list
  bare browse among the free command inventory.

## Current command inventory from parser routing

- Global informational flag: `--version` -> `{ cmd: "version" }`.
- Metered verbs: `run`, `chain`, `expand`, `annotate`, `survey`, `steer`.
- Free verbs: `svg`, `shelf`, `init`, `doctor`, `user-guide`, `envelope`, `audit`.
- `user-guide` also accepts aliases `guide` and `setup-guide`; these are aliases,
  not separate real command behaviors in the story's inventory.
- Bare argv -> `{ cmd: "browse", all: false }`.
- Selection-shaped tokens -> `{ cmd: "select", ... }`.
- `--all` affects browse/selection and is not a standalone business command.
- Unknown non-selection tokens -> `{ cmd: "usage", error: ... }`.
- There is currently no `help` member in `ParsedCommand`.

## Why help currently fails

- `parseArgs` intercepts `--version` before the verb table.
- It does not intercept `--help`.
- It has no `help` verb-table entry.
- Both spellings therefore reach `parseSelectOrBrowse`.
- Neither token matches `SELECTION_SHAPE`.
- Each returns `{ cmd: "usage", error: "unknown command: ..." }`.
- In direct execution, the usage branch prints the error and banner to stderr and
  exits with status 2.

## Existing global-flag precedent

- `--version` is intercepted before command-specific parsing and selection parsing.
- Its comment says trailing tokens are ignored as conventional global-flag behavior.
- The `version` dispatch branch writes only the version to stdout and exits zero.
- This provides a local precedent for a lightweight global informational flag.
- A named `help` verb also needs interception before selection parsing, though it is
  not syntactically a flag.

## Existing tests

- `src/cli.test.ts` imports `parseArgs`, `parseBudgetArg`, `splitAfter`, and `USAGE`.
- Parser tests assert exact discriminated objects for successful and error routes.
- The top-level `parseArgs` suite already pins unknown-command behavior.
- Command-focused suites pin individual usage lines with `USAGE.toContain(...)`.
- A test around `--agent` splits the banner into lines and searches by command text.
- There is no consolidated inventory test for all commands.
- There is no help parser test.
- There is no help CLI subprocess test in this file.
- Importing `cli.ts` does not execute the shell because of `import.meta.main`.

## Runtime-test patterns

- Other repository smoke tests use Bun subprocess APIs for direct CLI behavior.
- A direct `bun src/cli.ts --help` invocation stays on the cheap parse/help path and
  does not touch lazy BAML/executor imports.
- Such a subprocess can observe exit code, stdout, and stderr without fixtures.
- Since help is deterministic, this is not a guarded-live test and needs no network.

## Worktree and workflow constraints

- On entry, ticket frontmatter files are modified by Lisa phase management.
- `docs/active/tickets/T-072-01-01.md` differs only by `phase: ready` to `research`.
- That file is not ticket-owned implementation work and must not be staged or edited.
- Phase artifacts must be written only under
  `.lisa/attempts/T-072-01-01/1/work/`.
- Lisa publishes admitted artifacts later; `docs/active/work/T-072-01-01/` must not
  be written directly.
- Source commits must use `lisa commit-ticket` with exact repository-relative paths.
- The repository gate is `bun run check`, including BAML generation, typecheck, and
  the full test suite.

## Relevant boundaries and risks

- Adding a union member requires dispatch narrowing to remain exhaustive enough for
  the final run-only fallthrough, which accesses run fields.
- A help branch must precede any branch that assumes another command shape.
- Help output should use stdout because it is a successful informational query.
- Usage errors should continue to use stderr and status 2.
- The future suggestion ticket depends on the unknown-command error remaining intact.
- Duplicating command inventories in production constants would add drift risk.
- The acceptance test can deliberately enumerate the contract inventory and verify
  the rendered group slices, making future omissions visible.
- Group-boundary assertions need unambiguous headings to prevent a command merely
  appearing somewhere in the banner from satisfying the wrong group.

## Research conclusion

The required seam is entirely present in `src/cli.ts`: one exported banner, one
pure discriminated parser, and one thin dispatch shell. The defect is a missing
successful route plus absent presentation grouping, not missing command
implementations. Existing conventions support an early informational-command
intercept, stdout/zero dispatch, exact pure parser tests, and a cheap subprocess
test. The dependent unknown-command suggestion remains untouched.
