# T-062-03-03 — Research

**Ticket:** `drive-work-clears-menu-render-slice` (S-062-03, E-062: kitchen-emdash-dress-rehearsal).
**Phase:** Research. Descriptive — what exists, where, how it connects. No solutions here.

## The ticket, restated

Run the human-authorized metered cast: `vend work` clears the **single menu-render slice** — read
`Dish` from EmDash's REST API, render a mobile-first menu (one card per dish: photo / name /
description) within the E-060 cold-start budget.

**Acceptance criterion (three clauses):**
1. the storefront root renders a mobile-first one-card-per-dish menu **sourced from EmDash's REST
   API** (matching the example dish);
2. `astro build` is **green**;
3. the run **lands inside the cold-start budget** in `runs.jsonl`.

## Where this sits in E-062

E-062 is the **dress rehearsal** (memory `kitchen-dress-rehearsal-then-cleanroom`): harden the
bootstrap here; the hands-off clean-room drive is the real forward-E1 proof. The three sibling
S-062-03 tickets are all **confirm + record**:

- **T-062-03-01** (done) — proved the seed-intent → steer seam on the materialized seed and recorded
  the **gold-master board** (`expected-board.md`): the **menu-render slice is the Keystone** (index 0).
  The board's verbatim Keystone (`expected-board.md:51`) IS this ticket's slice:
  > *Render the dishes menu at `/` — read Dish content from EmDash's REST API and show one mobile-first
  > card per dish (photo, name, description), replacing the coming-soon stub.*
- **T-062-03-02** (done) — confirmed graceful degrade without codebase-memory-mcp; recorded
  `EXPECTED-OUTCOME.degrade.md` with the metered half as `⟪…⟫`.
- **T-062-03-03** (this) — the slice those two pointed at. The board's top slice, actually built.

Both predecessors established the **house honest-on-outcome pattern**: prove the *deterministic half*
in the gate (a `src/kitchen/*.test.ts`), **record** the *metered half* (the live token-spending cast)
as `⟪…⟫` slots in an `EXPECTED-OUTCOME`-form artifact — **never a fabricated Actual** (memory
`honest-on-outcome-discipline`, `expected-outcome-gold-master-pattern`).

## The storefront as it stands (the stub)

`examples/templates/kitchen-seed/src/pages/index.astro` — a **deliberate stub** (T-062-01-02,
decision (b)). Its own header says: *"The menu itself is the slice `vend work` clears: read the
couple's Dish content from EmDash's REST API and render an appetizing, mobile-first menu here (one
card per dish: photo, name, description)."* Today it renders a centered "menu coming soon" placeholder,
fetches nothing, is dependency-free, mobile-first (`<meta viewport>`, single centered `max-width:
28rem` column, system font). **This stub is the template contract** — it stays a stub so the cook's
`vend work` clears the slice in their *scaffolded copy*. Overwriting it would break the seed's
"the menu is the slice vend work clears" promise (README-STACK.md, `.emdash/README.md`).

## The data shape — EmDash's REST model (already in code)

`src/kitchen/dish-seed.ts` (PURE, T-062-01-01) is vend's pure model of the EmDash seed contract +
**the REST list the admin/REST layer serves**:
- `DISH_COLLECTION_SLUG = "dishes"`; `REQUIRED_DISH_FIELDS = {name:"string", photo:"image",
  description:"text"}`; `name` required.
- `EmDashRecord = { id, slug, status, data: Record<string,unknown> }` — **"what EmDash materializes
  into the DB and serves via REST"** (dish-seed.ts:77).
- `dishRecords(seed) = seed.content?.dishes ?? []` — **"the records EmDash's REST list endpoint serves
  for the `dishes` collection"** (dish-seed.ts:116). This is the exact shape a menu render consumes.
- The header explicitly anticipates reuse "by the menu-render slice that `vend work` clears"
  (dish-seed.ts:15).

The **seeded example dish** (`examples/templates/kitchen-seed/.emdash/seed.json` → `content.dishes[0]`):
`{ name:"Sample Dish (edit or delete me)", photo:"/media/sample-dish.jpg", description:"…" }`, status
`published`. EmDash applies this seed on first boot when the DB is empty, so **REST returns exactly
this record** on a fresh site — "matching the example dish" is grounded in this one row.

## The stack (how a render reaches the page)

`README-STACK.md` + `astro.config.mjs`: **Astro `^6.4.8` + `@astrojs/cloudflare@^13.7.0`**, `output:
"server"` (SSR on Workers). README: *"The menu reads EmDash's REST API at request time."* The genuine
fork on the gold-master board (SSG vs SSR, `expected-board.md:67`) is **already decided by the seed
config: SSR** — the page fetches at request time. Version pin is load-bearing: adapter 14 needs astro
7 and breaks the SSR build against astro 6 (README warning; astro.config.mjs:10).

Toolchain confirmed present for an offline build proof: `examples/templates/kitchen-seed/node_modules/
.bin/astro` exists, `astro@6.4.8` + `@astrojs/cloudflare@13.7.0` installed, `dist/{client,server}`
present (the **stub already builds green** — the baseline for the reference page's proof).

## The cold-start budget + runs.jsonl (clause 3)

- `src/log/run-log.ts` — the append-only ledger (`.vend/runs.jsonl`), one JSONL `RunRecord` per run.
  Relevant fields: `outcome` (`success` | `budget-exhausted` | `timed-out` | … `RUN_OUTCOMES`),
  `usage` (4 token sub-counts), `envelope: {timeMs, tokens}` (the allocated ceiling the cast ran
  under), `costUsd`, `reducedGrounding?` (the E-060 degrade marker T-062-03-02 covers).
  `totalTokens(r)` sums the four sub-counts; `wallClockMs(r) = endedAt − startedAt`.
- `src/play/work.ts` + `work-core.ts` + `src/ledger/recalibrate.ts` — `castWork`'s `--budget` omitted
  ⇒ the **calibrated cold-start envelope** (`coldStartEnvelope`, the p90 value-tier quote, E-060 #2).
  "Lands inside the cold-start budget" ⇒ a record with `outcome:"success"`, `totalTokens ≤
  envelope.tokens`, `wallClockMs ≤ envelope.timeMs` — i.e. it cleared *without* tripping
  `budget-exhausted`/`timed-out`.
- This clause is **inherently metered**: it requires a real `vend work` cast spending real tokens.
  There is **no offline path** — `castWork` always dispenses a real prompt (same constraint
  T-062-03-01 hit for `vend steer`, `src/executor/executor.ts`).

## The house test pattern (what's gateable)

Sibling `src/kitchen/*.test.ts` files are addon-free + guarded-live:
- `dish-seed.test.ts` reads the example `seed.json` from disk in the test (the HACKATHON_CHARTER drift
  idiom) and asserts the pure contract.
- `seed-steer-seam.test.ts` reconstructs the steer input addon-free and asserts the recorded board.
- `kitchen-doctor.smoke.test.ts` does `mkdtemp` → `runInit(root,"kitchen")` → spawns the real CLI →
  asserts, torn down in `finally`. **This is the scaffold-a-workspace idiom** a build proof would use.
- `kitchen-degrade.test.ts` pins the degrade resolve on the real seed; records `⟪…⟫` for the metered half.

So the **deterministic, gate-coverable substance** available to this ticket is: (a) a pure model of
the render (one card per dish from the REST record shape, mobile-first, honest-empty on zero) tested
like `dish-seed.ts`; (b) a **real `astro build`** of a reference page (clause 2 is literally runnable
offline against the seed's installed toolchain). The **non-deterministic, metered substance** (clause
3's live `runs.jsonl` budget line) is the human-authorized drive — recorded as `⟪…⟫`.

## Constraints & assumptions surfaced

- **The template stub must remain a stub** — it is the cook's slice. Any reference render is a *work
  artifact / gold-master target*, not a commit into `examples/templates/kitchen-seed/`.
- **No live EmDash in the gate** — same "config present, not live" honesty as the Cloudflare config.
  A render must therefore tolerate an unreachable REST endpoint (fall back to the seeded example, the
  honest-empty row) so `astro build`/preview is green standalone.
- **A scaffolded Astro page can't import vend's `src/`** — the cook's workspace has no `vend/src`. So
  the gate's pure render module is vend's *spec* of the render (mirroring `dish-seed.ts` ↔ `seed.json`),
  and the reference `index.astro` is self-contained.
- **Honest-on-outcome** — clause 3 (live budget line) must not be invented; recorded as `⟪…⟫`.
- **Version pairing** — any astro/adapter touch keeps `astro@^6` ⇄ `@astrojs/cloudflare@^13`.
