# T-075-04-03 — Review: expected status-group collapse

## Disposition

**Pass.** The ticket took the bounded documentation branch selected by its completed diagnosis,
added the required explanation to `src/present/project.ts`, preserved runtime semantics, passed
targeted and full verification, and committed its sole source unit through Lisa with an exact
include path.

## Acceptance result

Ticket acceptance permits either:

1. a test proving a full mostly-done board produces more than one meaningful group; or
2. a note in `project.ts` explaining why the collapse is expected, with structural rework kept in
   a separate epic when indicated.

This implementation satisfies branch 2.

The source now documents that:

- status grouping partitions normalized `stateKey` values;
- a board whose tickets share one normalized state intentionally produces one group;
- status grouping must not fabricate subgroup keys;
- stable subgroups require a separately designed compound/secondary grouping policy.

The predecessor diagnosis found structural rework unnecessary for correctness, so no speculative
epic was created. The source and work artifacts retain the explicit boundary: if future evidence
requires simultaneous status and structural lanes, that is separate-epic design work.

## What changed

### `src/present/project.ts`

Three comment lines were added at the exact status-key resolution branch in `groupKeyFor`:

```ts
case "status":
  // Status is a true partition over normalized state: if every ticket has the same `stateKey`,
  // one group is expected. Stable subgroups on such a board require a separately designed
  // compound/secondary grouping policy, not invented status keys here.
  return stateKey(ticket);
```

No executable line changed.

### Private work artifacts

Authored under `.lisa/attempts/T-075-04-03/1/work/`:

- `research.md`;
- `design.md`;
- `structure.md`;
- `plan.md`;
- `progress.md`;
- `review.md`;
- `review-disposition.json`.

Lisa began publishing admitted copies to `docs/active/work/T-075-04-03/`. This worker did not write
phase artifacts directly to that shared path.

## Why documentation is the correct branch

The predecessor reproduced the exact survey snapshot rather than inferring from the current moving
board:

| Measure | Result at `30a80db` |
|---|---:|
| Tickets | 198 |
| Raw status open/done | 190 / 8 |
| Phase done | 198 |
| Normalized state done | 198 |
| Default status groups | 1 |

`stateKey` intentionally treats `phase: done` as done even when raw status lags. Therefore all 198
tickets had the same truthful presentation key. A one-axis equivalence partition with one distinct
key has one group.

The graph loader loaded all cards, `groupKeyFor` returned the expected values, bucket materialization
preserved them, and the renderer did not merge semantic groups. The surprising one-column picture
is a limitation of a low-cardinality progress axis on homogeneous data, not a data-loss or grouping
bug.

## Alternatives not implemented

### Raw status split

Rejected because it would present 190 completed tickets as open merely to produce columns. That
would conflict with normalized presentation authority.

### Automatic leverage fallback

Rejected because `groupBy: status` would silently change meaning based on the data. Leverage also
can be homogeneous and offers no universal multi-group guarantee.

### Designer preset change

Rejected because switching status to leverage is a product-calibration decision. Prior work chose
status deliberately, and this ticket contains no new user evidence warranting reversal.

### Compound or hierarchical grouping

Rejected in-slice because it changes the spec, projection IR, labels, ordering, renderer layout,
and tests. It requires a separate epic if later user evidence indicates the need.

## Test coverage

### Targeted presentation tests

Command:

```bash
bun test src/present/project.test.ts src/present/presets.test.ts src/present/svg-file.test.ts
```

Result:

- **43 passed**;
- **0 failed**;
- 102 expectations across 3 files.

These suites cover:

- grouping by epic, story, status, leverage, and role;
- open/in-progress/done status ordering;
- one-group honest behavior;
- exact card coverage across groups;
- deterministic and deeply frozen projection;
- one-way graph authority;
- designer status preset selection;
- SVG file-seam counts and live-board read-only behavior.

### Full repository gate

Command:

```bash
bun run check
```

Result:

- BAML generation: pass;
- TypeScript typecheck: pass;
- **1,751 tests passed**;
- **1 existing intentional skip**;
- **0 failures**;
- 5,514 expectations across 116 files.

The skipped test is the suite's optional real-`dist/` release acceptance case. It is unrelated to
this ticket.

## Why no new test was added

No behavior changed, and the ticket explicitly offers source documentation as the alternative to a
multi-group behavior test. Existing tests already prove that distinct normalized states split into
distinct groups and that a valid grouping axis may produce one group.

Adding a `groups.length > 1` assertion would contradict the chosen, evidence-backed branch. Adding
another one-group fixture would duplicate the existing partition mechanics without testing the
source comment. Review of the exact comment-only diff plus the existing behavioral gates is the
proportionate verification strategy.

## Interface and architecture assessment

- `PresentationSpec.groupBy` remains a single declared axis.
- `ProjectionGroup` remains flat.
- `projectGraph` retains its signature and deterministic output.
- `stateKey` remains the normalized-state authority.
- `DESIGNER_PRESET.groupBy` remains status.
- The pure-core / impure-shell boundary is unchanged.
- No filesystem, clock, network, or mutation behavior was added.
- No output, serialization, or migration concern was introduced.

## Commit record

Source commit:

```text
8202feca43205ffe51a90cbe44c85d31c0362fab
docs(present): explain homogeneous status grouping (T-075-04-03)
```

The commit contains exactly:

```text
src/present/project.ts | 3 +++
```

It was created with `lisa commit-ticket`, ticket ID `T-075-04-03`, and exact include path
`src/present/project.ts`. No ordinary `git add`, `git add -A`, or `git commit` command was used.

## Worktree hygiene

Post-commit inspection shows no staged, modified, or untracked ticket-owned source file.

Remaining worktree entries are Lisa-managed:

- `.lisa.toml`;
- `.lisa/hooks/on-stop.sh`;
- `.lisa/provenance.jsonl`;
- `.lisa/completion-journal.jsonl`;
- `docs/active/tickets/T-075-04-03.md`;
- Lisa-published `docs/active/work/T-075-04-03/` artifacts.

They were preserved and excluded from the source commit.

## Open concerns and limitations

1. Documentation does not make a fully homogeneous board visually richer. It makes the current
   result explicit and honest, which is the story's accepted outcome.
2. A later designer render-and-watch probe may prefer leverage as a default. That would be preset
   calibration backed by user evidence, not a correction to status equality.
3. If future product requirements demand progress lanes plus stable structural subdivisions, the
   project must allocate a separate epic for compound grouping across spec, projection, layout,
   and tests.

None of these concerns blocks this ticket.

## Final assessment

The work is grounded in an exact historical reproduction, remains within the story's honest
boundary, changes only documentation at the relevant pure-core seam, and is fully verified and
committed. Acceptance is met without inflating the slice or weakening presentation truth.
