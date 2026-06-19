# Startup Canvas — Vend

**Date:** 2026-06-19 · Strategy (9 sections) + Business Model (cost / revenue). Synthesizes
`vision.md`, `charter.md`, `discovery-foundation.md`, `triage-report.md`,
`value-proposition.md`. **Stage:** built prototype, demand unvalidated — so several cells
are *strategic bets carrying hypotheses* (flagged → discovery), not settled facts.

---

## Part 1 — Product strategy

### 1. Vision
**Turn the person from the thing *in* the loop into the thing that *designs* the loop.**
A world where encoded expertise + enforceable gates make probabilistic agent work a
*dependable product* — author once, run forever. Values: **autonomy over supervision**,
**consistency as a contract** (not a hope), **local-first ownership** of your own work.

### 2. Market segments *(defined by the job, not demographics)*
| Seg | JTBD | First? |
|-----|------|--------|
| **S1 — Agent-orchestrating builder** | "Dispatch repeatable, trustworthy agent work and walk away" | **Yes — beachhead** |
| **S2 — Solo AI-app shipper** | "A quality gate between *the agent wrote it* and *it's live*, without becoming a reviewer" | After S1 |
| **S3 — Agency / consultancy** | "Capture a senior's judgment as a runnable, gated asset; decouple quality from who's at the keyboard" | Viability / monetization |

**Why S1 first:** zero distribution distance (Vend already serves it via self-hosting — the
proof artifact *exists*), the pain is sharpest among the heaviest agent users, and they're
technical enough to author. The beachhead is the dogfood.

### 3. Relative costs
**Optimize for unique value (Starbucks), not low cost (Southwest).** The value is
gates + consistency + the calibration dataset — *not* being a cheaper model runner.
Crucially, **local-first makes the internal cost structure unusually low**: Vend bears
~no inference cost (the user pays their own executor/tokens — pass-through). Premium value,
lean cost base.

### 4. Value proposition *(condensed — full version in `value-proposition.md`)*
- **S1:** *Before* — babysitting every step, re-specifying each run, attention capped at
  3–5 agents. *How* — author a gated playbook once; pick + budget + run; gates replace
  supervision. *After* — spec paid once, you design loops. *vs* raw Claude Code / agent
  frameworks: gates make output trustworthy without you in the loop.
- **S2:** *Before* — rubber-stamp or hand-audit. *How* — grab a gated playbook; the andon
  refuses garbage. *After* — a quality floor; ship faster *and* safer. *vs* manual review /
  generic CI: it encodes *your* judgment as enforceable gates.
- **S3:** *Before* — expertise trapped in senior heads. *How* — seniors author once; team +
  agents run. *After* — branded quality independent of staffing. *vs* SOP wikis: the SOP
  becomes *runnable*.

### 5. Trade-offs *(what we will NOT do — focus = the non-goals)*
- **Not a chat copilot (N1)** — won't optimize in-loop conversation; the win is *leaving* the loop.
- **Not a babysitting dashboard (N2)** — won't build better step-approval; the goal is no step-approval.
- **Not a one-off prompt runner (N3)** — the unit is the reusable gated playbook, not a throwaway invocation.
- **Not an executor (N4)** — won't build a better model runner; ride Claude Code, then open models.
- **Not cloud-required (P5)** — won't make a server a precondition to value.
- **Not config-at-the-counter (P1/P2)** — won't add run-time knobs; configuration lives at authoring.

These trade-offs *are* the substrate of §9 — each "won't" is something an executor or a
framework *would* do, and choosing against it is what makes the set hard to copy.

### 6. Key metrics
- **North Star:** **Trusted autonomous runs / week** — runs that cleared (or honestly
  andon'd) *without mid-run human intervention*. It fuses both pains at once: breadth of
  runs (reuse) × the core value (walk-away trust).
- **OMTM (this quarter — foundation validation):** **Walk-away rate** = % of runs the author
  lets clear without intervening. The leading indicator of A2; measurable *today* from the
  run log (discovery E1).
- **Health:** andon rate *inside* its IA-12 budget (0% is suspicious, not ideal — IA-10) ·
  authoring-to-breakeven runs (A3) · gate-driven output-variance reduction (A5, E2) · cost
  per cleared cast.

### 7. Growth
**Product-Led.** The product onboards itself — run-0 casts **Survey** on the user's own repo
(IA-3); the first 60 seconds *are* the value demo. **Growth loop:** author a playbook →
share it → others run it → they author → … (the **playbook exchange** is the loop's
flywheel and a defensibility asset). **Channels:** developer-led — open-source/GitHub, dev
communities, content (the playbooks themselves are shareable artifacts). Sales-led overlay
only later, for S3.

### 8. Capabilities
- **Build (the differentiated core):** the **gate library** (the moat), the
  **recalibration / calibration-dataset** engine (v1 shipped, E-013), the **executor-agnostic
  abstraction** (P6 — designed, unproven), the **TUI surface + design language**, and
  **recipe-grade authoring** (the lever the whole amortization rests on).
- **Ride / partner (don't build):** the executors (Claude Code first, open models) — never a
  model runner.
- **Acquire:** distribution into developer communities; design capability for the TUI.

### 9. Can't / Won't *(defensibility — the integrated set)*
- **Gates-as-contract + the calibration dataset** are the two things executors won't own:
  they optimize the *model*, not the *quality contract*; and the dataset (play × project ×
  estimated × actual, IA-16) **compounds with usage** — a latecomer starts at zero.
- **Local-first + executor-agnostic is a stance a model vendor *won't* take** — Claude Code
  is Anthropic-locked; a deliberately model-neutral, local orchestration layer is channel
  conflict for any single executor. The moat is partly *who won't follow*, not just *who can't*.
- **The set reinforces itself:** spec-once × gates × budget-as-contract × local-first ×
  the trade-offs — copy one piece without the others and the value doesn't reproduce.
- **Honest limit:** a pure-software orchestration layer is *technically* copyable. The
  durable defense is the **compounding dataset** + the **model-neutral position** + **design
  coherence**, not code secrecy. This is the existential bet (A8) — hedge it by proving P6
  early (discovery E5) and deepening the dataset (IA-15).

---

## Part 2 — Business model

### 10. Cost structure
**Unusually low — local-first carries the structure.**
- **Near-zero inference cost borne by Vend** — users pay their own executor/tokens (pass-through).
- **Main cost = development** (founder time today). Then design (the TUI), and distribution/marketing.
- **Optional/later recurring:** hosting for a **playbook-exchange registry** and any
  team-shared / cloud-execution tier — *additive*, not required for the core product.
- **Scaling:** sub-linear — no per-run infra cost means usage growth doesn't drive a
  proportional cost curve. The cost risk is *go-to-market spend*, not COGS.

### 11. Revenue streams *(the least-validated part — A7)*
Local-first + developer-trust dynamics point to **open-core**:
- **(a) Hosted playbook exchange / registry** — marketplace take or subscription on the
  growth-loop flywheel (§7).
- **(b) Team / enterprise tier** — shared shelves, governance, the calibration dataset
  *across* a team; the natural home for **S3 agencies** (value-based pricing).
- **(c) Managed execution tier (later)** — cloud convenience as an *option*, never a
  requirement (keeps P5 intact).
- **Solo wedge (S1/S2):** likely **free/open** — it's the PLG fuel and the trust-builder.
- **Pricing approach:** value-based for teams; free for the wedge. **Biggest uncertainty:**
  whether an author-it-yourself, local-first tool captures meaningful willingness-to-pay
  **(A7)** — *the one gap no current discovery experiment covers.*

---

## Coherence check — do the elements reinforce each other?

**Mostly yes, one live tension.** Premium-value (§3) + gates-moat (§9) + PLG (§7) +
local-first (§3/§10) + the trade-offs (§5) all pull the same direction: *be the trustworthy
quality contract on top of any executor, owned locally, that gets better with use.*

- ✅ **Trade-offs ↔ defensibility:** every "won't" (§5) is exactly what an executor *would*
  do — the focus and the moat are the same choices.
- ✅ **Local-first ↔ cost ↔ premium:** owning no inference cost funds a premium-value (not
  low-price) position with a lean base.
- ✅ **Metrics ↔ stage:** OMTM = walk-away rate is measurable *now* and validates the load-
  bearing assumption before more building (the triage "measurement-first" insight).
- ⚠️ **Open-core ↔ revenue:** give the tool away for distribution (§7) vs. capture WTP (§11).
  This is the classic open-core tension and is **unresolved** — it rides entirely on A7.
- ⚠️ **Autonomy ↔ trust sequencing:** the roadmap builds *more* walk-away capability (the
  macro-wallet) while walk-away *trust* (A2/NSM) is unvalidated. Strategy says **let the
  metric gate the build** — run the trust probe in the same cycle.

## Load-bearing hypotheses *(must be true)*
A1 pain · **A2 trust (NSM/OMTM)** · A3 authoring nets positive · A5 gates→consistency ·
**A7 willingness-to-pay (uncovered)** · **A8 platform doesn't absorb (existential)**.

## Low-effort experiments to test them
- **E1 walk-away audit** (A2) and **E2 variance probe** (A5) — ride existing run-log data; do first.
- **E3 author-2-strangers** (A3) · **E4 platform teardown** + **E5 second-executor spike** (A8).
- **NEW — pricing/WTP probe** (A7): a positioning + price-sensitivity test (e.g. a landing
  page with tiered pricing, or 5 buyer conversations for S3). *Add to the discovery plan —
  it's the one canvas cell with no experiment behind it.*
