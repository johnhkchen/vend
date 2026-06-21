import { describe, expect, test } from "bun:test";
import { join } from "node:path";

// T-042-03 doctor-cli-command (story S-042-02, epic E-042 vend-doctor-preflight) — the
// guarded-live PROOF of the AC's RUNTIME half: running `vend doctor` prints the rendered preflight
// report and exits with the CORE-computed code, naming any broken dep + its fix-it hint, with NO
// stack trace.
//
// WHY A SPAWN, NOT A UNIT TEST: the dispatch arm lives behind `import.meta.main` in cli.ts — the
// "thin untested shell" by house convention (cli.ts header). Its parse half is unit-tested in
// cli.test.ts (addon-free); its print-and-exit behaviour can only be observed by running the real
// CLI. So this file spawns `bun run src/cli.ts doctor` and asserts the observable contract. The
// composition it exercises (probeDoctor → renderDoctorReport) is already exhaustively unit-tested
// in doctor-probe.test.ts / doctor-core.test.ts — this adds ONLY the wired-CLI dimension.
//
// NON-FLAKY BY DESIGN: case A asserts the INVARIANT (exit 0 ⇔ "doctor: ok"), never a hard green —
// so it holds on a CI box missing `claude`/`lisa` without forcing the host's preflight to pass.
// Case B injects a host-INDEPENDENT fault (`VEND_EXECUTOR=bogus`, which the executor-config check
// reds deterministically regardless of PATH) to prove the failure path's exit code, named-check
// line, fix-it hint, and absence of a stack trace.

/** Absolute path to the CLI entry — this file is src/doctor/, the CLI is src/cli.ts. */
const CLI = join(import.meta.dir, "..", "cli.ts");

/** Spawn `bun run src/cli.ts doctor` with `env`, returning the decoded result as data. */
function runDoctor(env: Record<string, string | undefined>): {
  exitCode: number;
  stdout: string;
  stderr: string;
} {
  const r = Bun.spawnSync(["bun", "run", CLI, "doctor"], { env });
  return { exitCode: r.exitCode, stdout: r.stdout.toString(), stderr: r.stderr.toString() };
}

/** A Node.js stack frame ("\n    at …") — its ABSENCE is the AC's "no stack trace" clause. */
const STACK_FRAME = /\n {4}at /;

describe("vend doctor — guarded-live CLI smoke (T-042-03)", () => {
  test("a wired env prints the report; exit 0 IFF all checks pass", () => {
    const { exitCode, stdout } = runDoctor(process.env);
    // The report always leads with the `doctor:` header, green or red.
    expect(stdout.startsWith("doctor:")).toBe(true);
    // The INVARIANT — never a forced green, so this holds on any host: exit 0 exactly when the
    // report is the all-green one. A host missing a dep takes the other branch and still passes.
    expect(exitCode === 0).toBe(stdout.includes("doctor: ok"));
    // Whichever branch, the verdict carries no stack trace.
    expect(STACK_FRAME.test(stdout)).toBe(false);
  });

  test("an injected fault reds a named check, exits 1, prints a fix-it hint, no stack trace", () => {
    const { exitCode, stdout, stderr } = runDoctor({ ...process.env, VEND_EXECUTOR: "bogus" });
    // A broken dep is a non-zero exit (1, the operational-andon code — not 2, which is usage).
    expect(exitCode).toBe(1);
    // The header NAMES the failure count; the offending line NAMES the check + its fix-it hint.
    expect(stdout).toContain("doctor: FAILED");
    expect(stdout).toContain("✗ active executor config: bogus");
    expect(stdout).toContain("set it to"); // the fix-it hint from executorConfigCheck.
    // NO stack trace anywhere — a broken dep is data, rendered as a clean line, never a crash.
    expect(STACK_FRAME.test(stdout)).toBe(false);
    expect(STACK_FRAME.test(stderr)).toBe(false);
    expect(stderr).not.toContain("Unhandled");
  });
});
