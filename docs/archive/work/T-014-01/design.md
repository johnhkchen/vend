# T-014-01 — Design

Two decisions to make: **(A)** how the `intervened` bit is captured and persisted, and
**(B)** where the walk-away audit lives and what it returns. Both grounded in the research.

---

## A. Intervention capture

### A.1 The record field — decided

Add `intervened?: boolean` to `RunRecordInput` and `RunRecord`, following the
**envelope/project precedent exactly**: spread-when-present in `buildRunRecord`, kept-when-
boolean in `reviveRecord`, omitted otherwise. Schema version stays `1`.

Rejected alternatives:
- *A tri-state enum (`yes`/`no`/`unknown`)* — "unknown" is already expressed by **field
  absence** (the house idiom). A boolean + absence is the minimal honest encoding and
  matches how every other optional field works. (PRD: "absent ⇒ unknown".)
- *A separate sidecar file / second JSONL kind* — a "new service", violates anti-scope-creep
  and the "one optional field" constraint, and splits the trust signal off the record the
  audit already reads.

### A.2 The write mechanism — decided: a `--intervened` flag threaded to the single append

The bit is **self-reported** and known by run-end. The record is already built and appended
**once** at the end of `castPlay`. So the capture is: `CastOptions.intervened?: boolean` →
included in that single `appendRunLog` call when present. No new append, no mutation of a
written line — the append-only invariant holds untouched.

Surface: a `--intervened` / `--no-intervened` flag on `vend run`, parsed in `cli.ts`
(`parseRunArgs`), carried on the `run` command as `intervened?: boolean`, threaded
`runPlay` → `RunOptions` → `assembleAndCast` → `CastOptions` → `appendRunLog`.

Semantics of the three states:
- `--intervened` present ⇒ `intervened: true` (author stepped in).
- `--no-intervened` present ⇒ `intervened: false` (let it clear — the walk-away case).
- neither ⇒ field omitted ⇒ **unknown** (back-compat; every existing record).

Why a flag and not a stop-time interactive prompt:
- **Testability + purity.** A flag is parsed by the existing pure `parseRunArgs` and tested
  like every other arg. An interactive TTY prompt is an impure, untestable edge that would
  live in the dispatch shell and complicate the autonomous (lisa-loop, no TTY) path.
- **Honest in the autonomous context.** These measurement casts are author-driven; the
  author records the bit on the command that ran the cast. A `--no-intervened` on a clean
  walk-away run, `--intervened` when they stepped in. This is the forward-looking instrument
  KR1 needs ("at least 10 consecutive runs").
- The flag is the *minimum* that satisfies AC #1 ("writable at run-end … a flag"). The
  "stop-time self-report path" is the same field reached the same way; a prompt is an
  optional future ergonomic, not part of this minimal slice.

Rejected: threading through `chain`/`select`/`press`. The AC needs **one** writable path
("the only forward-looking instrument"); `vend run` is it. Adding three more thread-throughs
is scope the PRD explicitly forbids. Documented as a follow-up.

---

## B. The walk-away audit

### B.1 Home — decided: a new module `src/ledger/walk-away.ts`

It belongs in the Ledger (the consumer that reads the run log), beside `recalibrate.ts`,
reusing `forPlay`/`totalTokens`/`wallClockMs`/`projectOf` and the median/window patterns.
A separate file (not appended to `recalibrate.ts`) keeps the two concerns — *envelope
proposal* vs *trust/outcome audit* — independently readable and testable, matching the
codebase's one-concern-per-module grain.

Rejected: putting it in `run-log.ts` (would pull analysis into the substrate module and
blur the read-face/analysis boundary E-013 established) or in `cli.ts` (the audit must be a
**pure, unit-tested** function per AC #2 — cli.ts holds only the impure shell).

### B.2 What it computes — decided

One pure entry: `auditWalkAway(records, opts) → WalkAwayReport`. Over a record slice
(optionally filtered to a play and windowed), it returns the four things the AC names:

1. **Andon-rate vs IA-12 budget.** `andonRate = nonSuccess / total`. Compared against a
   tier-derived `andonBudget` (Keystone 0.05 / standard 0.10 / leaf 0.25 — a new
   `TIER_ANDON_BUDGET` constant, the % side of IA-12 that `TIER_PERCENTILE` is the
   percentile side of). Report `{ andonRate, andonBudget, withinBudget }`. Read as "gates
   working" not "defects" (IA-10/12).
2. **Outcome mix.** A count per `RunOutcome` plus a grouped `censored` (= budget-exhausted +
   timed-out, the IA-13 set) and `success`. Full `RUN_OUTCOMES` keys so the mix is total.
3. **Cost-vs-envelope.** Over successful runs **carrying an envelope**, the **median**
   actual/allocated ratio for tokens and time (reusing the `learnBiasFactor` ratio logic /
   `medianOrNull`). `< 1` = ran under ceiling; `~1` = ran to the wall. Reported with the
   sample size; `null` dimension when no usable pair (degrade, don't invent).
4. **Intervention rate + trend.** Over records **carrying `intervened`**: `rate =
   intervened / reported`. **Trend**: split the reported records into an earlier and a
   recent half; report each half's rate so the surface can show "→ 0". `reported` count is
   surfaced separately from `total` so "we have N runs but only M self-reports" is honest
   (KR1 needs ≥10 reports; the audit shows how many we actually have).

Andon definition — decided: **any non-`success` outcome** is a stop (the line stopped). This
is the IA-12 "stop rate" the andon budget governs (broader than the IA-13 *censored* set,
which is the cost-estimation subset; both are reported, distinctly).

### B.3 Shape — decided (purity + honesty)

- PURE, total, no fs/clock — takes records (caller loads via `loadRunLog`), mirrors
  `recalibrate`. Window + play filter via the existing `forPlay`/`slice(-window)`.
- Every count surfaced, never swallowed (the `ReadResult.skipped` / `Confidence.censored`
  stance): `total`, `reported`, sample sizes travel with the numbers.
- `formatWalkAwayFindings(report) → string`: the **E1 findings fragment** (AC #3) — a short
  multi-line block: walk-away rate + trend, andon-rate vs budget (in/over), outcome mix,
  cost-vs-envelope. Honest labels (IA-8): "no self-reports yet" when `reported === 0`,
  never a fabricated rate. This is the fragment T-014-03's findings note will quote.

### B.4 The surface — decided: `vend audit [play] [--tier t] [--window n]`

A new read-only CLI verb beside `vend envelope`: pure `parseAuditArgs` (play optional —
absent ⇒ all plays; `--tier` default standard; `--window` optional) + an impure arm that
`loadRunLog` → `auditWalkAway` → prints `formatWalkAwayFindings`, `exit(0)` (read-only).

Rejected: folding the findings into `vend envelope`. `envelope` is about *cost proposal*
per play; the walk-away audit is *trust/outcome* across runs — a distinct question deserving
its own verb, and KR2/KR4 want a standalone "trust numbers" readout to paste into the note.

---

## Decision summary

| Question | Decision |
|----------|----------|
| Field encoding | `intervened?: boolean`, omit-when-absent (envelope/project idiom) |
| Write mechanism | `--intervened`/`--no-intervened` on `vend run` → single end-of-cast append |
| Threading | cli → dispatch → RunOptions → assembleAndCast → CastOptions (run path only) |
| Audit home | new `src/ledger/walk-away.ts`, pure |
| Audit output | andon-rate vs IA-12 budget · outcome mix · cost-vs-envelope · intervention rate+trend |
| Andon definition | any non-success outcome (IA-12 stop rate); censored subset reported too |
| Surface | new `vend audit` read-only verb + `formatWalkAwayFindings` fragment |
| Schema version | unchanged (`1`) — back-compatible optional field |
