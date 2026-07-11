import { describe, expect, test } from "bun:test";
import {
  BUDGET_EXHAUSTED,
  type Budget,
  check,
  COST_WEIGHTS,
  countTokens,
  TIMEOUT_HEADROOM,
  timeoutMsFor,
} from "./budget.ts";
import { allocate, canAfford } from "./wallet.ts";

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

describe("COST_WEIGHTS", () => {
  test("pins the confirmed cost-weight vector (guards against parity drift)", () => {
    // The confirmed ratios, not the {~0.1/1.25/~5} starting guesses — silent drift back to
    // parity (all 1.0) or to wrong ratios fails the gate.
    expect(COST_WEIGHTS).toEqual({
      input: 1.0,
      cache_read: 0.1,
      cache_creation: 1.25,
      output: 5.0,
    });
  });

  test("input is the numeraire (1.0) — every other weight is a ratio to it", () => {
    expect(COST_WEIGHTS.input).toBe(1.0);
  });

  test("the load-bearing price relationships hold", () => {
    // output is 5× input (the lineup-wide 1:5 ratio)
    expect(COST_WEIGHTS.output).toBe(5 * COST_WEIGHTS.input);
    // cached context is CHEAP — the whole reason for the reweight (~0.1× a fresh input token)
    expect(COST_WEIGHTS.cache_read).toBeLessThan(COST_WEIGHTS.input);
    expect(COST_WEIGHTS.cache_read).toBeCloseTo(0.1 * COST_WEIGHTS.input);
    // a cache write costs just above a fresh input token
    expect(COST_WEIGHTS.cache_creation).toBeGreaterThan(COST_WEIGHTS.input);
  });

  test("is a frozen, shared read-only singleton", () => {
    expect(Object.isFrozen(COST_WEIGHTS)).toBe(true);
  });
});

describe("timeoutMsFor", () => {
  test("returns the wall-clock allowance × headroom (the runaway-guard, not the price)", () => {
    expect(timeoutMsFor(budget(30_000, 1))).toBe(30_000 * TIMEOUT_HEADROOM);
  });

  test.each([0, -1, NaN, 1.5])("throws RangeError for invalid timeMs: %p", (t) => {
    expect(() => timeoutMsFor(budget(t, 1))).toThrow(RangeError);
  });

  test("TIMEOUT_HEADROOM is a warranted factor with real margin (≥2, integer)", () => {
    // Pins the documented constant: a silent drift toward ~1.0 (no headroom) fails the gate.
    expect(Number.isInteger(TIMEOUT_HEADROOM)).toBe(true);
    expect(TIMEOUT_HEADROOM).toBeGreaterThanOrEqual(2);
  });

  // AC #3 — deterministic proof, NO live model. Map E-037's ~72–73 s censored `propose-epic`
  // runs (work/T-037-02/sweep-log.md) onto the headroomed timeout: both would FINISH under the
  // wall (no guillotine at 72.8 s), while affordability still gates on the bare price T.
  test("E-037's censored runs would finish under the headroomed timeout; affordability gates on the price", () => {
    const T = 72_785; // propose-epic's measured p90 envelope (the price)
    const censoredActuals = [72_792, 72_805]; // the two timed-out runs, ~1% over the envelope

    const timeout = timeoutMsFor(budget(T, 1));
    expect(timeout).toBe(T * TIMEOUT_HEADROOM);
    for (const actual of censoredActuals) {
      // Each killed-at-72.8s run finishes well under the 2× wall — the guillotine is gone.
      expect(actual).toBeLessThan(timeout);
    }

    // The price stays the honest p90: affordability reads the BARE T, not the headroomed value.
    const wallet = allocate(budget(T, 1_000)); // exactly T ms funded
    expect(canAfford(wallet, budget(T, 1))).toBe(true); // a cast priced at T fits in T
    expect(canAfford(wallet, budget(T + 1, 1))).toBe(false); // one ms over the price does not
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
