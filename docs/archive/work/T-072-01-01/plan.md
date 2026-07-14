# Plan — T-072-01-01

## Implementation goal

Land one coherent CLI discovery unit: a grouped, complete command banner; successful
pure parsing for `help` and `--help`; successful stdout/zero shell dispatch; and
tests pinning both inventory and end-to-end behavior.

## Step 1 — establish the focused baseline

Run `bun test src/cli.test.ts` before editing production code.

Verification:

- all existing CLI parser tests pass;
- failures, if any, are recorded before the ticket change rather than attributed to
  the implementation;
- no generated or source files are changed by the focused test.

## Step 2 — regroup the usage banner

Edit `USAGE` in `src/cli.ts`.

Actions:

1. Add a generic `usage: vend <command>` synopsis.
2. Add a `free (no tokens):` heading.
3. Place all eight story-specified free command syntax lines beneath it.
4. Add a `metered (uses tokens):` heading.
5. Place all six story-specified metered verb syntax lines beneath it.
6. Add the existing selection gesture explicitly as `vend <selection>`.
7. Preserve all existing option suffixes and the newcomer hint.

Verification:

- visually inspect group membership and ordering;
- search each expected marker in the resulting constant;
- confirm existing `USAGE` substring tests still have their expected text.

## Step 3 — add the pure help command route

Edit the `ParsedCommand` union and `parseArgs` in `src/cli.ts`.

Actions:

1. Add `{ readonly cmd: "help" }` near informational command members.
2. Add the combined first-token intercept for `--help` and `help` immediately after
   the bare-browse case.
3. Document that the aliases are successful discovery queries and short-circuit
   before selection parsing.
4. Leave the unknown-command path untouched.

Verification:

- a small Bun expression or the forthcoming unit test returns `{ cmd: "help" }`
  for both spellings;
- `frobnicate` still returns the exact existing usage error;
- `--version` still returns `{ cmd: "version" }`.

## Step 4 — add the thin dispatch arm

Edit the direct-execution block in `src/cli.ts`.

Actions:

1. Add the `help` discriminant branch after the usage-error branch.
2. Write `USAGE` plus one newline to stdout.
3. Exit with status zero.
4. Do not import any other module.

Verification:

- `bun src/cli.ts --help` exits zero and prints the banner;
- `bun src/cli.ts help` produces byte-identical output;
- stderr is empty for both;
- an unknown command still exits 2 and writes diagnostics to stderr.

## Step 5 — pin parsing and catalog completeness

Edit `src/cli.test.ts`.

Actions:

1. Add exact parse tests for both public help spellings.
2. Add explicit free and metered marker arrays representing the story inventory.
3. Slice `USAGE` at its headings.
4. Assert each marker appears in its assigned slice and not the other slice.
5. Assert the combined list is unique and has fifteen entries.

Verification:

- mutating/removing any inventory marker would fail the test;
- moving a command into the wrong group would fail both positive and negative checks;
- aliases `guide` and `setup-guide` are not incorrectly counted as real verbs;
- `help` itself is treated as the discovery surface, not a metered/free work verb.

## Step 6 — pin direct shell semantics

Continue editing `src/cli.test.ts`.

Actions:

1. Spawn the CLI with `--help`.
2. Spawn it with `help`.
3. Assert zero exit, exact stdout, and empty stderr for each.

Verification:

- the test fails if parsing succeeds but dispatch falls through;
- the test fails if help uses stderr;
- the test fails if either alias exits nonzero;
- the test stays local and addon-free.

## Step 7 — run focused verification

Run:

```bash
bun test src/cli.test.ts
```

Then manually run both help spellings and one unknown command while capturing exit
codes/streams if the automated test does not make a failure clear.

Acceptance mapping:

- parse cases cover the first acceptance clause;
- subprocess cases cover shell output and exit zero;
- group inventory case covers every real verb and group membership;
- unchanged unknown behavior preserves the next ticket's dependency boundary.

## Step 8 — run repository gate

Run:

```bash
bun run check
```

The gate must complete BAML generation, typecheck, and the full test suite. If it
fails:

- determine whether the failure is ticket-caused or pre-existing/concurrent;
- fix only ticket-caused failures within the two-file scope;
- record any genuine environmental or concurrent failure honestly in `progress.md`;
- do not weaken tests or bypass hooks.

## Step 9 — inspect and commit the meaningful unit

Before committing:

1. inspect `git diff -- src/cli.ts src/cli.test.ts`;
2. inspect `git status --short` and distinguish Lisa-owned frontmatter changes;
3. confirm no unrelated hunk is included;
4. update private `progress.md` with implementation and verification results.

Commit only with:

```bash
lisa commit-ticket \
  --ticket-id T-072-01-01 \
  --message "feat(cli): add grouped help command (T-072-01-01)" \
  --include src/cli.ts \
  --include src/cli.test.ts
```

This is one atomic source unit: production routing/banner and its ticket acceptance
proof. Do not use `git add` or ordinary `git commit`.

After commit, confirm `src/cli.ts` and `src/cli.test.ts` are neither modified,
staged, nor untracked.

## Step 10 — review and handoff

Write private `review.md` after the commit. It must include:

- exact files changed;
- resulting CLI behavior and stream/exit semantics;
- focused and full gate results;
- coverage of all acceptance clauses;
- deviations from this plan;
- limitations/open concerns, especially the intentionally deferred suggestion path;
- commit identifier/status if available;
- confirmation that shared work artifacts and ticket frontmatter were not edited by
  this worker.

Then remain on this ticket and stop. Lisa owns publication, final phase transitions,
and seat release.

## Commit strategy

One meaningful ticket-owned source commit is planned. Splitting `cli.ts` from
`cli.test.ts` would create an unverified intermediate unit and is not useful because
the implementation is small and inseparable from its acceptance proof.

## Done criteria

- Both help spellings parse as `help`.
- Both help spellings print identical grouped stdout and exit zero.
- All eight free and seven metered entries are present only in their correct group.
- Existing commands, unknown-command errors, and user-guide hint remain operational.
- Focused tests and `bun run check` are green.
- Exact-path Lisa commit succeeds.
- Private progress and review artifacts are complete.
- No ticket-owned source file remains dirty.
