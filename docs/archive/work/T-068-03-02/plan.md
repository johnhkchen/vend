# Plan — T-068-03-02 doctor-orphan-check

## Goal

Make normal-workspace `vend doctor` inspect the canonical board for childless epics, report any
orphan ids with a fix-it hint, and exit non-zero through the existing doctor renderer. Keep clean
boards green, kitchen doctor behavior unchanged, and cast preflight unchanged.

## Step 1 — implement the dedicated board probe

Create `src/doctor/board-hygiene-probe.ts`.

- Define stable check-name constants.
- Define `BoardHygieneProbeDeps` with an injectable async `loadGraph` backend.
- Default `loadGraph` to the canonical `loadWorkGraph`.
- Implement `orphanEpicCheck(graph)` as the pure bridge from `findOrphanEpics` to `Check`.
- Include every orphan id in a singular/plural red name.
- Include every id and a concrete finish-or-remove action in the fix-it hint.
- Implement `probeBoardHygiene()` returning a one-element `Check[]`.
- Catch loader errors and return a red, actionable board-readability check.

Verification after the step: `bun run build` should resolve all imports and signatures.

## Step 2 — add deterministic probe tests

Create `src/doctor/board-hygiene-probe.test.ts` with in-memory graphs built through the real
`buildGraph`.

Test cases:

1. One orphan among populated work:
   - returns a red check;
   - name and hint contain the orphan id;
   - rendered report is failed with exit code 1.
2. Fully populated board:
   - returns a green check without hint;
   - rendered report is green with exit code 0.
3. Multiple orphans:
   - one red check names all ids in deterministic order;
   - plural wording is correct.
4. Loader failure:
   - probe resolves rather than rejects;
   - red check names the board-hygiene/readability failure;
   - hint includes the backend error and repair direction.

Focused verification: `bun test src/doctor/board-hygiene-probe.test.ts`.

## Step 3 — compose the probe into `vend doctor`

Modify only the doctor arm in `src/cli.ts`.

- Keep kitchen signature detection unchanged.
- Keep `probeKitchen(cwd)` unchanged for kitchen workspaces.
- On a normal workspace, lazy-import the existing dependency probe and the new board probe.
- Run the two independent probes concurrently.
- Concatenate dependency checks first and board check last.
- Continue using `renderDoctorReport` for the final verdict and exit code.
- Update the dispatch comment to document the normal-workspace board check and the deliberate
  cast-preflight boundary.

Focused verification:

- `bun test src/doctor/board-hygiene-probe.test.ts`
- `bun test src/doctor/doctor-cli.smoke.test.ts`
- `bun test src/doctor/preflight.test.ts`

The preflight test confirms this change did not accidentally alter the cast gate.

## Step 4 — inspect observable behavior

Run `bun run src/cli.ts doctor` against the current repository as a guarded live observation.
Host dependency checks may be red depending on PATH/environment, so verify shape rather than
requiring an all-green host verdict:

- output starts with a doctor report header;
- output includes a board-hygiene line;
- no stack trace is printed;
- exit status matches whether any check is red.

The deterministic injected tests remain the acceptance proof for orphan/clean outcomes.

## Step 5 — full gate

Run `bun run check`, which performs BAML generation, TypeScript checking, and the full test suite.

If failures arise:

- distinguish ticket regressions from concurrent/shared-worktree changes;
- fix ticket-owned failures in scope;
- record unrelated failures honestly in `progress.md` and `review.md` if they cannot be resolved
  without touching another ticket's work.

The gate must be green before any ticket commit, per AGENTS.md.

## Step 6 — implementation record and commits

Create/update `docs/active/work/T-068-03-02/progress.md` throughout implementation with:

- completed steps;
- commands and results;
- remaining work;
- any deviations from this plan and rationale;
- shared-worktree cautions.

Commit meaningful units without including unrelated dirty files. Intended commit grouping:

1. probe + tests + CLI composition + Research/Design/Structure/Plan/Progress artifacts;
2. Review artifact and any final verification record.

Suggested implementation commit:

```text
feat(doctor): report orphan epics as board hygiene failures (T-068-03-02)
```

Do not modify the ticket's `phase` or `status`; Lisa owns those transitions.

## Step 7 — Review

Write `docs/active/work/T-068-03-02/review.md` covering:

- files created and modified;
- acceptance-criterion mapping;
- design rationale for keeping the check out of cast preflight;
- test coverage and full-gate result;
- observable live behavior;
- open concerns and intentional limitations;
- exact commit(s).

After Review is written, ensure it is committed and stop without updating ticket frontmatter.

## Definition of done

- [ ] Normal `vend doctor` includes one board-hygiene check.
- [ ] An injected orphan graph produces a red check naming the epic id and an actionable hint.
- [ ] Rendering that check produces exit code 1.
- [ ] An injected clean graph produces a green check and rendered exit code 0.
- [ ] Loader errors become red checks rather than stack traces.
- [ ] Kitchen doctor is unchanged.
- [ ] Cast preflight is unchanged.
- [ ] `bun run check` is green.
- [ ] All six work artifacts exist.
- [ ] Ticket-owned changes are committed without unrelated worktree changes.
