# Review — T-079-02-01

## Disposition

Pass. The ticket acceptance criterion is met, focused and full verification are green, the source
unit is committed through Lisa, and no ticket-owned source path remains dirty or staged.

## Outcome

T-079-02-01 establishes the pure sweep assembly contract for S-079-02. Given one canonical work
graph and its matching presweep verdict, the core returns either:

- one non-empty, effect-ready epic flip set; or
- a named, actionable refusal with no flip data.

The successful result identifies each epic status frontmatter transition, restricts pathspec to the
exact flipped epic cards, and supplies deterministic Git provenance naming the phase-done tickets
that cleared each epic.

Eligibility reuses settle-core's `deriveEpicClearance`; this module does not implement a second
all-done predicate. Presweep's board scope comes from `SWEEP_PREFIXES`.

## Commit

```text
13402c8750ed29355bfad86f45947bde8538b41d
feat(sweep): compute pure epic flips
```

The commit was created with `lisa commit-ticket` and exact repository-relative include paths. It
contains only:

- `src/sweep/sweep-core.ts`;
- `src/sweep/sweep-core.test.ts`.

Commit statistics are 2 files and 408 insertions. The ordinary Git index is empty, and
`git status --short -- src/sweep` returns no entries after the commit.

## Files created

### `src/sweep/sweep-core.ts`

This is an addon-free pure module. It imports:

- `SWEEP_PREFIXES` and the `SweepVerdict` type from presweep-core;
- the `WorkGraph` type from the graph model;
- `deriveEpicClearance` from settle-core.

It exports:

- `SWEEP_EPIC_PREFIX`;
- `EpicFrontmatterFlip`;
- `SweepFlipSet`;
- three refusal interfaces and their union;
- `SweepResult`;
- `ComputeSweepInput`;
- `computeSweep`.

There is no filesystem, Git, process, clock, network, BAML, executor, terminal, or CLI dependency.

### `src/sweep/sweep-core.test.ts`

This is a pure fixture-board suite using the canonical `buildGraph` API. It contains 7 tests and 11
assertions.

The main fixture includes:

- one epic with two phase-done tickets;
- one partial epic with one phase-done and one review-phase ticket;
- a phase-done ticket whose status remains open;
- a status-done ticket whose phase remains review.

These disagreements pin ticket phase, through the shared settle derivation, as the completion
authority.

## Public contract review

### Input

`computeSweep` requires:

```ts
{
  graph: WorkGraph;
  presweep: SweepVerdict;
}
```

There are no ambient defaults. The later effect shell supplies an already-loaded graph and a
presweep verdict from the same board snapshot.

### Flip instruction

Each eligible epic becomes:

```ts
{
  epicId: string;
  path: string;
  field: "status";
  from: string;
  to: "done";
  clearedTicketIds: readonly string[];
}
```

This describes the precise frontmatter edit without pretending the read-only graph retains the
original Markdown bytes. T-079-02-02 can read the path and apply a checked field replacement.

Cards already at `status: done` are excluded, so the plan never contains a no-op rewrite.

### Successful aggregate

The `flip-set` branch contains:

- a non-empty ordered `flips` array;
- `pathspec`, derived exactly from `flip.path` values;
- a deterministic provenance `message`.

The acceptance fixture returns exactly:

```text
flipped card: docs/active/epic/E-100.md
transition: status open -> done
cleared tickets: T-100-01, T-100-02
pathspec: docs/active/epic/E-100.md
message subject: sweep: close E-100
```

E-200 is partial and contributes no flip, path, or provenance line.

### Path safety

The epic-card base is derived from the `docs/active/` member of `SWEEP_PREFIXES`, then narrowed to
`docs/active/epic/`.

Each graph epic ID must match canonical `E-<digits>` form before becoming a filename. The returned
pathspec contains exact repository-relative files rather than `docs/active/`, a glob, or any source
prefix.

This makes the downstream staging scope equal to the intended edits by construction.

### Provenance

Message ordering follows sorted epic IDs. Each body line names its epic and its copied, sorted
cleared ticket IDs:

```text
sweep: close E-100

E-100 cleared by T-100-01, T-100-02
```

The message says “close,” not “archive,” preserving the story's boundary.

### Presweep andon

A canonical failed presweep returns:

```text
kind: refusal
code: presweep-offenders
```

with sorted/deduplicated offenders, a reason, and an exact commit-or-restore/rerun action.

The refusal union has no `flips`, `pathspec`, or `message` fields. Tests explicitly assert that no
flip property appears.

Inconsistent typed verdicts (`ok` disagreeing with offender presence) throw `TypeError`, matching
the project's distinction between operational andons and programmer wiring defects.

### Snapshot binding

A passing presweep's canonical done IDs must equal `deriveEpicClearance(graph).doneTicketIds`.
Mismatch returns `stale-presweep` with expected and observed arrays and a rerun action.

This prevents a clean verdict from one board snapshot authorizing flips computed from another.

### Empty/no-op board

When no all-done epic needs a transition, the core returns:

```text
kind: refusal
code: no-epics-ready
```

There is no successful empty flip set. This gives the downstream CLI the named non-zero andon the
story requires when nothing is ready.

## Acceptance assessment

| Acceptance clause | Result | Evidence |
|---|---|---|
| fixture has one all-done epic | met | E-100 has two phase-done tickets |
| fixture has one partial epic | met | E-200 has one done and one review ticket |
| exactly one flip set | met | result has one aggregate `kind: flip-set` |
| done epic card flips | met | exact E-100 `status: open` to `done` instruction |
| partial epic yields none | met | no E-200 flip/path/message entry |
| pathspec limited to flipped board files | met | exact `[docs/active/epic/E-100.md]` |
| provenance names cleared ticket IDs | met | message names T-100-01 and T-100-02 |
| presweep offenders become named refusal | met | exact `presweep-offenders` assertion |
| refusal never becomes a flip | met | refusal type omits flip fields; runtime absence asserted |
| `bun test` green | met | full suite 1893 pass, 0 fail |

## Test coverage

### Focused

Pre- and post-commit command:

```bash
bun test src/sweep
```

Result:

```text
7 pass
0 fail
11 expect() calls
1 file
```

Covered behavior:

- exact mixed-board success result;
- phase/status authority disagreement;
- partial-epic exclusion;
- offender sorting and deduplication;
- failed presweep short-circuit;
- partial-only board;
- already-done epic;
- stale presweep snapshot;
- both inconsistent presweep shapes;
- input array non-mutation.

### Strict build

```bash
bun run build
```

Result: `tsc --noEmit` passed.

### Full repository gate

Pre-commit command:

```bash
bun run check
```

Result:

- BAML generation passed;
- strict TypeScript check passed;
- 1893 tests passed;
- 1 expected release-acceptance skip because no `dist/` artifacts exist;
- 0 tests failed;
- 6100 assertions across 125 files.

## Architecture assessment

The implementation follows pure core / impure shell:

- all judgment consumes plain immutable values;
- all result arrays are fresh;
- caller arrays are copied before canonicalization;
- all-done state has one source in settle-core;
- expected unsafe outcomes are named data;
- pathspec is exact rather than ambient;
- no board mutation occurs in this ticket.

P3 is advanced by binding flip authorization to a matching successful presweep. P4 is advanced by
assembling the previously hand-built change and provenance without operator interpretation.

## Scope and compatibility

- No existing public API was changed.
- No CLI dispatch table was touched.
- No package script was added.
- No board frontmatter was edited.
- No ticket or story was flipped.
- No archive operation was introduced.
- No executor or metering path was introduced.
- Existing settle and presweep behavior remains unchanged.

## Worktree review

Concurrent Lisa-managed changes remain visible outside `src/sweep/`, including provenance, ticket
frontmatter, and published work artifacts. They were present/changed independently and were not
included in commit `13402c8`.

The two ticket-owned source files are clean and committed. Private phase artifacts are complete in
the assigned attempt directory for Lisa publication.

## Downstream handoff

T-079-02-02 should:

1. load the graph and obtain presweep facts from one current repository state;
2. call `computeSweep`;
3. render refusal codes as named non-zero andons;
4. for a flip set, read each exact card path and verify its current status equals `flip.from`;
5. change only the named frontmatter field to `flip.to`;
6. preview the exact files and `message`;
7. write/stage/commit only after the deliberate confirmation keystroke;
8. use only `pathspec` for Git scope;
9. leave the tree untouched when confirmation is declined.

The effect shell should refuse if on-disk bytes no longer match `from`; silently replacing a
different status would defeat the snapshot contract.

## Open concerns

No blocking concern or known acceptance defect remains.

The full Markdown rewrite algorithm and Git effect ordering are intentionally not proven here; they
belong to T-079-02-02. Archiving remains explicitly outside S-079-02.
