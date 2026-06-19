# T-014-01 — Review

The **E1 / trust** arm of the Trust & Consistency Evidence Gate (E-014, PRD KR1–KR2): a
forward-looking **intervention-capture** bit and a **pure walk-away audit** over
`.vend/runs.jsonl`. Handoff for a human reviewer.

## What changed

### Modified
- **`src/log/run-log.ts`** — added the optional `intervened?: boolean` field to
  `RunRecordInput` + `RunRecord`; `normalizeIntervened` helper; conditional-spread in
  `buildRunRecord` and `reviveRecord` (omit-when-absent, the `envelope`/`project` idiom).
  No new import — the run-log ⊥ budget/executor zero-coupling invariant is preserved.
- **`src/engine/cast.ts`** — `CastOptions.intervened?: boolean`, conditional-spread into the
  single end-of-cast `appendRunLog` call.
- **`src/play/decompose-epic.ts`** — `RunOptions.intervened?: boolean`, forwarded in
  `assembleAndCast`.
- **`src/cli.ts`** — `--intervened` / `--no-intervened` presence flags on `vend run`; a new
  read-only `vend audit` command (parse + dispatch arm).
- **`src/log/run-log.test.ts`**, **`src/cli.test.ts`** — new parse/round-trip cases.

### Created
- **`src/ledger/walk-away.ts`** — the pure audit: `TIER_ANDON_BUDGET`, `auditWalkAway`,
  `formatWalkAwayFindings`.
- **`src/ledger/walk-away.test.ts`** — 13 branch-covering cases.

### Not touched
`src/play/dispatch.ts` (forwards opts verbatim — threads `intervened` for free).

## How it maps to the acceptance criteria

- **AC1 — optional `intervened` bit, back-compatible, writable at run-end.** ✅ Field added
  with the omit-when-absent idiom; `run-log.test.ts` proves a pre-T-014-01 line parses with
  `intervened` undefined, an absent value is omitted, and `false` (a clean walk-away) is a
  real written value distinct from absence. Writable via `vend run --intervened` /
  `--no-intervened`, threaded to the single run-end append (append-only invariant intact).
- **AC2 — pure walk-away audit returning andon-rate-vs-budget / outcome mix /
  cost-vs-envelope / intervention rate+trend, unit-tested incl. records with & without the
  bit.** ✅ `auditWalkAway` returns all four; `walk-away.test.ts` exercises every branch,
  with fixtures that both carry and omit `intervened`.
- **AC3 — a surface prints the E1 findings fragment.** ✅ `formatWalkAwayFindings` +
  `vend audit`, smoke-tested live (output in `progress.md`).
- **AC4 — `bun run check:*` green; existing records unaffected.** ✅ `bun run check`
  (baml:gen + typecheck + test) green, **467 pass / 0 fail**. Existing records unaffected:
  the field is omitted when absent (byte-identical lines) and `reviveRecord` tolerates its
  absence — proven by the legacy-line test.

## Test coverage

| Unit | Coverage | Notes |
|------|----------|-------|
| `buildRunRecord`/`reviveRecord` + `intervened` | full branch | true/false/absent/non-boolean/malformed/legacy-line |
| `auditWalkAway` | full branch | empty, andon-vs-tier-budget, censored subset, cost null/non-null + exclusions, intervention rate/exclusion/trend/reported-0, play filter, window |
| `formatWalkAwayFindings` | both paths | data present + honest fallbacks |
| `parseRunArgs` (+ `--intervened`), `parseAuditArgs` | full | true/false/absent/+no-gates; default/play/tier+window/bad-tier/bad-window/unknown-flag |

Untested by design (house discipline — logic lives in the tested pure core): `appendRunLog`,
`castPlay`, `loadRunLog`, the cli dispatch arms. The `audit` dispatch arm was instead
**proven live** against the real ledger (smoke output in `progress.md`).

## Open concerns / limitations

1. **The trust signal is empty until runs report it.** The instrument is *forward-looking*:
   the 10 existing records carry no `intervened` bit, so the audit honestly reads "no
   self-reports yet". KR1 ("≥10 consecutive runs") is satisfied only once the author starts
   casting with `--no-intervened`/`--intervened`. This is expected and by design — T-014-01
   builds the instrument; the measurement sprint populates it.
2. **Cost-vs-envelope reads "no envelope data" on the current ledger.** The existing
   successful records predate envelope logging (or lack one), so no ratio is shown. New runs
   (which log an envelope via T-013-01) will populate it. The fallback is honest, not a bug.
3. **`intervened` is only writable on the `run` path** (not `chain`/`select`/`press`). This
   is deliberate per PRD anti-scope-creep — one forward-looking instrument is enough for E1.
   Documented as a follow-up; flag for a reviewer who expects chain/press coverage.
4. **Self-report is trusted, single-user, no audit of the bit itself.** The PRD accepts this
   (one honest user > a confident guess from none). No mechanism forces or verifies the
   report — out of scope.
5. **`TIER_ANDON_BUDGET` introduces the IA-12 %-setpoint for the first time.** Keystone 5% /
   standard 10% / leaf 25% come straight from the doc; `high` (8%) is interpolated, mirroring
   how `recalibrate` placed `high` at p92. If a reviewer wants the four-tier ladder pinned in
   `information-architecture.md`, that is a one-line doc follow-up.
6. **`andon` (any non-success stop) vs `censored` (budget/timeout only) are distinct by
   design.** The andon *rate* governs the whole stop rate (IA-12); the censored subset is the
   IA-13 cost-estimation set. Both are reported. A reviewer skimming may conflate them — the
   fragment labels both explicitly.

## Critical issues needing human attention
None. No behavior change to existing runs; the work is purely additive (one optional field +
one read-only analysis + one read-only CLI verb).

## Concurrency note
T-014-02 (the E2 `--no-gates` arm) ran on the same branch concurrently and also edits
`cast.ts`, `decompose-epic.ts`, and `cli.ts`. The two feature sets are orthogonal and compose
cleanly (a cli test asserts `--no-gates` + `--intervened` coexist). The shared files are a
soft missing-dependency edge in the DAG; additive edits + the commit lock were sufficient
here, but a reviewer landing both should confirm no edit was lost in the interleave (the full
suite passing across both feature sets is the evidence it was not).
