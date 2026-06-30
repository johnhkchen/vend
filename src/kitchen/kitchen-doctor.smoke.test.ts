import { describe, expect, test } from "bun:test";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { runInit } from "../init/init-effect.ts";

// T-062-02-02 — the AC, end to end: scaffold the kitchen workspace, then run the REAL `vend doctor`
// IN it, and assert a GREEN exit with every kitchen-seed prerequisite probe passing. Guarded-live,
// the doctor-cli.smoke.test.ts discipline: real `mkdtemp` / `runInit` / a spawned CLI, torn down in
// `finally`, no mocks. The composition it exercises (isKitchenWorkspace → probeKitchen →
// renderDoctorReport) is exhaustively unit-tested in kitchen-doctor.test.ts — this adds ONLY the
// wired-CLI, real-scaffold dimension.
//
// WHY THE GREEN IS DETERMINISTIC (unlike doctor-cli.smoke.test's case A, which CANNOT assert a hard
// green because lisa/claude may be absent): the kitchen probe checks bun (the runtime running this
// very test — guaranteed on PATH), the Astro/Cloudflare config (scaffolded), and the EmDash Dish
// seed (scaffolded + contract-valid, pinned by T-062-02-01). None depend on the build engine. So a
// freshly-scaffolded workspace is green by construction.

/** Absolute path to the CLI entry — this file is src/kitchen/, the CLI is src/cli.ts. */
const CLI = join(import.meta.dir, "..", "cli.ts");

/** A Node.js stack frame — its ABSENCE is the "no stack trace" clause. */
const STACK_FRAME = /\n {4}at /;

describe("vend doctor — green on the scaffolded kitchen workspace (T-062-02-02 AC)", () => {
  test("scaffold `--template kitchen`, run `vend doctor` there → exit 0, every kitchen probe green", async () => {
    const root = await mkdtemp(join(tmpdir(), "vend-doctor-kitchen-"));
    try {
      const outcome = await runInit(root, "kitchen");
      expect(outcome.kind).toBe("scaffolded"); // precondition: the seed actually landed

      // run the REAL CLI with cwd set INTO the scaffolded workspace — the workspace-aware doctor
      // dispatches on the cwd signature, so this exercises the kitchen branch.
      const r = Bun.spawnSync(["bun", "run", CLI, "doctor"], { cwd: root, env: process.env });
      const stdout = r.stdout.toString();
      const stderr = r.stderr.toString();

      // ── the AC: a GREEN exit ──
      expect(r.exitCode).toBe(0);
      expect(stdout.startsWith("doctor:")).toBe(true);
      expect(stdout).toContain("doctor: ok");

      // ── every kitchen-seed prerequisite probe passing (a green `✓` line for each) ──
      expect(stdout).toContain("✓ bun on PATH");
      expect(stdout).toContain("✓ Astro storefront config present");
      expect(stdout).toContain("✓ EmDash Dish seed valid");

      // ── the workspace-aware switch ACTUALLY swapped check-sets (so green is not an accident of
      //    the host happening to have the build engine): the build-engine checks are absent. ──
      expect(stdout).not.toContain("lisa on PATH");
      expect(stdout).not.toContain("BAML native addon");

      // ── a green verdict carries no stack trace anywhere ──
      expect(STACK_FRAME.test(stdout)).toBe(false);
      expect(STACK_FRAME.test(stderr)).toBe(false);
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });
});
