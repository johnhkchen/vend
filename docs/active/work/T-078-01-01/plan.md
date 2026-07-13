# Plan — T-078-01-01

## Objective

Make `--help` and `-h` globally dominant in `parseArgs`, so help at any argv position resolves to
the existing free help result before a verb parser or metered dispatch can run. Pin the field
reproduction with pure and process-level regressions.

## Acceptance mapping

| Acceptance clause | Implementation | Verification |
|---|---|---|
| `--help` anywhere | global `argv.includes("--help")` guard | insertion sweep for every verb/index |
| `-h` anywhere | global `argv.includes("-h")` guard | insertion sweep for every verb/index |
| every parse-table verb | test-local canonical invocation inventory | one row per `COMMAND_VERBS` entry |
| returns `{cmd:'help'}` | reuse existing parsed union variant | deep equality in pure sweep |
| `vend chain --help` exits 0 | existing help dispatch reached | spawned real CLI exit assertion |
| prints USAGE | existing help dispatch reached | exact stdout and empty stderr |
| no executor invocation | help returns before chain lazy import | sentinel marker remains absent |
| no runs.jsonl line | help returns before chain/cast ledger | default fixture log remains absent |

## Step 1 — establish baseline

- Run `bun test src/cli.test.ts` before editing.
- Record pass/fail and count in research/progress.
- Inspect worktree status and preserve unrelated changes.

Verification:

- Existing CLI suite is green.
- `src/cli.ts` and `src/cli.test.ts` are initially clean.

## Step 2 — add pure global help guard

- Edit only the beginning of `parseArgs` in `src/cli.ts`.
- Add the membership predicate for `--help` and `-h`.
- Place it before empty argv and every command branch.
- Keep the word `help` head branch.
- Update the adjacent comment to document precedence and zero-spend purpose.

Verification:

- `parseArgs(["chain", "--help"])` returns `{ cmd: "help" }`.
- `parseArgs(["chain", "-h"])` returns `{ cmd: "help" }`.
- Existing commands without help flags retain their tests.

## Step 3 — add exhaustive pure regression

- Extend the basic help test to include `-h`.
- Add a representative invocation for each canonical verb.
- For each help flag, insert it at every possible argv index.
- Assert every parse result equals `{ cmd: "help" }`.
- Ensure the canonical table includes exactly the current `COMMAND_VERBS` inventory.

Verification:

- The matrix covers both flags.
- The matrix covers head, middle, and tail positions.
- The matrix includes every canonical verb once.
- The matrix includes positions that would otherwise be malformed parser inputs.

## Step 4 — add token-free field-reproduction e2e

- Create a temp fixture root.
- Create and chmod an executor sentinel script.
- Spawn the real CLI as `chain --help` from the fixture root.
- Pass the sentinel through `CLAUDE_CLI`.
- Assert exit 0, exact `USAGE` stdout, and empty stderr.
- Assert the sentinel marker does not exist.
- Assert `.vend/runs.jsonl` does not exist.
- Remove fixture state in `finally`.

Verification:

- The test performs no live executor call.
- A correct result proves the real CLI shell used the help branch.
- Side-effect assertions prove executor and ledger boundaries stayed untouched.

## Step 5 — run focused verification

- Run `bun test src/cli.test.ts`.
- If failing, diagnose only ticket-owned behavior.
- Re-run after any correction.

Expected:

- All previous 123 cases remain green.
- New help cases are green.
- No live token spend occurs.

## Step 6 — inspect implementation diff

- Run `git diff -- src/cli.ts src/cli.test.ts`.
- Confirm no usage, dispatch, executor, ledger, or per-command parser changes.
- Check formatting and test readability.
- Check that unrelated worktree changes are untouched.

Verification:

- Production diff is limited to the top-level guard/comment.
- Test diff is limited to help regressions and necessary fixture import.

## Step 7 — run the required full gate

- Run `bun run check`.
- This performs BAML generation, typecheck, and the full test suite.
- Treat any red result honestly.
- If a failure is unrelated and reproducible from baseline, document it; otherwise fix ticket-owned
  failures before continuing.

Verification:

- BAML generation succeeds.
- TypeScript typecheck succeeds.
- Full Bun suite succeeds.

## Step 8 — record implementation progress

- Create attempt-private `progress.md`.
- Record completed steps, exact verification commands, results, and deviations.
- Note the pre-existing unrelated worktree state.
- Do not write phase artifacts to `docs/active/work/`.

## Step 9 — commit the meaningful source unit

- Use `lisa commit-ticket`, not `git add` or `git commit`.
- Include exactly `src/cli.ts` and `src/cli.test.ts`.
- Use message `fix(cli): make help global and free`.
- Allow the managed pre-commit gate to run.
- If Lisa reports a lease or ownership error, stop and document an actionable block.

Verification:

- Commit succeeds.
- Ticket-owned files are no longer modified or untracked.
- Unrelated shared changes remain present and untouched.

## Step 10 — self-review

- Inspect the committed diff or commit summary.
- Re-evaluate every acceptance clause.
- Identify coverage gaps, concerns, and honest boundaries.
- Create attempt-private `review.md`.
- Create exact JSON `review-disposition.json`:

```json
{"disposition":"pass","reason":null}
```

Use `block` with a non-empty actionable reason only if acceptance or the required gate is not met.

## Atomicity rationale

The production guard and its two regression layers form one meaningful unit. Committing the guard
without the tests would violate P3 and the story's wave rationale. Committing tests first would
create a knowingly red source unit. Therefore both ticket-owned source files belong in one Lisa
transaction after the full check is green.

## Stop condition

After `review.md` and `review-disposition.json` are written, remain on `T-078-01-01` and stop. Do not
start another ticket. Lisa owns publication, phase transitions, completion commit confirmation, and
seat release.
