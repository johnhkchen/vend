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

_Gate down — **no active cycle.** The last processing cycle (articulation-cost, 2026-06-19)
is closed and archived at `cycle-2026-06-19-articulation-cost/`; its batch was promoted and
built (→ E-016/17/18, the articulation trilogy, all done). Raise the gate with fresh focus
notes when you want the next batch synthesized._

Current state for the next survey (so a new cycle doesn't re-propose done work):

- **The autonomy gate is open.** E-014's E1 (walk-away) HOLD was lifted to **go** (provisional,
  forward-leaning at 2/10 genuine forward records); the **macro-wallet shipped** (E-024/E-025)
  and is no longer gated. Live demand is now the **six frontiers** in `demand.md`; the keystone
  is **Frontier 1 — prove the wallet live** (the one run that both demonstrates the headline
  feature and accrues the forward-E1 it still needs).
- **Carried forward, now cleared:** the P6 second-executor proof (→ E-035) and its BAML
  authoring half (→ E-036) both shipped; cold-start envelopes recalibrated by hand on the
  live plays.
- **Still live / un-pulled** (candidates a fresh cycle may rank): the agentic open-model
  runtime (Frontier 2), the multi-node DAG (Frontier 3), the Linear renderer + annotation
  round-trip (Frontier 4 — visual-surface prep already at the desk root), the IA walk-away
  UX threads (Frontier 5).
- **Read, never invent** (PE-1): with the board this cleared, a flat gradient yields an
  **honest empty batch** (IA-4), not busywork.

