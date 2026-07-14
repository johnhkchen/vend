# T-019-02 — Design: run the sweep and produce findings

Decisions with rejected alternatives, grounded in `research.md`.

## D1 — Extend the harness's target table; do not touch the pure core

Add `expand` and `steer` `ProbeTarget` entries to `run-consistency-probe.ts` (survey already
there; keep decompose). The pure core (`consistency.ts`), `variance.ts`, and `run-probe.ts` stay
**byte-for-byte unchanged** — this ticket is a *use* of the T-019-01 generalization, and the
generalization's whole claim (design D5) is that adding a play is "add a target entry." Proving
that on the two remaining articulation plays is the cleanest possible validation of T-019-01.

**Rejected:** changing the classifier or the bucket vocabulary to special-case expand's STOP
honest-empty (see D4). That would edit committed, reviewed, tested code for a reading the raw tally
already supports honestly — a worse trade than interpreting in the note.

## D2 — Fixed, known-grounded inputs, one polarity: "there IS real demand"

The experiment fixes each play's input to a state where **the charter-correct outcome is a
signal** (real demand is present). On such an input:

- a **signal** = correct (the play found the real work),
- a **honest-empty** = a **false negative** = the abstention gate firing **over-eagerly** (the
  E-016 reading, `epic/E-019.md:42-43`) — so the **honest-empty rate directly measures
  over-eagerness**, exactly as the ticket asks,
- a **budget-exhausted** = censoring (the run-probe fat tail).

Concretely:
- **survey / steer** read the **live board snapshot** (the harness already copies
  `docs/active/stories` + `docs/active/tickets`). The current board carries genuine demand
  (E-018/E-019 active, a 9-signal staged board), so the correct outcome is to stage signals; any
  "nothing to stage" marker is a false-negative abstention.
- **expand** needs an authored **fixed grounded fragment** (it takes a `fragment` string, not a
  seeded file). I author one fixture, `fixtures/grounded-fragment.txt`, describing a real,
  board-backed need so the correct outcome is a clean priced signal. This is *the same fragment
  shape* E-016 cast — making this sweep a direct confirm/refute of finding (2).

**Rejected:** a *should-be-empty* input (saturated/empty board) to test the opposite polarity
(signal = over-eager invention). Valid, but it tests the inverse gate and the ticket explicitly
frames the measurement as "honest-empty rate reads as over-eagerness" — which is the grounded
polarity. One polarity, stated, keeps the small-N sweep interpretable (E-014 discipline). The
inverse is named as a follow-up in `review.md`.

## D3 — N = 3, real recalibrated budgets, gates ON

`N = 3` per the ticket (cost-aware; survey/steer are heavy). Per-cast budget = each play's
**recalibrated** envelope (`target.play.budget`) — the run-probe lesson is that **budget, not
gates, is the dominant censor**, so starving the budget would manufacture an all-`budget-exhausted`
result that *looks* like inconsistency but is just starvation (an E-014-forbidden "confident guess
dressed as a measurement"). Gates **ON** — we measure the *delivered* consistency a user gets, and
the verdict is precisely about whether the gates over/under-fire.

**Rejected:** a token-capped "micro-sweep" to finish fast. It would budget-exhaust every cast and
mislead — worse than honestly deferring an arm. Rejected: N=5 (run-probe default) — too costly for
survey/steer at this stage; N=3 is the ticket's explicit cost-aware choice and matches E-016's N.

## D4 — Read expand's honest-empty from the raw `RunOutcome` tally, not the mix

The classifier folds expand/decompose STOP-abstentions into `budget-exhausted` (research §central
tension). So per play the note reads honest-empty from the **right denominator**:

- **survey / steer:** honest-empty rate **= the probe mix's `honest-empty` rate** (their marker is
  a `success`). Direct.
- **expand:** honest-empty bucket is structurally 0 in the mix; its honest abstentions appear as
  **`gate-failed` in the raw tally**, disambiguated from genuine budget-blow (`budget-exhausted`
  in the tally) and from timeouts. The per-cast andon line names the stopping gate. So expand's
  honest-empty rate = `gate-failed-with-honest-empty-reason / N`, read from the live log.

This asymmetry is itself a **finding** (the 3-bucket probe has a blind spot for STOP-style plays)
and a candidate kaizen signal: *thread the gate stop-reason onto `RunSummary` so the probe can
split honest-empty from budget-exhausted for STOP plays.* Named in the note + `review.md`.

**Rejected:** widening `RunSummary` to carry the stop reason now (scope creep into the engine for
this sweep ticket; the raw tally already makes the truth recoverable — IA-8 honored).

## D5 — The verdict: a 3-branch rule, conditional, honest about the sample

Mirror E-014's machinery. The headline metric per play is **(a) run-to-run signal dispersion**
(0 = identical outputs across casts; →1 = the inconsistency the gates exist to bound) and **(b) the
outcome mix** (signal / honest-empty / budget rate). The verdict rule:

| Signal state (per play) | Verdict | Concrete next pull |
|---|---|---|
| low dispersion + signal-dominant mix | **consistency acceptable** | no tune; record the number; close E-019's *validate* half |
| high honest-empty rate on grounded input | **gates over-fire** | mint a `demand.md` signal: *tune the honest-empty gate (lower abstention threshold)* + `vend chain` pull string |
| high `budget-exhausted` rate | **budgets still off** | mint a `demand.md` signal: *re-recalibrate the play's budget envelope* (the E-018 recalibration pattern) |
| high signal dispersion (signals disagree) | **gates under-bind** | mint a `demand.md` signal: *strengthen the play's consistency gate* |

The verdict is stated bolded up front, and — per E-014 — **"not-yet-measured" is distinct from
"weak"**: an arm left for the human at-sweep run is reported as *pending*, never as a fail. If the
verdict is "tune the gates", it names the concrete next signal bridging to `demand.md` (AC#3).

## D6 — Run live, prioritizing the highest-value arm; the note stands either way

Launch the live sweep in the background **expand first** (cheapest; the direct E-016 confirm/refute
— the single highest-value measurement), then survey, then steer as time/quota allow. The findings
note folds in **real numbers as arms complete** and reports any uncompleted arm as *pending the
at-sweep human run* (AC#4) with the exact command to produce it. This satisfies AC#1 ("results land
in a findings note") for the arms that complete while honoring AC#4's human-verification carve-out
and the E-014 honest-sample discipline — no fabricated numbers, no silent gaps.

**Rejected:** blocking the whole ticket on a complete 2.85M-token run (fragile: nine nested
long-running agents; one timeout shouldn't sink the deliverable). Rejected: skipping the live run
entirely and shipping only a framework (under-delivers AC#1 when the cheapest arm is runnable).

## D7 — Findings note shape = the E-014 `findings.md` template

`docs/active/work/T-019-02/findings.md`: framing blockquote → `## TL;DR — the verdict` → `## The
numbers` (one fenced `formatConsistencyReport` line + raw tally per play) → `## The decision`
(verdict + the D5 rule table + named next pull) → `## Honest about the sample` → `## How to
produce the numbers` (the exact `bun run` commands) → `## Citations`. This is the artifact AC#1/#2/#3
are graded against; it lives beside the RDSPI phase artifacts in the same work dir.

## Decision summary

| # | Decision |
|---|---|
| D1 | Extend the harness target table only; core/variance/run-probe untouched |
| D2 | Fixed grounded inputs (real demand present); honest-empty = over-eager false negative |
| D3 | N=3, real recalibrated budgets, gates ON (no starvation) |
| D4 | Expand honest-empty read from raw `gate-failed` tally, not the mix (a finding + kaizen) |
| D5 | 3-branch verdict rule; "not-yet-measured" ≠ "weak"; names the demand.md bridge |
| D6 | Run live expand-first in background; note folds real numbers, defers arms honestly |
| D7 | findings.md in the E-014 shape |
