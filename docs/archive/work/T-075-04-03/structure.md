# T-075-04-03 — Structure: source note boundary

## Change summary

This ticket is a one-file, comment-only production change plus the required private RDSPI
artifacts. It changes no runtime interface, control flow, data type, test fixture, preset, or output.

## Production file

### `src/present/project.ts` — modify

Location:

```text
groupKeyFor(ticket, graph, spec)
└── switch (spec.groupBy)
    └── case "status"
        └── return stateKey(ticket)
```

Add an explanatory comment immediately inside the status branch, before its return statement.

The note owns these concepts:

- normalized `stateKey` is the status partition key;
- homogeneous normalized values intentionally create one group;
- false status subgroups must not be invented locally;
- stable multi-lane behavior requires a separate compound/secondary grouping design.

No executable statement changes.

## Private attempt artifacts

The complete attempt directory contains:

```text
.lisa/attempts/T-075-04-03/1/work/
├── assignment.md
├── research.md
├── design.md
├── structure.md
├── plan.md
├── progress.md
├── review.md
└── review-disposition.json
```

Lisa publishes admitted artifacts to `docs/active/work/T-075-04-03/`. This worker does not write
phase artifacts to that shared path.

## Files intentionally unchanged

### `src/present/project.test.ts`

- No runtime behavior changes.
- Existing mixed-state grouping proves distinct normalized status values split.
- Existing role grouping proves a one-group projection is supported.
- The chosen acceptance branch requires a source note rather than a multi-group test.

### `src/present/spec.ts`

- `PresentationSpec.groupBy` remains a single axis.
- `DESIGNER_PRESET.groupBy` remains status.
- No new policy or preset calibration is introduced.

### `src/present/translate.ts`

- `stateKey` remains authoritative for normalized presentation state.
- Phase-done tickets continue to read as done.

### `src/present/svg-file.ts` and `src/present/projection-svg.ts`

- The file seam and renderer continue to consume flat projection groups.
- Group counts and layout do not change.

### Ticket and story markdown

- `docs/active/tickets/T-075-04-03.md` phase/status fields are Lisa-owned.
- `docs/active/stories/S-075-04.md` remains unchanged.
- No new epic file is created because structural rework was not selected or required.

## Interface impact

Public TypeScript interfaces remain unchanged:

- `ProjectionGroup` remains a flat key/label/cards structure.
- `Projection` remains an ordered group/link result.
- `PresentationSpec.groupBy` remains one `Grouping` value.
- `projectGraph` keeps the same signature and deterministic return shape.

Private function signatures remain unchanged:

- `groupKeyFor(ticket, graph, spec): string`;
- `groupLabelFor(...)`;
- `groupOrdinal(...)`;
- `colorFor(...)`.

## Pure-core boundary

The ticket stays entirely within the pure core's documentation:

- no new effect is introduced;
- no filesystem access moves into `project.ts`;
- no source of time or randomness is added;
- no mutation is added;
- no graph authority changes;
- deep-freeze behavior remains untouched.

## Semantic boundary

The documented rule is equivalence-class grouping:

```text
ticket
  → normalized stateKey(ticket)
  → exact key equality
  → one bucket per distinct key
```

The ticket does not define:

```text
status + epic
status + story
status fallback leverage
minimum group count
nested groups
adaptive grouping
```

Those shapes require a different declared contract and, if pursued, a separate epic.

## Test structure

No test file changes are planned.

Verification reuses existing layers:

1. `src/present/project.test.ts` for pure grouping behavior, determinism, and authority.
2. `src/present/presets.test.ts` for the designer default.
3. `src/present/svg-file.test.ts` for the file seam and observable group count.
4. `bun run check` for generated code, typecheck, and the full suite.

Because the source diff is comment-only, passing existing behavioral gates is the correct evidence
that no runtime regression was introduced.

## Commit unit

There is one meaningful ticket-owned source unit:

```text
src/present/project.ts
```

Commit it after targeted and full verification with:

```text
lisa commit-ticket \
  --ticket-id T-075-04-03 \
  --message "docs(present): explain homogeneous status grouping (T-075-04-03)" \
  --include src/present/project.ts
```

No ordinary `git add`, `git add -A`, or `git commit` command is used.

## Concurrency and ownership

- Shared `.lisa` changes remain untouched.
- Active ticket frontmatter remains untouched.
- Only the exact source path above enters the ticket commit transaction.
- Attempt artifacts remain private until Lisa admits them.
- Final status inspection distinguishes pre-existing shared modifications from ticket-owned state.

## Completion shape

Implementation is structurally complete when:

- the source note exists at the status branch;
- its wording names expected homogeneous collapse and the separate-design boundary;
- no executable line changes;
- targeted presentation tests pass;
- `bun run check` passes;
- `src/present/project.ts` is committed through Lisa with an exact include;
- all Review artifacts exist in the private attempt directory.
