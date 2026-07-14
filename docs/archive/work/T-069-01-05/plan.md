# Plan — T-069-01-05

## Implementation objective

Complete the CLI join for story S-069-01: expose `--agent <seat>` on `vend run` and `vend chain`,
parse the raw optional value, forward it into both dependency-provided option shapes, and prove the
public grammar without changing downstream seat validation.

## Preconditions

- Parent story S-069-01 has been read.
- Ticket T-069-01-05 is in Research and depends on completed T-069-01-03 and T-069-01-04.
- `ChainProposeDecomposeOptions.agent?: string` exists.
- `RunOptions.agent?: string` exists.
- Both downstream paths are committed and tested.
- `src/cli.ts` and `src/cli.test.ts` have no pre-existing local modifications.
- Lisa-managed worktree changes must not be staged or edited.

## Step 1 — extend the parsed command contract

Modify `src/cli.ts`.

Actions:

1. Add optional raw `agent` to the `run` discriminated-union member.
2. Add optional raw `agent` to the `chain` member.
3. Document that the value is Lisa routing metadata.
4. State or preserve the distinction from the present-layer `--seat` type.

Verification:

- TypeScript syntax remains valid.
- Existing parser results remain assignable.
- Narrowing on `cmd === "run"` and `cmd === "chain"` exposes `agent`.

## Step 2 — advertise the flag

Modify the first two fragments of `USAGE`.

Actions:

1. Append `[--agent <seat>]` to the run line.
2. Append `[--agent <seat>]` to the chain line.
3. Leave every unrelated line unchanged.
4. Leave `[--seat <designer|dev>]` unchanged.

Verification:

- The help placeholder exactly matches ticket acceptance.
- Both board-writing gestures contain it.

## Step 3 — parse the chain flag

Modify `parseChainArgs`.

Actions:

1. Add an optional local `agent` accumulator.
2. Recognize `--agent` before the positional fallback.
3. Consume exactly one following token.
4. If absent or flag-shaped, return `{ cmd: "usage", error: "missing --agent <seat>" }`.
5. Otherwise retain the raw string.
6. Conditionally spread it into the returned chain command.

Verification cases:

- `chain sig --agent codex` keeps signal `sig` and carries `agent: "codex"`.
- A bare chain still has no own agent property.
- `chain sig --agent` returns the exact usage error.
- `chain sig --agent --budget 1,2` returns the agent error rather than consuming `--budget`.
- Budget and after behavior remain unchanged.

## Step 4 — parse the run flag

Modify `parseRunArgs`.

Actions:

1. Add an optional local `agent` accumulator beside the after collection.
2. Extend the existing optional-value scan to recognize both `--after` and `--agent`.
3. Preserve the exact `--after` branch and de-duplication behavior.
4. Apply the same missing or flag-shaped value check to `--agent`.
5. Retain the raw supplied string.
6. Conditionally spread it into the run command result.

Verification cases:

- Required budget plus `--agent codex` carries both fields.
- A bare run still has no own agent property.
- Terminal `--agent` returns the exact usage error.
- `--agent --after T-1` returns the agent error.
- Existing no-gates, intervention, budget, and after tests stay green.

## Step 5 — thread chain dispatch

Modify the `parsed.cmd === "chain"` arm.

Actions:

1. Add `agent: parsed.agent` to the options passed to `castProposeDecomposeChain`.
2. Keep lazy import, output, halt reporting, and exit-code behavior unchanged.

Verification:

- Typechecking confirms assignability to `ChainProposeDecomposeOptions`.
- No play module moves into the pure import graph.

## Step 6 — thread run dispatch

Modify the final generic run arm.

Actions:

1. Add `agent: parsed.agent` to the options passed to `runPlay`.
2. Keep generic play lookup and all existing fields unchanged.
3. Keep no-play behavior, output, and exit codes unchanged.

Verification:

- Typechecking confirms assignability to `RunOptions`.
- No special-case decompose branch is introduced.

## Step 7 — add focused parser tests

Modify `src/cli.test.ts`.

Actions:

1. Add the exact chain happy-path assertion from acceptance.
2. Add the exact run happy-path assertion from acceptance.
3. Add dangling-agent assertions for both gestures.
4. Include at least one following-flag case to pin the missing-value guard.
5. Add line-specific `USAGE` assertions for both gestures.
6. Rely on existing exact-equality happy paths for omission regression, optionally adding explicit
   `not.toHaveProperty("agent")` assertions if clarity warrants it.

Focused verification:

```bash
bun test src/cli.test.ts
```

Expected result:

- all CLI parser tests pass;
- no BAML addon is loaded;
- the new tests exercise only exported pure values/functions.

## Step 8 — inspect the implementation diff

Run:

```bash
git diff -- src/cli.ts src/cli.test.ts docs/active/work/T-069-01-05
```

Review for:

- accidental unrelated formatting;
- changes to `--seat` behavior;
- validation against known seats in the CLI;
- unconditional agent properties in parsed results;
- missing dispatch on either gesture;
- exact error and help text;
- comments that confuse Lisa seats with Vend executors.

## Step 9 — record implementation progress

Create `docs/active/work/T-069-01-05/progress.md`.

Record:

- completed plan steps;
- focused test result;
- any deviations;
- remaining full-gate and review work;
- files touched.

The artifact must not update ticket phase or status.

## Step 10 — run the full repository gate

Run:

```bash
bun run check
```

This is the mandatory pre-commit gate and includes BAML codegen, typechecking, and the full test
suite.

If it fails:

1. determine whether the failure is caused by this ticket;
2. repair in-scope failures;
3. rerun focused checks as needed;
4. rerun the full gate;
5. document any unresolved external failure honestly rather than bypassing it.

Expected result:

- code generation completes;
- strict typecheck accepts both dispatch fields;
- full suite passes;
- no generated diff remains unless legitimately produced by the gate.

## Step 11 — commit the implementation unit

Stage only:

- `src/cli.ts`;
- `src/cli.test.ts`;
- this ticket's Research, Design, Structure, Plan, and Progress artifacts.

Do not stage:

- `.lisa/provenance.jsonl`;
- ticket frontmatter changes;
- epic/story board files;
- unrelated shared-worktree state.

Commit with a ticket-scoped message such as:

```text
feat(cli): thread agent seat through board gestures (T-069-01-05)
```

Do not bypass the pre-commit hook.

## Step 12 — review and handoff

Create `review.md` after implementation and verification.

The review must include:

- outcome against every acceptance criterion;
- files created and modified;
- parsing and dispatch behavior;
- test coverage and exact commands/results;
- compatibility assessment;
- open concerns and honest boundary;
- confirmation that ticket phase/status were not manually changed.

If repository convention supports a final documentation commit, stage only `review.md` and commit
it after ensuring the gate result remains applicable to the unchanged code.

## Completion criteria

The ticket is complete when:

- all six RDSPI artifacts exist;
- both parsers carry `agent: "codex"`;
- both dangling cases return the exact usage error;
- both usage lines advertise the flag;
- both dispatch calls forward the value;
- omission remains behavior-compatible;
- `bun run check` is green;
- ticket-owned work is committed;
- `review.md` gives an honest handoff;
- no ticket phase or status field was manually edited.
