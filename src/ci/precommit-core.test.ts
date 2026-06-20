import { describe, expect, test } from "bun:test";
import { classifyPrecommit, hookInstallState, HOOKS_DIR } from "./precommit-core.ts";

// T-033-01 per-commit green-gate core: the PURE policy. Imports ONLY precommit-core.ts — no spawn,
// no git, no process — so this is an ordinary pure-function test, the same discipline
// committed-core / head-build-core / press-core / decompose-epic-core follow. Fixtures assert exact
// values (cf. press-core asserting real values, never frozen hashes).

describe("classifyPrecommit", () => {
  // ── the three AC fixtures ──────────────────────────────────────────────────────────────────────
  test("AC: green (ran && exit 0) → allow", () => {
    const v = classifyPrecommit({ ran: true, exitCode: 0 });
    expect(v.block).toBe(false);
    expect(v.reason).toBe("green");
    expect(v.message).toContain("green");
  });

  test("AC: tests-failed (ran && exit !== 0) → BLOCK, fail-closed, message NAMES the failure", () => {
    const v = classifyPrecommit({ ran: true, exitCode: 1, stderr: "3 fail, 909 pass" });
    expect(v.block).toBe(true);
    expect(v.reason).toBe("tests-failed");
    // The andon must surface the failure context so the model fixes before committing (E-008 style).
    expect(v.message).toContain("exit 1");
    expect(v.message).toContain("3 fail, 909 pass");
  });

  test("AC: could-not-run (!ran) → allow, fail-open (mirrors on-stop), with a visible note", () => {
    const v = classifyPrecommit({ ran: false, exitCode: null, stderr: "bun: not found" });
    expect(v.block).toBe(false);
    expect(v.reason).toBe("could-not-run");
    expect(v.message).toContain("fail-open");
    expect(v.message).toContain("bun: not found"); // the skip is visible, not silent
  });

  // ── edges ──────────────────────────────────────────────────────────────────────────────────────
  test("any non-zero exit (not just 1) → tests-failed/block", () => {
    const v = classifyPrecommit({ ran: true, exitCode: 2 });
    expect(v.block).toBe(true);
    expect(v.reason).toBe("tests-failed");
    expect(v.message).toContain("exit 2");
  });

  test("!ran with a stray exitCode:0 → still could-not-run (ran is checked first)", () => {
    // Guards the D1 modeling-looseness: exitCode is meaningless when the process never ran.
    const v = classifyPrecommit({ ran: false, exitCode: 0 });
    expect(v.block).toBe(false);
    expect(v.reason).toBe("could-not-run");
  });

  test("could-not-run without stderr → note has no trailing 'undefined'", () => {
    const v = classifyPrecommit({ ran: false, exitCode: null });
    expect(v.reason).toBe("could-not-run");
    expect(v.message).not.toContain("undefined");
  });

  test("tests-failed without stderr → message still names the exit, no 'undefined'", () => {
    const v = classifyPrecommit({ ran: true, exitCode: 1 });
    expect(v.block).toBe(true);
    expect(v.message).toContain("exit 1");
    expect(v.message).not.toContain("undefined");
  });
});

describe("hookInstallState", () => {
  // ── the two AC cases ───────────────────────────────────────────────────────────────────────────
  test("AC: active iff core.hooksPath points at the committed dir", () => {
    const s = hookInstallState(".githooks");
    expect(s.active).toBe(true);
    expect(s.message).toContain(".githooks");
  });

  test("AC: unset (null) → not active, nudges `hooks:install`", () => {
    const s = hookInstallState(null);
    expect(s.active).toBe(false);
    expect(s.message).toContain("hooks:install");
  });

  // ── edges ──────────────────────────────────────────────────────────────────────────────────────
  test("undefined and empty string are treated as unset", () => {
    for (const input of [undefined, ""] as const) {
      const s = hookInstallState(input);
      expect(s.active).toBe(false);
      expect(s.message).toContain("hooks:install");
    }
  });

  test("trailing slash is normalized → still active", () => {
    expect(hookInstallState(".githooks/").active).toBe(true);
  });

  test("an unexpected path → not active, names the value, nudges install", () => {
    const s = hookInstallState(".husky");
    expect(s.active).toBe(false);
    expect(s.message).toContain(".husky");
    expect(s.message).toContain("hooks:install");
  });
});

describe("HOOKS_DIR (R12 shared contract)", () => {
  test("is the exact committed hooks dir", () => {
    expect(HOOKS_DIR).toBe(".githooks");
  });
});
