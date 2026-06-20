# T-026-03 — Research: audit-walk-away-rate-and-trend

## The ask, restated

Read **one number** — the walk-away rate and its trend — off the real ledger, stated
against the IA-12 andon budget, with the sample size tracing to the ≥10 genuine sessions
T-026-02 made accruable. The ticket is explicitly **N2: build no new instrument or
dashboard**. The instrument already exists (`vend audit`, T-014-01); this ticket *runs*
it and reports. So Research maps what produces the number, not what to build.

## The instrument that already exists

`src/ledger/walk-away.ts` is the E1 / TRUST arm of the Trust & Consistency Evidence Gate
(E-014). It is PURE: `auditWalkAway(records, opts)` takes plain `RunRecord[]` and returns a
`WalkAwayReport`; `formatWalkAwayFindings(report)` renders the fragment T-014-03's note
quotes. The CLI shell (`src/cli.ts`, the `audit` arm at ~L682) is the only impure part: it
`loadRunLog()`s the ledger, calls the pure pair, prints, and exits 0 (read-only — it never
actuates, so it always exits 0).

Invocation: `bun run src/cli.ts audit [<play>] [--tier <keystone|high|standard|leaf>]
[--window <n>]`. Parsed by `parseAuditArgs` (`src/cli.ts` ~L184).

The report carries four blocks (`WalkAwayReport`):

1. **Intervention / walk-away** (`InterventionStat`) — over records that **carry the
   `intervened` bit only** (absence = unknown, excluded). `reported` = carriers in scope;
   `intervened` = how many were stepped into; `rate` = `intervened/reported` (or `null`);
   `trend` = the rate over the earlier vs recent half of the carriers. The findings line
   reports the **walk-away** rate = `1 − intervention rate` ("ran untouched"), trend toward
   100%.
2. **Andon rate** (`andonRate` vs `andonBudget`) — non-success stops ÷ **total** runs in
   scope (IA-12 stop rate), read against the tier budget. `withinBudget` is a flag, not a
   pass/fail; the module's own doc: "an andon rate AT budget is the gates working, not a
   defect; a 0% rate is suspicious."
3. **Outcome mix** (`OutcomeMix`) — per-outcome counts + total/success/censored roll-ups.
   Censored = `budget-exhausted` + `timed-out` (IA-13, right-censored at the envelope).
4. **Cost vs envelope** (`CostVsEnvelope`) — median actual/allocated token & time ratio
   over successful runs that carry an envelope.

## Two distinct denominators (the load-bearing subtlety)

The walk-away rate and the andon rate **do not share a denominator**, by design:

- **Walk-away rate** is over the `intervened`-carriers only (`reported`). Absence of the
  bit reads as *unknown*, never as a walk-away — so the rate is honest about its sample.
- **Andon rate** is over **all** runs in scope (`total`), because IA-12's budget governs
  the whole stop rate, not just self-reported sessions.

So a report can read "93% walk-away (15 carriers)" and "40% andon (25 runs)" at once
without contradiction. Any analysis must not conflate the two samples.

## The andon BUDGET (IA-12), per tier

`TIER_ANDON_BUDGET`: keystone 5%, high 8%, standard 10% (default), leaf 25%. Value sets the
budget; the observed rate is read against it. The macro-wallet keystone the sprint exists to
unpark (E-014) is the **keystone** 5% tier — the strictest.

## The windowing

`auditWalkAway` windows to the last `window` records (`DEFAULT_WINDOW = 100`, from
`recalibrate.ts`). The ledger holds **25** records — well under 100 — so **the window is a
no-op here**: every record is in scope. No recency truncation is masking anything.

## The ledger state, as it actually stands (read 2026-06-19 22:54 PDT)

`.vend/runs.jsonl` — **25 total records**, of which **15 carry the `intervened` bit** (the
self-report sample). The carriers, in append (chrono) order, span genuine product use across
the day — `propose-epic`, `decompose-epic`, `expand-fragment`, `survey`, `steer` — with a
real mix of outcomes (`success`, `budget-exhausted`, `gate-failed`). Exactly **one** carrier
is `intervened=true` (a `decompose-epic` `budget-exhausted` at 05:36, the most recent block);
the other 14 are `intervened=false` (clean walk-aways). Full list in `audit-output.txt`.

These are **not padded 1-token andons** (the failure mode T-026-02 and T-026-01 review #2
forbade): the cost-vs-envelope block shows ×0.65 token median over 9 real successful runs
with real envelopes, and the carriers are diverse genuine plays. The sample is genuine.

## Sample-size traceability (the AC's spine)

The AC requires the reported sample size to **trace to the ≥10 genuine sessions from
T-026-02**. T-026-02 wired the `intervened` bit through `vend work` (commit `4bd90d3`) and
flagged that only **2** genuine forward carriers existed at handoff, with a sweep protocol to
accrue ≥10. Since that handoff, genuine sessions accrued: the ledger now holds **15 carriers
≥ 10**. The provenance is auditable line-by-line in `.vend/runs.jsonl` (each carrier is a
real cast with a timestamp, play, and outcome) and is captured in `audit-output.txt`. So the
"≥10 genuine sessions" clause is **met by real data**, not by reading the 2 thin probes.

Caveat carried from T-026-02: one self-report stamps **both** the propose and decompose
records of a chain, so "≥10 sessions" = ≥10 carrier *records*, not 10 separate invocations.
Honest — each is a genuine "did the author intervene" observation — but the analysis must say
"carriers/records," not imply 15 independent sittings.

## What this ticket must NOT do

- **No new instrument, no dashboard (N2).** Reading is the deliverable.
- **No ledger writes.** No casting `vend run`/`vend work` to inflate the sample — that would
  be padding, and the data already clears ≥10.
- **No source changes.** This is a measurement/reporting ticket; the only artifacts are the
  captured output + the RDSPI docs under `docs/active/work/T-026-03/`.

## Constraints & assumptions

- The ledger is the single source of truth; `loadRunLog` degrades on torn lines (none here —
  0 skipped). The numbers are reproducible by re-running the captured commands.
- The trust framing (IA-10/12) treats the andon rate as a budget read, not a defect count.
  The analysis must preserve that framing, not alarm on "over budget."
- The single `intervened=true` carrier means the **trend** signal is thin — this is the key
  honest limitation Design and Review must surface, not smooth over.
