# Design — T-072-01-01

## Objective

Make `vend --help` and `vend help` successful, zero-cost discovery gestures that
print one complete command catalog divided into FREE and METERED sections. Preserve
every existing command route and leave unknown-command correction to T-072-01-02.

## Decision 1 — represent help as a parsed command

Add `{ readonly cmd: "help" }` to `ParsedCommand` and return it directly from
`parseArgs` when the first argv token is either `--help` or `help`.

This is chosen because:

- the ticket explicitly requires `parseArgs` to return a `help` command;
- it keeps parsing pure and observable in the existing unit-test seam;
- it distinguishes successful information requests from `usage` failures;
- it follows the established early-intercept shape of `--version`;
- it prevents both spellings from reaching `parseSelectOrBrowse`.

### Rejected: return `{ cmd: "usage" }` without an error

The shell currently treats every `usage` result as a failure and exits 2. Special
casing error absence would overload the error command and contradict the required
parsed result.

### Rejected: print from `parseArgs`

That would make the pure parser impure, break the core/shell boundary, and make
parser tests depend on process output.

### Rejected: normalize `help` to another command such as `user-guide`

The user guide is a different, longer orientation artifact. The requested output is
the command catalog, and acceptance names a distinct `help` command.

## Decision 2 — intercept both spellings before the verb table

Use one early condition immediately after the bare-argv browse condition and before
`--version`/the verb table:

```ts
if (argv[0] === "--help" || argv[0] === "help") return { cmd: "help" };
```

This locates both aliases together and gives them the same semantics. Like the
existing `--version` global query, trailing tokens are ignored. The ticket only
requires the exact one-token forms, but consistent informational-query behavior is
less surprising than making `help x` a usage failure while `--version x` succeeds.

### Rejected: a `parseHelpArgs` helper

There is no argument state to parse. A helper would add ceremony and would either
reject trailing arguments inconsistently with the chosen global-query semantics or
merely return a constant.

### Rejected: place only `help` in the verb table and only `--help` globally

Both forms mean the same thing. Splitting their implementation makes later drift
more likely without providing different behavior.

## Decision 3 — dispatch help as an early successful query

Add a dispatch arm immediately after the usage-error arm:

```ts
if (parsed.cmd === "help") {
  process.stdout.write(`${USAGE}\n`);
  process.exit(0);
}
```

This is chosen because help is successful output, not diagnostic output. It avoids
all lazy imports and is executable offline. The explicit exit also narrows the union
for later dispatch branches and prevents falling into run dispatch.

### Rejected: share the usage-error branch with a conditional exit code

That would mix stdout and stderr decisions inside the error branch and weaken the
clear distinction already present in the shell.

### Rejected: extract a new shell module

The story limits production scope to `src/cli.ts`, and the behavior is only a
three-line thin-shell arm. Extraction would not improve testability over the direct
subprocess proof.

## Decision 4 — group the existing detailed syntax lines

Keep `USAGE` as the single exported string and reorganize its lines into:

```text
usage: vend <command>

free (no tokens):
  vend shelf
  ...

metered (uses tokens):
  vend run ...
  ...

new here? ...
```

The FREE group contains the story's exact inventory:

- `shelf`
- `doctor`
- `user-guide`
- `--version`
- `envelope`
- `audit`
- `svg`
- `init`

The METERED group contains:

- `run`
- `chain`
- `expand`
- `annotate`
- `survey`
- `steer`
- selection, rendered as `vend <selection> ...`

The detailed option syntax already in the banner is preserved for all named
commands. The selection line will advertise its existing optional `--all` and
`--budget` flags. This makes the complete real invocation inventory visible without
changing behavior.

The headings explicitly say whether tokens are consumed, which is the user-facing
meaning of free versus metered in the story. Uppercase headings are avoided so tests
and humans can match simple stable phrases; capitalization itself is not contractual.

### Bare browse treatment

Bare `vend` is an existing browse surface but not a verb and is not named in the
story's exact free inventory. The banner's synopsis, `usage: vend <command>`, and
the selection line cover the command-oriented discovery request. No new `browse`
verb will be invented, and bare-browse behavior remains unchanged.

### Help line treatment

`help`/`--help` is the catalog entry point rather than one of the story's “real
verbs” to classify. Advertising it in the synopsis is sufficient; it is not added
to the inventory assertion, avoiding a recursive “every command includes help”
definition not requested by the story.

### Rejected: terse one-word command lists

The current banner carries useful option syntax. Removing it would regress existing
discoverability and break tests that assert advertised flags.

### Rejected: export separate `FREE_COMMANDS` and `METERED_COMMANDS` constants

Production does not need to execute these lists. Separate inventories would duplicate
routing knowledge and could drift from the actual rendered syntax. The acceptance
test should encode the inventory contract and inspect the rendered group slices.

### Rejected: dynamically derive help from parser branches

Parser control flow and command-specific syntax are not declarative metadata. A
dynamic system would require a larger registry refactor outside this ticket.

## Decision 5 — verify parser, grouping, and shell behavior

Add focused cases to `src/cli.test.ts`:

1. Exact parse assertions for both `--help` and `help`.
2. A group-completeness test that:
   - locates the free and metered headings;
   - slices the banner into the two sections;
   - asserts each expected command marker occurs in its assigned section;
   - asserts each marker does not occur in the opposite section;
   - compares the expected inventory cardinality with the full real-command list.
3. A subprocess test for each spelling that runs `bun src/cli.ts <spelling>`, then
   asserts exit code 0, stdout equals `USAGE + newline`, and stderr is empty.

The exact inventory is intentionally explicit in the test. If a future parser verb
is added without updating help, the maintainer must extend the inventory contract.
The test cannot automatically introspect control-flow branches, but it pins every
real verb known at this ticket boundary as acceptance requests.

### Rejected: parser-only verification

It would not prove the dispatch shell writes to stdout or exits zero, both explicit
acceptance clauses.

### Rejected: shelling out only once

Both public spellings are contractually equivalent. Running both is cheap and proves
the alias is wired end to end.

## Compatibility and scope

- Existing usage errors still print the same `USAGE` constant to stderr and exit 2.
- Existing command parsers and effects are unchanged.
- Existing syntax substrings remain present, preserving focused tests.
- `parseArgs([])` remains browse.
- `parseArgs(["frobnicate"])` remains the current unknown-command usage result,
  providing the dependency baseline for T-072-01-02.
- No cast, registry, playbook, documentation, or module outside the story scope is
  changed.

## Verification gates

- `bun test src/cli.test.ts` must pass.
- Manual `bun src/cli.ts --help` and `bun src/cli.ts help` should show identical
  grouped stdout and status zero.
- `bun run check` must pass before the ticket-owned commit.
- The final diff must contain only `src/cli.ts` and `src/cli.test.ts` as source/test
  changes; Lisa-owned frontmatter changes remain untouched.
