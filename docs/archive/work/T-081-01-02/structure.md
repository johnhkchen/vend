# Structure — T-081-01-02

## Change set

Five repository files change. No production file is created or deleted.

| File | Action | Responsibility |
|---|---|---|
| `src/log/run-log.ts` | modify | Define, normalize, build, revive, and document the two turn counters |
| `src/log/run-log.test.ts` | modify | Pin pure schema behavior and historical byte identity |
| `src/engine/cast.ts` | modify | Map progress and terminal result counters to their honest ledger keys |
| `src/engine/cast.test.ts` | modify | Update the T-077 seam characterization to the new relational contract |
| `examples/templates/kitchen-seed/EXPECTED-OUTCOME.md` | modify | Expose both turn keys in the re-run jq query |

Attempt-only RDSPI files are written under:

`.lisa/attempts/T-081-01-02/1/work/`

They are not ticket source units and are published by Lisa after lease verification.

## `src/log/run-log.ts`

### `RunRecordInput`

Retain:

```ts
readonly turnsUsed?: number;
```

Redefine its documentation:

- new-write source is the cast progress fold;
- unit is distinct deduplicated agent turns;
- zero is a value;
- absence is unknown;
- pre-E-081 ledger rows under this key used terminal `result.num_turns`;
- historical values are preserved without unit conversion.

Add immediately after it:

```ts
readonly executorReportedTurns?: number;
```

Document it as optional executor terminal telemetry, with Claude's `result.num_turns` as the first
implementation and no relation to the `--max-turns` denominator.

### `RunRecord`

Retain optional `turnsUsed` in its current property position.

Update its documentation to describe the capped unit and the historical boundary.

Add optional `executorReportedTurns` immediately after `turnsUsed`.

The ordering matters because `serializeRunRecord` preserves object insertion order and historical
byte-identity tests rely on absent new fields not moving old keys.

### Numeric normalizer

Rename:

```ts
normalizeTurnsUsed
```

to:

```ts
normalizeTurnCount
```

Signature remains:

```ts
(value: number | undefined) => number | undefined
```

Contract:

- finite integer;
- greater than or equal to zero;
- otherwise undefined.

This helper stays private and policy-free. Field-specific meaning remains in interface/schema
comments and call-site names.

### `buildRunRecord`

Normalize separately:

```ts
const turnsUsed = normalizeTurnCount(input.turnsUsed);
const executorReportedTurns = normalizeTurnCount(input.executorReportedTurns);
```

Spread in order:

```ts
...(turnsUsed !== undefined ? { turnsUsed } : {}),
...(executorReportedTurns !== undefined ? { executorReportedTurns } : {}),
```

No truthy check is allowed because zero is meaningful.

### `reviveRecord`

Read both optional raw fields independently through `normalizeTurnCount`.

Malformed values are omitted, not grounds for rejecting the record.

Spread them in the same order as the write boundary.

Do not infer `executorReportedTurns` from an old `turnsUsed` value.

Do not rewrite an old `turnsUsed` value.

### Schema note

The field documentation is the schema note because `run-log.ts` is the canonical schema source.

It must state:

- pre-E-081 `turnsUsed` came from `result.num_turns`;
- that executor-reported counter is unlike the capped deduplicated agent-turn unit;
- reviving historical rows preserves the original number;
- only new casts write corrected-unit `turnsUsed` plus the separate optional executor field.

## `src/log/run-log.test.ts`

### Existing describe block

Rename the block from a T-015-only label to a current turn-field schema label that names E-081.

Keep all existing `turnsUsed` cases, adjusting descriptions so they no longer claim terminal
executor semantics.

### New executor-field cases

Add tests adjacent to `turnsUsed` coverage:

1. build → serialize → revive retains a positive `executorReportedTurns` value;
2. explicit zero exists on both built and revived objects;
3. absence means no own property and no serialized key;
4. NaN, negative, and fractional inputs are omitted by build;
5. malformed raw data is dropped by revive while the record remains valid.

The cases may group symmetrical assertions where readability remains high.

### Historical compatibility case

Add a literal pre-E-081 JSONL row in canonical property order:

- schema `v: 1`;
- required identity/outcome/usage/cost/gates fields;
- `turnsUsed` with an intentionally executor-like value;
- timestamps;
- no `executorReportedTurns`.

Assertions:

- `readRuns` reports zero skipped rows;
- one row is revived;
- its `turnsUsed` number is unchanged;
- it does not have `executorReportedTurns`;
- serializing it produces the exact original bytes including newline.

This is the executable counterpart to the schema note.

## `src/engine/cast.ts`

### Terminal counter local

At the settled-facts boundary, rename the local from:

```ts
const turnsUsed = resolveTurnsUsed(result?.num_turns);
```

to:

```ts
const executorReportedTurns = resolveTurnsUsed(result?.num_turns);
```

The helper name remains unchanged because it lives in `cast-core.ts`, outside the ticket's primary
file scope, and still structurally validates a turn count.

### Observed agent-turn local

Derive an optional value near the settled facts:

```ts
const turnsUsed = resumeDraft === undefined ? progress.turns : undefined;
```

Meaning:

- cold cast path: known observed count, including zero;
- resume path: absent because no new executor cast occurred.

The early missing-capability paths return before this boundary and remain unchanged.

### Final summary

Continue using:

```ts
progress.turns
```

as `agentTurns`, preserving existing display behavior.

Pass the renamed terminal local as:

```ts
executorReportedTurns
```

The final summary text does not change.

### Append input

Replace the old terminal-counter spread with two independent facts:

```ts
...(turnsUsed !== undefined ? { turnsUsed } : {}),
...(executorReportedTurns !== undefined ? { executorReportedTurns } : {}),
```

Update comments to state capped unit, cold-cast zero, resume omission, and optional executor fact.

Do not modify envelope, usage, cost, outcome, or other settlement logic.

## `src/engine/cast.test.ts`

### T-077 seam fixture

Retain fixture construction:

- 15 unique assistant message IDs;
- one repeated assistant stream block;
- terminal `num_turns: 23`;
- `error_max_turns` subtype;
- exact production argv;
- successful effect and recovery checkpoint behavior.

Rename the test to say it separates capped and executor turn units in the ledger.

After reading the transcript, compute the existing `Set` of assistant IDs.

Ledger assertions become:

```ts
expect(record.turnsUsed).toBe(new Set(assistantIds).size);
expect(record.turnsUsed).toBe(DECOMPOSE_MAX_TURNS);
expect(record.executorReportedTurns).toBe(23);
```

The first assertion is relational; the second retains the explicit cap fixture; the third pins the
separate terminal fact.

Keep the summary assertion unchanged to prove the same two values are shown under distinct labels.

## `examples/templates/kitchen-seed/EXPECTED-OUTCOME.md`

Change only the jq projection line.

Old suffix:

```jq
usage,turnsUsed
```

New suffix:

```jq
usage,turnsUsed,executorReportedTurns
```

This keeps the primary field visible and adds the retained executor key named by the spike verdict.

## Module boundaries

- Run-log remains executor-agnostic: it imports no executor types and records plain values.
- Cast remains the impure translator from executor/progress observations to ledger input.
- Cast-core remains the pure stream fold and formatter; no edits here.
- Tests pin pure schema behavior separately from the end-to-end stub seam.
- Documentation exposes persisted facts without becoming a source of accounting policy.

## Commit units

### Unit 1 — run-log schema

Files:

- `src/log/run-log.ts`
- `src/log/run-log.test.ts`

Commit message:

`fix(log): separate capped and executor turn counts`

### Unit 2 — cast mapping and characterization

Files:

- `src/engine/cast.ts`
- `src/engine/cast.test.ts`

Commit message:

`fix(engine): persist agent turns in capped unit`

### Unit 3 — kitchen inspection query

File:

- `examples/templates/kitchen-seed/EXPECTED-OUTCOME.md`

Commit message:

`docs(kitchen): inspect separate turn counters`

Every unit uses `lisa commit-ticket --ticket-id T-081-01-02` with exact `--include` paths.

## Verification shape

- Focused pure run-log test after Unit 1.
- Focused cast test after Unit 2.
- Full `bun run check` after Unit 3.
- `git diff --check` before each commit where applicable.
- Final status audit for no ticket-owned changes left behind.
