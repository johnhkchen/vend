# Plan — T-080-02-02

## Execution rules

- Work continuously through Implement and Review.
- Do not edit ticket phase or status.
- Write all phase artifacts only in the private attempt work directory.
- Preserve pre-existing Lisa-owned dirty files.
- Use `apply_patch` for source and artifact edits.
- Do not use `git add`, `git add -A`, or ordinary `git commit`.
- Commit the ticket-owned source unit only with `lisa commit-ticket` and exact include paths.
- Do not include ignored attempt artifacts in the source commit.
- Require `bun run check` green before the ticket source commit.
- Record deviations in `progress.md` before continuing if the plan changes.

## Step 1 — initialize implementation tracking

Create private `progress.md` with:

- the baseline targeted test result: 168 pass, 0 fail;
- the selected five tracked paths;
- the pre-existing dirty paths that must remain excluded;
- the ordered implementation checklist;
- no deviations at start.

Verification:

- file exists under `.lisa/attempts/T-080-02-02/1/work/`;
- `git status --short` shows no new tracked source changes yet.

## Step 2 — expand the pure graph fixture

Edit `src/settle/settle-core.test.ts`.

Add fixture nodes:

1. status-done epic `E-050`;
2. linked status-done story `S-050-01`;
3. linked phase-done ticket `T-050-01`.

Update default presweep facts so they describe the fixture's complete done-ticket set.

Update clearance expectations:

- visible epic clearance excludes `E-050`;
- visible clearance retains `E-100`, `E-200`, and `E-300`;
- `E-100` remains all done;
- global `doneTicketIds` includes `T-050-01`.

Update prior-marker expectations:

- prior marker includes `T-050-01`;
- measured delta remains `T-100-02`;
- verdict, presweep, and next marker include the hidden historical ticket.

Update first-settle expectations:

- no newly-done ids;
- first-settle flag true;
- full next marker includes all current done ids;
- no exceptions.

No source behavior is changed in this step yet.

Expected transient result if tested immediately:

- the new epic-filter and first-delta assertions fail against old core behavior.

## Step 3 — implement pure core semantics

Edit `src/settle/settle-core.ts`.

In `deriveEpicClearance`:

1. update the documentation to describe active epic display scope and whole-board ticket scope;
2. filter `graph.epics` using exact `epic.status !== "done"`;
3. retain the existing per-epic mapping;
4. retain the global flat-ticket frontier calculation;
5. retain `allDoneEpicIds` derivation from the filtered epic array.

In `computeSettleVerdict`:

1. preserve marker parsing and prior-done set construction;
2. return `[]` for newly-done ids when `marker.firstSettle` is true;
3. retain the existing set-difference calculation for repeated settles;
4. retain complete copied `doneTicketIds` and `nextMarker.doneTicketIds`.

Fast verification:

```bash
bun test src/settle/settle-core.test.ts
```

Pass criteria:

- all core tests green;
- mixed epic status behavior pinned;
- first delta empty but next marker full;
- prior marker and immediate repeat still correct.

## Step 4 — update renderer contract and unit fixture

Edit `src/settle/settle.test.ts` first:

- set the manual first-settle fixture's `newlyDoneTicketIds` to empty;
- expect `delta: first settle — no baseline`;
- retain open all-done epic `sweep ready` coverage.

Edit `src/settle/settle.ts`:

- make the first-settle branch emit exactly `delta: first settle — no baseline`;
- retain repeated-settle id and empty branches;
- retain direct iteration of already-filtered verdict epics.

Fast verification:

```bash
bun test src/settle/settle.test.ts
```

Pass criteria:

- exact first-baseline line green;
- repeated-settle line green;
- loop, gate, presweep, concern, exception, and ANSI tests unchanged and green.

## Step 5 — add markdown-backed mixed epic acceptance

Continue editing `src/settle/settle.test.ts`.

Expand `createSettleFixtureRoot` with status-done `E-899`, linked `S-899-01`, and done `T-899-01`.

In the first run-settle lifecycle assertion:

1. render the returned verdict once into a local string;
2. assert exact no-baseline delta line;
3. assert no `epic: E-899` line;
4. assert `E-900` remains visible as `1/1 cleared — sweep ready`;
5. assert `first.nextMarker` contains `T-899-01` and `T-900-01`;
6. assert the persisted marker has the same complete sorted frontier;
7. retain loop marker consumption checks.

Fast verification:

```bash
bun test src/settle/settle.test.ts
```

Pass criteria:

- graph loader accepts the expanded fixture;
- status-done epic is absent only from rendered epic lines;
- open all-done epic remains visible;
- hidden epic's ticket remains in the future baseline;
- second invocation remains an empty repeated delta.

## Step 6 — align CLI fixture acceptance

Edit `src/cli.test.ts`.

Replace only the stale first-invocation expectation:

```text
delta: first settle — T-900-01
```

with:

```text
delta: first settle — no baseline
```

Retain:

- persisted marker bytes containing `T-900-01`;
- second invocation `delta: none since last settle`;
- gate and presweep lines;
- review concern and ANSI exception;
- no executor invocation;
- no run-ledger mutation.

Fast verification:

```bash
bun test src/cli.test.ts
```

## Step 7 — run affected test group

Run:

```bash
bun test src/settle/settle-core.test.ts src/settle/settle.test.ts src/cli.test.ts
```

Pass criteria:

- zero failures;
- test count is at least the 168-test baseline;
- no fixture repository leaks remain after tests.

If this fails:

- diagnose only failures caused by the five ticket-owned paths;
- do not modify unrelated source to force the gate;
- record any structural deviation before making it.

## Step 8 — inspect the ticket diff before the full gate

Run read-only checks:

```bash
git diff --check -- \
  src/settle/settle-core.ts \
  src/settle/settle-core.test.ts \
  src/settle/settle.ts \
  src/settle/settle.test.ts \
  src/cli.test.ts
```

```bash
git diff --stat -- <the same five paths>
git diff -- <the same five paths>
git status --short
```

Review criteria:

- no trailing whitespace or patch errors;
- only intended semantics changed;
- no public type or marker schema drift;
- no accidental modifications outside five paths;
- Lisa-owned dirty paths remain untouched.

## Step 9 — run the repository gate

Run:

```bash
bun run check
```

This covers:

1. BAML generation;
2. TypeScript typecheck;
3. full Bun test suite.

Pass criteria:

- command exits zero;
- BAML generation succeeds;
- typecheck succeeds;
- every test succeeds.

If BAML generation mechanically changes generated tracked files, inspect them before taking any
action. Do not include unrelated generated drift without proving it belongs to this ticket.

## Step 10 — update progress and commit the source unit

Update private `progress.md` with:

- completed implementation bullets;
- targeted and full-gate results;
- actual tracked diff paths;
- any deviations, or explicitly none;
- planned commit command.

Commit the five-path source unit using:

```bash
lisa commit-ticket \
  --ticket-id T-080-02-02 \
  --message "fix(settle): report open epics and honest baseline" \
  --include src/settle/settle-core.ts \
  --include src/settle/settle-core.test.ts \
  --include src/settle/settle.ts \
  --include src/settle/settle.test.ts \
  --include src/cli.test.ts
```

Do not stage files before this command.

## Step 11 — verify the commit transaction

Run:

```bash
git show --stat --oneline HEAD
git show --format= --name-only HEAD
git status --short
```

Pass criteria:

- HEAD is the ticket source commit;
- exactly five included paths are committed;
- none of those five remains modified or untracked;
- ordinary index contains no ticket-owned staged changes;
- only the pre-existing Lisa-owned changes remain visible.

If the transaction fails, do not fall back to ordinary Git commit. Diagnose `lisa commit-ticket`,
preserve the working files, record the issue, and retry only through the assigned mechanism.

## Step 12 — Review phase

Inspect the committed patch and test evidence. Write private `review.md` covering:

- outcome and acceptance mapping;
- exact committed files;
- behavior and architecture;
- test additions and results;
- commit identity and scope;
- open concerns, limitations, and honest boundary;
- remaining work outside this ticket.

Write exact passing disposition only if all acceptance criteria are met:

```json
{"disposition":"pass","reason":null}
```

Otherwise write a reasoned blocking disposition with a non-empty actionable reason.

After both review artifacts exist, remain on this ticket and stop. Do not start another ticket or
edit its card while waiting for Lisa's completion publication.
