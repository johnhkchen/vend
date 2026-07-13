# T-075-04-02 — Plan: complete diagnosis spike

## Objective

Produce a reproducible, actionable diagnosis of the 198-card one-group default SVG, select the
bounded branch for `T-075-04-03`, verify repository health, and hand the result back to Lisa without
modifying production source or shared ticket state.

## Step 1 — Pin the contract

Read, in order:

1. `AGENTS.md`;
2. `docs/knowledge/rdspi-workflow.md`;
3. `docs/knowledge/vision.md`;
4. `docs/active/stories/S-075-04.md`;
5. `docs/active/tickets/T-075-04-02.md`;
6. `docs/knowledge/charter.md`;
7. downstream `T-075-04-03` for the branch handoff.

Pass condition: scope is diagnosis-only, structural grouping rework is recognized as out of slice,
and artifacts are routed to the private attempt directory.

## Step 2 — Trace the production path

Map bare `vend svg` from CLI parse through:

- `writeBoardSvg`;
- designer preset resolution;
- `DESIGNER_PRESET.groupBy`;
- `projectGraph` bucketing;
- `stateKey` normalization;
- returned `groupCount`.

Pass condition: every transformation responsible for the group count is named, and renderer layout
is separated from semantic grouping.

## Step 3 — Inspect intent and tests

Read:

- `T-056-01` research/design/review artifacts;
- `git blame` and log for the preset and grouping branch;
- existing project, preset, and SVG seam tests;
- the demand note about all-done status collapse.

Pass condition: the current behavior is compared to the intent that introduced it, not judged only
from surprising output.

## Step 4 — Reproduce the reported snapshot

Use commit `30a80db`, which introduced the UX survey containing the exact `198 cards` observation.
Extract that commit into a temporary directory and run that snapshot's loader/projection code over
that snapshot's board.

Collect:

- ticket count;
- raw status distribution;
- phase distribution;
- normalized `stateKey` distribution;
- group cardinality for status, leverage, epic, story, and role.

Remove the temporary directory afterward.

Pass condition: the reproduced status projection is one done group containing exactly 198 cards,
matching the survey.

## Step 5 — Corroborate against the current board

Run the same read-only counts at current HEAD/shared state. Treat them as corroboration only because
active Lisa tickets make the board intentionally mutable.

Pass condition: current status groups correspond exactly to currently distinct normalized states,
showing the same rule operates without special casing.

## Step 6 — Evaluate branches

Compare:

1. changing status partition semantics;
2. switching the designer default to leverage;
3. documenting homogeneous collapse;
4. compound/hierarchical grouping.

Assess honesty, determinism, prior intent, scope, and user evidence.

Pass condition: choose one branch with rationale and state which changes cross into a separate
epic.

## Step 7 — Write phase artifacts

Write only under `.lisa/attempts/T-075-04-02/1/work/`:

- `research.md` — descriptive map and evidence;
- `design.md` — options and decision;
- `structure.md` — file boundaries and downstream shape;
- `plan.md` — this executable sequence.

During implementation, add:

- `progress.md` — completed work, verification, and deviations.

During review, add:

- `review.md` — acceptance assessment and handoff;
- `review-disposition.json` — exact machine verdict.

Pass condition: all required files exist; no artifact is written directly to
`docs/active/work/T-075-04-02/`.

## Step 8 — Run targeted verification

Run the grouping-relevant existing suites:

```bash
bun test src/present/project.test.ts src/present/presets.test.ts src/present/svg-file.test.ts
```

Expected coverage:

- normalized mixed-state status partitioning;
- designer/default preset selection;
- live-board file seam group counts;
- projection purity and determinism.

Pass condition: all targeted tests pass.

## Step 9 — Run the repository gate

Run:

```bash
bun run check
```

This performs BAML generation, TypeScript build, and the complete test suite.

Pass condition: green. If it fails because of concurrent unrelated work, record exact evidence and
re-evaluate whether a passing disposition is honest. Do not edit files owned by another ticket.

## Step 10 — Commit decision

Inspect the working tree and confirm this spike has no ticket-owned source changes.

- If no source files changed, do not call `lisa commit-ticket`; there is no meaningful source unit.
- If an unforeseen source change became necessary, first document the deviation, then commit only
  exact ticket-owned paths with `lisa commit-ticket --include ...`.
- Never use `git add`, `git add -A`, or ordinary `git commit`.

Expected path: no source commit. Lisa admits and publishes the private phase artifacts.

## Step 11 — Review and disposition

`review.md` must state:

- exact cause;
- historical and current evidence;
- expected-vs-bug verdict;
- chosen document branch;
- structural-rework boundary;
- changed files;
- test/gate outcomes;
- open concerns.

Write a passing disposition only if the acceptance criterion is fully met and gates support the
handoff:

```json
{"disposition":"pass","reason":null}
```

Otherwise use a non-empty actionable block reason.

## Risks and controls

| Risk | Control |
|---|---|
| Current board no longer has 198 cards | Reproduce exact survey commit |
| Raw status suggests tickets are open | Count `phase` and normalized `stateKey` separately |
| Surprise is mislabeled as code bug | Compare partition result to declared equivalence rule |
| Preset policy is changed without user evidence | Keep leverage as future calibration option |
| Spike absorbs downstream implementation | No source edits; hand branch to `T-075-04-03` |
| Structural rework leaks in | Explicit separate-epic bright line |
| Shared worktree changes are overwritten | Edit only private attempt artifacts |
| Empty/mis-scoped commit is created | Skip commit when no source unit exists |

## Expected outcome

The ticket should pass with a diagnosis that says:

- the default is status grouping;
- all 198 historical tickets normalized to done because all phases were done;
- a one-group status partition is therefore expected and correct;
- `project.ts` did not merge or drop semantic groups;
- `T-075-04-03` should document the expected collapse;
- any compound/hierarchical guarantee of multiple lanes requires a separate epic;
- a future leverage-default calibration is possible but needs designer evidence and is not a bug
  fix.

