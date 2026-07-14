# Review — T-078-01-01

## Disposition

**Pass.** The ticket acceptance criterion is fully met, the required project gate is green, and all
ticket-owned source changes are committed through the mandated Lisa transaction. No critical issue
or completion blocker remains.

## Ticket contract reviewed

Ticket: `T-078-01-01`, `pre-dispatch-help-guard-and-zero-spend-regression`.

Parent story: `S-078-01`, `help-is-free-pre-dispatch-guard`.

Acceptance requires:

1. `--help` and `-h` at any argv position;
2. coverage across every verb in `parseArgs`'s canonical table;
3. every case resolves to `{ cmd: "help" }`;
4. `vend chain --help` exits 0;
5. it prints the global `USAGE` banner;
6. it invokes no executor; and
7. it writes no `.vend/runs.jsonl` line.

The story restricts implementation to the pure pre-dispatch parser and CLI tests. It excludes
per-command help, parser overhaul, dispatch changes, executor changes, and ledger changes.

## Changes delivered

### `src/cli.ts`

- Added a global membership guard at the beginning of `parseArgs`.
- The guard returns `{ cmd: "help" }` whenever argv contains `--help` or `-h`.
- It runs before empty-argv browse routing.
- It runs before `--version` routing.
- It runs before every canonical and alias verb branch.
- It runs before the selection/browse tail.
- The existing head-only `help` word command remains intact.
- The existing help dispatch, `USAGE`, output stream, and exit code remain intact.
- No per-command parser changed.
- No dispatch arm changed.
- No public type changed.

### `src/cli.test.ts`

- Added `-h` to the basic successful discovery parse test.
- Added an exhaustive help-precedence matrix.
- The matrix contains every canonical `COMMAND_VERBS` entry:
  - `help`;
  - `run`;
  - `chain`;
  - `expand`;
  - `annotate`;
  - `survey`;
  - `steer`;
  - `svg`;
  - `shelf`;
  - `init`;
  - `doctor`;
  - `user-guide`;
  - `envelope`; and
  - `audit`.
- Each row uses a realistic, otherwise-valid invocation.
- Both `--help` and `-h` are inserted at every index from zero through argv length.
- The matrix supplies 122 deep-equality assertions for `{ cmd: "help" }`.
- Added a real-process regression for `vend chain --help`.
- The e2e runs from an isolated temp root.
- It forces `VEND_EXECUTOR=claude` for host-independent executor selection.
- It points `CLAUDE_CLI` at a token-free executable sentinel.
- The sentinel would write a marker if the executor boundary were reached.
- The e2e asserts exact `USAGE` stdout, empty stderr, and exit code 0.
- It asserts the executor marker does not exist.
- It asserts `.vend/runs.jsonl` does not exist.
- It cleans all fixture state in `finally`.

## Acceptance assessment

### Global `--help`

Pass. `argv.includes("--help")` is evaluated at the first parser boundary. The matrix covers every
possible insertion position for every canonical verb row.

### Global `-h`

Pass. `argv.includes("-h")` shares the same first-boundary return. The same exhaustive insertion
sweep covers it.

### Every parse-table verb

Pass. The test inventory matches all 14 entries of the current canonical `COMMAND_VERBS` tuple.
Aliases route below the same global scan and therefore cannot bypass it.

### Exact parse result

Pass. Every generated matrix case deep-equals `{ cmd: "help" }`; it does not merely check a command
kind or truthy property.

### Field reproduction exit/output

Pass. The spawned `chain --help` command exits 0, writes exactly `${USAGE}\n` to stdout, and writes
nothing to stderr.

### No executor invocation

Pass. The selected Claude lane points at an executable sentinel that would create
`executor-invoked`; the marker remains absent. Exact help output independently proves the help
dispatch arm completed.

### No ledger write

Pass. The isolated root has no `.vend/runs.jsonl` after process completion. No cast begins and no
accounting record is materialized.

## Verification results

### Baseline

Before implementation:

- `bun test src/cli.test.ts`
- 123 pass, 0 fail, 231 expectations.

### Focused final verification

After all source changes:

- `bun test src/cli.test.ts`
- 125 pass, 0 fail, 355 expectations.

### Required full gate

After the final hermeticity change:

- `bun run check`
- BAML generation succeeded with CLI 0.223.0.
- `tsc --noEmit` succeeded.
- 1,817 tests passed.
- 1 integration test was intentionally skipped because no `dist/` artifacts exist.
- 0 tests failed.
- 5,893 expectations ran across 119 files.

### Diff hygiene

- `git diff --check HEAD~2..HEAD` passed.
- `git diff --exit-code -- src/cli.ts src/cli.test.ts` returned 0 after commits.
- Ticket-owned source files are clean.

## Commits

- `8c3ddfc` — `fix(cli): make help global and free`
  - `src/cli.ts`
  - `src/cli.test.ts`
- `eea46fc` — `test(cli): pin free-help executor lane`
  - `src/cli.test.ts`

Both were created with `lisa commit-ticket` and exact repository-relative include paths. No ordinary
Git index workflow was used.

## Architecture and scope review

- Pure core, impure shell: preserved.
- The behavioral decision remains a pure function over plain argv values.
- The impure shell receives the existing help discriminant and performs existing output only.
- Lazy executor imports remain behind metered dispatch arms.
- Global help is structurally incapable of reaching those arms.
- No filesystem, clock, network, or process logic entered production parsing.
- P2 is advanced because discovery cannot accidentally become a third metered transaction.
- P7 is advanced because no default budget can be consumed for a help request.
- P3 is honored through both exhaustive pure coverage and process-level absence evidence.

## Coverage gaps and limitations

- The canonical invocation inventory is test-local rather than imported from `COMMAND_VERBS`, which
  is intentionally private. A future verb addition must update this sweep; the existing grouped
  usage inventory test also requires explicit command inventory maintenance, so this matches current
  project practice.
- The e2e proves the named field reproduction and the Claude process boundary. The pure sweep is the
  broader proof for every other verb and position; spawning every matrix case would add cost without
  meaningful extra coverage.
- The run-log assertion proves no file was created in a fresh root. It does not pre-seed a ledger and
  compare bytes, but absence is a stronger direct match for this fixture's “no line written” case.
- Richer per-command help remains deliberately out of scope.
- The already-spent field tokens are unrecoverable, matching the story's honest boundary.

## Open concerns

No blocking concerns.

The only maintenance concern is keeping the test-local canonical verb inventory synchronized with
future additions. This is low risk, visible in one focused test, and does not weaken current
acceptance.

## Worktree note

Shared ticket/work-artifact paths for `T-078-01-01` and `T-078-02-01` remain modified or untracked by
Lisa/parallel workflow activity. They were not included in either ticket source commit. The two
ticket-owned source files are clean, and this worker did not modify ticket phase/status frontmatter.

## Final conclusion

The help gesture now short-circuits at the earliest pure boundary for both conventional flags at any
argv position. The exact field reproduction is free, successful, executor-free, and ledger-free.
Acceptance is met and the review disposition is `pass`.
