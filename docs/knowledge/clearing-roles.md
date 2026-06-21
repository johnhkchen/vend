# Clearing roles — who proposes, who pulls, who clears

The durable anchor for **how the three actors around the board coordinate**. vend is a
**pull system** (`tps.md`); this file fixes *who is allowed to do what* so the pull stays
coherent when more than one agent is in play. It pairs with `clearing-dynamics.md` (what the
clearing *is*) by pinning *who performs each move*.

Written against the **human-gated pull** model: the pull is a deliberate human gesture, never a
thing an upstream proposer or a downstream executor performs on its own.

---

## The spine — the pull is human-gated

The pull is the **two-gesture transaction** (`vision` P2): *pick + budget + go*. It belongs to the
**human**. Everything else is arranged so that gesture stays the one decision point:

- Demand is **read, never invented** (charter PE-1); clearing happens **just-in-time on pull**, never
  ahead of demand (`tps.md` — pull, anti-overproduction).
- **Recommend, never auto-cast** (`information-architecture.md` IA-5): the system surfaces a ranked
  recommendation; it does not pull for you.
- Autonomy (`vision` P4) means a **pulled** run proceeds against its **gates** without live
  supervision. It does **not** mean the system invents and pulls its own demand. P4 is autonomy
  *after* the pull, not autonomy *of* the pull.

## The three roles (stable boundaries)

| Role | Performs | Must NOT |
|---|---|---|
| **Proposer** (PM agent) | Survey state, rank demand, **stage** signals + briefs in `docs/active/pm/`. Recommend one next pull. Then **stop.** | pull · build · push-as-delivery |
| **Puller** (the human) | Make the **deliberate pull** — the only actor that decides what clears. Set the budget. Assent to cleared work. | — |
| **Clearer** (the executor / lisa loop) | Clear **already-pulled** demand into work; build, gate, commit the built work. | decide *what* to pull |

The customer is the **project**, not any agent (`clearing-dynamics.md` §3); the human **authors
supply and assents to cleared demand** (§4). The Proposer makes demand *legible*; the human makes it
*real*; the Clearer makes it *built*. Sequential, not concurrent.

## The incoherence this resolves

Observed in practice when a PM agent and an autonomous executor shared one board:

1. **Verb collision.** Demand-**pull** and git-**push** are opposite directions. A *Proposer*
   offering to "push" is leaking into delivery — a supply-push act, the very thing a pull system
   exists to avoid. A proposer **stages**; it does not ship.
2. **Two pullers, neither the human.** An autonomous executor pulling *and* a PM prepping pulls
   **splits the human's gesture and removes the human from it.** When the two disagreed (the loop
   pulled the DAG; the PM had recommended the onboarding demo) there was **no arbiter** — because the
   one actor with pull authority wasn't in the decision.
3. **Shared-surface contention.** Upstream-propose and downstream-build running *concurrently on the
   same git index* race each other (entangled commits, gate stalls). The **human pull is the
   checkpoint that sequences them** — remove it and the two collapse into contention.

## The operating contract

- **CR-1 — Only the human pulls.** The Clearer clears what's been pulled; it does **not** self-pull.
  Autonomy is preserved *not* by letting the executor invent demand, but by the human pre-authorizing
  a **standing pull policy** the executor clears against (e.g. "clear the top concrete signal within
  this budget"). The policy is itself a human gate set once — not the executor manufacturing demand.
- **CR-2 — The Proposer proposes, then stops.** It stages ranked demand + briefs in `pm/`. It never
  pulls, builds, or pushes as delivery. Its desk writes are **staging**, not shipping.
- **CR-3 — One puller.** The Proposer *recommends*; the human *decides*; the Clearer *executes*. Pull
  authority is never held by two actors at once. A Proposer recommendation and a Clearer's autonomous
  pick are **not** peers — the human (or the human's standing policy) breaks the tie.
- **CR-4 — The pull is the sequencing checkpoint.** Propose and clear do not run concurrently on the
  same surface; the human pull separates upstream from downstream — which also dissolves the
  git-index contention by construction.
- **CR-5 — Verb hygiene.** *Pull* = the demand mechanic (human). *Push* = mechanical remote sync, a
  delivery detail **downstream of the pull**, never a role and never "pushing work" in the
  overproduction sense. No agent pushes demand at anyone.

## Why human-gated (and not an autonomous puller)

- It **is the product promise.** P2 (two gestures) and P4 (gated autonomy after the pull) only hold
  if the pull is the human's; an auto-puller quietly relocates the product's one decision into the
  machine.
- It keeps **anti-overproduction** honest (`tps.md`): the human *is* the demand signal. An executor
  that invents and pulls its own demand is the garbage factory `propose-epic.md` (PE-1) refuses.
- It **fixes the mechanical contention for free** — the checkpoint that makes roles coherent is the
  same checkpoint that stops two agents racing one tree.

## The correction (what changed)

- **Observed drift:** a Proposer offered to git-push and prepped pulls while an autonomous Clearer
  pulled a run of epics on its own; the two diverged with no arbiter; the shared tree raced
  throughout.
- **Corrected to:** Proposer *proposes and stops* → human *pulls* (directly, or via a standing
  policy) → Clearer *clears pulled demand only*. One puller, one surface handed off at the pull.

## Related anchors

`vision.md` (P2 two-gesture, P4 gated autonomy) · `charter.md` (PE-1 purposeful/pull-only) ·
`clearing-dynamics.md` (latent supply × demand; human authors + assents) · `tps.md` (pull, jidoka,
anti-overproduction) · `information-architecture.md` (IA-5 recommend-never-auto-cast) ·
`playbooks/propose-epic.md` (the proposer's discipline) · `docs/active/pm/README.md` (the desk
handoff this generalizes).
