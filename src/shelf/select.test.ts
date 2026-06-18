import { describe, expect, test } from "bun:test";
import { type SelectionErrorReason, SelectionError, parseSelection } from "./select.ts";

// T-003-03 select: the PURE selection mini-language parser, covered to every branch and
// every reason. No menu/CLI import (AC#4) — `menuLength` is a plain number. Assertions use
// `toEqual` (exact array), not `toContain`, so dedup AND ascending order are literally
// pinned, mirroring id-guard.test.ts. Errors are asserted twice: the class (`toThrow`) and
// the closed-union `reason` tag (`reasonOf`), so a wrong-but-still-throwing path can't pass.

/** Pin the `reason` tag, not just that *something* threw. Returns "NO-THROW" if the call
 *  succeeds or throws a non-SelectionError, so either slips past a `reason` assertion. */
function reasonOf(fn: () => unknown): SelectionErrorReason | "NO-THROW" {
  try {
    fn();
    return "NO-THROW";
  } catch (e) {
    return e instanceof SelectionError ? e.reason : "NO-THROW";
  }
}

describe("parseSelection — happy path", () => {
  test("the spec example: 1,2,4-6 → [1,2,4,5,6]", () => {
    expect(parseSelection("1,2,4-6", 6)).toEqual([1, 2, 4, 5, 6]);
  });

  test("a lone index", () => {
    expect(parseSelection("3", 5)).toEqual([3]);
  });

  test("a lone inclusive range", () => {
    expect(parseSelection("2-4", 5)).toEqual([2, 3, 4]);
  });

  test("a range spanning the full menu", () => {
    expect(parseSelection("1-3", 3)).toEqual([1, 2, 3]);
  });
});

describe("parseSelection — dedup & sort", () => {
  test("a repeated index appears once", () => {
    expect(parseSelection("1,1", 3)).toEqual([1]);
  });

  test("an index already covered by a range is absorbed", () => {
    expect(parseSelection("4-6,5", 6)).toEqual([4, 5, 6]);
  });

  test("out-of-order fields are sorted ascending", () => {
    expect(parseSelection("4-6,1", 6)).toEqual([1, 4, 5, 6]);
  });

  test("overlapping ranges merge", () => {
    expect(parseSelection("1-3,2-4", 5)).toEqual([1, 2, 3, 4]);
  });

  test("sort is numeric, not lexicographic (10 after 2)", () => {
    expect(parseSelection("10,2", 10)).toEqual([2, 10]);
  });
});

describe("parseSelection — whitespace tolerance", () => {
  test("spaces around commas and fields", () => {
    expect(parseSelection(" 1, 2 , 4-6 ", 6)).toEqual([1, 2, 4, 5, 6]);
  });

  test("spaces around the range dash", () => {
    expect(parseSelection("4 - 6", 6)).toEqual([4, 5, 6]);
  });
});

describe("parseSelection — hard errors (typed, never a guess)", () => {
  test("0 is out of range (1-indexed)", () => {
    expect(() => parseSelection("0", 5)).toThrow(SelectionError);
    expect(reasonOf(() => parseSelection("0", 5))).toBe("out-of-range");
  });

  test("an index past the menu is out of range", () => {
    expect(reasonOf(() => parseSelection("6", 5))).toBe("out-of-range");
  });

  test("a reversed range", () => {
    expect(reasonOf(() => parseSelection("6-4", 10))).toBe("reversed-range");
  });

  test("a non-integer single field", () => {
    expect(reasonOf(() => parseSelection("a", 5))).toBe("non-integer");
  });

  test("a decimal single field", () => {
    expect(reasonOf(() => parseSelection("1.5", 5))).toBe("non-integer");
  });

  test("a broken range with too many dashes", () => {
    expect(reasonOf(() => parseSelection("1-2-3", 9))).toBe("malformed-range");
  });

  test("a range missing its upper bound", () => {
    expect(reasonOf(() => parseSelection("3-", 9))).toBe("malformed-range");
  });

  test("a range missing its lower bound (leading dash)", () => {
    expect(reasonOf(() => parseSelection("-3", 9))).toBe("malformed-range");
  });

  test("the empty string", () => {
    expect(() => parseSelection("", 5)).toThrow(SelectionError);
    expect(reasonOf(() => parseSelection("", 5))).toBe("empty");
  });

  test("a stray comma yields an empty field", () => {
    expect(reasonOf(() => parseSelection("1,,2", 5))).toBe("empty");
    expect(reasonOf(() => parseSelection("1,", 5))).toBe("empty");
  });

  test("whitespace inside a single number is not coerced", () => {
    expect(reasonOf(() => parseSelection("4 6", 9))).toBe("non-integer");
  });
});

describe("parseSelection — edge cases & precedence", () => {
  test("equal endpoints are a one-element range, not reversed", () => {
    expect(parseSelection("3-3", 5)).toEqual([3]);
  });

  test("when a reversed range's endpoint also overflows, out-of-range wins (D7)", () => {
    // 6-4 with menuLength 5: 6 > 5, so the endpoint check fires before the reversed check.
    expect(reasonOf(() => parseSelection("6-4", 5))).toBe("out-of-range");
  });

  test("an empty menu rejects every index", () => {
    expect(reasonOf(() => parseSelection("1", 0))).toBe("out-of-range");
  });

  test("leading zeros are accepted as the integer they spell", () => {
    expect(parseSelection("01", 5)).toEqual([1]);
  });
});

describe("SelectionError — carries machine-branchable structure", () => {
  test("reason, field, and input are populated", () => {
    try {
      parseSelection("2,9", 5);
      throw new Error("expected throw");
    } catch (e) {
      expect(e).toBeInstanceOf(SelectionError);
      const err = e as SelectionError;
      expect(err.reason).toBe("out-of-range");
      expect(err.field).toBe("9");
      expect(err.input).toBe("2,9");
      expect(err.name).toBe("SelectionError");
    }
  });
});
