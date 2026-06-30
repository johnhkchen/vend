// The kitchen seed's `Dish` content type — its PURE contract + validator + REST model
// (T-062-01-01, story S-062-01, epic E-062: kitchen-emdash-dress-rehearsal).
//
// WHAT THIS IS: EmDash defines content types in the DATABASE, not in code — a fresh site is
// bootstrapped by a `.emdash/seed.json` that declares `collections` (typed fields) and
// optional `content` (records), applied on first boot when the DB is empty. The authored
// seed for the kitchen template lives at `examples/templates/kitchen-seed/.emdash/seed.json`;
// THIS module is the pure contract that file must satisfy, plus a model of the REST list the
// admin/REST layer serves for the `dishes` collection.
//
// PURE (mirrors src/init/init-core.ts): every export takes plain values and returns plain
// values — no fs, clock, network, process. The one filesystem read (of the example seed)
// lives in dish-seed.test.ts, exactly as the HACKATHON_CHARTER drift guard reads its example
// file from a test. So this module is reusable as-is by a future `vend doctor` kitchen check
// or by the menu-render slice that `vend work` clears — none of which want fs dragged in here.
//
// HONEST BOUNDARY: there is no live EmDash / D1 / HTTP here. `validateDishSeed` checks the
// seed CONTRACT EmDash applies on first boot — which is precisely what the admin exposes and
// what REST returns — the same "config present, not live" honesty the seed's wrangler config
// carries. The live admin/REST path is the human-authorized drive's job, not the gate's.

// ── The Dish content-type contract (the schema half of the ticket AC) ────────────────────

/** The EmDash collection slug for dishes (plural, EmDash convention; `labelSingular: "Dish"`). */
export const DISH_COLLECTION_SLUG = "dishes" as const;

/** The required field slug → EmDash field type the `dishes` collection must declare. The
 *  schema the authored seed is graded against: a photo, a name, a short description. */
export const REQUIRED_DISH_FIELDS: Readonly<Record<string, EmDashFieldType>> = {
  name: "string",
  photo: "image",
  description: "text",
};

/** Of {@link REQUIRED_DISH_FIELDS}, which must be `required: true` in the schema. A dish must
 *  have a name; photo/description may be filled later in the admin. */
export const REQUIRED_DISH_FIELD_REQUIRED: ReadonlySet<string> = new Set(["name"]);

// ── Types — a faithful, minimal subset of the EmDash seed schema (only what we assert on) ─

/** EmDash field types (docs.emdashcms.com seed-file reference). Unknown keys on a field/
 *  collection are tolerated, not modeled — we pin only the shape the AC depends on. */
export type EmDashFieldType =
  | "string"
  | "text"
  | "number"
  | "integer"
  | "boolean"
  | "date"
  | "datetime"
  | "email"
  | "url"
  | "slug"
  | "portableText"
  | "image"
  | "file"
  | "json"
  | "reference";

export interface EmDashField {
  readonly slug: string;
  readonly label: string;
  readonly type: EmDashFieldType;
  readonly required?: boolean;
}

export interface EmDashCollection {
  readonly slug: string;
  readonly label: string;
  readonly labelSingular?: string;
  readonly description?: string;
  readonly icon?: string;
  readonly supports?: readonly string[];
  readonly fields: readonly EmDashField[];
}

/** A seeded content entry — what EmDash materializes into the DB and serves via REST. */
export interface EmDashRecord {
  readonly id: string;
  readonly slug: string;
  readonly status: string;
  readonly data: Readonly<Record<string, unknown>>;
}

/** The seed document (`.emdash/seed.json`) — only the keys we assert on; the real file may
 *  carry more (`$schema`, `settings`, `taxonomies`, …) and that is fine. */
export interface EmDashSeed {
  readonly version?: string;
  readonly collections: readonly EmDashCollection[];
  readonly content?: Readonly<Record<string, readonly EmDashRecord[]>>;
}

// ── Pure operations ──────────────────────────────────────────────────────────────────────

/** Parse seed JSON text → {@link EmDashSeed}, with a minimal STRUCTURAL guard: the document
 *  must be an object with a `collections` ARRAY. Throws on structurally-invalid JSON (bad
 *  syntax / wrong shape) — that is the file being malformed, which should fail loudly. It does
 *  NOT validate the Dish contract; that is {@link validateDishSeed}'s job (data-level, soft). */
export function parseKitchenSeed(json: string): EmDashSeed {
  const parsed: unknown = JSON.parse(json);
  if (typeof parsed !== "object" || parsed === null) {
    throw new Error("kitchen seed: top-level value is not an object");
  }
  const collections = (parsed as { collections?: unknown }).collections;
  if (!Array.isArray(collections)) {
    throw new Error("kitchen seed: `collections` is missing or not an array");
  }
  return parsed as EmDashSeed;
}

/** The collection with this slug, or `undefined`. PURE. */
export function findCollection(seed: EmDashSeed, slug: string): EmDashCollection | undefined {
  return seed.collections.find((c) => c.slug === slug);
}

/** The records EmDash's REST list endpoint serves for the `dishes` collection
 *  (`content.dishes ?? []`). The pure model of "what the REST endpoint returns" — the AC's
 *  single-row claim is asserted against `dishRecords(seed).length`. PURE. */
export function dishRecords(seed: EmDashSeed): readonly EmDashRecord[] {
  return seed.content?.[DISH_COLLECTION_SLUG] ?? [];
}

/** The result of grading a seed against the Dish content-type + single-row contract. `ok`
 *  iff `violations` is empty; each violation is a human-readable reason (so the test can
 *  assert specifics and a future `vend doctor` can print them). */
export interface DishSeedCheck {
  readonly ok: boolean;
  readonly violations: readonly string[];
}

/** Validate the `Dish` content type + the single-row honest-empty seed. Soft — accumulates
 *  reasons, never throws on bad DATA (bad data is what a caller wants to OBSERVE). Checks:
 *   1. the `dishes` collection exists;
 *   2. every {@link REQUIRED_DISH_FIELDS} entry is declared with the right `type`, and the
 *      {@link REQUIRED_DISH_FIELD_REQUIRED} ones are `required: true`;
 *   3. EXACTLY ONE record is seeded (honest-empty: one example, never zero, never demand);
 *   4. that record's `data` carries the three required field slugs. */
export function validateDishSeed(seed: EmDashSeed): DishSeedCheck {
  const violations: string[] = [];

  const dishes = findCollection(seed, DISH_COLLECTION_SLUG);
  if (!dishes) {
    violations.push(`no \`${DISH_COLLECTION_SLUG}\` collection — the Dish content type is absent`);
  } else {
    const bySlug = new Map(dishes.fields.map((f) => [f.slug, f] as const));
    for (const [slug, type] of Object.entries(REQUIRED_DISH_FIELDS)) {
      const field = bySlug.get(slug);
      if (!field) {
        violations.push(`Dish field \`${slug}\` is missing`);
        continue;
      }
      if (field.type !== type) {
        violations.push(`Dish field \`${slug}\` is type \`${field.type}\`, expected \`${type}\``);
      }
      if (REQUIRED_DISH_FIELD_REQUIRED.has(slug) && field.required !== true) {
        violations.push(`Dish field \`${slug}\` must be required`);
      }
    }
  }

  const records = dishRecords(seed);
  if (records.length !== 1) {
    violations.push(
      `expected exactly 1 seeded dish (honest-empty), found ${records.length}`,
    );
  } else {
    const data = records[0]!.data;
    for (const slug of Object.keys(REQUIRED_DISH_FIELDS)) {
      if (!(slug in data)) {
        violations.push(`the seeded example dish is missing \`${slug}\` in its data`);
      }
    }
  }

  return { ok: violations.length === 0, violations };
}
