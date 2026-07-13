# T-075-04-03 — Plan: bounded documentation branch

## Objective

Complete the story's selected fix-or-document fork by documenting the expected homogeneous status
collapse in `src/present/project.ts`, verifying unchanged behavior, committing the exact source unit
through Lisa, and producing the required Review handoff.

## Step 1 — Confirm the predecessor verdict

Read:

- `docs/active/work/T-075-04-02/research.md`;
- `docs/active/work/T-075-04-02/design.md`;
- `docs/active/work/T-075-04-02/progress.md`;
- `docs/active/work/T-075-04-02/review.md`.

Verification:

- cause is normalized homogeneous status;
- classification is expected behavior;
- selected branch is documentation;
- structural repair is not required in this story;
- compound/nested/adaptive grouping is a separate-epic boundary.

Status: completed during Research and Design.

## Step 2 — Inspect the exact source seam

Read `src/present/project.ts` and identify:

- the `groupKeyFor` function comment;
- the `case "status"` switch branch;
- the direct `stateKey(ticket)` return;
- the downstream map-bucket materialization.

Confirm that a comment at the status branch is accurate and close to the decision point.

Status: completed during Research and Structure.

## Step 3 — Add the source note

Modify only `src/present/project.ts` using `apply_patch`.

The comment must state:

- status uses normalized state keys;
- homogeneous normalized state produces one intentional group;
- the branch must not invent subgroup keys;
- multi-lane structural behavior needs separately designed compound/secondary grouping.

Verification:

- inspect `git diff -- src/present/project.ts`;
- confirm no executable line changed;
- confirm no incidental formatting change occurred.

Atomic unit: the source documentation change.

## Step 4 — Run targeted tests

Run:

```bash
bun test src/present/project.test.ts src/present/presets.test.ts src/present/svg-file.test.ts
```

This covers:

- pure grouping across axes;
- mixed normalized status behavior;
- deterministic and frozen projection;
- designer preset status authority;
- SVG file-seam group counts.

Pass criterion: zero failures.

## Step 5 — Run the repository gate

Run:

```bash
bun run check
```

This executes:

- BAML client generation;
- TypeScript typecheck;
- the full Bun test suite.

Pass criterion: command exits zero with no test failures.

If generated code changes unexpectedly, inspect and do not include it without establishing ticket
ownership. The expected result is no generated diff from a comment-only edit.

## Step 6 — Record implementation progress

Write `progress.md` in the private attempt directory with:

- contract and scope confirmation;
- source note summary;
- exact files changed;
- targeted test outcome;
- full gate outcome;
- deviations, if any;
- commit transaction result;
- remaining Review work.

Do not write to `docs/active/work/T-075-04-03/` directly.

## Step 7 — Commit the source unit

After gates pass, commit only the ticket-owned production path:

```bash
lisa commit-ticket \
  --ticket-id T-075-04-03 \
  --message "docs(present): explain homogeneous status grouping (T-075-04-03)" \
  --include src/present/project.ts
```

Do not use the ordinary Git index workflow.

Verification:

- command exits successfully;
- the new commit contains only `src/present/project.ts`;
- the source path is no longer modified or staged;
- unrelated shared-worktree changes remain preserved.

## Step 8 — Review the completed ticket

Inspect:

- committed diff;
- test evidence;
- current worktree state;
- acceptance criterion wording;
- story honest boundary.

Write `review.md` covering:

- disposition;
- decision and rationale;
- exact source change;
- test coverage and results;
- acceptance assessment;
- structural-rework boundary;
- open concerns;
- commit/worktree hygiene.

## Step 9 — Write machine-readable disposition

If the source note is committed and all gates are green, write exactly:

```json
{"disposition":"pass","reason":null}
```

If a required criterion or gate cannot be met, write a blocking disposition with a non-empty,
actionable reason. Do not soften a red outcome.

## Scope guardrails throughout

- Do not change grouping runtime behavior.
- Do not edit the designer preset.
- Do not add fallback or secondary axes.
- Do not add nested projection structures.
- Do not redesign SVG layout.
- Do not create a speculative epic when structural rework is not indicated as necessary.
- Do name the separate-epic boundary for any future structural grouping demand.
- Do not update ticket phase or status.
- Do not touch unrelated Lisa or sibling files.

## Definition of done

- `src/present/project.ts` documents expected homogeneous status collapse.
- The note explains why and marks structural multi-lane work as separate design scope.
- Runtime code is unchanged.
- Targeted tests pass.
- `bun run check` passes.
- The source unit is committed only via `lisa commit-ticket` with its exact path.
- `progress.md`, `review.md`, and `review-disposition.json` are complete in the private attempt.
- The disposition is honest and machine-readable.
