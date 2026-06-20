# Outcome roadmap — Vend (2026)

**Date:** 2026-06-19 · outcome-focused (problems & impact, not features). Horizons, not dates
(solo + agent, local-first). Transforms the staged/in-flight outputs across the desk into
outcome statements. *(Saved to the desk; uncommitted — a lisa loop holds the tree.)*

## Strategic context

- **North Star:** *trusted autonomous runs / week.* **OMTM:** *walk-away rate* (% of runs
  cleared with zero mid-run intervention).
- **The organizing principle** (`clearing-dynamics.md`): the customer is the *project*; the
  human's job collapses to **author + assent**. Every outcome below lifts one load off the
  human (`cognitive-overhead-articulation.md`: O1 articulate · O2 decide · O4 trust).
- **The spine — trust gates the right side.** E-014 measured the trust signal and returned
  **E1 = HOLD** (walk-away not yet earned) with **E2 ≈ 21%** gate-driven variance reduction.
  So *capitalizing* trust (the macro-wallet) stays parked until walk-away goes green; effort
  routes to the loads that are **not** trust-gated (articulation) and to making trust
  **earnable/visible**. This is why the roadmap is resilient: we commit to *raising the
  walk-away rate*, not to shipping a named feature by a date.

---

## NOW — prove trust, bound the budget *(in flight)*

| Output (old) | Outcome statement | Metric | Status |
|---|---|---|---|
| E-014 evidence gate (E1/E2) | **Enable the builder to *know* whether Vend can be trusted to run unattended** — by measuring walk-away rate and gate-driven consistency — **so that** the roadmap commits to autonomy on evidence, not assumption. | E1 intervention trend; **E2 = 21%** variance cut | ✅ shipped — verdict **HOLD** |
| E-015 `--max-turns` token wall | **Enable the builder to hand off a budget without fear of runaway cost** — by bounding agentic exploration so the token meter is a real wall — **so that** autonomous spend becomes safe to leave. | token-overshoot rate → 0; envelope-vs-actual gap ↓ | 🔄 in flight |

---

## NEXT — lift the articulation load *(not trust-gated; the cognitive-overhead headline, O1/O3)*

| Output (old) | Outcome statement | Metric | Depends on |
|---|---|---|---|
| `expand-fragment` · Survey play · codebase-index→signals | **Enable the builder to go from a felt "this is rough" to a runnable signal without composing it themselves** — by having Vend read demand off the project and propose it — **so that** work clears even when the human is out of articulation energy. | acceptance/edit rate of proposed signals; sessions started from a proposed move vs a blank page | the dispense engine (have); `expand-fragment` is the primitive others reuse |
| Rough-notes inbox | **Enable the builder to capture a half-thought in one gesture** so fleeting ideas don't evaporate, **so that** latent demand is preserved for later clearing. | fragments captured/week; fragment→signal conversion | `expand-fragment`; seeds off `capture-note` |

*Why now and not gated:* articulation overhead (O1, opportunity score 0.72) is the widest
gap on the desk and is **independent of trust** — it can advance while trust is still HOLD.

---

## NEXT / LATER — lift the decision & vigilance loads *(trust-gated, O2/O4)*

| Output (old) | Outcome statement | Metric | Depends on |
|---|---|---|---|
| Andon UX · design-language · Ledger track-record | **Enable the builder to *stop watching*** — by making gate-stops legible, protective events (amber andon) and surfacing each play's track record — **so that** the vigilance load drops and runs are genuinely left alone. | **walk-away rate ↑ (the OMTM)**; intervention ↓ after andons become legible | E2 evidence (have); a visual surface |
| Accept-the-default Counter · decision-diet | **Enable the builder to start the right run with a single assent** — by pre-filling play+budget from measured defaults — **so that** decision fatigue stops blocking the start. | pre-fill **accept rate**; decisions-per-run → 1 | measured envelopes (E-013, have); recommend-never-auto (IA-5) |

*This is the trust unlock.* The andon-UX outcome **is** the lever that moves walk-away from
HOLD toward green — and only when it does does the LATER horizon open.

---

## LATER — capitalize trust & hedge the existential bet

| Output (old) | Outcome statement | Metric | Gated by |
|---|---|---|---|
| Macro-wallet (2-hour spend-down) | **Enable the builder to allocate a budget and walk away while Vend spends it down across casts** — **so that** one gesture clears hours of work. | unattended macro-runs completed; mana spent-down per gesture | **walk-away rate green** (the whole point of NOW/NEXT) |
| IA-15 ledger-generates-demand | **Enable the project to surface its own next work** — Ledger turns rot/cost-trends into pull signals — **so that** the demand side stays stocked without human articulation. | auto-surfaced signals accepted/week | run-log depth; the demand-read discipline (PE-1) |
| P6 second-executor proof | **Prove Vend's value survives the executor it rides** — clear one playbook through a non-Claude executor — **so that** Vend isn't absorbed by the platform (A8). | a playbook clears end-to-end on a 2nd executor, gates intact | the executor interface |
| Pricing / WTP probe | **Learn whether the value commands willingness-to-pay** — **so that** the open-core business model is grounded (A7). | price-sensitivity signal from S3 buyers | a value-prop to test (have) |

---

## Key assumptions (testable)

- **Trust is *earnable and visible*** — making gates legible raises walk-away faster than just
  making them work (the central bet of the trust-gated horizon).
- **Machine-extracted demand is trustworthy enough to pick from** — the articulation horizon
  fails if proposed signals read as noise. (Test: acceptance rate of hand-surveyed signals.)
- **Pre-filled defaults are right often enough to accept blindly** — or decision-diet erodes
  control instead of relieving fatigue.
- **Vend's moat survives the executor (A8)** and **the value commands payment (A7)** — the two
  existential unknowns, deliberately probed in LATER, not assumed.

## How to read this roadmap

It is **resilient by design**: each horizon commits to an *outcome* (raise walk-away, lift
articulation), and multiple outputs can serve each. If `--max-turns` or the Survey play
proves wrong, the *outcome* still stands and we swap the output. The one hard sequencing law:
**trust (walk-away rate) gates the LATER horizon** — measured, not assumed, and currently HOLD.
