# Your seed — the one thing you author

This is the **only** input you write by hand. Everything downstream — the board, the forks, the
cleared slices — comes from *casting* a play over this seed, not from typing more files. Author one
line of intent, then drive.

---

## The idea

> **A home-kitchen menu where my partner orders dishes for the week and I cook them.**

A small web app for a two-person household: the cook keeps a handful of dishes — a photo, a name, a
short description — and the partner opens the menu on their phone to see what's on offer this week.
The dishes live in the EmDash admin; the diner storefront at `/` shows them as an appetizing,
mobile-first menu.

---

> ✏️ **Replace this with your idea.** One line is enough — describe the smallest thing you'd love
> your partner to actually use. Keep it thin; the clearing play does the rest.

---

## The first slice — render the menu

The storefront at `/` is a deliberate **stub** today (it says "menu coming soon"). The first thing
to build is the **menu render**: read the `Dish` content (name, photo, description) from EmDash's
REST API and show one card per dish at `/`, made for the phone the diner is holding. That render is
the slice `vend work` clears — the cook watches autopilot build the menu, then fills in the real
dishes.

What's already seeded: the EmDash **`Dish`** content type and **one** example dish (format
documentation). Add your real dishes in the EmDash admin (upload a photo, write a name and a short
description), then edit or delete the example.

---

## The pair

This drive is for two people:

- **Cook / driver — a dev.** Runs the gestures (`vend steer`, `vend work`), funds the budget,
  authorizes the spend, and adds the real dishes in the EmDash admin.
- **Diner — the partner.** Opens the menu on their phone and orders the week's dishes — the
  non-dev end-user the render is for.

---

_This file is **intent**, not demand. The board starts **empty**; the first move is to cast
`vend steer` over this seed. What you'll see when you do is sketched in `README-STACK.md`._
