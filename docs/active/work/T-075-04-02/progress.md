# T-075-04-02 — Progress: grouping degeneracy diagnosis

## Outcome

Implementation of the spike is complete. The observed `1 group / 198 cards` result has been
reproduced exactly, classified, and handed to the downstream fork as the **document expected
behavior** branch.

No production source change was made. That is the intended implementation result for a diagnosis
ticket whose dependent `T-075-04-03` owns the bounded fix-or-document action.

## Completed work

### Contract and scope

- Read `AGENTS.md`, the complete RDSPI workflow, vision, and charter.
- Read parent story `S-075-04` before conducting research.
- Read ticket `T-075-04-02` and downstream ticket `T-075-04-03`.
- Preserved the story's explicit out-of-slice boundary around structural grouping rework.
- Routed all authored phase files to the private Lisa attempt directory.
- Did not edit ticket phase/status frontmatter.

### Code and history mapping

- Traced bare `vend svg` from `src/cli.ts` to `writeBoardSvg`.
- Confirmed the default seat is designer.
- Confirmed `DESIGNER_PRESET.groupBy === "status"`.
- Confirmed `writeBoardSvg` directly uses the built-in default when no explicit spec is provided.
- Confirmed `projectGraph` uses `stateKey(ticket)` as the status group key.
- Confirmed `stateKey` treats ticket `phase: done` as done even if raw status remains open.
- Confirmed the renderer does not merge semantic groups after projection.
- Traced the status-default change to `T-056-01` / commit `3637141`.
- Read the prior design rationale selecting status over leverage.
- Located the existing demand note that a 100%-done board collapses to one status column.

### Historical reproduction

- Located the survey observation at commit `30a80db`.
- Extracted that exact commit into a temporary directory.
- Ran that snapshot's loader and projection code against that snapshot's board.
- Removed the temporary directory after the read-only probe.

Exact result:

| Fact | Value |
|---|---|
| Tickets | 198 |
| Raw status | 190 open, 8 done |
| Phase | 198 done |
| Normalized state | 198 done |
| Status grouping | 1 group: done 198 |
| Leverage grouping | 3 groups: critical 7, high 177, medium 14 |
| Epic grouping | 80 groups |
| Story grouping | 89 groups |
| Role grouping | 1 group: all 198 |

The status result matches the report exactly.

### Current-board corroboration

At probe time, the moving shared board contained:

- 229 tickets;
- 226 normalized done and 3 normalized open;
- exactly two status groups matching those two distinct normalized values;
- three leverage groups.

This confirms cardinality follows distinct state values and changes naturally as active work enters
or leaves the board.

### Decision

- Classified the result as expected homogeneous-partition behavior.
- Rejected changing status equality semantics because it would invent or mislabel distinctions.
- Kept leverage as a viable future preset calibration, not a correctness repair.
- Selected the documentation branch for `T-075-04-03`.
- Drew the separate-epic boundary around compound, nested, adaptive, or guaranteed-multi-lane
  grouping.
- Determined no structural rework is required to satisfy this story.

## Verification

### Targeted presentation tests

Command:

```bash
bun test src/present/project.test.ts src/present/presets.test.ts src/present/svg-file.test.ts
```

Result:

- 43 pass;
- 0 fail;
- 102 expectations;
- 3 files.

These tests cover mixed-state grouping, axis defaults, deterministic projection, one-way authority,
and the live-board SVG seam.

### Full repository gate

Command:

```bash
bun run check
```

Result:

- BAML client generation: pass;
- TypeScript `tsc --noEmit`: pass;
- Full suite: 1,751 pass, 1 intentionally skipped, 0 fail;
- 5,514 expectations across 116 files.

The skip is the suite's documented optional release-acceptance case, not related to this ticket.

## Files authored

All authored files are under `.lisa/attempts/T-075-04-02/1/work/`:

- `research.md`;
- `design.md`;
- `structure.md`;
- `plan.md`;
- `progress.md`;
- `review.md` (written in Review);
- `review-disposition.json` (written in Review).

Lisa began publishing admitted artifact copies to `docs/active/work/T-075-04-02/` while the ticket
advanced. This worker did not write directly to that shared path.

## Commit record

No `lisa commit-ticket` call was made because no ticket-owned production source unit changed.
Creating an empty commit or including Lisa-owned/shared files would violate the assignment's exact
include discipline. Lisa handles artifact publication and the eventual completion commit.

No ordinary `git add`, `git add -A`, or `git commit` command was used. No ticket-owned file was
staged.

## Deviations from plan

None affecting scope or outcome.

The only operational detail was that `bun run check` continued in a background exec session after
its first output yield; it was polled to completion. The final exit was green.

## Remaining work

Within this ticket: Review artifacts only.

Downstream, after Lisa admits this diagnosis:

- `T-075-04-03` should add the bounded explanatory note to `src/present/project.ts`.
- It should not change grouping semantics or the preset without new product evidence.
- Any compound/hierarchical grouping proposal must be allocated as a separate epic.

