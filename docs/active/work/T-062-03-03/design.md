# T-062-03-03 — Design

**Phase:** Design. Enumerate approaches, weigh against the Research reality, decide with rationale.

## The core tension

The AC has three clauses with **two different epistemic statuses**:
- Clauses 1+2 (one-card-per-dish from the REST shape, matching the example dish; `astro build` green)
  are **deterministic and verifiable offline** — the seed's toolchain is installed.
- Clause 3 (the run lands inside the cold-start budget in `runs.jsonl`) is **inherently metered** —
  it requires a real `vend work` cast spending real tokens; there is no offline `castWork` path.

The two done predecessors (03-01, 03-02) settled the house answer to exactly this split: **prove the
deterministic half in the gate, record the metered half as `⟪…⟫`, never fabricate an Actual.** This
ticket follows that precedent — the only question is *what* the deterministic half should be.

## Decisions

### D1 — Do NOT overwrite the template stub. The render is a gold-master target.

The stub at `examples/templates/kitchen-seed/src/pages/index.astro` is the **cook's slice** — the seed
ships it as a stub *on purpose* so the cook's `vend work` clears the menu render in their scaffolded
copy. Three files assert this contract (the stub header, README-STACK.md, `.emdash/README.md`).

**Rejected:** committing a finished menu render into the template. It would (a) break the seed's
"the menu is the slice vend work clears" promise, (b) make the clean-room drive a no-op (nothing left
to clear), (c) violate honest-empty (a fabricated full menu where the seed ships one example). The
render this ticket produces is the **gold-master target** — the bar the live drive is diffed against
(consistency contract: comparable, not identical) — kept as a **work artifact**, not a template commit.

### D2 — Lock the render *contract* as a PURE module, mirroring `dish-seed.ts`.

The gateable, deterministic substance of clauses 1+2 is the **render contract**: given the EmDash REST
record shape, produce one mobile-first card per dish (photo / name / description), and an honest-empty
state on zero. Implement this as a pure module **`src/kitchen/menu-render.ts`** that **reuses
`dish-seed.ts`'s `EmDashRecord` / `dishRecords` / `DISH_COLLECTION_SLUG`** — so the render is, by
construction, *sourced from the same REST model* dish-seed.ts already defines ("what EmDash serves via
REST", dish-seed.ts:77/116). Tested by **`src/kitchen/menu-render.test.ts`** like `dish-seed.test.ts`:
reads the real `seed.json` example off disk, asserts the rendered menu carries the example dish's
name/photo/description in one card, mobile-first markers present, zero-dishes → honest-empty.

This is the precise analog of how 03-01/03-02 locked their deterministic seam: a pure
`src/kitchen/*.ts` + an addon-free `*.test.ts` that runs in `bun run check`.

**Why pure (not an Astro component test):** the gate is `bun test`, not an Astro renderer. A pure
string/view-model function is testable to the branch with fabricated + real-seed inputs, exactly as
`dish-seed.ts` is. The scaffolded `index.astro` is self-contained Astro (can't import vend's `src/`),
so the pure module is vend's **spec** of the render — the same spec/seed relationship `dish-seed.ts`
has with `seed.json`. The reference page mirrors the spec; a drift assertion can pin them (D4).

**Rejected — render inside the Astro file only (no pure core):** then nothing of clauses 1+2 is
gate-covered; a regression in "one card per dish / matching the example" wouldn't fail `bun run
check`. Pure-core-plus-spec is the house doctrine (dish-seed, init-core, run-log all split this way).

### D3 — Produce a self-contained reference `index.astro` and BUILD IT GREEN offline (clause 2, for real).

Clause 2 ("`astro build` is green") is **literally runnable offline** — the seed dir has astro 6.4.8 +
the cloudflare adapter installed and the stub already builds. So I write the **reference menu-render
page** (the gold-master target index.astro): SSR (`output:"server"` is already set), fetches EmDash's
REST list at request time, **falls back to the seeded example dish when the endpoint is unreachable**
(the cold-start / no-live-server state — honest-empty, so build/preview is green standalone), and emits
the mobile-first one-card-per-dish menu. Then I **actually run `astro build`** against it and capture
the output as `build.proof.txt`. This turns clause 2 from a claim into a recorded fact — strictly more
honest than deferring it.

- **Where the reference lives:** `docs/active/work/T-062-03-03/menu-render.index.astro` (a work
  artifact / the gold-master page), **not** the template. The build proof is produced by temporarily
  dropping it into a *copy* of the seed dir (or the seed dir with the stub backed up and restored), so
  the committed template stub is never mutated.
- **REST endpoint, honestly modeled:** request-time `fetch` of an `EMDASH_API_URL`-configured list
  endpoint (env-driven; absent ⇒ skip fetch). The page never *requires* a live server — the seeded
  example is the fallback, mirroring the "config present, not live" honesty the seed already carries.
  This keeps the page faithful ("sourced from EmDash's REST API") AND green offline.

**Rejected — SSG/build-time fetch:** the gold-master board's fork already resolves to **SSR** (the
couple edits dishes often; instant freshness beats re-deploy; `expected-board.md:67`), and the seed
config is `output:"server"`. Building SSG would contradict the recorded board.

**Rejected — defer clause 2 to the live drive:** it's runnable now, for free. Deferring a verifiable
clause would be a gratuitous `⟪…⟫`.

### D4 — Keep the spec and the reference page consistent (anti-drift).

`menu-render.test.ts` reads the **reference `index.astro`** off disk (the `dish-seed.test.ts` drift
idiom) and asserts it contains the same structural markers the pure core emits (the card-per-dish
container, the example dish's name, the mobile-first viewport line). So the gold-master page and vend's
spec of it can't silently diverge — if a future edit changes one, the test bites.

### D5 — Record clause 3 (the live budget line) as `⟪…⟫` in `EXPECTED-OUTCOME.menu-render.md`.

Mirror `EXPECTED-OUTCOME.degrade.md` exactly: a "deterministic half — CAPTURED (free, offline)" block
(the render contract + the real `astro build` green proof) and a "metered half — PENDING" table whose
every live value is a `⟪…⟫` slot (the `vend work` run's `outcome:success`, `totalTokens ≤
envelope.tokens`, `wallClockMs ≤ envelope.timeMs`, cost). A **re-run block** gives the exact
human-authorized commands. T-062-04-01 rolls this into the frozen epic `EXPECTED-OUTCOME.md`.

**Why not run the live cast here:** no offline `castWork`; it spends real tokens and needs a Claude
login; it is **non-deterministic** and **human-authorized** (P7). Inventing a budget line would launder
evidence (memory `honest-on-outcome-discipline`). The deterministic half is captured as fact; the
budget line stays an explicit pending slot, exactly as 03-01's board ranking and 03-02's degrade line do.

## What each AC clause gets

| Clause | Treatment | Status |
|---|---|---|
| 1 — one-card-per-dish from REST, matching the example dish | pure `menu-render.ts` + test (reads real `seed.json`) + reference page | **captured (gate)** |
| 2 — `astro build` green | reference page **actually built** offline → `build.proof.txt` | **captured (real build)** |
| 3 — lands inside cold-start budget in `runs.jsonl` | recorded `⟪…⟫` in `EXPECTED-OUTCOME.menu-render.md` + re-run block | **pending (metered, honest)** |

## Non-goals (scope fence)

- No live EmDash / D1 / HTTP server in the gate (config-present honesty).
- No Cloudflare deploy (that's the board's *Standard* slice, not this Keystone).
- No edit to the engine / CLI / BAML / `run-log.ts` — this ticket is seed-side + a pure render module
  + records. (If the build proof reveals the stub itself regressed, that's a separate finding.)
- No `--budget` tuning — the cold-start envelope is E-060's calibrated default; this ticket only
  records that the live run must land inside it.
