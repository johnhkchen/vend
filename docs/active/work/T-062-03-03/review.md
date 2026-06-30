# T-062-03-03 — Review

**Ticket:** `drive-work-clears-menu-render-slice` (S-062-03, E-062: kitchen-emdash-dress-rehearsal).
**Verdict:** ✅ done — the menu-render slice's **deterministic half is captured as fact** (the render
contract is gated; `astro build` is **really** green) and its **metered half is recorded honestly**
(the live `vend work` budget line as `⟪…⟫`, for the human-authorized drive). This is the slice the
two done predecessors pointed at: T-062-03-01 recorded the gold-master board with the menu-render slice
as **Keystone**; this ticket builds it.

## What changed

| File | Kind | Summary |
|---|---|---|
| `src/kitchen/menu-render.ts` | **new** | PURE render spec — `dishToCard` / `menuCards` / `renderMenu` / `dishesFromSeed`; reuses `dish-seed.ts`'s REST shape. |
| `src/kitchen/menu-render.test.ts` | **new** | 4 blocks / 8 tests / 29 expects: contract, render shape + escaping + honest-empty, the **real seed** example, the reference-page drift guard. |
| `docs/active/work/T-062-03-03/menu-render.index.astro` | **new** (artifact) | the gold-master reference page — SSR, request-time EmDash REST + seeded-example fallback, mobile-first. **Not** a template commit. |
| `docs/active/work/T-062-03-03/build.proof.txt` | **new** (artifact) | captured `astro build` → **exit 0**, `dist/{server,client}` emitted. |
| `docs/active/work/T-062-03-03/EXPECTED-OUTCOME.menu-render.md` | **new** (artifact) | clauses 1+2 CAPTURED, clause 3 PENDING (`⟪…⟫`), re-run block. |
| `docs/active/work/T-062-03-03/{research,design,structure,plan,progress,review}.md` | **new** | the RDSPI trail. |
| `examples/templates/kitchen-seed/**` | **unchanged** | the stub stays the cook's slice (verified restored byte-for-byte after the build proof). |
| engine / CLI / BAML / `run-log.ts` | **unchanged** | clause 3 reads existing ledger fields; nothing added. |

## How each AC clause is met

> After the authorized drive the storefront root renders a mobile-first one-card-per-dish menu sourced
> from EmDash's REST API (matching the example dish), `astro build` is green, and the run lands inside
> the cold-start budget in runs.jsonl.

| Clause | Treatment | Evidence |
|---|---|---|
| 1 — one-card-per-dish from REST, matching the example dish | **captured (gate)** | `menu-render.test.ts` A–C: the pure spec consumes `dish-seed.ts`'s REST record shape; the **real `.emdash/seed.json`** example renders to exactly one card with its name/photo/description. |
| 2 — `astro build` green | **captured (real build)** | `build.proof.txt`: the reference page built with astro 6.4.8 + cloudflare 13.7.0 → exit 0, `dist/server` + `dist/client`. Drift guard (block D) keeps the built page == the spec. |
| 3 — lands inside cold-start budget in `runs.jsonl` | **pending (metered, honest)** | `EXPECTED-OUTCOME.menu-render.md`: every live value `⟪…⟫`; re-run block + the `outcome:"success"` / `totalTokens ≤ envelope.tokens` / `wallClockMs ≤ envelope.timeMs` bound. |

**The one clause not run here** is the literal live `vend work` budget line — `castWork` has no offline
path, the run is non-deterministic + metered, and the drive is human-authorized (P7). So this ticket
captures the deterministic half as fact and records the budget line as the target, exactly mirroring
03-01 (the live ranking) and 03-02 (the live degrade line). **No live number was invented.**

## Why a *reference* render (and why it doesn't overwrite the stub)

The template stub at `examples/templates/kitchen-seed/src/pages/index.astro` is the **cook's slice** —
three files assert "the menu is the slice `vend work` clears." Overwriting it would make the clean-room
drive a no-op and break honest-empty. So the render produced here is the **gold-master target** (the
consistency bar the live drive is diffed against — comparable, not identical), kept as a work artifact
and built green offline. vend's gateable substance is the pure **spec** (`menu-render.ts`) — the same
spec/seed relationship `dish-seed.ts` has with `.emdash/seed.json`. The build proof restored the stub
byte-for-byte; the committed template tree is unchanged.

## Test coverage

- **Strong** on the deterministic contract: one-card-per-dish, published-only/REST-order, photo/
  description-null handling, HTML escaping, honest-empty on zero, and the **real authored seed**
  rendering to one card matching the example dish. The drift guard ties the gold-master page to the spec.
- **Real build**, not a claim: `build.proof.txt` is a captured `astro build` exit-0 with both dist
  trees — clause 2 is fact, not deferred.
- `bun run check` — **1487 pass / 1 skip / 0 fail** (+8, no regression); `tsc --noEmit` clean.

### Gaps / NOT covered (by design)
- **The live metered drive** — `vend steer` → `vend work` actually spending tokens and writing the
  `runs.jsonl` budget line is clause 3, deferred to the human-authorized drive (recorded as `⟪…⟫`;
  T-062-04-01 freezes it). Non-deterministic, needs a Claude login.
- **A live EmDash server** — no D1/HTTP in the gate (config-present honesty); the render is proven
  against the REST *shape* + the seeded example (what REST serves on a fresh boot).
- **The reference page is `docs/`-side**, outside `tsconfig include:[src]` — it has no typecheck of its
  own; its **build** (build.proof.txt) and the **drift guard** (block D) are the house substitutes.

## Open concerns / handoff
- **None blocking.** The contract is gated, the build is green, the record is honest (capture + pending).
- **T-062-04-01** fills clause 3's `⟪…⟫` (the live `vend work` `outcome:"success"` + the in-budget
  `totalTokens`/`wallClockMs`) and rolls this into the frozen epic `EXPECTED-OUTCOME.md`.
- **The clean-room drive** (E-062 phase 2) is where the autonomous executor RE-derives a menu render
  from the stub; this reference page is the bar it is measured against (consistency contract).
- **Watch-for-regression:** if a future change breaks `menu-render.ts`'s contract or the reference
  page's build, `menu-render.test.ts` / a re-run of the build proof fail loudly.
- **Commits left to Lisa** (deliberate) — the working tree carries uncommitted sibling-thread work
  (the whole `examples/templates/kitchen-seed/` tree is untracked). `bun run check` is green over the
  combined tree.

## Reviewer's quick-look
Read `src/kitchen/menu-render.ts` (the spec, ~110 lines) and `menu-render.test.ts` block C (the real
example dish renders to one matching card). Then `build.proof.txt` (exit 0) and
`EXPECTED-OUTCOME.menu-render.md`'s clause-3 table (every live value `⟪…⟫`). The spec, the reference
page, and the record are intentionally aligned — the drift guard (block D) is what keeps them so.
