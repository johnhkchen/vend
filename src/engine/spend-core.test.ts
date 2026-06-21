import { describe, expect, test } from "bun:test";
import { allocate, type Wallet } from "../budget/wallet.ts";
import type { Budget } from "../budget/budget.ts";
import { authorizeWave, fitNext, shouldContinue, type BoardState } from "./spend-core.ts";

// T-024-02 spend loop: the PURE decision core. We import ONLY ./spend-core.ts (never ./spend.ts,
// which wires the impure cast) so this `bun test` process spawns NOTHING and touches no fs — an
// ordinary pure-function test (the chain-core.test.ts / cast-core.test.ts discipline). `spendDown`
// is the impure shell and is not exercised here; its logic IS this tested core + the tested wallet,
// proven live when T-024-03 injects the real chain.

// Fixture builders — fabricated inputs only.
const macro = (timeMs: number, tokens: number): Budget => ({ timeMs, tokens });
const fund = (timeMs: number, tokens: number): Wallet => allocate(macro(timeMs, tokens));
// A candidate is just a label here; its price is whatever `priceOf` maps it to.
const priceTable = (table: Record<string, Budget>) => (c: string): Budget => table[c]!;

describe("fitNext", () => {
  test("returns the highest-leverage candidate when the head fits", () => {
    const wallet = fund(60_000, 100_000);
    const price = priceTable({ A: macro(10_000, 20_000), B: macro(5_000, 10_000) });
    // A is first (highest-leverage) and affordable → A, even though B is cheaper.
    expect(fitNext(wallet, ["A", "B"], price)).toBe("A");
  });

  test("SKIPS an unaffordable head to the highest-leverage candidate that still fits", () => {
    const wallet = fund(60_000, 100_000);
    const price = priceTable({
      A: macro(10_000, 200_000), // over tokens — does not fit
      B: macro(10_000, 50_000), // fits
      C: macro(10_000, 10_000), // also fits, but lower-leverage than B
    });
    expect(fitNext(wallet, ["A", "B", "C"], price)).toBe("B");
  });

  test("returns null when NOTHING on the board fits (the wallet-exhausted signal)", () => {
    const wallet = fund(5_000, 5_000);
    const price = priceTable({ A: macro(10_000, 1_000), B: macro(1_000, 10_000) });
    expect(fitNext(wallet, ["A", "B"], price)).toBeNull();
  });

  test("returns null for an empty board", () => {
    expect(fitNext(fund(60_000, 100_000), [], priceTable({}))).toBeNull();
  });

  test("exact-fit affords (<= boundary, both denominations equal to remaining)", () => {
    const wallet = fund(30_000, 50_000);
    const price = priceTable({ A: macro(30_000, 50_000) });
    expect(fitNext(wallet, ["A"], price)).toBe("A");
  });

  test("honest per denomination — a fits-on-tokens-not-time head is SKIPPED", () => {
    const wallet = fund(10_000, 100_000);
    const price = priceTable({
      A: macro(20_000, 10_000), // tokens fit, time does NOT → not afforded
      B: macro(5_000, 10_000), // both fit
    });
    expect(fitNext(wallet, ["A", "B"], price)).toBe("B");
  });
});

describe("authorizeWave (the fitNext generalization to a ready-set — E-048)", () => {
  test("all-fit: the whole ready-set is dispatched, none stopped", () => {
    const wallet = fund(60_000, 100_000);
    const price = priceTable({ A: macro(10_000, 20_000), B: macro(5_000, 10_000) });
    const out = authorizeWave(wallet, ["A", "B"], price);
    expect(out.dispatch).toEqual(["A", "B"]);
    expect(out.stopped).toEqual([]);
  });

  test("partial — token-stop: tokens are CUMULATIVE, the overflowing tail is stopped", () => {
    const wallet = fund(60_000, 50_000);
    const price = priceTable({
      A: macro(10_000, 40_000), // fits → cumulative 40k
      B: macro(10_000, 20_000), // 40k + 20k = 60k > 50k → stopped
    });
    const out = authorizeWave(wallet, ["A", "B"], price);
    expect(out.dispatch).toEqual(["A"]);
    expect(out.stopped).toEqual(["B"]);
  });

  test("partial — time-stop: wall-clock is EACH-fits (not cumulative); a later node still fits", () => {
    const wallet = fund(10_000, 100_000);
    const price = priceTable({
      A: macro(20_000, 10_000), // time 20k > 10k remaining → stopped (each-fits)
      B: macro(5_000, 10_000), // time fits, tokens fit → dispatched even though A was stopped
    });
    const out = authorizeWave(wallet, ["A", "B"], price);
    expect(out.dispatch).toEqual(["B"]);
    expect(out.stopped).toEqual(["A"]);
  });

  test("continue-after-stop: a stopped middle node does not strand a smaller affordable tail", () => {
    const wallet = fund(60_000, 50_000);
    const price = priceTable({
      A: macro(10_000, 30_000), // fits → cumulative 30k
      B: macro(10_000, 40_000), // 30k + 40k = 70k > 50k → stopped, cumulative stays 30k
      C: macro(10_000, 15_000), // 30k + 15k = 45k ≤ 50k → fits (skip-the-unaffordable-head)
    });
    const out = authorizeWave(wallet, ["A", "B", "C"], price);
    expect(out.dispatch).toEqual(["A", "C"]);
    expect(out.stopped).toEqual(["B"]);
  });

  test("none fit: every node is stopped (the wave-boundary hard wall)", () => {
    const wallet = fund(5_000, 5_000);
    const price = priceTable({ A: macro(10_000, 1_000), B: macro(1_000, 10_000) });
    const out = authorizeWave(wallet, ["A", "B"], price);
    expect(out.dispatch).toEqual([]);
    expect(out.stopped).toEqual(["A", "B"]);
  });

  test("empty ready-set → empty partition (total)", () => {
    const out = authorizeWave(fund(60_000, 100_000), [], priceTable({}));
    expect(out).toEqual({ dispatch: [], stopped: [] });
  });

  test("exact-fit boundary (<=): cumulative tokens equal to remaining still dispatches", () => {
    const wallet = fund(30_000, 50_000);
    const price = priceTable({
      A: macro(30_000, 30_000), // cumulative 30k, time exactly 30k
      B: macro(30_000, 20_000), // 30k + 20k = 50k == remaining, time == remaining → fits
    });
    const out = authorizeWave(wallet, ["A", "B"], price);
    expect(out.dispatch).toEqual(["A", "B"]);
    expect(out.stopped).toEqual([]);
  });

  test("walks the GIVEN order — it does not re-sort the ready-set", () => {
    const wallet = fund(60_000, 50_000);
    const price = priceTable({ A: macro(10_000, 40_000), B: macro(10_000, 20_000) });
    // Same prices, reversed input order: now B fits first (20k), A overflows (20k+40k>50k).
    const out = authorizeWave(wallet, ["B", "A"], price);
    expect(out.dispatch).toEqual(["B"]);
    expect(out.stopped).toEqual(["A"]);
  });
});

describe("shouldContinue", () => {
  const wallet = fund(30_000, 50_000);
  const board = (remaining: number, fits: boolean): BoardState => ({ remaining, fits });

  test("continues while the board has affordable work and no andon fired", () => {
    expect(shouldContinue(wallet, board(3, true), null)).toEqual({ action: "continue" });
    expect(shouldContinue(wallet, board(3, true), "success")).toEqual({ action: "continue" });
  });

  test("stops 'board-cleared' when no candidates remain", () => {
    const c = shouldContinue(wallet, board(0, false), "success");
    expect(c.action).toBe("stop");
    expect(c).toMatchObject({ reason: "board-cleared" });
  });

  test("stops 'wallet-exhausted' when candidates remain but none fits", () => {
    const c = shouldContinue(wallet, board(2, false), "success");
    expect(c.action).toBe("stop");
    expect(c).toMatchObject({ reason: "wallet-exhausted" });
  });

  test.each(["gate-failed", "timed-out", "budget-exhausted", "id-collision"] as const)(
    "stops 'andon' when the last cast outcome was '%s'",
    (outcome) => {
      const c = shouldContinue(wallet, board(2, true), outcome);
      expect(c.action).toBe("stop");
      expect(c).toMatchObject({ reason: "andon" });
    },
  );

  test("precedence: an andon beats a cleared board", () => {
    // Last cast andon'd AND it was the final candidate — report the andon, the abnormal stop.
    const c = shouldContinue(wallet, board(0, false), "timed-out");
    expect(c).toMatchObject({ action: "stop", reason: "andon" });
  });

  test("precedence: a cleared board beats wallet-exhausted", () => {
    const c = shouldContinue(wallet, board(0, false), "success");
    expect(c).toMatchObject({ action: "stop", reason: "board-cleared" });
  });

  test("the stop detail names the remaining wallet", () => {
    const c = shouldContinue(fund(30_000, 50_000), board(2, false), "success");
    expect(c.action).toBe("stop");
    if (c.action === "stop") expect(c.detail).toContain("50000 tokens");
  });
});
