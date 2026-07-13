# Design — T-077-04-02: draft-clear-on-success

## Decision to make

The cast writes a decompose checkpoint before classification and effect. This ticket must make that
checkpoint disappear from active recovery state after a clean materialization while preserving it
for failures and interruptions.

The design must also preserve unrelated epics in the shared store, remain safe for append-oriented
local use, give doctor/resume a simple active-state view, and keep lifecycle judgment in pure code.

## Success criterion

A draft is settled only when all of these terminal facts hold:

- the play is `decompose-epic`;
- the effect reported that materialization landed (`materialized === true`);
- the final settled outcome is `success`;
- no earlier settlement operation has thrown.

This is stricter than `verdict.materialize` and stricter than `reported.ok` alone. A cross-review
failure or unexpected settlement error keeps the recovery draft active.

## Option A — delete the whole JSONL file

After success, call `rm`/`unlink` on `.vend/decompose-drafts.jsonl`.

### Advantages

- Very small implementation.
- `loadDecomposeDrafts` naturally reads ENOENT as empty.
- The single-epic happy-path test is simple.

### Disadvantages

- The file is project-wide; clearing E-077 would erase active drafts for every other epic.
- Concurrent or sequential failures for unrelated subjects would be lost.
- This violates the recovery purpose and P4/P5.
- Downstream resume cannot trust that its draft survived another successful cast.

### Assessment

Rejected. File deletion clears more state than the successful cast owns.

## Option B — read, filter, and atomically rewrite the JSONL file

On success, load all rows, remove draft rows for the successful epic, write a temporary sibling,
then rename over the store.

### Advantages

- The physical file contains only currently active draft rows.
- Unrelated epics can be retained.
- Loader semantics need little change.

### Disadvantages

- Read/modify/write races with an append between the read and rename can lose a new checkpoint.
- Correct serialization would require a store-level lock or another coordination mechanism.
- Rewriting an append-only recovery ledger is a larger durability surface than this ticket needs.
- The old rows lose audit/debug value even though storage is already structured as a ledger.

### Assessment

Rejected. Atomic rename prevents torn publication but does not prevent lost concurrent appends.

## Option C — one file per epic

Migrate to `.vend/decompose-drafts/<epic>.json` and delete only the successful epic's file.

### Advantages

- Natural physical ownership and independent deletion.
- Simple doctor/resume lookup by epic.
- Atomic single-file replacement is practical.

### Disadvantages

- Changes the store contract landed by the dependency.
- Requires migration/backward compatibility for existing JSONL records.
- Expands downstream scope and invalidates current path/test conventions.
- The story explicitly grounded the slice in the existing JSONL conventions.

### Assessment

Rejected for this story. It is a storage redesign, not lifecycle completion.

## Option D — append a settlement marker and reconcile on read

Keep draft checkpoint rows unchanged. Add a second schema-versioned row shape that identifies a
successfully settled epic. Append it at terminal success. While reading the ledger, apply rows in
append order:

- a draft row adds active recovery state;
- a settlement row removes all currently active records for its epic;
- a later draft row for that epic becomes active again.

### Advantages

- Preserves append-only writes and avoids whole-file replacement races.
- Clears only the successful epic.
- Retains unrelated active drafts.
- Gives doctor/resume an active-record view through the existing loader.
- Supports repeated fail → success → fail cycles naturally by append order.
- Provides a reusable primitive for downstream resume-on-success.
- Mirrors cast-diff's capture/reconcile model: checkpoint early, reconcile when terminal facts exist.

### Disadvantages

- The raw file retains settled checkpoint rows and grows until a future compaction policy exists.
- The reader must recognize two row shapes.
- Direct consumers of raw JSONL must understand that physical presence is not active presence.

### Assessment

Chosen. The store is already a ledger, and append-order reconciliation is the smallest safe way to
express current recovery state without deleting unrelated work.

## Settlement row contract

Add a `DecomposeDraftSettlementRecord`:

```ts
{
  v: 1,
  kind: "settled",
  runId: string,
  epic: string,
  settledAt: string
}
```

The existing draft row remains byte-compatible and does not gain a required `kind`. That preserves
all already-written version-1 checkpoints and existing serialization expectations.

`runId` records which successful cast caused settlement. Reconciliation is epic-scoped because a
clean materialization supersedes every older recovery candidate for that subject, not only its own
just-appended checkpoint.

## Pure settlement API

Add:

- `DecomposeDraftSettlementRecordInput`;
- `DecomposeDraftSettlementRecord`;
- `buildDecomposeDraftSettlementRecord`;
- `serializeDecomposeDraftSettlementRecord`;
- `reviveDecomposeDraftSettlementRecord`.

The builder applies the same strict non-empty-string boundary used by draft construction.
The reviver returns `null` for incomplete, malformed, or unsupported settlement rows.

## Reader reconciliation

`readDecomposeDrafts` remains the public active-state reader.

For each nonblank parsed JSON value:

1. try to revive a draft row;
2. if valid, append it to active records;
3. otherwise try to revive a settlement row;
4. if valid, remove active records whose `epic` matches;
5. otherwise increment `skipped` once.

The returned `records` preserve append order among active rows. `latestDecomposeDraft` needs no
signature change and continues to select the last active row globally or for an epic.

Settlement markers are valid ledger rows, so they do not increment `skipped` and are not returned
as resumable drafts.

## Impure settlement API

Add `settleDecomposeDraft(input, opts?)` as a thin append shell:

- resolve the same default path;
- build and serialize one settlement row;
- create the parent directory recursively;
- append the row with `appendFile`.

It intentionally does not read before writing. Settling an epic with no active row is harmless and
keeps the operation idempotent at the active-state level.

## Cast integration point

The cast already captures the draft immediately after gates. Add settlement near the end of the
guarded settlement `try`, after:

- the effect result is captured;
- diff capture/review has finished;
- `settledVerdict` is final;
- terminal presentation that can still throw has completed.

Then:

```ts
if (
  play.name === RESUMABLE_DECOMPOSE_PLAY &&
  materialized &&
  settledVerdict.outcome === "success"
) {
  await settleDecomposeDraft(
    { runId, epic: opts.subject, settledAt: new Date().toISOString() },
    { path: opts.decomposeDraftPath ?? join(root, DEFAULT_DECOMPOSE_DRAFT_PATH) },
  );
}
```

Putting it inside the guarded settlement block means a settlement append failure becomes an
`errored` cast and the active checkpoint remains readable unless a full valid marker landed.

The existing `finally` still reconciles diff availability and appends the terminal run record.

## Failure semantics

### Gate STOP

- checkpoint is appended;
- classifier returns `gate-failed`;
- effect does not run;
- success condition is false;
- loader returns the draft.

### Executor timeout

- no output/gate checkpoint can be created from that timed-out dispense;
- success condition is false;
- any previously active draft for the epic remains active.

### Budget exhausted without gate-authorized retention

- checkpoint may exist because parse/gates already ran;
- final outcome is not success;
- draft remains active.

### Effect reports failure

- `materialized` remains false;
- any reported outcome is retained;
- draft remains active.

### Cross-review failure

- materialized files may physically exist;
- settled outcome becomes non-success;
- draft remains active for operator recovery/re-entry.

### Unexpected settlement throw

- outer guarded catch marks outcome `errored`;
- no cleanup is attempted afterward;
- draft remains active unless the settlement append itself fully succeeded before a later unrelated
  failure, which placement at the end of the guarded block minimizes.

## Test design — store

Extend `src/engine/decompose-draft.test.ts` with:

1. settlement schema/serialization test;
2. reconciliation across multiple epics:
   - drafts for E-077 and E-078;
   - settlement for E-077;
   - E-078 remains active;
3. later failure after settlement:
   - settlement clears earlier E-077 rows;
   - later E-077 draft is active;
4. malformed settlement row increments skipped;
5. filesystem append/load test proving a settlement marker makes an appended draft absent.

Existing draft-row bytes and malformed-row behavior remain pinned.

## Test design — cast

Extend the existing gate-failed acceptance test to remain the retention proof.

Add a timeout-retention test:

- pre-append a valid draft for E-077 through the public store API;
- cast a decompose-shaped play through an executor that throws `ExecutorTimeoutError`;
- assert `timed-out`, no effect, and the pre-existing draft still active.

Use the existing successful max-turns decompose fixture as the success proof:

- it already parses, gates clear, and reports materialization;
- change its draft assertion from one active record to zero;
- optionally inspect the raw file for one checkpoint and one settlement line to prove lifecycle,
  not accidental non-persistence.

This stays fixture-proven and token-free.

## Compatibility

- Existing version-1 draft rows remain valid without rewriting.
- `loadDecomposeDrafts` retains its return type.
- `latestDecomposeDraft` retains its signature.
- Downstream doctor/resume consumers automatically see only active drafts.
- Non-decompose plays never call the settlement primitive.
- `--no-gates` decompose does not append a checkpoint, but a successful ungated cast must also not
  clear active gated recovery state because it did not re-enter the resumable contract. The cast
  settlement condition will therefore additionally require a real `gateVerdict !== null`.

## Ungated-path decision

The store checkpoint is explicitly post-gate state. `--no-gates` produces no checkpoint and is an
experimental variance control, not a recovery path. Clearing an existing gated draft from an
ungated success would discard the only trusted recovery state without validating it.

Therefore settlement requires `gateVerdict !== null` in addition to final success/materialization.

## Rejected scope

- No store compaction or retention limit.
- No doctor probe or hint text.
- No resume flag or dispense bypass.
- No repair/regeneration behavior.
- No changes to run-log schema, budget, classification, gates, or materializer.
- No migration to per-epic files.

## Design decision

Represent cleanup as an append-only, versioned epic settlement row. Reconcile raw rows into active
drafts at the existing reader boundary, and append settlement only for a gated decompose whose
effect landed and whose final settled outcome is success. This preserves failed/timeout recovery,
protects unrelated epics, and provides the lifecycle primitive required by downstream resume.
