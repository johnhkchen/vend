# Structure — T-080-02-02

## Change boundary

The implementation changes five tracked files, all within settle behavior or an existing settle
acceptance test:

1. `src/settle/settle-core.ts`
2. `src/settle/settle-core.test.ts`
3. `src/settle/settle.ts`
4. `src/settle/settle.test.ts`
5. `src/cli.test.ts`

No tracked files are created or deleted. No graph, seam, sweep, play, executor, board-card, marker
schema, or package files change.

Attempt artifacts remain private under:

- `.lisa/attempts/T-080-02-02/1/work/research.md`
- `.lisa/attempts/T-080-02-02/1/work/design.md`
- `.lisa/attempts/T-080-02-02/1/work/structure.md`
- `.lisa/attempts/T-080-02-02/1/work/plan.md`
- `.lisa/attempts/T-080-02-02/1/work/progress.md`
- `.lisa/attempts/T-080-02-02/1/work/review.md`
- `.lisa/attempts/T-080-02-02/1/work/review-disposition.json`

Lisa publishes admitted artifacts later. Ticket code commits exclude this ignored attempt directory
and all Lisa-owned dirty files.

## `src/settle/settle-core.ts`

### Existing responsibility

This module is the pure policy boundary for settle. It accepts a frozen work graph and already
observed facts, validates persisted marker bytes, derives board clearance, and returns one typed
verdict or refusal.

### `deriveEpicClearance`

Current shape:

```ts
export function deriveEpicClearance(graph: WorkGraph): EpicClearanceResult
```

The public signature remains unchanged.

Internal pipeline changes from:

```text
graph.epics -> map containment clearance
graph.tickets -> full done-ticket frontier
```

to:

```text
graph.epics -> filter status != done -> map containment clearance
graph.tickets -> full done-ticket frontier
```

The filter occurs before ticket-map construction, avoiding work for historical epic cards. Exact
status comparison is used:

```ts
epic.status !== "done"
```

The per-epic mapping remains unchanged:

- de-duplicate linked tickets by id;
- sort tickets by id;
- count `ticket.phase === "done"`;
- set `allDone` only for non-empty epics.

`doneTicketIds` continues to derive from all `graph.tickets`, not from retained epic entries.

`allDoneEpicIds` continues to derive from `epics`, so after filtering it means all-done epic cards
still awaiting closeout.

The helper documentation changes to name both scopes:

- non-done epic clearance for display;
- whole-board done-ticket frontier for continuation.

No new types or exported fields are introduced.

### `computeSettleVerdict`

The function signature and result union remain unchanged.

Current delta construction:

```ts
const newlyDoneTicketIds = clearance.doneTicketIds.filter((id) => !priorDone.has(id));
```

New delta construction:

```ts
const newlyDoneTicketIds = marker.firstSettle
  ? []
  : clearance.doneTicketIds.filter((id) => !priorDone.has(id));
```

`priorDone` may remain constructed for both branches; it is harmless and keeps the repeated path
simple. Alternatively, its construction may remain immediately before the conditional.

The returned values retain their existing copying discipline:

- `delta.newlyDoneTicketIds` receives the measured repeated-settle difference or empty first delta;
- `doneTicketIds` receives a copy of the full frontier;
- `nextMarker.doneTicketIds` receives another copy of the full frontier.

The loop, gate, presweep, concerns, exceptions, and refusals are structurally untouched.

## `src/settle/settle-core.test.ts`

### Fixture graph expansion

Add a fourth epic to `fixtureGraph`:

- id `E-050`;
- title describing historical/done state;
- epic status `done`.

Add its linked story:

- id `S-050-01`;
- status `done`;
- ticket list `[T-050-01]`.

Add its linked ticket:

- id `T-050-01`;
- story `S-050-01`;
- status `done`;
- phase `done`;
- no dependencies.

`buildGraph` sorts nodes, so source-array placement does not determine expectations.

### Default input facts

Add `T-050-01` to the default passing presweep `doneIds`. Keep the input array order non-canonical
if useful; `copyPresweep` already sorts it.

### Clearance test

Rename the test description to state both active epic lines and whole-board frontier.

Expected `epics` remains:

- `E-100` open and all done;
- `E-200` open and partial;
- `E-300` open and empty.

Expected `epics` excludes `E-050` entirely.

Expected `doneTicketIds` becomes:

```ts
["T-050-01", "T-100-01", "T-100-02", "T-200-01"]
```

Expected `allDoneEpicIds` remains `["E-100"]`, proving the open all-done epic remains a closeout
candidate while the done epic does not.

### Prior-marker verdict test

Add `T-050-01` to prior marker ids. This prevents unrelated historical state from entering the
measured delta.

Update full-frontier expectations:

- `verdict.doneTicketIds` includes `T-050-01`;
- copied `presweep.doneIds` includes `T-050-01`;
- `verdict.nextMarker.doneTicketIds` includes `T-050-01`.

Keep expected delta as only `T-100-02`.

Keep expected visible epic ids as `E-100`, `E-200`, and `E-300`.

### First-settle verdict test

Rename from “full-board first-settle summary” to wording that distinguishes no-baseline delta from
full future baseline.

Expected delta becomes:

```ts
{ firstSettle: true, newlyDoneTicketIds: [] }
```

Add an exact `nextMarker` expectation containing all four done ticket ids. Retain loop-null and
empty-exceptions expectations.

The immediate-repeat test continues serializing `first.nextMarker`; it needs no logic change and
will prove the first baseline supports an empty repeat.

## `src/settle/settle.ts`

### Existing responsibility

The effectful run path remains unchanged. Only the pure terminal projection inside this module
changes.

### `renderSettleResult`

Retain `deltaIds` construction for repeated settles.

Replace the current conditional first-settle sub-branches with one exact line:

```ts
if (result.delta.firstSettle) {
  lines.push("delta: first settle — no baseline");
} else {
  // existing delta ids / none-since-last-settle behavior
}
```

The renderer still iterates all `result.epics`; filtering is already part of the core verdict. The
existing sweep-ready suffix remains unchanged.

No exported interfaces, constants, or effect functions change.

## `src/settle/settle.test.ts`

### Manual verdict fixture

Change `completeVerdict().delta.newlyDoneTicketIds` to `[]` while keeping `firstSettle: true`.

The fixture's all-done `E-901` remains present. In the typed result it represents a non-done epic
already selected by the core, so its sweep-ready renderer assertion remains valid.

### Renderer contract assertion

Replace the old first-settle ticket-id expectation with:

```text
delta: first settle — no baseline
```

All other output assertions remain intact.

### Markdown-backed settle fixture

Expand `createSettleFixtureRoot` to create:

- `docs/active/epic/E-899.md`, status `done`;
- `docs/active/stories/S-899-01.md`, status `done`;
- `docs/active/tickets/T-899-01.md`, status and phase `done`.

Keep existing `E-900` status `open` with its phase-done ticket `T-900-01`.

The first lifecycle invocation gains assertions over one captured rendered string:

- contains `delta: first settle — no baseline`;
- does not contain an `epic: E-899` line;
- contains `epic: E-900 — 1/1 cleared — sweep ready`;
- `first.nextMarker` contains sorted ids `T-899-01`, `T-900-01`;
- persisted marker bytes contain those same sorted ids.

Existing loop marker consumption and second-invocation assertions remain unchanged.

## `src/cli.test.ts`

In the existing `vend settle` fixture acceptance test, change only the first delta output assertion:

```text
from: delta: first settle — T-900-01
to:   delta: first settle — no baseline
```

Keep the first marker expectation at `T-900-01`, proving the no-baseline line did not discard the
future baseline. Keep the second invocation's `none since last settle` expectation.

## Module and interface boundaries after change

```text
markdown board
  -> loadWorkGraph (unchanged impure read)
  -> WorkGraph (unchanged faithful model)
  -> deriveEpicClearance
       -> visible non-done epic clearance
       -> complete done-ticket frontier
  -> computeSettleVerdict
       -> no measured first delta
       -> full next marker
  -> runSettle (unchanged atomic write)
  -> renderSettleResult
       -> exact no-baseline wording
       -> direct visible epic iteration
```

## Commit boundary

The five tracked files form one meaningful source unit: truthful settle verdict semantics. The pure
core and renderer changes cannot independently keep the repository-wide gate green because old
cross-layer assertions encode the prior contract. They are committed together with one
`lisa commit-ticket` call and five exact `--include` paths.

Excluded from the commit:

- `.lisa/provenance.jsonl`;
- both Lisa-mutated ticket cards;
- ignored attempt artifacts;
- ordinary Git index contents, if any.

## Verification boundary

Fast verification targets the three directly affected test files:

```bash
bun test src/settle/settle-core.test.ts src/settle/settle.test.ts src/cli.test.ts
```

Required final verification is:

```bash
bun run check
```

After the commit, inspect:

- `git show --stat --oneline HEAD`;
- `git show --format= --name-only HEAD`;
- `git status --short`;
- the committed diff for the five included paths.

Success requires the commit to contain only those paths and the worktree to retain only Lisa-owned
pre-existing changes.
