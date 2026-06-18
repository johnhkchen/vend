import { describe, expect, test } from "bun:test";
import {
  BUDGET_EXHAUSTED,
  type Budget,
  check,
  countTokens,
  timeoutMsFor,
} from "./budget.ts";

// T-001-03 budget-control: pure module, fabricated inputs only — no spawn, no fs,
// no clock (mirrors mc-design-eval's "fake inputs" test rule). Every function and
// branch is covered here; this file is the gate for `bun run check:test`.

const budget = (timeMs: number, tokens: number): Budget => ({ timeMs, tokens });

describe("countTokens", () => {
  test("sums all four sub-counts", () => {
    expect(
      countTokens({
        input_tokens: 100,
        output_tokens: 50,
        cache_read_input_tokens: 1000,
        cache_creation_input_tokens: 20,
      }),
    ).toBe(1170);
  });

  test("treats missing fields as 0", () => {
    expect(countTokens({ input_tokens: 100, output_tokens: 50 })).toBe(150);
  });

  test("empty usage is 0", () => {
    expect(countTokens({})).toBe(0);
  });

  test("counts cache-only usage (the decision vs input+output-only)", () => {
    expect(
      countTokens({ cache_read_input_tokens: 800, cache_creation_input_tokens: 200 }),
    ).toBe(1000);
  });

  test("coerces non-finite fields to 0", () => {
    expect(countTokens({ input_tokens: NaN, output_tokens: 10 })).toBe(10);
  });
});

describe("timeoutMsFor", () => {
  test("returns the wall-clock allowance verbatim", () => {
    expect(timeoutMsFor(budget(30_000, 1))).toBe(30_000);
  });

  test.each([0, -1, NaN, 1.5])("throws RangeError for invalid timeMs: %p", (t) => {
    expect(() => timeoutMsFor(budget(t, 1))).toThrow(RangeError);
  });
});

describe("check — ok branch", () => {
  test("spent below ceiling is ok with remaining", () => {
    const out = check(budget(1, 1000), { input_tokens: 600, output_tokens: 100 });
    expect(out.status).toBe("ok");
    if (out.status === "ok") {
      expect(out.spent).toBe(700);
      expect(out.ceiling).toBe(1000);
      expect(out.remaining).toBe(300);
    }
  });

  test("spent exactly at ceiling is ok (boundary), remaining 0", () => {
    const out = check(budget(1, 700), { input_tokens: 600, output_tokens: 100 });
    expect(out.status).toBe("ok");
    if (out.status === "ok") {
      expect(out.remaining).toBe(0);
    }
  });
});

describe("check — exhausted branch", () => {
  test("spent over ceiling is a typed, named andon carrying the overage", () => {
    const out = check(budget(1, 500), { input_tokens: 600, output_tokens: 100 });
    expect(out.status).toBe("exhausted");
    if (out.status === "exhausted") {
      expect(out.code).toBe(BUDGET_EXHAUSTED);
      expect(out.spent).toBe(700);
      expect(out.ceiling).toBe(500);
      expect(out.overage).toBe(200);
    }
  });

  test("the andon is data, not a console line — every field is present", () => {
    const out = check(budget(1, 10), { input_tokens: 100 });
    expect(out).toEqual({
      status: "exhausted",
      code: "EBUDGET_EXHAUSTED",
      spent: 100,
      ceiling: 10,
      overage: 90,
    });
  });
});

describe("check — invalid ceiling", () => {
  test.each([0, -5, NaN, 2.5])("throws RangeError for invalid tokens: %p", (t) => {
    expect(() => check(budget(1, t), {})).toThrow(RangeError);
  });
});
