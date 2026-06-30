# Expected board — the kitchen gold-master board (recorded for the gold-master diff)

> ⚠️ **NOT YET CAPTURED — the live ranking is the human-authorized metered cast (T-062-03-03, P7).**
> This is the **expected/target** board, not a captured live result. The **deterministic half** —
> that the seed-intent + tuned charter reach `vend steer` on the *materialized* seed — is **proven
> for free** in this ticket (`steer-input.proof.txt` + `src/kitchen/seed-steer-seam.test.ts`). The
> **live ranking** (does the model, given this input, rank the menu-render slice on top?) is the one
> metered cast T-062-03-01 does **not** run — `vend steer` has no offline path. T-062-03-03 captures
> the real board and fills the `⟪…⟫` slots; T-062-04-01 freezes the full `EXPECTED-OUTCOME.md`.
> Do **not** fill any `⟪…⟫` with a guess — a number that was not observed must stay `⟪…⟫`.

This file is the **board component** of the kitchen gold master — the re-runnable consistency bar
the later drive is diffed against. "Comparable, not identical" is the bar (the consistency contract):
the live board should rank the **menu-render slice on top**, grounded in `SEED.md`.

---

## Headline — the seam is closed; the live ranking is pending

The E-058/A3 root cause was input wiring: the seed-intent never reached steer. For the **kitchen**
seed that gap persisted after T-062-02-01 (the overlay shipped the Dish type + storefront but **no
`SEED.md`** and only the **generic** charter stub). T-062-03-01 closes it: `vend init --template
kitchen` now lays a `SEED.md` (the cook's menu intent) **and** a kitchen-tuned
`docs/knowledge/charter.md`, so `assembleSteerInputs` emits a `## Stated intent (SEED.md)` section
and grades the board against the kitchen value function — **proven deterministically, zero spend**
(see `steer-input.proof.txt`). The honest-empty rule no longer has grounds to fire on a flat
snapshot. The remaining half — that the model stages a coherent board with the menu-render slice on
top — is the metered cast captured below.

---

## What the drive should yield

| What | Target | Actual (live) |
| --- | --- | --- |
| SEED.md + kitchen charter reach steer (FREE, deterministic) | present | **✅ present** — proven, $0.00 (`steer-input.proof.txt`, `seed-steer-seam.test.ts`) |
| Highest-ranked slice | the **menu-render** slice (Keystone) | ⟪tier + `what` of `signals[0]` from the live cast — confirm it is the menu render⟫ |
| Board coherence | a ranked, grounded set (not junk, not self-referential) | ⟪N signals, Keystone→Leaf, each grounded in SEED.md / a seed file⟫ |
| Forks framed | a handful of genuine ones (or honest-empty) | ⟪N forks, each recommendation-first⟫ |
| Budget spent (tokens, ms, $) | within the funded envelope | ⟪steer: … tok / … s / $…⟫ |

---

## The expected board (the target — leverage-ordered, grounded)

A minimal coherent board read off the materialized seed. The invariants this ticket **pins in the
gate** (`seed-steer-seam.test.ts` block C): `signals[0]` is the menu-render slice at **Keystone**,
the board is leverage-ordered (non-increasing tier), and every signal is grounded — so it **clears**
the three steer gates (read-never-invent → fork-genuineness → leverage-rank).

1. **Keystone — Render the dishes menu at / — read Dish content from EmDash's REST API and show one
   mobile-first card per dish (photo, name, description), replacing the coming-soon stub.**
   *Why:* the whole point of the seed — the diner opens `/` on their phone and sees the week's
   dishes; nothing showable exists until this clears.
   *Grounding:* `SEED.md` "## The first slice — render the menu"; `src/pages/index.astro` stub ("the
   menu is the slice vend work clears"); the `Dish` type in `.emdash/seed.json`.
   *Budget:* ~1 block (≈2h). *Readiness:* ready. **← the menu-render slice / index 0.**

2. **Standard — Deploy the storefront to Cloudflare (wire the cook's account secrets and push).**
   *Why:* the deploy path is config-present but inert without secrets and renders nothing until the
   menu exists — lower leverage than the render itself.
   *Grounding:* `wrangler.toml` + `astro.config.mjs` cloudflare adapter + `.github/workflows/deploy.yml`.
   *Budget:* small (~1h). *Readiness:* blocked — the menu render must exist first; the cook's secrets.

### The genuine fork (verbatim)

> **Fork — Fetch the dishes at build time (SSG) or per request (SSR on Cloudflare)?**
> Options: (1) Build-time (SSG): fetch dishes during `astro build`, re-deploy on menu changes;
> (2) Request-time (SSR): fetch dishes on each visit via the Cloudflare adapter.
> *Why it matters:* it sets how fresh the menu is and how the cook publishes changes — SSG is fast
> and cheap but needs a re-deploy per edit; SSR shows edits instantly but runs a worker fetch per
> visit. *Vend recommends:* SSR on the Cloudflare adapter the seed already configures — the couple
> edits dishes often, and instant freshness beats a re-deploy step for a two-person menu.

_(The board's gate-clearing + menu-render-on-top are the pinned invariants; this fork is illustrative
of the kind of genuine decision steer surfaces, not a load-bearing assertion of this ticket.)_

---

## Re-run block (the consistency bar)

```bash
SANDBOX=$(mktemp -d "${TMPDIR:-/tmp}/vend-kitchen-drive-XXXX")
VEND=$PWD/src/cli.ts
( cd "$SANDBOX" && bun run "$VEND" init --template kitchen )     # lays the seed incl. SEED.md + kitchen charter
( cd "$SANDBOX" && bun run "$VEND" doctor )                      # green (T-062-02-02)
# THE METERED CAST (human-authorized, P7) — the live ranking T-062-03-03 captures:
( cd "$SANDBOX" && bun run "$VEND" steer --budget 2400000,400000 ) # → board staged at docs/active/pm/staged/steer.md
#   → expect the menu-render slice ranked highest (Keystone), grounded in SEED.md.
```

---

## Why this exists

The point of vend is that the *clearing* is repeatable. This is the board half of the kitchen gold
master — the bar the live drive (T-062-03-03) and the frozen `EXPECTED-OUTCOME.md` (T-062-04-01) are
measured against. The seam (intent reaches steer) reads **green deterministically** here; the live
ranking is the one authorized cast that turns the `⟪…⟫` rows green.
