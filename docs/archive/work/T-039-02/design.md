# T-039-02 — Design (decisions for an honest settle)

Six decisions, each grounded in Research. The shape is fixed by precedent (T-037-03): an audit read
→ a one-page `verdict.md` → a `demand.md` crystallization. The judgment is in *what we are allowed to
claim* and *how we count*.

## Decision 1 — Count "cleared" as `intervened:false` ∧ `outcome:success`, not "untouched"

**Chosen.** The audit's walk-away "untouched" (`intervened:false`) is necessary but **not
sufficient** for a clear. A `timed-out` record is untouched yet censored. The headline E-039 claim
("the loop now *clears*") must rest on the intersection with `outcome:success`.

- **Cleared forward-E1 records = 4** (ledger 30–33), the **first ever** (baseline was 0 cleared).
- At the **pull** level = **2 cleared pulls** (init, doctor), each = propose + decompose.
- *Rejected:* reporting the forward walk-away 88% (7/8) as "the clear." That conflates *refusing
  cleanly* with *clearing* — the precise T-037-03 caveat ("untouched ≠ cleared"). 7/8 includes the
  2 censored T-037 priors; only 4 are genuine clears.

## Decision 2 — Cite forward-only; the combined 95% (20/21) appears once, to be excluded

**Chosen.** Mirror T-026-04/T-037-03 exactly. The verdict's numbers are **forward (live): 88% (7/8
untouched), 4 cleared**. The combined `95% (20/21)` is named **once**, explicitly to say "this pools
13 attested back-fill — NOT a forward read; citing it as forward is the T-026-04 over-count." This
discipline is the whole point of the E-028 split; the settle must model it.

## Decision 3 — Clear-quality verdict: **sound/grounded**, a real upgrade over T-037-03's "undemonstrated"

**Chosen.** T-037-03 had to say clear-quality was *undemonstrated* (nothing minted — the cast
time-censored before materializing). E-039 minted two cards we can actually inspect:

- **E-040 `vend-init-scaffold`** and **E-042 `vend-doctor-preflight`** — both **concrete Frontier-7
  product demand** (straight from the PRD), each fully decomposed (2 stories + 4 tickets), DAG valid,
  `lisa validate` green. Grounded, not self-referential meta-epics.
- The sweep's *board #1* was self-referential, but it was **re-pointed** before casting, so **what
  cleared is grounded.** The degeneracy is a ranker-input finding, not a property of the cleared work.

So clear-quality reads **sound** — the first time the project has watched the loop clear *grounded*
work, not merely refuse. *Rejected:* calling it thin because the board ranker misbehaved — that
conflates the input signal with the cleared output.

## Decision 4 — Adjudicate the E-041 orphan by **deleting it** (board hygiene this settle owns)

**Chosen.** T-039-01's review explicitly hands T-039-02 "(a) delete the E-041 orphan during the
settle." Verified safe: E-041 is **childless** (no story/ticket references it — grep NONE), a
**duplicate title** of E-042 (`vend-doctor-preflight`), **not in the ledger**, not in the sweep's
effect log. The board should reflect *exactly what cleared* (the trust contract); a stray second card
for one signal violates that. Delete it, then re-run `lisa validate` to confirm still green.

- *Rejected: leave it and only flag.* It is overproduction sitting on the trust board; the settle is
  the right place to remove it, and it is cheap + reversible (untracked file).
- *Carry forward (not in scope to fix here):* an **idempotent-mint guard** in `propose-epic` so an id
  double-allocation can't leave a stray card. Flagged in the verdict as a follow-up, not built.

## Decision 5 — The go: **watched CLEARING, provisional + forward-leaning** — never "forward-confirmed"

**Chosen.** Two independent claims, kept separate (the T-037-03 pattern):

1. **CLEARING (earned, new).** Upgrades T-037-03's "watched *refusing*". The macro-wallet cleared 2
   real pulls of grounded work on a bounded walk-away; `propose-epic` **finished** (93 s/83 s) past
   the wall that censored E-037 — **E-038 proven live, in flight.** P7 + auth==exec held.
2. **NOT forward-confirmed (load-bearing non-goal, held).** 2 cleared pulls / 4 cleared forward
   records is **not** the ≥10 bar. Declaring confirmation off one sweep is the exact E-026 trap. The
   go stays **provisional + forward-leaning**, now on **cleared** (not censored) evidence.

## Decision 6 — Name the cadence in two honest denominations

**Chosen.** Avoid a single misleading number. State both:

- **Forward sample → ≥10 reports (the KR1 count, the lineage T-037-03 tracked):** **4/10 → 8/10**
  this sweep (+4 forward records). **+2 reports to the bar** (≈1 more cleared pull).
- **Cleared forward records (the quality bar the prior 4 censored records never met):** **0 → 4.**
  Since the standard is ≥10 *genuine* (and the prior 4 were censored), the deeper cadence is **4 → 10
  cleared, ≈ +3 cleared pulls.**

The first cleared pull is the first installment; the cadence is **+N more `--no-intervened` sweeps**,
not a single epic. Graduation to "forward-confirmed" only when genuinely earned — explicitly not now.

## What this settle is NOT

- Not a re-run of the sweep (T-039-01 owns that; this reads its ledger).
- Not an epic-quality review of E-040/E-042's internals (downstream of whoever pulls them).
- Not building the idempotent-mint guard or the ranker demotion (both flagged as follow-ups).
