# Review — T-077-04-02: draft-clear-on-success

## Disposition

PASS. The ticket acceptance criterion is met, all ticket-owned source is committed through Lisa,
the source worktree is clean, and the final exact-HEAD `bun run check` is green.

## Outcome

Decompose drafts now have a complete lifecycle:

- checkpoint after parse and gates;
- remain active through gate failure, timeout, or later failed settlement;
- settle only after a gated decompose effect lands and the final outcome is success;
- disappear from the public active-draft view after settlement;
- preserve unrelated epics and raw append-only ledger evidence.

This closes the gap where every clean decompose cast left a false resumable condition behind.

## Source changes

### `src/engine/decompose-draft.ts`

Added the version-1 `DecomposeDraftSettlementRecord` shape:

```ts
{
  v: 1,
  kind: "settled",
  runId: string,
  epic: string,
  settledAt: string
}
```

Existing version-1 draft checkpoint rows remain unchanged and backward-compatible.

Added pure settlement helpers:

- `buildDecomposeDraftSettlementRecord`;
- `serializeDecomposeDraftSettlementRecord`;
- `reviveDecomposeDraftSettlementRecord`.

Added the thin impure shell `settleDecomposeDraft`, which appends one validated JSONL marker using
the same default/override path as checkpoints.

Changed `readDecomposeDrafts` to return active recovery state rather than stale raw history:

- checkpoints append active state;
- a settlement removes earlier active rows for its epic;
- other epics remain active;
- a later failed checkpoint for the settled epic becomes active again;
- malformed/unsupported rows are still skipped and counted.

No file deletion or whole-ledger rewrite occurs. That avoids erasing unrelated drafts and avoids a
read/replace race with another append.

### `src/engine/decompose-draft.test.ts`

Expanded the store suite from five to nine tests.

New assertions cover:

- settlement schema version/discriminator;
- exact newline JSON serialization;
- per-epic reconciliation across repeated attempts;
- unrelated epic preservation;
- later failure after settlement;
- malformed settlement tolerance;
- actual append → settle filesystem behavior;
- raw ledger retention alongside zero active drafts.

### `src/engine/cast.ts`

Wired draft settlement into the existing guarded terminal settlement block.

The cast appends a settlement marker only when:

- real gates ran (`gateVerdict !== null`);
- the play is the canonical `decompose-epic`;
- the effect reported that materialization landed;
- the final settled verdict remains `success`.

The call occurs after effect facts, diff capture, optional complement review, final classification,
and terminal presentation. It occurs before the established guarded catch and run-log `finally`.

This means the draft is retained when the cast ends as:

- `gate-failed`;
- `timed-out`;
- `budget-exhausted` without gate-authorized retention;
- effect-reported failure;
- cross-review failure/missing capability;
- unexpected settlement error.

An ungated experimental cast cannot clear an existing trusted gated draft.

### `src/engine/cast.test.ts`

Retained the dependency's gate-failed fixture as a direct negative-branch proof:

- parse succeeds;
- gate returns STOP;
- effect is not called;
- terminal outcome is `gate-failed`;
- one complete active draft remains readable.

Added a timeout preservation fixture:

- seed an already-readable E-077 checkpoint;
- use a stub executor that throws `ExecutorTimeoutError`;
- assert no parse, gates, or effect calls from the timed-out dispense;
- assert terminal `timed-out` and `materialized: false`;
- assert the seeded checkpoint remains active.

Updated the existing max-turns decompose success fixture:

- retains its 15 agent-turn versus 23 executor-event characterization;
- retains successful effect and run-log assertions;
- active loader now returns zero records;
- raw store contains exactly checkpoint then settlement marker;
- checkpoint still proves the exact `executor-max-turns` recovery cause before reconciliation.

## Acceptance assessment

Ticket criterion:

> On successful materialize the persisted draft is cleared/settled (mirroring cast-diff
> capture→reconcile); a test asserts the draft is present after a gate-fail/timeout outcome and
> absent after a success.

### Successful materialize clears/settles

Met. The positive fixture reaches parse, real gates, effect, and final success. The raw ledger
contains a settlement marker and the public loader returns no active draft.

### Capture → reconcile lifecycle

Met. Checkpoint capture remains immediately after parse/gates and before classification/effect.
Settlement happens only after effect and terminal verdict facts exist.

### Present after gate failure

Met. The gate STOP fixture returns one readable record with exact epic, parsed draft, gate findings,
and next repair action.

### Present after timeout

Met. A timeout cannot produce parsed state before a terminal result, so the fixture honestly begins
with already-paid/readable state and proves a later timeout does not clear it.

### Absent after success

Met. `loadDecomposeDrafts` returns exactly `{ records: [], skipped: 0 }` after the successful cast.

### Does not erase unrelated drafts

Met beyond the minimum criterion. Pure store coverage proves settling E-077 preserves E-078.

## Pure-core / impure-shell assessment

The repository convention is preserved.

Pure code owns:

- settlement validation;
- serialization;
- tolerant revival;
- append-order active-state reconciliation.

Impure code owns:

- one append in `settleDecomposeDraft`;
- the terminal timestamp and decision to invoke it in `castPlay`.

No filesystem access leaks into the reconciliation judgment.

## Compatibility assessment

- Existing draft rows have no new required field.
- Schema version remains 1 because the old row shape remains valid and the new discriminated row is
  additive within the same ledger format.
- `loadDecomposeDrafts` keeps its signature and now gives downstream consumers the intended active
  view.
- `latestDecomposeDraft` keeps its signature and naturally operates over active rows.
- Parallel `T-077-04-03` doctor code passed the combined full suite against this reader behavior.
- `T-077-04-04` can reuse `settleDecomposeDraft` after resume success.
- Other plays never enter checkpoint or settlement branches.
- No BAML/runtime generated interface changed.

## Test evidence

### Focused store suite

```text
9 pass
0 fail
36 expect() calls
```

### Focused store + cast suites

```text
33 pass
0 fail
291 expect() calls
```

### Final authoritative gate at exact HEAD

```text
bun run check
BAML generation: pass
TypeScript: pass
1806 tests pass
1 test skip (pre-existing missing dist/release-local condition)
0 tests fail
5717 expect() calls
119 test files
```

All new execution coverage uses temp directories and stub executors. No live model, remote network,
or token spend was introduced.

## Commit evidence

`f9d6059f0485c9aa8c8b1f050513a9e296345ff1`

> feat: settle resumable decompose drafts

Includes only:

- `src/engine/decompose-draft.ts`;
- `src/engine/decompose-draft.test.ts`.

`29468750bda8f2bd79ce9db7a1657dea948e3c46`

> feat: clear decompose drafts on success

Includes only:

- `src/engine/cast.ts`;
- `src/engine/cast.test.ts`.

Both commits were created with `lisa commit-ticket` and exact repeated `--include` paths after green
full gates.

## Scope review

No out-of-slice behavior landed:

- no doctor probe authored by this ticket;
- no CLI `--resume` path;
- no executor-dispense bypass;
- no repair/regeneration loop;
- no gate taxonomy change;
- no budget contract change;
- no materializer change;
- no run-log schema change;
- no store compaction policy.

The parallel doctor ticket landed disjoint commits while this work ran. Its files were preserved and
excluded from this ticket's exact commits.

## Known limitations and open concerns

### Raw ledger growth

Settled checkpoint/marker rows remain physically present. This is intentional append-only behavior,
not active recovery state. Long-term compaction/retention is not part of this story.

### Run-log append after settlement marker

The marker is written at the end of guarded settlement before the terminal run-log `finally`.
If the subsequent run-log append itself fails, materialization and draft settlement have occurred
but the caller observes the logging failure. The existing cast architecture cannot make two JSONL
ledgers transactional. This does not affect the tested normal path and is not newly hidden: run-log
append failure already sits outside ordinary returned settlement guarantees.

### Timeout cannot create missing parsed state

A timeout before an executor result has no object to parse or gate. The test correctly proves
non-clearing of prior paid state rather than fabricating a new timeout checkpoint.

### Schema compaction deferred

Readers that bypass the public loader and inspect raw JSONL must understand settlement markers.
All repository consumers use/are expected to use the store API; a future compactor must preserve
append-order active semantics.

No concern blocks the acceptance criterion.

## Worktree review

Ticket-owned source files are committed and clean.

Remaining worktree status belongs to Lisa and the parallel ticket:

- provenance/ticket phase metadata;
- Lisa-published RDSPI work directories for T-077-04-02 and T-077-04-03.

They were not modified directly or included in ticket commits.

## Final assessment

The persisted decompose draft now means what the product promises: active recovery state exists only
while a cast still needs recovery. Gate failure and timeout preserve it; a final gated success
settles it; unrelated epics survive; and downstream doctor/resume consumers receive a clean active
view through the established loader. Disposition: pass.
