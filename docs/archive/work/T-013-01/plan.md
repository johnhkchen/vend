# T-013-01 — Plan

*Ordered, independently-verifiable steps. Testing strategy. AC trace.*

## Testing strategy
- **Pure core** (`buildRunRecord` w/ envelope, `reviveRecord`, `readRuns`, `forPlay`,
  `wallClockMs`, `totalTokens`) → unit-tested in `run-log.test.ts` on **string/object
  fixtures**. No fs, no clock — mirrors the existing file's discipline.
- **Impure shells** (`appendRunLog`, `loadRunLog`) → NOT unit-tested by house contract;
  their logic is the tested pure core. `loadRunLog` is proven incidentally by the live
  smoke (step 6) reading back what a real cast wrote.
- **Gates**: `bun run check:typecheck` + `bun run check:test` green after each step that
  compiles; `check:committed` before the commit.

## Steps

### Step 1 — write-path types + emit (TDD)
1a. Add `Envelope` interface; add optional `envelope?` to `RunRecordInput` and `RunRecord`.
1b. Add `normalizeEnvelope`; have `buildRunRecord` spread `envelope` **only when present**.
1c. Tests: envelope carried through + round-trips; **absent ⇒ field omitted** (assert
    `"envelope" in rec === false`, not `=== null`); a non-finite envelope number coerces
    via `num`.
- **Verify:** `bun test src/log/run-log.test.ts` green; `tsc --noEmit` clean.
- *Atomic-committable.* Covers AC #1 (writer side) + part of AC #3.

### Step 2 — reader pure core (TDD)
2a. `reviveRecord(parsed): RunRecord | null` per the structure's acceptance rules
    (never throws; tolerates absent `envelope` and drops a malformed one).
2b. `readRuns(jsonl): ReadResult` — split, skip blanks, `JSON.parse` in a try/catch,
    revive, accumulate `records` + `skipped`.
2c. `forPlay`, `wallClockMs`, `totalTokens`.
2d. Tests: fixture parse count; malformed line + torn final line skipped+counted;
    back-compat line (no `envelope`) parses with `envelope === undefined`; `forPlay`
    play + outcome partition; `wallClockMs` value + `null` on bad timestamp; `totalTokens`
    sum cross-checked.
- **Verify:** `bun test src/log/run-log.test.ts` green; `tsc` clean.
- *Atomic-committable.* Covers AC #2 + AC #3 (reader side).

### Step 3 — `loadRunLog` impure shell
3a. `readFile(path, "utf8")` → `readRuns`; ENOENT ⇒ `{ records: [], skipped: 0 }`;
    rethrow other errors.
- **Verify:** `tsc` clean (no unit test by contract).

### Step 4 — plumb `cast.ts`
4a. Add `envelope: budget,` to the `appendRunLog` call.
- **Verify:** `tsc` clean; full `bun test` green (cast has no unit test but must compile).
- Covers AC #1 (every cast now writes the envelope) + AC #4 (existing casts still
  write valid records — the field is additive).

### Step 5 — full gate sweep
5a. `bun run check:typecheck && bun run check:test`.
- **Verify:** all green; confirm existing 10 `.vend/runs.jsonl` records still parse via
  a quick `readRuns(readFileSync(...))` check (or rely on the back-compat unit fixture,
  which is a copied real line).

### Step 6 — live smoke (envelope round-trips through a real cast)
6a. To a temp ledger path, simulate the cast call path: `appendRunLog({..., envelope:
    { timeMs, tokens }}, { path })` then `loadRunLog({ path })` and assert the read-back
    record's `envelope` equals what was allocated, and `forPlay(..., { outcome })` selects
    it. (A full `claude -p` cast is unnecessary and slow; the seam is unchanged — what
    this ticket adds is purely the envelope field + reader, both exercised here.)
- **Verify:** read-back envelope matches; cleanup temp file.
- This is the concrete proof of the ticket's thesis: cost-vs-budget is now recoverable.

### Step 7 — commit
7a. `bun run check:committed` (polices the tree); commit `src/log/run-log.ts`,
    `src/engine/cast.ts`, `src/log/run-log.test.ts`, and the work artifacts.

## AC trace

| AC | Satisfied by |
|---|---|
| #1 record carries allocated envelope, written every cast, backward-compatible | Steps 1 (optional field + omit-when-absent), 4 (cast plumb) |
| #2 pure reader `readRuns`+`forPlay`, tolerates malformed lines (skip+count), no fs in core | Steps 2, 3 |
| #3 unit-tested: parse, play-filter, outcome-filter, wall-clock + total-tokens per record | Steps 1c, 2d |
| #4 `bun run check:*` green; existing casts still write valid records | Steps 5, 6 (additive field; back-compat fixture + live round-trip) |

## Risks / mitigations
- **Reviver too strict → silently drops good records.** Mitigation: the back-compat
  test uses a *copied real `.vend` line*; if the reviver rejects it the test fails loudly.
- **Reviver too lax → admits junk.** Mitigation: explicit non-empty-string + known-outcome
  checks; a malformed-line test asserts `skipped` increments.
- **Accidental `src/budget/` import** when typing `envelope: budget`. Mitigation: no
  import added — `Budget` duck-types onto local `Envelope`; `tsc` confirms, grep confirms.
- **Field-omission vs null.** A spread-only-when-present keeps old and new field-less
  records byte-identical in shape; test asserts `"envelope" in rec === false`.
