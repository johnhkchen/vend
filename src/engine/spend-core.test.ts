import { describe, expect, test } from "bun:test";
import { allocate, type Wallet } from "../budget/wallet.ts";
import type { Budget } from "../budget/budget.ts";
import { fitNext, shouldContinue, type BoardState } from "./spend-core.ts";

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
