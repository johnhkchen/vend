# `.emdash/` — the kitchen seed's content type

> The `Dish` content type + one example dish, authored as an EmDash **seed file**
> (T-062-01-01, epic E-062). This is the content the cook fills.

## What `seed.json` declares

EmDash defines content types in the **database, not in code** — a fresh site is bootstrapped
by this `.emdash/seed.json`, which EmDash **applies on first boot when the database is empty**.
It declares:

- **The `Dish` content type** (`collections[0]`, slug `dishes`) with three fields:
  - **`name`** — `string`, **required** (every dish needs a name).
  - **`photo`** — `image` (uploaded to the media library; the example uses a placeholder
    reference, no binary is shipped).
  - **`description`** — `text` (a short, appetizing line).
- **Exactly one example dish** (`content.dishes`) — *honest-empty* format documentation, not
  fabricated demand. It exists to show the shape; **the cook adds real dishes in the EmDash
  admin and edits or deletes this one.**

## What this is NOT

- **Not a live server.** No EmDash admin / D1 / REST runs in vend's gate — the seed is the
  contract EmDash materializes, and `src/kitchen/dish-seed.test.ts` validates that contract
  (the same "config present, not live" honesty the seed's Cloudflare config carries).
- **Not the menu render.** Reading these dishes and rendering the mobile-first menu at `/` is
  the slice your first `vend work` drive **clears** — it is deliberately unbuilt here.

## After you clone

1. Run the site; EmDash applies this seed on first request and the **`Dishes`** type appears
   in the admin with the one example dish.
2. Add your real dishes (photo, name, description). Delete the example.
3. Drive: `vend steer` → board, then `vend work` clears the menu-render slice.
