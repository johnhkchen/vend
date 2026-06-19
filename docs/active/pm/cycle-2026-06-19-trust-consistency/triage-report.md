# Feature-request triage — Vend's surfaced demand

**Date:** 2026-06-19 · **Requests analyzed:** 24 (consolidated) · **Themes identified:** 8

> **Input source.** Vend has no external users, so there is no support/sales pile. The
> "requests" here are Vend's **internally surfaced demand** — pulled from `demand.md`
> (Not-yet-pulled · Kaizen · Efficiency), the IA open threads, `proposed-batch.md`, and
> the new `discovery-foundation.md`. Triaged against the charter (P1–P7), the foundation
> leaps (A2 trust · A8 platform risk · A3 authoring cost), and the leverage rule
> (`demand.md`: rank by leverage, not effort). Upstream only — this prioritizes, it does
> not promote.

---

## Prioritization context (the goals it's ranked against)

- **Strategic goal:** make the core feature — *clearing intent into right-sized, gated,
  allocatable work* — into a usable, trustworthy product gesture. The named next rung is
  the **2-hour macro mechanic** (E-013 just unblocked it).
- **Foundation risk (from discovery):** trust-to-walk-away (A2) and platform absorption
  (A8) are unvalidated and existential; authoring cost (A3) is the business model.
- **Constraint:** one author, no users, CLI-only, ~10-run log (cold start). "Revenue
  signal" reads as **foundation/strategic signal** — there is no revenue yet.

---

## Step 3 — Theme summary

| # | Theme | Reqs | Top ask | Alignment | Impact | Effort | Priority |
|---|-------|------|---------|-----------|--------|--------|----------|
| A | **The 2-hour macro mechanic** | 4 | Macro-wallet spend-down loop | **High** (core gesture; P2/P4/P7) | High | L–XL | **P1** |
| D | **Trust & consistency proof** | 4 | Measure gates→consistency; walk-away audit | **High** (de-risks A2/A5) | High | S–M | **P1** |
| C | **Onboarding / cold-start** | 2 | Register the Survey play (run-0) | **High** (IA-3; core loop) | Med-High | M | **P2** |
| B | **User-facing surface (TUI)** | 7 | Design-language → the Counter | **High** (where invariants become behavior) | High | XL | **P2** |
| E | **Defensibility / platform hedge** | 3 | P6 second-executor proof | **High** (hedges A8, existential) | High | M–L | **P2** |
| F | **Authoring ergonomics** | 1 | Recipe-grade authoring | **High** (A3; the amortization) | High | L | **P3** |
| G | **Efficiency / mana economics** | 3 | Prompt ordering + model routing | Med (kaizen) | Med | M | **P3** |
| H | **Structural debt / dev tooling** | 3 | CLI parser consolidation | Low-Med (enabler) | Low-Med | S | **P3/P4** |

---

## Priority 1 — Act now

### A · The 2-hour macro mechanic *(4 requests)*
The board's named next rung; E-013 (measured prices) just unblocked it. It converts every
prior epic (engine → chain → measured envelopes) into the actual product gesture.
- **Requests:** macro-wallet spend-down loop · envelope **actuation** (IA-14
  auto-widen/slow-tighten) · **token hard-wall** (`--max-turns`, makes the wallet's
  accounting honest) · value/budget surface.
- **Recommended action:** **build** — first slice = depleting wallet + one spend-down loop
  over `castChain`, each cast priced by `vend envelope`. Pull `--max-turns` first or
  alongside (a leaky token denomination corrupts the wallet's subtraction).
- ⚠ **Sequencing conflict (see Patterns):** this builds *more* walk-away autonomy before
  walk-away **trust** (A2) is validated. Pair with Theme D, don't outrun it.

### D · Trust & consistency proof *(4 requests)*
Nearly free, highest-leverage de-risking — two tests ride data Vend **already** captures.
- **Requests:** variance/consistency probe (run a play 5× ±gates) · walk-away audit (run-log
  intervention trend) · **IA-15 ledger-generates-demand** · gate-library-as-moat.
- **Recommended action:** **investigate now** — run the variance probe (E2) and walk-away
  audit (E1) from `discovery-foundation.md`. The core promise (consistency) has never been
  *measured*; this produces the single most important number for the foundation. Then
  **build IA-15** (the ledger auto-surfaces demand — automates this very triage).

---

## Priority 2 — Plan next

### C · Onboarding / cold-start *(2)*
Register the **Survey** play so a fresh install has its one honest first move (IA-3/4/5,
cast Survey → stocked board). Without it the entire State-0→1 arc is vapor and any future
TUI has no empty state. New play on the proven engine — not new substrate.

### B · User-facing surface / TUI *(7)*
The largest cluster and where the charter becomes runtime behavior — but XL and partly
trust-gated. **Start with the design-language session** (the capped visual charter, the
amber-andon language) since it gates everything else, then the **Counter** (Confirm→Run→
Settle). Defer: detached/notify (trails the wallet), Confirm budget-adjust (folds into the
Counter), fleet/DAG andon board (→ P4, premature).

### E · Defensibility / platform hedge *(3)*
**P6 second-executor proof** is the standout — cast one playbook through a non-Claude
executor end-to-end. It converts P6 from an asserted principle into a proof and directly
hedges the existential A8 (the executor Vend rides is also its competitor). The
calibration-dataset and playbook-exchange asks are longer-horizon moat plays — plan, don't
rush.

---

## Priority 3 — Collect more signal

- **F · Authoring ergonomics** — the amortization (A3) lives or dies here, but it can't be
  *measured* until there's a real authoring event outside self-hosting. Gate behind E3
  (author-2-strangers test); promote the moment E3 shows authoring is too costly.
- **G · Efficiency / mana economics** — prompt ordering, per-function model routing,
  auto-structure. Real kaizen, but instrument cache-hit/per-model cost **first** (you can't
  tune what you don't measure); these are optimizations on a loop that isn't the bottleneck yet.
- **H · CLI parser consolidation** — grounded debt (`parseEnvelopeArgs` cognitive 32, worst
  in the repo; a bespoke parser per command). Real, but pure cleanup → low leverage.
  Fold it into the macro-wallet build (which adds *another* parser) rather than its own epic.

---

## Priority 4 — Decline or defer (with rationale)

- **Fleet/DAG andon board** — IA itself calls it "anticipated, not designed." No concurrent
  casts exist to need it. Defer until multi-line running is real; designing it now is inventory.
- **`parseDemandSignals` O(n²)** — flagged by the index, but harmless at board scale
  (handful of signals). Noted, not pulled. Revisit only if the board grows orders of magnitude.

---

## Notable individual request

- **P6 — second-executor proof.** Doesn't cluster cleanly (it's feasibility *and*
  defensibility *and* GTM hedge), but it's the **single best response to the existential
  foundation risk (A8)** and is **absent from the current `proposed-batch.md`**. Strong
  candidate to stage as a new signal regardless of theme ranking.

---

## Patterns & insights

1. **The board over-indexes on building autonomy; it under-indexes on *proving* the
   autonomy is trusted.** Theme A (spend-down wallet) and Theme D (is walk-away trusted?)
   are in tension: shipping more "leave it alone" capability before validating that users
   *will* leave it alone is building on an unvalidated A2. **Run Theme D's cheap probes in
   the same cycle as Theme A's first slice** — let evidence gate the second slice.
2. **The cheapest, highest-leverage work isn't a feature — it's measurement.** The core
   promise (consistency) and the core risk (trust) are both testable against *existing*
   run-log data at near-zero cost. That should outrank net-new features this cycle.
3. **The need behind "macro-wallet" is *trust capitalized*, not budgeting.** Users won't
   value a spend-down loop unless they already trust each cast to clear honestly — so the
   andon UX and the gate-consistency proof are upstream of the wallet's *value*, even though
   the wallet is upstream of them in the *roadmap*. Mind the gap.
4. **Two standing invariant tensions to hold, not resolve:** *autonomy vs. recommend-never-
   auto* (IA-14 actuation auto-widens; IA-5 says never auto — already reconciled by stakes,
   keep it explicit) and *two-gestures vs. budget-adjust* (P2/N1 simplicity vs. a Confirm
   adjust gesture — keep adjust the exception, never the default).

---

## Next steps

1. **Write E1/E2 experiment specs** (Theme D) so the trust + consistency probes are runnable
   now against the run log — *recommended; nearly free, de-risks the most.*
2. **Draft user stories** for the macro-wallet first slice (Theme A).
3. **Stage the P6 second-executor signal** into `proposed-batch.md`.
4. **Reconcile** this triage with `proposed-batch.md` — re-rank the staged batch to reflect
   the trust-before-autonomy insight (Theme D ahead of Theme A's second slice).
