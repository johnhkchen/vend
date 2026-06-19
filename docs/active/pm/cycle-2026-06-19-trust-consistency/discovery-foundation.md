# Discovery — Vend's foundation

**Date:** 2026-06-19 · **Product stage:** built prototype, **demand unvalidated** (self-hosting only; no external users) · **Discovery question:** *Is Vend's core bet — author a gated playbook once, then trust autonomous budgeted runs — desirable, usable, and defensible beyond its author?*

> Run via `/discover` (full cycle: brainstorm → assumptions → prioritize → experiments).
> This is **upstream of the demand board**: discovery surfaces the foundational
> assumptions worth de-risking; validated learning becomes signals on `demand.md` (and
> the bridge at the end maps them). It does **not** promote anything.

## Go-and-see — what's actually true today

- **Built and self-hosting.** The clearing pipeline runs a full lap on Vend itself
  (`vend chain <signal>` → epic → tickets, gated/budgeted/logged); E-001…E-013 done.
- **The only "user" is the author, on one repo.** Every run to date is Vend decomposing
  its *own* board. Demand outside this loop is **unobserved**, not validated.
- **Surface is CLI-only.** No TUI; the IA spine (Home/Counter/Ledger, the andon language)
  is captured but unbuilt — so the two-gesture experience users would judge doesn't exist yet.
- **Run log = ~10 records, cold-start regime.** Budget calibration runs on priors, not
  measured tails. "Trust the autonomous budget" is asserted, lightly evidenced.
- **The executor is also a competitor.** Claude Code (the executor Vend orchestrates) is
  itself growing subagents, hooks, and orchestration. P6 (executor-agnostic) is a design
  stance, unproven on a second executor. This is the existential foundation risk.

---

## Step 2 — Ideas explored (divergent)

Candidate **wedges / foundational bets** — the specific first-user + first-value framings
that would *prove* the foundation. Across PM / Designer / Engineer lenses.

| # | Lens | Idea (wedge / bet) |
|---|------|--------------------|
| 1 | PM | **Self-hosting-as-proof wedge.** First customer = teams building software with AI agents; the proven playbook (`chain`: signal→epic→tickets) is the demo. Dogfood metrics *are* the demand evidence. |
| 2 | PM | **"Vibe-coder" trust wedge.** Solo builders shipping AI-written apps who can't review everything — sell *gates as trust* (cf. the `pm-ai-shipping` family: ship-check, security/perf audits as playbooks). |
| 3 | PM | **Agency expertise-capture.** Encode a senior's judgment into a playbook; juniors + agents run it. Value = reusable expertise (P1), buyer = services firms scaling headcount with agents. |
| 4 | PM | **Playbook exchange.** Author once, share/sell playbooks → network-effect foundation and a defensibility story beyond one user. |
| 5 | Designer | **Onboarding *is* the core loop.** Run-0 casts Survey on the user's own repo (IA-3); the product teaches itself by running, no tour. The first 60 seconds *are* the value demo. |
| 6 | Designer | **Andon as the hero moment.** The gate-stop (a *successful refusal*, IA-9) is when trust is earned — design the whole experience around making that moment feel like the tool earning its keep. |
| 7 | Designer | **Recipe-grade authoring.** Make authoring a gated playbook feel like writing a recipe, not coding a typed graph — because the entire amortization math dies if authoring is too costly. |
| 8 | Engineer | **Second-executor proof.** Run one playbook on an open model to make P6 real, not asserted — directly attacks the platform-risk bet. |
| 9 | Engineer | **Gate library as the moat.** A reusable, composable gate set (committed, head-builds, structural, value) as the trust substrate competitors can't trivially copy. |
| 10 | Engineer | **Calibration dataset as the asset.** The run log (play × project × estimated × actual, IA-16) compounds into the data moat for trustworthy autonomous budgeting — the thing a tuning regime wants thousands of hours of. |

**Checkpoint (your call):** I've carried forward **#1, #5, #7, #8, #10** below — the
minimal set that stress-tests the *foundation* (demand, experience, authoring cost,
platform risk, defensibility). Swap any in/out and I'll re-run assumptions.

---

## Step 3 — Critical assumptions (the load-bearing bets)

Surfaced across Value / Usability / Feasibility / Viability / GTM. These are what must be
true for the foundation to hold — independent of any one feature.

| # | Assumption | Category | Tied to idea |
|---|-----------|----------|--------------|
| A1 | Users feel the "re-specify agent work every run" pain acutely enough to invest authoring effort up front. | Value | #1, #7 |
| A2 | Users will **trust autonomous gated runs enough to walk away** (P4) — gates substitute for supervision. | Value | #1, #6 |
| A3 | Authoring a gated playbook is **cheap enough that spec-once nets positive** before users churn. | Usability | #7 |
| A4 | A **two-gesture** run is genuinely sufficient — users don't *want* to tweak/converse at the counter (N1/P2). | Usability | #5 |
| A5 | Gates can make probabilistic output **consistent at a rate users accept** — the core promise is deliverable. | Feasibility | #6, #9 |
| A6 | Budget envelopes calibrate well enough that **autonomous spend is trustworthy** (beyond a 10-run cold start). | Feasibility | #10 |
| A7 | There's a **willingness to pay / sustainable model** for a local-first, author-it-yourself tool. | Viability | #3, #4 |
| A8 | **Claude Code (and foundation models) won't absorb this orchestration layer** before Vend establishes a wedge. | GTM | #8, #9, #10 |
| A9 | You can **reach** the wedge users (agent-heavy builders) and convert them on the gates-as-trust story. | GTM | #1, #2 |

---

## Step 4 — Prioritized assumptions (Impact × Uncertainty)

The **leap-of-faith** assumptions — high impact, high uncertainty — are where discovery
spend belongs. Ranked by test priority.

| Rank | Assumption | Impact | Uncertainty | Why it's the leap |
|------|-----------|--------|-------------|-------------------|
| **1** | **A2 — trust autonomous gated runs** | High | High | The whole product (P4) collapses to "a nicer prompt runner" if users won't walk away. *Partially testable on existing data.* |
| **2** | **A8 — platform doesn't eat the layer** | High | High | Existential. If Claude Code's own orchestration suffices, the wedge has to be the gates/dataset, not the runner. |
| **3** | **A3 — authoring nets positive** | High | High | The amortization is the business model; if authoring is too costly, spec-once never pays back. |
| **4** | **A5 — gates → consistency** | High | Medium | The core promise; *partly evidenced* by self-hosting, but never measured as variance-reduction. |
| **5** | **A1 — the pain is acute** | High | Medium | If the pain is mild, none of the above matters. Classic desirability root. |
| — | A4, A6, A7, A9 | Med/High | Lower (now) | Real, but downstream of a validated A1/A2/A3 and a chosen wedge. Defer. |

**Checkpoint (your call):** I'm proposing experiments for the **top 4 (A2, A8, A3, A5)**.
Tell me if A1 (raw desirability) should jump the queue — it's cheap to test and arguably
the true root.

---

## Step 5 — Validation experiments

Cheapest test that moves each leap. Sequenced by effort + dependency. Several exploit data
Vend **already** captures — the fastest possible learning.

| # | Tests | Method | Success criteria | Effort | Timeline |
|---|-------|--------|------------------|--------|----------|
| E1 | **A2** trust | **Walk-away audit** of the run log: across the next ~15 self-hosted runs, measure andon-rate and how often the author *intervened mid-run* vs let it clear. | Interventions trend toward 0 as andon-rate sits in its IA-12 budget; author reports "I trusted it." | Low (data exists) | Week 1 |
| E2 | **A5** consistency | **Variance probe:** run one playbook 5× on a fixed input, with and without gates; diff the materialized output. | Gated runs show materially lower output variance than ungated — quantified, not asserted. | Low–Med | Week 1 |
| E3 | **A3** authoring cost | **Author-2-strangers test:** author 2 playbooks for a *non-Vend* repo/domain; log author-time and compute runs-to-breakeven. | Breakeven ≤ ~5 runs; authoring feels "recipe," not "framework." | Med | Week 1–2 |
| E4 | **A8** platform risk | **Competitive teardown** of Claude Code's subagent/hook/orchestration trajectory + a 1-page positioning memo: *what Vend has that the executor structurally won't.* | A defensible wedge survives the teardown (gates + calibration dataset + executor-agnosticism), or we pivot the bet. | Med | Week 1–2 |
| E5 | **A8/P6** | **Second-executor spike:** cast one existing playbook through a non-Claude executor end-to-end. | One playbook clears on a second executor with gates intact — P6 proven, not asserted. | Med–High | Week 2–3 |
| E6 | **A1** desirability *(if promoted)* | **5 problem interviews** with agent-heavy builders: do they re-specify every run? would they author to stop? | ≥3/5 name the pain unprompted and would invest authoring time. | Med | Week 2 |

### Experiment detail (the two that pay back fastest)

- **E1 — Walk-away audit.** Vend's run log already records success/censored/andon and cost
  per run (the IA-13/E-013 substrate). The hypothesis: *trust shows up as declining
  mid-run intervention.* No build needed — instrument the existing log + a short author
  self-report after each run. If interventions stay high, A2 is in trouble and the andon
  UX (idea #6) becomes the priority, not the wallet.
- **E2 — Variance probe.** The core promise is *consistency* (vision: "repeatability over a
  natively unrepeatable process"). It has never been measured. Five paired runs quantify
  the gates' actual variance-reduction — the single most important number for the pitch.

---

## Step 6 — Discovery timeline & decision framework

```
Week 1   E1 (walk-away audit) · E2 (variance probe) — both ride existing data/cheap runs
Week 2   E3 (authoring cost) · E4 (platform teardown) · E6 (interviews, if A1 promoted)
Week 3   E5 (second-executor spike) · synthesize → decision
```

**Decision framework**

- **E1 + E2 succeed** → the trust/consistency core holds → green-light the **macro-wallet**
  (proposed-batch #1) as the gesture that *capitalizes* on earned trust.
- **E1 fails (users intervene)** → trust isn't there yet → reprioritize the **andon UX +
  design-language** (proposed-batch #3) over the wallet; trust must precede walk-away.
- **E3 fails (authoring too costly)** → the amortization is broken → pull **authoring
  ergonomics** (idea #7) to the front of the roadmap; nothing else matters first.
- **E4/E5 fail (platform risk real, P6 vapor)** → pivot the foundation bet from "better
  runner" to **gates + calibration dataset as the moat** (ideas #9/#10); make
  executor-agnosticism a near-term proof, not a someday principle.

---

## Bridge — discovery → demand board

Discovery is upstream of `proposed-batch.md`. How the leaps map to staged signals:

- **A2/A5 validated** ⇒ strengthens the case for the **macro-wallet** (batch #1) — trust
  earned is trust worth spending autonomously.
- **A2 weak** ⇒ promotes **design-language + the Counter/andon UX** (batch #3/#4) above the wallet.
- **A8 (platform risk)** ⇒ surfaces a *new* signal worth staging: **second-executor proof
  (P6 made real)** — not currently on the board, and the single best hedge against the
  existential risk.
- **A6 (calibration depth)** ⇒ reinforces **IA-15 ledger-generates-demand** and longer run
  history as the data-moat play.

*New candidate signal this discovery surfaced (not yet staged):* **"P6 made real — cast one
playbook through a second, non-Claude executor end-to-end."** It directly de-risks the
foundation's existential assumption (A8) and is absent from the current batch.
