# PRD — Trust & Consistency Evidence Gate

> **A note on scope.** This is a PRD for a *measurement* initiative, not a feature. The
> source `brief.md` calls itself "the anti-PRD" on purpose. So this document stays
> deliberately lean: the "product" is **two numbers and a decision**, and the only thing we
> build is the minimum needed to measure them. Guided by `brief.md`; grounded in
> `discovery-foundation.md`, `triage-report.md`, `sprint-plan.md`.

---

## 1. Summary

Before Vend builds its next big feature (the "2-hour macro-wallet" that spends a budget
down on its own), we need to know two things are actually true. First: **do people trust
Vend enough to walk away and let it run?** Second: **do the quality gates really make the
output more consistent?** This initiative measures both — cheaply, from data Vend already
keeps — and turns the answer into a clear go / don't-go decision.

## 2. Contacts

| Name | Role | Comment |
|------|------|---------|
| John Chen | Author · owner · decision-maker | Sets the roadmap; the evidence here decides the next build. Also the human whose "walk-away" behavior E1 measures. |
| PM agent | Product / planning | Wrote this PRD and the brief; will read the findings into the next batch. |
| Executor (lisa / Claude Code) | Runs the work | Runs the ≤5 measurement casts and the analysis. |

## 3. Background

**The context.** Vend is built and runs on itself. Its big promise is that you **author a
job once, then let it run on its own** — the gates keep the output trustworthy so you don't
have to watch. The whole roadmap points at one next feature: a wallet you fill with a
2-hour budget that Vend spends down by itself. Everything needed to build it just landed
(measured budget prices, epic E-013).

**Why now — and the catch.** Discovery found a gap. The roadmap keeps **building more
"leave it alone" power**, but no one has **checked whether "leave it alone" is even
trusted yet.** Two beliefs are doing all the load-bearing and neither is proven:

- We *assume* the gates earn enough trust that the author walks away.
- We *assume* the gates make probabilistic output consistent — the core promise — but this
  has **never been measured.**

Both are testable right now, for almost nothing, against data Vend already records. Until
they read green, building more autonomy is building on sand.

## 4. Objective

**Decide the next build on evidence, not assumption** — within a half-block budget.

Produce the two numbers (trust, consistency), read them honestly, and return a clear
recommendation: green-light the macro-wallet, or reroute the roadmap.

**Key results (SMART):**

- **KR1 — Capture trust.** Add a *minimal* way to record whether the author stepped in
  during a run (a one-line "did you intervene?" or an `intervened` flag in the run log).
  Record it for at least **10 consecutive runs** this sprint.
- **KR2 — Report the walk-away rate.** State the % of runs that finished with **zero
  mid-run intervention**, plus the trend, alongside the andon rate vs its IA-12 budget.
- **KR3 — Measure consistency.** Run **one playbook 5× with gates and 5× without** on a
  fixed input; report the **gate-driven variance reduction** as a single number.
- **KR4 — Deliver the decision.** A one-page findings note returning **go / reroute**,
  produced with **≤5 cheap casts** inside the ~0.5-block envelope.

**How it aligns.** This is the project's North Star (trusted autonomous runs) and this
quarter's one metric that matters (walk-away rate) made real for the first time. It serves
the charter's core promise — consistency you can count on (P3, P4).

## 5. Market segment(s)

We build this for **the agent-orchestrating builder (S1)** — the person who runs AI agents
and wants to hand off work and walk away. Their job-to-be-done is *"dispatch trustworthy
work and stop babysitting it."* This initiative tests whether Vend actually does that job.

Right now there is exactly one such user — the author, on this repo. That is a real
constraint: the sample is tiny and the "walk-away" judgment is self-reported. We accept
that. A directional signal from one honest user beats a confident guess from none.

## 6. Value proposition(s)

**The job this evidence does:** stop the team from building the wrong thing next.

- **Pain it removes:** spending a big build budget on the macro-wallet only to learn the
  trust it assumes was never there.
- **What we gain:** the **single most important number for Vend's pitch** — how much the
  gates actually reduce output variance. The core promise, finally quantified instead of
  asserted.
- **Better than the alternative:** the alternative is to build the wallet and find out
  later. This finds out **first**, for a fraction of the cost.

## 7. Solution

Keep everything minimal. The brief is explicit: measurement, not a framework.

### 7.1 Flows (not UX — there is no new screen)

- **Trust capture (E1):** when a run ends, the author records one bit — *did I step in, or
  did I let it clear?* Either a quick prompt on stop, or an `intervened` field written to
  `.vend/runs.jsonl`. Nothing more.
- **Consistency probe (E2):** pick one playbook and one fixed input. Run it 5× with gates
  on, 5× with gates off. Compare the outputs. If there is no "gates off" path yet, the
  minimal step is a `--no-gates` run mode, or compare against the raw dispense. Do not
  build more than that.

### 7.2 Key features (all minimal)

1. **Minimal intervention capture** — one flag or one self-report line per run.
2. **E1 analysis** — over `.vend/runs.jsonl`: andon rate vs the IA-12 budget, outcome mix
   (success / censored / budget-exhausted), cost vs envelope, and the walk-away trend.
3. **E2 variance harness** — 5× paired runs; diff the materialized output; one number out.
4. **Findings note** — two numbers, a one-paragraph read, a go / reroute call.

### 7.3 Technology (only what's relevant)

The run log (`.vend/runs.jsonl`) is the substrate; `run-log.ts` / `recalibrate.ts` already
read it. E2 needs a small `--no-gates` switch or a raw-dispense comparison. No new
services, no schema overhaul — one optional field and one run flag.

### 7.4 Assumptions (flagged for validation)

- **A2** — trust shows up as *intervention trending to zero* while andon stays in budget.
- **A5** — gates *do* reduce output variance (the thing we're measuring; could come back flat).
- One self-reporting user is an honest enough signal to steer on.
- 5 paired casts give enough contrast to read a variance difference.
- The author will report intervention truthfully (it's their own decision being measured).

## 8. Release

**V1 (this initiative, ~0.5 block):** intervention capture + E1 analysis + E2 variance
probe + the findings note. That's the whole release. The deliverable is **evidence**.

**What V1 gates (next, separate work):**
- **E1 + E2 green** → build the macro-wallet as *trust capitalized*.
- **E1 weak** (author keeps stepping in) → reroute to the **andon UX / design-language**
  first — trust must come before walk-away.
- **E2 weak** (gates don't reduce variance) → fix the **core consistency promise** before
  scaling autonomy at all.

**Future versions (out of scope here):** the macro-wallet build itself; turning intervention
capture into a permanent auto-signal (IA-15, the ledger generating demand); the **P6
second-executor** proof and the **pricing/WTP** probe — both their own briefs.

**Explicitly not in this release:** any feature build, any framework, anything beyond ≤5
cheap casts. If it starts to grow, that is the scope creep this PRD exists to prevent.
