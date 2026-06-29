# Shelf note — which play to reach for first

`vend shelf` is your live, context-aware menu — it ranks the plays against your project's
current state. This note is the short version: the three gestures that take you from a
one-line seed to a slice you can see, in drive order.

---

## 1. Read the seed → a board

You wrote one line in `SEED.md`. Two plays turn it into a work-graph board:

- **`vend survey`** — the cold-start bootstrap. Reads the whole project and stages a
  **ranked board** (the *what*).
- **`vend steer`** — one scale up. Reads it and stages a board **and the real forks** (the
  *decisions* only a human can make). On a fresh seed, reach for **`steer`** first — the
  forks are where you, the pair, steer the hack.

```bash
vend steer --budget 600000,400000      # ~10 min, ~400k tokens — board + forks off your seed
```

## 2. Clear the first slice

- **`vend work`** — fund a budget once, walk away, and let vend spend it down across the
  ranked board until a clean stop. Omit `--budget` and it funds the **calibrated cold-start
  clear** — the p90 per-clear price vend quotes (measured from your run-log once it has history;
  a generous estimate until then). It clears the staged steer board (falling back to the survey board).

```bash
vend work --budget 1800000,1000000     # ~30 min, ~1M tokens — clear the first slice, gated
```

The driver (a dev) funds and authorizes this spend — it's a hard contract, both ways (H3).

## 3. See it

- **`vend svg`** — render the live board to a picture: status columns, blocked edges in red.
  This is the designer's window — the board beside the running app.

```bash
vend svg --seat designer --out board.svg
```

---

**Ordering recap:** `vend doctor` (deps green?) → `vend steer` (board + forks) → review the
board with your partner → `vend work` (clear a slice) → `vend svg` (see it). The full
annotated drive is in `README.md`.
