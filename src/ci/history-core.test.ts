import { describe, expect, test } from "bun:test";
import {
  type CommitResult,
  DEFAULT_HISTORY_MAX,
  boundRange,
  classifyHistory,
} from "./history-core.ts";

// T-034-01 history-audit core (E-034). Ordinary pure-function tests — the pure half of
// head-build-core.test.ts: no git, no process, no fixtures. Construct input literals, assert exact
// verdict values + report/note substrings. Sub-millisecond. The worktree sweep that fills these rows
// is T-034-02's integration concern, not tested here.

// ── classifyHistory ──────────────────────────────────────────────────────────────────────────────
describe("classifyHistory", () => {
  const green = (sha: string, subject: string): CommitResult => ({ sha, subject, green: true });

  test("all green → anyRed false, redCount 0, tally names the count, lists no commit", () => {
    const v = classifyHistory([green("a1", "first"), green("a2", "second"), green("a3", "third")]);
    expect(v.anyRed).toBe(false);
    expect(v.redCount).toBe(0);
    expect(v.report).toContain("ok — all 3 commit(s) test-green");
    // greens are NOT listed individually
    expect(v.report).not.toContain("a1");
    expect(v.report).not.toContain("ANDON");
  });

  test("some red → anyRed true, redCount correct, report names each red sha+subject+summary", () => {
    const v = classifyHistory([
      green("a1", "ok one"),
      { sha: "b2", subject: "break parser", green: false, summary: "3 failing in parser.test.ts" },
      green("a3", "ok two"),
      { sha: "c3", subject: "break cast", green: false, summary: "1 failing in cast.test.ts" },
      green("a4", "ok three"),
    ]);
    expect(v.anyRed).toBe(true);
    expect(v.redCount).toBe(2);
    expect(v.report).toContain("ANDON — 2 of 5 commit(s) are red");
    // each red commit is named with its subject + failure summary
    expect(v.report).toContain("b2 break parser: 3 failing in parser.test.ts");
    expect(v.report).toContain("c3 break cast: 1 failing in cast.test.ts");
    // greens are not surfaced
    expect(v.report).not.toContain("ok one");
    // tally footer
    expect(v.report).toContain("2 of 5 commit(s) red — audit failed");
  });

  test("red row without summary → still named, no 'undefined' leak", () => {
    const v = classifyHistory([{ sha: "d4", subject: "mystery break", green: false }]);
    expect(v.anyRed).toBe(true);
    expect(v.report).toContain("d4 mystery break");
    expect(v.report).not.toContain("undefined");
    // a bare line with no trailing ": " summary separator
    expect(v.report).not.toContain("mystery break:");
  });

  test("multi-line summary collapses to one report line", () => {
    const v = classifyHistory([
      { sha: "e5", subject: "noisy", green: false, summary: "line one\n  line two\n\tline three" },
    ]);
    expect(v.report).toContain("e5 noisy: line one line two line three");
  });

  test("empty range → honest-empty line, anyRed false (NOT 'all green')", () => {
    const v = classifyHistory([]);
    expect(v.anyRed).toBe(false);
    expect(v.redCount).toBe(0);
    expect(v.report).toContain("no commits in range");
    expect(v.report).not.toContain("green");
    expect(v.report).not.toContain("ANDON");
  });

  test("preserves input order in the red list", () => {
    const v = classifyHistory([
      { sha: "z1", subject: "newest", green: false, summary: "f" },
      { sha: "z2", subject: "older", green: false, summary: "f" },
    ]);
    expect(v.report.indexOf("z1 newest")).toBeLessThan(v.report.indexOf("z2 older"));
  });
});

// ── boundRange ───────────────────────────────────────────────────────────────────────────────────
describe("boundRange", () => {
  const shas = ["s1", "s2", "s3", "s4", "s5"];

  test("under the bound → droppedCount 0, covered === allShas, quiet note, no 'widen'", () => {
    const r = boundRange(shas, { max: 10 });
    expect(r.droppedCount).toBe(0);
    expect(r.covered).toEqual(shas);
    expect(r.note).toContain("covered all 5 commit(s)");
    expect(r.note).not.toContain("widen");
  });

  test("over the bound → loud 'covered N of M (bounded at K)' note, covered is the prefix", () => {
    const r = boundRange(shas, { max: 2 });
    expect(r.covered).toEqual(["s1", "s2"]);
    expect(r.droppedCount).toBe(3);
    expect(r.note).toContain("covered 2 of 5");
    expect(r.note).toContain("bounded at 2");
    expect(r.note).toContain("widen with");
  });

  test("widenHint is interpolated into the note when supplied", () => {
    const r = boundRange(shas, { max: 2, widenHint: "--max 500" });
    expect(r.note).toContain("widen with --max 500");
  });

  test("default bound is DEFAULT_HISTORY_MAX when max omitted", () => {
    expect(DEFAULT_HISTORY_MAX).toBe(100);
    const many = Array.from({ length: 150 }, (_, i) => `c${i}`);
    const r = boundRange(many);
    expect(r.covered).toHaveLength(DEFAULT_HISTORY_MAX);
    expect(r.droppedCount).toBe(50);
    expect(r.note).toContain(`bounded at ${DEFAULT_HISTORY_MAX}`);
  });

  test("max 0 covers nothing; the drop is loud", () => {
    const r = boundRange(shas, { max: 0 });
    expect(r.covered).toEqual([]);
    expect(r.droppedCount).toBe(5);
    expect(r.note).toContain("covered 0 of 5");
  });

  test("negative max clamps to 0 (no throw)", () => {
    const r = boundRange(shas, { max: -5 });
    expect(r.covered).toEqual([]);
    expect(r.droppedCount).toBe(5);
  });

  test("empty input under any bound → droppedCount 0, honest quiet note", () => {
    const r = boundRange([], { max: 2 });
    expect(r.covered).toEqual([]);
    expect(r.droppedCount).toBe(0);
    expect(r.note).toContain("covered all 0 commit(s)");
  });

  test("does not mutate the input array", () => {
    const input = ["a", "b", "c"];
    boundRange(input, { max: 1 });
    expect(input).toEqual(["a", "b", "c"]);
  });
});
