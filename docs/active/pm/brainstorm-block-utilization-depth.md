# Brainstorm — make the 90-minute block *buy depth*, not burn minutes

**Date:** 2026-06-19 · Product-trio ideation (PM · Designer · Engineer) · **active discovery
cycle**. Seeds off `articulation-block-utilization.md` (the granularity-gap pain). *(Saved to
the desk; uncommitted.)*

**HMW:** when an epic clears autonomously in **~25 min** but the human allocated a **~90-min
block** and walked away, how might Vend spend the remaining ~65 min on **real depth —
verification, hardening, coverage, confidence — and still return early when the work is
genuinely done**, never padding to fill the envelope?

## The reframe (carried from the seed)

The pain is **not** "work is too fast." Speed is good. The pain is that the **gesture and the
work are at different scales**: the human allocates a block, a single pull spends a quarter of
it. The fix is to make the longer window **buy more confidence**, not more elapsed time —
turn 25 min of *"it builds and tests pass"* into 90 min of *"verified, robust, complete."*

**The crux every idea must survive:** telling **productive depth** apart from **aimless
wandering** (the inverse of E-015) and **gold-plating** (D-003). Budget is a **ceiling, not a
quota** (P7) — a 25-min epic that's truly done must **return early**, not invent work.

---

## Ideation — three lenses, 5 each

### Product Manager (value · alignment · impact)
1. **Depth bands on the play contract** — a play declares escalating, discrete stages
   (`build → test-green → harden → adversarial-review → coverage-close`). The budget buys as
   many *bands* as fit; the run stops when **bands are exhausted**, not when the clock is.
   Depth becomes a contract artifact, not an improvised "keep going."
2. **Macro-wallet spends down across epics** — when an epic returns under budget, the wallet
   pulls the **next-highest-leverage epic** off the demand board and clears it too, until the
   block ceiling. The block buys *more settled demand*, not a padded single epic. (The "both"
   answer to the seed's open question; gated by PE-1 / IA-5.)
3. **Confidence target, not time target** — the founding gesture allocates *"bring this to
   zero open risks / 95% confidence,"* and the budget is the **ceiling that quality spends
   toward**. Reframes the contract from duration to a quality SLA — directly dissolves
   "duration ≠ value."
4. **Depth dividend in the Ledger** — record *what the extra time bought* (defects caught
   after build-green, coverage delta, variance reduction) so the macro mechanic is justified
   by **evidence, not faith**. The trust lever the seed names, made into data.
5. **Two-speed allocation at the counter** — the gesture picks **quick pass** (ceiling ~25,
   build+test) vs **deep pass** (ceiling ~90, unlocks the hardening bands). Keeps
   ceiling-not-quota honest: deep pass *permits* depth, never *mandates* filling the clock.

### Product Designer (UX · usability · delight)
6. **The depth ladder, made visible** — the run shows itself climbing rungs (`built ✓ ·
   tested ✓ · edge cases ✓ · adversarially reviewed ✓ · coverage closed ✓`). "I came back to
   something *more checked*" becomes legible, not assumed. Andon-adjacent: the gate-stops are
   the rungs.
7. **Return-early is a celebrated event** — when work genuinely finishes at 25 min, the UI
   says *"done early · budget returned · here's the next move,"* reframing undershoot as a
   **win + an offer**, not a failure to use the block. Kills the "pad to 90" reflex at the UX
   layer.
8. **The "what the extra hour bought" receipt** — on return, a diff between the 25-min state
   and the 90-min state: +N tests, caught X, hardened Y, coverage +Z%. Depth is **felt**, so
   the human learns the deep pass is worth allocating again.
9. **Walk-away dial** — one control couples *how long you're gone* to *how hard Vend verifies
   before you're back*. Leave for 90 → deeper gates run before return. Duration and
   thoroughness are coupled **by design**, which is exactly the seed's "the longer you walk
   away, the more it must be verified."
10. **Surplus-budget offer** — when an epic returns under budget, present the leftover as a
    one-keystroke fork: *"65 min left — chain the next fruit · deepen this one · or bank it."*
    Never auto-fills (IA-5). The human stays the allocator of the surplus.

### Software Engineer (tech · data leverage · scale)
11. **Adversarial-review stage as a graph node** — after build+test green, spawn a **skeptic
    sub-run** prompted to *refute* the work (find the missing edge case, the untested path,
    the unhandled error). Depth = **verification depth**, bounded and droppable. The literal
    "manufacture confidence" stage — and the cheapest high-leverage one.
12. **Signal-driven stop condition** — the run keeps hardening **only while a measurable
    signal still climbs** (branch coverage, mutation kills, property-test survivals); when the
    curve **flattens**, it returns. This is the seed's hardest open question — *"how does work
    know when it's done vs when there's depth left?"* — answered **quantitatively**, and it's
    the bright line between depth and wander.
13. **Multi-approach exploration, then select** — for a genuine fork, generate **N approaches**
    in parallel, judge them, keep the best (the judge-panel pattern). Extra time buys
    **better**, not **more** — and the discards are evidence, not waste. Bounded by the envelope.
14. **Macro-wallet executor** — the loop mechanic behind PM-idea #2: on early return, pull the
    next epic off the leverage-ranked board and **spend remaining mana down across casts** to
    the block ceiling. The chaining engine, bound by PE-1 (read, don't invent) and IA-4 (flat
    gradient → stop, don't manufacture).
15. **Depth instrumentation on the run record** — extend the record (E-013 already added the
    allocated-envelope field) with **per-band time + what each band caught**. Makes
    depth-vs-cost a measurable series, so the seed's success-shape (*extra time correlated with
    trust/consistency, not just cost*) becomes **testable**, not aspirational.

---

## Prioritized top 5 (composable — they form the depth loop)

| Rank | Idea | One-sentence | Why selected | Key assumptions to validate |
|------|------|--------------|--------------|------------------------------|
| **1** | **Adversarial-review stage** (#11) | A bounded skeptic sub-run that tries to break build-green work before the human returns. | The smallest, highest-leverage way to convert time into **confidence** — the primitive depth-band every other idea reuses. Directly attacks "25 min of build → 90 min of verified." | A refute-pass on already-green work catches **real** defects often enough to justify the spend; it can be bounded so it hardens rather than wanders. |
| **2** | **Signal-driven stop** (#12) | Keep hardening only while coverage/mutation signals climb; return when they flatten. | Solves the **crux directly** — the bright line between productive depth and aimless wander, and between "keep going" and "return early." Makes ceiling-not-quota (P7) structural, not a hope. | A cheap measurable signal exists that genuinely tracks robustness (not just coverage theater); a flat curve reliably means "done," not "stuck." |
| **3** | **Macro-wallet chaining** (#2 / #14) | On early return, spend remaining block-budget clearing the next-highest-leverage epic. | The seed's **block-scale precondition**: the only honest way to "allocate 2 hours and walk away" is to have block-scale *productive* work to spend on. Turns undershoot into more settled demand. | The demand board stays stocked enough to chain; chaining respects PE-1/IA-4 (stops at a flat gradient, never manufactures a next epic). |
| **4** | **Depth dividend — instrument + receipt** (#4 / #8 / #15) | Record and show what the extra time bought: defects caught, coverage delta, variance cut. | Makes the **success-shape testable** and the **trust lever real** — proves the deep pass bought robustness, not cost. Without it, "depth" is unfalsifiable and the macro mechanic rests on faith. | The dividend is **measurable per run** and large enough to *feel*; the receipt actually changes whether the human allocates the deep pass again. |
| **5** | **Confidence target / walk-away dial** (#3 / #9) | Allocate to a quality SLA (and couple time-away to verification depth) instead of to raw minutes. | Reframes the **gesture** itself so duration ≠ value is fixed at the source — the human asks for *confidence*, Vend spends the ceiling toward it. Keeps the human the allocator. | A confidence/risk level can be stated crisply enough to spend against; users prefer allocating *assurance* over allocating *time*. |

**The loop they form:** the **adversarial stage** (#1) manufactures confidence → the
**signal-driven stop** (#2) decides depth-left vs done → the **macro-wallet** (#3) spends any
surplus on the next real fruit → the **depth dividend** (#4) proves it was worth it → the
**confidence target** (#5) lets the human ask for assurance, not minutes. *Deepen, then
chain, then prove — and stop the moment the signal flattens.*

---

## Opportunity-Solution-Tree sketch

```
OUTCOME: a 90-min unattended run returns measurably more verified than a 25-min one — and still stops when done
│
├─ OPP "depth and wander look the same on the clock"  → signal-driven stop (#12) · depth bands (#1)
├─ OPP "build-green ≠ robust"                          → adversarial-review stage (#11) · multi-approach select (#13)
├─ OPP "a single pull undershoots the block"           → macro-wallet chaining (#2/#14) · surplus-budget offer (#10)
└─ OPP "I can't tell if the extra time was worth it"   → depth dividend + receipt (#4/#8/#15)
```

---

## Note on this cycle

This brainstorm is the **inverse twin** of `brainstorm-lower-articulation-cost.md`: that one
fed Vend's *demand* side (lower the cost to state the work); this one deepens the *execution*
side (make the allocated block buy confidence). Both serve the same North Star —
**trusted autonomous runs/week** — from opposite ends. Two of the top five (**#3 macro-wallet**,
**#4 depth dividend**) sit in the roadmap's **LATER** horizon, **trust-gated**: they're how
you'd *spend* trust once walk-away goes green — so this cycle is best read as **stocking the
depth-side backlog now, sequenced behind the trust unlock**, not as work to pull today. The
two that are *not* trust-gated — **#1 adversarial stage** and **#2 signal-driven stop** — are
the cheapest tests and the natural first probes, since they *manufacture* the trust the rest depends on.
