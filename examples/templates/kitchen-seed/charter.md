# Charter — your home-kitchen menu

The value function this project is judged on. It's small on purpose. `vend steer` and `vend work`
read this file as **steering context** — it tells the agents *what is worth building in this
session, and why* — so the work they clear is **valuable**, not merely valid. Tune it to your
kitchen; keep it to one page.

> This is the kitchen-tuned cousin of vend's own charter (`docs/knowledge/charter.md`).
> Same clearing move, different stakes.

---

## The clearing move

You authored one line of intent in `SEED.md` — a menu your partner orders from. The clearing move
turns that line into the **right slice** — right-sized, in the right order, worth doing *now* —
instead of a pile of half-finished features. The gates are the guarantee: nothing gets built that
hasn't cleared. Here the stakes are simple: **the couple wants a menu they can actually use.**

---

## What makes work valuable here

A unit of work is worth allocating this session only if it is:

1. **Menu-advancing** — it moves *the rendered menu the diner sees* forward. The first and highest-
   leverage move is to **render the dishes at `/`** (read `Dish` content from EmDash, one card per
   dish: photo, name, description). Work that advances nothing the diner can open is the worst waste
   — refuse it.
2. **Grounded** — it answers to the kitchen as it *actually is*. Go and see: the EmDash admin runs,
   the `Dish` type exists, the example dish is there — build against that real content and the real
   REST API, not a someday schema.
3. **Session-sized** — one sitting, one budget. If it can't finish and be shown before the budget
   runs out, it's too big — split it.
4. **In-bounds** — it doesn't break the green build (`astro build`) or the Cloudflare deploy path. A
   broken storefront is worth less than a smaller working one.
5. **Showable** — "done" can be *seen* on a phone: a rendered menu card, the diner's-eye view at
   `/`. If you can't point at it, it isn't done.

These five are the steering. An agent that internalizes them clears the menu render first, without
being told the answer.

**The one-line value:** *a real, usable menu the couple will actually order from — over polish.*

---

## Light-but-real gates (invariants)

Kept deliberately light for a first drive — but real, because a gate that isn't enforced is a lie.

- **K1 — The build stays green.** Every cleared slice leaves `astro build` passing. A red build
  blocks the menu.
- **K2 — Every slice is showable.** It ships with something the diner can open — a rendered card, a
  working `/` page on a phone.
- **K3 — Budget is a hard contract.** `vend work` respects the time/tokens you fund it with, both
  ways. When the budget is spent, the session stops clean.

---

## Out of bounds for this session

The non-goals — tuned for a first menu drive. These are *not* what "valuable" means here, and steer
should **not** rank them above the menu render:

- **The ordering loop** — letting the diner place an order, the derived shopping list, prep. Later.
- **Nutrition & the healthiness read** — a later epic, not this slice.
- **Polish maximalism** — pixel-perfect styling, animation, copy-editing before the menu renders.
- **Infra perfection** — the deploy path is config + a green build; the live Cloudflare push is the
  cook's own, not this session's blocker.

---

## Amendment rule

Capped at **one page**. To add a criterion or a gate, retire or merge another — pay the cost
deliberately. A charter that grows into a wiki has failed at its one job: being the small, stable
thing the agents steer by.
