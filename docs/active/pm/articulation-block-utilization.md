# Articulation — the granularity gap: 25-minute epics vs the 90-minute block

**Date:** 2026-06-19 · **Type:** pain articulation (problem only — no solutions yet; a seed
for a later discovery cycle). *Scope: just name the pain crisply.*

## The pain, in one line

An epic's full ticket set clears autonomously in **~25 minutes**, but the human-scale unit of
allocation — the feature block — is **~90 minutes**. The work **undershoots the budget
envelope**: "allocate 90 minutes and walk away" finishes in 25 and stops, so two-thirds of
the block the human stepped away for goes unused.

## The numbers

- A lisa loop clears an epic's tickets in **~25 min** (observed, this session).
- The founding gesture allocates a **~90-min / 2-hour feature block** (`demand.md` budget
  envelopes; the "work for 2 hours" macro mechanic).
- The micro unit (an epic) is **~3–4× smaller** than the macro unit (a block) the human
  actually allocates against. The gesture and the work are at different scales.

## The reframe — depth, not duration

The goal is **not to make work slower.** Padding a 25-min job to 90 min with make-work is
exactly the overproduction Vend exists to prevent (TPS: the worst waste). The goal is to make
the longer window **buy more**: turn ~25 min of *"it builds and the tests pass"* into ~90 min
of *"it's genuinely robust, verified, and complete."* More time should purchase **depth,
confidence, and coverage** — not elapsed minutes.

## Why it matters

- **Precondition for the macro mechanic.** You can't honestly "allocate a 2-hour budget and
  run" if a single pull spends 25 minutes of it. The block-scale gesture (the founding
  promise) needs a block-scale of *productive* work to spend on.
- **A trust lever.** The longer you walk away, the *more* the work must have been verified
  before you return (trust-before-autonomy, E-014). A 90-min unattended run should come back
  *more checked* than a 25-min one — not just later.
- **A consistency lever.** Gates bought ~21% variance reduction (E-014 E2). More thorough work
  — adversarial review, edge cases, self-correction — is plausibly how you raise that floor.
  The extra time is where confidence is manufactured.

## The tension to hold (what makes this hard — not a settled answer)

The whole difficulty is the line between **productive depth** and **waste**:

- **Not busywork.** The budget is a **ceiling, not a quota** (P7). An epic genuinely done in
  25 min should *return early*, not invent work to fill 90. "Push to 90" means *when there is
  real depth to add* — never *always take 90.*
- **Not wandering.** This is the *inverse* of E-015: there, work blew *past* the envelope via
  agentic exploration; here, "use more time" risks re-introducing exactly that wander, now
  sanctioned. Productive depth and aimless wandering both consume the clock — telling them
  apart is the crux.
- **Not gold-plating.** Over-engineering past the slice (the well-formed-wrong reflex, D-003)
  is depth's evil twin.

## The open questions (for a later cycle, not answered here)

- Is the path **deeper work per epic** (more verification / adversarial review / coverage /
  multiple-approach exploration), **more epics chained** into the block (the macro-wallet
  spending across casts), or **both**?
- What classes of additional work *genuinely* add value in the extra ~65 minutes — and how
  would we **measure** that the extra time bought robustness (fewer post-hoc defects, lower
  variance), not just cost?
- How does the work **know when it's truly done** (return early) vs **when there's real depth
  left** (keep going)?

## Success shape (observable, when solved)

A 90-min run produces *measurably more* than a 25-min run on the same epic — more verified,
more robust, more complete — with the extra time **correlated with higher trust/consistency,
not just higher cost** — and it still **stops when genuinely done**, never padding to fill the
envelope.
