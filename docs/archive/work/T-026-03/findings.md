# T-026-03 — Findings: the walk-away rate and its trend

> Read 2026-06-19 22:54 PDT against `.vend/runs.jsonl` (25 records, 0 skipped) using the
> existing `vend audit` instrument (T-014-01). No new instrument; no ledger writes. Raw
> output frozen in `audit-output.txt`.

## The one number

**Walk-away rate: 93%** — 14 of 15 self-reporting sessions ran untouched (the author funded,
walked away, and the run cleared without stepping in). All plays, the whole ledger.

```
E1 — walk-away trust · all plays · 25 runs [standard]
  walk-away rate: 93% (14/15 ran untouched) · trend 100% → 88% (target → 100%)
  andon rate: 40% vs 10% budget — ⚠ over (gates working, not defects)
  outcome mix: 15 success · 7 censored (budget/timeout) · 3 gate-failed · 0 id-collision
  cost vs envelope: tokens ×0.65 · time ×0.12 (median over 9 successful runs)
```

The lone intervention is a single `decompose-epic` run (budget-exhausted, the most recent
self-report block) where the author reported stepping in. Every other carrier is a clean
walk-away.

## The trend

**100% → 88%** (earlier half → recent half of the 15 carriers; target → 100%).

This moves *away* from the 100% target, but the move is **entirely one event**: the single
`intervened=true` carrier falls in the recent half. With n=15 and exactly one intervention,
the trend is **noise-dominated, not a regression** — it is the self-report instrument
correctly recording one genuine step-in, which is what it exists to do. The trend cannot yet
confirm *or* deny a "→ 100%" trajectory; that needs more `--intervened` sessions to populate
both halves with signal rather than a single data point.

## The rate against the IA-12 andon budget

Stated against the budget at both relevant tiers (the AC's explicit requirement):

| Tier | Andon budget (IA-12) | Observed andon rate | Read |
|---|---|---|---|
| standard (default) | 10% | **40%** | ⚠ over |
| keystone (E-014 macro-wallet target) | 5% | **40%** | ⚠ over |

The andon rate is **over budget at every tier**, including leaf (25%). Read honestly, per the
instrument's own framing (IA-10/12 — "gates working, not defects"):

- The 40% is **10 non-success stops out of 25 runs**: **7 censored** (budget-exhausted /
  timed-out — envelope/wall-clock walls) + **3 gate-failed**. None is a defect in *delivered*
  work; they are the gates and budgets doing their job on a young instrument exercised under
  tight probe budgets (several carriers ran on deliberately small `--budget` sweeps).
- Critically, the andon rate and the walk-away rate have **different denominators**: andon is
  over all 25 runs; walk-away is over the 15 self-report carriers only (absence of the bit
  reads as unknown, never as a walk-away). So "40% andon" and "93% walk-away" are both true
  and not in tension — they measure different things over different samples.

The honest one-liner: **the author could walk away from 93% of self-reported sessions, while
the gates stopped 40% of all runs before completion** — high trust *and* an active andon rate,
which is the healthy shape the trust framing predicts, just well above the nominal budget on
this still-small, probe-heavy sample.

## The forward `vend work` arm specifically

The `decompose-epic` slice — the arm T-026-02 wired the bit through — read on its own:

```
E1 — walk-away trust · decompose-epic · 12 runs [standard]
  walk-away rate: 83% (5/6 ran untouched) · trend 100% → 67% (target → 100%)
  andon rate: 50% vs 10% budget — ⚠ over
```

This is where the single intervention lives, so its trend (100%→67%) is the same one event
amplified by the smaller n (6 carriers). The `propose-epic` arm is 100% (4/4). The two arms
together are the "two carriers per cleared signal" structure T-026-02 documented.

## Sample-size traceability

**15 carriers ≥ the ≥10 bar** the AC requires. Provenance (full list in `audit-output.txt`):
each carrier is a real cast with a timestamp, play, and outcome, line-traceable in
`.vend/runs.jsonl`. The carriers are genuine product use — `propose-epic`, `decompose-epic`,
`expand-fragment`, `survey`, `steer` — with real envelopes (cost block: ×0.65 token median
over 9 successful runs), **not** padded 1-token andons (the failure mode T-026-02 and
T-026-01 review #2 forbade).

The trace to T-026-02: that ticket wired `intervened` through `vend work` (commit `4bd90d3`)
and flagged only **2** genuine forward carriers at handoff, with `sweep-protocol.md` defining
the 2 → ≥10 accrual path. Genuine sessions have since accrued to **15**. Honest caveat: one
self-report stamps both the propose and decompose record of a chain, so "15 sessions" = **15
carrier records, not 15 separate invocations**.

A second honesty note: 14 of 15 carriers are `intervened=false`. The self-report sample is
**homogeneous** (one step-in). The rate is genuine, but a → 100% *trend* read wants a richer
mix of `--intervened` sessions; today's trend rests on a single bit.

## Bottom line for E-014

E-014's HOLD was waiting on genuine E1 measurement data (the walk-away rate read from real
sessions, not thin probes). **That precondition is now met:** the rate (93%) is readable from
15 genuine carriers ≥ 10, stated against the IA-12 budget at standard and keystone. The number
is favorable to the trust contract. The one caveat the verdict-reader must carry forward: the
**trend** is not yet established — it is one intervention against fourteen walk-aways, so
"trends toward 100%" can be neither claimed nor refuted until more `--intervened` sessions
accrue. The rate is a real read; the trajectory is still thin.
