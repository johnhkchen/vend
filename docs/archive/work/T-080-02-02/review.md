# Review — T-080-02-02

## Disposition

Pass.

The ticket acceptance is implemented, test-proven, full-gate green, and committed through the
required Lisa exact-path transaction. No ticket-owned source remains modified, staged, or
untracked.

## Outcome

Settle now tells two previously conflated truths separately:

- epic lines are the non-done epic cards still awaiting closeout, not historical done epics;
- an initial settle has no comparison baseline, so it does not claim historical done tickets as a
  fresh delta.

At the same time, settle retains the complete current done-ticket set in `nextMarker`, so the first
observation becomes a valid baseline for the next settle. An open epic whose tickets are all phase
done remains visible and retains `— sweep ready`.

## Committed change

Commit:

- `065acefe25d032a15b8cb823c20ac4db047bdfb8`
- `fix(settle): report open epics and honest baseline`

Exact committed paths:

1. `src/settle/settle-core.ts`
2. `src/settle/settle-core.test.ts`
3. `src/settle/settle.ts`
4. `src/settle/settle.test.ts`
5. `src/cli.test.ts`

Commit size:

- 5 files changed;
- 85 insertions;
- 44 deletions.

No Lisa state, board cards, shared work artifacts, seam files, or concurrent-ticket paths entered
the commit.

## Source review

### `deriveEpicClearance`

The helper now filters `graph.epics` with exact `epic.status !== "done"` before deriving per-epic
clearance.

This is the correct authority boundary:

- epic card status determines whether the epic remains a verdict closeout candidate;
- ticket phase determines per-epic cleared counts;
- the graph's flat ticket index independently determines durable done-ticket history.

The existing non-vacuous all-done rule remains intact. Therefore:

- a status-done epic is hidden even if its tickets are done;
- an open epic with all tickets phase done remains visible and all done;
- an open empty epic remains visible but is not sweep-ready;
- an open partial epic remains visible with its current clearance ratio.

`allDoneEpicIds` now follows the filtered epic set. Its meaning is consequently aligned with visible
open closeout candidates rather than historical all-done cards.

No type field was added just to carry epic status into the renderer. The renderer continues to
project already-decided core facts.

### `computeSettleVerdict`

When `parseLastSettleMarker` reports `firstSettle: true`, `newlyDoneTicketIds` is now empty.

For a valid prior marker, the original set-difference behavior is unchanged. Repeated settles still
report only currently done ids absent from the prior marker.

The complete current frontier remains copied into:

- top-level `doneTicketIds`;
- `nextMarker.doneTicketIds`.

This separation is load-bearing. The human result does not invent a delta without a comparison,
while the persistence layer still establishes the future comparison point.

Marker version, validation, serialization, and refusal behavior did not change.

### `renderSettleResult`

Every first-settle verdict now renders exactly:

```text
delta: first settle — no baseline
```

The renderer no longer selects between a historical id list and “no completed tickets.” Both old
branches were misleading because an absent baseline says nothing about when current completions
occurred.

Repeated-settle rendering remains unchanged:

- non-empty measured delta prints ids;
- empty measured delta prints `delta: none since last settle`.

Epic rendering remains direct iteration over `result.epics`, with the existing `sweep ready` suffix
for `allDone` entries.

## Test coverage review

### Pure core coverage

The canonical graph fixture now includes four lifecycle cases:

- `E-050`: status done, with one phase-done historical ticket;
- `E-100`: status open, with all tickets phase done;
- `E-200`: status open, partially cleared;
- `E-300`: status open, empty.

Assertions prove:

- `E-050` is absent from epic clearance;
- `E-100` remains present and all done;
- `E-200` and `E-300` remain present with honest ratios;
- the global done-ticket frontier still includes `T-050-01`;
- `allDoneEpicIds` contains the open all-done epic only.

The prior-marker verdict test proves the hidden historical ticket remains in verdict, presweep, and
next-marker done sets while the measured delta remains only the actually new id.

The first-settle verdict test proves:

- `firstSettle` is true;
- `newlyDoneTicketIds` is empty;
- `nextMarker` contains every current done ticket, including hidden history;
- no exception is invented.

The existing immediate-repeat test serializes that full first marker and still proves the next
delta is empty.

### Renderer coverage

The renderer fixture expects the exact no-baseline line. Existing assertions continue covering:

- loop provenance;
- partial and sweep-ready epic lines;
- gate and presweep output;
- review concern output;
- actionable exception text;
- ANSI red wrapping;
- final newline;
- immediate repeated empty delta;
- typed refusal paths.

### Markdown-backed shell coverage

The run-settle fixture repository now contains both:

- status-done `E-899` with done `T-899-01`;
- status-open, all-done `E-900` with done `T-900-01`.

The first real load/compute/persist/render cycle proves:

- first output contains `delta: first settle — no baseline`;
- no `epic: E-899` line appears;
- `epic: E-900 — 1/1 cleared — sweep ready` appears;
- returned `nextMarker` contains both ticket ids;
- persisted marker bytes contain both ticket ids in canonical order.

The existing second invocation still proves an immediate repeat reports no delta and loop
provenance is consumed only once.

### CLI acceptance coverage

The existing free `vend settle` fixture now expects the no-baseline line on first invocation while
retaining its marker assertion and second-invocation empty-delta assertion. It continues proving no
executor invocation and no run-ledger mutation.

## Verification evidence

Baseline before edits:

- affected suite: 168 pass, 0 fail, 563 expectations.

After edits:

- `bun test src/settle/settle-core.test.ts`: 18 pass, 0 fail, 58 expectations;
- `bun test src/settle/settle.test.ts`: 15 pass, 0 fail, 69 expectations;
- `bun test src/cli.test.ts`: 135 pass, 0 fail, 442 expectations;
- combined affected suite: 168 pass, 0 fail, 569 expectations;
- `git diff --check` on all five paths: clean.

Required repository gate:

- `bun run check`: exit 0;
- BAML generation: green;
- TypeScript: green;
- Bun: 1,932 pass, 1 intentional skip, 0 fail, 6,317 expectations across 126 files.

The first full-gate attempt encountered transient TypeScript failures in concurrent
`T-080-01-02` seam work. No ticket-owned file was implicated or changed in response. Once that
concurrent implementation completed its matching source edits, `check:typecheck` and the complete
gate passed. This is recorded in `progress.md` for traceability.

## Acceptance mapping

### Mixed done/open epic fixture

Met.

Both pure and markdown-backed fixtures include status-done and status-open epics. The rendered
integration result excludes the done epic and includes the open epic.

### All-done-but-open epic remains sweep-ready

Met.

`E-900` is status open with its only ticket phase done, and the rendered fixture asserts the full
`epic: E-900 — 1/1 cleared — sweep ready` line.

### Null prior marker renders honest first baseline

Met.

Core delta is empty for `lastSettleContents: null`; renderer and CLI both assert the exact
`delta: first settle — no baseline` wording.

### No historical ticket-id flood

Met.

The typed first delta contains no ids and the rendered first line contains no id list, even though
the fixture has multiple historical/current done tickets.

### Future baseline remains complete

Met.

Both returned and persisted next markers contain the full sorted done-ticket set, including the
ticket under the hidden status-done epic.

### `bun run check` green

Met.

Final required gate exited zero with 1,932 passing tests and no failures.

## Architecture and scope review

- Pure core / impure shell remains intact.
- No filesystem logic moved into the core.
- No board mutation was introduced.
- No marker schema migration was introduced.
- No executor or budget path was introduced.
- No seam recorder file was touched by the ticket commit.
- No sweep behavior was touched.
- No epic cards were archived or moved.
- No automatic sweep gesture was added.
- The ticket remains within `S-080-02` scope and P3 truthfulness intent.

## Open concerns and honest boundary

- The first-settle path cannot be observed live on this repository because `.vend/last-settle.json`
  already exists. The null-marker path is fixture-proven as the story explicitly allows.
- Epic status comparison is intentionally exact (`done`). The graph is a faithful string mirror;
  normalization or alternate done vocabularies remain outside this ticket.
- Hiding a done epic changes verdict display only. It does not archive, delete, or relocate cards.
- The full repository gate included concurrent seam work present in the shared tree. The ticket's
  directly affected suite also passed independently, and the exact ticket commit contains no seam
  path.
- No known TODO, defect, test gap within acceptance, or human action is required before completion.

## Final assessment

The change is small, deterministic, backward-compatible at the marker/interface level, and pinned
at pure, shell-integration, renderer, and CLI layers. It corrects the two false historical claims
without weakening continuation state or sweep readiness. Disposition: pass.
