import { describe, expect, test } from "bun:test";
import { mkdtemp, readFile, rm, stat } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { Signal, Fork, Steer, SignalTier } from "../../baml_client/index.ts";
import { runInit } from "../init/init-effect.ts";
import {
  buildProjectSnapshot,
  listIdsIn,
  SEED_PATH,
  CHARTER_PATH,
} from "../play/project-context.ts";
import { clear } from "../play/steer-core.ts";

// T-062-03-01: confirm the E-059 seed-intent → steer seam reaches a coherent kitchen board on the
// MATERIALIZED seed (not just the spike), with the menu-render slice on top, and RECORD that board.
//
// What this proves OFFLINE (the gate-coverable substance — see design.md):
//   A. `vend init --template kitchen` now lays a SEED.md (the cook's intent) AND a kitchen-tuned
//      docs/knowledge/charter.md — the two files the overlay was missing (the AC's "seed-intent").
//   B. that intent REACHES the steer snapshot: `buildProjectSnapshot` (the SAME pure function
//      `assembleSteerInputs` composes) emits a `## Stated intent (SEED.md)` section carrying the
//      menu-render intent, and the charter steer grades against is the kitchen value function — not
//      the generic CHARTER_STUB. (assembleSteerInputs itself lives in steer.ts and value-imports the
//      BAML addon, so a bun test must not import it; we reconstruct its output addon-free, faithfully.)
//   C. the RECORDED gold-master board (docs/active/work/T-062-03-01/expected-board.md, encoded here
//      as a typed fixture) is gate-valid (`clear` passes all three steer gates) and has the
//      menu-render slice at index 0 / Keystone — the AC's "highest-ranked slice is the menu-render slice".
//
// What is DEFERRED (honest-on-outcome): the LIVE, non-deterministic `vend steer` ranking is the
// human-authorized metered cast (T-062-03-03, P7) — `vend steer` has no offline/dry-run path. This
// test asserts as FACT only the deterministic seam + the recorded board's validity; the live ranking
// is recorded as the EXPECTED target in expected-board.md, explicitly not-yet-captured.

/** stat→true / catch→false (the init-kitchen.test.ts no-shared-util idiom). */
async function exists(abs: string): Promise<boolean> {
  try {
    await stat(abs);
    return true;
  } catch {
    return false;
  }
}

/** A bare, empty dir — the state a brew-installed `vend init --template kitchen` lands in. */
async function bareEmptyDir(): Promise<string> {
  return mkdtemp(join(tmpdir(), "vend-kitchen-steer-"));
}

/** A complete, grounded Signal at a given tier — the `b.parse` shape (member-name tier), copied from
 *  steer-core.test.ts per the no-shared-util idiom. */
function mkSignal(tier: SignalTier, over: Partial<Signal> = {}): Signal {
  return {
    what: `Move at ${tier}`,
    why: `Closes menu-distance at the ${tier} tier.`,
    tier,
    budget: "~1 block (≈2h)",
    advances: ["the menu render"],
    grounding: "SEED.md; the kitchen charter",
    readiness: "ready",
    ...over,
  };
}

const mkSteer = (signals: Signal[], forks: Fork[] = []): Steer => ({ signals, forks });

// ── The recorded gold-master board (mirrors docs/active/work/T-062-03-01/expected-board.md) ──
// The keystone `what` is shared as a const so the typed fixture and the diffable artifact don't drift
// (expected-board.md quotes this exact line).
export const KEYSTONE_MENU_RENDER =
  "Render the dishes menu at / — read Dish content from EmDash's REST API and show one mobile-first " +
  "card per dish (photo, name, description), replacing the coming-soon stub.";

/** The expected kitchen board: the menu-render slice (Keystone, index 0), a lower-leverage deploy
 *  signal, and one genuine SSG-vs-SSR fork. Leverage-ordered (Keystone → Standard) and fully grounded,
 *  so `clear` passes all three steer gates. This is the board T-062-03-03's live cast is diffed against. */
const GOLD_MASTER_BOARD: Steer = mkSteer(
  [
    mkSignal("Keystone" as SignalTier, {
      what: KEYSTONE_MENU_RENDER,
      why: "The whole point of the seed — the diner opens / on their phone and sees the week's dishes; nothing showable exists until this clears.",
      budget: "~1 block (≈2h)",
      advances: ["renders the diner menu — charter criterion 1 (menu-advancing)"],
      grounding:
        "SEED.md '## The first slice — render the menu'; src/pages/index.astro stub ('the menu is the slice vend work clears'); the Dish type in .emdash/seed.json",
      readiness: "ready",
    }),
    mkSignal("Standard" as SignalTier, {
      what: "Deploy the storefront to Cloudflare — wire the cook's account secrets and push.",
      why: "The deploy path is config-present but inert without secrets and renders nothing until the menu exists — lower leverage than the render itself.",
      budget: "small (~1h)",
      advances: ["ships the menu to the diner's phone — charter criterion 4 (in-bounds deploy path)"],
      grounding:
        "wrangler.toml + astro.config.mjs cloudflare adapter + .github/workflows/deploy.yml (INERT without the cook's secrets)",
      readiness: "blocked: the menu render must exist first; the cook's Cloudflare secrets",
    }),
  ],
  [
    {
      question: "Fetch the dishes at build time (SSG) or per request (SSR on Cloudflare)?",
      options: [
        "Build-time (SSG): fetch dishes during `astro build`, re-deploy on menu changes",
        "Request-time (SSR): fetch dishes on each visit via the Cloudflare adapter",
      ],
      whyItMatters:
        "It sets how fresh the menu is and how the cook publishes changes — SSG is fast and cheap but needs a re-deploy per edit; SSR shows edits instantly but runs a worker fetch per visit.",
      recommendation:
        "Start with SSR on the Cloudflare adapter the seed already configures — the couple edits dishes often, and instant freshness beats a re-deploy step for a two-person menu.",
    },
  ],
);

describe("T-062-03-01 A — the materialized kitchen seed carries the seed-intent + tuned charter", () => {
  test("`vend init --template kitchen` lays SEED.md and a kitchen-tuned charter (byte-equal to source)", async () => {
    const root = await bareEmptyDir();
    try {
      const outcome = await runInit(root, "kitchen");
      expect(outcome.kind).toBe("scaffolded");

      // SEED.md — present, byte-equal to the authored source (the drift pin), names the menu render.
      expect(await exists(join(root, "SEED.md"))).toBe(true);
      const scaffoldedSeed = await readFile(join(root, "SEED.md"), "utf8");
      const authoredSeed = await readFile("examples/templates/kitchen-seed/SEED.md", "utf8");
      expect(scaffoldedSeed).toBe(authoredSeed);
      expect(scaffoldedSeed).toContain("home-kitchen menu");
      expect(scaffoldedSeed).toContain("render the menu");

      // charter.md — the kitchen value function OVERRODE the generic base stub at the path steer reads.
      expect(await exists(join(root, "docs/knowledge/charter.md"))).toBe(true);
      const scaffoldedCharter = await readFile(join(root, "docs/knowledge/charter.md"), "utf8");
      const authoredCharter = await readFile("examples/templates/kitchen-seed/charter.md", "utf8");
      expect(scaffoldedCharter).toBe(authoredCharter);
      expect(scaffoldedCharter).toContain("home-kitchen menu");
      expect(scaffoldedCharter).not.toContain("# Vend — Charter"); // i.e. NOT the generic CHARTER_STUB
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });
});

describe("T-062-03-01 B — the intent reaches the steer snapshot (E-059, deterministic, zero spend)", () => {
  test("buildProjectSnapshot (assembleSteerInputs' pure core) emits the menu-render intent", async () => {
    const root = await bareEmptyDir();
    try {
      await runInit(root, "kitchen");

      // Reconstruct EXACTLY what assembleSteerInputs builds — same reads, same pure builder, no BAML.
      const intent = await readFile(join(root, SEED_PATH), "utf8");
      const charter = await readFile(join(root, CHARTER_PATH), "utf8");
      const stories = await listIdsIn(`${root}/docs/active/stories`);
      const tickets = await listIdsIn(`${root}/docs/active/tickets`);
      const project = buildProjectSnapshot({ root, srcFiles: [], stories, tickets, intent });

      // The intent IS in steer's `{{ project }}` input — absent before this ticket.
      expect(project).toContain("## Stated intent (SEED.md)");
      expect(project).toContain("home-kitchen menu");
      expect(project).toContain("render the menu");
      // The charter steer grades the board against is the kitchen value function.
      expect(charter).toContain("home-kitchen menu");
      expect(charter).not.toContain("# Vend — Charter");
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  test("negative control: with no intent the snapshot has no Stated-intent section (the wire IS the SEED.md)", () => {
    const without = buildProjectSnapshot({ root: "/x", srcFiles: [], stories: [], tickets: [], intent: undefined });
    expect(without).not.toContain("## Stated intent (SEED.md)");
  });
});

describe("T-062-03-01 C — the recorded gold-master board is gate-valid + menu-render-topped", () => {
  test("the recorded board clears all three steer gates", () => {
    const v = clear(GOLD_MASTER_BOARD);
    expect(v.status).toBe("clear");
  });

  test("the highest-ranked slice is the menu-render slice (the AC)", () => {
    const top = GOLD_MASTER_BOARD.signals[0]!;
    expect(top.tier).toBe("Keystone" as SignalTier); // index 0 is the top of a leverage-ordered board
    expect(top.what).toBe(KEYSTONE_MENU_RENDER);
    expect(top.what).toContain("Render the dishes menu");
    // grounded in real seed state (read-never-invent), not invented.
    expect(top.grounding).toContain("SEED.md");
    expect(top.grounding).toContain("index.astro");
  });
});
