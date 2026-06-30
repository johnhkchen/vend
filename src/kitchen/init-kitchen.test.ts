import { describe, expect, test } from "bun:test";
import { mkdtemp, readFile, readdir, rm, stat, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  availableTemplates,
  countDemandRows,
  isLisaProject,
  isStandaloneTemplate,
  mergeManifests,
  resolveTemplate,
  SCAFFOLD_MANIFEST,
} from "../init/init-core.ts";
import { runInit } from "../init/init-effect.ts";
import { dishRecords, parseKitchenSeed, validateDishSeed } from "./dish-seed.ts";

// T-062-02-01: the AC for `vend init --template kitchen` — cast the gesture into an EMPTY dir and
// assert the full EmDash+Astro seed lands, then a second run converges no-clobber. Guarded-live, the
// init-effect.test.ts discipline: real `mkdtemp` / `runInit` / `readFile` / `stat`, torn down in
// `finally`, no mocks. The Dish-type + example-dish half is graded by REUSING the T-062-01-01 contract
// (`parseKitchenSeed` + `validateDishSeed`) against the SCAFFOLDED file — so the test answers to the
// authored contract, not a re-statement of it. The kitchen overlay's content is text-embedded from the
// authored example tree, so "the scaffold writes the authored bytes" is pinned by a byte-equality check
// against the example file (the structural substitute for a drift test).

/** stat→true / catch→false (the init-effect.test.ts no-shared-util idiom). */
async function exists(abs: string): Promise<boolean> {
  try {
    await stat(abs);
    return true;
  } catch {
    return false;
  }
}

/** A throwaway projectRoot that is an EMPTY, bare dir — no lisa marker, no checkout. Exactly the
 *  state a brew-installed `vend init --template kitchen` lands in for the dress-rehearsal/clean-room. */
async function bareEmptyDir(): Promise<string> {
  return mkdtemp(join(tmpdir(), "vend-init-kitchen-"));
}

/** The effective manifest the kitchen run applies — base + overlay (what the effect merges). */
const MERGED = mergeManifests(SCAFFOLD_MANIFEST, resolveTemplate("kitchen")!);

describe("vend init --template kitchen — registry + standalone (pure pins)", () => {
  test("kitchen is a registered, standalone template", () => {
    expect(availableTemplates()).toContain("kitchen");
    expect(resolveTemplate("kitchen")).toBeDefined();
    expect(isStandaloneTemplate("kitchen")).toBe(true);
  });

  test("the overlay carries the seed's headline files (Dish type, storefront, Cloudflare config)", () => {
    const paths = resolveTemplate("kitchen")!.map((e) => e.path);
    for (const p of [
      ".emdash/seed.json",
      "src/pages/index.astro",
      "astro.config.mjs",
      "wrangler.toml",
      "package.json",
      ".gitignore",
    ]) {
      expect(paths).toContain(p);
    }
  });
});

describe("vend init --template kitchen — lays the full seed into an empty dir (the AC)", () => {
  test("an empty, non-lisa dir scaffolds the full EmDash+Astro seed", async () => {
    const root = await bareEmptyDir();
    try {
      // precondition: a genuinely empty dir — bare `vend init` would be REFUSED here (not lisa).
      expect(isLisaProject(await readdir(root))).toBe(false);

      const outcome = await runInit(root, "kitchen");
      expect(outcome.kind).toBe("scaffolded");
      if (outcome.kind !== "scaffolded") throw new Error("unreachable");

      // ── the base vend workspace is present + honest-empty (the cook drives with steer/work) ──
      for (const entry of SCAFFOLD_MANIFEST) {
        expect(await exists(join(root, entry.path))).toBe(true);
      }
      expect(countDemandRows(await readFile(join(root, "docs/active/demand.md"), "utf8"))).toBe(0);
      expect(countDemandRows(await readFile(join(root, "docs/archive/demand-cleared.md"), "utf8"))).toBe(0);

      // ── Dish type + example dish: grade the SCAFFOLDED seed against the T-062-01-01 contract ──
      const seed = parseKitchenSeed(await readFile(join(root, ".emdash/seed.json"), "utf8"));
      const check = validateDishSeed(seed);
      expect(check.violations).toEqual([]); // surface reasons if it ever regresses
      expect(check.ok).toBe(true);
      expect(dishRecords(seed).length).toBe(1); // exactly one example dish (honest-empty)

      // ── stub storefront: the deliberate "coming soon" page, fetching nothing ──
      const indexAstro = await readFile(join(root, "src/pages/index.astro"), "utf8");
      expect(indexAstro).toContain("coming soon");
      expect(indexAstro).not.toContain("fetch("); // the menu render is what `vend work` clears

      // ── Cloudflare config-present (adapter + deploy contract) ──
      const astroConfig = await readFile(join(root, "astro.config.mjs"), "utf8");
      expect(astroConfig).toContain("adapter");
      expect(astroConfig).toContain("cloudflare");
      const wrangler = await readFile(join(root, "wrangler.toml"), "utf8");
      expect(wrangler).toContain("kitchen-storefront");
      const pkg = await readFile(join(root, "package.json"), "utf8");
      expect(pkg).toContain("@astrojs/cloudflare");

      // ── the scaffold writes the AUTHORED bytes (the text-embed is the real seed, not stale) ──
      const authoredSeed = await readFile("examples/templates/kitchen-seed/.emdash/seed.json", "utf8");
      expect(await readFile(join(root, ".emdash/seed.json"), "utf8")).toBe(authoredSeed);
      const authoredEnvDts = await readFile("examples/templates/kitchen-seed/src/env.d.ts", "utf8");
      expect(await readFile(join(root, "src/env.d.ts"), "utf8")).toBe(authoredEnvDts); // the inlined file

      // ── one-way-to-lisa: the standalone overlay writes NO lisa marker ──
      expect(await exists(join(root, "CLAUDE.md"))).toBe(false);
      expect(await exists(join(root, ".lisa.toml"))).toBe(false);

      // ── a truthful tally: a bare dir → everything created, nothing skipped ──
      expect(outcome.result.created.length).toBe(MERGED.length);
      expect(outcome.result.skipped).toEqual([]);
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  test("a second run converges no-clobber — zero created, all skipped, user edits survive", async () => {
    const root = await bareEmptyDir();
    const editedPath = "src/pages/index.astro";
    const edited = "<!-- MY OWN MENU — do not touch -->\n";
    try {
      await runInit(root, "kitchen");
      // the cook edits a scaffolded seed file, then re-runs init.
      await writeFile(join(root, editedPath), edited, "utf8");

      const outcome = await runInit(root, "kitchen");
      expect(outcome.kind).toBe("scaffolded");
      if (outcome.kind !== "scaffolded") throw new Error("unreachable");

      // converge: nothing created, the whole merged manifest skipped...
      expect(outcome.result.created).toEqual([]);
      expect(outcome.result.skipped.length).toBe(MERGED.length);
      // ...and the edit is byte-identical (the overlay never clobbers an existing file).
      expect(await readFile(join(root, editedPath), "utf8")).toBe(edited);
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });
});
