# T-014-01 — Research

The **E1 / trust** arm of the Trust & Consistency Evidence Gate (E-014, PRD KR1–KR2).
Two deliverables, both minimal: (1) capture **one bit per run** — did the author step in
mid-run, or let it clear — and (2) a **pure walk-away audit** over `.vend/runs.jsonl`. This
artifact maps what exists; it proposes nothing.

## The substrate: `.vend/runs.jsonl` and `src/log/run-log.ts`

The run log is an **append-only JSONL ledger**, one record per cast, written exactly once
at run-end. The module is split into a write face and a read face, both with the house
"pure core + one thin impure fs verb" pattern.

**Write face**
- `RunRecordInput` (the runner's pre-normalization shape) → `buildRunRecord` (PURE,
  validates + normalizes + freezes) → `serializeRunRecord` (PURE, one JSONL line) →
  `appendRunLog` (IMPURE, the only fs verb: `mkdir -p` + `appendFile` O_APPEND).
- Field-presence idiom for **back-compatible optional fields**: `envelope` and `project`
  are spread into the record **only when present** (`...(envelope ? { envelope } : {})`),
  so an absent value leaves the field **off the line, byte-for-byte** identical to a record
  that predates the field. Absence is meaningful (unknown), never written as a zero/empty.
- Validation stance: ids/timestamps/outcome **assert loudly** (`RangeError` — caller bug);
  absent optional data **coerces** (usage→0s, gates→[]) or **omits** (envelope/project).

**Read face**
- `reviveRecord` (PURE, TOTAL — never throws; structurally revives one parsed value or
  returns `null`), `readRuns` (PURE, parses a JSONL string; skips+counts bad lines),
  `loadRunLog` (IMPURE, the fs read; ENOENT ⇒ empty result, not an error).
- `reviveRecord` mirrors the write idiom: tolerates absent newer fields (old records
  parse), keeps `envelope` only when **both** numbers finite, keeps `project` only when a
  non-empty string — otherwise the field is dropped, never the whole record. This is the
  exact template the new `intervened` bit will follow.

**Pure record helpers** (operate on records, never fs): `forPlay(records, play, {outcome,
project})`, `projectOf(r)` (→ `DEFAULT_PROJECT` when absent), `wallClockMs(r)` (→ `null`
on unparseable stamps), `totalTokens(r)` (sum of the four usage sub-counts).

**`RunOutcome`** = `success | gate-failed | timed-out | budget-exhausted | id-collision`
(a `const` tuple, exhaustively switchable). Two are envelope-censored (`budget-exhausted`,
`timed-out`); `gate-failed`/`id-collision` are stops but not censorings.

Zero-coupling invariant: run-log imports **nothing** from `src/executor/` or `src/budget/`
— `UsageInput`/`Envelope` are declared locally as structural contracts the runner's shapes
duck-type onto. Any new field must preserve this (no new import to satisfy `intervened`).

## The write path: where `intervened` would be set — `src/engine/cast.ts`

`castPlay<I,O>(play, inputs, budget, opts: CastOptions)` is the single IMPURE orchestrator.
Every play casts through it. The record is built and appended **once**, at the very end
(`appendRunLog({...})`, lines ~160–181), after the run is fully resolved. This is exactly
"run-end": the bit is known by the time this call fires.

- `CastOptions` already carries optional per-cast values the play does not own: `subject`,
  `projectRoot`, `project`, `model`, `runId`, `transcriptDir`, `runLogPath`. Adding
  `intervened?: boolean` here is the established extension point.
- The `appendRunLog` call already spreads `envelope`/`project`; `intervened` slots in the
  same way (passed only when present).

**Threading surface** (CLI flag → record):
`cli.ts` (`run` dispatch) → `runPlay` (`dispatch.ts`) → `assembleAndCast` /`RunOptions`
(`decompose-epic.ts`) → `castPlay`/`CastOptions`. `RunOptions` is documented as "a subset
of the engine's `CastOptions`". To wire a `--intervened` flag end-to-end, `intervened` must
be added to `RunOptions` and forwarded in `assembleAndCast` (lines 188–194). The `chain`
and `select` paths have their own assemblies (`chain-propose-decompose.ts`, `press.ts`) and
are **out of scope** — the forward-looking instrument only needs one writable path.

## The read/analysis precedent: `src/ledger/recalibrate.ts` (E-013)

The Ledger is the consumer where run-log meets budget. Every export is PURE; the one fs
touch is the existing `loadRunLog`; the CLI shell composes them. Directly reusable patterns
for the walk-away audit:
- **Windowing**: `forPlay(records, play).slice(-window)` — most-recent-N over append order.
- **Outcome partition**: successes feed estimates; `CENSORED_OUTCOMES = [budget-exhausted,
  timed-out]` are counted as the andon signal but never averaged in (IA-13).
- **Ratio-from-envelope**: `learnBiasFactor` computes actual/allocated ratios (tokens via
  `totalTokens(r)/env.tokens`; time via `wallClockMs(r)/env.timeMs`) over successful runs
  **that carry an envelope** — the precedent for "cost-vs-envelope".
- **Robust central tendency**: `medianOrNull` (true median, not nearest-rank) for a
  central estimate; `percentile` (conservative nearest-rank) for a tail.
- **Honest labels**: `formatEnvelopeLabel`/`formatCorrectionLabel` render a one-line
  confidence string and never let a guess read as earned (IA-8) — the template for the E1
  findings fragment.

## The display precedent: `src/cli.ts`

Read-only Ledger readouts already exist: `vend envelope <play> …` is parsed by the PURE
`parseEnvelopeArgs` and dispatched by an impure arm that lazy-imports `loadRunLog` +
`recalibrate` + formats, then `exit(0)` (read-only never actuates). The findings surface
for E1 will mirror this: a new pure parse branch + an impure arm that loads, audits, prints.
`parseArgs` routes by first token (`run`/`chain`/`envelope`/select-shape); a new verb
(e.g. `audit`) is a one-line addition. `cli.test.ts` tests the **pure parsers** only.

## IA-12 — the budget the andon-rate is read against

`information-architecture.md` IA-12: each play-node has an **andon budget** — the tolerable
stop rate (an SRE error budget). Value tier sets it: **Keystone ~5% / Standard ~10% / Leaf
~25%**. "An andon rate **at** budget is the gates working (IA-10), not a defect; a 0% rate
is suspicious, not ideal." So the audit must compare the observed stop-rate against a
tier-derived setpoint and read it as *in/over budget*, never as a defect rate. (Ledger
"generates demand" when the andon rate **spikes** — IA-15 — but actuation is out of scope.)
The tier→budget ladder is currently encoded only as `TIER_PERCENTILE` (the *percentile*
side of IA-12); the *andon-budget* side (the % setpoint) is **not yet a constant** anywhere
— the audit introduces the first read of it.

## Test & toolchain conventions

- Bun test (`bun:test`: `describe/expect/test`). `bun run check` = `baml:gen` +
  `check:typecheck` (`tsc --noEmit`) + `check:test` (`bun test`). `check:committed`/`:head`
  are CI gates.
- Pure cores are tested to the branch with **fabricated inputs**; impure verbs are
  deliberately **not** unit-tested (their logic lives in the tested pure core) — e.g.
  `run-log.test.ts` exercises `buildRunRecord`/`serializeRunRecord`/`reviveRecord`/
  `readRuns` but not `appendRunLog`/`loadRunLog`.
- `run-log.test.ts` uses a `baseInput(over)` factory overriding one field at a time — the
  pattern the new `intervened` cases extend.

## Constraints & assumptions

- **Anti-scope-creep (PRD §7):** one optional field + one analysis. No schema overhaul, no
  new service, no second executor, ≤5 casts. The variance/`--no-gates` arm is **T-014-02**;
  the findings note + go/reroute is **T-014-03** — this ticket is E1 only.
- The append-only invariant is sacred: the bit must be captured **before** the single
  end-of-run append, never by mutating a written line.
- Back-compat is an AC: absent `intervened` ⇒ unknown; every pre-T-014-01 record must still
  parse unchanged. The `envelope`/`project` precedent guarantees the mechanics.
- One self-reporting user; tiny sample. The audit must degrade gracefully on thin/empty
  data and on records that carry no `intervened` bit (report "unknown", never crash).
- Schema version stays `1` — adding an optional, omittable field is back-compatible and does
  not warrant a version bump (consistent with how `envelope`/`project` were added).
