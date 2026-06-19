# Vend — The Clearing Dynamic (latent demand, latent supply, vision gradient)

A companion to `vision.md` (the *why*) and `charter.md` (the *what's worth clearing*).
Those name Vend a "convenience store of plays" and a "clearing house for tasks." This doc
deepens that frame into the **dynamic underneath both** — the one the design keeps grasping
at across the IA, the demand board, and the latent-fruit brainstorm. Read it when a proposal
needs to answer *"is this the clearing dynamic, or are we drifting into a store you shop / a
factory that pushes?"*

**The thesis in one line:** *Vend turns the gap between your project as-is and your project
as-envisioned into a priced, ranked, two-gesture transaction — by stocking the supply,
reading the demand off the artifact, and pricing each move by how much vision it closes.*

---

## 1. Both sides of the market are latent

This is the whole trick, and it's what makes Vend neither a normal store nor a normal
clearing house.

| | A normal market assumes… | Vend assumes… |
|---|---|---|
| **Supply** | sellers show up with priced orders | **latent** — plays are pre-authored; capability is *standing inventory of judgment*, paid for once at authoring (charter **P1**), not specified this run |
| **Demand** | buyers show up knowing what they want | **latent** — the need lives in the *project's state* (the rough edge, the missing test, the god-function, the andon'd run), not as a well-formed request in the human's head |

A convenience store assumes you walk in *holding* the demand (you're thirsty, you grab a
Coke). A clearing house assumes both sides arrive knowing their orders. **Vend assumes
neither side shows up** — so it stocks the supply for you and **reads the demand off the
artifact** (`go-and-see.md`), then matches them. The recent finding that *articulating the
work is exhausting* is just this stated from the user's chair: demand is real but unvoiced,
so Vend must extract it, not receive it.

## 2. Salience is a gradient toward the vision

"Salience to your project and value toward realizing the vision" is not a vibe — it's a
**gradient**. The vision is the attractor; the charter is the value function; the current
repo is your position; the plays are the available moves. Then:

> **leverage = how much closer this move pulls the project toward the realized vision, per
> unit of budget spent.**

That is exactly the demand board's "rank by leverage, not effort" (`demand.md`) and the IA's
"the home leads with the one thing worth doing now" (**IA-1**) — restated as steepest
*worthwhile* descent. Vend computes the highest-gradient move and hands it over **priced**
(the measured envelope, E-013). The human collapses from *operator of the market* to
**assenter** — you sign off on cleared trades; you don't run the exchange.

## 3. The customer is the project, not the person

The locus of demand moves from the human's *intention* to the artifact's *state*. You are
not the buyer — your **project** is; you are its steward, authorizing transactions on its
behalf. This is why "design the loop, don't sit in it" (`vision.md`) is literally true here:
the human's two jobs shrink to **authoring** the supply and **assenting** to the cleared
demand.

## 4. Two consequences fall out

1. **"Browse the shelf" and "be told what to do" become the same gesture.** The shelf you
   see is already sorted by salience to *your* project (IA-1: demand leads, supply serves
   beneath). The store-vs-clearing-house dichotomy dissolves — browsing a vision-sorted
   shelf *is* being handed the next move.
2. **It is convergent, not a feature factory.** A clearing house *settles* — it drives toward
   equilibrium. Each run closes some of the residual between as-is and as-envisioned. So an
   **empty board is honest** (**IA-4**), not a failure: the gap is *closed*. A backlog is
   infinite push; this has a terminus. The work has a *bottom*.

## 5. The guard (where this dynamic rots if unwatched)

A self-stocking demand engine is exactly where **overproduction** — the worst waste
(`tps.md`) — sneaks back in. Reading demand off the artifact must never become *manufacturing*
demand to keep the line fed (the "auto-drainer garbage factory" `propose-epic.md` PE-1 warns
of). The discipline that keeps the dynamic honest:

- **Demand is *read*, never *invented*.** Every surfaced move must trace to real project
  state and name the vision-distance it closes (charter: *purposeful* + *grounded*).
- **A flat gradient yields an empty board, not busywork.** If nothing genuinely closes
  vision-distance, the honest output is *nothing* (IA-4) — the andon of the whole dynamic.
- **The human still pulls.** Vend *proposes* the cleared match; promotion to work is the
  human's gesture (PE-1). Salience ranks the shelf; it does not auto-cast (**IA-5**).

The Ledger closing the loop — runs surface their own follow-on demand (**IA-15**) — is this
dynamic made automatic, and is bound by exactly these guards.

---

**What it sharpens.** The charter's core feature is *"clearing intent into allocatable
work."* This lens sharpens *intent* into **latent intent the project holds but the human
can't voice** — and *clearing* into **matching latent demand against latent supply along a
vision gradient, and settling it in two gestures.** The convenience is the surface; this is
the engine.
