# Brief — Trust & Consistency Evidence Gate

**Type:** work brief (lean — the anti-PRD; basis for an agent's work) · **Envelope:**
~0.5 feature-block · **Owner:** an agent + author self-report · **Date:** 2026-06-19

## Goal

Produce the two numbers that decide what Vend builds next — **is autonomy trusted**
(walk-away rate, A2) and **do gates actually make output consistent** (gate-driven
variance reduction, A5) — so the macro-wallet is built on *evidence, not assumption*.

## Why now — the through-line

The discovery's central finding: the roadmap over-indexes on *building* walk-away
autonomy (the macro-wallet) and under-indexes on *proving* walk-away is trusted. Both
bets are testable cheaply against data Vend already captures, and they **gate the
wallet**. Build nothing more autonomous until these read green. (`discovery-foundation.md`
E1/E2, `triage-report.md` Theme D, `sprint-plan.md` story #1 — all rank this first.)

## The work

**E1 — Walk-away audit (A2, trust)**
- From `.vend/runs.jsonl`: andon-rate vs the IA-12 budget, outcome distribution
  (success / censored / budget-exhausted), and cost-vs-envelope across recent runs.
- The key signal — **mid-run intervention rate**: how often the author stopped or steered
  a run vs let it clear. The log doesn't capture this yet → add a *minimal* forward
  capture (a one-line author self-report per run, or an `intervened` flag). Track the trend.
- **Trust shows up as intervention → 0 while andon sits inside its budget.**

**E2 — Variance probe (A5, consistency — the core promise, never measured)**
- Run one playbook **5× on a fixed input**, with and without gates; diff the materialized
  output. Quantify the **gate-driven variance reduction** (gated should vary materially less).
- Enabler note: if no gates-off path exists, the minimal step is a `--no-gates` run mode
  or comparing against the raw dispense. Keep it minimal — don't build a framework.

## Deliverables

A short findings note — the two numbers plus a one-paragraph read: (1) the walk-away /
intervention trend, (2) gated-vs-ungated output variance. **Evidence, not a roadmap.**

## The decision it gates (discovery's framework)

- **E1 + E2 green** → green-light the macro-wallet as *trust capitalized*.
- **E1 weak** (author keeps intervening) → reprioritize the **andon UX / design-language**
  over the wallet; trust must precede walk-away.
- **E2 weak** (gates don't reduce variance) → the core consistency promise needs work
  before scaling autonomy at all.

## Constraints / non-goals

- Ride existing run-log data + **≤5 cheap casts**. This is **measurement, not a build** —
  produce evidence, not features; ~0.5-block envelope; don't let it expand.
- **Out of scope:** the macro-wallet build (downstream of this evidence); the P6
  second-executor and pricing/WTP probes (separate briefs).
