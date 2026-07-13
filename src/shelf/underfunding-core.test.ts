import { describe, expect, test } from "bun:test";
import type { Budget } from "../budget/budget.ts";
import { UNDERFUNDING_FACTOR, underfundingWarning } from "./underfunding-core.ts";

// Pure plain-value fixtures only: importing this test never reaches the press shell, play
// assembly, executor, or BAML addon.
const budget = (tokens: number, timeMs = 60_000): Budget => ({ tokens, timeMs });

describe("underfundingWarning — severe token underfunding", () => {
  test("uses the settled 2x material-underfunding factor", () => {
    expect(UNDERFUNDING_FACTOR).toBe(2);
  });

  test("warns on the field-report ratio and names funded vs measured floor", () => {
    const warning = underfundingWarning(budget(12_500), budget(400_000));

    expect(warning).toBe(
      "⚠ underfunded: 12.5k tokens funded vs 400k measured floor; proceeding with funded budget",
    );
  });

  test("warns one token below the factor boundary", () => {
    expect(underfundingWarning(budget(199_999), budget(400_000))).not.toBeNull();
  });
});

describe("underfundingWarning — adequate and near-floor funding", () => {
  test("is silent when funded exactly at the measured floor", () => {
    expect(underfundingWarning(budget(400_000), budget(400_000))).toBeNull();
  });

  test("is silent when funded above the measured floor", () => {
    expect(underfundingWarning(budget(450_000), budget(400_000))).toBeNull();
  });

  test("is silent near the measured floor", () => {
    expect(underfundingWarning(budget(350_000), budget(400_000))).toBeNull();
  });

  test("is silent exactly at the factor boundary", () => {
    expect(underfundingWarning(budget(200_000), budget(400_000))).toBeNull();
  });

  test("compares tokens only, not the independent wall-clock dimension", () => {
    expect(underfundingWarning(budget(400_000, 1), budget(400_000, 86_400_000))).toBeNull();
  });
});
