# Review — T-001-04 countable-run-log

Handoff document: what changed, how it's tested, what to know. A reviewer should
be able to sign off from this plus a glance at the ~190-line module.

## What changed

| Path | Action | Notes |
|------|--------|-------|
| `src/log/run-log.ts` | **created** (~190 lines) | Types + pure `buildRunRecord`/`serializeRunRecord` + thin impure `appendRunLog`. |
| `src/log/run-log.test.ts` | **created** | 19 tests over the two pure functions. |
| `src/log/.gitkeep` | **deleted** | Placeholder retired now that the dir has real files. |

No other files touched. No new runtime dependencies (`node:fs/promises`,
`node:path`, `bun:test` only). `budget.ts` / `claude.ts` untouched.

## Acceptance criteria — status

- **AC #1 — `src/log/run-log.ts` appends one JSONL record per run to
  `.vend/runs.jsonl` (path configurable) with the named fields.** ✅ Record carries
  `runId`, `play`, `epic`, `model`, `usage` (input/output + cache buckets),
  `costUsd`, `outcome`, `gateResults`, `startedAt`, `endedAt` — plus a `v` schema
  version. `DEFAULT_RUN_LOG_PATH = ".vend/runs.jsonl"`, overridable via
  `opts.path`. `outcome` is exactly the required union
  `success | gate-failed | timed-out | budget-exhausted`.
- **AC #2 — append-only, one line per run, countable; a failed run still logs.**
  ✅ `appendFile` (O_APPEND) only adds; `serializeRunRecord` emits exactly one
  `\n`-terminated line. Verified live: two appends → `wc -l` = 2,
  `jq -r '.outcome'` lists both. A `timed-out` run wrote a complete record. The
  failure path is structural (no branch) — `outcome` is a passed field.
- **AC #3 — pure construction unit-tested; append is a thin fs call.** ✅
  `buildRunRecord` + `serializeRunRecord` covered to the branch (19 tests, no fs);
  `appendRunLog` is two fs calls over the pure pair, deliberately untested
  (mirrors `dispense`).
- **AC #4 — no dependency on seam/budget.** ✅ `run-log.ts` imports only `node:*`.
  `UsageInput` / `GateResult` declared locally as structural duck-types; the
  runner forwards data, the module imports no sibling symbol. Grep-confirmed.

## Test coverage

`bun run check` → `tsc --noEmit` clean, `bun test` **65 pass / 0 fail** (19 new).

Covered (pure):
- field pass-through + schema-version stamp;
- usage normalization — full four-bucket, absent → all-zero, partial → missing 0,
  non-finite → 0;
- `costUsd` absent / non-finite → 0; `gateResults` absent → `[]`; optional gate
  `detail` preserved and extra keys dropped;
- validation — empty `runId/play/epic/model/startedAt/endedAt` and unknown
  `outcome` each throw `RangeError`;
- every `RUN_OUTCOMES` member accepted; returned record is frozen;
- serialization countability — single trailing `\n`, no interior `\n`, `JSON.parse`
  round-trip, embedded-newline-in-string stays one physical line, two records →
  two countable lines.

**Coverage gaps (intentional):**
- `appendRunLog` has no automated test — it is the thin fs verb (house rule:
  impurity quarantined and untested; its logic is the tested pure pair). Exercised
  manually via the temp-path smoke during Implement. If desired later, a
  tmpdir-based integration test could pin the `mkdir -p` + append behavior, but it
  would test `node:fs`, not our logic.

## Open concerns / known limitations

1. **No concurrency guard.** Single-writer runner + O_APPEND is assumed (CLAUDE.md:
   coordination is Lisa's job). If multiple processes ever write the same ledger
   concurrently, interleaving of large lines is theoretically possible (small
   single-line O_APPEND writes are atomic in practice). Out of scope for this slice;
   flag if the runner ever fans out writers.
2. **No clock in the module, by design.** `startedAt` / `endedAt` are
   runner-stamped ISO strings — the module stays pure. The runner owns wall-clock
   truth; if it forgets to stamp, validation rejects the empty string loudly.
3. **`costUsd` is recorded, not computed.** The log is not a cost model — it stores
   the seam's `total_cost_usd` verbatim (Design Decision, consistent with budget's
   token-not-dollar stance).
4. **Schema `v: 1` is a forward-compat marker only.** No migration machinery
   exists yet; the field exists so a future reader can branch. Cheap insurance for
   a forever-append ledger.
5. **No read/query/rotation path.** Deliberately out of scope — this ticket writes
   the countable data; the consistency layer that reads it is a later ticket.

## For the human reviewer

Highest-leverage things to eyeball: (a) the `RunRecord` field set vs AC #1 —
confirm nothing the consistency layer will want is missing now (cheapest to add
before the first real record locks the format); (b) the `outcome` union matches the
runner's classification of seam/budget/gate terminal states; (c) comfort with
`appendRunLog` being untested. Nothing here blocks; no critical issues.
