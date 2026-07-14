# T-075-04-02 — Design: fix-or-document decision

## Decision

Classify the 198-card one-group result as **expected status-axis behavior, not a bug in
`project.ts`**. Recommend the bounded **document** branch for `T-075-04-03`: add a concise note at
the status grouping rule explaining that a board whose tickets all normalize to the same state
correctly produces one group.

Do not change grouping behavior in this spike. Do not create a structural-grouping epic merely to
resolve this story, because structural rework is not required to make the current behavior correct
and honest. If the product later requires a mature all-done board to retain both progress semantics
and multiple structural lanes, that is a separate epic-sized grouping-model change.

## Decision criteria

The branch is assessed against:

- factual correctness on the exact 198-card snapshot;
- honest presentation of ticket state;
- preservation of deterministic, local-first projection;
- the prior intent behind the designer preset;
- the story's bounded fix-or-document contract;
- avoidance of an unvalidated product-policy reversal;
- the explicit exclusion of structural grouping rework.

## Option A — Repair `groupKeyFor("status")`

Possible implementations could force more than one group by adding a secondary key, using raw
status instead of normalized state, or falling back to another axis when only one state exists.

Advantages:

- It could guarantee a multi-column picture on a homogeneous board.
- It could satisfy a superficial `groups.length > 1` check.

Problems:

- There is no defect in the existing partition function. Equal status keys belong in one status
  equivalence class.
- Raw status is dishonest for this repository: at the historical snapshot, 190 completed tickets
  still carried raw `status: open` while all 198 had `phase: done`.
- A secondary key would make `groupBy: "status"` mean status-plus-something without expressing that
  in `PresentationSpec` or `ProjectionGroup`.
- An adaptive fallback would make the same declared spec change semantic axes depending on data,
  weakening predictability and reproducibility.
- Nested or compound groups require new IR, layout, labels, tests, and calibration behavior.

Verdict: reject. This treats a truthful homogeneous partition as a core bug and either lies about
state or silently introduces structural grouping semantics.

## Option B — Change the designer default to `leverage`

The existing leverage axis produced three groups on the historical board:
critical 7, high 177, medium 14. Mechanically, this is a small preset edit with test updates.

Advantages:

- It remains within existing types and projection structure.
- It produces multiple groups on the exact mature-board snapshot.
- Priority tiers can be meaningful even when every ticket is complete.

Problems:

- It answers “how important was this work?” rather than “where is this work now?”
- `T-056-01` explicitly weighed leverage and chose status for designer glance semantics.
- Changing the default would be a product-policy reversal, not a repair to grouping correctness.
- The render-and-watch designer probe is explicitly later work; there is no new user evidence in
  this spike that justifies reversing the preset before that probe.
- The story permits documentation when collapse is expected, so a policy change is unnecessary
  to meet the honesty contract.
- Even leverage can collapse on a board where every ticket shares one priority; it does not solve
  grouping degeneracy in general.

Verdict: viable future calibration option, rejected for this fork. The evidence proves it creates
three groups, but does not prove it is the right designer default.

## Option C — Document expected homogeneous collapse

Add a focused note in `src/present/project.ts` next to the status branch or group-resolution
contract. The note should say that status is a true partition over normalized `stateKey`; when all
tickets share a state, one group is expected. It should also state that creating stable subgroups
would require a different/compound grouping policy rather than a local bug fix.

Advantages:

- Exactly matches the reproduced behavior and existing semantics.
- Keeps state presentation honest.
- Preserves deterministic one-axis projection.
- Makes the mature-board limitation discoverable at the decision point.
- Fits `T-075-04-03`'s explicit document branch.
- Requires no speculative product change.

Limitations:

- The mature-board SVG remains one column when all tickets normalize to done.
- Documentation explains the tradeoff; it does not improve that picture's visual variety.
- A future user probe may still choose leverage or motivate a richer grouping model.

Verdict: chosen. This is the smallest honest resolution because the observed result is correct for
the declared axis.

## Option D — Introduce compound or hierarchical grouping

Examples include status lanes with epic/story sections, status as color plus epic lanes, adaptive
primary/secondary axes, or nested projection groups.

Advantages:

- Can preserve visible structure on a homogeneous-status board.
- Could show progress and ownership/decomposition simultaneously.
- Could address both very-wide story grouping and very-flat status grouping.

Problems:

- `PresentationSpec` currently expresses one `groupBy` value.
- `ProjectionGroup` is flat and the SVG layout assumes flat lanes.
- Labels, ordering, width, links, persistence, calibration, and tests all need reconsideration.
- The right compound model is a UX/product decision, not inferable from the one survey output.
- The parent story explicitly declares structural grouping rework out of slice.

Verdict: reject in this story. This is the bright-line separate-epic branch if later demanded.

## Bug classification

The evidence distinguishes four possible failure sites:

| Site | Finding |
|---|---|
| Graph loading | Correct: 198 tickets loaded |
| State normalization | Correct: every `phase: done` ticket reads done |
| Status partitioning | Correct: 198 equal keys form one bucket |
| SVG rendering/counting | Correct: one projection group is rendered and reported |

No information is dropped between graph and output. The surprising result comes from selecting a
low-cardinality progress axis on a completely completed historical board.

The appropriate label is **expected degeneracy of a valid one-axis partition under homogeneous
data**. “Degeneracy” describes poor visual discrimination for this dataset; it does not establish a
logic defect.

## Fix-or-document recommendation

Choose **document** for `T-075-04-03`.

The documentation should capture:

1. `status` uses normalized `stateKey`, including `phase: done`.
2. One group is expected when every ticket shares that normalized state.
3. The projection must not invent false status distinctions.
4. Multiple stable lanes on such a board require selecting another axis or designing compound
   grouping, not changing the equality rule inside status grouping.

The next ticket need not add a test proving multiple groups, because that would assert a behavior
the chosen branch explicitly does not promise. Existing mixed-state tests already prove status
splits when states actually differ.

## Structural-rework bright line

No structural rework is required to close `S-075-04`. A comment documenting the expected collapse
is sufficient and is exactly one of the story's accepted outcomes.

A separate epic **is required** before doing any of the following:

- nesting epic/story groups inside status lanes;
- adding primary and secondary grouping fields to `PresentationSpec`;
- adaptively changing group axes based on board cardinality;
- changing the projection IR from flat groups to hierarchical groups;
- redesigning SVG layout to retain stable structural lanes within one status;
- claiming a universal multi-group guarantee independent of board values.

A simple future preset calibration from status to leverage could remain a small ticket if backed by
the planned designer probe, but it should not be disguised as a `project.ts` correctness fix.

## Consequences

- `T-075-04-02` owns no production source change.
- `T-075-04-03` should take the documentation branch in `src/present/project.ts`.
- The historical one-group SVG remains an honest rendering of an all-done board.
- The repository retains its deterministic, single-axis grouping contract.
- Future visual-structure work remains explicit and separately allocated if user evidence demands
  it.

