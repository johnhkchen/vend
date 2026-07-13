# Research — T-078-01-01

## Ticket and story contract

- Ticket: `T-078-01-01`, `pre-dispatch-help-guard-and-zero-spend-regression`.
- Parent story: `S-078-01`, `help-is-free-pre-dispatch-guard`.
- The story limits production scope to `parseArgs` in `src/cli.ts`.
- Test scope is `src/cli.test.ts`.
- The story explicitly excludes per-command parser changes.
- It also excludes dispatch changes, ledger changes, help-text expansion, and parser overhaul.
- The acceptance path is the existing `{ cmd: "help" }` command and existing `USAGE` banner.
- Required flags are `--help` and `-h`.
- Required position semantics are global: either spelling wins at any argv position.
- Required field reproduction is `vend chain --help`.
- Required outcome is exit code 0, `USAGE` on stdout, no executor invocation, and no run-log write.

## Product constraints

- P2 says the counter remains a two-gesture transaction.
- Help is a discovery gesture before that transaction, not a cast input.
- P7 says budget is a hard contract.
- An accidental default-funded cast for a help request violates that contract.
- P3 makes the regression tests part of the delivery contract.
- The vision says gates convert probabilistic work into a dependable product.
- This ticket makes the help path deterministic before probabilistic execution is reachable.
- The story's honest boundary is fixture-proven and token-free.
- No live executor should be used to prove the fix.

## Current CLI architecture

- `src/cli.ts` is both the CLI entry point and the owner of pure argument parsing.
- `parseArgs(argv)` receives argv without the runtime/script head.
- `ParsedCommand` is a discriminated union consumed by the impure shell.
- `{ cmd: "help" }` already exists in that union.
- `USAGE` is already exported and is the complete grouped banner.
- The direct-execution shell begins under `if (import.meta.main)`.
- It calls `parseArgs(Bun.argv.slice(2))` exactly once.
- It handles `usage`, then `help`, then `version`, before other dispatch arms.
- The help dispatch writes `${USAGE}\n` to stdout and exits 0.
- Production dependencies for casts are lazy-imported inside command dispatch arms.
- Therefore a parsed help command returns before loading a play or executor graph.

## Current parse spine

- Empty argv returns `{ cmd: "browse", all: false }`.
- Help currently checks only `argv[0] === "--help"` or `argv[0] === "help"`.
- There is no `-h` handling.
- `--version` is also intercepted only at the head.
- Literal verbs are dispatched through ordered `argv[0]` checks.
- The canonical verb inventory is held in `COMMAND_VERBS`.
- Its entries are `help`, `run`, `chain`, `expand`, `annotate`, `survey`, `steer`,
  `svg`, `shelf`, `init`, `doctor`, `user-guide`, `envelope`, and `audit`.
- `user-guide` also has `guide` and `setup-guide` aliases in the routing branch.
- Unknown heads fall through to `parseSelectOrBrowse`.
- Per-command parsers interpret remaining flags and positional arguments.

## Why the field reproduction spends

- `parseArgs(["chain", "--help"])` does not match the current head-only help check.
- The `chain` branch calls `parseChainArgs`.
- That parser treats `--help` as the signal because it is not one of its known option flags.
- It returns a valid `{ cmd: "chain", signal: "--help" }` command.
- The shell reaches the chain dispatch arm.
- That arm lazy-imports `castProposeDecomposeChain` and begins a metered cast.
- A normal chain can append two run-log records and invoke an executor.
- The parser is therefore the earliest boundary that can make the gesture incapable of spend.

## Existing test architecture

- `src/cli.test.ts` imports `parseArgs` and `USAGE` directly.
- Pure parser tests live in a large `describe("parseArgs")` section and command-specific sections.
- Existing help coverage checks only `parseArgs(["--help"])` and `parseArgs(["help"])`.
- Existing CLI help coverage spawns `bun src/cli.ts --help` and `bun src/cli.ts help`.
- It asserts exit 0, exact stdout `${USAGE}\n`, and empty stderr.
- The tests already use `mkdtemp` and cleanup in `finally` for isolated CLI fixtures.
- The tests already spawn the real CLI with an absolute CLI path when cwd is a fixture.
- `Bun.file(path).exists()` can test that a marker or run log was not created.
- `CLAUDE_CLI` is an environment seam for the default executor binary.

## Executor and ledger boundaries

- The Claude executor ultimately spawns the binary selected by `CLAUDE_CLI`.
- A fixture executable can serve as a no-cost sentinel if a regression reaches that seam.
- The sentinel can write a marker file and exit without contacting a model.
- The default run log is `<projectRoot>/.vend/runs.jsonl`.
- Correct help routing should touch neither the sentinel nor the default run log.
- Exact stdout and exit-code assertions also prove the normal help dispatch arm ran.
- Together these observations cover presentation, control flow, executor absence, and ledger absence.

## Baseline verification

- `bun test src/cli.test.ts` is green before changes.
- Baseline count is 123 passing tests and 0 failures.
- The baseline suite does not cover `-h`.
- The baseline suite does not cover help after a verb.
- The baseline suite does not assert zero executor or ledger effects for the field reproduction.

## Repository state and ownership

- The shared worktree already contains changes outside this implementation.
- `docs/active/tickets/T-078-01-01.md` is modified by Lisa from `ready` to `research`.
- `docs/active/tickets/T-078-02-01.md` is also modified.
- `docs/active/epic/E-079.md` is untracked.
- Those files are not ticket-owned implementation files and must remain untouched.
- Attempt artifacts belong under `.lisa/attempts/T-078-01-01/1/work/`.
- That path is ignored by Git and Lisa publishes admitted artifacts later.
- Ticket source commits must use `lisa commit-ticket` with exact include paths.

## Constraints and assumptions

- The word `help` remains a command only at argv head; the story globalizes flags, not the word.
- `--version` remains head-only; it is outside this story.
- Selection syntax and bare browse remain unchanged.
- A linear argv membership check is insignificant at CLI argument sizes.
- The check must precede every verb parser and the selection parser.
- No command needs bespoke help behavior in this slice.
- The global banner remains the sole help output.
- The parse test should use valid representative argv so every canonical verb is visibly covered.
- Inserting flags at every array index also covers positions that split option/value pairs.
- The correct global guard should still win in those otherwise malformed arrangements.

## Research conclusion

- The existing help result and dispatch already satisfy all desired output behavior.
- The defect is the reachability condition for that result.
- The smallest relevant source boundary is the start of `parseArgs`.
- The strongest token-free proof combines a pure exhaustive insertion sweep with one spawned CLI fixture.
- No production module beyond `src/cli.ts` is implicated by the observed architecture.
