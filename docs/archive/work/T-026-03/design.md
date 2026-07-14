# T-026-03 — Design: how to read and report the one number

## The decision space is small (and that is the point)

This is an N2 read ticket. The "design" is not *what to build* but *how to read honestly*:
which slices to report, which tier's budget to read against, how to state the sample-size
trace, and how to characterize a trend driven by a single intervention without either
inflating or burying it. Each is a judgment call grounded in the Research findings.

## Decision 1 — Instrument: use the existing `vend audit`, write zero code

**Options considered:**

- **(A) Run the existing `vend audit` CLI and capture stdout.** ✅ Chosen.
- **(B) Write a small bespoke script that loads the ledger and prints a custom roll-up.**
  Rejected — it is a *new instrument*, the explicit N2 non-goal. It would also drift from
  the canonical numbers `formatWalkAwayFindings` produces (the ones T-014-03's note quotes).
- **(C) Hand-compute from `jq` over `runs.jsonl`.** Rejected as the *primary* read for the
  same reason, and because it would re-implement `auditWalkAway`'s censoring/half-split logic
  by hand (error-prone). Used only as a **cross-check** of the carrier count and provenance,
  not as the reported number.

**Why A:** the AC literally says "`vend audit` output … is captured." The instrument is the
contract; reading it verbatim is the deliverable. Authoring is paid once (T-014-01); this run
is the two-gesture transaction the vision promises.

## Decision 2 — Which slices to report

The headline is **all plays, standard tier** (the default `vend audit`), because that is the
whole-ledger walk-away contract and the default a user gets. But three supporting slices
sharpen it:

- **`--tier keystone`** — the macro-wallet keystone (E-014's actual target) tolerates only a
  5% andon budget. Reporting it states the rate against the *strictest* relevant budget, which
  is the honest bar for "can the author walk away from the keystone."
- **`decompose-epic`** — the forward `vend work` arm T-026-02 wired. Its slice (83% walk-away,
  50% andon over 12 runs) is where the genuine accrual lives; reporting it shows the rate the
  sprint's own instrument produces, not just the blended whole.
- **`propose-epic`** — the chain's other arm (100% walk-away, 4/4). Reporting both arms keeps
  the "two carriers per signal" caveat visible rather than hidden in the blend.

**Rejected:** reporting *every* play slice (expand-fragment, survey, steer each have ≤3
carriers) — too thin to mean anything individually; they are better left in the blended total
and the provenance list. Reporting only the headline — loses the keystone bar the sprint
cares about. The four-slice set is the minimum that states the number against the right budget
without padding.

## Decision 3 — Which number is "the walk-away rate"

The instrument reports **walk-away rate = 1 − intervention rate** ("ran untouched"). The
headline number is **93% (14/15 carriers ran untouched)**. This is the number reported,
verbatim from the instrument — not a recomputation. The single intervention is the lone
`decompose-epic` budget-exhausted carrier.

**Decision:** report the walk-away framing (93%), not the intervention framing (7%), because
the instrument's own headline and the trust contract ("can the author walk away") are stated
that way, and the target is "→ 100%."

## Decision 4 — How to state the trend honestly

The instrument splits the 15 carriers in half and reports earlier→recent: **100% → 88%**
(walk-away), i.e. the rate moved *away* from the 100% target. The naïve read is "trust is
regressing." The honest read, grounded in Research:

- The entire downward move is **one** `intervened=true` carrier landing in the recent half.
  With n=15 and a single intervention, the trend is **noise-dominated**, not a signal of
  regression. One real step-in among recent sessions is exactly the kind of honest event the
  self-report exists to capture — it is the instrument working, not trust eroding.
- **Decision:** report the trend verbatim (100% → 88%) **and** annotate it as thin /
  single-event-driven. Do **not** restate it as a regression, and do **not** suppress it.
  This mirrors the module's own honesty discipline (IA-8: a guess never reads as an earned
  number) applied to the trend rather than the rate.

## Decision 5 — Stating the rate against the IA-12 andon budget

The AC requires the rate be "stated against the IA-12 andon budget." The instrument does this
natively: **andon 40% vs 10% standard (⚠ over)**, **vs 5% keystone (⚠ over)**. The design
choice is *how to characterize "over budget"*:

- Per the module doc and IA-10/12, the andon rate is a **budget read, not a defect count** —
  "gates working, not defects." But 40% is *well* over even the leaf 25% budget, so honesty
  requires more than "it's fine."
- **Decision:** state it as the instrument does (over budget at every tier) and explain *why*
  without alarming: 7 of the 25 stops are **censored** (budget-exhausted/timed-out) — envelope
  walls from a young instrument being exercised under tight/probe budgets, plus 3 gate-failures
  — not quality defects in delivered work. The walk-away rate (the trust contract) is high and
  independent of the andon rate (different denominator, Decision in Research). Both truths
  stated side by side, neither used to excuse the other.

## Decision 6 — Sample-size traceability

**Decision:** state the headline sample as **15 carriers ≥ the ≥10 bar**, and back it with
the line-by-line provenance in `audit-output.txt` (each carrier's timestamp/play/outcome) plus
the cross-link to T-026-02's wiring (commit `4bd90d3`) and sweep protocol. Explicitly note the
"≥10 carrier *records*, not 10 invocations" caveat so the trace is honest, not inflated.

## What "done" looks like

The captured `vend audit` output (`audit-output.txt`) plus a findings write-up that: reports
the 93% walk-away rate and 100%→88% trend; states the andon rate against the IA-12 budget at
standard and keystone; traces the 15-carrier sample to T-026-02; and flags the thin-trend and
over-budget-andon honestly. No code, no ledger writes, no new instrument.
