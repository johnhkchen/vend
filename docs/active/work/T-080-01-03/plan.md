# Plan — T-080-01-03 settle surfaces cord failure

## Execution rules

- Continue directly through Implement and Review.
- Do not edit ticket phase/status.
- Keep phase artifacts in the private attempt directory.
- Preserve Lisa-owned dirty files.
- Use `apply_patch` for source and artifact edits.
- Do not use ordinary Git staging or commit commands.
- Commit only through `lisa commit-ticket` with exact paths.
- Require `bun run check` green before source commit.
- Record deviations before proceeding if implementation changes this plan.

## Baseline

- Focused suite command:
  `bun test src/settle/settle-core.test.ts src/settle/settle.test.ts`.
- Baseline result: 33 pass, 0 fail, 127 expectations.
- Planned tracked paths:
  - `docs/knowledge/lisa-loop-settled-contract.md`;
  - `src/settle/settle-core.ts`;
  - `src/settle/settle-core.test.ts`;
  - `src/settle/settle.ts`;
  - `src/settle/settle.test.ts`.
- Pre-existing excluded paths:
  - `.lisa/provenance.jsonl`;
  - `docs/active/tickets/T-080-01-03.md`.

## Step 1 — initialize progress tracking

Create private `progress.md` with phase status, baseline evidence, planned paths, ownership boundary,
and an empty deviations section.

Verification:

- progress artifact exists only in attempt work;
- Git status has no ticket-owned source changes yet.

## Step 2 — add pure cord observation and parser tests

Edit `src/settle/settle-core.test.ts` first:

1. extend `input()` with absent cord facts;
2. add a valid exact trace fixture;
3. add freshness matrix tests for absent/older/equal/newer claim;
4. add malformed-tail tolerance;
5. add invalid-only quiet behavior;
6. add exact escaped/whitespace reason preservation;
7. add verdict integration assertion.

Expected red state:

- TypeScript/test import failures until the new core surface exists.

## Step 3 — implement pure parser/freshness/verdict field

Edit `src/settle/settle-core.ts`:

1. add `SettleCordObservation`;
2. add `cord` to `ComputeSettleInput`;
3. add `cordFailureReason` to `SettleVerdict`;
4. implement exact two-field failure-line revival;
5. validate canonical timestamp and nonblank reason;
6. scan newest-to-oldest valid record;
7. compare trace mtime strictly against claim watermark;
8. populate verdict field without changing refusals/exceptions.

Fast verification:

```bash
bun test src/settle/settle-core.test.ts
```

Pass criteria:

- all existing core tests green;
- every named freshness branch green;
- reason is exact;
- malformed trace never yields refusal.

## Step 4 — update renderer fixture and behavior

Edit `src/settle/settle.test.ts`:

- add cord reason to the complete verdict;
- assert exact rendered line;
- assert it is not ANSI-red;
- set repeat fixture to null and assert absence.

Edit `src/settle/settle.ts`:

- add the cord line after loop output in the verdict branch;
- leave refusal rendering untouched.

Fast verification:

```bash
bun test src/settle/settle.test.ts
```

Transient shell wiring failures are expected until Step 5 completes because `ComputeSettleInput`
will require cord facts.

## Step 5 — wire filesystem metadata into `runSettle`

Edit `src/settle/settle.ts`:

1. import `stat` and the failure-log path;
2. add optional contents+mtime reader;
3. retain claimed marker mtime;
4. load last-settle and trace observations;
5. compute newest prior/current claim watermark;
6. pass plain cord observation to core;
7. preserve continuation write and claim consume/restore order.

Fast verification:

```bash
bun test src/settle/settle.test.ts
```

Pass criteria:

- existing marker lifecycle remains green;
- malformed marker still restores;
- no log produces no cord line.

## Step 6 — add lifecycle acceptance tests

Continue editing `src/settle/settle.test.ts`:

1. import/use `utimes` for deterministic mtime ordering;
2. add fresh-log-over-old-claim case;
3. assert verdict kind and exact reason/line;
4. assert log bytes unchanged;
5. assert immediate repeat suppresses acknowledged warning;
6. add new-marker-over-old-log case;
7. assert loop claim exists in verdict and cord line is absent;
8. assert successful marker consumption.

Fast verification:

```bash
bun test src/settle/settle-core.test.ts src/settle/settle.test.ts
```

Pass criteria:

- at least 33 tests pass plus new cases;
- zero failures;
- every ticket acceptance branch has direct proof.

## Step 7 — update durable seam contract

Edit `docs/knowledge/lisa-loop-settled-contract.md`:

- replace future ownership language with implemented consumer rules;
- document exact cord line;
- document mtime freshness and acknowledgement semantics;
- document tolerant non-blocking trace parsing;
- document that settle never mutates the append-only log;
- add settle tests to executable contract list.

Verification:

- no claim exceeds fixture/unit proof;
- honest trace delivery boundary remains unchanged;
- no excluded hook/retry work is implied.

## Step 8 — inspect the ticket diff

Run:

```bash
git diff --check -- \
  docs/knowledge/lisa-loop-settled-contract.md \
  src/settle/settle-core.ts \
  src/settle/settle-core.test.ts \
  src/settle/settle.ts \
  src/settle/settle.test.ts
```

Then inspect exact diff, stat, and status.

Pass criteria:

- no whitespace errors;
- only planned paths changed;
- marker schemas unchanged;
- no hook or producer edits;
- Lisa-owned dirty paths remain excluded.

## Step 9 — run repository gate

Run:

```bash
bun run check
```

Pass criteria:

- BAML generation succeeds;
- strict TypeScript succeeds;
- full Bun suite succeeds with zero failures.

If failure is ticket-owned, fix within planned paths and rerun. If concurrent, diagnose and wait or
record the exact blocker without modifying unrelated files.

## Step 10 — finalize progress and commit source unit

Update private `progress.md` with implementation, test counts, diff review, gate output, deviations,
and planned exact commit paths.

Commit:

```bash
lisa commit-ticket \
  --ticket-id T-080-01-03 \
  --message "fix(settle): surface recorder cord failures" \
  --include docs/knowledge/lisa-loop-settled-contract.md \
  --include src/settle/settle-core.ts \
  --include src/settle/settle-core.test.ts \
  --include src/settle/settle.ts \
  --include src/settle/settle.test.ts
```

Post-commit verification:

- identify exact commit hash;
- exact file list is the five includes;
- ticket-owned source diff is empty;
- no ticket-owned file is staged, modified, or untracked;
- Lisa-owned state remains untouched.

## Step 11 — Review

Re-read ticket, story, source diff/commit, focused tests, and full gate evidence.

Write private `review.md` with:

- disposition;
- behavior and file map;
- freshness and parsing rationale;
- acceptance-by-acceptance proof;
- exact test/gate evidence;
- exact commit evidence;
- scope and unchanged surfaces;
- open concerns and honest limitations.

Write exactly `{"disposition":"pass","reason":null}` when all acceptance is met, otherwise a
reasoned actionable block object. Then stop on this ticket.
