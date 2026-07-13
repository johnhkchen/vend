# Design — T-078-01-01

## Decision summary

Add one global flag-membership guard at the start of `parseArgs`:

```ts
if (argv.includes("--help") || argv.includes("-h")) return { cmd: "help" };
```

Retain the existing head-only `help` word handling. Prove the change with:

1. a pure table sweep that inserts both flags at every position of representative argv for
   every canonical verb; and
2. a real-CLI `vend chain --help` fixture that asserts exact free help output, no executor
   sentinel invocation, and no `.vend/runs.jsonl` creation.

## Option 1 — global membership guard in `parseArgs` (selected)

### Shape

- Check the entire readonly argv for either conventional help flag.
- Return the existing `{ cmd: "help" }` result immediately.
- Place the check before empty-argv handling and all verb routing.
- Keep the `help` word command in its current head-only branch.

### Benefits

- Directly implements “anywhere in argv.”
- Makes every downstream parser and dispatch arm unreachable for a help flag.
- Reuses the already-correct help output and exit behavior.
- Requires no new parsed-command type or output formatter.
- Preserves per-command parsers unchanged, matching story scope.
- Is pure, deterministic, and easy to test exhaustively.
- Has no executor, filesystem, or ledger dependency.

### Costs and risks

- Performs an O(n) scan, negligible for CLI argv.
- A positional value literally equal to `-h` or `--help` becomes help.
- That is required by the ticket's “any argv position” contract.
- Future commands cannot claim those exact strings as data without changing the global contract.

## Option 2 — teach every per-command parser help flags (rejected)

### Shape

- Add `--help` and `-h` cases to each `parse*Args` loop or positional collector.
- Return `{ cmd: "help" }` from each parser.

### Benefits

- Could later support command-specific help.
- Each parser would explicitly advertise its accepted control tokens.

### Rejection rationale

- Duplicates a global invariant across many modules/functions.
- Easy to miss a current parser or future verb.
- Some parsers interpret unknown flags as positional data, so implementations would differ.
- Does not naturally cover the selection/browse tail.
- Violates the story's “one pre-dispatch check” and “no per-command parser changes” boundaries.
- Creates more regression surface without adding product value in this slice.

## Option 3 — intercept help in the impure shell before `parseArgs` (rejected)

### Shape

- Scan `Bun.argv.slice(2)` in the `import.meta.main` block.
- Print `USAGE` and exit before calling `parseArgs`.

### Benefits

- Also prevents runtime dispatch and spend.
- Very small executable-path change.

### Rejection rationale

- Leaves the exported pure parser incorrect.
- Fails the acceptance requirement for a parse-level sweep returning `{ cmd: "help" }`.
- Creates two sources of routing truth between shell and parser.
- Makes programmatic callers of `parseArgs` retain the unsafe semantics.
- Breaks the repository's pure-core/impure-shell convention.

## Option 4 — normalize/reorder argv before parsing (rejected)

### Shape

- Move a discovered help flag to `argv[0]` or strip other arguments.
- Continue through the existing head check.

### Benefits

- Could reuse the existing condition literally.

### Rejection rationale

- Allocates and transforms input unnecessarily.
- Obscures the short-circuit contract.
- Risks changing argument identity or ordering for future logic.
- A direct membership guard is clearer and has fewer moving parts.

## Guard ordering

The selected help-flag check comes before the empty-argv branch. This establishes a single rule:
if either help flag exists, help wins. An empty argv cannot contain a flag, so bare browse behavior
is unchanged. The existing `help` word condition remains after the empty branch because only the
non-empty head word is meaningful.

The `--version` condition remains after help. Thus `vend --version --help` and
`vend --help --version` both resolve to help. This is a direct consequence of the global help
contract and avoids position-dependent precedence.

## Pure test design

Define a test-local table of representative valid invocations for the canonical verb inventory:

- `help`
- `run`
- `chain`
- `expand`
- `annotate`
- `survey`
- `steer`
- `svg`
- `shelf`
- `init`
- `doctor`
- `user-guide`
- `envelope`
- `audit`

Each row contains enough arguments to exercise a realistic route. For each row and each of
`--help` and `-h`, insert the flag at indices zero through `argv.length`, inclusive. Assert every
result deep-equals `{ cmd: "help" }`.

This is stronger than checking one tail position because it covers:

- before the verb;
- immediately after the verb;
- inside positional sequences;
- between an option and its value;
- after all arguments; and
- no-argument verbs at both available positions.

The table deliberately uses canonical verbs from `COMMAND_VERBS`. Alias behavior is already routed
through the same top-level guard regardless of head; the global scan is independent of verb identity.

## Field-reproduction e2e design

Create an isolated temporary root. Create an executable shell sentinel and pass its absolute path
through `CLAUDE_CLI`. The sentinel writes a marker if the default executor reaches either its probe
or dispense boundary. Spawn the real CLI entry point with:

```text
vend chain --help
```

Then assert:

- exit code is 0;
- stdout is exactly `${USAGE}\n`;
- stderr is empty;
- the executor marker does not exist; and
- `<root>/.vend/runs.jsonl` does not exist.

The sentinel is token-free even if a future regression reaches it. Cleanup runs in `finally`.

## Why absence assertions are credible

The exact success output proves the process took the help dispatch arm. The marker absence observes
the executor process boundary. The run-log absence observes durable accounting effects. The pure
matrix independently proves the parser outcome before shell behavior. These layers avoid relying
on a live model or on timing.

## Compatibility

- `vend help` remains supported.
- `vend --help` remains supported.
- `vend -h` becomes supported.
- Existing global USAGE text remains unchanged.
- Existing error output and exit codes remain unchanged when no help flag is present.
- Existing per-command parsing remains unchanged when no help flag is present.
- No public types change.
- No persistence schema changes.

## Scope guard

Do not add richer command-specific usage.
Do not alter `COMMAND_VERBS`.
Do not export new parser internals.
Do not change dispatch ordering beyond the parser result produced by global help flags.
Do not modify executor or run-log code.
Do not update ticket frontmatter.

## Selected design rationale

The global pure guard is the only option that simultaneously satisfies the story's pre-dispatch
boundary, parse-level acceptance, zero-spend invariant, and narrow file scope. The exhaustive matrix
and sentinel e2e make the one-line behavior difficult to regress silently.
