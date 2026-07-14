// Tests for the one surviving work-core export (see work-core.ts's retirement header — the
// retired renderers' tests were GC'd with them in the 2026-07-13 board-maintenance pass).
import { describe, expect, test } from "bun:test";
import { parseBoardSignals } from "./work-core.ts";

describe("parseBoardSignals", () => {
  test("parses the `## Pull these` chain lines in file order (ranked, IA-1)", () => {
    const md = [
      "# Steer — staged board + forks",
      "",
      "| Signal | Value | Budget | Status |", // table row prose is ignored
      "|---|---|---|---|",
      "## Pull these",
      "```",
      'vend chain "First signal — the highest-leverage why"   # recommended next pull (highest leverage)',
      'vend chain "Second signal — its why"',
      'vend chain "Third signal with `backticks` and \'quotes\' — why"',
      "```",
    ].join("\n");
    expect(parseBoardSignals(md)).toEqual([
      "First signal — the highest-leverage why",
      "Second signal — its why",
      "Third signal with `backticks` and 'quotes' — why",
    ]);
  });

  test("drops the trailing recommended-pull comment but keeps the full quoted signal", () => {
    const md = 'vend chain "Only signal — why"   # recommended next pull (highest leverage)';
    expect(parseBoardSignals(md)).toEqual(["Only signal — why"]);
  });

  test("a board with no chain lines (honest-empty / non-board) → []", () => {
    expect(parseBoardSignals("# Steer — nothing to stage\n\nNothing was promoted.\n")).toEqual([]);
    expect(parseBoardSignals("")).toEqual([]);
  });

  test("ignores lines that merely mention `vend chain` inside prose", () => {
    // Only a line that IS the gesture (starts with `vend chain "`) is a signal.
    const md = "A human pulls with `vend chain` — see below.\n";
    expect(parseBoardSignals(md)).toEqual([]);
  });
});
