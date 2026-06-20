import { describe, expect, test } from "bun:test";
import { parseBoardSignals, labelForSignal, formatStepSignal, renderReceipt, isBoardStale, renderStaleBoard } from "./work-core.ts";
import type { SessionResult, StepSignal } from "../engine/spend-core.ts";
import type { Budget } from "../budget/budget.ts";

// T-024-03 work-core: the PURE board-parse + render half of the `vend work` gesture. No addon, no
// fs, no spawn — work.ts (the impure shell that casts the chain) is proven live (AC#3), this tests
// the load-bearing branching: parsing the ranked board and rendering the IA-7 line + IA-6 receipt.

const FUNDED: Budget = { timeMs: 600_000, tokens: 120_000 };

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

describe("labelForSignal", () => {
  test("takes the `what` half before the first ` — `", () => {
    expect(labelForSignal("Build the macro-wallet — the founding gesture")).toBe("Build the macro-wallet");
  });
  test("a signal with no ` — ` separator uses the whole string", () => {
    expect(labelForSignal("Just a what")).toBe("Just a what");
  });
  test("truncates an over-long what with an ellipsis", () => {
    const label = labelForSignal(`${"x".repeat(200)} — why`, 20);
    expect(label.length).toBe(20);
    expect(label.endsWith("…")).toBe(true);
  });
});

describe("formatStepSignal", () => {
  test("start line: ▶ arrow, label, and the two-denomination meter (IA-7/8)", () => {
    const s: StepSignal = { phase: "start", candidate: "Build the macro-wallet", remaining: { timeMs: 540_000, tokens: 100_000 } };
    const line = formatStepSignal(s, FUNDED);
    expect(line).toContain("▶ casting");
    expect(line).toContain("Build the macro-wallet");
    expect(line).toContain("◇"); // tokens denomination
    expect(line).toContain("⏱"); // wall-clock denomination
    expect(line).toContain("left");
  });
  test("done line uses the ✓ arrow", () => {
    const s: StepSignal = { phase: "done", candidate: "x", remaining: FUNDED };
    expect(formatStepSignal(s, FUNDED)).toContain("✓ done");
  });
});

function session(stop: SessionResult["stop"], steps: SessionResult["steps"], remaining: Budget): SessionResult {
  return { steps, stop, stopDetail: `${remaining.tokens} tokens / ${remaining.timeMs} ms left`, remaining, cleared: steps.filter((s) => s.outcome === "success").length };
}

describe("renderReceipt", () => {
  const cleared = { candidate: "First pull", outcome: "success" as const, cost: { timeMs: 60_000, tokens: 20_000 }, overshoot: { timeMs: 0, tokens: 0 }, remainingAfter: { timeMs: 540_000, tokens: 100_000 } };
  const andonStep = { candidate: "Second pull", outcome: "gate-failed" as const, cost: { timeMs: 30_000, tokens: 10_000 }, overshoot: { timeMs: 0, tokens: 0 }, remainingAfter: { timeMs: 510_000, tokens: 90_000 } };

  test("board-cleared: cleared count, per-cast cost, wallet meter, plain stop line", () => {
    const r = session("board-cleared", [cleared], { timeMs: 540_000, tokens: 100_000 });
    const out = renderReceipt(r, { funded: FUNDED, remaining: r.remaining });
    expect(out).toContain("cleared 1");
    expect(out).toContain("✓ First pull");
    expect(out).toContain("◇ 20k"); // the cost line, two denominations
    expect(out).toContain("wallet:");
    expect(out).toContain("board cleared");
    expect(out).not.toContain("\x1b["); // no color when color is off
  });

  test("wallet-exhausted renders a plain (non-amber) stop", () => {
    const r = session("wallet-exhausted", [cleared], { timeMs: 5_000, tokens: 100 });
    const out = renderReceipt(r, { funded: FUNDED, remaining: r.remaining }, { color: true });
    expect(out).toContain("wallet exhausted");
    expect(out).not.toContain("\x1b[33m"); // a clean stop is not a refusal — no amber
  });

  test("andon renders amber (IA-9), never red, when color is on", () => {
    const r = session("andon", [cleared, andonStep], { timeMs: 510_000, tokens: 90_000 });
    const out = renderReceipt(r, { funded: FUNDED, remaining: r.remaining }, { color: true });
    expect(out).toContain("\x1b[33m"); // amber
    expect(out).not.toContain("\x1b[31m"); // never red
    expect(out).toContain("andon: gate-failed");
    expect(out).toContain("⚠ Second pull");
  });

  test("andon stop with color off shows the plain ⚠ / andon text", () => {
    const r = session("andon", [andonStep], { timeMs: 510_000, tokens: 90_000 });
    const out = renderReceipt(r, { funded: FUNDED, remaining: r.remaining });
    expect(out).toContain("⚠ Second pull");
    expect(out).toContain("andon — refused");
    expect(out).not.toContain("\x1b[");
  });

  test("an empty session (nothing cast) renders a legible note, not a blank receipt", () => {
    const r = session("wallet-exhausted", [], FUNDED);
    const out = renderReceipt(r, { funded: FUNDED, remaining: FUNDED });
    expect(out).toContain("No cast ran");
  });
});

// T-027-01 (epic E-027): the board-freshness gate's pure half — the staleness decision and the
// stale-board andon render. The impure mtime gather + the castWork wiring are proven by the free,
// deterministic live refusal (work.ts value-imports the addon — no bun test may import it).

describe("isBoardStale", () => {
  test("board older than the live state ⇒ stale", () => {
    expect(isBoardStale(100, 200)).toBe(true);
  });
  test("board newer than the live state ⇒ fresh", () => {
    expect(isBoardStale(200, 100)).toBe(false);
  });
  test("equal mtimes ⇒ fresh (fresh-on-tie)", () => {
    expect(isBoardStale(100, 100)).toBe(false);
  });
  test("no live state at all (newest 0) ⇒ fresh (nothing to be stale against)", () => {
    expect(isBoardStale(5, 0)).toBe(false);
  });
});

describe("renderStaleBoard", () => {
  // A fixed, deterministic fixture: the board predates the live state (B > A).
  const A = Date.parse("2026-06-19T11:54:37.000Z");
  const B = Date.parse("2026-06-19T22:30:00.000Z");
  const r = { boardPath: "docs/active/pm/staged/steer.md", boardMtimeMs: A, liveMtimeMs: B };

  test("renders both timestamps, the refused board, the re-survey move, and the honest caveat", () => {
    const out = renderStaleBoard(r);
    expect(out).toContain(new Date(A).toISOString()); // board staged
    expect(out).toContain(new Date(B).toISOString()); // project changed
    expect(out).toContain("steer.md"); // which board was refused
    expect(out).toContain("vend steer");
    expect(out).toContain("vend work"); // the next move is handed over
    expect(out).toContain("--stale-ok"); // the escape hatch
    expect(out).toContain("heuristic"); // the honest mtime caveat
    expect(out).toContain("refused"); // a successful stop, not a crash
  });

  test("color off (default) is plain text; color on wraps amber, never red (IA-9)", () => {
    expect(renderStaleBoard(r)).not.toContain("\x1b[");
    const colored = renderStaleBoard(r, { color: true });
    expect(colored).toContain("\x1b[33m"); // amber
    expect(colored).not.toContain("\x1b[31m"); // never red
  });
});
