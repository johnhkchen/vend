# Research — T-072-01-02

## Contract and scope

- The ticket is `T-072-01-02`, `did-you-mean-on-unknown-verb`.
- Its parent is `S-072-01`, `cli-teaches-itself`.
- The dependency `T-072-01-01` is complete at repository HEAD.
- The ticket entered this attempt in the `research` phase.
- The story limits production and test scope to `src/cli.ts` and `src/cli.test.ts`.
- No cast, network call, BAML invocation, or other module is involved.
- The behavior is FREE, deterministic, and fixture-proven.
- The acceptance contract requires a pure edit-distance suggester.
- Near misses must map to the nearest real verb.
- Inputs with no candidate inside the threshold must receive no suggestion.
- Direct CLI output must identify the wrong token on one targeted line.
- The blanket usage banner must not follow an unknown-command error.
- Other parse errors remain outside this behavior change.

## Product grounding

- P2 defines a Vend run as the small “pick + budget + go” transaction.
- Requiring exact command recall adds friction before that transaction.
- A correction can remove that friction without adding negotiation or prompting.
- P3 favors a deterministic, testable gate for the correction behavior.
- P5 is preserved because the implementation is local string computation.
- The story explicitly excludes all command behavior changes beyond discovery and
  correction.
- The epic names `did you mean steer?` as its representative recovery message.
- The UX survey identifies the current blanket usage wall as the error-quality defect.

## Current CLI architecture

- `src/cli.ts` owns both the pure argument parser and the direct-execution shell.
- Cheap parser imports are intentionally kept separate from lazy executor imports.
- `ParsedCommand` is a discriminated union returned from all parsing paths.
- Parse failures currently use `{ cmd: "usage", error?: string }`.
- The direct shell writes the error, then always writes `USAGE`, then exits 2.
- `USAGE` is now the grouped complete banner landed by the dependency ticket.
- Successful `help` writes that banner to stdout and exits 0.
- Successful `--version` is intercepted before verb routing.
- Command parsers are selected by a sequence of first-token comparisons.
- Remaining argv is delegated to `parseSelectOrBrowse`.

## Real command inventory

- Canonical named verbs routed by `parseArgs` are `help`, `run`, `chain`, `expand`,
  `annotate`, `survey`, `steer`, `svg`, `shelf`, `init`, `doctor`, `user-guide`,
  `envelope`, and `audit`.
- `--help` and `--version` are global flags, not verbs.
- `guide` and `setup-guide` are accepted aliases for canonical `user-guide`.
- Bare argv is the browse surface and has no verb token.
- Selection-shaped tokens route to `select`; `select` is a parsed command kind but
  not a literal accepted first-token verb.
- The grouped banner represents this as `vend <selection>`.
- Suggestion candidates therefore need a deliberate canonical inventory rather than
  every `ParsedCommand["cmd"]` discriminant.

## Unknown-command path

- `SELECTION_SHAPE` is a cheap routing regex for digits, commas, ranges, and spaces.
- `parseSelectOrBrowse` removes `--all` and parses an optional `--budget` first.
- Remaining positional tokens that all match the selection shape become `select`.
- A non-selection positional token currently returns
  `{ cmd: "usage", error: "unknown command: <first token>" }`.
- The first positional token is the token named in the current error.
- `frobnicate` exercises this path in two existing assertions.
- The retired `work` command also has an existing unknown-command assertion.
- Command-specific extra arguments use distinct messages such as
  `unexpected steer argument: junk`; they do not pass through this path.
- Unknown play names following `run` are intentionally validated at dispatch, not
  by this parser, and are not unknown CLI verbs.

## Output behavior

- On any `usage` result, the shell currently writes the error plus newline to stderr.
- It then writes the complete `USAGE` banner plus newline to stderr.
- It exits with status 2.
- Therefore changing only the error string would still leave the usage wall defect.
- The shell needs a structured way to omit the banner for targeted unknown-command
  results while retaining it for syntax errors where usage is useful.
- Unknown-command output should remain stderr with exit status 2.
- Help output and all successful routes must remain unchanged.

## Existing test patterns

- `src/cli.test.ts` imports pure helpers directly from `src/cli.ts`.
- Parser tests assert exact result objects, including error strings.
- Existing unknown-command assertions cover `frobnicate` and retired `work`.
- The dependency added direct CLI subprocess tests using `Bun.spawn`.
- Those tests collect stdout, stderr, and exit code without loading live services.
- A matching subprocess test can prove the one-line stderr contract and no banner.
- The repository gate is `bun run check`: BAML codegen, typecheck, and all tests.

## Edit-distance properties relevant here

- Levenshtein distance measures insertions, deletions, and substitutions.
- `steeer` is one deletion from `steer`.
- Exact matches have distance zero, though exact routed verbs never reach suggestion.
- A fixed small integer threshold makes refusal deterministic and easy to test.
- `frobnicate` is far from every canonical verb and must remain suggestion-free under
  the acceptance clause that forbids false suggestions.
- Candidate ordering matters only when multiple candidates tie at the same distance.
- Stable first-candidate tie behavior is deterministic and adequate for this inventory.
- Case normalization is not currently performed anywhere in verb routing; suggestions
  should compare the token as typed to the lowercase canonical verbs.

## Workflow and worktree constraints

- Phase artifacts belong only under
  `.lisa/attempts/T-072-01-02/1/work/` during this attempt.
- Lisa publishes admitted artifacts to the shared work directory later.
- Ticket phase and status frontmatter must not be edited by this worker.
- The worktree already contains Lisa-owned changes in `.lisa/provenance.jsonl` and
  ticket frontmatter files; those must remain untouched.
- Ticket source must be committed only through `lisa commit-ticket`.
- Exact repository-relative include paths are required.
- Ordinary `git add` and `git commit` are prohibited for this assignment.

## Research conclusion

The defect is localized to the pure unknown-verb branch and the thin shell that
currently renders all parse failures as usage failures. The existing module already
contains the canonical routing inventory, pure-test conventions, and subprocess-test
pattern needed to add a bounded edit-distance correction without widening scope.
