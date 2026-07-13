# T-075-04-02 — Research: grouping degeneracy diagnosis

## Ticket and story contract

- Ticket: `T-075-04-02`, `grouping-degeneracy-diagnosis`.
- Parent story: `S-075-04`, `write-line-grammar-and-grouping-probe`.
- This ticket is a diagnosis spike. Its acceptance criterion asks for a written cause,
  a fix-or-document recommendation, and a bright boundary around structural rework.
- The parent story deliberately separates the diagnosis from the implementation fork:
  `T-075-04-03` depends on this ticket and takes whichever bounded branch the evidence supports.
- Structural grouping rework is outside `S-075-04`; if required, it becomes a separate epic.
- The relevant product invariant is P5, local-first deterministic behavior. The SVG is a local,
  reproducible projection of the repository board.

## Reported observation

- `docs/active/pm/ux-rubric-survey.md` records the CLI output
  `1 groups, 198 cards` and calls out two distinct concerns:
  the plural grammar and possible grouping degeneracy.
- The grammar belongs to sibling `T-075-04-01`.
- This spike concerns only why the projection had one group.
- The survey was committed as `30a80db` (`docs(pm): UX rubric + hands-on survey of the operator
  surface at HEAD`) on 2026-07-12.
- The report is therefore tied to a recoverable repository snapshot rather than an approximate
  recollection of board state.

## End-to-end SVG path

1. `src/cli.ts` parses bare `vend svg` as seat `designer`.
2. `src/cli.ts` calls `writeBoardSvg` in `src/present/svg-file.ts`.
3. `writeBoardSvg` loads the live graph unless one is injected.
4. Unless an explicit spec is injected, it calls `defaultPresetForSeat`.
5. The designer default is the frozen `DESIGNER_PRESET` from `src/present/spec.ts`.
6. `DESIGNER_PRESET.groupBy` is `"status"`.
7. `writeBoardSvg` passes the graph and spec to pure `projectGraph`.
8. `projectGraph` buckets every ticket by the value returned from `groupKeyFor`.
9. For `groupBy: "status"`, `groupKeyFor` returns `stateKey(ticket)`.
10. The returned CLI `groupCount` is exactly `projection.groups.length`.

There is no additional grouping, compaction, or layout-time merging in the file seam or renderer.
The one-group count is determined before SVG layout, in the pure graph-to-projection core.

## Status normalization

`stateKey` lives in `src/present/translate.ts`. For tickets, it returns `"done"` when either:

- `ticket.status === "done"`, or
- `ticket.phase === "done"`.

Otherwise it maps review/in-progress states to `"in_progress"` and normalizes hyphens.
This behavior is documented in its function comment: a ticket whose phase is done reads as done
even if the status field is still open.

That distinction matters on the Vend board. Ticket frontmatter historically retained many
`status: open` values even after Lisa advanced `phase: done`. The presentation layer intentionally
uses the normalized state rather than raw status, so completed tickets do not appear open.

## Exact reproduction of the 198-card board

The repository at commit `30a80db` was extracted to a temporary directory. Its own
`loadWorkGraph`, `DESIGNER_PRESET`, `stateKey`, and `projectGraph` implementations were executed
against its own board files. No working-tree board files were substituted.

Observed ticket fields:

| Measure | Distribution |
|---|---|
| Tickets | 198 |
| Raw `status` | 190 open, 8 done |
| Ticket `phase` | 198 done |
| Normalized `stateKey` | 198 done |

Observed grouping cardinality over the same frozen graph:

| Axis | Groups | Distribution summary |
|---|---:|---|
| `status` | 1 | done: 198 |
| `leverage` | 3 | critical: 7, high: 177, medium: 14 |
| `epic` | 80 | one group per represented epic |
| `story` | 89 | one group per represented story |
| `role` | 1 | all: 198, by explicit honest-empty design |

The reproduced `status` result matches the survey output exactly: one group containing all
198 cards.

## Current-board corroboration

The current shared board is moving because Lisa tickets are active, so it is not the primary
reproduction fixture. A read-only projection at research time observed:

| Measure | Distribution |
|---|---|
| Tickets | 229 |
| Raw `status` | 193 open, 36 done |
| Ticket `phase` | 226 done, 1 research, 1 design, 1 ready |
| Normalized `stateKey` | 226 done, 3 open |
| Status groups | 2: open 3, done 226 |
| Leverage groups | 3: critical 7, high 200, medium 22 |

This corroborates the rule: status-group count follows the number of distinct normalized states,
not card count. When active tickets exist, a second group appears without any code change.

## Origin of the default

- `git blame` identifies commit `3637141` / ticket `T-056-01` as the change that set
  `DESIGNER_PRESET.groupBy` to `"status"`.
- Before that ticket, the designer default grouped by story.
- `T-056-01` intentionally selected status as a coarse, glanceable axis, replacing a very wide
  story-grouped board.
- Its design considered leverage as another coarse axis but chose status because it answers
  “where is the work?” and has a natural open-to-done reading order.
- Its review observed a then-live board with two status groups and explicitly noted that the
  count depends on the board's active states.
- `docs/active/demand.md` later recorded the exact mature-board limitation: on a 100%-done board,
  status collapses to one column; leverage may glance better, described there as a small tuning
  signal rather than a grouping-core defect.

## Existing tests and contracts

- `src/present/project.test.ts` already pins status grouping on a mixed-state mini graph:
  keys are ordered `open`, `in_progress`, `done`.
- The same test file pins every other supported grouping axis.
- `src/present/presets.test.ts` pins the designer default to status and the dev default to epic.
- `src/present/svg-file.test.ts` pins the designer live-board group count to a small status count
  relative to story grouping, without requiring an exact evolving count.
- The pure core deep-freezes its result and deterministically sorts cards and groups.
- No existing contract promises a minimum of two groups for status grouping.
- No code path invents a secondary key when all primary status keys match.

## Boundaries visible in the code

- A `ProjectionGroup` has one flat `key`, one label, and one flat card list.
- `PresentationSpec.groupBy` names exactly one axis.
- There is no secondary grouping field, nested group type, fallback axis, or adaptive grouping
  policy in the projection IR.
- `projectionToSvg` lays out the groups it receives; it does not derive new semantic partitions.
- Splitting a homogeneous status bucket while continuing to call the result status-grouped would
  require a new semantic rule or a richer structural grouping model.
- Switching the default to an existing axis would be mechanically small, but it would change the
  default question the designer view answers. That is preset policy, not a repair to status
  partitioning.

## Constraints and assumptions

- Status labels must remain honest: a completed ticket cannot be presented as open merely to
  create visual balance.
- The projection must remain deterministic and local-first.
- The graph remains authoritative; presentation cannot rewrite ticket state.
- The diagnosis must not absorb `T-075-04-03` implementation work.
- The story explicitly excludes structural grouping rework.
- The reported 198-card result is evaluated at its historical commit because the live board is
  intentionally mutable.
- No saved designer preset affected the reproduction; `writeBoardSvg` currently uses the built-in
  default directly when no explicit spec is supplied.

## Research finding

The one-group SVG is fully explained by the composition of three existing, intentional rules:

1. the designer default selects the status axis;
2. ticket phase `done` normalizes to presentation state `done`; and
3. status grouping creates exactly one bucket per distinct normalized state.

At the reported snapshot, every one of 198 tickets normalized to done, so one group is the exact,
deterministic result of the declared axis. The renderer did not lose groups, merge groups, or
misread the graph.

