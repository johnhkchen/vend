import { afterEach, describe, expect, test } from "bun:test";
import { mkdtemp, readFile, readdir, rm, stat } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { runInit } from "../init/init-effect.ts";
import {
  ASTRO_CHECK,
  BUN_CHECK,
  isKitchenWorkspace,
  KITCHEN_SIGNATURE,
  probeKitchen,
  SEED_CHECK,
} from "./kitchen-doctor.ts";
import { EXIT_OK, renderDoctorReport } from "../doctor/doctor-core.ts";
import { buildProjectSnapshot, CHARTER_PATH, listIdsIn, SEED_PATH } from "../play/project-context.ts";
import { readProjectMcpServers } from "../engine/mcp-registry.ts";
import { resolveTools } from "../engine/cast-core.ts";
import { DECOMPOSE_TOOLS } from "../play/decompose-epic-core.ts";
import { AUTONOMOUS_DENY } from "../play/autonomous-deny.ts";

// T-062-03-04 (the harden card) — the END-TO-END COLD-START RE-DRIVE GUARD.
//
// Every bootstrap seam already has its OWN test, but each scaffolds its OWN temp dir and asserts
// its OWN seam in isolation: init-kitchen.test.ts (init), kitchen-doctor.smoke.test.ts (doctor),
// seed-steer-seam.test.ts (steer inputs), kitchen-degrade.test.ts (degrade). NONE drives the whole
// path as one continuous re-drive on ONE workspace — so a regression in the COMPOSITION (a scaffold
// change init lays but doctor/steer no longer accept, an ordering coupling) would not fail loudly.
// This test closes exactly that gap: it is the AC's "a fresh re-drive of the full path runs clean
// with no manual intervention", turned from a by-hand witness into a GATE.
//
// WHY DETERMINISTIC (the kitchen-doctor.smoke.test.ts rationale): the bun probe passes because bun
// runs this very test (guaranteed on PATH); the Astro config + Dish seed are scaffolded + contract-
// valid; the MCP registry is empty by construction (no overlay ships a .mcp.json). Green by
// construction, no host dependence.
//
// WHAT IS DEFERRED (honest-on-outcome, P7): the LIVE metered half — the non-deterministic `vend
// steer` RANKING and the `vend work` CLEAR landing inside the cold-start budget — is the human-
// authorized cast (T-062-04-01). This guard stops at steer INPUTS (the pure snapshot the live
// ranking reads) and degrade RESOLUTION (the tool contract the live cast reads); it spends no token,
// spawns no executor, needs no Claude login. The metered values stay `⟪…⟫` in the EXPECTED-OUTCOME
// files, never fabricated here.

/** stat→true / catch→false (the seed-steer-seam.test.ts no-shared-util idiom). */
async function exists(abs: string): Promise<boolean> {
  try {
    await stat(abs);
    return true;
  } catch {
    return false;
  }
}

const tmps: string[] = [];
afterEach(async () => {
  await Promise.all(tmps.splice(0).map((d) => rm(d, { recursive: true, force: true })));
});

/** A bare, empty dir — the state a brew-installed `vend init --template kitchen` lands in. */
async function bareEmptyDir(): Promise<string> {
  const root = await mkdtemp(join(tmpdir(), "vend-kitchen-redrive-"));
  tmps.push(root);
  return root;
}

describe("T-062-03-04 — the full cold-start path re-drives clean in one pass (the hardened bootstrap guard)", () => {
  test("init → scaffold → doctor → steer-inputs → degrade → idempotent re-init, in sequence on one workspace", async () => {
    const root = await bareEmptyDir();

    // ── Stage 1: INIT — a bare dir scaffolds the whole kitchen seed, no skips ──────────────────
    const out = await runInit(root, "kitchen");
    expect(out.kind).toBe("scaffolded");
    if (out.kind !== "scaffolded") throw new Error("unreachable"); // narrow for the result access
    expect(out.result.created.length).toBeGreaterThan(0);
    expect(out.result.skipped).toEqual([]);

    // ── Stage 2: SCAFFOLD — the workspace IS a kitchen workspace and carries the intent files ──
    const entries = await readdir(root);
    expect(isKitchenWorkspace(entries)).toBe(true);
    for (const sig of KITCHEN_SIGNATURE) expect(entries).toContain(sig);
    expect(await exists(join(root, ".emdash/seed.json"))).toBe(true); // the Dish contract
    expect(await exists(join(root, SEED_PATH))).toBe(true); // the cook's intent (E-059)
    expect(await exists(join(root, CHARTER_PATH))).toBe(true); // the kitchen value function
    expect(await exists(join(root, "src/pages/index.astro"))).toBe(true); // the stub storefront

    // ── Stage 3: DOCTOR — the REAL probe on the scaffold is green (bun runs this test ⇒ on PATH) ─
    const checks = await probeKitchen(root); // real default deps, no injection
    const report = renderDoctorReport(checks);
    expect(report.ok).toBe(true);
    expect(report.exitCode).toBe(EXIT_OK);
    expect(checks.every((c) => c.ok)).toBe(true);
    const names = checks.map((c) => c.name);
    expect(names).toEqual([BUN_CHECK, ASTRO_CHECK, SEED_CHECK]); // fixed order, every kitchen probe

    // ── Stage 4: SEED→STEER (inputs, zero spend) — the cook's intent reaches the steer snapshot ─
    //   Reconstruct EXACTLY what assembleSteerInputs builds (steer.ts value-imports the BAML addon,
    //   so a bun test must not import it; buildProjectSnapshot is the pure core it composes).
    const intent = await readFile(join(root, SEED_PATH), "utf8");
    const charter = await readFile(join(root, CHARTER_PATH), "utf8");
    const stories = await listIdsIn(`${root}/docs/active/stories`);
    const tickets = await listIdsIn(`${root}/docs/active/tickets`);
    const project = buildProjectSnapshot({ root, srcFiles: [], stories, tickets, intent });
    expect(project).toContain("## Stated intent (SEED.md)"); // the wire the live ranking reads
    expect(project).toContain("render the menu");
    expect(charter).toContain("home-kitchen menu"); // the kitchen value function…
    expect(charter).not.toContain("# Vend — Charter"); // …not the generic CHARTER_STUB

    // ── Stage 5: DEGRADE (mcp-absence, zero spend) — degrades, never the missing-capability andon ─
    const { available } = await readProjectMcpServers(root);
    expect(available).toEqual([]); // no overlay ships a .mcp.json — cold-start state is real
    const resolved = resolveTools(DECOMPOSE_TOOLS, available);
    expect(resolved).toEqual({
      ok: true,
      strict: true,
      mcp: [],
      allowedTools: ["Read", "Grep", "Glob"],
      deny: [...AUTONOMOUS_DENY],
      reducedGrounding: true,
    });
    expect(resolved.ok).toBe(true); // explicitly NOT the ok:false andon

    // ── Stage 6: RE-DRIVE — a second `init` converges no-clobber; doctor stays green (no manual fix) ─
    const again = await runInit(root, "kitchen");
    expect(again.kind).toBe("scaffolded");
    if (again.kind !== "scaffolded") throw new Error("unreachable");
    expect(again.result.created).toEqual([]); // nothing re-created
    expect(again.result.skipped.length).toBe(out.result.created.length); // the whole tree converged
    const reChecks = await probeKitchen(root);
    expect(renderDoctorReport(reChecks).ok).toBe(true); // still green after the re-drive
  });
});
