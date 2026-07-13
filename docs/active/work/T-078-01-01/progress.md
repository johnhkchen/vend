# Progress — T-078-01-01

## Status

Implementation, hermeticity hardening, verification, and both Lisa-managed source commits are
complete. Review artifacts are the only remaining assignment outputs.

## Completed work

### 1. Context and baseline

- Read `AGENTS.md`.
- Read the attempt assignment.
- Read `docs/knowledge/vision.md`.
- Read `docs/knowledge/rdspi-workflow.md`.
- Read parent story `S-078-01` before the ticket contract.
- Read ticket `T-078-01-01`.
- Read `docs/knowledge/charter.md` and `docs/knowledge/stack.md`.
- Mapped `src/cli.ts`, `src/cli.test.ts`, the Claude executor seam, and default run-log path.
- Ran baseline `bun test src/cli.test.ts`.
- Baseline result: 123 pass, 0 fail, 231 expectations.
- Confirmed `src/cli.ts` and `src/cli.test.ts` were initially clean.
- Confirmed unrelated shared ticket/epic changes already existed and left them untouched.

### 2. Research phase

- Wrote attempt-private `research.md`.
- Identified the head-only help condition as the complete production fault.
- Confirmed `chain --help` becomes a valid metered chain signal before this change.
- Confirmed existing `{ cmd: "help" }` dispatch already prints exact `USAGE` and exits 0.
- Confirmed no executor, ledger, dispatch, or per-command parser change is needed.

### 3. Design phase

- Wrote attempt-private `design.md`.
- Evaluated global parser guard, per-command handling, shell interception, and argv normalization.
- Selected a global membership guard at the start of `parseArgs`.
- Selected an exhaustive pure insertion sweep plus a token-free spawned CLI fixture.

### 4. Structure phase

- Wrote attempt-private `structure.md`.
- Limited source ownership to `src/cli.ts` and `src/cli.test.ts`.
- Defined unchanged interfaces and dispatch boundaries.
- Defined one atomic Lisa commit containing guard and regressions together.

### 5. Plan phase

- Wrote attempt-private `plan.md`.
- Mapped every acceptance clause to a code change and verification.
- Defined focused, full-gate, diff, commit, and review checks.

### 6. Production implementation

- Added the global help-flag guard before empty argv and verb routing:

```ts
if (argv.includes("--help") || argv.includes("-h")) return { cmd: "help" };
```

- Preserved the word `help` as a head-only command spelling.
- Preserved `--version`, bare browse, all verb parsers, dispatch arms, `USAGE`, executor code, and
  ledger code unchanged.
- Updated the adjacent comment to state the global/zero-spend invariant.

### 7. Pure regression implementation

- Added `-h` to the basic help parse assertions.
- Added a table with every canonical `COMMAND_VERBS` entry.
- Used a realistic argv sequence for each verb.
- Inserted both `--help` and `-h` at every position from zero through argv length.
- Asserted every generated case returns exactly `{ cmd: "help" }`.
- The matrix contributes 122 parse assertions across all verbs and positions.

### 8. Field-reproduction e2e implementation

- Added isolated `mkdtemp` fixture coverage for `vend chain --help`.
- Added an executable `CLAUDE_CLI` sentinel that would write an invocation marker.
- Spawned the actual `src/cli.ts` entry point from the temp root.
- Asserted exit code 0.
- Asserted exact `${USAGE}\n` stdout.
- Asserted empty stderr.
- Asserted the executor marker was not created.
- Asserted `.vend/runs.jsonl` was not created.
- Cleanup is guaranteed through `finally`.

## Verification completed

### Focused suite

Command:

```text
bun test src/cli.test.ts
```

Result:

- 125 pass.
- 0 fail.
- 355 expectations.
- 1 test file.
- No live executor invocation.

### Diff hygiene

Command:

```text
git diff --check -- src/cli.ts src/cli.test.ts
```

Result: pass, no whitespace errors.

Diff size:

- `src/cli.ts`: narrow parser guard/comment change.
- `src/cli.test.ts`: help matrix and e2e fixture.
- Total: 79 insertions, 6 deletions.

### Required full gate

Command:

```text
bun run check
```

Result:

- BAML client generation succeeded with CLI 0.223.0.
- `tsc --noEmit` succeeded.
- Full suite: 1,817 pass, 1 skip, 0 fail.
- 5,893 expectations across 119 files.
- Total test phase completed in 8.46 seconds.

### Post-hardening focused and full gates

Commands:

```text
bun test src/cli.test.ts
bun run check
```

Results:

- Focused suite: 125 pass, 0 fail, 355 expectations.
- BAML client generation succeeded.
- TypeScript typecheck succeeded.
- Full suite: 1,817 pass, 1 skip, 0 fail, 5,893 expectations.
- The final full test phase completed in 7.39 seconds.

### Lisa-managed commits

- `8c3ddfc` — `fix(cli): make help global and free`
  - includes `src/cli.ts` and `src/cli.test.ts` only.
- `eea46fc` — `test(cli): pin free-help executor lane`
  - includes `src/cli.test.ts` only.
- Ticket-owned source files are clean after both transactions.
- No ordinary Git staging or commit command was used.

## Deviations from plan

After the first managed commit, inspection found that the e2e inherited `VEND_EXECUTOR` from the
host. On a machine configured for `openai-compat`, the help behavior would still be verified but the
Claude sentinel would not be the selected executor boundary. The test is being hardened by setting
`VEND_EXECUTOR: "claude"` explicitly. This is a test-only, scope-preserving correction and will be
committed as a second Lisa-managed source unit after focused and full gates are green again.

## Remaining

1. Write `review.md`.
2. Write `review-disposition.json`.
3. Stop on this ticket for Lisa completion handling.

## Worktree safety

The following pre-existing changes are outside this ticket and remain untouched:

- `docs/active/tickets/T-078-01-01.md` (Lisa phase transition);
- `docs/active/tickets/T-078-02-01.md`;
- `docs/active/epic/E-079.md`.

No ordinary `git add` or `git commit` has been used.
