import { describe, expect, test } from "bun:test";
import type { Budget, Usage } from "./budget.ts";
import {
  allocate,
  canAfford,
  debit,
  debitWave,
  formatWallet,
  remaining,
  type Wallet,
} from "./wallet.ts";

// T-024-01 macro-wallet: pure module, fabricated inputs only — no spawn, no fs, no clock
// (mirrors budget.test.ts's "fake inputs" rule). Every export and branch is covered here;
// this file is part of the gate for `bun run check:test`.

const macro = (timeMs: number, tokens: number): Budget => ({ timeMs, tokens });
const usage = (u: Usage): Usage => u;

describe("allocate", () => {
  test("funds remaining equal to the macro budget", () => {
    const w = allocate(macro(30_000, 100_000));
    expect(w.funded).toEqual({ timeMs: 30_000, tokens: 100_000 });
    expect(w.remaining).toEqual({ timeMs: 30_000, tokens: 100_000 });
  });

  test.each([0, -1, NaN, 1.5])("throws RangeError for invalid timeMs: %p", (t) => {
    expect(() => allocate(macro(t, 100))).toThrow(RangeError);
  });

  test.each([0, -1, NaN, 1.5])("throws RangeError for invalid tokens: %p", (t) => {
    expect(() => allocate(macro(100, t))).toThrow(RangeError);
  });
});

describe("remaining", () => {
  test("returns the live balance", () => {
    const w = allocate(macro(30_000, 100_000));
    expect(remaining(w)).toEqual({ timeMs: 30_000, tokens: 100_000 });
    const after = debit(w, macro(10_000, 40_000)).wallet;
    expect(remaining(after)).toEqual({ timeMs: 20_000, tokens: 60_000 });
  });
});

describe("canAfford", () => {
  const w = allocate(macro(30_000, 100_000));

  test("affords a cast that fits on both denominations", () => {
    expect(canAfford(w, macro(10_000, 40_000))).toBe(true);
  });

  test("refuses a cast that is over on tokens", () => {
    expect(canAfford(w, macro(10_000, 120_000))).toBe(false);
  });

  test("refuses a cast that is over on wall-clock", () => {
    expect(canAfford(w, macro(40_000, 40_000))).toBe(false);
  });

  test("fits on tokens but not on time does NOT fit (IA-8)", () => {
    expect(canAfford(w, macro(40_000, 10_000))).toBe(false);
  });

  test("fits on time but not on tokens does NOT fit", () => {
    expect(canAfford(w, macro(10_000, 200_000))).toBe(false);
  });

  test("exact fit on both denominations affords (<= boundary)", () => {
    expect(canAfford(w, macro(30_000, 100_000))).toBe(true);
  });

  test("a depleted wallet affords nothing positive", () => {
    const spent = debit(w, macro(30_000, 100_000)).wallet;
    expect(canAfford(spent, macro(1, 1))).toBe(false);
  });

  // T-048-03 characterization: pins the documented "safe-refuse" — a non-finite
  // predicted price naturally fails the `<=` comparison, so canAfford returns false
  // rather than admitting an unbounded cast. (Test-only; behavior already present.)
  test.each([Infinity, NaN])("refuses a non-finite predicted timeMs: %p", (t) => {
    expect(canAfford(w, macro(t, 10_000))).toBe(false);
  });

  test.each([Infinity, NaN])("refuses a non-finite predicted tokens: %p", (n) => {
    expect(canAfford(w, macro(10_000, n))).toBe(false);
  });
});

describe("debit — fitting Budget actual", () => {
  test("depletes both denominations by the exact amount; no overshoot", () => {
    const w = allocate(macro(30_000, 100_000));
    const out = debit(w, macro(10_000, 40_000));
    expect(out.wallet.remaining).toEqual({ timeMs: 20_000, tokens: 60_000 });
    expect(out.overshoot).toEqual({ timeMs: 0, tokens: 0 });
  });

  test("carries funded through unchanged and never mutates the input", () => {
    const w = allocate(macro(30_000, 100_000));
    const snapshot: Wallet = { funded: { ...w.funded }, remaining: { ...w.remaining } };
    const out = debit(w, macro(10_000, 40_000));
    expect(out.wallet.funded).toEqual({ timeMs: 30_000, tokens: 100_000 });
    expect(w).toEqual(snapshot); // input untouched (immutability)
  });
});

describe("debit — Usage actual", () => {
  test("debits tokens by countTokens and leaves wall-clock untouched", () => {
    const w = allocate(macro(30_000, 100_000));
    const out = debit(
      w,
      usage({ input_tokens: 600, output_tokens: 100, cache_read_input_tokens: 300 }),
    );
    // cost-weighted countTokens: 600·1.0 + 100·5.0 + 300·0.1 = 1130 (E-068), so 100k − 1130.
    expect(out.wallet.remaining).toEqual({ timeMs: 30_000, tokens: 98_870 });
    expect(out.overshoot).toEqual({ timeMs: 0, tokens: 0 });
  });

  test("an all-absent Usage debits nothing (narrows to the Usage branch)", () => {
    const w = allocate(macro(30_000, 100_000));
    const out = debit(w, usage({}));
    expect(out.wallet.remaining).toEqual({ timeMs: 30_000, tokens: 100_000 });
  });
});

describe("debit — token overshoot (IA-8 detect-after, the load-bearing case)", () => {
  test("remaining tokens floor to zero and the overshoot is surfaced", () => {
    const w = { funded: macro(30_000, 100_000), remaining: macro(20_000, 5_000) };
    const out = debit(w, macro(1_000, 12_000));
    expect(out.wallet.remaining.tokens).toBe(0);
    expect(out.overshoot.tokens).toBe(7_000); // 12k actual − 5k remaining
    expect(out.wallet.remaining.timeMs).toBe(19_000); // time denom independent
    expect(out.overshoot.timeMs).toBe(0);
  });
});

describe("debit — time overshoot (defensive symmetry)", () => {
  test("remaining time floors to zero and the overshoot is surfaced", () => {
    const w = { funded: macro(30_000, 100_000), remaining: macro(2_000, 50_000) };
    const out = debit(w, macro(5_000, 10_000));
    expect(out.wallet.remaining.timeMs).toBe(0);
    expect(out.overshoot.timeMs).toBe(3_000); // 5k actual − 2k remaining
    expect(out.wallet.remaining.tokens).toBe(40_000);
    expect(out.overshoot.tokens).toBe(0);
  });
});

describe("debit — a sequence depletes monotonically to zero", () => {
  test("repeated debits decrease remaining and reach exactly zero, then floor", () => {
    let w = allocate(macro(30_000, 90_000));
    const casts = [macro(10_000, 30_000), macro(10_000, 30_000), macro(10_000, 30_000)];
    let prevTokens = w.remaining.tokens;
    let prevTime = w.remaining.timeMs;
    for (const cast of casts) {
      const out = debit(w, cast);
      expect(out.wallet.remaining.tokens).toBeLessThan(prevTokens);
      expect(out.wallet.remaining.timeMs).toBeLessThan(prevTime);
      expect(out.overshoot).toEqual({ timeMs: 0, tokens: 0 });
      prevTokens = out.wallet.remaining.tokens;
      prevTime = out.wallet.remaining.timeMs;
      w = out.wallet;
    }
    expect(w.remaining).toEqual({ timeMs: 0, tokens: 0 });

    // One more cast against an empty wallet floors and reports the full overshoot.
    const over = debit(w, macro(5_000, 5_000));
    expect(over.wallet.remaining).toEqual({ timeMs: 0, tokens: 0 });
    expect(over.overshoot).toEqual({ timeMs: 5_000, tokens: 5_000 });
  });
});

describe("debitWave — fold a concurrent wave (E-048: tokens SUM, wall-clock MAX)", () => {
  test("all-fit: tokens are SUMMED but wall-clock is the MAX of the branch times", () => {
    const w = allocate(macro(30_000, 100_000));
    const out = debitWave(w, [macro(8_000, 30_000), macro(6_000, 20_000)]);
    // tokens: 30k + 20k = 50k summed → 50k left; time: MAX(8k, 6k) = 8k → 22k left (NOT 30k−14k).
    expect(out.wallet.remaining).toEqual({ timeMs: 22_000, tokens: 50_000 });
    expect(out.overshoot).toEqual({ timeMs: 0, tokens: 0 });
  });

  test("wall-clock is MAX, not SUM — a naive sum would over-charge time", () => {
    const w = allocate(macro(30_000, 100_000));
    const out = debitWave(w, [macro(10_000, 10_000), macro(9_000, 10_000), macro(7_000, 10_000)]);
    // If time were summed it would be 26_000 spent (4_000 left). MAX is 10_000 spent → 20_000 left.
    expect(out.wallet.remaining.timeMs).toBe(20_000);
    expect(out.wallet.remaining.tokens).toBe(70_000); // 3 × 10k summed
  });

  test("single-element wave EQUALS the sequential debit (back-compat, Budget actual)", () => {
    const w = allocate(macro(30_000, 100_000));
    const a = macro(12_000, 45_000);
    expect(debitWave(w, [a])).toEqual(debit(w, a));
  });

  test("single-element wave EQUALS the sequential debit (back-compat, Usage actual)", () => {
    const w = allocate(macro(30_000, 100_000));
    const u = usage({ input_tokens: 600, output_tokens: 100, cache_read_input_tokens: 300 });
    expect(debitWave(w, [u])).toEqual(debit(w, u));
  });

  test("empty wave is a no-op (delta {0,0}) — wallet unchanged, no overshoot", () => {
    const w = allocate(macro(30_000, 100_000));
    const out = debitWave(w, []);
    expect(out.wallet.remaining).toEqual({ timeMs: 30_000, tokens: 100_000 });
    expect(out.overshoot).toEqual({ timeMs: 0, tokens: 0 });
  });

  test("token overshoot is surfaced ONCE (collective sum), floored — not double-counted", () => {
    const w: Wallet = { funded: macro(30_000, 100_000), remaining: macro(20_000, 5_000) };
    const out = debitWave(w, [macro(1_000, 4_000), macro(1_000, 4_000)]);
    // tokens: 8k summed vs 5k remaining → floor 0, overshoot 3k surfaced once (not 4k+4k).
    expect(out.wallet.remaining.tokens).toBe(0);
    expect(out.overshoot.tokens).toBe(3_000);
    // time: MAX(1k, 1k) = 1k → 19k left, no time overshoot.
    expect(out.wallet.remaining.timeMs).toBe(19_000);
    expect(out.overshoot.timeMs).toBe(0);
  });

  test("mixed Usage + Budget: tokens summed, Usage contributes 0 to the time MAX", () => {
    const w = allocate(macro(30_000, 100_000));
    const out = debitWave(w, [
      macro(9_000, 20_000),
      usage({ input_tokens: 1_000, output_tokens: 500 }),
    ]);
    // cost-weighted countTokens: 1_000·1.0 + 500·5.0 = 3_500 (E-068); tokens: 20k + 3_500 =
    // 23_500 summed; time: MAX(9k, 0) = 9k (Usage has no time).
    expect(out.wallet.remaining).toEqual({ timeMs: 21_000, tokens: 76_500 });
    expect(out.overshoot).toEqual({ timeMs: 0, tokens: 0 });
  });

  test("does not mutate the input wallet (immutability)", () => {
    const w = allocate(macro(30_000, 100_000));
    const snapshot: Wallet = { funded: { ...w.funded }, remaining: { ...w.remaining } };
    debitWave(w, [macro(5_000, 10_000), macro(3_000, 10_000)]);
    expect(w).toEqual(snapshot);
  });
});

describe("formatWallet", () => {
  test("fresh wallet shows both denominations, nothing spent", () => {
    const s = formatWallet(allocate(macro(1_800_000, 100_000)));
    expect(s).toContain("◇"); // tokens denomination present
    expect(s).toContain("⏱"); // wall-clock denomination present
    expect(s).toContain("100k left");
    expect(s).toContain("0/100k"); // nothing spent yet
  });

  test("mid-depletion reads spent = funded − remaining, truthfully, on both bars", () => {
    const w = { funded: macro(1_800_000, 100_000), remaining: macro(1_080_000, 60_000) };
    const s = formatWallet(w);
    expect(s).toContain("40k/100k"); // 40k tokens spent of 100k
    expect(s).toContain("60k left");
    expect(s).toContain("12m/30m"); // 12 min spent of 30 min
    expect(s).toContain("18m left");
  });

  test("depleted wallet shows zero remaining on both denominations", () => {
    const w = { funded: macro(1_800_000, 100_000), remaining: macro(0, 0) };
    const s = formatWallet(w);
    expect(s).toContain("0 left"); // tokens
    expect(s).toContain("0s left"); // wall-clock
  });

  test("renders two distinct bars, never one combined figure", () => {
    const s = formatWallet(allocate(macro(1_800_000, 100_000)));
    expect(s.indexOf("◇")).toBeLessThan(s.indexOf("⏱"));
  });
});
