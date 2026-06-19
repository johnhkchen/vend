# T-013-01 — Progress

## Status: implementation complete, all gates green

Followed the plan step order; no deviations.

### Completed

- **Step 1 — write-path types + emit.** Added the local `Envelope` interface (mirrors
  budget's `Budget`, no import — decoupling preserved); optional `envelope?` on
  `RunRecordInput` and `RunRecord`; `normalizeEnvelope` helper; `buildRunRecord` spreads
  the envelope **only when present** so an absent one is omitted, not zeroed/nulled.
- **Step 2 — reader pure core.** `reviveRecord` (total, never throws — degrades quietly),
  `readRuns` (skip+count malformed/torn/blank-tolerant), `forPlay` (play + optional
  outcome filter), `wallClockMs` (null on bad timestamp), `totalTokens` (four-bucket sum,
  agrees with budget's `countTokens`). `ReadResult { records, skipped }`.
- **Step 3 — `loadRunLog` impure shell.** `readFile` → `readRuns`; ENOENT ⇒ empty
  result (fresh project has no ledger); other fs errors propagate. Untested by contract,
  same as `appendRunLog`.
- **Step 4 — cast.ts plumb.** One field `envelope: budget` at the sole `appendRunLog`
  call site. No signature change, no new import (`Budget` duck-types onto `Envelope`).
- **Step 5 — tests.** 23 new cases added to `run-log.test.ts` (envelope build/serialize/
  omit/coerce; readRuns parse/skip/torn-line/blank/invalid; legacy back-compat from a
  verbatim real `.vend` line; malformed-envelope-keeps-actuals; forPlay play+outcome
  partition; wallClockMs value+null; totalTokens sum).
- **Step 6 — live round-trip smoke.** A two-record temp ledger written via `appendRunLog`
  with envelopes, read back via `loadRunLog`: envelope round-trips
  (`{timeMs:600000,tokens:60000}`), cost-vs-budget recoverable (`spent 300 / 60000`),
  `wallClockMs` = 120000, `forPlay` partitions success vs budget-exhausted correctly.

### Verification

- `bun run check:typecheck` — clean.
- `bun test` — **358 pass / 0 fail** across 26 files (was 340 before; +18 net new visible
  here as 23 added cases consolidated in run-log.test.ts: 43 in that file now).
- Real `.vend/runs.jsonl` — all **10 legacy records parse, 0 skipped**, 0 envelopes
  (expected; they predate this change). Backward compatibility proven on live data.

### Files changed

- `src/log/run-log.ts` — +`Envelope`, optional `envelope`, `normalizeEnvelope`, the read
  face (`reviveRecord`, `readRuns`, `forPlay`, `wallClockMs`, `totalTokens`, `ReadResult`),
  `loadRunLog`. Added `readFile` to the fs import.
- `src/engine/cast.ts` — one line: `envelope: budget` in the `appendRunLog` call.
- `src/log/run-log.test.ts` — new describe blocks for the envelope + the read face.

### Deviations from plan

None. The reviver's "drop a malformed envelope but keep the record" rule was implemented
exactly as designed and is covered by its own test.
