# Research — T-077-04-02: draft-clear-on-success

## Assignment and phase

- Ticket: `T-077-04-02`.
- Parent story: `S-077-04`.
- Starting phase: Research.
- Attempt artifacts belong only in `.lisa/attempts/T-077-04-02/1/work/`.
- Lisa owns ticket phase/status transitions and later publication.
- Ticket-owned source must be committed with `lisa commit-ticket` and exact include paths.

## Story contract

`S-077-04` makes decompose persistence a recovery mechanism, not a history archive.

- A failed or interrupted decompose must leave readable local recovery state.
- A clean run must leave no resumable draft.
- The persisted state contains epic, parsed draft, gate findings, and next repair action.
- Resume, implemented by downstream `T-077-04-04`, begins at gates/effect and avoids a new dispense.
- Doctor, implemented independently by `T-077-04-03`, reports active resumable state.
- Repair/regeneration, gate-taxonomy changes, and budget-contract changes are out of slice.

The ticket advances P4 and P5: unattended work is trustworthy only when failure is recoverable, and
the recovery state is locally owned under `.vend/`.

## Ticket acceptance

The ticket asks the cast lifecycle to clear or settle the persisted draft after successful
materialization. Its observable proof has two sides:

- a gate-failed or timed-out cast does not clear recoverable state;
- a successful cast leaves no active draft.

The phrase “mirroring cast-diff capture→reconcile” points to the terminal cast settlement seam,
where early facts are captured and then reconciled once the final outcome is known.

## Dependency already landed

`T-077-04-01` is complete at HEAD.

Relevant commits:

- `1bae202` adds the draft store and unit tests;
- `79d4ff1` checkpoints decompose drafts after parse and gates;
- `483bcc9` is Lisa's completion commit for the dependency.

The dependency deliberately left success cleanup for this ticket.

## Existing draft store

`src/engine/decompose-draft.ts` owns the recovery ledger.

### Constants

- schema version: `1`;
- default path: `.vend/decompose-drafts.jsonl`;
- recognized play identity: `decompose-epic`.

### Draft record

Every current row is a `DecomposeDraftRecord` containing:

- `v`;
- `runId`;
- `epic`;
- opaque object-shaped `parsedDraft`;
- native `GateVerdict`-shaped `gateFindings`;
- structured `nextRepairAction`;
- `createdAt`.

### Pure functions

- `nextDecomposeRepairAction` derives recovery metadata from findings and exact executor subtype.
- `buildDecomposeDraftRecord` validates the write boundary.
- `serializeDecomposeDraftRecord` emits one newline-terminated JSON row.
- `reviveDecomposeDraftRecord` tolerantly recognizes one draft row.
- `readDecomposeDrafts` parses JSONL, counts invalid rows, and returns valid records.
- `latestDecomposeDraft` selects by append order, optionally for one epic.

### Impure shell

- `appendDecomposeDraft` creates the parent directory and appends one row.
- `loadDecomposeDrafts` reads the file, treating ENOENT as an empty store.

There is currently no clearing, settlement, deletion, compaction, or tombstone API.

## Existing store tests

`src/engine/decompose-draft.test.ts` has five tests covering:

- schema construction and serialization;
- next-action selection;
- tolerant malformed/future-row handling;
- append-order latest selection;
- ENOENT-as-empty loading.

The tests currently define every valid row as a draft row and treat returned records as all valid
historical draft rows. No active-versus-settled distinction exists yet.

## Existing cast checkpoint seam

`src/engine/cast.ts` performs the following relevant sequence:

1. dispense through the selected executor;
2. await transcript writes;
3. meter the terminal result;
4. parse the returned result;
5. run gates unless `skipGates`;
6. for `decompose-epic`, append a draft checkpoint;
7. classify timeout/budget/gate state;
8. run the effect only when authorized;
9. capture effect facts and Git diff;
10. run optional complement review;
11. derive the final settled verdict;
12. reconcile the captured diff;
13. append the terminal run-log row;
14. return or rethrow a settlement error.

The checkpoint is written immediately after real gates return and before classification/effect.
That guarantees a gate STOP and any later interruption have already persisted recovery facts.

## Outcome distinctions in cast

Several facts must not be conflated:

- `verdict.materialize` authorizes calling the effect.
- `reported.ok` says the effect reports that it landed.
- local `materialized` preserves that physical effect fact.
- `settledVerdict.outcome` includes later cross-review or settlement classification.
- `settlementThrew` records unexpected post-effect settlement failure.

A physically landed effect can still finish with a non-success outcome after cross-vendor review.
The story says failed casts retain drafts, so physical materialization alone is not sufficient to
decide cleanup.

## Timeout behavior

An executor timeout before a terminal result sets `timedOut = true` and leaves:

- `result = null`;
- `output = null`;
- `gateVerdict = null`;
- no newly appended checkpoint.

Therefore timeout preservation is observable by beginning with an already-active draft for the
same epic and asserting that the timeout path does not settle it. A timeout cannot invent parsed
state that never existed.

## Success behavior today

A normal gated decompose success currently:

1. appends a checkpoint after gates;
2. materializes through the effect;
3. settles and logs success;
4. returns while the checkpoint remains readable.

This is the exact lifecycle gap owned by the ticket.

## Multi-epic store constraint

The default path is one project-wide JSONL file, not one file per epic or run.

Consequences:

- unlinking the file after one success would erase unrelated recoverable epics;
- truncating the file would have the same defect;
- filtering and rewriting requires read/modify/write coordination with concurrent appenders;
- an append-only settlement fact can target one epic without destroying unrelated rows.

The story's doctor and resume consumers need active recovery state, not necessarily every raw row.
The store reader is the natural boundary at which raw checkpoint/settlement rows can become the
current active-record view.

## Concurrency and durability constraints

The repository permits concurrent ticket work and Vend can run local operations for different
subjects. The current writer uses append-only JSONL. Keeping lifecycle changes append-only:

- preserves the existing persistence convention;
- avoids a whole-file read/replace race;
- permits one epic to settle independently;
- lets later checkpoints for that epic become active again in append order;
- leaves torn or future rows tolerable at the read boundary.

## Pure-core / impure-shell constraint

The house rule requires lifecycle judgment to remain pure and filesystem effects thin.

For this store, that means:

- settlement row validation/serialization/reconciliation belongs in pure functions;
- the filesystem shell should only append the admitted line;
- cast decides when final facts authorize settlement;
- readers expose only active drafts to doctor/resume consumers.

## Relevant downstream expectations

`T-077-04-03` depends on the store and will report a persisted decompose draft. It should not need
to understand stale settled checkpoints.

`T-077-04-04` depends on this ticket and explicitly requires resume to materialize from a stored
draft and then clear it. A reusable settlement primitive is therefore part of the foundation that
ticket consumes.

## Existing test fixtures

`src/engine/cast.test.ts` already contains:

- a BAML-free decompose-shaped gate-failure fixture at the T-077-04-01 acceptance seam;
- an `error_max_turns` fixture that currently succeeds and expects one persisted draft;
- BAML-free fixture plans and real-effect materialization coverage elsewhere in the file;
- stub executors and temporary project roots, so no live spend is required.

The cap-hit fixture's success expectation now conflicts with the new lifecycle contract: after
this ticket it should observe no active draft despite raw checkpoint/settlement rows in the ledger.

## Files in scope

- `src/engine/decompose-draft.ts` — add active-state settlement semantics and append shell.
- `src/engine/decompose-draft.test.ts` — pin settlement reconciliation and filesystem behavior.
- `src/engine/cast.ts` — settle the decompose draft only at successful terminal settlement.
- `src/engine/cast.test.ts` — prove failure/timeout retention and success cleanup.

## Files outside scope

- `src/doctor/*` and doctor wiring belong to `T-077-04-03`.
- `src/cli.ts` and resume dispatch belong to `T-077-04-04`.
- `src/play/decompose-epic.ts` does not own generic cast settlement.
- `src/log/run-log.ts` remains the terminal accounting ledger.
- BAML schemas/generated output do not change.
- Ticket frontmatter and shared work artifacts remain Lisa-owned.

## Worktree state

At research time, source files are clean. Existing modifications are Lisa-owned:

- `.lisa/provenance.jsonl`;
- `docs/active/tickets/T-077-04-02.md`;
- `docs/active/tickets/T-077-04-03.md`.

They must remain untouched and excluded from ticket commits.

## Research conclusion

The repository already captures a complete decompose checkpoint at the correct early seam. The
missing behavior is terminal reconciliation: represent successful settlement without deleting
other epics, make the public loader return active rather than stale recovery state, and invoke that
settlement only after the cast's final outcome is known to be successful. Gate failure naturally
retains the newly written checkpoint; timeout naturally retains any pre-existing checkpoint; and
successful gated materialization can become absent from the active reader without abandoning the
append-only local ledger.
