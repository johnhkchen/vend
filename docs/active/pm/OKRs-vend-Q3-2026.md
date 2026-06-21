# OKRs — vend — Q3 2026 (three alternatives)

> **Desk-only strategy artifact** (per `README.md` — staging, not a pull). Three distinct, ambitious
> OKR sets to spark a focus decision, each laddering to `product-strategy.md` (North Star =
> *cleared runs that pass gates without intervention*; OMTM = *time-to-first-driven-board for a
> non-dev*) and answering one of the canvas's three strategic thrusts. Per *Radical Focus*, the team
> picks **one** as the quarter's single inspiring goal — these are alternatives, equally weighted, not
> a portfolio. Targets set at ~60–70% confidence. Nothing promoted.

**Relationship to the metrics stack (not alternatives to each other):** the **North Star** (cleared-
without-intervention) is the long-run KPI all three serve. Each set's **KRs** are the quarter's
measurable movements — some are NSM input metrics (Set A), some are activation/adoption metrics (Set
B), some are capability/health metrics (Set C). Health metrics (gates-working andon rate, cost-vs-
envelope) balance every set so we don't win one KR by breaking the contract.

---

## Set A — Prove the autonomy keystone

**Objective.** Make "you got what you paid for" *provable*: vend runs unattended, the gates hold, and
the budget contract is honored both ways — moving the macro-wallet from *provisional* to **confirmed**.

**Key Results**
- **KR1 — Cleared forward-E1 records reach ≥10** (from ~4 today), the bar that flips the macro-wallet
  go from provisional to confirmed.
- **KR2 — Walk-away rate ≥90%** (runs that complete *untouched*) sustained over **≥20 cleared runs**,
  with the andon rate read as *gates-working*, never a defect count (IA-10/DL-8).
- **KR3 — Budget contract honored:** median spend ≤**1.0× tokens** and ≤**1.0× wall-clock** vs. the
  quoted envelope across cleared runs (P7 cuts both ways — no silent overruns, no fat padding).

**Rationale.** This is the headline promise and the North Star made countable. The canvas calls trust
the strongest macro tailwind (survey-proven verification collapse) — but vend's own trust is still
*provisional* (cleared records below the ≥10 bar). Confirming autonomy is the precondition for selling
consistency to anyone. *Mostly instrumentable today* — the ledger already emits these (walk-away rate,
outcome mix, cost-vs-envelope). **Data caveat:** KR2 needs ≥20 *real* cleared runs this quarter; if the
board runs dry, runs must be driven (which is also Set B's job — the sets compound).

## Set B — Open the non-dev channel

**Objective.** Get a *second person* — a non-developer — to install vend, drive their *own* project,
and reach a board they can act on, in one short session. Convert the riskiest strategic hypothesis from
belief to evidence.

**Key Results**
- **KR1 — Time-to-first-driven-board ≤1 short session** (target **≤30 min**) for a non-dev on the
  hackathon example: from `vend init --template` to a *reviewed, ranked* board, writing no code (PRD KR2).
- **KR2 — ≥1 example ships a gold-mastered `EXPECTED-OUTCOME`** that re-drives **within tolerance** on
  a clean clone — the consistency promise made re-runnable (PRD KR3).
- **KR3 — The E-055 SVG clears the "good enough" bar:** **≥4 of 5** on the rubric (comprehension ·
  structure · density · language · navigability) from a real non-dev pointing it at a real board.

**Rationale.** The canvas names this the **riskiest must-be-true**: the *push* into AI agents is
[S]-proven, but non-dev *pull* for an orchestration tool is still hypothesis. It's also the OMTM and the
engine of the North Star (every driven board produces cleared runs that feed Set A). **Data caveat:**
KR1/KR3 require *recruiting a real non-dev driver* (the hackathon pair) — the biggest data-availability
gap; a dogfooded proxy is weaker evidence and should be labeled as such.

## Set C — Earn the moat: installable *and* executor-agnostic

**Objective.** Make vend installable like lisa, and *prove* it isn't chained to one executor — shipping
the two structural hedges (P5 distribution, P6 neutrality) the macro analysis demands before the
platform closes the window.

**Key Results**
- **KR1 — One-command install to doctor-clean:** `brew install` (or the shell installer) stands vend up
  on a **fresh machine** to **`vend doctor` green** across all target platforms (PRD KR1; the `dist`
  JS-mode path, spike-proven).
- **KR2 — Open-model executor clears a real cast:** the agentic open-model runner clears **≥1 real graph
  cast end-to-end** (P6 proven at *parity*, not just in architecture).
- **KR3 — Executor-swap is config-only:** the **same playbook** clears on both the Claude executor and
  the open-model executor with **zero playbook edits** — the neutrality moat demonstrated, not asserted.

**Rationale.** The canvas's #1 threat is the executor (Claude Code) absorbing orchestration; the #2
economic risk is the Claude subscription seam. KR2/KR3 are the **moat** (executor-agnostic neutrality
the executor structurally can't copy); KR1 is the **channel** (installable). **Data caveat:** KR2/KR3
need a working open-model endpoint configured; KR1 needs the five-target cross-compile (the spike proved
only the host target — assumption A1).

---

## How they ladder (and which the canvas points at)

| Set | Canvas thrust | Metric type | Readiness |
|---|---|---|---|
| **A — autonomy keystone** | The North Star itself | NSM input metrics | Highest — ledger already instruments it |
| **B — non-dev channel** | The OMTM + riskiest hypothesis | Activation/adoption | Needs a real driver (the gap) |
| **C — moat + install** | Defensibility (P5/P6 hedges) | Capability/health | Needs open-model endpoint + cross-compile |

**The canvas's own sequencing** is *author (have) → operator (ship onboarding) → designer (ship
surface)*, with the OMTM pointing at **Set B** as this quarter's focus — it's the one that *also* feeds
Set A (driven boards → cleared runs) and gives Set C something worth installing. But **A** is the more
*conservative, fully-instrumentable* bet (no recruiting risk), and **C** is the most *strategically
urgent* if the platform-absorption clock is ticking faster than adoption. That's the real focus tension
to resolve — not which is "better," but **which risk the quarter should buy down: unproven trust (A),
unproven channel (B), or an unhedged platform/economic flank (C).**

**Cross-cutting health metrics** (track under whichever set wins, so we don't win by cheating):
gates-working andon rate (not a defect count) · cost-vs-envelope median · honest-empty board discipline
(no invented demand). Per the desk's tier discipline: report any metric measured by dogfood proxy rather
than a real external user **as such** — the persona-research seam is closed by *usage*, not by a number
we generated ourselves.
