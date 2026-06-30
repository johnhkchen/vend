# Structure — T-062-01-01 author-dish-content-type-and-example-dish

_Phase: Structure. File-level changes, boundaries, interfaces, ordering. The shape of the
code, not the code._

## Files at a glance

| Path | Op | Owner | Purpose |
|------|----|-------|---------|
| `examples/templates/kitchen-seed/.emdash/seed.json` | **create** | this ticket | The authored EmDash seed: `Dish` content type + one example dish (source of truth, native format) |
| `examples/templates/kitchen-seed/.emdash/README.md` | **create** | this ticket | A short note: what the seed declares, the honest-empty rule, that the cook edits in the admin |
| `src/kitchen/dish-seed.ts` | **create** | this ticket | Pure contract + validator + REST list model |
| `src/kitchen/dish-seed.test.ts` | **create** | this ticket | Gate test: reads the seed, asserts schema + single-row + REST-returns-one |

**No edits to any existing file.** In particular `src/init/init-core.ts`,
`astro.config.mjs`, `wrangler.toml`, `src/pages/index.astro`, `package.json` are untouched —
preserving disjointness from sibling ticket T-062-01-02 (which owns the storefront/config)
and from the `kitchen` template registration (out of AC). The `kitchen-seed/` directory is
shared by both tickets but no file is co-edited; `mkdir -p` is idempotent and the commit
lock serializes.

## Module boundaries

```
examples/templates/kitchen-seed/.emdash/   ← authored data (NOT compiled; tsconfig = src/ only)
        seed.json    — EmDash-native: collections[] + content{} (the content type + 1 dish)
        README.md    — human note for the cook

src/kitchen/                                ← compiled + gated (pure-core discipline)
        dish-seed.ts       — pure: types, contract consts, parse, validate, REST model
        dish-seed.test.ts  — bun:test: reads seed.json via readFile, asserts the AC
```

Boundary rule (mirrors `init-core` ⊥ `init-effect`): **`dish-seed.ts` is pure** — no
`node:fs`, no network, no clock. The only fs read (`readFile` of the example seed) lives in
the **test**, exactly as the HACKATHON_CHARTER drift guard reads its example file from a
test. This keeps `dish-seed.ts` reusable by a future `vend doctor` kitchen check or the
cleared render slice without dragging fs into it.

## Public interface — `src/kitchen/dish-seed.ts`

```ts
// ── The Dish content-type contract (the schema half of the AC) ──────────────
export const DISH_COLLECTION_SLUG = "dishes" as const;

/** field slug → required EmDash field type. The schema the seed must declare. */
export const REQUIRED_DISH_FIELDS: Readonly<Record<string, EmDashFieldType>>;
//   { name: "string", photo: "image", description: "text" }
export const REQUIRED_DISH_FIELD_REQUIRED: ReadonlySet<string>; // { "name" }

// ── Types mirroring the verified EmDash seed shape (Research) ────────────────
export type EmDashFieldType =
  | "string" | "text" | "number" | "integer" | "boolean" | "date" | "datetime"
  | "email" | "url" | "slug" | "portableText" | "image" | "file" | "json" | "reference";

export interface EmDashField { slug: string; label: string; type: EmDashFieldType; required?: boolean }
export interface EmDashCollection {
  slug: string; label: string; labelSingular?: string; description?: string;
  icon?: string; supports?: string[]; fields: EmDashField[];
}
export interface EmDashRecord { id: string; slug: string; status: string; data: Record<string, unknown> }
export interface EmDashSeed {
  version?: string;
  collections: EmDashCollection[];
  content?: Record<string, EmDashRecord[]>;
}

// ── Pure operations ─────────────────────────────────────────────────────────
/** Parse JSON text → seed, with a minimal shape guard (throws on non-object / missing collections). */
export function parseKitchenSeed(json: string): EmDashSeed;

/** The collection with this slug, or undefined. */
export function findCollection(seed: EmDashSeed, slug: string): EmDashCollection | undefined;

/** The records EmDash's REST list endpoint serves for `dishes` (content.dishes ?? []).
 *  The pure model of "what the REST endpoint returns." */
export function dishRecords(seed: EmDashSeed): EmDashRecord[];

/** Validate the Dish content type + single-row honest-empty seed.
 *  ok iff: `dishes` collection exists; every REQUIRED_DISH_FIELDS entry is present with the
 *  right type (and name is required); exactly ONE record; that record's data carries the
 *  three fields. Structured result so the test asserts specific violations & doctor reuses it. */
export function validateDishSeed(seed: EmDashSeed): { ok: boolean; violations: string[] };
```

### Internal organization

- Contract consts at top (single source of the field/type expectations).
- Types next (a faithful, minimal subset of the EmDash seed schema — only what we assert on;
  unknown keys are tolerated, not modeled).
- `parseKitchenSeed` → `JSON.parse` + a guard that `collections` is an array (clear error
  message, no silent `any`).
- `validateDishSeed` accumulates `violations: string[]` (never throws on bad data — that is
  data being wrong, which the test wants to *observe*); returns `ok = violations.length === 0`.

## Data shape — `seed.json` (authored)

Exactly the Design block: one `dishes` collection (name/photo/description, name required),
one published record under `content.dishes` whose `data` carries the three fields and whose
prose self-documents (honest-empty). `photo` is a placeholder reference string (no binary).
`$schema` + `version: "1"` present so the file is a valid EmDash seed an admin would accept.

## Test structure — `dish-seed.test.ts`

```
import { describe, expect, test } from "bun:test";
import { readFile } from "node:fs/promises";
import { DISH_COLLECTION_SLUG, REQUIRED_DISH_FIELDS, parseKitchenSeed,
         findCollection, dishRecords, validateDishSeed } from "./dish-seed.ts";

const SEED_PATH = "examples/templates/kitchen-seed/.emdash/seed.json";

describe("kitchen Dish content type — the authored seed", () => {
  // load once: readFile(SEED_PATH) → parseKitchenSeed
  test("the seed validates: schema + single-row honest-empty")      // validateDishSeed(seed).ok, no violations
  test("the Dish collection declares photo/name/description fields") // findCollection + field types, name required
  test("REST serves exactly one seeded example dish")               // dishRecords(seed).length === 1, data has 3 fields
});

describe("validateDishSeed — the single-row rule is enforced", () => {
  test("zero records fails")  // hand-built seed, content.dishes = [] → !ok
  test("two records fails")   // content.dishes = [a, b] → !ok (honest-empty is exactly one)
  test("a missing/typo'd field fails") // drop `photo` or mistype `name` → !ok
});
```

The first describe pins the AC against the **real authored file** (drift-guarded by being
read, not duplicated). The second pins that the rule is genuine (negative cases), using
in-memory seeds so no extra fixtures on disk.

## Ordering of changes (matters for a clean, gate-green sequence)

1. `src/kitchen/dish-seed.ts` — the contract/validator first (compiles standalone).
2. `examples/templates/kitchen-seed/.emdash/seed.json` (+ `README.md`) — the authored data.
3. `src/kitchen/dish-seed.test.ts` — the test, which needs both (1) and (2) to pass.

Each step is independently inspectable; only step 3 closes the loop. `tsc --noEmit` sees
(1)+(3) under `src/`; the seed.json under `examples/` is read at runtime, never compiled.

## What this deliberately does NOT include

- No `index.astro` / loader / render (the slice `vend work` clears).
- No `TEMPLATE_REGISTRY` / `init-core.ts` change (registration is out of AC + collision risk).
- No live EmDash/D1/HTTP, no shipped media binary, no Astro/Cloudflare config (sibling ticket).
