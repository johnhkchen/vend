# T-062-03-01 — Research

**Ticket:** task — `confirm-seed-intent-reaches-steer-board` (story S-062-03, epic E-062).
**Goal:** confirm the E-059 seed-intent→steer seam, **on the materialized seed** (not just the
spike), ranks a coherent kitchen board whose **top slice is the menu-render slice**, and record
that board for the gold-master diff.

Descriptive only — what exists, where, how it connects, and the constraints. No solution here.

## The acceptance criterion, read closely

> `vend steer` run against the scaffolded kitchen workspace yields a board whose highest-ranked
> slice is the menu-render slice; the board is recorded for the gold-master diff.

Three observable clauses:
1. **The seam reaches steer** — the *scaffolded kitchen workspace* (what `vend init --template
   kitchen` actually lays down) must carry the intent steer reads. "On the materialized seed (not
   just the spike)" is the load-bearing phrase: the spike hand-fed inputs; this ticket grades the
   real scaffold.
2. **Top slice = menu-render** — the highest-ranked board signal is the "render the dishes menu"
   slice (read `Dish` content from EmDash's REST API → mobile-first cards at `/`).
3. **Recorded for the gold-master diff** — the board is frozen as an artifact a later drive
   (T-062-03-03 live cast, T-062-04-01 full EXPECTED-OUTCOME.md) is diffed against.

## How the seam works today (the E-059 wire)

`vend steer` → `castSteer` (`src/cli.ts:789-798`) → `assembleSteerInputs`
(`src/play/steer.ts:112-122`). The assembler reads exactly four things off `projectRoot`:

```ts
const [charter, intent, stories, tickets] = await Promise.all([
  readFile(join(root, CHARTER_PATH), "utf8"),               // docs/knowledge/charter.md — NO catch
  readFile(join(root, SEED_PATH), "utf8").catch(() => undefined), // SEED.md — TOLERANT
  listIdsIn(`${root}/docs/active/stories`),
  listIdsIn(`${root}/docs/active/tickets`),
]);
const project = buildProjectSnapshot({ root, srcFiles: [], stories, tickets, intent });
return { project, charter };
```

Key facts from `src/play/project-context.ts`:
- `CHARTER_PATH = "docs/knowledge/charter.md"` (read **without** a catch → **throws if absent**).
- `SEED_PATH = "SEED.md"` (read **tolerantly** → `undefined` if absent).
- `buildProjectSnapshot` (PURE, `project-context.ts:59-77`) emits a `## Stated intent (SEED.md)`
  section **only when `intent` is non-blank** (E-059, the deliberate exception to "names, not
  contents"). Absent/blank intent ⇒ the section is omitted ⇒ snapshot is honest-empty.
- Steer **forces `srcFiles: []`** — the steer snapshot is a board listing, *not* a src walk. So
  the **only** kitchen-specific signal that can reach the steer prompt's `{{ project }}` is the
  `SEED.md` intent. The Dish `seed.json`, the storefront stub — none of it is in the snapshot.

The BAML `SteerProject(project, charter)` prompt (`baml_src/steer.baml`) renders `{{ charter }}`
(the value function) + `{{ project }}` (the snapshot). The model ranks demand off those two
strings; the pure gates (`src/play/steer-core.ts`) then judge the parsed `Steer`.

## The materialized-seed gap (the central finding)

`runInit(root, "kitchen")` (`src/init/init-effect.ts:164-179`) is **standalone** (kitchen ∈
`STANDALONE_TEMPLATES`, `init-core.ts:296`) and applies the **merged** manifest
`mergeManifests(SCAFFOLD_MANIFEST, KITCHEN_OVERLAY)`. So the scaffolded kitchen workspace gets:

- the **full base scaffold** (`SCAFFOLD_MANIFEST`, `init-core.ts:232-255`): `docs/active/**`,
  `docs/knowledge/charter.md` = **generic `CHARTER_STUB`**, `docs/knowledge/vision.md`, `.vend/`,
  honest-empty `demand.md`/`demand-cleared.md`; PLUS
- the **kitchen overlay** (`KITCHEN_OVERLAY`, `src/kitchen/kitchen-overlay.ts:76-94`): the Dish
  `seed.json` + example dish, the stubbed `index.astro`, `astro.config.mjs`, `wrangler.toml`,
  `package.json`, `tsconfig.json`, `.gitignore`, `README-STACK.md`, `bun.lock`, `deploy.yml`,
  `favicon.svg`, `env.d.ts`.

**The overlay ships NO `SEED.md` and does NOT override the charter.** Contrast the `hackathon`
overlay (`init-core.ts:267-270`), which adds **both** `SEED.md` (`HACKATHON_SEED_STUB`) and a
tuned `docs/knowledge/charter.md` (`HACKATHON_CHARTER`). Consequence for `assembleSteerInputs` on
the materialized kitchen seed:
- `charter` = the **generic stub** (present → no crash, but no kitchen value function).
- `intent` = **`undefined`** (no `SEED.md`) → snapshot has **no `## Stated intent` section**.
- `stories`/`tickets` = `[]` (fresh board); `srcFiles` forced `[]`.

So the steer prompt today carries **a generic charter + an essentially empty snapshot** — there is
**nothing kitchen-specific** for the model to read the menu-render demand off. This is the *same
root cause* as the E-058 A3 negative finding (T-058-05: "`SEED.md` was never in steer's input
path"), which E-059 fixed **for the hackathon seed** — but the fix was never carried to the
kitchen overlay. **This ticket's name — "confirm-seed-intent-reaches-steer" — is exactly the gap:
the materialized seed does not yet carry the seed-intent.**

T-062-02-01 (done) scaffolded the Dish type + storefront + Cloudflare config — its AC named none of
`SEED.md`/charter, so this is genuinely unbuilt, not a regression.

## The spike vs. the materialized seed

The "E-062 A3 spike PASSED" evidence (E-062.md:20, brief-kitchen-emdash.md:77-79) is **PM/epic
prose, not a committed test artifact** — no spike test or recorded board exists in the repo. The
spike proved the *engine* ranks a coherent kitchen board when **hand-fed** kitchen inputs. It did
not prove the **shipped scaffold** feeds them — which is precisely the "not just the spike"
distinction this ticket closes.

## The gold-master / EXPECTED-OUTCOME precedent

Two committed precedents define the form (memory: `expected-outcome-gold-master-pattern`):
- `examples/templates/hackathon-seed/EXPECTED-OUTCOME.md` — a **captured** gold master:
  banner `✅ CAPTURED, NOT A TARGET` + date/host/executor/spend, a `What | Target | Actual (live)`
  table, the ranked board (Keystone→Leaf), verbatim forks, a re-run block. Honest-on-outcome
  (records where the shipped flow falls short). Lives **outside** `tsconfig include:[src]` ⇒ no
  automated test; its gates are per-step CLI assertions in the RDSPI trail.
- `docs/active/work/T-059-03/EXPECTED-OUTCOME.positive-scaffold.md` — the **honest pre-capture**
  form: banner `⚠️ NOT YET CAPTURED — PENDING THE HUMAN-AUTHORIZED METERED CAST (P7)`, every
  observed value left as a `⟪…⟫` slot, and the **deterministic half proven for free** (a
  `steer-input.proof.txt` showing `assembleSteerInputs` emits the `## Stated intent` section on the
  freshly-scaffolded sandbox). The live board capture is deferred to the authorized cast.

This is the template for T-062-03-01: the seam (intent reaches steer) is **deterministic and free**;
the live board ranking is a **metered, non-deterministic** cast.

## Constraint: no offline steer; the live cast is a *different* ticket

- `vend steer` has **no dry-run / fixture-executor path** (`src/executor/executor.ts` — the only
  seam; `castSteer` always dispenses a real prompt). A live `steer` **spends tokens**, needs a
  Claude login, and is **non-deterministic** — it cannot run in this autonomous RDSPI pass.
- The **metered live drive is explicitly T-062-03-03's job** ("Run the human-authorized metered
  cast"), and the full EXPECTED-OUTCOME capture is T-062-04-01's. So T-062-03-01 is the **offline
  confirm-and-record** step, not the live cast.
- Therefore the honest, gate-coverable deliverable mirrors T-059-03: (a) make the materialized seed
  carry the intent + tuned charter; (b) **prove deterministically** the intent reaches the steer
  snapshot; (c) **record the expected gold-master board** (menu-render Keystone on top, gate-valid)
  with `⟪…⟫` slots for the live "Actual"; (d) defer the live cast to T-062-03-03.

## The pure gates the recorded board must satisfy (`src/play/steer-core.ts`)

`clear(steer)` runs three value-ordered gates; a STOP is returned data (an andon), not a throw:
1. **read-never-invent** — every signal's `grounding` is non-blank (cites real state).
2. **fork-genuineness** — each fork has a non-blank `question`/`whyItMatters`/`recommendation` and
   2–4 distinct options; an **empty `forks[]` is valid** (clear path).
3. **leverage-rank** — the board is non-increasing in `TIER_RANK` (`survey-core.ts:49-54`:
   Keystone 0 → High 1 → Standard 2 → Leaf 3); the **first signal sets the top tier**.

So a recorded board with the menu-render slice as a **grounded `Keystone` at index 0**, the rest
non-increasing, and either no forks or a genuine 2–4-option fork, **clears** — and `signals[0]`
*being* the menu-render slice is the AC's "highest-ranked slice."

## Test-style + house conventions to obey

- `src/kitchen/init-kitchen.test.ts` is the model: guarded-live temp dir (`mkdtemp` → `runInit` →
  assert → `rm` in `finally`), no mocks; **byte-equality drift pins** against the authored example
  bytes; reuse of the authored contract rather than restating it. `MERGED.length` is computed
  dynamically from `resolveTemplate("kitchen")`, so adding overlay entries won't break it.
- `src/play/steer-core.test.ts` is the gate-fixture model (`mkSignal`/`mkFork`/`mkSteer`).
- Overlay content is **text-embedded** from `examples/templates/kitchen-seed/` (binary-safe under
  `bun build --compile`, drift-free, `.md` resolves natively under tsc `moduleResolution:bundler`).
  New `.md` files (`SEED.md`, `charter.md`) text-import the same way (no `seed-text-modules.d.ts`
  shim needed — `.md` is already resolvable).
- `bun run check` (`baml:gen → tsc --noEmit → bun test`) is the gate. Overlay purity doctrine: the
  module touches no fs/clock/network at runtime (compile-time string consts only).

## Open questions carried into Design

- **Add `SEED.md` + a kitchen-tuned charter to the overlay** (mirror hackathon) — vs. leave the
  generic charter and rely on `SEED.md` alone? (The charter override is what makes the board
  *coherent*, not merely non-empty.)
- **Where to record the board** — this ticket's work dir (board component only, respecting
  T-062-04-01's ownership of the full epic-level EXPECTED-OUTCOME.md) vs. the seed dir.
- **How much of the seam to gate** — a bun test over the addon-free `buildProjectSnapshot` (the
  exact pure function `assembleSteerInputs` calls) vs. a one-off proof artifact via the real
  `assembleSteerInputs`.
- **The expected board content** — how many signals, and whether to surface a genuine fork
  (SSG-vs-SSR fetch timing is a real Astro+Cloudflare trade-off) while honoring honest-empty.
