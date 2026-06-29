# Brief — Kitchen QuickStart seed on EmDash (the E-062 build spec)

> **Build-ready PM brief** for the kitchen dogfood's seed (E-062), MVP-scoped. Elaborates the seed +
> overall implementation strategy from `pm/plan-kitchen-dogfood.md` into a buildable spec, grounded in
> the shipped `vend init --template` seam (E-058), the seed-intent wiring (E-059), the fresh-seed
> graceful-degrade + budget (E-060), and [EmDash CMS](https://github.com/emdash-cms/emdash). Desk-only;
> the actual seed tree is built by the clearing play on pull (the PM writes only to `pm/`). On pull this
> becomes **E-062**.

## One-line intent

A **clone-and-drive seed** that lets a cook/dev turn an empty EmDash project into **their couple's home-
cooking menu, rendered** — in one short drive, on **their own repo**, witnessing vend clear the first
real feature. The experiential proof that a real long-lived app *starts itself* with two gestures.

## Context — where this sits

The kitchen dogfood's **MVP is slice 0: render the couple's menu** (`plan-kitchen-dogfood.md`). The vend
user is the **cook/dev** (technical); the diner is the app's non-dev end-user. Architecture is **EmDash**
(admin/auth/media/REST/D1) + a **custom Astro storefront**; the cook console is the EmDash admin as-is.

**Decision (b) is the heart of the MVP:** the seed ships an EmDash backend the cook can fill with real
dishes, but the **diner storefront menu is intentionally unbuilt** — **vend's first drive CLEARS the
menu-render slice**, so the cook/dev *watches autopilot build the menu* and accrues the first **cleared
forward-E1 on their repo**.

## What gets built (the seed + the first drive)

### A. The seed tree — clone-and-drive (EmDash + Astro + vend-wired)

```
kitchen-seed/
  src/...                 # Astro 6 app w/ the EmDash integration configured (admin, REST, auth, media)
  src/content/Dish.*      # the Dish CONTENT TYPE (name, photo, description, tags; nutrition placeholder)
  src/pages/index.astro   # the diner storefront `/` — a STUB (deliberately unbuilt; vend clears it)
  wrangler / cloudflare   # D1 + R2 binding config; local SQLite in dev
  SEED.md                 # the ONE thing the cook edits — the kitchen idea + the couple + roles
  charter.md              # a charter TUNED to the kitchen domain (a usable home menu over polish)
  shelf-note.md           # which plays to reach for (steer → board; work → clear the render slice)
  EXPECTED-OUTCOME.md     # the gold master: the menu-render slice cleared + the couple's dishes shown
  README.md               # the drive script (brew install → workspace → init → add dishes → steer/work)
```

- **`SEED.md`** — a filled example: *"A home-kitchen menu where my partner orders dishes for the week and
  I cook them"* + the two roles (cook/dev driver, diner partner). The only input the cook authors.
- **`charter.md`** — kitchen-tuned value function: *valuable = a real, usable menu the couple will
  actually order from*; right-sized to a session; gates light but real. Teaches the general clearing move
  while honestly domain-specific.
- **`index.astro` is a stub on purpose (decision b)** — the seed compiles and EmDash works, but `/`
  renders a placeholder. Clearing the render slice is the drive's payoff.
- **Honest-empty:** ship **one** example Dish as format documentation; the couple adds their real dishes
  via the EmDash admin (IA-4 — the seed adds structure + a content type, never fake demand).

### B. The first drive — vend clears the menu-render slice (decision b)

vend's first `steer → work` reads `SEED.md` and clears the slice: **read `Dish` content from EmDash and
render it as an appetizing, mobile-first menu at `/`** (cards with photo + name + description, from the
media library). The cook fills real dishes via the admin; **vend builds the render.**

## The drive (the cook/dev's path)

```
brew install johnhkchen/lisa/lisa johnhkchen/vend/vend     # vend installable — depends on E-063
git clone <kitchen-seed> my-kitchen && cd my-kitchen        # or `vend init --template kitchen my-kitchen`
claude login                                                # their own Claude Code login (no Doppler)
vend init && vend doctor                                    # vend layer + green preflight
# add a few real dishes in the EmDash admin (photos, descriptions)
vend steer                                                  # → board incl. the "render the menu" slice
vend work                                                   # → CLEARS the render slice (cleared forward-E1)
# `/` now renders the couple's dishes as a menu — preview / deploy to Cloudflare
```

## Acceptance criteria

1. The seed stands up on a fresh repo: EmDash admin works, the `Dish` content type is present, the cook
   can add dishes; `vend init` + `vend doctor` green; the app builds (storefront stub included).
2. `vend steer` off the kitchen `SEED.md` yields a **coherent board including the menu-render slice**
   (not junk, not self-referential — the A3-for-EmDash test; de-risked by E-059 + E-044). If the board is
   weak, **record that** (the honest finding).
3. `vend work` **clears the menu-render slice** — a real run-log record + a **cleared forward-E1** — wiring
   `Dish` content → the `/` storefront.
4. The couple's **actual dishes render** as an appetizing, mobile-first menu (photos via the media library).
5. The drive is **comparable to `EXPECTED-OUTCOME.md`** (the gold master — re-runnable consistency bar).
6. It runs on the **cook/dev's own repo** with a **brew-installed vend** (no repo checkout, no Doppler).

## Dependencies & risks

- **Dep — E-063** (brew-installable vend + `make a workspace`). The cook/dev installs via brew; without it
  there's no clean install path. Parallel prerequisite.
- **Dep — E-060** (fresh-seed graceful-degrade + cold-start budget). The cook/dev's repo has **no
  `codebase-memory-mcp`** and a cold-start budget — exactly E-060's two fixes. **E-060 is a prerequisite
  for *any* fresh-seed drive, including this one.**
- **Risk — steer on a new domain *and* a new stack (EmDash/Astro 6).** First test that the articulation
  engine ranks a coherent board for an EmDash project (mirrors E-058's A3, now for EmDash). De-risked by
  E-059 (seed-intent reaches steer) + E-044 (self-ref demotion). Honest-on-outcome if the board is weak.
- **Risk — EmDash v0.1 beta.** The seed pins a version; migrations re-cleared by autopilot as EmDash moves.
- **Risk — charter tuning.** Too generic → flat demo; too specific → stops teaching the general move.
  Calibrate on the first real drive.

## Scope split (v1 vs later)

- **v1 (this pull / MVP):** the EmDash+Astro+vend seed + the **menu-render slice cleared live** → the
  couple's menu renders on their repo. The minimal end-to-end proof.
- **Later (autopilot maturation):** the ordering loop → derived shopping list → prep → nutrition →
  the healthiness read; the deploy-preset shelf generalized into the reusable QuickStart **archetype**
  (X-2); wiring `EXPECTED-OUTCOME.md` into `src/probe` as a CI-gated consistency regression.

## Verify on the machine before/at build (go-and-see)

1. Does `vend steer` off the kitchen `SEED.md` actually produce a coherent board with the menu-render
   slice on top? (The make-or-break A3-for-EmDash moment.)
2. Does **EmDash v0.1** scaffold + run on the seed — admin, the `Dish` content type, the media library —
   from a fresh clone? Reproduce on a sandbox.
3. Does a **brew-installed** vend (E-063) drive the seed cleanly on the cook/dev's repo with *their* Claude
   login and **no Doppler**?
