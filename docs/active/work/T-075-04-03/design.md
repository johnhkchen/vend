# T-075-04-03 — Design: document expected homogeneous collapse

## Decision

Take the documentation branch selected by `T-075-04-02`.

Add a focused source comment at the `groupKeyFor` status branch in `src/present/project.ts`. The
comment will state that status is a true partition over normalized `stateKey` values, so a board
whose tickets all normalize to the same state intentionally yields one group. It will also state
that stable subgroups require a separately designed compound or secondary grouping policy rather
than invented status keys in this branch.

Do not modify runtime behavior and do not add a behavior test for a guarantee the system does not
make.

## Decision drivers

- The exact historical board was homogeneous after intentional state normalization.
- One status group is mathematically and semantically correct for homogeneous status data.
- The story explicitly accepts documentation when collapse is expected.
- The predecessor chose documentation after comparing all viable branches.
- The ticket must remain bounded and must not absorb structural grouping design.
- Presentation must remain honest, deterministic, and driven by declared spec fields.

## Option A — Document at the status switch branch

Shape:

- place a short explanatory comment immediately above `return stateKey(ticket)`;
- name normalized status as the partition authority;
- explain the one-group homogeneous case;
- name compound/secondary grouping as separate design work.

Advantages:

- The explanation sits exactly where the surprising key is chosen.
- Future maintainers see it before attempting a local fallback or fake split.
- It adds no ambiguity to public interfaces.
- It preserves the pure-core implementation byte-for-byte apart from commentary.
- It satisfies the accepted documentation branch directly in `project.ts`.

Costs:

- The note is local rather than a broad architecture essay.
- It does not change the one-column appearance of an all-done board.

Verdict: chosen. The local seam is the highest-value location for a bounded source note.

## Option B — Expand the `groupKeyFor` function doc comment

Shape:

- extend the existing multi-axis doc block with homogeneous-partition behavior.

Advantages:

- Keeps all group-resolution semantics in one overview.
- Avoids an inline switch comment.

Costs:

- The special status caveat becomes mixed into a compact cross-axis mapping.
- A maintainer editing the status branch may miss the explanation above the function signature.
- Naming the structural boundary there makes the general mapping comment disproportionately long.

Verdict: viable but rejected in favor of adjacency to the exact return statement.

## Option C — Add a regression test for one homogeneous group

Shape:

- fabricate a mostly/all-done graph and assert one status group.

Advantages:

- Mechanically pins the current behavior.
- Would make an accidental fallback-axis change fail loudly.

Costs:

- The ticket acceptance asks for a test only on the alternative fix branch.
- Existing bucket semantics and role's homogeneous group already exercise one-group projection.
- Existing mixed-state coverage proves distinct state values split correctly.
- A new test would add code without changing behavior and could overstate a comment-only contract.
- The predecessor explicitly concluded no new test was needed for the document branch.

Verdict: rejected as unnecessary for this bounded ticket. Existing tests and the full gate verify
the unchanged behavior.

## Option D — Fall back to leverage when status has one key

Advantages:

- The historical snapshot would have produced three groups.
- It uses an existing axis and flat projection representation.

Costs:

- `groupBy: status` would silently mean different axes for different datasets.
- Re-projection semantics would become data-adaptive rather than explicitly authored.
- Labels and group meaning would no longer follow the declared spec alone.
- It reverses the predictability of the single-axis contract.
- Leverage itself can be homogeneous and cannot guarantee multiple groups.

Verdict: rejected. This would be an unrequested semantic change, not a correctness repair.

## Option E — Split by raw status

Advantages:

- The historical snapshot's lagging raw statuses would create two groups.

Costs:

- 190 completed tickets would be presented as open.
- It contradicts `stateKey`'s existing phase-done authority.
- It turns repository bookkeeping lag into a visual distinction.
- It regresses honesty solely to create columns.

Verdict: rejected.

## Option F — Add compound or hierarchical grouping

Possible forms include status lanes subdivided by epic, a secondary grouping field, nested
projection groups, or adaptive primary/secondary axes.

Advantages:

- Can preserve structural lanes on a homogeneous status board.
- Could answer progress and decomposition questions simultaneously.

Costs:

- Changes `PresentationSpec`, projection IR, labeling, ordering, renderer layout, and tests.
- Requires product and UX evidence to choose among several non-equivalent models.
- Crosses the story's explicit out-of-slice boundary.
- Cannot be honestly delivered as a local `project.ts` repair.

Verdict: rejected in this story. If future user evidence requires this capability, create a
separate epic to design the compound-grouping contract end to end.

## Comment content contract

The source note must communicate four facts:

1. `status` partitions the normalized value returned by `stateKey`.
2. Equal normalized states belong in one group.
3. A homogeneous board therefore intentionally produces one group.
4. Stable subgroups require a separately designed grouping policy, not fabricated status keys.

The note should not:

- refer only to the incidental 198-card snapshot;
- imply that all-done is the only homogeneous case;
- promise that leverage is the future answer;
- imply a renderer defect;
- prescribe an unapproved compound model;
- add a TODO that silently claims scope for future work.

## Verification design

- Review the final diff to ensure the source edit is comment-only.
- Run `bun test src/present/project.test.ts` to verify the pure projection core.
- Run the broader presentation tests covering presets and the SVG file seam.
- Run `bun run check` as the repository completion gate.
- Commit only `src/present/project.ts` with `lisa commit-ticket` and its exact path.
- Confirm the ordinary index contains no ticket-owned staged file.

## Consequences

- Runtime output remains unchanged.
- A fully homogeneous status board remains one truthful group.
- The expected collapse is now discoverable at the source decision point.
- The system retains deterministic single-axis semantics.
- No separate epic is created now because the diagnosis does not indicate structural rework is
  required to satisfy the story.
- The note makes clear that any later structural solution must be separately designed and
  allocated.
