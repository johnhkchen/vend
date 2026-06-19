# T-013-01 — Review

*Handoff: what changed, test coverage, open concerns. Read this instead of every diff.*

## What this ticket did

Closed the Ledger's blind spot for E-013 (measured envelopes). Before: the run record
logged actuals (`usage`, `costUsd`, timestamps, `outcome`) but **not the allocated
envelope**, so "how close did this cast run to its budget?" was unanswerable, and a
censored (andon'd-at-envelope) run couldn't be marked. After: every cast records its
allocated `{ timeMs, tokens }`, and a pure reader loads `.vend/runs.jsonl` back and
filters by play/outcome — the exact seam the recalibrator (T-013-02) needs.

Committed as `d7593d3`.

## Files changed

- **`src/log/run-log.ts`** — the bulk of the work.
  - *Write path:* `Envelope` interface (local mirror of budget's `Budget`); optional
    `envelope?` on `RunRecordInput` and `RunRecord`; `normalizeEnvelope`; `buildRunRecord`
    spreads `envelope` only when present.
  - *Read path (new):* `ReadResult`, `reviveRecord`, `readRuns`, `forPlay`, `wallClockMs`,
    `totalTokens` (all pure), and `loadRunLog` (the one impure fs verb). Added `readFile`
    to the existing fs import.
- **`src/engine/cast.ts`** — one line: `envelope: budget` in the sole `appendRunLog` call.
- **`src/log/run-log.test.ts`** — new describe blocks for the envelope and the read face.

No files created or deleted; no new modules (reader co-locates with writer); no new deps.

## Acceptance criteria — all met

| AC | Status | Evidence |
|---|---|---|
| #1 record carries the allocated envelope, written every cast, backward-compatible | ✅ | `envelope?` field; cast.ts plumb; absent ⇒ omitted (test: `"envelope" in rec === false`); 10 real legacy records parse, 0 skipped |
| #2 pure `readRuns`/`forPlay`, tolerate malformed lines (skip+count), no fs in core | ✅ | `readRuns` takes a string; `reviveRecord` never throws; torn/non-JSON/invalid lines counted in `skipped`; `loadRunLog` is the only fs touch |
| #3 unit-tested: parse, play-filter, outcome-filter, wall-clock, total-tokens | ✅ | 23 added cases; `forPlay` outcome partition; `wallClockMs`/`totalTokens` value + edge tests |
| #4 `bun run check:*` green; existing casts still write valid records | ✅ | typecheck clean; 358/358 tests; live round-trip smoke; additive optional field |

## Test coverage

- **Pure core fully covered.** Envelope: carry-through/round-trip, omit-when-absent,
  non-finite coercion. Reader: multi-line parse, blank-line tolerance, non-JSON +
  torn-final-line skip+count, structurally-invalid skip, legacy (envelope-less) parse,
  malformed-envelope-keeps-actuals, non-object → null. `forPlay`: play filter, outcome
  partition (success vs budget-exhausted), unknown play. Derivations: `wallClockMs`
  value + null-on-bad-timestamp, `totalTokens` four-bucket sum.
- **Impure shells (`appendRunLog`, `loadRunLog`) deliberately not unit-tested** — house
  contract (their logic is the tested pure core). Both were exercised end-to-end by the
  live round-trip smoke (step 6) and `loadRunLog` again against the real ledger.
- **Gaps (intentional, low-risk):** `loadRunLog`'s non-ENOENT rethrow branch is not
  unit-tested (would need fs mocking, which the file avoids by design); covered by
  inspection.

## Design decisions worth knowing

- **Decoupling preserved.** `Envelope` is declared locally; `Budget` satisfies it by
  duck-typing. No `src/budget/` ↔ `src/log/` import edge was added (confirmed: cast.ts
  passes `budget` with zero new imports). This keeps the DAG honest.
- **Absence is meaningful.** An envelope-less cast omits the field rather than writing
  `null`/zeros — a zeroed envelope is an invalid budget the recalibrator couldn't tell
  from a real one, and omission makes legacy and new field-less records byte-identical.
- **Two boundaries, opposite stances.** Write asserts loudly (`buildRunRecord` throws);
  read degrades quietly (`reviveRecord` returns null, `readRuns` skips+counts). A torn
  final line in an append-only ledger is expected, not a crash.
- **Schema `v` stayed at 1.** The field is purely additive/optional; no migration needed.

## Open concerns / notes for the reviewer

1. **`forPlay` returns censored runs as-is.** Per IA-13, `budget-exhausted`/`timed-out`
   records are right-censored at the envelope and should be treated as `≥ envelope` lower
   bounds. This ticket only *enables* the split (the outcome filter); the lower-bound
   semantics and percentile math are **T-013-02's** responsibility. Flagging so the
   recalibrator doesn't naively average censored costs as if uncensored.
2. **`totalTokens` duplicates budget's `countTokens` definition** (same four-bucket sum),
   inlined to avoid the import. If the notion of "spent" ever changes, both must move
   together — a comment in each marks the shared contract. Low risk (the definition is
   stable and load-bearing).
3. **No retroactive backfill.** The 10 existing records have no envelope and never will
   — the recalibrator must tolerate `envelope === undefined` on historical runs. The
   reader surfaces that cleanly (field is `undefined`, not an error).

## Verdict

Foundation for measured envelopes is in place and proven on real data. Ready for
T-013-02 (the pure `recalibrate()` percentile core) to build on `forPlay` + the recorded
envelope. No critical issues for human attention.
