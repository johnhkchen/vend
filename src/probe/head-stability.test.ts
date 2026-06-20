import { describe, expect, test } from "bun:test";
import {
  classifyHeadStability,
  extractTopPicks,
  formatHeadStabilityReport,
  headVerdictsFromExactMatch,
  topPick,
  HEAD_STABILITY_CLASSES,
} from "./head-stability.ts";

// T-023-01 (E-023, the top-pick-stability probe): the PURE core, covered to the branch. The parser
// keys on the `vend chain "…"` block both the survey and steer effects render; the classifier is the
// head-scoped re-map of ./equivalence.ts's tally. No fs / clock / addon / live `claude` cast — an
// ordinary pure-function test, the equivalence.test.ts / consistency.test.ts discipline. The live
// judge cast over the collected heads is the impure harness (./run-equivalence-judge.ts), NOT tested
// here (house rule for impure verbs); only this judgment is.

// ── fixtures: minimal staged boards mimicking renderStagedBoard / renderStagedSteer ───────────────

/** A staged survey board with the given ranked `what — why` heads (top-first), in BOTH the table and
 *  the `## Pull these` block — the shape `extractTopPicks` reads. */
function surveyBoard(heads: readonly string[]): string {
  const rows = heads.map((h) => `| **${h.split(" — ")[0]}** — ${h.split(" — ")[1] ?? ""} | **Keystone** | ~1 block | ready (advances [P1] · grounded in x) |`);
  const pulls = heads.map((h, i) =>
    i === 0 ? `vend chain "${h}"   # recommended next pull (highest leverage)` : `vend chain "${h}"`,
  );
  return [
    "# Survey — staged demand board",
    "",
    "| Signal | Value | Budget (envelope) | Status |",
    "|---|---|---|---|",
    ...rows,
    "",
    "## Pull these",
    "",
    "```",
    ...pulls,
    "```",
    "",
    "_Staged by Vend's `survey` play — not promoted; pull to clear._",
  ].join("\n");
}

/** A staged STEER board — same `vend chain` block, plus a `## Forks` half below (proves the shared
 *  shape: one parser serves both board plays). */
function steerBoard(heads: readonly string[]): string {
  return [
    surveyBoard(heads).replace("# Survey — staged demand board", "# Steer — staged board + forks"),
    "",
    "## Forks",
    "- fork A vs fork B",
  ].join("\n");
}

const EMPTY_SURVEY = "# Survey — no demand staged\n\nan **honest empty board** — nothing staged.";
const EMPTY_STEER = "# Steer — nothing to stage\n\nhonest empty steer.";

// ── the parser (keys the tail-independence proof) ─────────────────────────────────────────────────

describe("extractTopPicks / topPick", () => {
  test("pulls the #1 head and the ranked top-k, top-first", () => {
    const md = surveyBoard(["ship the executor — unblocks runs", "add a TUI — visibility", "docs — polish"]);
    expect(topPick(md)).toBe("ship the executor — unblocks runs");
    expect(extractTopPicks(md, 3)).toEqual([
      "ship the executor — unblocks runs",
      "add a TUI — visibility",
      "docs — polish",
    ]);
  });

  test("tail re-order with a stable #1 ⇒ identical head (AC#1 at the extraction layer)", () => {
    const a = surveyBoard(["ship the executor — unblocks runs", "add a TUI — visibility", "docs — polish"]);
    const b = surveyBoard(["ship the executor — unblocks runs", "docs — polish", "add a TUI — visibility"]);
    expect(topPick(a)).toBe(topPick(b)); // tail re-ordered, #1 unchanged
  });

  test("an empty / abstention board has no head", () => {
    expect(topPick(EMPTY_SURVEY)).toBeNull();
    expect(extractTopPicks(EMPTY_SURVEY, 3)).toEqual([]);
    expect(topPick(EMPTY_STEER)).toBeNull();
  });

  test("a steer board parses identically (shared `vend chain` shape)", () => {
    const md = steerBoard(["converge the head — kills the flip", "tail noise — ignore"]);
    expect(topPick(md)).toBe("converge the head — kills the flip");
    expect(extractTopPicks(md, 2)).toEqual(["converge the head — kills the flip", "tail noise — ignore"]);
  });

  test("k clamps: k<=0 ⇒ [], k beyond length ⇒ all heads", () => {
    const md = surveyBoard(["a — 1", "b — 2"]);
    expect(extractTopPicks(md, 0)).toEqual([]);
    expect(extractTopPicks(md, -1)).toEqual([]);
    expect(extractTopPicks(md, 9)).toEqual(["a — 1", "b — 2"]);
  });
});

// ── the classifier: the AC#1 fixtures (end-to-end pure path: boards → heads → verdicts → class) ────

/** Extract each board's #1, build exact-match verdicts, classify — the deterministic pure pipeline. */
function classifyBoards(boards: readonly string[]) {
  const heads = boards.map(topPick).filter((h): h is string => h !== null);
  return classifyHeadStability(headVerdictsFromExactMatch(heads), heads.length);
}

describe("classifyHeadStability — the AC#1 fixtures", () => {
  test("all-same-#1 ⇒ head-stable, score 1", () => {
    const r = classifyBoards([
      surveyBoard(["ship the executor — unblocks runs", "x — 1"]),
      surveyBoard(["ship the executor — unblocks runs", "y — 2"]),
      surveyBoard(["ship the executor — unblocks runs", "z — 3"]),
    ]);
    expect(r.classification).toBe("head-stable");
    expect(r.score).toBe(1);
    expect(r.totalPairs).toBe(3);
    expect(r.stablePairs).toBe(3);
    expect(r.flippedPairs).toBe(0);
  });

  test("all-different-#1 ⇒ head-flips, score 0", () => {
    const r = classifyBoards([
      surveyBoard(["ship the executor — a"]),
      surveyBoard(["add a TUI — b"]),
      surveyBoard(["write docs — c"]),
    ]);
    expect(r.classification).toBe("head-flips");
    expect(r.score).toBe(0);
    expect(r.flippedPairs).toBe(3);
  });

  test("a mix ⇒ mixed, 0 < score < 1", () => {
    const r = classifyBoards([
      surveyBoard(["ship the executor — a"]),
      surveyBoard(["ship the executor — a"]),
      surveyBoard(["add a TUI — b"]),
    ]);
    expect(r.classification).toBe("mixed");
    expect(r.stablePairs).toBe(1); // (0,1) same
    expect(r.flippedPairs).toBe(2); // (0,2),(1,2) differ
    expect(r.score).toBeCloseTo(1 / 3, 10);
  });

  test("tail re-order with a stable #1 ⇒ head-stable (whole-board fixture, end-to-end)", () => {
    const r = classifyBoards([
      surveyBoard(["ship the executor — a", "tui — b", "docs — c"]),
      surveyBoard(["ship the executor — a", "docs — c", "tui — b"]), // tail re-ordered
      surveyBoard(["ship the executor — a", "tui — b", "docs — c"]),
    ]);
    expect(r.classification).toBe("head-stable");
    expect(r.score).toBe(1);
  });

  test("normalization: whitespace / case differences are the same head", () => {
    const r = classifyHeadStability(
      headVerdictsFromExactMatch(["Ship The Executor — A", "ship the   executor — a"]),
      2,
    );
    expect(r.classification).toBe("head-stable");
  });
});

// ── honesty edges (IA-8) — inherited from the delegated equivalence tally ─────────────────────────

describe("classifyHeadStability — honesty edges (IA-8)", () => {
  test("fewer than 2 boards ⇒ vacuous head-stable, 0 pairs, score 1 (never NaN)", () => {
    const r = classifyHeadStability([], 1);
    expect(r.classification).toBe("head-stable");
    expect(r.totalPairs).toBe(0);
    expect(r.score).toBe(1);
    expect(Number.isNaN(r.score)).toBe(false);
  });

  test("zero boards ⇒ same vacuous read, no divide-by-zero", () => {
    const r = classifyHeadStability([], 0);
    expect(r.totalPairs).toBe(0);
    expect(r.score).toBe(1);
  });

  test("all-stable verdicts SHORT of full coverage ⇒ mixed (missing evidence is not stability)", () => {
    // 3 boards ⇒ 3 expected head-pairs, but the judge only returned 2 (both stable).
    const r = classifyHeadStability([{ i: 0, j: 1, equivalent: true }, { i: 0, j: 2, equivalent: true }], 3);
    expect(r.totalPairs).toBe(3);
    expect(r.verdictsSeen).toBe(2);
    expect(r.stablePairs).toBe(2);
    expect(r.classification).toBe("mixed");
    expect(r.score).toBeCloseTo(2 / 3, 10); // denominator is expected pairs, not verdicts seen
  });
});

// ── the formatter ─────────────────────────────────────────────────────────────────────────────────

describe("formatHeadStabilityReport", () => {
  test("clean line: class + score + head-pair tally, no ⚠", () => {
    const line = formatHeadStabilityReport(
      classifyHeadStability(headVerdictsFromExactMatch(["a — 1", "a — 1", "a — 1"]), 3),
    );
    expect(line).toContain("top-pick stability: head-stable (score 1.00)");
    expect(line).toContain("3 stable · 0 flipped of 3 head-pairs over 3 boards");
    expect(line).not.toContain("⚠");
  });

  test("head-flips line reads its class + score 0.00", () => {
    const line = formatHeadStabilityReport(
      classifyHeadStability(headVerdictsFromExactMatch(["a — 1", "b — 2", "c — 3"]), 3),
    );
    expect(line).toContain("top-pick stability: head-flips (score 0.00)");
  });

  test("vacuous caveat when fewer than 2 boards", () => {
    const line = formatHeadStabilityReport(classifyHeadStability([], 1));
    expect(line).toContain("⚠ fewer than 2 boards — classification vacuous");
  });

  test("under-coverage caveat when the judge returned fewer verdicts than expected head-pairs", () => {
    const line = formatHeadStabilityReport(
      classifyHeadStability([{ i: 0, j: 1, equivalent: true }, { i: 0, j: 2, equivalent: true }], 3),
    );
    expect(line).toContain("⚠ judge returned 2 of 3 head-pair verdicts");
  });
});

describe("HEAD_STABILITY_CLASSES", () => {
  test("is the closed set the classification only ever draws from", () => {
    expect(HEAD_STABILITY_CLASSES).toEqual(["head-stable", "head-flips", "mixed"]);
    for (const heads of [["a — 1", "a — 1"], ["a — 1", "b — 2"]]) {
      const r = classifyHeadStability(headVerdictsFromExactMatch(heads), heads.length);
      expect(HEAD_STABILITY_CLASSES).toContain(r.classification);
    }
  });
});
