import { describe, expect, test } from "bun:test";
import { castPreflight } from "./preflight.ts";
import {
  EXIT_FAILED,
  EXIT_OK,
} from "./doctor-core.ts";
import { LISA_CHECK, LISA_HINT } from "./doctor-probe.ts";

// T-042-04: the cast PRECONDITION GUARD. `castPreflight` reuses the doctor check (probe → render)
// as the gate at the door of a cast (`castWork`), mirroring lisa's check_required_deps-before-
// run_loop. The world-facts (onPath / bamlLoadable / env) are INJECTED — the doctor-probe.test.ts
// discipline — so the refuse-or-proceed contract is exercised DETERMINISTICALLY with fabricated
// facts, no dependence on the host. The guard IS the precondition (`castWork` is BAML-bound and so
// is not value-importable by `bun test`, the house rule); proving the guard proves the precondition.
//
// The AC, clause by clause:
//   (1) a broken dep refuses — same NAMED-CHECK + HINT surface, NON-ZERO outcome (no metered run);
//   (2) a wired env PROCEEDS unchanged (the gate is transparent, exit 0);
//   + the gate NEVER throws (it can't crash the cast it guards), and the REAL defaults compose live.

/** All binaries present on PATH. */
const allOnPath = async () => true;
/** A PATH where only the names in `present` resolve — for the single-missing-binary case. */
function onPathFor(present: readonly string[]): (binary: string) => Promise<boolean> {
  const set = new Set(present);
  return async (binary: string) => set.has(binary);
}
const yes = async () => true;
/** A shallow executor probe fact; keeps deterministic preflight cases off the host's auth state. */
const probeOk = async () => ({ ok: true } as const);

describe("castPreflight — AC (1): a broken dep refuses the cast at the door", () => {
  test("lisa off PATH ⇒ not ok, exit 1, the report names the check + its fix-it hint", async () => {
    // claude present but lisa missing; addon + executor-config wired ⇒ exactly one red check.
    const report = await castPreflight({
      onPath: onPathFor(["claude"]),
      bamlLoadable: yes,
      executorProbe: probeOk,
      env: {},
    });

    // a NON-ZERO outcome — the refusal the CLI exits with (no budget spent, no metered run).
    expect(report.ok).toBe(false);
    expect(report.exitCode).toBe(EXIT_FAILED);

    // the SAME named-check + hint refusal `vend doctor` would emit — the report IS the surface.
    expect(report.report).toContain("doctor: FAILED");
    expect(report.report).toContain(LISA_CHECK);
    expect(report.report).toContain(LISA_HINT);
  });
});

describe("castPreflight — AC (2): a wired env proceeds unchanged", () => {
  test("every dep green ⇒ ok, exit 0 (the gate is transparent, the cast proceeds)", async () => {
    // env: {} ⇒ executor resolves to the default ("claude") which needs no config ⇒ green.
    const report = await castPreflight({
      onPath: allOnPath,
      bamlLoadable: yes,
      executorProbe: probeOk,
      env: {},
    });

    expect(report.ok).toBe(true);
    expect(report.exitCode).toBe(EXIT_OK);
    expect(report.report).toContain("doctor: ok");
  });
});

describe("castPreflight — never throws (a backend fault degrades to a red report, not a raise)", () => {
  test("a throwing onPath backend ⇒ resolves to a red report, never rejects", async () => {
    const boom = async (): Promise<boolean> => {
      throw new Error("which exploded");
    };
    // The guard must RESOLVE (a red DoctorReport), not reject — it cannot crash the cast it guards.
    const report = await castPreflight({
      onPath: boom,
      bamlLoadable: yes,
      executorProbe: probeOk,
      env: {},
    });
    expect(report.ok).toBe(false);
    expect(report.exitCode).toBe(EXIT_FAILED);
    // the thrown message survives into the report (probeDoctor's safeCheck → failed(name, message)).
    expect(report.report).toContain("which exploded");
  });
});

describe("castPreflight — guarded-live smoke (the REAL probe→render composes without throwing)", () => {
  test("real castPreflight() resolves to a well-formed DoctorReport (shape, not host-specific verdict)", async () => {
    const report = await castPreflight(); // real envinfo which, real addon import, real process.env

    expect(typeof report.ok).toBe("boolean");
    expect(typeof report.exitCode).toBe("number");
    expect(typeof report.report).toBe("string");
    expect(report.report.length).toBeGreaterThan(0);
    // exitCode is derived from ok — never desynced.
    expect(report.exitCode).toBe(report.ok ? EXIT_OK : EXIT_FAILED);
  });
});
