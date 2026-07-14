# Progress — T-077-04-02: draft-clear-on-success

## Status

Implementation is complete. Both ticket-owned source units are committed through Lisa with exact
include paths. Focused tests, strict typecheck, and the final exact-HEAD repository gate are green.

## Phase completion

- Research: complete — `research.md`.
- Design: complete — `design.md`.
- Structure: complete — `structure.md`.
- Plan: complete — `plan.md`.
- Implement: source complete and committed.
- Review: ready; final exact-HEAD gate is green.

## Implemented source unit 1 — active-ledger settlement

### `src/engine/decompose-draft.ts`

Added a versioned successful-settlement row:

```ts
{
  v: 1,
  kind: "settled",
  runId,
  epic,
  settledAt
}
```

The existing version-1 draft checkpoint shape remains unchanged. Already-written checkpoint rows
continue to revive without a `kind` field.

Added pure APIs:

- `buildDecomposeDraftSettlementRecord`;
- `serializeDecomposeDraftSettlementRecord`;
- `reviveDecomposeDraftSettlementRecord`.

The builder strictly validates non-empty run ID, epic, and timestamp. The reviver is tolerant at
the external JSON boundary and returns null for unsupported/incomplete values.

Changed `readDecomposeDrafts` from a raw-valid-draft view to the active recovery view:

- draft row: append active checkpoint;
- settlement row: remove every earlier active checkpoint for that epic;
- later draft row: becomes active again;
- unrelated epics remain active in append order;
- malformed/future rows still increment `skipped` once.

Added `settleDecomposeDraft`, a thin append-only filesystem shell using the existing path override,
recursive parent creation, and newline JSONL conventions. It performs no read/rewrite/delete.

### `src/engine/decompose-draft.test.ts`

Expanded the suite from 5 to 9 tests.

New coverage proves:

- exact settlement schema and serialized bytes;
- per-epic active reconciliation across multiple failed attempts;
- unrelated epic preservation;
- a later failure becomes active after an earlier settlement;
- malformed settlement-shaped rows do not clear active state;
- real filesystem append → settle leaves two raw ledger rows but zero active drafts.

### Focused verification

Command:

```text
bun test src/engine/decompose-draft.test.ts
```

Result:

```text
9 pass
0 fail
36 expect() calls
1 file
```

Command:

```text
bun run build
```

Result: `tsc --noEmit` passed.

### Full gate before unit-1 commit

Command:

```text
bun run check
```

Result:

```text
BAML generation passed
TypeScript passed
1804 tests passed
1 test skipped (pre-existing missing local dist condition)
0 tests failed
5703 expect() calls
119 files
```

### Unit-1 commit

Command:

```text
lisa commit-ticket \
  --ticket-id T-077-04-02 \
  --message "feat: settle resumable decompose drafts" \
  --include src/engine/decompose-draft.ts \
  --include src/engine/decompose-draft.test.ts
```

Commit:

```text
f9d6059f0485c9aa8c8b1f050513a9e296345ff1
```

Commit contains only the two intended store files: 181 insertions and 4 deletions.

## Implemented source unit 2 — cast terminal reconciliation

### `src/engine/cast.ts`

Imported `settleDecomposeDraft` from the sibling store module.

At the end of the guarded terminal settlement block, added a settlement guard requiring:

- `gateVerdict !== null` — the cast actually entered the gated recovery contract;
- `play.name === RESUMABLE_DECOMPOSE_PLAY`;
- `materialized === true` — the effect reported a physical landing;
- `settledVerdict.outcome === "success"` — review/settlement still cleared.

The marker uses the current run ID, epic subject, and a settlement timestamp, written through the
same `decomposeDraftPath` override/default as checkpoint capture.

This ordering preserves the draft on:

- gate STOP;
- executor timeout;
- budget refusal;
- effect failure;
- cross-review refusal/unavailability;
- earlier settlement/presentation error;
- ungated experimental control.

A marker append failure occurs inside the established guarded settlement try, so the run becomes
`errored` and still reaches terminal run-log append.

### `src/engine/cast.test.ts`

The existing gate-failed decompose test remains the primary failed-cast retention proof. It still
asserts one complete active draft and an unreachable effect.

Added a timeout preservation test:

- seeds one active E-077 checkpoint through `appendDecomposeDraft`;
- uses a stub executor that throws `ExecutorTimeoutError`;
- asserts no parse, gates, or effect calls;
- asserts terminal `timed-out`, `materialized: false`;
- asserts the seeded draft remains active and readable.

Updated the existing decompose cap-hit success fixture:

- retained the 15 agent-turn / 23 executor-event characterization;
- retained successful effect and run-log assertions;
- now asserts the active loader returns zero drafts;
- inspects raw JSONL and proves exactly two rows:
  1. checkpoint with `executor-max-turns` recovery metadata;
  2. settlement marker for the same run and epic.

### Focused verification

Command:

```text
bun test src/engine/decompose-draft.test.ts src/engine/cast.test.ts
```

Result:

```text
33 pass
0 fail
291 expect() calls
2 files
```

Command:

```text
bun run build
```

Result: `tsc --noEmit` passed.

### Full gate before unit-2 commit

Command:

```text
bun run check
```

Result:

```text
BAML generation passed
TypeScript passed
1806 tests passed
1 test skipped (pre-existing missing local dist condition)
0 tests failed
5717 expect() calls
119 files
```

The two-test increase over unit 1 is the new store filesystem lifecycle case as counted in the full
suite plus the timeout cast case; all concurrent doctor-ticket source present at HEAD also passed.

### Unit-2 commit

Command:

```text
lisa commit-ticket \
  --ticket-id T-077-04-02 \
  --message "feat: clear decompose drafts on success" \
  --include src/engine/cast.ts \
  --include src/engine/cast.test.ts
```

Commit:

```text
29468750bda8f2bd79ce9db7a1657dea948e3c46
```

Commit contains only the two intended cast files: 105 insertions and 4 deletions.

## Acceptance result

### Successful materialize clears/settles persisted draft

Met. The successful gated decompose fixture writes a raw checkpoint and a raw settlement marker;
`loadDecomposeDrafts` returns no active draft.

### Mirrors capture → reconcile

Met. The checkpoint lands immediately after parse/gates, and settlement occurs only after effect,
cross-review classification, and terminal outcome judgment.

### Draft present after gate failure

Met. The existing decompose STOP fixture returns `gate-failed`, never calls effect, and loads one
complete active checkpoint.

### Draft present after timeout

Met. The timeout fixture starts from paid/readable state and proves a later pre-result timeout does
not clear it. It does not fabricate parsed state for the timed-out dispense.

### Draft absent after success

Met. The active loader returns `{ records: [], skipped: 0 }` after the successful fixture.

### Unrelated state preservation

Met beyond the ticket's minimum. Store tests prove settling E-077 leaves E-078 active.

## Deviations from plan

No implementation deviation.

The branch changed concurrently while this ticket ran because `T-077-04-03` landed its doctor
source commits. This was expected from the story DAG. Its files were disjoint from this ticket's
source and were never included in either Lisa commit. Full-gate verification ran against the
combined branch state.

## Worktree ownership after commits

Ticket-owned source files are clean:

- `src/engine/decompose-draft.ts`;
- `src/engine/decompose-draft.test.ts`;
- `src/engine/cast.ts`;
- `src/engine/cast.test.ts`.

Remaining status entries are not ticket-owned source:

- `.lisa/provenance.jsonl` — Lisa-owned;
- `docs/active/tickets/T-077-04-02.md` — Lisa phase metadata;
- `docs/active/tickets/T-077-04-03.md` — parallel ticket metadata;
- `docs/active/work/T-077-04-02/` — Lisa-published phase artifacts;
- `docs/active/work/T-077-04-03/` — parallel ticket artifacts.

They were preserved and excluded from commits.

## Final exact-HEAD verification

After both Lisa commits, ran:

```text
bun run check
```

Result:

```text
BAML generation passed
TypeScript passed
1806 tests passed
1 test skipped (pre-existing missing local dist condition)
0 tests failed
5717 expect() calls
119 files
```

Implementation phase complete.
