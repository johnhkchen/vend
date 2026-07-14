# T-075-04-02 — Review: grouping degeneracy diagnosis

## Disposition

**Pass.** The ticket's written-diagnosis acceptance criterion is fully met. The cause is pinned by
an exact historical reproduction, the expected-vs-bug classification is explicit, the downstream
branch is chosen, and the structural-rework boundary is bright.

## Diagnosis in one line

The default designer SVG groups by normalized ticket status; at the reported `30a80db` snapshot,
all 198 tickets had `phase: done`, so all 198 normalized through `stateKey` to `done` and correctly
formed one status group. `project.ts` did not drop or merge groups.

## Cause and evidence

The production chain is:

```text
vend svg
→ designer seat
→ DESIGNER_PRESET.groupBy = status
→ groupKeyFor(ticket, status) = stateKey(ticket)
→ phase done normalizes to state done
→ one bucket per distinct normalized state
→ groupCount = projection.groups.length
```

The exact survey commit was reproduced in a temporary checkout:

| Measure | Historical result at `30a80db` |
|---|---|
| Cards/tickets | 198 |
| Raw frontmatter status | 190 open, 8 done |
| Ticket phase | 198 done |
| Presentation state | 198 done |
| Default status groups | 1: done (198) |
| Existing leverage alternative | 3: critical 7, high 177, medium 14 |
| Epic groups | 80 |
| Story groups | 89 |

The raw-status discrepancy is not a bug in the diagnosis. `stateKey` intentionally regards a done
phase as done so finished tickets are not falsely presented as open.

The current moving board corroborated the same rule: 226 done plus 3 open normalized tickets
produced exactly two status groups. Group count follows distinct normalized values, not total card
count.

## Expected behavior vs bug

Verdict: **expected behavior**.

Status grouping is an equivalence partition. When every ticket has the same normalized state, one
group is the truthful result. A renderer or grouping core that fabricated extra status lanes would
misrepresent the declared axis.

The surprising visual shape is a limitation of choosing a low-cardinality progress axis for a
fully mature board, not evidence of lost data. This limitation was already foreshadowed in
`docs/active/demand.md`, which notes that a 100%-done board collapses to one status column.

## Fix-or-document branch

Recommendation: **document**.

`T-075-04-03` should add a concise note in `src/present/project.ts` explaining:

- status grouping uses normalized `stateKey`;
- homogeneous states intentionally yield one group;
- no false subgroup is invented;
- retaining multiple structural lanes requires another declared grouping policy.

No behavior change or new test is needed for this branch. The existing mixed-state unit test
already proves that status grouping splits into `open`, `in_progress`, and `done` when those states
exist.

## Why not switch to leverage here?

Leverage is a real, mechanically bounded alternative and produced three groups on the historical
board. It remains a plausible future designer-preset calibration.

It is not chosen because:

- it answers a different question (priority rather than progress);
- `T-056-01` explicitly evaluated and rejected it as the default in favor of status;
- this spike contains no new designer-probe evidence warranting that policy reversal;
- it also can collapse when priorities are homogeneous;
- the story already accepts honest documentation of expected status collapse.

The planned render-and-watch probe is the right source of evidence for a later preset choice.

## Structural grouping boundary

Structural rework is **not required** to close this story. The comment-only downstream branch is
sufficient.

A **separate epic is required** before implementing any of these:

- status lanes subdivided by epic or story;
- primary and secondary grouping knobs;
- nested `ProjectionGroup` structures;
- adaptive fallback from status to another axis based on cardinality;
- a universal guarantee that every non-empty board renders multiple groups;
- corresponding SVG hierarchical/stable-lane layout.

Those changes alter the presentation spec, projection IR, or semantic predictability and exceed
the story's explicit honest boundary. No separate epic is proposed now because the chosen branch
does not require structural rework; the boundary is recorded for future allocation if user evidence
demands it.

## Files changed

No production source, test, configuration, ticket, or story file was changed by this worker.

Private attempt artifacts authored:

- `research.md`;
- `design.md`;
- `structure.md`;
- `plan.md`;
- `progress.md`;
- `review.md`;
- `review-disposition.json`.

Lisa owns any admitted copies appearing under `docs/active/work/T-075-04-02/` and all ticket phase
transitions. The worker did not write directly to that shared path or edit frontmatter.

## Test coverage

Targeted command:

```bash
bun test src/present/project.test.ts src/present/presets.test.ts src/present/svg-file.test.ts
```

Result: **43 pass, 0 fail**.

Full gate:

```bash
bun run check
```

Result:

- BAML generation passed;
- typecheck passed;
- **1,751 tests passed**;
- **1 test intentionally skipped**;
- **0 failures**;
- 5,514 expectations across 116 files.

No new tests were added because this spike changes no behavior. Historical reproduction provides
ticket-specific evidence; existing tests pin the governing pure rules.

## Acceptance criteria assessment

> A written diagnosis in the ticket work dir names the cause, recommends fix-or-document, and
> draws a bright line on whether a structural grouping rework is required.

- Cause named: **yes** — default status axis plus `phase: done` normalization made all 198 keys
  equal to done.
- Evidence: **yes** — exact `30a80db` reproduction plus current-board corroboration.
- Bug vs expected: **yes** — expected homogeneous partition, not a `project.ts` defect.
- Fix-or-document: **yes** — document branch selected for `T-075-04-03`.
- Structural boundary: **yes** — not required for this story; compound/nested/adaptive grouping
  requires a separate epic.
- Honest outcome: **yes** — the one-column mature view remains a known limitation, not softened.

## Commit and worktree hygiene

No source commit was created because no meaningful ticket-owned source unit exists. This follows
the assignment's exact-include rule and leaves the completion commit to Lisa.

No ordinary staging or commit commands were used. Existing shared-worktree modifications belonging
to Lisa/sibling tickets were preserved.

## Open concerns

1. Documentation will not make an all-done SVG more visually varied; it makes the limitation
   explicit and honest, which is the chosen accepted branch.
2. The live-board test name still describes status grouping as a “glanceable handful”; one is
   mathematically a handful but may not be visually useful. Changing that test or policy belongs
   to downstream/future work, not this spike.
3. If the designer probe later prefers priority lanes, a small preset-calibration ticket may be
   enough. If it demands simultaneous progress and structural lanes, allocate the separate epic
   described above.

No concern blocks this ticket.

