import { describe, expect, test } from "bun:test";
import { readFile } from "node:fs/promises";
import {
  DISH_COLLECTION_SLUG,
  REQUIRED_DISH_FIELDS,
  REQUIRED_DISH_FIELD_REQUIRED,
  dishRecords,
  findCollection,
  parseKitchenSeed,
  validateDishSeed,
  type EmDashRecord,
  type EmDashSeed,
} from "./dish-seed.ts";

// T-062-01-01: assert the authored `Dish` content type + the single-row honest-empty seed.
// The positive cases read the REAL authored file (the drift-guard precedent — the
// HACKATHON_CHARTER test reads its example seed the same way), so any drift between the
// contract and the seed turns the gate red. The negative cases use in-memory seeds to prove
// the single-row / schema rule is genuinely enforced, not incidental. No live EmDash here —
// the seed is the contract EmDash applies on first boot (admin exposes the type; REST serves
// the records), and that contract is exactly what these assertions pin.

const SEED_PATH = "examples/templates/kitchen-seed/.emdash/seed.json";

describe("kitchen Dish content type — the authored seed", () => {
  // Read + parse once; reused across the AC assertions below.
  let seed: EmDashSeed;
  test("the authored seed.json parses as an EmDash seed", async () => {
    seed = parseKitchenSeed(await readFile(SEED_PATH, "utf8"));
    expect(seed.collections.length).toBeGreaterThanOrEqual(1);
  });

  test("the seed validates: schema + single-row honest-empty (the AC)", () => {
    const check = validateDishSeed(seed);
    // Surface the actual reasons if this ever regresses.
    expect(check.violations).toEqual([]);
    expect(check.ok).toBe(true);
  });

  test("the Dish collection declares photo/name/description with the contract types", () => {
    const dishes = findCollection(seed, DISH_COLLECTION_SLUG);
    expect(dishes).toBeDefined();
    expect(dishes!.labelSingular).toBe("Dish");

    const bySlug = new Map(dishes!.fields.map((f) => [f.slug, f]));
    for (const [slug, type] of Object.entries(REQUIRED_DISH_FIELDS)) {
      expect(bySlug.get(slug)?.type).toBe(type);
    }
    // `name` is required; photo/description are filled later in the admin.
    for (const slug of REQUIRED_DISH_FIELD_REQUIRED) {
      expect(bySlug.get(slug)?.required).toBe(true);
    }
  });

  test("REST serves exactly one seeded example dish, carrying the three fields", () => {
    const records = dishRecords(seed);
    expect(records.length).toBe(1);
    const data = records[0]!.data;
    for (const slug of Object.keys(REQUIRED_DISH_FIELDS)) {
      expect(data).toHaveProperty(slug);
    }
    // The single record is published, so REST/admin actually surface it.
    expect(records[0]!.status).toBe("published");
  });
});

describe("validateDishSeed — the single-row + schema rule is enforced", () => {
  const oneGoodDish: EmDashRecord = {
    id: "d1",
    slug: "d1",
    status: "published",
    data: { name: "A", photo: "/m/a.jpg", description: "a" },
  };

  /** A minimal well-formed Dish seed with a swappable record list, for the negative cases. */
  function seedWithRecords(records: readonly EmDashRecord[]): EmDashSeed {
    return {
      version: "1",
      collections: [
        {
          slug: "dishes",
          label: "Dishes",
          labelSingular: "Dish",
          fields: [
            { slug: "name", label: "Name", type: "string", required: true },
            { slug: "photo", label: "Photo", type: "image" },
            { slug: "description", label: "Description", type: "text" },
          ],
        },
      ],
      content: { dishes: records },
    };
  }

  test("a valid single-dish seed passes (control)", () => {
    expect(validateDishSeed(seedWithRecords([oneGoodDish])).ok).toBe(true);
  });

  test("zero records fails (honest-empty is one example, not none)", () => {
    const check = validateDishSeed(seedWithRecords([]));
    expect(check.ok).toBe(false);
    expect(check.violations.some((v) => v.includes("exactly 1"))).toBe(true);
  });

  test("two records fails (honest-empty is one example, not demand)", () => {
    const check = validateDishSeed(seedWithRecords([oneGoodDish, { ...oneGoodDish, id: "d2", slug: "d2" }]));
    expect(check.ok).toBe(false);
    expect(check.violations.some((v) => v.includes("exactly 1"))).toBe(true);
  });

  test("a missing field fails the schema check", () => {
    const seed: EmDashSeed = {
      collections: [
        {
          slug: "dishes",
          label: "Dishes",
          fields: [
            { slug: "name", label: "Name", type: "string", required: true },
            // photo dropped
            { slug: "description", label: "Description", type: "text" },
          ],
        },
      ],
      content: { dishes: [oneGoodDish] },
    };
    const check = validateDishSeed(seed);
    expect(check.ok).toBe(false);
    expect(check.violations.some((v) => v.includes("photo"))).toBe(true);
  });

  test("a mistyped field fails the schema check", () => {
    const seed: EmDashSeed = {
      collections: [
        {
          slug: "dishes",
          label: "Dishes",
          fields: [
            { slug: "name", label: "Name", type: "string", required: true },
            { slug: "photo", label: "Photo", type: "string" }, // should be image
            { slug: "description", label: "Description", type: "text" },
          ],
        },
      ],
      content: { dishes: [oneGoodDish] },
    };
    const check = validateDishSeed(seed);
    expect(check.ok).toBe(false);
    expect(check.violations.some((v) => v.includes("photo") && v.includes("image"))).toBe(true);
  });

  test("an absent dishes collection fails", () => {
    const seed: EmDashSeed = { collections: [], content: { dishes: [oneGoodDish] } };
    const check = validateDishSeed(seed);
    expect(check.ok).toBe(false);
    expect(check.violations.some((v) => v.includes("Dish content type is absent"))).toBe(true);
  });
});
