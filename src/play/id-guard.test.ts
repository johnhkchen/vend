import { describe, expect, test } from "bun:test";
import { detectCollisions } from "./id-guard.ts";

// T-004-01 id-guard: the PURE cross-board collision detector, covered to every branch.
// No baml imports at all (the module sees only string arrays) — this is the purest test
// in the tree, an ordinary pure-function test. Fixtures are plain id strings in the
// lisa namespace (S-001, T-001-01) that `project-context.listIds` and `plan.*.id` emit.
// Assertions use `toEqual` (exact array), not `toContain`, so "exactly the reused ids"
// (AC#2) is literally pinned — both membership AND order.

describe("detectCollisions — cross-board intersection", () => {
  test("a colliding fixture returns exactly the reused ids", () => {
    const generated = ["S-004", "T-004-01", "T-004-02"];
    const existing = ["S-001", "T-001-01", "T-004-01", "T-004-02", "S-002"];
    // T-004-01 and T-004-02 already exist on the board; S-004 is new.
    expect(detectCollisions(generated, existing)).toEqual(["T-004-01", "T-004-02"]);
  });

  test("a disjoint fixture returns [] (clear — safe to materialize)", () => {
    const generated = ["S-009", "T-009-01", "T-009-02"];
    const existing = ["S-001", "T-001-01", "T-002-03"];
    expect(detectCollisions(generated, existing)).toEqual([]);
  });

  test("empty generated → [] (nothing to write, nothing to clash)", () => {
    expect(detectCollisions([], ["S-001", "T-001-01"])).toEqual([]);
  });

  test("empty existing → [] (a fresh board collides with nothing)", () => {
    expect(detectCollisions(["S-001", "T-001-01"], [])).toEqual([]);
  });
});

describe("order & dedup are pinned", () => {
  test("order follows first appearance in `generated`, not `existing`", () => {
    const generated = ["T-003", "T-001", "T-002"];
    // `existing` lists the same ids in a DIFFERENT order — must not influence output.
    const existing = ["T-001", "T-002", "T-003"];
    expect(detectCollisions(generated, existing)).toEqual(["T-003", "T-001", "T-002"]);
  });

  test("a colliding id repeated in `generated` appears exactly once", () => {
    const generated = ["T-001-01", "T-001-01", "S-001"];
    const existing = ["T-001-01", "S-001"];
    expect(detectCollisions(generated, existing)).toEqual(["T-001-01", "S-001"]);
  });

  test("a repeated NON-colliding id never appears", () => {
    const generated = ["T-009-01", "T-009-01", "T-004-01"];
    const existing = ["T-004-01"];
    expect(detectCollisions(generated, existing)).toEqual(["T-004-01"]);
  });
});

describe("purity — inputs are not mutated", () => {
  test("frozen inputs survive the call unchanged", () => {
    const generated = Object.freeze(["S-004", "T-004-01"]) as readonly string[];
    const existing = Object.freeze(["T-004-01"]) as readonly string[];
    // Object.freeze means any mutation attempt throws — a non-throwing call proves
    // the function only reads its arguments.
    expect(detectCollisions(generated, existing)).toEqual(["T-004-01"]);
    expect(generated).toEqual(["S-004", "T-004-01"]);
    expect(existing).toEqual(["T-004-01"]);
  });
});
