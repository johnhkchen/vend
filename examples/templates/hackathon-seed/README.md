# Hackathon seed — drive it with vend

Turn a **one-line idea** into a work-graph board you can *see* — and a first cleared slice —
in one short session. You design the loop instead of sitting in it.

**This drive is for a pair:** a **dev** (the driver — runs the gestures, funds the budget)
and a **designer** (the partner — reads the board, frames the forks, watches the work take
shape beside the running app). The designer never has to read the code.

> Want to run the Astro + React app itself, or deploy it to Cloudflare? That's in
> [`README-STACK.md`](./README-STACK.md). This file is the **vend drive**.

---

## What you'll see

The point of the drive is a **picture**. After you cast `vend steer`, vend stages a
work-graph board; `vend svg` renders it — status columns, blocked edges in red — and it
lives **beside your running app** in the browser you already have open:

```
   ┌──────────────────────── your hackathon board ────────────────────────┐
   │                                                                       │
   │   READY            IN-PROGRESS         BLOCKED            DONE         │
   │  ┌────────┐       ┌────────────┐                       ┌──────────┐   │
   │  │ match  │       │ profile    │                       │ scaffold │   │
   │  │ scoring│──────▶│ form (UI)  │                       │ the page │   │
   │  └────────┘       └────────────┘                       └──────────┘   │
   │  ┌────────┐                          ┌────────────┐                   │
   │  │ empty  │ ····· red blocked edge ··▶│ deploy     │                   │
   │  │ state  │                          │ preview    │                   │
   │  └────────┘                          └────────────┘                   │
   │                                                                       │
   └───────────────────────────────────────────────────────────────────────┘
       a sketch — `vend svg` draws the *real* one off YOUR seed
```

That's the whole idea: you watch what the agents are building, you don't wade through code.
*(The board above is an illustration. Your real board comes from your seed — and starts
**empty** until you cast the first play.)*

---

## The drive

Five gestures from a folder to a cleared slice:

```bash
# 1. Copy this seed and make it yours
cp -r examples/templates/hackathon-seed my-hack && cd my-hack
lisa init                       # if it isn't a lisa project yet

# 2. Lay the vend wiring over it (board, charter, shelf — starts empty)
vend init --template hackathon

# 3. Is everything wired? (lisa, claude, BAML)
vend doctor                     # green = good to go

# 4. Write your idea — the ONE thing you author
$EDITOR SEED.md                 # replace the example with your one line

# 5. Read the seed → a board AND the real forks
vend steer --budget 600000,400000
#   → review the board with your partner; answer the handful of forks

# 6. Clear the first slice, on a budget
vend work --budget 1800000,1000000

# 7. See it — render the board to a picture, then open /board beside your app
vend svg --seat designer          # or: npm run board → writes .vend/work-graph.svg
#   → open the /board route in the running app (npm run dev / preview); the picture
#     lives beside it, in the browser you already have open. Re-run + refresh to update.
```

> **Budgets are `<ms>,<tokens>`** — e.g. `600000,400000` is ~10 minutes / 400k tokens.
> Omit `--budget` on `vend work` and it funds the **calibrated cold-start clear** — the p90
> per-clear price `vend` prints as a quote (measured from your run-log once it has history; a
> generous cold-start estimate until then). Pass an explicit `--budget` for a longer walk-away.

## What each gesture gives you

| Gesture | What it does |
| --- | --- |
| `vend init --template hackathon` | lays the vend wiring over the seed (board, charter, shelf) — **empty**, no demand |
| `vend doctor` | preflight — are lisa / claude / BAML green? |
| `vend steer` | reads `SEED.md` → a ranked **board** + the real **forks** (the decisions) |
| `vend work` | spends a budget down across the board, clearing slices until a clean stop |
| `vend svg` | renders the live board to a **picture** — the designer's window |

> **The picture, beside the app.** `vend svg` (or `npm run board`) writes the board to
> `.vend/work-graph.svg`; the seed's **`/board`** route displays it — a **read-only static
> snapshot** beside the running app. Re-run `npm run board` and refresh to update it. The
> view only *displays* the board; it never mutates the graph (E-055/E-056 one-way authority).

Reaching for the right play, in order: see [`shelf-note.md`](./shelf-note.md). (Or run
`vend shelf` for the live, ranked menu.)

## The one thing you edit

[`SEED.md`](./SEED.md) — one line of intent. Everything else is a cast, not a file you write.

## What "good" looks like

[`EXPECTED-OUTCOME.md`](./EXPECTED-OUTCOME.md) — the target a good drive hits: a coherent
ranked board off your seed, a handful of genuine forks, and ≥1 cleared slice.

---

## Honest boundaries

- **The board starts empty.** The wiring adds structure + a charter + your seed — never
  demand. The first real move is casting `vend steer`.
- **`vend init --template` is the wiring seam.** It overlays this seed onto a vend project;
  it adds files, never clobbers, and seeds no work.
- **Cloudflare deploy is config + a green build, not a live deploy here.** No credentials
  ship in this seed — you set your own and push (see [`README-STACK.md`](./README-STACK.md)).
- **The live drive is metered.** `vend steer` and `vend work` spend real time and tokens —
  the dev funds and authorizes the budget. Budget is a hard contract, both ways.
