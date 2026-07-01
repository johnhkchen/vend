# Charter — your hackathon project

The value function this project is judged on. It's small on purpose. `vend steer` and
`vend chain` read this file as **steering context** — it tells the agents *what is worth
building in this session, and why* — so the work they clear is **valuable**, not merely
valid. Tune it to your hack; keep it to one page.

> This is the hackathon-tuned cousin of vend's own charter (`docs/knowledge/charter.md`).
> Same clearing move, different stakes.

---

## The clearing move

You authored one line of intent in `SEED.md`. The clearing move turns that line into the
**right slice** — right-sized, in the right order, worth doing *now* — instead of a pile of
half-finished ideas. The gates are the guarantee: nothing gets built that hasn't cleared.
At a hackathon the stakes are simple: **you want something you can show.**

---

## What makes work valuable here

A unit of work is worth allocating this session only if it is:

1. **Demo-advancing** — it moves a *runnable, deployable slice* forward. Work that advances
   nothing you can show is the worst waste — refuse it. (The opposite of polish for its own sake.)
2. **Grounded** — it answers to the app as it *actually is*. Go and see: the dev server is
   running, the page previews — build against what's there, not a someday architecture.
3. **Session-sized** — one sitting, one budget. If it can't finish and be shown before the
   clock runs out, it's too big — split it.
4. **In-bounds** — it doesn't break the green build or the deploy path. A broken demo is
   worth less than a smaller working one.
5. **Showable** — "done" can be *seen*: a rendered page, a passing check, a working
   interaction. If you can't point at it, it isn't done.

These five are the steering. An agent that internalizes them clears good hackathon work
without being told the answer.

**The one-line value:** *a demonstrable runnable slice over polish.*

---

## Light-but-real gates (invariants)

Kept deliberately light for a hack — but real, because a gate that isn't enforced is a lie.

- **H1 — The build stays green.** Every cleared slice leaves `npm run build` passing. A red
  build blocks the demo.
- **H2 — Every slice is showable.** It ships with something you can point at — a page, an
  interaction, a check that passes.
- **H3 — Budget is a hard contract.** A metered cast (`vend chain`) respects the time/tokens you
  fund it with, both ways. When the budget is spent, the session stops clean.

---

## Out of bounds for this session

The non-goals — tuned for a hack. These are *not* what "valuable" means here:

- **Polish maximalism** — pixel-perfect styling, animation, copy-editing before the slice runs.
- **Test-coverage completeness** — a smoke check that the slice works beats 100% coverage of
  a feature nobody's seen yet.
- **Infra perfection** — the deploy path is config + a green build; live Cloudflare hookup is
  the designer's push, not this session's blocker.

---

## Amendment rule

Capped at **one page**. To add a criterion or a gate, retire or merge another — pay the cost
deliberately. A charter that grows into a wiki has failed at its one job: being the small,
stable thing the agents steer by.
