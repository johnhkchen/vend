import { describe, expect, test } from "bun:test";
import type { Check } from "./doctor-core.ts";
import {
  BAML_CHECK,
  BAML_HINT,
  bamlCheck,
  CLAUDE_CHECK,
  CLAUDE_HINT,
  claudeCheck,
  EXECUTOR_CHECK,
  executorConfigCheck,
  LISA_CHECK,
  LISA_HINT,
  lisaCheck,
  probeDoctor,
} from "./doctor-probe.ts";
import {
  DEFAULT_OPENAI_BASE_URL,
  OPENAI_BASE_URL_ENV,
  OPENAI_EXECUTOR_ID,
} from "../executor/openai-compat.ts";
import { EXECUTOR_ENV } from "../executor/select.ts";

// T-042-02: the IMPURE doctor probe. The world-facts (onPath / bamlLoadable / env) are INJECTED,
// so the entire AC failure matrix is exercised DETERMINISTICALLY with fabricated facts — no
// dependence on the host's actual PATH or addon (the `planInit(existing, manifest)` discipline).
// A final guarded-live block proves the REAL defaults compose without throwing. The AC, clause
// by clause:
//   (1) all-ok in a wired env → every Check green;
//   (2) lisa off PATH → the lisa Check is failed w/ its hint, the probe RETURNS (does not raise);
//   (3) BAML addon unloadable → the BAML Check is failed w/ its hint, the probe returns a result;
//   (4) open-model endpoint var unset → the executor Check is failed naming the env var;
//   + the probe NEVER throws (a throwing backend degrades to a red Check).

/** All binaries present. */
const allOnPath = async () => true;
/** A PATH where only the names in `set` resolve — for the single-missing-binary cases. */
function onPathFor(present: readonly string[]): (binary: string) => Promise<boolean> {
  const set = new Set(present);
  return async (binary: string) => set.has(binary);
}
const yes = async () => true;
const no = async () => false;

/** Look one named check out of the returned set. */
function byName(checks: readonly Check[], name: string): Check | undefined {
  return checks.find((c) => c.name === name || c.name.startsWith(`${name}:`));
}

describe("probeDoctor — AC (1): all-ok in a wired env", () => {
  test("every dependency check is green; all four checks are present; no hints", async () => {
    const checks = await probeDoctor({ onPath: allOnPath, bamlLoadable: yes, env: {} });

    expect(checks.length).toBe(4);
    expect(checks.every((c) => c.ok)).toBe(true);
    expect(checks.every((c) => c.hint === undefined)).toBe(true);

    // each named dep is in the set (order: lisa, claude, BAML, executor-config).
    expect(checks[0]?.name).toBe(LISA_CHECK);
    expect(checks[1]?.name).toBe(CLAUDE_CHECK);
    expect(checks[2]?.name).toBe(BAML_CHECK);
    expect(checks[3]?.name.startsWith(EXECUTOR_CHECK)).toBe(true);
    // empty env ⇒ default executor is claude, which needs no config.
    expect(checks[3]?.name).toContain("claude");
  });
});

describe("probeDoctor — AC (2): lisa off PATH", () => {
  test("the lisa check fails with its hint; the probe RETURNS four checks (did not raise)", async () => {
    const checks = await probeDoctor({
      onPath: onPathFor(["claude"]), // lisa missing, claude present
      bamlLoadable: yes,
      env: {},
    });

    expect(checks.length).toBe(4); // returned a result, not a raise
    const lisa = byName(checks, LISA_CHECK);
    expect(lisa?.ok).toBe(false);
    expect(lisa?.hint).toBe(LISA_HINT);

    // the failure is ISOLATED — the other deps stayed green.
    expect(byName(checks, CLAUDE_CHECK)?.ok).toBe(true);
    expect(byName(checks, BAML_CHECK)?.ok).toBe(true);
    expect(byName(checks, EXECUTOR_CHECK)?.ok).toBe(true);
  });
});

describe("probeDoctor — AC (3): BAML native addon unloadable", () => {
  test("the BAML check fails with its hint; the probe returns a result", async () => {
    const checks = await probeDoctor({ onPath: allOnPath, bamlLoadable: no, env: {} });

    expect(checks.length).toBe(4);
    const baml = byName(checks, BAML_CHECK);
    expect(baml?.ok).toBe(false);
    expect(baml?.hint).toBe(BAML_HINT);
    // isolated: PATH + executor deps stayed green.
    expect(byName(checks, LISA_CHECK)?.ok).toBe(true);
    expect(byName(checks, CLAUDE_CHECK)?.ok).toBe(true);
    expect(byName(checks, EXECUTOR_CHECK)?.ok).toBe(true);
  });
});

describe("probeDoctor — AC (4): open-model endpoint var unset", () => {
  test("openai-compat selected but no base URL ⇒ executor check fails naming the var; probe returns", async () => {
    const checks = await probeDoctor({
      onPath: allOnPath,
      bamlLoadable: yes,
      env: { [EXECUTOR_ENV]: OPENAI_EXECUTOR_ID }, // selected, but VEND_OPENAI_BASE_URL unset
    });

    expect(checks.length).toBe(4);
    const exec = byName(checks, EXECUTOR_CHECK);
    expect(exec?.ok).toBe(false);
    expect(exec?.name).toContain(OPENAI_EXECUTOR_ID);
    expect(exec?.hint).toContain(OPENAI_BASE_URL_ENV);
    // isolated.
    expect(byName(checks, LISA_CHECK)?.ok).toBe(true);
    expect(byName(checks, BAML_CHECK)?.ok).toBe(true);
  });
});

describe("executorConfigCheck — the basic presence matrix (scope-guarded, D4)", () => {
  test("default/empty env ⇒ claude, green (needs no config)", () => {
    const c = executorConfigCheck({});
    expect(c.ok).toBe(true);
    expect(c.name).toContain("claude");
    expect(c.hint).toBeUndefined();
  });

  test("openai-compat WITH base URL set ⇒ green", () => {
    const c = executorConfigCheck({
      [EXECUTOR_ENV]: OPENAI_EXECUTOR_ID,
      [OPENAI_BASE_URL_ENV]: DEFAULT_OPENAI_BASE_URL,
    });
    expect(c.ok).toBe(true);
    expect(c.name).toContain(OPENAI_EXECUTOR_ID);
  });

  test("openai-compat WITHOUT base URL ⇒ red, hint names the endpoint var", () => {
    const c = executorConfigCheck({ [EXECUTOR_ENV]: OPENAI_EXECUTOR_ID });
    expect(c.ok).toBe(false);
    expect(c.hint).toContain(OPENAI_BASE_URL_ENV);
  });

  test("an unknown executor id ⇒ red, hint names the valid options", () => {
    const c = executorConfigCheck({ [EXECUTOR_ENV]: "bogus-executor" });
    expect(c.ok).toBe(false);
    expect(c.name).toContain("bogus-executor");
    expect(c.hint).toContain(OPENAI_EXECUTOR_ID);
  });
});

describe("the individual binary check verbs (injected fact → Check)", () => {
  test("lisaCheck: present → green / absent → red w/ hint", async () => {
    expect(await lisaCheck(yes)).toEqual({ name: LISA_CHECK, ok: true });
    expect(await lisaCheck(no)).toEqual({ name: LISA_CHECK, ok: false, hint: LISA_HINT });
  });
  test("claudeCheck: present → green / absent → red w/ hint", async () => {
    expect(await claudeCheck(yes)).toEqual({ name: CLAUDE_CHECK, ok: true });
    expect(await claudeCheck(no)).toEqual({ name: CLAUDE_CHECK, ok: false, hint: CLAUDE_HINT });
  });
  test("bamlCheck: loadable → green / unloadable → red w/ hint", async () => {
    expect(await bamlCheck(yes)).toEqual({ name: BAML_CHECK, ok: true });
    expect(await bamlCheck(no)).toEqual({ name: BAML_CHECK, ok: false, hint: BAML_HINT });
  });
});

describe("probeDoctor — NEVER THROWS (returned data, not a raise)", () => {
  test("a throwing onPath backend degrades to red Checks; the probe still resolves to four", async () => {
    const boom = async (): Promise<boolean> => {
      throw new Error("which exploded");
    };
    const checks = await probeDoctor({ onPath: boom, bamlLoadable: yes, env: {} });

    expect(checks.length).toBe(4); // resolved, did not reject
    const lisa = byName(checks, LISA_CHECK);
    expect(lisa?.ok).toBe(false);
    expect(lisa?.hint).toContain("which exploded"); // the error message became the hint
    // the non-PATH deps were unaffected.
    expect(byName(checks, BAML_CHECK)?.ok).toBe(true);
    expect(byName(checks, EXECUTOR_CHECK)?.ok).toBe(true);
  });

  test("a throwing bamlLoadable backend degrades to a red BAML check, not a raise", async () => {
    const boom = async (): Promise<boolean> => {
      throw new Error("addon blew up");
    };
    const checks = await probeDoctor({ onPath: allOnPath, bamlLoadable: boom, env: {} });
    expect(checks.length).toBe(4);
    const baml = byName(checks, BAML_CHECK);
    expect(baml?.ok).toBe(false);
    expect(baml?.hint).toContain("addon blew up");
  });
});

describe("probeDoctor — guarded-live smoke (the REAL defaults compose without throwing)", () => {
  test("real probeDoctor() resolves to four well-formed checks (shape, not host-specific verdict)", async () => {
    const checks = await probeDoctor(); // real envinfo which, real addon import, real process.env

    expect(checks.length).toBe(4);
    for (const c of checks) {
      expect(typeof c.name).toBe("string");
      expect(c.name.length).toBeGreaterThan(0);
      expect(typeof c.ok).toBe("boolean");
      // a red check ALWAYS carries a hint; a green one never does (the failed/passed contract).
      if (!c.ok) expect(typeof c.hint).toBe("string");
      else expect(c.hint).toBeUndefined();
    }
    // the four expected deps are all represented.
    expect(byName(checks, LISA_CHECK)).toBeDefined();
    expect(byName(checks, CLAUDE_CHECK)).toBeDefined();
    expect(byName(checks, BAML_CHECK)).toBeDefined();
    expect(byName(checks, EXECUTOR_CHECK)).toBeDefined();
  });
});
