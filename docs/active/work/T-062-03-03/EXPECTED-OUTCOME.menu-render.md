# EXPECTED-OUTCOME — the menu-render slice (kitchen seed)

> ⚠️ **The DETERMINISTIC half (clauses 1+2) is CAPTURED now, for free, offline.** The **metered half**
> (clause 3 — a live `vend work` run landing inside the cold-start budget in `runs.jsonl`) is the
> **human-authorized drive** and is recorded as `⟪…⟫` slots — never a fabricated Actual
> (honest-on-outcome). T-062-04-01 rolls this into the frozen epic `EXPECTED-OUTCOME.md`.

**Slice:** the gold-master board Keystone (`docs/active/work/T-062-03-01/expected-board.md`):
> *Render the dishes menu at `/` — read Dish content from EmDash's REST API and show one mobile-first
> card per dish (photo, name, description), replacing the coming-soon stub.*

**Subject:** the materialized `vend init --template kitchen` workspace (EmDash + Astro seed).
**AC (three clauses):** (1) `/` renders a mobile-first one-card-per-dish menu sourced from EmDash's
REST API, matching the example dish; (2) `astro build` is green; (3) the run lands inside the cold-start
budget in `runs.jsonl`.

---

## Clauses 1 + 2 — CAPTURED (free, offline)

### Clause 1 — one-card-per-dish from REST, matching the example dish

Proven by `src/kitchen/menu-render.test.ts` (8 tests / 4 blocks, addon-free) over vend's pure render
spec `src/kitchen/menu-render.ts`, which **reuses `dish-seed.ts`'s REST record shape** (`EmDashRecord`
/ `dishRecords` — "what EmDash materializes into the DB and serves via REST"). So the render is sourced
from the same REST model the seed contract is graded against — one source of truth.

```
parseKitchenSeed(<the authored .emdash/seed.json>)
  → dishesFromSeed(seed).length          == 1            # honest-empty: exactly one example dish
  → menuCards(dishes)                     == [ {                       # published only, REST order
        name: "Sample Dish (edit or delete me)",
        photo: "/media/sample-dish.jpg",
        description: "…documents the Dish format…",
      } ]                                                  # one card per dish
  → renderMenu(cards)  contains  '<article class="dish-card"'  ×1       # one card
                       contains  "Sample Dish (edit or delete me)"      # the example dish's name
                       contains  'src="/media/sample-dish.jpg"'         # the example dish's photo
  renderMenu([])       contains  "No dishes on the menu yet"            # honest-empty on zero (IA-4)
  renderMenu(<text with & < > " '>)  → escaped                          # no markup injection
```

This is clause 1, deterministically, on the **real authored seed**: one mobile-first card per dish,
each carrying photo / name / description, matching the seeded example dish.

### Clause 2 — `astro build` green (REAL, not deferred)

The gold-master reference page `docs/active/work/T-062-03-03/menu-render.index.astro` (the SSR menu the
live drive should produce — request-time EmDash REST `fetch`, fallback to the seeded example, mobile-
first) was **actually built** with the seed's installed toolchain. See `build.proof.txt`:

```
astro v6.4.8  ·  adapter @astrojs/cloudflare  ·  output: "server"
[build] ✓ Completed   ·   Server built in 1.22s   ·   [build] Complete!
exit_code: 0   ·   dist/server present: yes   ·   dist/client present: yes
```

The committed template stub was backed up and **restored byte-for-byte** — the template tree is
unchanged (the stub stays the cook's slice). A drift guard (`menu-render.test.ts` block D) pins the
reference page to the spec, so the built page and vend's spec of it cannot silently diverge.

---

## Clause 3 — the live budget line — PENDING (the human-authorized `vend work` drive)

`vend work` has **no offline path** (`castWork` always dispenses a real prompt) and the run is
**non-deterministic + metered**. The cold-start budget is E-060's calibrated default envelope
(`--budget` omitted ⇒ `coldStartEnvelope`, the p90 value-tier quote). "Lands inside" ⇒ a `runs.jsonl`
record with `outcome:"success"`, `totalTokens(rec) ≤ envelope.tokens`, `wallClockMs(rec) ≤
envelope.timeMs` — i.e. it cleared **without** tripping `budget-exhausted` / `timed-out`.

| What | Target | Actual (live) |
|---|---|---|
| `vend init --template kitchen` scaffolds the seed | `scaffolded` (stub `index.astro` present) | ⟪…⟫ |
| `vend steer` ranks the board (menu-render Keystone) | top slice = menu render (see expected-board.md) | ⟪…⟫ |
| `vend work` clears the menu-render slice | `/` renders one card per dish from REST | ⟪…⟫ |
| the produced `index.astro` ≈ the gold-master reference | comparable (not identical) — consistency bar | ⟪…⟫ |
| `astro build` in the cleared workspace | green (exit 0) | ⟪…⟫ |
| decompose/work `runs.jsonl` `outcome` | `success` | ⟪…⟫ |
| `totalTokens(rec)` vs `envelope.tokens` | `≤` (inside budget) | ⟪… tok / envelope … tok⟫ |
| `wallClockMs(rec)` vs `envelope.timeMs` | `≤` (inside budget) | ⟪… ms / envelope … ms⟫ |
| any `budget-exhausted` / `timed-out` record | **none** | ⟪…⟫ |
| cost | within the funded envelope | ⟪$…⟫ |

Do **not** fill any `⟪…⟫` with a guess — a number that was not observed must stay `⟪…⟫`.

---

## Re-run block (T-062-03-03 / T-062-04-01 will meter this)

On a fresh machine, in an empty dir (the cook's cold-start state):

```bash
SANDBOX=$(mktemp -d "${TMPDIR:-/tmp}/vend-kitchen-menu-XXXX")
VEND=$PWD/src/cli.ts
( cd "$SANDBOX" && bun run "$VEND" init --template kitchen )   # FREE — lays the seed (index.astro stub)
( cd "$SANDBOX" && bun run "$VEND" doctor )                    # FREE — green (T-062-02-02)
# THE METERED CAST (human-authorized, P7) — clause 3 captures this:
( cd "$SANDBOX" && bun run "$VEND" steer )                     # METERED — board: menu-render Keystone
( cd "$SANDBOX" && bun run "$VEND" work )                      # METERED — clears the menu-render slice
#   --budget omitted ⇒ the calibrated cold-start envelope (E-060 #2)
# confirm the clear + the budget bound:
( cd "$SANDBOX" && bun run dev )   # eyeball: one mobile-first card per dish at /, matching the example
( cd "$SANDBOX" && bun run build ) # green astro build in the cleared workspace
jq -c 'select(.outcome=="success") | {play,outcome,env:.envelope,usage}' "$SANDBOX/.vend/runs.jsonl"
grep -E '"outcome":"(budget-exhausted|timed-out)"' "$SANDBOX/.vend/runs.jsonl"  # MUST be empty
```

Expected: `vend work` clears the menu-render slice, `/` shows one card per dish sourced from EmDash's
REST API (the seeded example until the cook adds real dishes), `astro build` is green, and the run's
`runs.jsonl` line carries `outcome:"success"` with `totalTokens ≤ envelope.tokens` and `wallClockMs ≤
envelope.timeMs` — **zero** `budget-exhausted` / `timed-out` rows.

---

## Honest-on-outcome footer

This artifact records the menu-render slice's **deterministic half as fact** (the render contract,
locked by `menu-render.test.ts`; a real green `astro build`, `build.proof.txt`) and its **metered half
as an explicit pending slot** (the live `vend work` budget line, `⟪…⟫`) for the human-authorized drive.
The reference page is the **gold-master target** (the consistency bar — comparable, not identical), not
a claim the model produced it. No live number was invented. If a future change breaks the render
contract or the reference page's build, `menu-render.test.ts` / `build.proof.txt` fail loudly and this
record's premise is void.
