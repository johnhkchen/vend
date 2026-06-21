import { describe, expect, test } from "bun:test";
import {
  type Check,
  EXIT_FAILED,
  EXIT_OK,
  failed,
  passed,
  renderDoctorReport,
} from "./doctor-core.ts";

// T-042-01 doctor check/report model: the PURE preflight verdict. Imports ONLY doctor-core.ts
// — no envinfo, no fs, no child_process, no process — so this is an ordinary pure-function
// test, the same discipline precommit-core / history-core / init-core follow. Fixtures assert
// exact/contained values (cf. precommit-core asserting real values).

// The ~3 vend-specific deps the T-042-02 probe will eventually check — used here only as
// realistic fixture names so the AC assertions read like the real preflight.
const LISA = passed("lisa on PATH");
const CLAUDE = passed("claude on PATH");
const BAML = passed("BAML native addon loadable");

describe("renderDoctorReport", () => {
  // ── the AC fixtures ────────────────────────────────────────────────────────────────────────
  test("AC: all-green set renders each dep green and yields exit code 0", () => {
    const r = renderDoctorReport([LISA, CLAUDE, BAML]);
    expect(r.ok).toBe(true);
    expect(r.exitCode).toBe(EXIT_OK);
    expect(r.exitCode).toBe(0);
    // renders EACH dep green (D2 — doctor is a checklist, not offenders-only).
    expect(r.report).toContain("lisa on PATH");
    expect(r.report).toContain("claude on PATH");
    expect(r.report).toContain("BAML native addon loadable");
    expect(r.report).toContain("✓");
    expect(r.report).not.toContain("✗"); // nothing failed
    expect(r.report).toContain("3 check(s) passed");
  });

  test("AC: any single failing check renders its NAME + fix-it HINT and yields a non-zero code", () => {
    const hint = "install Claude Code and put `claude` on your PATH";
    const r = renderDoctorReport([LISA, failed("claude on PATH", hint), BAML]);
    expect(r.ok).toBe(false);
    expect(r.exitCode).toBe(EXIT_FAILED);
    expect(r.exitCode).not.toBe(0); // non-zero
    // the failing check is NAMED, with its actionable hint (E-008 "name the fix").
    expect(r.report).toContain("claude on PATH");
    expect(r.report).toContain(hint);
    expect(r.report).toContain("✗");
    expect(r.report).toContain("1 of 3 check(s) failed");
    // the greens are still listed (positive confirmation).
    expect(r.report).toContain("lisa on PATH");
    expect(r.report).toContain("BAML native addon loadable");
  });

  test("AC: pure — no probing/IO; repeated calls are deterministic and identical", () => {
    // Structural purity: the module imports nothing impure (the import block above is the
    // proof), and the function is a plain map over its input — same input, byte-identical output.
    const input = [LISA, failed("claude on PATH", "fix me")];
    const a = renderDoctorReport(input);
    const b = renderDoctorReport(input);
    expect(a).toEqual(b);
    expect(a.report).toBe(b.report);
  });

  // ── edges ──────────────────────────────────────────────────────────────────────────────────
  test("empty set → honest 'no checks to run', ok/exit 0, never a misleading 'green'", () => {
    const r = renderDoctorReport([]);
    expect(r.ok).toBe(true);
    expect(r.exitCode).toBe(EXIT_OK);
    expect(r.report).toContain("no checks to run");
    expect(r.report).not.toContain("✓");
    expect(r.report).not.toContain("passed");
  });

  test("multiple failures → header tallies K of N", () => {
    const r = renderDoctorReport([failed("a", "fix a"), CLAUDE, failed("b", "fix b")]);
    expect(r.ok).toBe(false);
    expect(r.exitCode).toBe(EXIT_FAILED);
    expect(r.report).toContain("2 of 3 check(s) failed");
    expect(r.report).toContain("fix a");
    expect(r.report).toContain("fix b");
  });

  test("a multi-line hint is collapsed to one line in the report", () => {
    const r = renderDoctorReport([failed("baml", "line one\n  line two\tline three")]);
    expect(r.report).toContain("line one line two line three");
    expect(r.report).not.toContain("\n  line two");
  });

  test("a failing check is rendered in INPUT ORDER among the greens", () => {
    const r = renderDoctorReport([LISA, failed("claude on PATH", "fix"), BAML]);
    const lines = r.report.split("\n");
    // header, then lisa(✓), claude(✗), baml(✓)
    expect(lines[1]).toContain("lisa on PATH");
    expect(lines[2]).toContain("claude on PATH");
    expect(lines[2]).toContain("✗");
    expect(lines[3]).toContain("BAML native addon loadable");
  });

  test("a hintless failure (probe-bug robustness) renders a bare ✗ line, no 'undefined'", () => {
    // Not constructable via `failed` (which requires a hint), but the renderer must not crash
    // or print 'undefined' on a malformed Check — returned-data-never-thrown.
    const malformed: Check = { name: "weird", ok: false };
    const r = renderDoctorReport([malformed]);
    expect(r.ok).toBe(false);
    expect(r.report).toContain("✗ weird");
    expect(r.report).not.toContain("undefined");
  });

  test("ok and exitCode never desync — derived from the same fail count", () => {
    for (const checks of [[LISA], [failed("x", "y")], [LISA, failed("x", "y")], []]) {
      const r = renderDoctorReport(checks);
      expect(r.exitCode).toBe(r.ok ? EXIT_OK : EXIT_FAILED);
    }
  });
});

describe("passed / failed constructors", () => {
  test("passed → green check, no hint", () => {
    const c = passed("lisa on PATH");
    expect(c).toEqual({ name: "lisa on PATH", ok: true });
    expect(c.hint).toBeUndefined();
  });

  test("failed → red check carrying its required hint", () => {
    const c = failed("claude on PATH", "install Claude Code");
    expect(c.ok).toBe(false);
    expect(c.name).toBe("claude on PATH");
    expect(c.hint).toBe("install Claude Code");
  });

  test("a failed() check flows through the renderer as a red line + hint", () => {
    const r = renderDoctorReport([failed("baml", "rebuild the addon")]);
    expect(r.ok).toBe(false);
    expect(r.report).toContain("✗ baml");
    expect(r.report).toContain("rebuild the addon");
  });
});

describe("exit-code constants (R12 shared contract)", () => {
  test("EXIT_OK is 0 and EXIT_FAILED is a distinct non-zero code", () => {
    expect(EXIT_OK).toBe(0);
    expect(EXIT_FAILED).not.toBe(0);
    expect(EXIT_FAILED).not.toBe(EXIT_OK);
  });
});
