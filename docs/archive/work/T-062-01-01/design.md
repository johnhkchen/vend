# Design — T-062-01-01 author-dish-content-type-and-example-dish

_Phase: Design. Options, tradeoffs, one decision with rationale, grounded in Research._

## The decision in one line

Author the `Dish` content type and its single example dish as a real **EmDash
`.emdash/seed.json`** under `examples/templates/kitchen-seed/`, and gate it with a `src/`
test that reads + validates that seed through a small **pure validator module**
(`src/kitchen/dish-seed.ts`). The validator doubles as the canonical field contract and a
pure model of the REST list response, so "the REST endpoint returns exactly one dish" is an
explicit, typed assertion — not a live HTTP probe.

## Option A — canonical const in `src/`, byte-equal mirror in `examples/` (HACKATHON_CHARTER style)

Inline the seed JSON as a string const in `src/init/init-core.ts` (or a new module),
mirror it byte-equal to `examples/templates/kitchen-seed/.emdash/seed.json`, drift-guard.

- **For:** Exact precedent (HACKATHON_CHARTER). Single source of truth in `src/`.
- **Against:** The natural authored artifact for EmDash *is* a JSON file, not a TS string
  const. Inlining a 30+ line JSON blob as a template string is awkward, invites escaping
  bugs, and bloats `init-core.ts` — a file the sibling ticket may also touch (collision
  risk). Worse, it couples this content type to the `kitchen` template **registration**,
  which is explicitly outside this ticket's AC (Research, open Q on init-core). Rejected:
  the const-mirror pattern earns its keep when an `init` overlay must inline the bytes; here
  the seed isn't (yet) wired into an overlay, so the indirection is cost without benefit.

## Option B — seed.json is the source of truth, a `src/` test reads + validates it (CHOSEN)

The authored `.emdash/seed.json` is the single source of truth (it is literally what
EmDash consumes). A `src/` test reads it via `readFile` + `JSON.parse` and asserts the
schema + single-row contract through a small pure validator.

- **For:** The artifact is in EmDash's own native format — maximally honest about "EmDash
  admin exposes a Dish type." Reading an `examples/` file from a `src/` test is an
  established gate pattern (the HACKATHON_CHARTER drift guard does exactly this via
  `readFile`). No same-file collision with the sibling ticket — I touch only
  `.emdash/seed.json` + new `src/kitchen/*` files. The validator is reusable later by a
  `vend doctor` kitchen check or the cleared render slice.
- **Against:** Source of truth lives under `examples/`, not `src/`. Mitigated: the
  *contract* (required field slugs/types, single-row rule) lives as consts in
  `src/kitchen/dish-seed.ts`; only the *data* lives in the seed. The test pins data↔contract.
- **Verdict:** Chosen. Best fit to EmDash reality, the honest-boundary posture, and the
  concurrency constraint.

## Option C — a live EmDash + D1 integration test

Stand up EmDash against a local SQLite, apply the seed, hit the REST endpoint, assert one
dish. Rejected: EmDash is a beta external dep; this would add a heavy/networked/flaky
dependency to `bun run check`, violating the gate's local-first speed and the repo's
explicit "config present, not live" boundary. The live admin/REST/D1 path is exercised in
the **drive** (the metered `vend work` cast the human authorizes), per the epic — not in
unit gates. Deferred to the live rehearsal, not this ticket.

## Chosen shape (grounded in Research)

### 1. The content type + seed — `examples/templates/kitchen-seed/.emdash/seed.json`

A minimal but real EmDash seed declaring one collection and one record:

```jsonc
{
  "$schema": "https://emdashcms.com/seed.schema.json",
  "version": "1",
  "collections": [
    {
      "slug": "dishes",
      "label": "Dishes",
      "labelSingular": "Dish",
      "description": "A dish on the kitchen menu — a photo, a name, a short description.",
      "icon": "utensils",
      "supports": ["drafts"],
      "fields": [
        { "slug": "name",        "label": "Name",        "type": "string", "required": true },
        { "slug": "photo",       "label": "Photo",       "type": "image" },
        { "slug": "description", "label": "Description", "type": "text" }
      ]
    }
  ],
  "content": {
    "dishes": [
      {
        "id": "example-dish",
        "slug": "example-dish",
        "status": "published",
        "data": {
          "name": "Sample Dish (edit or delete me)",
          "photo": "/media/sample-dish.jpg",
          "description": "This is the one seeded example dish... add your real dishes in the EmDash admin, then delete this one."
        }
      }
    ]
  }
}
```

Field mapping (Research): **name → `string` required**, **photo → `image`**, **description
→ `text`**. Exactly one record under `content.dishes` (honest-empty). The record's prose
doubles as format documentation (IA-4). Photo is a **documented placeholder reference
string**, no binary shipped (Option for Research Q3) — keeps the seed text-only and fully
clear of the storefront's `public/`; the cook uploads a real photo via the media library.

### 2. The canonical contract + validator — `src/kitchen/dish-seed.ts` (new, pure)

A small pure module — no fs, no network — that encodes the contract and models REST:

- `DISH_COLLECTION_SLUG = "dishes"` and `REQUIRED_DISH_FIELDS` — the field slug→type
  contract (`name: string` required, `photo: image`, `description: text`).
- Types mirroring the verified seed shape (`EmDashSeed`, `EmDashCollection`, `EmDashField`,
  `EmDashRecord`).
- `parseKitchenSeed(json: string): EmDashSeed` — parse + minimal shape guard.
- `findCollection(seed, slug): EmDashCollection | undefined`.
- `dishRecords(seed): EmDashRecord[]` — the `content.dishes` array EmDash's REST list
  endpoint serves. **This is the pure model of "what REST returns."**
- `validateDishSeed(seed): { ok: boolean; violations: string[] }` — checks: the `dishes`
  collection exists; each required field is present with the right type; exactly ONE
  published record; that record's `data` carries name/photo/description. Structured result
  (not throw) so the test can assert specific violations and `vend doctor` can reuse it.

Keeping fs OUT of this module (read in the test) preserves the pure-core discipline
(`init-core` style) and makes the validator trivially reusable.

### 3. The gate test — `src/kitchen/dish-seed.test.ts` (new)

`bun:test`; reads the example seed via `readFile("examples/templates/kitchen-seed/.emdash/seed.json")`
(the drift-guard precedent), parses, and asserts:
- `validateDishSeed(seed).ok === true`, `violations` empty.
- The `dishes` collection declares photo/name/description with the contract types; `name`
  required (schema assertion → "admin exposes a Dish type with those fields").
- `dishRecords(seed).length === 1` and its `data` has the three fields (single-row
  honest-empty seed → "REST endpoint returns exactly one seeded example dish").
- A negative case: a hand-built seed with zero or two records fails `validateDishSeed`
  (proves the single-row rule is enforced, not incidental).

## Honest boundaries (called out, not hidden)

- **No live EmDash/D1/HTTP in the gate.** The test validates the seed contract EmDash
  applies on first boot, which *is* what the admin exposes and REST returns. The live
  admin/REST path is the drive's job (metered, human-authorized), per the epic. This mirrors
  the repo's existing wrangler "config present, not live" honesty.
- **The `kitchen` template is not registered here.** Landing `.emdash/seed.json` in a
  cook's repo via `vend init --template kitchen` requires a `TEMPLATE_REGISTRY` entry in
  `init-core.ts`. That is a shared-file change outside this AC and a collision risk with the
  sibling ticket; flagged for a follow-up/integration ticket. This ticket delivers the
  authored content type + seed + gated contract test — the buildable, collision-free unit.
- **The render slice stays unbuilt** (decision b). No loader, no `index.astro` edit here.

## Why this satisfies the AC

"EmDash admin exposes a Dish type with photo/name/description fields" → the `dishes`
collection in `seed.json` with those three typed fields, asserted by the test. "its REST
endpoint returns exactly one seeded example dish" → exactly one record under
`content.dishes`, modeled by `dishRecords` and asserted `=== 1`. "a test asserts the schema
+ single-row honest-empty seed" → `dish-seed.test.ts` does both, positively and negatively.
