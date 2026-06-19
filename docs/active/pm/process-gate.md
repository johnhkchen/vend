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

_(Processed 2026-06-19.)_ The discovery converged not into a re-ranked batch but into a
single lean **work brief** — `brief.md`, the Trust & Consistency Evidence Gate (E1
walk-away audit + E2 variance probe). The trust-before-autonomy through-line made the
next move measurement, not a build, so the brief supersedes the macro-wallet ranking for
now. The two new signals discovery surfaced (P6 second-executor; pricing/WTP probe) and
the wallet remain staged for a later cycle — re-raise the gate to process them.

