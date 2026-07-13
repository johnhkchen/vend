# T-075-04-02 — Structure: diagnosis deliverable

## Scope shape

This ticket is a spike whose production deliverable is the decision recorded in its private
attempt work directory. It does not implement the downstream branch and therefore creates no
source, test, configuration, or board-file changes.

The output structure is intentionally documentation-only:

```text
.lisa/attempts/T-075-04-02/1/work/
├── assignment.md              # Lisa-provided immutable assignment
├── research.md                # code/data map and exact reproduction
├── design.md                  # options, verdict, and structural boundary
├── structure.md               # this file-level blueprint
├── plan.md                    # execution and verification sequence
├── progress.md                # implementation record
├── review.md                  # reviewer handoff and acceptance assessment
└── review-disposition.json    # exact machine-readable pass/block verdict
```

Lisa publishes admitted phase artifacts into `docs/active/work/T-075-04-02/`; this attempt must not
write there directly.

## Files read as evidence

| File | Role in diagnosis |
|---|---|
| `docs/active/stories/S-075-04.md` | Scope, acceptance, honest boundary, DAG |
| `docs/active/tickets/T-075-04-02.md` | Spike contract |
| `docs/active/tickets/T-075-04-03.md` | Downstream fix-or-document interface |
| `docs/active/pm/ux-rubric-survey.md` | Original 198-card observation |
| `docs/active/demand.md` | Prior explicit mature-board limitation |
| `src/cli.ts` | Default `vend svg` seat and returned count |
| `src/present/svg-file.ts` | Graph/spec/project/render seam |
| `src/present/spec.ts` | Designer default `groupBy: status` |
| `src/present/presets.ts` | Static seat default behavior |
| `src/present/translate.ts` | `stateKey` normalization authority |
| `src/present/project.ts` | Pure group key and bucket construction |
| `src/present/project.test.ts` | Existing grouping behavior coverage |
| `src/present/presets.test.ts` | Existing default-axis coverage |
| `src/present/svg-file.test.ts` | Existing live-board group-count coverage |

## Ticket-owned files changed

Only the attempt artifacts listed above are ticket-owned in this ticket.

No modifications are planned for:

- `src/present/project.ts`;
- `src/present/project.test.ts`;
- `src/present/spec.ts`;
- `src/present/svg-file.ts`;
- any ticket or story frontmatter;
- any shared `docs/active/work` path.

The reason is phase ownership, not uncertainty: `T-075-04-03` owns the selected documentation
branch in source. Keeping that change downstream preserves the story DAG and avoids collapsing the
spike and implementation ticket into one unit.

## Evidence interface

The written diagnosis exposes the following stable facts for `T-075-04-03`:

```text
reported snapshot: commit 30a80db
tickets:           198
ticket phase:       done = 198
normalized state:  done = 198
default axis:       status
projection result: done group = 198 cards
classification:    expected homogeneous partition
branch:            document
```

The downstream worker should not need to rerun historical archaeology to understand the verdict,
though the reproduction remains possible from the recorded commit.

## Downstream source shape (not implemented here)

`T-075-04-03` should make a bounded comment-only source edit near one of these existing seams:

- the `groupKeyFor` doc comment describing the status branch; or
- the `case "status"` branch returning `stateKey(ticket)`.

The note should explain homogeneous collapse and distinguish it from structural subgrouping.
It should not:

- alter `groupKeyFor`'s signature;
- add a fallback axis;
- change `PresentationSpec`;
- add nested projection groups;
- change the designer preset;
- add a minimum-group invariant;
- revise SVG layout.

This downstream shape is included only to make the decision actionable. This spike leaves the
source untouched.

## Public interfaces

No public TypeScript interface changes.

The current interfaces remain:

- `PresentationSpec.groupBy: Grouping` — one declared axis;
- `Projection.groups: readonly ProjectionGroup[]` — flat semantic partitions;
- `ProjectionGroup.key` — the exact axis key;
- `projectGraph(graph, spec, overlays?)` — pure deterministic projection;
- `writeBoardSvg(opts?)` — impure file seam returning group/card/link counts.

No migration, serialization, or backward-compatibility concern is introduced.

## Pure-core / impure-shell boundary

The diagnostic reproduction respects the existing boundary:

- `loadWorkGraph` is the read-only impure loader;
- `stateKey`, `projectGraph`, and grouping comparisons are pure;
- historical files were extracted into a temporary directory and removed after use;
- no repository board or `.vend` output was mutated for evidence collection.

The downstream documentation branch likewise changes no behavior at either boundary.

## Test structure

No new test is warranted in this spike because there is no new behavior.

Existing coverage already establishes:

- mixed normalized states produce multiple status groups;
- group order is open, in-progress, done;
- designer default is status;
- projection is deterministic and deeply frozen;
- the file seam reports projection group count;
- the live board default remains coarser than story grouping.

Verification for this ticket consists of running the relevant existing tests and the repository
gate, then confirming the spike introduced no ticket-owned source changes.

## Commit structure

There is no meaningful source unit to commit with `lisa commit-ticket`.

The assignment says source units must use `lisa commit-ticket` with exact include paths. Because
this spike changes no ticket-owned source file, calling that command would create an empty or
mis-scoped commit and is intentionally omitted. Lisa owns admission and publication of the private
attempt artifacts.

## Concurrency safety

The shared worktree already contains changes owned by Lisa and sibling work:

- `.lisa.toml`;
- `.lisa/hooks/on-stop.sh`;
- `.lisa/provenance.jsonl`;
- `.lisa/completion-journal.jsonl`;
- active ticket frontmatter;
- `docs/active/work/T-075-04-01/`.

This ticket neither edits nor stages those files. All authored files remain under its private
attempt directory. Final status inspection must distinguish those pre-existing shared changes from
this ticket's artifact files.

## Completion shape

Review is complete when:

1. all six phase artifacts exist in the attempt directory;
2. the diagnosis names the cause and exact historical evidence;
3. the design chooses document and states why;
4. the structural-rework boundary is explicit;
5. relevant tests and `bun run check` are recorded;
6. `review-disposition.json` is exactly a passing disposition if gates are green;
7. no ticket-owned source file is modified, staged, or untracked.

