# Structure — T-077-04-02: draft-clear-on-success

## Change map

| File | Action | Responsibility |
|---|---|---|
| `src/engine/decompose-draft.ts` | modify | settlement row contract, active-state reconciliation, append shell |
| `src/engine/decompose-draft.test.ts` | modify | pure and filesystem settlement coverage |
| `src/engine/cast.ts` | modify | terminal clear-on-success lifecycle wiring |
| `src/engine/cast.test.ts` | modify | gate-fail/timeout retention and success absence proof |

No files are created or deleted in source. No generated BAML, CLI, doctor, play, materializer, or
run-log files change.

## `src/engine/decompose-draft.ts`

### Existing responsibility retained

The module remains the only owner of decompose recovery-ledger judgment and filesystem access.
Draft checkpoint rows keep their existing schema and serialization exactly.

### New settlement input type

Add beside `DecomposeDraftRecordInput`:

```ts
export interface DecomposeDraftSettlementRecordInput {
  readonly runId: string;
  readonly epic: string;
  readonly settledAt: string;
}
```

This is caller input before schema stamping and validation.

### New settlement record type

Add beside `DecomposeDraftRecord`:

```ts
export interface DecomposeDraftSettlementRecord {
  readonly v: typeof DECOMPOSE_DRAFT_SCHEMA_VERSION;
  readonly kind: "settled";
  readonly runId: string;
  readonly epic: string;
  readonly settledAt: string;
}
```

The discriminator appears only on the new shape. Existing v1 draft rows remain backward-compatible.

### New pure builder

```ts
export function buildDecomposeDraftSettlementRecord(
  input: DecomposeDraftSettlementRecordInput,
): DecomposeDraftSettlementRecord
```

Behavior:

- reject empty `runId`;
- reject empty `epic`;
- reject empty `settledAt`;
- stamp `v: 1` and `kind: "settled"`;
- freeze the returned object.

Error messages follow the existing `decompose draft ... must be a non-empty string` vocabulary.

### New pure serializer

```ts
export function serializeDecomposeDraftSettlementRecord(
  record: DecomposeDraftSettlementRecord,
): string
```

Behavior: `JSON.stringify(record) + "\n"`.

It remains separate from the existing draft serializer so both concrete shapes stay explicit and
callers cannot accidentally serialize an arbitrary union member.

### New pure reviver

```ts
export function reviveDecomposeDraftSettlementRecord(
  value: unknown,
): DecomposeDraftSettlementRecord | null
```

Recognition requires:

- object value;
- `v === DECOMPOSE_DRAFT_SCHEMA_VERSION`;
- `kind === "settled"`;
- non-empty `runId`, `epic`, and `settledAt`.

It returns a frozen normalized record or `null`. It never throws on external JSON values.

### Modify `readDecomposeDrafts`

The returned type stays `ReadDecomposeDraftsResult` with active `records` and `skipped`.

Internal flow per parsed line:

```text
parse JSON
  ├─ valid draft row      → push active draft
  ├─ valid settlement row → remove active drafts for settlement.epic
  └─ neither              → skipped += 1
```

Use an assignable local `let records: DecomposeDraftRecord[]` so settlement can replace it with a
filtered array. Final return still freezes the array and result.

Settlement is epic-scoped. It removes all earlier active rows for the epic, including repeated
failed attempts. It leaves other epics byte-for-byte represented in active order.

A later draft row appends normally and becomes active after a prior settlement.

### New impure append shell

```ts
export async function settleDecomposeDraft(
  input: DecomposeDraftSettlementRecordInput,
  opts: DecomposeDraftStoreOptions = {},
): Promise<void>
```

Behavior:

1. resolve `opts.path ?? DEFAULT_DECOMPOSE_DRAFT_PATH`;
2. build and serialize the settlement row;
3. create the parent directory recursively;
4. append one UTF-8 line.

No read-before-write, rename, unlink, or compaction occurs.

### Internal organization

Keep order parallel to the existing module:

1. constants/types;
2. shared validators/normalizers;
3. repair action;
4. draft builder;
5. settlement builder;
6. serializers;
7. revivers;
8. reconciled reader/latest selector;
9. append/load filesystem shells.

## `src/engine/decompose-draft.test.ts`

### Imports

Add:

- `appendDecomposeDraft`;
- `buildDecomposeDraftSettlementRecord`;
- `serializeDecomposeDraftSettlementRecord`;
- `settleDecomposeDraft`.

Use the existing `record` helper for draft fixtures. Add a small `settlement(runId, epic)` helper
that calls the public builder with a deterministic timestamp.

### Settlement schema test

Assert:

- schema version 1;
- literal `kind: "settled"`;
- run/epic/timestamp preservation;
- one trailing newline;
- exact JSON serialization.

### Active reconciliation test

Build raw JSONL containing:

1. E-077 draft run-1;
2. E-078 draft run-2;
3. E-077 draft run-3;
4. E-077 settlement;

Assert:

- `skipped === 0`;
- only E-078/run-2 remains;
- latest E-077 is null;
- latest E-078 is run-2.

Then append a later E-077 draft in the raw input and assert it becomes active.

### Invalid settlement test

Include an object with `kind: "settled"` but a missing/empty required field. Assert it increments
`skipped` exactly once and does not clear any valid active draft.

### Filesystem lifecycle test

Use one unique temp path:

1. `appendDecomposeDraft` for E-077;
2. load and assert one active record;
3. `settleDecomposeDraft` for E-077;
4. load and assert zero active records;
5. inspect raw file lines and assert two valid physical rows remain.

This proves active absence comes from settlement rather than skipped persistence.

## `src/engine/cast.ts`

### Import

Add `settleDecomposeDraft` to the existing sibling draft-store import.

### Shared path expression

The existing checkpoint and new settlement calls both use:

```ts
opts.decomposeDraftPath ?? join(root, DEFAULT_DECOMPOSE_DRAFT_PATH)
```

No new option is needed; `CastOptions.decomposeDraftPath` already exists.

### Settlement guard

At the end of the guarded terminal settlement `try`, after progress/warning presentation and before
the `catch`, add:

```ts
if (
  gateVerdict !== null &&
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

### Ordering guarantees

- After checkpoint capture: a settlement marker always follows the checkpoint it clears.
- After effect: only an effect-reported landing can settle.
- After review classification: a final gate/reviewer failure retains the draft.
- After presentation: an earlier presentation throw retains the draft.
- Before the outer catch: settlement append failure becomes `errored` and is logged.
- Before run-log `finally`: the terminal record reflects any settlement failure outcome.

### Unchanged behavior

- No settlement for other plays.
- No settlement for `skipGates` decompose casts.
- No settlement for gate stop, timeout, ordinary budget exhaustion, effect failure, or review failure.
- Existing diff capture/reconciliation and run-log append remain structurally unchanged.

## `src/engine/cast.test.ts`

### Imports

Add `appendDecomposeDraft` to the existing draft-store import. `readFile` is already imported for raw
ledger inspection, and `ExecutorTimeoutError` is already imported.

### Gate-failure retention

Keep the existing `T-077-04-01` gate-failed test and strengthen its name/comment to cover the
clear-on-success negative branch if useful. Its current assertions already prove:

- `gate-failed`;
- no effect;
- one active readable draft.

No duplicate fixture is needed.

### Timeout retention test

Add adjacent to decompose lifecycle coverage:

- create temp root and explicit draft path;
- seed one E-077 draft through `appendDecomposeDraft`;
- define a decompose-shaped play whose parse/gates/effect would be observable;
- define a stub executor that probes OK and rejects dispense with `ExecutorTimeoutError`;
- cast with the same subject/root;
- assert outcome `timed-out` and materialized false;
- assert parse/gates/effect observations are empty;
- load and assert the seeded record remains active.

Use a distinct run ID for the timeout cast so the preserved record identity is unambiguous.

### Successful lifecycle assertion

Modify the existing max-turns decompose success test after its run-log assertions:

- load the default draft path;
- assert `skipped === 0`;
- assert `records` is empty;
- read raw draft ledger;
- parse its nonblank lines;
- assert there are exactly two rows;
- assert first row is the checkpoint with the expected max-turns action;
- assert second row is `{ v: 1, kind: "settled", runId, epic: "E-077", settledAt: string }`.

This fixture remains useful because executor subtype `error_max_turns` demonstrates that even a
checkpoint marked with cap-hit recovery metadata is removed from active state when the parsed,
gated result nevertheless materializes and settles successfully.

## Commit units

### Unit 1 — store settlement primitive

- `src/engine/decompose-draft.ts`
- `src/engine/decompose-draft.test.ts`

Commit only after focused tests, build, and full gate pass.

### Unit 2 — cast lifecycle wiring

- `src/engine/cast.ts`
- `src/engine/cast.test.ts`

Commit only after focused tests, build, and full gate pass.

Both use `lisa commit-ticket` with exact repository-relative `--include` paths.

## Explicitly unchanged

- `.lisa/provenance.jsonl` and ticket frontmatter: Lisa-owned.
- Attempt work artifacts: uncommitted/private until Lisa publishes them.
- `src/doctor/*`: parallel downstream ticket.
- `src/cli.ts`: resume ticket.
- `src/play/decompose-epic.ts`: no lifecycle policy.
- `src/log/run-log.ts`: no recovery-state fields.
- `.vend/` runtime data in the repository: no fixture artifacts written there.

## Verification boundary

The implementation is complete only when:

- store tests prove per-epic active-state reconciliation;
- cast tests prove gate-fail and timeout retention plus success absence;
- TypeScript build passes;
- `bun run check` passes;
- both source units are committed through Lisa;
- ticket-owned source is clean.
