import { describe, expect, test } from "bun:test";
import { readFile as fsReadFile } from "node:fs/promises";
import { join } from "node:path";
import type { Check } from "../doctor/doctor-core.ts";
import {
  ASTRO_CHECK,
  ASTRO_HINT,
  astroConfigCheck,
  BUN_CHECK,
  BUN_HINT,
  bunCheck,
  dishSeedCheck,
  isKitchenWorkspace,
  KITCHEN_SIGNATURE,
  probeKitchen,
  SEED_CHECK,
  SEED_HINT,
} from "./kitchen-doctor.ts";

// T-062-02-02: the IMPURE kitchen-workspace doctor probe. The world-facts (onPath / readFile) are
// INJECTED, so the whole branch matrix is exercised DETERMINISTICALLY with fabricated facts — no
// dependence on the host's PATH or fs (the doctor-probe.test.ts / planInit discipline). The
// all-green case grades against the AUTHORED seed bytes (the init-kitchen.test.ts idiom — answer to
// the real source, not a restated literal). A guarded-live block proves the REAL defaults compose
// without throwing. The branches:
//   (1) all-ok → every Check green, fixed order [bun, astro, seed], no hints;
//   (2) bun off PATH → the bun Check is red w/ its hint; the probe RETURNS (does not raise);
//   (3) astro config absent/garbled or deps missing → the astro Check is red w/ its hint;
//   (4) seed invalid (contract violation) → the seed Check is red, the hint NAMES the violation;
//   (5) seed file unreadable / malformed JSON → red via safeCheck (degraded, never thrown);
//   + isKitchenWorkspace true iff BOTH signatures present;
//   + the probe NEVER throws on any input.

const SEED_DIR = "examples/templates/kitchen-seed";

/** The authored seed bytes for one workspace-relative path — feeds the all-green case. */
function authored(rel: string): Promise<string> {
  return fsReadFile(join(SEED_DIR, rel), "utf8");
}

/** A readFile that serves the authored seed bytes for any path under the kitchen seed. */
const authoredReadFile = (path: string): Promise<string> => {
  // path is `<dir>/astro.config.mjs` | `<dir>/package.json` | `<dir>/.emdash/seed.json`.
  if (path.endsWith("astro.config.mjs")) return authored("astro.config.mjs");
  if (path.endsWith("package.json")) return authored("package.json");
  if (path.endsWith(join(".emdash", "seed.json"))) return authored(".emdash/seed.json");
  throw new Error(`unexpected read: ${path}`);
};

const allOnPath = async () => true;
const noOnPath = async () => false;

/** Look one named check out of a returned set. */
function byName(checks: readonly Check[], name: string): Check | undefined {
  return checks.find((c) => c.name === name);
}

describe("isKitchenWorkspace — both signatures required", () => {
  test("true iff the listing carries every KITCHEN_SIGNATURE entry", () => {
    expect(isKitchenWorkspace([".emdash", "astro.config.mjs", "package.json"])).toBe(true);
    expect(isKitchenWorkspace([".emdash"])).toBe(false); // missing astro.config.mjs
    expect(isKitchenWorkspace(["astro.config.mjs"])).toBe(false); // missing .emdash
    expect(isKitchenWorkspace([])).toBe(false);
    // a generic vend/lisa project (no kitchen signature) is NOT a kitchen workspace.
    expect(isKitchenWorkspace(["CLAUDE.md", "docs", "src"])).toBe(false);
    expect(KITCHEN_SIGNATURE).toEqual([".emdash", "astro.config.mjs"]);
  });
});

describe("probeKitchen — branch (1): all-ok in a scaffolded workspace", () => {
  test("every prerequisite is green; three checks in fixed order; no hints", async () => {
    const checks = await probeKitchen("/ws", { onPath: allOnPath, readFile: authoredReadFile });

    expect(checks.length).toBe(3);
    expect(checks.every((c) => c.ok)).toBe(true);
    expect(checks.every((c) => c.hint === undefined)).toBe(true);

    expect(checks[0]?.name).toBe(BUN_CHECK);
    expect(checks[1]?.name).toBe(ASTRO_CHECK);
    expect(checks[2]?.name).toBe(SEED_CHECK);
  });
});

describe("probeKitchen — branch (2): bun off PATH", () => {
  test("the bun check is red with its hint; the probe RETURNS (does not raise)", async () => {
    const checks = await probeKitchen("/ws", { onPath: noOnPath, readFile: authoredReadFile });
    const bun = byName(checks, BUN_CHECK)!;
    expect(bun.ok).toBe(false);
    expect(bun.hint).toBe(BUN_HINT);
    // the other prerequisites are unaffected (still green from the authored bytes).
    expect(byName(checks, ASTRO_CHECK)?.ok).toBe(true);
    expect(byName(checks, SEED_CHECK)?.ok).toBe(true);
  });
});

describe("bunCheck — total over its injected fact", () => {
  test("green on PATH, red+hint off PATH", async () => {
    expect((await bunCheck(allOnPath)).ok).toBe(true);
    const red = await bunCheck(noOnPath);
    expect(red.ok).toBe(false);
    expect(red.hint).toBe(BUN_HINT);
  });
});

describe("astroConfigCheck — branch (3): config presence", () => {
  test("green when adapter config + both deps are present", async () => {
    expect((await astroConfigCheck(authoredReadFile, "/ws")).ok).toBe(true);
  });

  test("red when the config omits the cloudflare adapter", async () => {
    const rf = async (p: string) =>
      p.endsWith("astro.config.mjs")
        ? 'import { defineConfig } from "astro/config";\nexport default defineConfig({});\n'
        : authoredReadFile(p);
    const c = await astroConfigCheck(rf, "/ws");
    expect(c.ok).toBe(false);
    expect(c.hint).toBe(ASTRO_HINT);
  });

  test("red when package.json is missing a required dependency", async () => {
    const rf = async (p: string) =>
      p.endsWith("package.json")
        ? JSON.stringify({ dependencies: { astro: "^6.4.8" } }) // no @astrojs/cloudflare
        : authoredReadFile(p);
    const c = await astroConfigCheck(rf, "/ws");
    expect(c.ok).toBe(false);
    expect(c.hint).toBe(ASTRO_HINT);
  });
});

describe("dishSeedCheck — branch (4)/(5): contract + malformed", () => {
  test("green on the authored seed (zero violations)", async () => {
    expect((await dishSeedCheck(authoredReadFile, "/ws")).ok).toBe(true);
  });

  test("red, hint NAMES the violation, when the seed breaks the Dish contract", async () => {
    // a structurally-valid seed (collections array) that fails validateDishSeed: no dishes.
    const rf = async (p: string) =>
      p.endsWith(join(".emdash", "seed.json"))
        ? JSON.stringify({ collections: [], content: {} })
        : authoredReadFile(p);
    const c = await dishSeedCheck(rf, "/ws");
    expect(c.ok).toBe(false);
    // the first violation (the absent Dish content type) leads the hint, then the restore hint.
    expect(c.hint).toContain("Dish content type");
    expect(c.hint).toContain(SEED_HINT);
  });
});

describe("probeKitchen — never throws (branch 5 degraded by safeCheck)", () => {
  test("a malformed seed file degrades to a red check, the probe still resolves", async () => {
    const rf = async (p: string) =>
      p.endsWith(join(".emdash", "seed.json")) ? "{ not json" : authoredReadFile(p);
    const checks = await probeKitchen("/ws", { onPath: allOnPath, readFile: rf });
    expect(checks.length).toBe(3);
    const seed = byName(checks, SEED_CHECK)!;
    expect(seed.ok).toBe(false);
    expect(typeof seed.hint).toBe("string"); // carries the parse message, never undefined
  });

  test("a readFile that always throws yields three red checks, never raises", async () => {
    const rf = async () => {
      throw new Error("EACCES");
    };
    const checks = await probeKitchen("/ws", { onPath: noOnPath, readFile: rf });
    expect(checks.length).toBe(3);
    expect(checks.filter((c) => !c.ok).length).toBe(3);
  });
});

describe("probeKitchen — guarded-live: the REAL defaults compose without throwing", () => {
  test("against the authored seed dir, resolves to three ordered checks", async () => {
    // Uses the default readFile (real fs) against the in-repo authored seed; bun is the runtime
    // running this test, so the bun check is green here too — but we assert only the shape +
    // resolution (the host-independent invariant), not a hard green.
    const checks = await probeKitchen(SEED_DIR);
    expect(checks.length).toBe(3);
    expect(checks.map((c) => c.name)).toEqual([BUN_CHECK, ASTRO_CHECK, SEED_CHECK]);
    expect(byName(checks, SEED_CHECK)?.ok).toBe(true); // the real authored seed validates
  });
});
