---
ready: false          # ← flip to true when you're ready for the PM agent to process
requested_at:
---

# Process gate — "I'm ready for you to process this"

The control flag between **discovery** and **processing**.

The PM agent does **open discovery** into this workspace freely — surveying state,
querying the codebase index, accumulating findings and draft signals (in
`discovery/` or notes). It does **not** run a **processing** cycle — synthesizing the
final ranked `proposed-batch.md` and recommending what to promote — until this gate
is raised. Until then, anything already staged (e.g. an early `proposed-batch.md`) is
a **preliminary draft**, not a decision.

## How it works

- **Raise it:** set `ready: true` above (optionally add focus notes below), then tell
  the orchestrator to run the PM agent's processing cycle.
- **The agent consumes it:** on a processing run the PM checks this flag; if `true` it
  synthesizes the batch, then **flips it back to `ready: false`** — one-shot per cycle,
  so a stale `true` can't re-trigger.
- **Lowered (`false`) = keep discovering / hold.** The orchestrator will not promote
  any signal to the active board while the gate is down.

## Focus / notes for the next processing cycle

_(Processed 2026-06-19 — synthesized directly into `proposed-batch.md`: 6 ranked signals,
recommended pull **`expand-fragment`**. The steering below produced it; gate stays down.)_

Synthesize **this cycle's articulation-cost discovery** into a ranked, pull-disciplined
batch (≤6, leverage-ranked, signals **un-elaborated** per PE-6, each naming the charter
invariant it advances, plus one recommended next pull). Desk source: `brainstorm-lower-
articulation-cost.md`, `cognitive-overhead-articulation.md` (O1–O4 opportunity scores),
`job-stories-articulation.md`, `Outcome-Roadmap-2026.md`, the `clearing-dynamics.md` lens.

Steering:
- **Honor trust-before-autonomy (the spine).** Articulation work (O1 articulate / O3) is
  **not** trust-gated — it can advance **now** while E-014's **E1 (walk-away) = HOLD**. The
  **macro-wallet stays gated** until walk-away goes green; route effort to the loads that
  aren't trust-gated (articulation) and to making trust earnable/visible.
- **Headline candidate:** the **demand-extraction primitive** (`expand-fragment`) + the
  **Survey play** (IA-3 bootstrap) — turn "I can feel the work but can't formulate it" (O1,
  0.72, the widest gap on the desk) into *edit a proposed move*, not compose from blank.
- **Read, never invent** (PE-1): a flat gradient yields an **honest empty board** (IA-4),
  not busywork.
- Reflect the real-world correction this session surfaced: **envelopes are cold-start
  guesses** (decompose recalibrated 50k→120k by hand) — the recalibration loop warming is
  a candidate, and "pre-filled budget from measured data" underpins the low-decision pulls.

_Carried forward (still staged, un-processed): the **macro-wallet** (gated by E1 HOLD), the
**P6 second-executor** proof, and the **pricing/WTP** probe._

