import { describe, expect, test } from "bun:test";
import { classifyPorcelain, parsePorcelainLine, SOURCE_PREFIXES } from "./committed-core.ts";

// T-008-01 check:committed core: the PURE classifier. Imports ONLY committed-core.ts — no git,
// no process, no BAML addon — so this is an ordinary pure-function test, the same discipline
// press-core / gates / decompose-epic-core follow. Fixtures assert exact SORTED arrays (cf.
// press-core asserting real values, never frozen hashes).

describe("parsePorcelainLine", () => {
  test("blank / too-short line → null", () => {
    expect(parsePorcelainLine("")).toBeNull();
    expect(parsePorcelainLine("  ")).toBeNull();
    expect(parsePorcelainLine("M")).toBeNull();
  });
  test("modified line → path field (index 3 onward)", () => {
    expect(parsePorcelainLine(" M src/cli.ts")).toBe("src/cli.ts");
  });
  test("staged line → path field", () => {
    expect(parsePorcelainLine("A  src/ci/check-committed.ts")).toBe("src/ci/check-committed.ts");
  });
  test("rename line → DESTINATION", () => {
    expect(parsePorcelainLine("R  src/a.ts -> src/b.ts")).toBe("src/b.ts");
  });
  test("quoted path → quotes stripped", () => {
    expect(parsePorcelainLine('?? "src/wéird.ts"')).toBe("src/wéird.ts");
  });
});

describe("classifyPorcelain", () => {
  // ── the three AC fixtures ──────────────────────────────────────────────────────────────────
  test("AC: dirty source → fail-list (sorted)", () => {
    const porcelain = " M src/cli.ts\nM  baml_src/note.baml\n";
    expect(classifyPorcelain(porcelain)).toEqual(["baml_src/note.baml", "src/cli.ts"]);
  });
  test("AC: clean → empty", () => {
    expect(classifyPorcelain("")).toEqual([]);
    expect(classifyPorcelain("\n  \n")).toEqual([]);
  });
  test("AC: untracked src/*.ts → flagged", () => {
    expect(classifyPorcelain("?? src/ci/new.ts\n")).toEqual(["src/ci/new.ts"]);
  });

  // ── scope edges ──────────────────────────────────────────────────────────────────────────────
  test("non-source (root config + docs) → empty (scope is src/, baml_src/, ci/ only)", () => {
    expect(classifyPorcelain(" M docs/active/tickets/T-008-01.md\n M package.json\n")).toEqual([]);
  });
  test("ci/ source is in scope", () => {
    expect(classifyPorcelain(" M ci/src/index.ts\n")).toEqual(["ci/src/index.ts"]);
  });
  test(".lisa/hooks/ source is in scope (the gate's own trigger is policed — T-012-01)", () => {
    // A dirty/untracked hook script must ANDON: the scripts that fire the gate are not self-exempt.
    expect(classifyPorcelain("?? .lisa/hooks/on-stop.sh\n")).toEqual([".lisa/hooks/on-stop.sh"]);
  });
  test("non-hook .lisa/ paths stay out of scope (signals/layout are legit gitignored runtime)", () => {
    // Scope is `.lisa/hooks/` ONLY — broadening to `.lisa/` would flag legitimately-uncommitted state.
    expect(classifyPorcelain(" M .lisa/signals/x.json\n M .lisa-layout.kdl\n")).toEqual([]);
  });
  test("gitignored runtime never appears in porcelain → empty (belt: even if it did, not source-prefixed)", () => {
    // git omits ignored paths from --porcelain (no --ignored); this just documents the intent.
    expect(classifyPorcelain(" M node_modules/x.js\n M baml_client/index.ts\n")).toEqual([]);
  });

  // ── parsing behaviour folded into classification ─────────────────────────────────────────────
  test("staged-but-uncommitted source counts (index ≠ HEAD)", () => {
    expect(classifyPorcelain("A  src/ci/check-committed.ts\n")).toEqual(["src/ci/check-committed.ts"]);
  });
  test("rename → destination flagged, not origin pair", () => {
    expect(classifyPorcelain("R  src/a.ts -> src/b.ts\n")).toEqual(["src/b.ts"]);
  });
  test("dedup + sort: repeated and out-of-order paths", () => {
    const porcelain = " M src/z.ts\n M src/a.ts\n M src/z.ts\n";
    expect(classifyPorcelain(porcelain)).toEqual(["src/a.ts", "src/z.ts"]);
  });
  test("mixed source + non-source → only source survives", () => {
    const porcelain = " M src/cli.ts\n M README.md\n?? baml_src/new.baml\n M .vend/menu.json\n";
    expect(classifyPorcelain(porcelain)).toEqual(["baml_src/new.baml", "src/cli.ts"]);
  });
});

describe("SOURCE_PREFIXES (R12 shared contract)", () => {
  test("is the exact scoped set", () => {
    expect(SOURCE_PREFIXES).toEqual(["src/", "baml_src/", "ci/", ".lisa/hooks/"]);
  });
});
