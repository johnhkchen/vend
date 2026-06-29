import { describe, expect, test } from "bun:test";
import {
  parseBoardSignals,
  labelForSignal,
  formatStepSignal,
  renderReceipt,
  isBoardStale,
  renderStaleBoard,
  planWorkBudget,
  makeWorkBudgetPlan,
  renderBudgetQuote,
} from "./work-core.ts";
import type { SessionResult, StepSignal } from "../engine/spend-core.ts";
import type { Budget } from "../budget/budget.ts";
import { coldStartEnvelope, fundingEnvelope, recalibrate } from "../ledger/recalibrate.ts";
import { buildRunRecord, type RunOutcome, type RunRecord, type RunRecordInput } from "../log/run-log.ts";
import { spendDown } from "../engine/spend.ts";
import { allocate } from "../budget/wallet.ts";
import type { ChainResult } from "../engine/chain-core.ts";

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

// ── The calibrated default budget (T-060-02-02, E-060 finding #2) ─────────────────────────
// The omit-`--budget` default is now the calibrated cold-start envelope (the p90 per-clear price),
// not a hand-picked constant. These tests pin the AC: drive the spend loop with that default → ≥1
// slice clears with no instant budget-exhausted, and the displayed QUOTE stays the bare p90 price
// (the E-050 funding-headroom is never folded in). `work.ts`/`cli.ts` value-import the BAML chain, so
// the wiring is tested here through the PURE resolver + the addon-free `spendDown`, the house pattern.

const DRIVE_PLAYS = ["propose-epic", "decompose-epic"] as const;
// budgetForTier("standard") — the per-play hand prior `castWork` passes; inlined to keep this test off
// the shelf import, mirroring recalibrate.test.ts's local PRIOR.
const STD_PRIOR: Budget = { timeMs: 3_600_000, tokens: 25_000 };

/** A run-log record with a chosen play / token total / duration / outcome — over the real pure writer
 *  so fixtures match production shape (the recalibrate.test.ts factory). */
const recordOf = (
  over: { tokens?: number; durationMs?: number; outcome?: RunOutcome; play?: string } & Partial<RunRecordInput> = {},
): RunRecord => {
  const { tokens = 50_000, durationMs = 60_000, outcome = "success", play = "propose-epic", ...rest } = over;
  const start = "2026-06-25T00:00:00.000Z";
  const end = new Date(Date.parse(start) + durationMs).toISOString();
  return buildRunRecord({
    runId: "r",
    play,
    epic: "E-001",
    model: "m",
    outcome,
    usage: { input_tokens: tokens },
    startedAt: start,
    endedAt: end,
    ...rest,
  });
};

/** ≥ COLD_START_MIN_SUCCESSES (3) measured successes per drive play — so `coldStartEnvelope` bounds a
 *  real p90 on both axes (the realistic forward state once the seed/dogfood ledger has history). */
const measuredLedger = (tokens: number, durationMs: number): RunRecord[] =>
  DRIVE_PLAYS.flatMap((play) =>
    [0, 1, 2, 3].map((i) => recordOf({ play, tokens: tokens + i * 1000, durationMs: durationMs + i * 1000 })),
  );

/** A stub chain cast that CLEARS, burning the given actuals — the injected `castOne` (engine ⊥ play),
 *  standing in for the real propose→decompose chain so the loop is driven without the BAML addon. */
const clearingCast =
  (tokens: number, wallMs: number) =>
  async (): Promise<ChainResult> => ({
    steps: [{ runId: "r", outcome: "success", materialized: true, produced: "E-001", actuals: { usage: { input_tokens: tokens }, wallMs } }],
    outcome: "success",
    halted: false,
    produced: "E-001",
  });

describe("planWorkBudget / the calibrated default (T-060-02-02)", () => {
  test("AC: drives the loop with the default → ≥1 slice clears, no instant budget-exhausted", async () => {
    const records = measuredLedger(50_000, 60_000);
    const plan = planWorkBudget(records, DRIVE_PLAYS, "standard", STD_PRIOR);
    expect(plan.source).toBe("measured");
    expect(plan.usedDefault).toBe(true);
    expect(plan.funded).toEqual(plan.quote); // the default IS the quote (no override)

    // Drive the real spend loop, funded at the calibrated default, with a stub cast that clears under
    // its envelope — exactly castWork's loop minus the BAML chain.
    const session = await spendDown<string>({
      wallet: allocate(plan.funded),
      candidates: ["Build the team-finder page — the demo keystone", "Add the self-entry form — closes the promise"],
      priceOf: () => plan.quote,
      castOne: clearingCast(20_000, 30_000), // well within the measured envelope
      labelOf: (s) => labelForSignal(s),
    });

    expect(session.steps.length).toBeGreaterThanOrEqual(1);
    expect(session.steps[0]!.outcome).toBe("success"); // the first pull was authorized AND cleared
    expect(session.cleared).toBeGreaterThanOrEqual(1); // a real slice cleared — NOT instant exhaustion
  });

  test("AC: the displayed quote is the p90 price — E-050 funding-headroom NOT folded in", () => {
    // Measured successes PLUS large censored tails (rate ≥ widenRate) ⇒ the per-cast FUNDING envelope
    // floors/widens well above the price; the QUOTE must stay the bare p90.
    const records = DRIVE_PLAYS.flatMap((play) => [
      recordOf({ play, tokens: 40_000, durationMs: 50_000 }),
      recordOf({ play, tokens: 45_000, durationMs: 55_000 }),
      recordOf({ play, tokens: 50_000, durationMs: 60_000 }),
      recordOf({ play, tokens: 5_000_000, durationMs: 9_000_000, outcome: "budget-exhausted" }),
      recordOf({ play, tokens: 5_000_000, durationMs: 9_000_000, outcome: "timed-out" }),
    ]);
    const plan = planWorkBudget(records, DRIVE_PLAYS, "standard", STD_PRIOR);
    const cold = coldStartEnvelope(DRIVE_PLAYS, records, "standard", STD_PRIOR);

    // The quote is exactly coldStartEnvelope's p90 Σ — read from the ledger, not the funding number.
    expect(plan.quote).toEqual(cold.envelope);

    // The summed per-cast funding envelope is strictly above the quote on tokens (headroom lifted it) —
    // proving the quote did not absorb the E-050 guard.
    const fundingTokens = DRIVE_PLAYS.reduce(
      (sum, play, i) => sum + fundingEnvelope(play, records, cold.perPlay[i]!.result).envelope.tokens,
      0,
    );
    expect(fundingTokens).toBeGreaterThan(plan.quote.tokens);
  });

  test("measured ⇒ distinguishable from the summed hand prior", () => {
    const measured = planWorkBudget(measuredLedger(120_000, 90_000), DRIVE_PLAYS, "standard", STD_PRIOR);
    const summedPrior: Budget = { timeMs: 2 * STD_PRIOR.timeMs, tokens: 2 * STD_PRIOR.tokens };
    expect(measured.source).toBe("measured");
    expect(measured.quote).not.toEqual(summedPrior); // the ledger moved the value off the prior
  });

  test("cold start (no successes) ⇒ source 'prior', default = summed prior, still funds the first pull", async () => {
    const plan = planWorkBudget([], DRIVE_PLAYS, "standard", STD_PRIOR);
    expect(plan.source).toBe("prior");
    expect(plan.usedDefault).toBe(true);
    expect(plan.quote).toEqual({ timeMs: 2 * STD_PRIOR.timeMs, tokens: 2 * STD_PRIOR.tokens });

    // The budget-shape fix: funded == price ⇒ canAfford is true at equality ⇒ the first pull authorizes
    // and clears (the per-cast funding floor carries the real burn) instead of colliding with the wall.
    const session = await spendDown<string>({
      wallet: allocate(plan.funded),
      candidates: ["the keystone slice — nothing shows without it"],
      priceOf: () => plan.quote,
      castOne: clearingCast(40_000, 45_000),
      labelOf: (s) => labelForSignal(s),
    });
    expect(session.cleared).toBeGreaterThanOrEqual(1);
  });

  test("makeWorkBudgetPlan: override wins and flips usedDefault; default == quote", () => {
    const quote: Budget = { timeMs: 120_000, tokens: 100_000 };
    const override: Budget = { timeMs: 1_800_000, tokens: 1_000_000 };

    const def = makeWorkBudgetPlan(quote, "measured");
    expect(def).toEqual({ funded: quote, quote, source: "measured", usedDefault: true });

    const overridden = makeWorkBudgetPlan(quote, "measured", override);
    expect(overridden.funded).toEqual(override); // the user's --budget funds the wallet
    expect(overridden.quote).toEqual(quote); // …but the displayed quote stays the p90 price
    expect(overridden.usedDefault).toBe(false);
  });

  test("renderBudgetQuote: two-denomination quote + honest provenance, plain by default", () => {
    const measured = makeWorkBudgetPlan({ timeMs: 120_000, tokens: 100_000 }, "measured");
    const m = renderBudgetQuote(measured);
    expect(m).toContain("◇"); // tokens denomination (IA-8)
    expect(m).toContain("⏱"); // wall-clock denomination
    expect(m).toContain("measured");
    expect(m).not.toContain("\x1b["); // plain by default — assertable

    const cold = makeWorkBudgetPlan({ timeMs: 7_200_000, tokens: 50_000 }, "prior");
    expect(renderBudgetQuote(cold)).toContain("cold start"); // never mistaken for an earned price
    expect(renderBudgetQuote(cold, { color: true })).toContain("\x1b["); // emphasis when asked
  });
});
