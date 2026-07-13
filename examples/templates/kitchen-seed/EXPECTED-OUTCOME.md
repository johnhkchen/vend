# Expected outcome — the kitchen gold master (the frozen consistency bar)

> 🧊 **THE FROZEN CONSISTENCY BAR.** This is the re-runnable bar a later untouched **clean-room**
> drive of this seed is measured against (E-062 phase 2 / forward-E1). It is **honest-on-outcome**: the
> deterministic, free half of the drive is **CAPTURED as fact** (observed, gated, or built); the one
> live, metered, human-authorized line — `vend steer` ranking + `vend work` clearing the slice in
> budget — is recorded as explicit **`⟪…⟫`** slots. **A number that was not observed stays `⟪…⟫`.**
>
> **Provenance of the captured half.** Host: macOS (darwin, arm64). Driver: `src/cli.ts`. The free
> stages (init / doctor / svg) were **re-run live 2026-06-30** in a throwaway sandbox — see the sibling
> proof `docs/active/work/T-062-04-01/free-stages.proof.txt`. The committed template tree was **not
> mutated** (the storefront stub stays the cook's slice). Executor for the *metered* casts (when the
> human authorizes them): `claude` (`claude-opus-4-8`).
>
> This file is the kitchen analogue of `examples/templates/hackathon-seed/EXPECTED-OUTCOME.md` and
> converges to its filled form once the authorized drive fills the `⟪…⟫` in place (the re-run block
> below is exactly how).

---

## Headline — the bootstrap path drives clean and free; one metered line remains

The **shipped** flow — copy this seed → `lisa init` → `vend init --template kitchen` → `vend doctor` →
`vend steer` → `vend work` — drives **clean and free end to end on a fresh seed with no MCP present**
through every deterministic stage: init scaffolds 31 files with zero skips, `vend doctor` is green 3/3,
`vend svg` draws the honest-empty board, the seed-intent + the kitchen-tuned charter reach `vend
steer`, the menu render contract holds, `astro build` is **really** green, and the cold-start path
**degrades** (no `codebase-memory-mcp`) rather than andoning. Each is gated (see the source column).

The **one line that remains** is the live, metered, **human-authorized** cast (P7): `vend steer`
actually ranking the menu-render slice on top, and `vend work` actually clearing it and writing a
`runs.jsonl` line inside the cold-start budget. `vend steer`/`vend work` have **no offline path**, so
that line is honestly `⟪…⟫` here — the human-authorized drive (or the downstream clean-room epic) fills
it via the re-run block. **No live number was invented.**

---

## What the drive yields

| What | Target | Status / value |
| --- | --- | --- |
| `vend init --template kitchen` scaffolds the seed | `scaffolded` | ✅ **31 created, 0 skipped**, exit 0 (`free-stages.proof.txt`) |
| `vend doctor` (workspace cwd) | green | ✅ **ok — 3 checks**: `✓ bun on PATH`, `✓ Astro storefront config present`, `✓ EmDash Dish seed valid` |
| `vend svg` (pre-drive) | honest-empty | ✅ **0 groups, 0 cards, 0 links** (IA-4 — no fake demand before a drive) |
| SEED.md + kitchen charter reach steer | present in the snapshot | ✅ **present** — `SEED.md` at root + overlaid `docs/knowledge/charter.md` (gated: `seed-steer-seam.test.ts`; `T-062-03-01/steer-input.proof.txt`) |
| The render = one mobile-first card per dish, from REST, matching the example | one card per dish | ✅ **captured** — `menu-render.test.ts` (8 tests): the real `.emdash/seed.json` example → exactly one card (name/photo/description); honest-empty on zero; HTML-escaped |
| `astro build` of the menu render | green | ✅ **green** — astro 6.4.8 + @astrojs/cloudflare → exit 0, `dist/{server,client}` (`T-062-03-03/build.proof.txt`) |
| Cold-start degrade without `codebase-memory-mcp` | reduced grounding, not andon | ✅ **captured** — `kitchen-degrade.test.ts`: MCP absent → `reducedGrounding:true`, no `missing-capability` andon |
| Whole path as one composition | green | ✅ **captured** — `cold-start-redrive.test.ts`: init→scaffold→doctor→steer-inputs→degrade→idempotent re-init (25 expects) |
| Full gate | green | ✅ **1488 pass / 1 skip / 0 fail**, `tsc --noEmit` clean (`T-062-03-04`) |
| `vend steer` ranks **menu render** on top (LIVE) | Keystone = menu render | ⟪tier + `what` of `signals[0]` from the live cast⟫ |
| `vend work` clears the slice (LIVE) | `/` renders one card per dish from REST | ⟪…⟫ |
| `runs.jsonl` `outcome` (decompose/work, LIVE) | `success` | ⟪…⟫ |
| `totalTokens(rec)` vs `envelope.tokens` (LIVE) | `≤` (inside budget) | ⟪… tok / envelope … tok⟫ |
| `wallClockMs(rec)` vs `envelope.timeMs` (LIVE) | `≤` (inside budget) | ⟪… ms / envelope … ms⟫ |
| decompose `runs.jsonl` carries `reducedGrounding:true` (LIVE) | present | ⟪…⟫ |
| `budget-exhausted` / `timed-out` / `missing-capability` rows (LIVE) | **none** | ⟪…⟫ |
| cost (LIVE) | within the funded envelope | ⟪$…⟫ |

> Do **not** fill any `⟪…⟫` with a guess. A number that was not observed must stay `⟪…⟫`.

---

## The board (the diff target)

The kitchen gold-master board the live `vend steer` is diffed against (full version:
`docs/active/work/T-062-03-01/expected-board.md`). The bar is **comparable, not identical** (the
consistency contract): the live board should rank the **menu-render slice on top**, grounded in
`SEED.md`. The invariants are pinned in `seed-steer-seam.test.ts` (block C): `signals[0]` is the
menu-render slice at **Keystone**, the board is leverage-ordered, every signal is grounded — so it
clears the three steer gates (read-never-invent → fork-genuineness → leverage-rank).

1. **Keystone — Render the dishes menu at `/`** — read `Dish` content from EmDash's REST API and show
   one mobile-first card per dish (photo, name, description), replacing the coming-soon stub. *Why:*
   the whole point of the seed — the diner opens `/` on their phone and sees the week's dishes; nothing
   showable exists until this clears. *Grounding:* `SEED.md` "## The first slice — render the menu";
   the `index.astro` stub; the `Dish` type in `.emdash/seed.json`.
2. **Standard — Deploy the storefront to Cloudflare** (wire the cook's account secrets and push).
   *Why:* config-present but inert without secrets, and renders nothing until the menu exists — lower
   leverage than the render. *Readiness:* blocked on the keystone + the cook's secrets.

> **Fork — Fetch the dishes at build time (SSG) or per request (SSR on Cloudflare)?** (1) Build-time:
> fetch during `astro build`, re-deploy per menu change; (2) Request-time: fetch per visit via the
> Cloudflare adapter. *Vend recommends:* **SSR** on the adapter the seed already configures — the
> couple edits dishes often, and instant freshness beats a re-deploy step for a two-person menu.

---

## The rendered menu (captured — clauses 1 + 2)

The render is captured deterministically; only its *live production by `vend work`* is `⟪…⟫`.

- **Contract (clause 1).** `src/kitchen/menu-render.ts` is the pure render spec, reusing
  `dish-seed.ts`'s REST record shape (one source of truth). `menu-render.test.ts` (8 tests / 4 blocks)
  proves: the real authored `.emdash/seed.json` example → **exactly one** `dish-card` article carrying
  its name (`Sample Dish (edit or delete me)`), photo (`/media/sample-dish.jpg`), and description;
  published-only / REST order; honest-empty (`No dishes on the menu yet`) on zero; HTML-escaped.
- **Green build (clause 2).** The gold-master reference page
  `docs/active/work/T-062-03-03/menu-render.index.astro` (request-time EmDash REST fetch, fallback to
  the seeded example, mobile-first) was **really built**: astro 6.4.8 + @astrojs/cloudflare 13.7.0 →
  **exit 0**, `dist/server` + `dist/client` emitted (`build.proof.txt`). A drift guard
  (`menu-render.test.ts` block D) pins the page to the spec. The committed stub was restored
  byte-for-byte.

The reference page is the **gold-master target** the clean-room drive's output is diffed against
(comparable, not identical) — not a claim the model produced it.

---

## The graceful degrade (captured)

The fresh cook repo ships **no `.mcp.json`**; the cold-start `vend work` chain's decompose leg
declares `codebase-memory-mcp` **optional** (E-060), so an absent MCP **degrades** (reduced grounding,
recorded) instead of andoning. `kitchen-degrade.test.ts` proves the chain on the real scaffold:
`readProjectMcpServers → []` → `resolveTools(DECOMPOSE_TOOLS, [])` returns `ok:true`,
`reducedGrounding:true`, MCP dropped, read-only built-ins survive; the run record carries
`reducedGrounding:true` across the read boundary; **no `missing-capability`** andon. `vend steer` is a
passthrough cast (declares no tools) and cannot andon on a missing MCP. The **live** decompose line
carrying `reducedGrounding:true` is `⟪…⟫`.

---

## The budget envelope

`vend work` with `--budget` **omitted** funds the **calibrated cold-start envelope**:
`coldStartEnvelope(drivePlays, records, tier, prior)` (`src/ledger/recalibrate.ts`) — the
per-denomination Σ of the drive plays' recalibrated envelopes, **measured from the run-log tails**
(E-060 #2), falling back to the hand `prior` on a fresh ledger. It is the p90 **price** quote (IA-8);
funding headroom is a separate per-cast guard, never folded into the quote.

**"Lands inside the cold-start budget"** ⇒ a `runs.jsonl` record with `outcome:"success"`,
`totalTokens(rec) ≤ envelope.tokens`, and `wallClockMs(rec) ≤ envelope.timeMs` — i.e. it cleared
**without** tripping `budget-exhausted` / `timed-out`. The literal envelope values + the actual spend
are logged on the live run line, so they are `⟪…⟫` until the authorized drive (Research §4).

---

## Residual / honest boundaries (the bar is "clears", not "perfect")

These need live infra beyond this dress-rehearsal bootstrap surface and are escalated to the **proposed
downstream `E-063 kitchen-clean-room-drive`** (T-062-03-04 friction ledger), **not** folded in here:

- **The live metered cast** — `vend steer` ranking + `vend work` clearing the slice in budget. The one
  `⟪…⟫` half of this file; human-authorized (P7); has no offline path.
- **A live EmDash REST round-trip** (D1 / HTTP) — the render is proven against the REST *shape* + the
  seeded example (what REST serves on a fresh boot); a running server is the cook's own deploy.
- **A live Cloudflare deploy** — config-present and build-green here, not a live push (the cook's own).

---

## Re-run block (reproduce a comparable drive; fills the `⟪…⟫` in place)

On a fresh machine, in an empty dir (the cook's cold-start state), with **no** `codebase-memory-mcp`
installed (its expected cook-repo state):

```bash
SANDBOX=$(mktemp -d "${TMPDIR:-/tmp}/vend-kitchen-drive-XXXX")
VEND=$PWD/src/cli.ts                 # or: a brew-installed `vend` (E-061)
( cd "$SANDBOX" && lisa init )
( cd "$SANDBOX" && bun run "$VEND" init --template kitchen )   # FREE — 31 created, 0 skipped
( cd "$SANDBOX" && bun run "$VEND" doctor )                    # FREE — ok, 3 green
( cd "$SANDBOX" && bun run "$VEND" svg )                       # FREE — honest-empty (0/0/0)
# THE METERED CASTS (human-authorized, P7) — these fill the ⟪…⟫ rows above:
( cd "$SANDBOX" && bun run "$VEND" steer )                     # METERED — board: menu-render Keystone
( cd "$SANDBOX" && bun run "$VEND" work )                      # METERED — clears the slice; --budget omitted ⇒ cold-start envelope
# confirm the clear + the budget bound + the honest degrade:
( cd "$SANDBOX" && bun run dev )    # eyeball: one mobile-first card per dish at /, matching the example
( cd "$SANDBOX" && bun run build )  # green astro build in the cleared workspace
jq -c 'select(.outcome=="success") | {play,outcome,env:.envelope,usage,turnsUsed,executorReportedTurns}' "$SANDBOX/.vend/runs.jsonl"
grep '"reducedGrounding":true' "$SANDBOX/.vend/runs.jsonl"                       # decompose's honest degrade marker
grep -E '"outcome":"(budget-exhausted|timed-out|missing-capability)"' "$SANDBOX/.vend/runs.jsonl"  # MUST be empty
```

Expected: `vend work` clears the menu-render slice, `/` shows one card per dish sourced from EmDash's
REST API (the seeded example until the cook adds real dishes), `astro build` is green, and the run's
`runs.jsonl` line carries `outcome:"success"` with `totalTokens ≤ envelope.tokens` and `wallClockMs ≤
envelope.timeMs`, plus `reducedGrounding:true` on the decompose leg and **zero**
`budget-exhausted` / `timed-out` / `missing-capability` rows.

---

## Honest-on-outcome footer

This gold master records the kitchen drive's **deterministic half as fact** — the free stages
re-observed (`free-stages.proof.txt`), the render contract and a real green `astro build`, the degrade,
and the whole-path composition, each gated — and its **single metered line as an explicit pending
slot** (`⟪…⟫`) for the human-authorized drive. The board and the reference render are the **consistency
target** (comparable, not identical), not a claim the model produced them. **No live number was
invented.** If a future change breaks any captured guarantee — the render contract, the reference
page's build, the degrade, the composition, or ships a `.mcp.json` in the overlay — the corresponding
test/proof fails loudly and this record's premise is void. A hackathon demo is a one-shot; the point
of vend is that the *clearing* is repeatable — this file is how that consistency is checked.
