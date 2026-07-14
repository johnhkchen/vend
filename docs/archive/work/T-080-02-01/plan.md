# Plan — T-080-02-01

## Goal

Implement and prove exact optional carriage of `.lisa/provenance.jsonl` in the existing sweep
closeout commit, while preserving cards-only clean behavior, presweep scope, and pathspec equality.

## Step 1 — extend pure plan contracts

Modify `src/sweep/sweep-core.ts`:

1. export the canonical provenance path;
2. add required `provenanceDirty` to `ComputeSweepInput`;
3. add explicit nullable `provenancePath` to `SweepFlipSet`;
4. derive successful pathspec from flip paths plus declared optional provenance;
5. leave refusals and commit message unchanged.

Verification criterion: TypeScript makes every unwired caller visible.

## Step 2 — update and extend pure core tests

Modify `src/sweep/sweep-core.test.ts`:

1. add `provenanceDirty: false` to existing calls;
2. update successful expected plan with `provenancePath: null`;
3. add dirty-provenance successful assembly coverage;
4. assert exact canonical path order;
5. assert clean and dirty plans retain the same clearance message;
6. preserve all existing refusal and programmer-error assertions.

Run:

```bash
bun test src/sweep/sweep-core.test.ts
```

Expected: all core cases pass with no snapshot weakening.

## Step 3 — wire exact dirty observation

Modify `src/sweep/sweep.ts`:

1. import the shared `parsePorcelainLine` helper;
2. import `SWEEP_PROVENANCE_PATH`;
3. add a private exact-path porcelain predicate;
4. derive `provenanceDirty` from the existing full status snapshot;
5. pass that fact to `computeSweep`.

Do not call a second Git status command.

Do not pass provenance into `classifySweep` or change `SWEEP_PREFIXES`.

Verification criterion: dirty provenance can coexist with `presweep.ok === true` and generate a
flip-set.

## Step 4 — preserve exact commit validation

In `commitSweep`:

1. derive flip paths;
2. append `plan.provenancePath` only when non-null;
3. compare the complete expected list with `plan.pathspec` using existing ordered equality;
4. reject empty flips or any mismatch before reading a card;
5. update the invariant error text.

Leave the exact `git add --` and `git commit --only ... --` calls on `plan.pathspec`.

Leave rollback scoped to `plan.pathspec`; it must reset index state without rewriting external
provenance bytes.

## Step 5 — update shell test fixtures

Modify the static `SweepFlipSet` in `src/sweep/sweep.test.ts` to declare
`provenancePath: null`.

Run typecheck after this update to find any other successful-plan literals:

```bash
bun run build
```

If other callers appear, update them to explicitly state their plan cargo. Do not make the new field
optional merely to avoid compile errors.

## Step 6 — add isolated Git fixture

In `src/sweep/sweep.test.ts`, create a helper that:

1. creates a temporary repository;
2. writes one valid eligible epic/story/ticket graph;
3. writes tracked `.lisa/provenance.jsonl` baseline content;
4. initializes Git and local identity;
5. commits the fixture baseline;
6. exposes exact Git inspection commands.

Always remove each fixture in `finally`.

Verification criterion: a clean call to `prepareSweep({ root })` returns a one-card flip-set.

## Step 7 — prove dirty provenance plan and commit

Using a fresh fixture:

1. modify the tracked provenance file after baseline;
2. call `prepareSweep`;
3. assert the plan declares `SWEEP_PROVENANCE_PATH`;
4. assert the rendered plan lists epic and provenance paths;
5. call `commitSweep`;
6. assert HEAD matches returned SHA;
7. assert commit stat contains both paths;
8. assert exact diff-tree file list contains only those two paths;
9. assert epic status is done;
10. assert fixture porcelain is clean.

This is the primary ticket acceptance proof.

## Step 8 — prove clean provenance pathspec

Using a fresh clean fixture:

1. call `prepareSweep` without modifying provenance;
2. assert `provenancePath === null`;
3. assert complete pathspec equals only the epic card;
4. assert rendering does not list provenance.

This prevents always-include behavior.

## Step 9 — prove mismatched plan refusal

Using a fresh clean fixture:

1. prepare a valid cards-only plan;
2. fabricate a copy whose pathspec appends provenance but whose declared `provenancePath` stays
   null;
3. call `commitSweep` and assert `SweepApplyError`;
4. verify HEAD unchanged;
5. verify epic bytes unchanged;
6. verify porcelain clean.

This proves validation happens before any filesystem/Git mutation and retains the pathspec-equality
contract after introducing optional cargo.

## Step 10 — focused verification

Run:

```bash
bun test src/sweep/sweep-core.test.ts src/sweep/sweep.test.ts
bun run build
```

Repair all ticket-owned failures.

Then inspect:

```bash
git diff --check -- src/sweep/sweep-core.ts src/sweep/sweep-core.test.ts src/sweep/sweep.ts src/sweep/sweep.test.ts
git diff -- src/sweep/sweep-core.ts src/sweep/sweep-core.test.ts src/sweep/sweep.ts src/sweep/sweep.test.ts
```

Review for broad `.lisa/` matching, hidden commit cargo, message drift, and mutation before invariant
validation.

## Step 11 — full repository gate

Run:

```bash
bun run check
```

Required result: BAML generation, TypeScript, and full Bun test suite all green.

Do not commit if the gate is red. If a failure belongs to concurrent work, establish ownership and
retry safely; block honestly if green cannot be achieved without changing another ticket's scope.

## Step 12 — write progress evidence

Create attempt-local `progress.md` recording:

- implementation steps completed;
- exact focused/full verification results;
- deviations from this plan, if any;
- ticket-owned file list;
- unrelated shared worktree state preserved.

Write before the ticket source commit so the implementation phase has a durable handoff even if the
transaction fails.

## Step 13 — commit the coherent source unit through Lisa

Use exactly:

```bash
lisa commit-ticket \
  --ticket-id T-080-02-01 \
  --message "fix(sweep): carry dirty loop provenance" \
  --include src/sweep/sweep-core.ts \
  --include src/sweep/sweep-core.test.ts \
  --include src/sweep/sweep.ts \
  --include src/sweep/sweep.test.ts
```

These four files are one meaningful unit because the required core fields, shell wiring, and
acceptance proof must land together.

Do not use ordinary `git add`, `git add -A`, or `git commit`.

## Step 14 — post-commit inspection

Inspect:

- HEAD SHA and subject;
- commit file list exactly equals the four includes;
- all four ticket-owned paths are clean;
- no ticket-owned path remains staged or untracked;
- Lisa-owned ticket/provenance/shared state remains untouched.

Run focused sweep tests post-commit. Re-run full gate if the commit hook did not run it or the shared
tree changed materially.

Record the actual commit SHA and post-commit evidence in `progress.md`. Because the attempt artifact
is private and not part of the source commit, updating it does not violate source cleanliness.

## Step 15 — Review

Create attempt-local `review.md` covering:

- disposition;
- exact changes;
- acceptance mapping;
- pure-core/impure-shell assessment;
- test and commit evidence;
- honest limitations and open concerns;
- shared worktree ownership.

Create `review-disposition.json` with exactly:

```json
{"disposition":"pass","reason":null}
```

only if acceptance, green gate, committed source, and owned-path cleanliness are all proven.

Otherwise use `block` with a nonempty actionable reason.

After Review, remain on T-080-02-01 and stop for Lisa completion handling.
