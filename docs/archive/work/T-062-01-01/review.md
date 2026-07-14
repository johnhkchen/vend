# Review — T-062-01-01 author-dish-content-type-and-example-dish

_Phase: Review. The handoff: what changed, test coverage, open concerns. Read this instead
of the diff._

## What changed

Four new files; **zero existing files modified.**

| Path | Kind | Purpose |
|------|------|---------|
| `examples/templates/kitchen-seed/.emdash/seed.json` | new (data) | The authored EmDash seed — the `Dish` content type (name/photo/description) + exactly one example dish. The cook-facing source of truth, in EmDash's native format. |
| `examples/templates/kitchen-seed/.emdash/README.md` | new (docs) | Note for the cook: what the seed declares, the honest-empty rule, the no-live-server boundary, first-boot apply. |
| `src/kitchen/dish-seed.ts` | new (code) | Pure contract + validator + REST list model. No fs/network/clock. |
| `src/kitchen/dish-seed.test.ts` | new (test) | Gate test: reads the real seed and asserts schema + single-row (positive); proves the rule with in-memory negatives. |

## How the AC is met

> "EmDash admin exposes a Dish type with photo/name/description fields and its REST endpoint
> returns exactly one seeded example dish; a test asserts the schema + single-row honest-empty seed."

- **Dish type with photo/name/description** → the `dishes` collection in `seed.json` declares
  `name` (`string`, required), `photo` (`image`), `description` (`text`). EmDash defines
  content types in the DB from this seed on first boot, so this *is* the admin exposing the
  type. Asserted by `dish-seed.test.ts` ("declares photo/name/description with the contract
  types").
- **REST returns exactly one seeded dish** → `content.dishes` has exactly one published
  record; `dishRecords()` models EmDash's REST list; the test pins `length === 1` and that
  the record carries all three fields and is `published`.
- **A test asserts schema + single-row honest-empty seed** → the positive describe reads the
  real authored file; the negative describe proves zero/two records and bad schema all fail.

## Test coverage

`bun test src/kitchen/` → **10 pass / 0 fail**. `bun run check` (full gate) →
**1454 pass / 1 skip / 0 fail**, `tsc --noEmit` clean.

Covered:
- Authored seed parses + validates (the AC, against the real file — drift-guarded).
- Schema: all three fields present with exact EmDash types; `name` required.
- Single-row: exactly one record; it is published and carries the three data fields.
- Rule is genuine (not incidental): zero records fail, two records fail, a missing field
  fails, a mistyped field fails, an absent `dishes` collection fails.

Coverage gaps (intentional, see concerns):
- No live EmDash/D1/REST round-trip — out of scope by design (gate stays local/fast/honest).
- `parseKitchenSeed`'s throw paths (non-object / non-array collections) are not unit-tested
  directly; they are simple guards exercised indirectly. Low risk; could add two cases if a
  reviewer wants the throw branches pinned.

## Open concerns / flags for a human reviewer

1. **The `kitchen` template is NOT yet registered** in `src/init/init-core.ts`
   (`TEMPLATE_REGISTRY`). So `vend init --template kitchen` does **not** land
   `.emdash/seed.json` in a cook's repo *yet*. This was deliberately excluded: it modifies a
   file the sibling ticket (T-062-01-02) may also need, and it is outside this ticket's AC.
   **Action for the epic owner:** a follow-up/integration ticket must add the `kitchen`
   overlay (and decide whether to mirror the seed into init's overlay or copy the example
   tree) so the content type actually reaches the cook. Without it, the seed is authored and
   gated but not yet wired into the install path.

2. **No live-server assertion (honest boundary).** The test validates the seed *contract*
   EmDash applies, not a running admin/REST. This matches the repo's existing "config
   present, not live" posture and the epic's split (the live admin/REST/D1 path is the
   human-authorized drive). If a reviewer wants a live smoke test, it belongs in the drive /
   a later integration epic, not the unit gate.

3. **EmDash beta schema fidelity.** Field types + seed shape are pinned from EmDash's docs
   (collections[].fields[].type ∈ {string,image,text,…}; content.<slug>[] = {id,slug,status,
   data}). EmDash is v0.1 beta; if its schema shifts, this seed is a snapshot the autopilot
   re-clears later (per the epic's stated EmDash-beta risk). Acceptable for the rehearsal.

4. **Photo placeholder, no binary.** The example dish's `photo` is a reference string
   (`/media/sample-dish.jpg`) with no shipped asset — keeps the seed text-only and clear of
   the storefront's `public/`. The cleared render slice must handle a missing/placeholder
   image gracefully (a render-slice concern, flagged for `vend work`, not a bug here).

## Risk assessment

Low. New, additive, fully-gated code in its own `src/kitchen/` namespace and the seed's own
`.emdash/` subtree; no existing behavior touched; full suite green. The one thing a human
must not miss is **concern #1** — the content type exists and is correct, but is not yet
reachable via `vend init --template kitchen` until the template overlay is registered
downstream.
