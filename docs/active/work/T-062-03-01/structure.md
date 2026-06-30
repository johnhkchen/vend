# T-062-03-01 — Structure

File-level changes, boundaries, ordering. The blueprint — shape, not code.

## Summary of changes

| File | Op | What |
| --- | --- | --- |
| `examples/templates/kitchen-seed/SEED.md` | **create** | The cook's one-line intent (menu-render is the first slice). Authored source, text-embedded. |
| `examples/templates/kitchen-seed/charter.md` | **create** | The kitchen-tuned value function (a usable menu the couple orders from). Authored source, text-embedded. |
| `src/kitchen/kitchen-overlay.ts` | **modify** | Text-import the two new `.md` files; add two `ScaffoldEntry`s (`SEED.md` overlay-only; `docs/knowledge/charter.md` override). Extend the header note. |
| `src/kitchen/seed-steer-seam.test.ts` | **create** | The seam confirm test: intent + tuned charter reach the steer snapshot; the recorded gold-master board clears + tops with menu-render. |
| `docs/active/work/T-062-03-01/expected-board.md` | **create** | The recorded gold-master board (positive-scaffold form, `⟪…⟫` live slots). The "recorded for the gold-master diff" artifact. |
| `docs/active/work/T-062-03-01/steer-input.proof.txt` | **create** | No-spend, human-readable proof that the *real* `assembleSteerInputs` emits the intent section (generated in Implement). |

No engine change. No CLI change. No change to `init-core.ts`/`init-effect.ts` (the merge already
handles overlay-only + override entries). No new BAML.

## 1. `examples/templates/kitchen-seed/SEED.md` (new authored source)

The single thing the cook edits. Contents (intent, not demand):
- One headline line: the home-kitchen menu idea — the couple orders dishes for the week, the cook
  cooks them.
- The two roles: **cook/dev** (drives vend) and **diner** (the partner who orders).
- The **first slice, named**: the diner storefront at `/` is a stub today; the first build is to
  **render the menu** — read `Dish` content (name, photo, description) from EmDash and show
  mobile-first cards. (This is what makes the menu-render slice the obvious keystone for steer.)
- A "what's already here" line: the EmDash `Dish` type + one example dish are seeded; add real
  dishes in the EmDash admin.

Constraints: **zero demand rows** (no `vend chain "…"`, no `- **E-NN`), so `countDemandRows` stays
0 — honest-empty. Plain prose; backtick-safe (text-embedded verbatim).

## 2. `examples/templates/kitchen-seed/charter.md` (new authored source)

The kitchen-tuned charter — the demonstrable-menu value function steer/work grade against. Modeled
on `HACKATHON_CHARTER`'s shape (the clearing move → what makes work valuable → light-but-real gates
→ out of bounds → amendment rule), re-tuned to the kitchen domain:
- **The one-line value:** *a real, usable menu the couple will actually order from — over polish.*
- **What's valuable here (criteria):** menu-advancing (moves the rendered menu forward); grounded in
  the real `Dish` content + EmDash REST; session-sized; in-bounds (green `astro build`, the deploy
  path intact); showable (a rendered card you can point at on a phone).
- **Light-but-real gates:** build stays green; every slice is showable; budget is a hard contract.
- **Out of bounds:** the ordering loop, shopping list, nutrition, design polish (explicitly deferred
  per the epic's OUT OF SCOPE) — so steer does **not** rank them above the menu render.

Constraints: vend-owned, zero demand, one page. Scaffold target `docs/knowledge/charter.md`.

## 3. `src/kitchen/kitchen-overlay.ts` (modify)

Add to the text-embed block:
```ts
// T-062-03-01 (the seed-intent → steer wire on the materialized seed, story S-062-03):
import seedIntent from "../../examples/templates/kitchen-seed/SEED.md" with { type: "text" };
import kitchenCharter from "../../examples/templates/kitchen-seed/charter.md" with { type: "text" };
```
Add two entries to `KITCHEN_OVERLAY` (order is cosmetic; group with the seed-intent comment):
```ts
// The cook's one-line intent — the E-059 seed→steer wire reads this into the steer snapshot.
{ kind: "file", path: "SEED.md", contents: seedIntent },
// The kitchen-tuned value function — OVERRIDES the base CHARTER_STUB at the path steer reads.
{ kind: "file", path: "docs/knowledge/charter.md", contents: kitchenCharter },
```
Header note: add a short paragraph explaining that the overlay now also carries the **seed-intent +
tuned charter** (the E-059 wire on the materialized seed, mirroring `hackathon`), and that the
charter entry **overrides** the base stub via `mergeManifests` (override-in-slot). Reaffirm
one-way-to-lisa / honest-empty (both are vend-owned, zero-demand).

Module boundaries unchanged: still a pure `ScaffoldEntry[]` of compile-time string consts; `.md`
needs no `seed-text-modules.d.ts` shim (natively resolved).

## 4. `src/kitchen/seed-steer-seam.test.ts` (new)

Guarded-live + pure, the `init-kitchen.test.ts` discipline. Imports (all addon-free):
- `runInit` from `../init/init-effect.ts`
- `buildProjectSnapshot`, `listIdsIn`, `SEED_PATH`, `CHARTER_PATH` from `../play/project-context.ts`
- `clear` from `../play/steer-core.ts`
- types `Signal`/`Fork`/`Steer`/`SignalTier` from `baml_client` (type-only)
- `readFile`, `mkdtemp`, `rm` from node

Helpers (no-shared-util, copied from the sibling tests): `bareEmptyDir()`,
`mkSignal`/`mkFork`/`mkSteer` (the `steer-core.test.ts` shape).

### `describe` block A — the materialized seed carries the intent (the wire)
- scaffold a kitchen workspace (`runInit(root, "kitchen")` → `scaffolded`).
- assert `SEED.md` exists and is **byte-equal** to `examples/templates/kitchen-seed/SEED.md`
  (drift pin), and contains the menu-render intent phrase.
- assert `docs/knowledge/charter.md` is **byte-equal** to the authored kitchen charter and is
  **not** the generic `CHARTER_STUB` (assert it contains the kitchen value language, e.g. "menu").

### `describe` block B — the intent reaches the steer snapshot (E-059, deterministic)
Reconstruct exactly what `assembleSteerInputs` produces, addon-free:
```
const intent  = await readFile(join(root, SEED_PATH), "utf8");       // SEED.md
const charter = await readFile(join(root, CHARTER_PATH), "utf8");     // kitchen charter
const stories = await listIdsIn(`${root}/docs/active/stories`);       // []
const tickets = await listIdsIn(`${root}/docs/active/tickets`);       // []
const project = buildProjectSnapshot({ root, srcFiles: [], stories, tickets, intent });
```
- assert `project` contains `## Stated intent (SEED.md)` **and** the menu-render intent text — the
  intent is **in steer's `{{ project }}` input** (it was absent before this ticket).
- assert `charter` is the kitchen value function (the `{{ charter }}` steer grades against).
- (negative control) re-scaffold the **base** (`runInit` on a lisa-marked dir, or `planInit` over
  `SCAFFOLD_MANIFEST` only) and confirm the snapshot would have **no** intent section — pinning
  that the wire is what the overlay adds. *(If the base path is awkward to set up, assert instead
  that omitting `intent` yields no section — `buildProjectSnapshot` with `intent: undefined`.)*

### `describe` block C — the recorded gold-master board is valid + menu-render-topped
- define `GOLD_MASTER_BOARD: Steer` (the expected board from `expected-board.md`, encoded as a typed
  fixture): `signals[0]` = the menu-render slice (`tier: Keystone`, grounded), a non-increasing
  tail, forks honest (one genuine fork or none).
- assert `clear(GOLD_MASTER_BOARD).status === "clear"` (read-never-invent + fork-genuineness +
  leverage-rank all pass).
- assert `GOLD_MASTER_BOARD.signals[0].tier === SignalTier.Keystone` and its `what`/`why` name the
  **menu render** (the AC's "highest-ranked slice is the menu-render slice").
- assert the fixture **matches** the board recorded in `expected-board.md` on the load-bearing
  fields (a light cross-check so the typed fixture and the diffable artifact don't drift — e.g.
  the keystone `what` string is shared via a `const` the test and the doc both quote).

## 5. `docs/active/work/T-062-03-01/expected-board.md` (new)

The diffable gold-master **board** artifact (T-059-03 positive-scaffold form):
- Banner: `⚠️ NOT YET CAPTURED — the live ranking is the human-authorized metered cast (T-062-03-03,
  P7).` Make explicit this is the **expected/target** board, deterministic seam proven, live
  ranking pending. Do **not** invent live numbers.
- A `What | Target | Actual (live)` table with the deterministic rows filled (`✅ intent reaches
  steer — proven, zero spend`) and the metered rows as `⟪…⟫`.
- The ranked expected board (Keystone menu-render → Standard deploy), each signal grounded in a
  named seed file.
- The genuine fork (if included), verbatim.
- A re-run block: the exact `vend init --template kitchen` → `doctor` → `steer` commands a later
  drive runs (the consistency bar), noting `steer` is the metered cast.
- "Why this exists": the board half of the kitchen gold master; the bar T-062-03-03/04-01 fill.

## 6. `docs/active/work/T-062-03-01/steer-input.proof.txt` (new, generated)

Generated in Implement by a throwaway script that scaffolds a temp kitchen workspace and calls the
**real** `assembleSteerInputs` (no `b.request` → **zero spend**), dumping the `project` snapshot +
the first lines of `charter`. Human-readable evidence that the *shipped* input path (not just the
test's reconstruction) emits the intent. Committed as a trail artifact (mirrors T-059-03).

## Ordering of changes (commit-sized)

1. Author `SEED.md` + `charter.md` sources (no wiring yet) — inert.
2. Wire them into `kitchen-overlay.ts` (overlay grows by one path; charter overrides) + header note.
3. Add `seed-steer-seam.test.ts` (blocks A+B+C). Run `bun run check`.
4. Generate `steer-input.proof.txt`; write `expected-board.md`.

Each step is independently verifiable: 1 compiles; 2 passes the existing `init-kitchen.test.ts`
(MERGED.length auto-updates) + tsc; 3 is the new gate; 4 is trail.

## Interfaces touched (none broken)

- `KITCHEN_OVERLAY: readonly ScaffoldEntry[]` — grows by entries; type unchanged.
- `mergeManifests` / `planTemplate` / `runInit` — unchanged; exercise the override + overlay-only
  paths they already support.
- No public signature changes anywhere; `init-kitchen.test.ts` keeps passing (dynamic `MERGED`).
