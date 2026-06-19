# Value proposition — Vend

**Date:** 2026-06-19 · 6-part JTBD template (customer-first) · three candidate segments
from `discovery-foundation.md`. **Honest caveat:** these articulate the *intended* value;
the desirability assumptions underneath (A1 pain, A2 trust, A3 authoring cost) are **not
yet validated** — see the assumptions note per segment and the discovery experiments.

Anchored in the vision's **two pains**: *supervision doesn't scale* (you become a
babysitter; attention caps at 3–5 agents) and *expertise isn't reusable* (you re-specify
every run). The one line: **Vend turns you from the thing *in* the loop into the thing that
*designs* the loop.**

---

## Segment 1 — The agent-orchestrating builder *(primary wedge)*

A technical builder already running Claude Code who has hit the **supervision ceiling**.

1. **Who** — A developer/technical builder, comfortable in a terminal, local-first by
   preference, who already runs one or more coding agents and wants to run *several* —
   but their own attention is the bottleneck.
2. **Why** *(the job)* — Dispatch repeatable, trustworthy agent work and **walk away**;
   turn recurring multi-step agent tasks into things they reorder *by name*, not re-specify.
3. **What before** — Babysitting the agent: approving every step, re-explaining their
   process each run, hand-checking output, re-pasting context. Output caps at 3–5
   concurrent agents because each needs a human. Their judgment is trapped in their hands.
4. **How** — Author a **playbook once** (process + judgment + **gates**, as typed
   code-as-config), shelf it, then **pick + budget + run**. Runs proceed against their own
   gates, not live approval (P4); the budget is a **hard contract** (P7); a gate-stop is an
   **andon** — a successful refusal, not a crash.
5. **What after** — Spec paid once, amortized across every future run. They become the
   thing that *designs* the loop. **Consistency over a probabilistic process** — "you got
   what you paid for" is enforced by the gates, not hoped for.
6. **Alternatives** — Raw Claude Code + a folder of markdown prompt files; bespoke shell
   glue; agent frameworks (LangGraph et al.) that are build-it-yourself and ship no gates,
   no budget-as-contract, no shelf. **Why Vend's better:** the gates make output
   trustworthy *without supervision*; the run is two gestures, not a conversation; it's
   local-first and owns its state.
   - *Rests on:* **A1** (the pain is acute), **A2** (gates earn walk-away trust). Both
     unvalidated → discovery E1 (walk-away audit) + E2 (variance probe).

---

## Segment 2 — The solo AI-app shipper *("vibe coder")*

Shipping AI-written apps fast, can't personally review everything, nervous about it.

1. **Who** — A solo or small-team builder shipping AI-generated apps quickly, who cannot
   review every line the agent produces and worries about shipping unvetted work.
2. **Why** *(the job)* — Ship with confidence: a trustworthy quality gate between "the agent
   wrote it" and "it's live," **without becoming a full-time reviewer**.
3. **What before** — A false choice: rubber-stamp agent output (risky) or audit everything
   by hand (slow, defeats the speed they came for). No repeatable quality contract — every
   ship is an ad-hoc judgment call.
4. **How** — Grab a gated playbook off the shelf (e.g. a ship-check, a security/perf audit,
   a decompose); the **gates refuse to hand over garbage** (the andon is the tool *earning
   its keep*, IA-9). Repeatable, named, budgeted — the same quality bar every time.
5. **What after** — A dependable quality floor on probabilistic output. The gate-stop reads
   as **reassurance**, not failure. They ship *faster and safer* — speed without the
   gnawing doubt.
6. **Alternatives** — Manual review (slow); generic CI (catches syntax, not *judgment*);
   trusting the model blindly (the status quo that scares them). **Why Vend's better:** it
   encodes *their* quality bar as **enforceable gates**, run autonomously.
   - *Rests on:* **A5** (gates actually produce trustworthy consistency). Partly evidenced
     by self-hosting; never *measured* → discovery E2.

---

## Segment 3 — The agency / consultancy *(viability play)*

A services firm scaling delivery with agents, wanting consistent, expertise-grade output.

1. **Who** — A consultancy/agency growing delivery with agents, wanting a senior's judgment
   to govern work that juniors and agents actually execute.
2. **Why** *(the job)* — **Capture and reuse expertise** — turn a senior practitioner's
   process into an asset the whole team (and its agents) can run, decoupling quality from
   *who's on the keyboard*.
3. **What before** — Expertise trapped in senior heads; delivery quality varies by staffing;
   standards re-explained every engagement; juniors and agents drift from the bar.
4. **How** — Seniors **author playbooks once** (judgment + gates); the team picks and runs
   them. **Craft-neutral** — a designer and a developer both have "plays." Consistency is
   the deliverable, not a hope.
5. **What after** — Repeatable, branded quality **independent of who runs it**; seniors
   *design loops* instead of doing every run; margin scales with agents, not headcount.
6. **Alternatives** — SOP wikis (not executable), training (slow, lossy), bespoke internal
   tooling (costly to maintain). **Why Vend's better:** it makes the SOP **runnable**, with
   gates that enforce it.
   - *Rests on:* **A3** (authoring nets positive) + **A7** (willingness to pay). Both
     unvalidated → discovery E3 (author-2-strangers) + a pricing probe.

---

## Value proposition statement *(primary segment)*

> **For builders running multiple AI agents who've hit the supervision ceiling, Vend is a
> local-first playbook vending machine that turns repeatable agent work into a two-gesture,
> gated run. Unlike babysitting Claude Code or wiring up your own agent framework, Vend's
> gates make the output trustworthy without you in the loop — so you design the loop instead
> of sitting in it.**

## Reusable statements

- **Marketing** — *Stop babysitting your AI agents. Author the work once, gate it, and grab
  it off the shelf. Vend makes "you got what you paid for" a contract, not a hope.*
- **Sales** — *Your attention caps out at 3–5 agents because each one needs you. Vend's
  gates replace your supervision, so your output scales with agents instead of with the
  hours you can stay in the loop.*
- **Onboarding** — *You just ran Vend on your own repo — pick, budget, go. That two-gesture
  run is the whole product. Author your first playbook and every run after is this cheap.*

---

## The differentiating factors *(value-curve axes vs. raw Claude Code / agent frameworks)*

The vision's design principles **are** the differentiators — the axes a Blue-Ocean value
curve would plot Vend high on where alternatives are low:

| Factor | Raw Claude Code | Agent frameworks | **Vend** |
|--------|-----------------|------------------|----------|
| Gates as enforceable contract (P3) | — | weak | **high** |
| Two-gesture run, no re-spec (P1/P2) | low | low | **high** |
| Budget as a hard contract (P7) | — | — | **high** |
| Autonomy without supervision (P4) | low | medium | **high** |
| Local-first, owns its state (P5) | medium | varies | **high** |
| Executor-agnostic (P6) | — | medium | **stated** *(unproven → discovery E5)* |

**The wedge to defend:** the **gates + the calibration dataset**. Raw executors are racing
to add orchestration (the A8 platform risk) — but *encoded quality gates as the contract*
and *a measured price per play* are the two things an executor doesn't structurally own.

---

## Bridge — value prop ↔ the PM desk

- The **primary segment (S1)** is the one Vend already serves (self-hosting). The fastest
  proof of this VP is **measuring** the trust + consistency claims it makes — `triage-report.md`
  Theme D (P1), discovery E1/E2. Don't market the claim before the number exists.
- **S3 viability** depends on **A7 (willingness to pay)**, which no experiment yet covers —
  a candidate to add to the discovery plan if monetization moves up.
- The differentiator table elevates **P6 (executor-agnostic)** from "stated" to a *proof to
  run* — reinforcing the **P6 second-executor signal** flagged in triage as missing from
  `proposed-batch.md`.
