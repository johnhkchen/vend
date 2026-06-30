import { describe, expect, test } from "bun:test";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { parseKitchenSeed } from "./dish-seed.ts";
import {
  dishToCard,
  menuCards,
  renderMenu,
  dishesFromSeed,
  MENU_CARD_CLASS,
  MENU_EMPTY_MARKER,
  PUBLISHED_STATUS,
  type DishCard,
} from "./menu-render.ts";

// T-062-03-03 — the menu-render slice. This locks the DETERMINISTIC half of the AC (clauses 1+2):
//   1. the render is one-card-per-dish, sourced from EmDash's REST record shape, MATCHING the seeded
//      example dish (blocks A–C);
//   2. the gold-master reference page that `astro build` proved green mirrors this spec (block D — the
//      anti-drift guard; the real build is build.proof.txt).
// The metered half (clause 3 — a live `vend work` run landing inside the cold-start budget in
// runs.jsonl) is the human-authorized drive, recorded as `⟪…⟫` in EXPECTED-OUTCOME.menu-render.md and
// never asserted here (no offline castWork; honest-on-outcome) — the same split 03-01/03-02 hold.
//
// Addon-free + guarded-live, the dish-seed.test.ts idiom: pure functions on fabricated rows, plus one
// real fs read of the authored seed and one of the reference page. No engine/BAML import.

const SEED_DIR = join(import.meta.dir, "..", "..", "examples", "templates", "kitchen-seed");
const SEED_JSON = join(SEED_DIR, ".emdash", "seed.json");
const REFERENCE_PAGE = join(
  import.meta.dir,
  "..",
  "..",
  "docs",
  "active",
  "work",
  "T-062-03-03",
  "menu-render.index.astro",
);

/** A REST record at a given status with the three Dish fields — the `{id,slug,status,data}` shape
 *  dish-seed.ts models as "what EmDash serves via REST". */
function rec(status: string, data: Record<string, unknown>): {
  id: string;
  slug: string;
  status: string;
  data: Record<string, unknown>;
} {
  return { id: data.name as string, slug: "s", status, data };
}

describe("menu-render spec — the pure render contract (T-062-03-03, clauses 1+2)", () => {
  describe("A — record → card view-model", () => {
    test("maps name/photo/description out of record.data", () => {
      const card = dishToCard(
        rec(PUBLISHED_STATUS, { name: "Ramen", photo: "/m/r.jpg", description: "rich broth" }),
      );
      expect(card).toEqual({ name: "Ramen", photo: "/m/r.jpg", description: "rich broth" });
    });

    test("absent photo / description coerce to null; missing name coerces to '' (row stays visible)", () => {
      expect(dishToCard(rec(PUBLISHED_STATUS, { name: "Toast" }))).toEqual({
        name: "Toast",
        photo: null,
        description: null,
      });
      expect(dishToCard(rec(PUBLISHED_STATUS, {}))).toEqual({ name: "", photo: null, description: null });
    });

    test("menuCards keeps published only, in REST order — the 'one card per dish' contract", () => {
      const cards = menuCards([
        rec(PUBLISHED_STATUS, { name: "A" }),
        rec("draft", { name: "B" }),
        rec(PUBLISHED_STATUS, { name: "C" }),
      ]);
      expect(cards.map((c) => c.name)).toEqual(["A", "C"]);
    });
  });

  describe("B — renderMenu HTML shape", () => {
    const cards: DishCard[] = [
      { name: "Ramen", photo: "/m/r.jpg", description: "rich broth" },
      { name: "Toast", photo: null, description: null },
    ];

    test("one card article per dish; fields present; photo/description omitted when null", () => {
      const html = renderMenu(cards);
      const articleCount = html.split(`<article class="${MENU_CARD_CLASS}"`).length - 1;
      expect(articleCount).toBe(2); // one card per dish
      expect(html).toContain("Ramen");
      expect(html).toContain("rich broth");
      expect(html).toContain('src="/m/r.jpg"');
      // the photo-less, description-less card renders its name but no <img>/<p class=desc> for it:
      expect(html).toContain("Toast");
      expect(html.match(/<img/g)?.length ?? 0).toBe(1); // only Ramen has a photo
    });

    test("escapes HTML-significant characters in dish text", () => {
      const html = renderMenu([{ name: "Fish & <Chips>", photo: null, description: `"good"` }]);
      expect(html).toContain("Fish &amp; &lt;Chips&gt;");
      expect(html).toContain("&quot;good&quot;");
      expect(html).not.toContain("<Chips>");
    });

    test("zero dishes → honest-empty marker, NO card article (IA-4)", () => {
      const html = renderMenu([]);
      expect(html).toContain(MENU_EMPTY_MARKER);
      expect(html).not.toContain(`<article class="${MENU_CARD_CLASS}"`);
    });
  });

  describe("C — matches the REAL seeded example dish (clause 1: 'matching the example dish')", () => {
    test("the authored seed renders to exactly one card carrying the example dish's fields", async () => {
      const seed = parseKitchenSeed(await readFile(SEED_JSON, "utf8"));
      const dishes = dishesFromSeed(seed);
      expect(dishes).toHaveLength(1); // honest-empty: exactly one example dish

      const cards = menuCards(dishes);
      expect(cards).toHaveLength(1);
      const card = cards[0]!;
      expect(card.name).toBe("Sample Dish (edit or delete me)");
      expect(card.photo).toBe("/media/sample-dish.jpg");
      expect(card.description).toContain("documents the Dish format");

      const html = renderMenu(cards);
      expect(html).toContain("Sample Dish (edit or delete me)");
      expect(html).toContain('src="/media/sample-dish.jpg"');
      expect(html.split(`<article class="${MENU_CARD_CLASS}"`).length - 1).toBe(1);
    });
  });

  describe("D — drift guard: the gold-master reference page mirrors this spec (clause 2)", () => {
    test("menu-render.index.astro carries the shared markers + the mobile-first viewport", async () => {
      const page = await readFile(REFERENCE_PAGE, "utf8");
      // the same card class the spec emits (the anti-drift anchor):
      expect(page).toContain(MENU_CARD_CLASS);
      // the same honest-empty copy:
      expect(page).toContain(MENU_EMPTY_MARKER);
      // mobile-first (the diner is on a phone) — the viewport meta the stub already carried:
      expect(page).toContain('name="viewport" content="width=device-width, initial-scale=1"');
      // SSR + request-time REST read (the resolved fork): it fetches EmDash and falls back to the
      // seeded example, so it is sourced from REST yet builds green standalone.
      expect(page).toMatch(/EMDASH_API_URL/);
      expect(page).toContain("/api/collections/dishes/records");
      expect(page).toContain("Sample Dish (edit or delete me)"); // the seeded-example fallback
    });
  });
});
