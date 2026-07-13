# T-075-04-03 — Research: grouping fork

## Assignment and phase contract

- Ticket `T-075-04-03` is the final ticket in story `S-075-04`.
- It depends on diagnosis ticket `T-075-04-02`, which is complete and published.
- The assignment requires all remaining RDSPI phases in one continuous pass.
- Attempt artifacts belong only under `.lisa/attempts/T-075-04-03/1/work/`.
- Lisa, not this worker, publishes admitted artifacts and changes ticket phase/status fields.
- Meaningful source units must be committed with `lisa commit-ticket` and exact include paths.
- The repository gate is `bun run check`.

## Story contract

- The story covers the `vend svg` count grammar, a diagnosis of status grouping degeneracy, and
  the bounded fix-or-document fork selected by that diagnosis.
- Sibling ticket `T-075-04-01` already landed the grammar edit.
- Predecessor ticket `T-075-04-02` already reproduced and classified the grouping observation.
- This ticket owns only the selected downstream branch.
- Story acceptance permits either a tested meaningful split or a source note explaining expected
  collapse.
- The story explicitly excludes structural grouping rework.
- Structural work, if evidence requires it, must be allocated as a separate epic.

## Product grounding

- P5 requires local-first behavior: projection is computed locally from repository state.
- P3 requires gates to make outcomes trustworthy: the selected branch must be reviewable and the
  repository gate must remain green.
- The vision requires repeatability over probabilistic work; deterministic presentation supports
  that consistency.
- The charter requires work to be grounded, right-sized, in-bounds, and verifiable.
- Expanding a comment-sized resolution into a new grouping model would violate the ticket's
  allocatable and in-bounds constraints.

## Predecessor diagnosis

- `T-075-04-02` reproduced the reported survey snapshot at commit `30a80db`.
- That snapshot contained 198 tickets.
- Raw ticket status was 190 open and 8 done.
- Ticket phase was done for all 198 tickets.
- Presentation state normalization therefore produced done for all 198 tickets.
- Default designer grouping produced one group: `done`, containing 198 cards.
- The reproduction used the historical snapshot's loader, preset, state normalizer, and projector.
- No group was dropped or merged by the renderer.

## Current projection path

1. Bare `vend svg` selects the designer seat.
2. The SVG file seam resolves the built-in designer preset.
3. `DESIGNER_PRESET.groupBy` is `status`.
4. `projectGraph` visits every ticket in the loaded `WorkGraph`.
5. `groupKeyFor` selects the grouping key for the declared axis.
6. The status branch returns `stateKey(ticket)`.
7. A `Map` bucket is created for each distinct returned key.
8. Each ticket is placed in exactly one bucket.
9. Buckets become flat `ProjectionGroup` values.
10. The file seam reports `projection.groups.length`.

## State authority

- `stateKey` is defined in `src/present/translate.ts`.
- A ticket is presented as done when its status is done or its phase is done.
- This is intentional one-way presentation authority over the canonical graph.
- It prevents completed tickets with lagging raw status frontmatter from appearing open.
- Status grouping therefore partitions normalized presentation state, not raw YAML status text.
- Changing status grouping to raw status would conflict with the existing state contract.

## `project.ts` structure

- `src/present/project.ts` is the pure graph-to-projection core.
- It imports graph and spec types plus pure presentation helpers.
- It has no filesystem, clock, network, or native-addon effects.
- `ProjectionGroup` is flat: key, label, and cards.
- `PresentationSpec.groupBy` names exactly one grouping axis.
- `groupKeyFor` is private and resolves one key per ticket.
- Its existing doc comment lists the field authority for each grouping axis.
- The status switch branch is currently a single `return stateKey(ticket)`.
- `projectGraph` builds buckets directly from those keys without a fallback axis.
- The result is deeply frozen and deterministically sorted.

## Existing semantic boundaries

- Epic grouping follows ticket → story → epic.
- Story grouping uses `storyId`.
- Status grouping uses normalized `stateKey`.
- Leverage grouping uses priority as the existing proxy.
- Role grouping honestly produces one `all` group because tickets have no role field.
- No grouping branch guarantees more than one group.
- Group count is the cardinality of distinct values for the declared axis.
- Homogeneous inputs naturally produce one equivalence class.

## Existing tests

- `src/present/project.test.ts` uses a fabricated frozen mini graph.
- Its mixed-state test proves status keys order as open, in-progress, then done.
- The same suite proves epic, story, leverage, and role grouping.
- It proves every ticket is represented and projection is deterministic and frozen.
- It tests graph authority by checking input references remain unchanged.
- `src/present/presets.test.ts` pins status as the designer default.
- `src/present/svg-file.test.ts` covers the live-board SVG group-count seam.
- Existing tests already cover behavior; the selected branch introduces no behavior change.

## Historical intent

- `T-056-01` changed the designer default from story to status.
- That work intentionally selected status as a coarse, glanceable progress axis.
- It considered leverage but kept status because it answers where work stands.
- Its live board then had multiple distinct states and therefore multiple status groups.
- `docs/active/demand.md` later recorded that a 100%-done board collapses to one status column.
- That note treats leverage as possible later tuning, not as a status-partition correctness repair.

## Repository state and concurrency

- The shared worktree contains Lisa-owned changes in `.lisa` files and active ticket frontmatter.
- Those changes predate this ticket's implementation work and are not ticket-owned.
- Ticket `T-075-04-03.md` is modified by Lisa as part of phase/lease handling.
- This worker must preserve all unrelated modifications.
- Only `src/present/project.ts` is a candidate ticket-owned production file.
- Private attempt artifacts are not included in the source-unit commit; Lisa publishes them.

## Observed constraints

- The source must not invent distinctions that are absent from graph data.
- The declared grouping axis must remain predictable from `PresentationSpec`.
- Status labels must remain consistent with normalized state authority.
- The projection IR remains flat in this story.
- The designer preset remains status in this story.
- SVG layout remains outside this ticket.
- The ticket does not require a new epic because the diagnosis found no structural repair is
  necessary for correctness.
- If future evidence demands simultaneous status and structural lanes, that would cross the
  separate-epic boundary already recorded by the predecessor.

## Research conclusion

The current one-group result is fully explained by existing, intentional contracts: one declared
axis, normalized status keys, and one bucket per distinct key. The relevant source seam is the
status rule inside `groupKeyFor` in `src/present/project.ts`. Existing tests pin the behavior that
the selected branch preserves, while the predecessor's exact reproduction supplies the historical
evidence behind this ticket.
