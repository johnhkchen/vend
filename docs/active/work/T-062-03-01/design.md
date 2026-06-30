# T-062-03-01 — Design

Decisions, options weighed, and the rationale — grounded in the research. The shape of the work,
not the code.

## The problem, restated

The materialized kitchen seed does **not** carry the seed-intent the E-059 wire reads: the overlay
ships no `SEED.md` and leaves the **generic** charter stub at `docs/knowledge/charter.md`. So
`vend steer` on the scaffolded workspace sees a generic value function + an empty snapshot and has
nothing to rank a menu-render board off. The ticket asks us to (1) make the seam reach steer on the
real scaffold and (2) record the resulting board (top = menu-render) for the gold-master diff —
without running the metered live cast, which belongs to T-062-03-03.

## Decision 1 — close the seam by adding `SEED.md` + a tuned charter to the kitchen overlay

**Chosen: mirror the `hackathon` overlay — add two overlay entries: `SEED.md` and an override of
`docs/knowledge/charter.md`, both text-embedded from `examples/templates/kitchen-seed/`.**

Options considered:
- **(A) `SEED.md` only.** Adds the intent section to the snapshot, but steer still grades against
  the *generic* charter stub ("author your value function here"). The board could still come back
  weak/abstaining because the value function says nothing about a usable menu. Rejected: half a fix;
  the hackathon A3 close needed **both** the SEED wire *and* the tuned charter (EXPECTED-OUTCOME.md
  finding #1).
- **(B) `SEED.md` + tuned charter override.** Exactly what `hackathon` does (`init-core.ts:267-270`).
  The charter override wins over the base stub via `mergeManifests` (override-in-slot, same path),
  so steer reads the kitchen value function; the `SEED.md` adds the `## Stated intent` section.
  **Chosen.**
- **(C) Make steer's snapshot include the Dish `seed.json` / storefront.** Rejected: steer
  deliberately forces `srcFiles: []` and snapshots *names, not contents* (charter criterion 1,
  overproduction). Changing the engine to special-case kitchen violates engine⊥play and is out of
  scope — the seam is `SEED.md`, by design.

Why this is in-scope (not T-062-02-01's or T-062-03-04's): the ticket is literally
*confirm-seed-intent-reaches-steer*; the intent reaching steer **is** the `SEED.md`+charter wire.
T-062-02-01's AC named only Dish/storefront/Cloudflare (done, no regression). T-062-03-04 fixes
frictions surfaced **during the live drive** — this is the upstream seed→steer wire the drive
depends on.

**Doctrine check (kitchen-overlay header):** both additions are **vend-owned paths** (not lisa
markers — no `CLAUDE.md`/`.lisa.toml`), carry **zero demand rows** (intent/charter prose, not a
`vend chain "…"` pull line), so **one-way-to-lisa** and **honest-empty** hold — identical to how
`hackathon` adds the same two file kinds.

**Embed mechanism:** author `examples/templates/kitchen-seed/SEED.md` and
`examples/templates/kitchen-seed/charter.md` as real `.md` files, `import … with { type: "text" }`
into `kitchen-overlay.ts` (the established kitchen mechanism — the file *is* the source, drift-free,
binary/escape-safe under `bun build --compile`). `.md` resolves natively under tsc
`moduleResolution:bundler`, so no `seed-text-modules.d.ts` shim is needed. This is **more drift-safe
than hackathon's inlined `HACKATHON_CHARTER` const** (which needs a separate drift test); here the
embedded bytes *are* the authored bytes by construction.

## Decision 2 — the SEED.md content makes menu-render the obvious keystone

`SEED.md` carries the cook's one-line intent (brief §"`SEED.md`"): a home-kitchen menu the couple
orders from, the two roles (cook/dev driver, diner partner), and — critically — that the **diner
storefront menu is the first thing to build** (the storefront is a deliberate stub;
`index.astro`'s own header says "The menu itself is the slice `vend work` clears"). So the intent
points unambiguously at the menu-render slice as the highest-leverage move. The charter encodes
"valuable = a real, usable menu the couple will actually order from" so steer ranks the *menu*, not
scaffolding. This is what grounds the AC's "highest-ranked slice is the menu-render slice."

Honest-empty is preserved: `SEED.md` states **intent**, not demand; it adds no board row. The board
stays empty until a cast populates it.

## Decision 3 — prove the seam deterministically, in the gate

**Chosen: a new bun test `src/kitchen/seed-steer-seam.test.ts` that scaffolds a kitchen workspace
and asserts the intent + tuned charter reach the steer snapshot, using the *exact* addon-free
functions `assembleSteerInputs` composes.**

`assembleSteerInputs` lives in `steer.ts`, which value-imports the BAML addon — a bun test must not
import it (the flaky-addon rule). But the pieces it composes are addon-free and individually
importable:
- `runInit` (`init-effect.ts`) — scaffold the real merged manifest into a temp dir.
- `readFile(SEED_PATH)` + `readFile(CHARTER_PATH)` — the same reads the assembler does.
- `buildProjectSnapshot({ root, srcFiles: [], stories, tickets, intent })` (`project-context.ts`,
  PURE) — the **identical** snapshot builder, called with the identical arguments.

So the test reconstructs the assembler's *observable output* (the `project` snapshot + the
`charter`) faithfully, with zero BAML, zero spend. Assertions:
1. The scaffolded workspace **has** `SEED.md` and a **non-stub** `docs/knowledge/charter.md`
   (byte-equal to the authored sources — the house drift pin).
2. The snapshot **contains** `## Stated intent (SEED.md)` and the menu-render intent text — i.e.
   the intent **reaches** steer (the E-059 wire, on the materialized seed).
3. The charter the assembler would read is the **kitchen** value function (contains the
   menu/couple language), **not** the generic `CHARTER_STUB`.

Options considered:
- **(A) Only a one-off `steer-input.proof.txt`** (T-059-03's literal artifact, generated by running
  the real `assembleSteerInputs` in a throwaway script — no spend since no `b.request`). Useful as a
  human-readable trail artifact but **not gated** (won't red on regression). Rejected as the
  *primary* proof.
- **(B) Gated bun test over `buildProjectSnapshot`.** Catches a regression (someone drops the
  overlay entry, or the snapshot omits intent) in `bun run check`. **Chosen as primary.**
- I will **also** generate a `steer-input.proof.txt` in the work dir during Implement (running the
  real `assembleSteerInputs` once, no spend) as the human-readable trail — belt and suspenders,
  matching T-059-03 — but the **gate** is the bun test.

## Decision 4 — record the gold-master board, honestly labeled, with the live half deferred

**Chosen: record the expected board two ways — (a) a typed `Steer` fixture proven gate-valid +
menu-render-on-top *in the test*, and (b) a human-readable `expected-board.md` in this ticket's work
dir, in the T-059-03 positive-scaffold form (`⟪…⟫` slots for the live "Actual", `⚠️ NOT YET
CAPTURED` banner).**

- **(a) The typed fixture** (`steer-core.test.ts` style) encodes the expected board: `signals[0]` is
  the menu-render slice at `Keystone`, grounded; a small non-increasing tail; forks honest. The test
  asserts `clear(board).status === "clear"` **and** `signals[0]` is the menu-render slice
  (`tier === Keystone`, `what` matches the render slice). This is the machine-checkable record: the
  board the seam *should* produce is a **valid, leverage-ordered, menu-render-topped** board.
- **(b) `expected-board.md`** is the diffable gold-master artifact the AC's "recorded for the
  gold-master diff" names — the board T-062-03-03's live cast and T-062-04-01's EXPECTED-OUTCOME.md
  are compared against. It is **honest-on-outcome**: clearly a **target/expected** board pending the
  authorized live cast, not a captured result. I will **not** fabricate live numbers.

**Boundary with T-062-04-01:** that ticket owns the full `EXPECTED-OUTCOME.md` in the **epic** work
dir, capturing the cleared board + rendered menu + budget **after the live drive**. This ticket
records only the **board component**, in **its own** work dir, as the bar that drive fills in. No
overlap, no preemption.

### The expected board (content sketch — finalized in Structure)

Grounded in the seed's actual state, leverage-ordered, honest-empty respected:
1. **Keystone — render the dishes menu at `/`**: read `Dish` records from EmDash's REST API and
   render a mobile-first menu (one card per dish: photo, name, description), replacing the stub.
   *Grounding:* `SEED.md` intent + the `index.astro` stub's own "the menu is the slice vend clears"
   + the Dish type in `.emdash/seed.json`. *The menu-render slice — index 0.*
2. **Standard — deploy the storefront to Cloudflare**: the adapter/`wrangler.toml`/`deploy.yml` are
   config-present but inert without the cook's secrets; lower leverage (nothing renders to deploy
   yet). *Grounding:* `wrangler.toml` + `.github/workflows/deploy.yml`.

Forks: **one genuine fork** is defensible — *fetch dishes at build-time (SSG) or request-time
(SSR/Cloudflare)?* — a real Astro+Cloudflare trade-off (2 distinct options + a recommendation), or
**no forks** (clear path) if we judge the render-first path obvious. I lean to **one fork**
(records that the seam surfaces real decisions) but will keep the board's *gate-clearing* and
*menu-render-top* the invariants the test pins; the fork is illustrative, not load-bearing.

## Decision 5 — scope discipline

In: the two overlay files + entries, the seam test, the recorded board artifact, a no-spend proof
artifact. **Out:** any live cast (T-062-03-03), the graceful-degrade-without-MCP path
(T-062-03-02), the `vend work` render (T-062-03-03), the full epic EXPECTED-OUTCOME.md
(T-062-04-01), and any engine change. Right-sized per PE-7: this is a seed-wire + a confirm test +
a recorded bar, reusing the shipped E-059 seam.

## What could go wrong (and the mitigation)

- **The live board may rank differently than the recorded expected board.** That is *expected and
  honest* — the recorded board is the **target/bar**, and "comparable, not identical" is the
  consistency contract (memory: `vend-consistency-contract`). T-062-03-03 captures the real ranking
  and notes deltas. The deterministic claim (intent reaches steer) is the only thing asserted as
  *fact* here, and it is gated.
- **Adding a charter override could surprise the idempotency/no-clobber tests.** Mitigated:
  `init-kitchen.test.ts` computes `MERGED.length` dynamically and iterates `SCAFFOLD_MANIFEST` for
  presence — a charter override replaces in-slot (no length change) and `SEED.md` is overlay-only
  (+1), both handled. I will run the full suite.
