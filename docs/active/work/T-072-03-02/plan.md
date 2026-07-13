# Plan — T-072-03-02

## Implementation objective

Make every explicit `--budget` cast gesture acknowledge its parsed numeric
envelope once in the shelf's humane vocabulary before dispatch, while proving
that humane and raw input spellings produce identical CLI output.

## Guardrails

- Modify only `src/cli.ts` and `src/cli.test.ts` as ticket-owned source.
- Keep Lisa-owned ticket/provenance changes untouched.
- Do not update ticket phase or status frontmatter.
- Write phase artifacts only under the private attempt work directory.
- Use `apply_patch` for edits.
- Use `lisa commit-ticket` with exact includes; never ordinary staging/commit.
- Keep budget parsing, enforcement, defaults, and live spend semantics unchanged.

## Step 1 — establish the focused baseline

1. Run `bun test src/cli.test.ts` before source changes.
2. Record the pass/fail count in `progress.md`.
3. Confirm `src/cli.ts` and `src/cli.test.ts` are clean.
4. Confirm unrelated Lisa-owned working-tree changes remain present.

Verification:

- focused CLI suite is green before this ticket's changes;
- ticket source paths have no pre-existing diff.

## Step 2 — add acceptance coverage first

1. Add a subprocess suite to `src/cli.test.ts`.
2. Spawn `src/cli.ts` through `process.execPath` using a deliberately unknown
   play, inert epic path, and `--budget 40m,350k`.
3. Pipe stdout and stderr and await both plus the exit code.
4. Repeat with `--budget 2400000,350000`.
5. Assert the humane stdout is exactly `funding ~40m/350k\n`.
6. Assert raw stdout is exactly identical.
7. Assert both invocations retain the existing typed unknown-play exit and
   stderr behavior.

Verification:

- run `bun test src/cli.test.ts`;
- expect the new test to fail because stdout is currently empty;
- confirm existing tests remain green;
- record the red result in `progress.md` before implementation.

## Step 3 — import the existing formatter

1. Add a static value import for `formatBudget` from `src/shelf/menu.ts`.
2. Preserve the existing `ValueTier` type-only import.
3. Do not import any shelf effect module.

Verification:

- inspect dependency direction;
- ensure the imported module remains pure and addon-free.

## Step 4 — add pure funding-line composition

1. Add a private `formatFundingLine(budget: Budget): string` helper.
2. Return exactly `funding ~${formatBudget(budget)}`.
3. Keep newline and I/O out of the helper.
4. Do not export it merely for tests.

Verification:

- TypeScript signature accepts the same `Budget` produced by parsing;
- no duplicate unit conversion logic exists in `cli.ts`.

## Step 5 — wire optional explicit-budget arms

Add a guarded line immediately before dispatch in:

1. `select`;
2. `chain`;
3. `expand`;
4. `survey`;
5. `steer`.

For each arm:

- guard on `parsed.budget !== undefined`;
- render from `parsed.budget`;
- write exactly one newline-terminated line;
- do not change the options passed to downstream code;
- do not echo an implicit default.

Verification:

- source inspection shows the write precedes the effect/cast call;
- each optional arm has at most one write;
- `annotate` remains unchanged.

## Step 6 — wire the required `run` arm

1. After loading `runPlay`, write the funding line from `parsed.budget`.
2. Place it before calling `runPlay`.
3. Preserve registry refusal and summary behavior.

Verification:

- the acceptance subprocess reaches this line;
- a registry miss still prevents any real cast;
- output is present before the typed refusal.

## Step 7 — focused green verification

Run:

```bash
bun test src/cli.test.ts
bun run build
git diff --check -- src/cli.ts src/cli.test.ts
```

Inspect:

```bash
git diff -- src/cli.ts src/cli.test.ts
```

Acceptance checks:

- humane invocation outputs exactly one funding line;
- raw invocation outputs the identical line;
- line is built through `formatBudget`;
- run dispatch call occurs after the write;
- all prior CLI behavior tests remain green.

Record exact results in `progress.md`.

## Step 8 — repository gate

Run the required gate:

```bash
bun run check
```

The gate must complete BAML generation, TypeScript, and the complete suite with
zero failures.

If it fails:

1. distinguish ticket failures from unrelated concurrent failures;
2. fix only ticket-owned defects;
3. rerun the focused command;
4. rerun the complete gate;
5. record honest results and any deviation.

Do not commit while the gate is red.

## Step 9 — update implementation artifact

Complete `progress.md` with:

- baseline result;
- test-first red evidence;
- implementation details by source file;
- focused and repository verification results;
- deviations from this plan;
- remaining work before commit.

The artifact stays in the private attempt directory.

## Step 10 — commit the source unit through Lisa

Use:

```bash
lisa commit-ticket \
  --ticket-id T-072-03-02 \
  --message "feat(cli): echo parsed funding humanely (T-072-03-02)" \
  --include src/cli.ts \
  --include src/cli.test.ts
```

Do not use `git add`, `git commit`, or an ordinary index workflow.

Verification:

- capture the resulting commit hash;
- inspect `git show --stat --oneline HEAD`;
- confirm only the two exact source paths are in the ticket commit;
- confirm both ticket-owned paths are clean;
- preserve unrelated Lisa-owned modifications.

## Step 11 — review

Write `review.md` covering:

- pass/fail outcome against the ticket criterion;
- exact files and behavior changed;
- why explicit overrides are the boundary;
- subprocess harness and no-token proof;
- focused and full-gate evidence;
- commit hash and exact includes;
- compatibility and scope assessment;
- any open concern or intentional limitation;
- final working-tree handoff.

## Expected atomicity

One source commit is appropriate:

- `src/cli.ts` supplies the complete behavior across dispatch arms;
- `src/cli.test.ts` supplies the required observable proof;
- splitting them would temporarily leave either unproved behavior or a knowingly
  red test unit.

## Rollback boundary

The ticket can be reverted by reverting its single Lisa commit. No schema,
persistent data, generated asset, or dependency migration is involved.

## Completion criteria

The ticket is ready for Lisa review only when:

- all six private phase artifacts exist;
- source and tests are committed through Lisa;
- `bun run check` is green;
- ticket-owned paths are clean;
- review honestly marks every acceptance condition pass or fail;
- no unrelated path was staged, committed, or modified by this work.
