# Research — T-080-02-02

## Ticket and story contract

- Ticket: `T-080-02-02`, `verdict-open-epics-honest-baseline`.
- Parent story: `S-080-02`, `verdict-and-closeout-tell-truth`.
- Current ticket phase is `research`.
- The ticket depends on `T-080-01-01`, which is complete at repository HEAD.
- The ticket advances P3: gates are the contract.
- The acceptance boundary has two settle behaviors:
  - epic lines describe only epics whose epic card is not status `done`;
  - an absent last-settle marker is described as having no baseline, not as a historical delta.
- The open-epic behavior includes an important mixed state:
  - an epic card may remain status `open` after every contained ticket reaches phase `done`;
  - that epic must remain visible and receive the existing `sweep ready` suffix.
- The first-settle behavior also has two distinct outputs:
  - the human delta line must not enumerate historical completed ticket ids;
  - the durable continuation marker must still contain the complete current done-ticket set.
- The story explicitly excludes seam recorder changes, card movement, automatic sweep, and broad
  `.lisa` commit policy.

## Governing project boundaries

- `docs/knowledge/vision.md` identifies consistency as Vend's deeper promise.
- P3 makes gates the trust contract for probabilistic work.
- A settle verdict is itself an operator-facing gate summary, so historical claims must match
  observable state.
- The project house rule is pure core / impure shell.
- Filesystem, subprocess, Git, and marker persistence belong in `src/settle/settle.ts`.
- Board and marker judgment belongs in `src/settle/settle-core.ts`.
- The graph loader is read-only and the settle shell is the only writer in this path.
- The ticket does not require an executor, budget, run-ledger entry, or play invocation.

## Live repository state

- The repository is on `main`, five commits ahead of `origin/main` at research start.
- HEAD is `a5cd47c Complete T-080-01-01`.
- The preceding source commit `5a2bb15` made settle rendering honest about absent loop duration.
- Lisa-owned concurrent state is already dirty:
  - `.lisa/provenance.jsonl`;
  - `docs/active/tickets/T-080-01-02.md`;
  - `docs/active/tickets/T-080-02-02.md`.
- The ticket-card change is Lisa's phase transition from `ready` to `research`.
- Assignment instructions forbid changing ticket phase/status directly.
- Attempt phase artifacts are ignored under `.lisa/attempts/` and must stay there until Lisa
  publishes admitted artifacts.
- The source tree has one applicable `AGENTS.md`, at repository root.
- The live epic directory currently contains 75 status-done epics and 2 status-open epics.
- This ratio explains the observed one-screen flood: current code renders all graph epics.

## Canonical graph model

- `src/graph/load.ts` is the impure board loader.
- It reads markdown nodes from `docs/active/epic`, `stories`, and `tickets`.
- It delegates parsing, linking, validation, sorting, and freezing to `src/graph/model.ts`.
- `WorkGraph.epics`, `.stories`, and `.tickets` are id-sorted frozen arrays.
- `EpicNode` exposes `id`, `title`, `status`, `stories`, and other board metadata.
- Epic status remains a plain string to mirror the board faithfully.
- `StoryNode.tickets` holds linked ticket objects.
- `TicketNode.phase` and `.status` are separate plain-string fields.
- Existing settle logic treats ticket phase `done` as authoritative for ticket clearance.
- Epic containment is canonical object traversal: epic to stories to tickets.
- The graph's flat ticket list supplies the global ticket frontier.
- The graph model performs no settle-specific filtering.

## Pure settle core

- `src/settle/settle-core.ts` defines persisted-marker parsing and verdict assembly.
- `LAST_SETTLE_MARKER_PATH` is `.vend/last-settle.json`.
- Marker version 1 contains exactly `version` and sorted unique `doneTicketIds`.
- `parseLastSettleMarker(null)` returns a successful first-settle result with `marker: null`.
- Malformed marker bytes return a typed actionable refusal.
- `EpicClearance` contains:
  - epic id and title;
  - cleared and total counts;
  - cleared ticket ids;
  - an `allDone` boolean.
- `EpicClearance` does not currently carry epic-card status.
- `deriveEpicClearance(graph)` currently maps every `graph.epics` element.
- It de-duplicates contained tickets by id and sorts them.
- It counts only tickets whose phase equals `done`.
- Empty epics are not considered complete vacuously.
- It separately derives `doneTicketIds` from every ticket in `graph.tickets`.
- It derives `allDoneEpicIds` from the clearance entries whose `allDone` flag is true.
- `computeSettleVerdict` parses loop and last-settle markers before assembling facts.
- It calls `deriveEpicClearance` once.
- It constructs a prior-done set from the marker, or an empty set when no marker exists.
- It currently computes `newlyDoneTicketIds` as every current done id absent from that set.
- On a first settle, the empty prior set makes every historical done id appear newly done.
- The returned `nextMarker` independently copies the full current `doneTicketIds` list.
- The delta and next-marker values therefore already have separate fields and purposes.
- `SettleVerdict.epics` currently receives the full `clearance.epics` array.
- `SettleVerdict.allDoneEpicIds` currently reflects all all-done epics, regardless of card status.

## Impure settle shell and renderer

- `src/settle/settle.ts` loads one graph snapshot, prior marker, and review concerns.
- It runs the repository gate and presweep observations.
- It passes those values into `computeSettleVerdict` once.
- It persists only `result.nextMarker`, and only after a successful verdict.
- Marker publication is atomic through a unique sibling file and rename.
- `renderSettleResult` is pure over a typed `SettleResult` despite living in the shell module.
- The renderer prints loop provenance or `loop: none pending`.
- It joins `delta.newlyDoneTicketIds` for the delta line.
- A first settle with ids currently prints `delta: first settle — <ids>`.
- A first settle without ids currently prints `delta: first settle — no completed tickets`.
- A repeated settle prints either the new ids or `delta: none since last settle`.
- The renderer iterates every `result.epics` entry without any additional filter.
- It appends `— sweep ready` whenever `epic.allDone` is true.
- No renderer field currently exposes source epic-card status.
- Gate, presweep, review concern, exception, ANSI, and loop output are independent of this ticket.

## Existing settle core tests

- `src/settle/settle-core.test.ts` builds a pure fixture graph.
- Its current fixture contains three status-open epics:
  - one with two phase-done tickets;
  - one with one done and one review-phase ticket;
  - one with no stories or tickets.
- It deliberately proves ticket phase, not ticket status, controls clearance.
- It currently expects all three epic clearance entries.
- It expects the all-done open epic in `allDoneEpicIds`.
- It tests prior-marker delta computation and full marker continuation.
- The first-settle test currently names the behavior a “full-board first-settle summary.”
- That test expects all three historical done ticket ids in `newlyDoneTicketIds`.
- The immediate-repeat test serializes the first result's `nextMarker` and expects an empty repeat.
- Marker validation, loop provenance, refusal, exception ordering, and immutability coverage are
  adjacent but outside the requested semantic change.

## Existing renderer and shell tests

- `src/settle/settle.test.ts` has a manually assembled `completeVerdict` fixture.
- That fixture marks first settle true and supplies one newly-done id.
- It contains a partial epic and an all-done epic.
- The renderer test currently expects the first-settle id flood.
- It also expects the all-done epic to carry `sweep ready`.
- A separate test proves repeated-settle empty delta output.
- The run-settle fixture repository currently contains one status-open epic.
- Its sole ticket is phase done, so that epic is an all-done-but-open closeout candidate.
- The lifecycle test calls `runSettle` twice and verifies marker consumption behavior.
- It currently asserts loop lines but does not assert first-baseline or epic filtering semantics.
- The test already imports `readFile` and has access to the persisted marker path.
- This makes it capable of checking both rendered output and full future-baseline bytes.

## CLI acceptance coverage

- `src/cli.test.ts` contains a fixture-repository acceptance test for `vend settle`.
- Its first invocation currently expects `delta: first settle — T-900-01`.
- It verifies the marker contains `T-900-01` after that first invocation.
- Its second invocation expects `delta: none since last settle`.
- It also verifies settle remains free: no executor sentinel and no run-ledger mutation.
- The first-output expectation encodes the old baseline wording and will conflict with the ticket.
- The marker expectation already encodes the required future-baseline behavior.

## Baseline verification

- Before ticket edits, the targeted command was:
  `bun test src/settle/settle-core.test.ts src/settle/settle.test.ts src/cli.test.ts`.
- It passed 168 tests with 563 expectations.
- This establishes that any later targeted failure is introduced by the ticket work.
- The repository-wide required gate remains `bun run check`.
- `bun run check` performs BAML generation, TypeScript typecheck, and the complete Bun test suite.
- Bun is running at the repository-pinned 1.3.13 version.

## Constraints and assumptions surfaced

- “Done epic” refers to epic-card `status: done`, not to an inferred all-tickets-done condition.
- “Sweep ready” applies to a non-done epic whose contained non-empty ticket set is all phase done.
- Historical done tickets remain part of the durable frontier even when their containing epic line
  is hidden.
- A first settle has no comparison point, so `newlyDoneTicketIds` cannot truthfully represent a
  measured delta for that observation.
- The next marker is state for the next observation, not a claim about this observation's delta.
- Exact string comparison uses the board's literal status vocabulary; the graph intentionally does
  not narrow or normalize statuses.
- No migration of marker version or shape is requested.
- No source outside settle and its directly conflicting CLI expectation is implicated.
- Existing Lisa-owned dirty files must remain untouched and excluded from ticket commits.
