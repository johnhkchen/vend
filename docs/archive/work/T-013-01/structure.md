# T-013-01 — Structure

*The shape of the code: files touched, interfaces, ordering. Not the code itself.*

## Files

| File | Change | Why |
|---|---|---|
| `src/log/run-log.ts` | **modify** | Add `Envelope` type + optional `envelope` on input/record; add the pure reader (`readRuns`, `forPlay`, `wallClockMs`, `totalTokens`, `reviveRecord`) + the impure `loadRunLog` shell. |
| `src/engine/cast.ts` | **modify** | Pass the in-scope `budget` as `envelope` at the single `appendRunLog` call site. |
| `src/log/run-log.test.ts` | **modify** | Add cases: envelope present/absent round-trip; reader parse/filter/skip/derive; back-compat fixture. |

No files created or deleted. No new modules (Decision C: reader co-locates with writer).

## `src/log/run-log.ts` — additions (in file order)

### 1. The `Envelope` type (near `UsageInput`, ~line 60)
```ts
/** Allocated envelope mirrored structurally from budget's `Budget` — local, so the
 *  module's zero-coupling-to-src/budget invariant holds (the `UsageInput` precedent). */
export interface Envelope {
  readonly timeMs: number;
  readonly tokens: number;
}
```

### 2. Optional `envelope` on `RunRecordInput` and `RunRecord`
- `RunRecordInput`: add `readonly envelope?: Envelope;` (the allocated budget; absent ⇒
  field omitted from the record).
- `RunRecord`: add `readonly envelope?: Envelope;` (present only when supplied).

### 3. `normalizeEnvelope` (private helper, near `normalizeUsage`)
```ts
function normalizeEnvelope(e: Envelope | undefined): Envelope | undefined {
  if (!e) return undefined;                 // absence is meaningful — omit, don't zero
  return { timeMs: num(e.timeMs), tokens: num(e.tokens) };
}
```

### 4. `buildRunRecord` — emit `envelope` only when present
The frozen object spreads the envelope conditionally so an absent one leaves the field
**off** the record (back-compat symmetry with old lines):
```ts
const envelope = normalizeEnvelope(input.envelope);
return Object.freeze({ v, runId, ..., endedAt, ...(envelope ? { envelope } : {}) });
```

### 5. Reader pure core (new section after `serializeRunRecord`)
```ts
export interface ReadResult { readonly records: readonly RunRecord[]; readonly skipped: number; }

/** Structural revive: parsed JSON → RunRecord | null. NEVER throws — read degrades
 *  quietly where the write boundary asserts loudly. Tolerates absent `envelope`
 *  (old records) and absent newer fields. */
export function reviveRecord(parsed: unknown): RunRecord | null;

/** Parse a JSONL string into records, skipping (and counting) malformed/partial lines. */
export function readRuns(jsonl: string): ReadResult;

/** Pure filter the recalibrator needs: by play, optionally by outcome (success vs censored). */
export function forPlay(
  records: readonly RunRecord[],
  play: string,
  opts?: { readonly outcome?: RunOutcome },
): readonly RunRecord[];

/** Derived wall-clock (endedAt − startedAt) in ms; null if either timestamp is unparseable. */
export function wallClockMs(r: RunRecord): number | null;

/** Derived total tokens — the four usage sub-counts summed (agrees with budget.countTokens). */
export function totalTokens(r: RunRecord): number;
```

### 6. `loadRunLog` — the impure read shell (after `appendRunLog`)
```ts
export async function loadRunLog(opts: AppendRunLogOptions = {}): Promise<ReadResult> {
  const path = opts.path ?? DEFAULT_RUN_LOG_PATH;
  // ENOENT (no ledger yet) ⇒ empty, not an error; rethrow other fs errors.
  // delegates parsing to readRuns.
}
```
Reuses `AppendRunLogOptions` (`{ path? }`) — same option bag, one ledger.

### Reviver acceptance rules (the contract `reviveRecord` enforces)
A line is **kept** iff: `parsed` is a non-null object; `runId/play/epic/model/startedAt/
endedAt` are non-empty strings; `outcome ∈ RUN_OUTCOMES`; `usage` is an object (its
sub-counts re-`num()`'d defensively); `costUsd` coerced via `num`; `gateResults`
normalized (absent ⇒ `[]`). `envelope`: if present and both numbers finite → kept
normalized; otherwise the field is dropped (a malformed envelope does not reject the
whole record — the actuals are still useful to the Ledger). Otherwise → `null` (skipped).

## `src/engine/cast.ts` — the one-line plumb

At the `appendRunLog({ ... })` call (lines 154–168), add one field:
```ts
    epic: opts.subject,
    model: loggedModel,
    envelope: budget,            // ← allocated envelope: { timeMs, tokens }; satisfies Envelope structurally
    outcome,
```
`budget` is already a parameter of `castPlay`. No signature change, no new import
(budget's `Budget` duck-types onto the local `Envelope`).

## `src/log/run-log.test.ts` — added coverage (new describe blocks)
- **build/serialize with envelope**: `baseInput({ envelope: { timeMs, tokens } })` →
  record carries it; round-trips through serialize/parse; **absent envelope ⇒ field
  omitted** (not `null`).
- **`readRuns`**: a multi-line fixture string → correct record count; a malformed line
  and a torn final line → skipped + counted, good lines kept.
- **back-compat**: a `v:1` line **without** `envelope` (copy of a real `.vend` line) →
  parses, `envelope` is `undefined`.
- **`forPlay`**: play filter; `{ outcome: "success" }` vs `{ outcome: "budget-exhausted" }`
  partition the fixture.
- **derivations**: `wallClockMs` = endedAt−startedAt; `null` on bad timestamp;
  `totalTokens` = sum of four buckets (cross-check a known fixture).

## Ordering of changes
1. Types + `normalizeEnvelope` + `buildRunRecord` emit (write path; smallest, self-contained).
2. Reader core (`reviveRecord` → `readRuns` → `forPlay` → derivations).
3. `loadRunLog` shell.
4. `cast.ts` one-line plumb.
5. Tests alongside each (TDD-ish: write the build/serialize tests with step 1, reader
   tests with step 2).

Each step typechecks independently; the cast.ts change is last because it depends on
the new optional field existing on `RunRecordInput`.

## Blast radius / invariants preserved
- Only one production caller of the writer (`cast.ts`) — confirmed in research.
- Zero new imports across the `src/budget/` ↔ `src/log/` boundary.
- Schema `v` unchanged (additive optional field).
- Existing 10 `.vend/runs.jsonl` records remain valid (proven by the back-compat test).
