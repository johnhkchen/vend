import { describe, expect, test } from "bun:test";
import { detectCollisions, findExistingByTitle } from "./id-guard.ts";

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

// T-043-01: the title-keyed adoption oracle — the sibling that catches a duplicate PROPOSAL
// (same title, fresh re-minted id) that `detectCollisions` (id-reuse only) cannot. Same pure-test
// discipline: no BAML import, exact `toBe`/`toEqual`, `Object.freeze` to prove non-mutation.

describe("findExistingByTitle — title-keyed adoption oracle", () => {
  test("an existing same-title epic → its id (the E-041/E-042 incident: adopt E-042, mint nothing)", () => {
    // a board where the doctor epic is already minted as E-042; a retry proposing the SAME title
    // must ADOPT E-042 rather than mint a fresh E-043 orphan (what E-041 was).
    const board = [
      { id: "E-040", title: "macro-wallet" },
      { id: "E-042", title: "vend-doctor-preflight" },
    ];
    expect(findExistingByTitle("vend-doctor-preflight", board)).toBe("E-042");
  });

  test("a genuinely new title → null (mint as usual)", () => {
    const board = [{ id: "E-001", title: "ramp-the-shelf" }];
    expect(findExistingByTitle("brand-new-epic", board)).toBeNull();
  });

  test("normalization: differing case and surrounding whitespace still match", () => {
    const board = [{ id: "E-007", title: "Stand-Up-The-Shelf" }];
    expect(findExistingByTitle("  stand-up-the-shelf  ", board)).toBe("E-007");
  });

  test("a blank target never adopts — even against a blank-titled entry", () => {
    const board = [{ id: "E-005", title: "" }];
    expect(findExistingByTitle("", board)).toBeNull();
    expect(findExistingByTitle("   ", board)).toBeNull();
  });

  test("an empty board → null (nothing to adopt)", () => {
    expect(findExistingByTitle("anything", [])).toBeNull();
  });

  test("first match wins (input order) when two entries share a title", () => {
    const board = [
      { id: "E-002", title: "dup-title" },
      { id: "E-009", title: "dup-title" },
    ];
    expect(findExistingByTitle("dup-title", board)).toBe("E-002");
  });

  test("purity — frozen inputs survive the call unchanged", () => {
    const board = Object.freeze([Object.freeze({ id: "E-042", title: "vend-doctor-preflight" })]);
    expect(findExistingByTitle("vend-doctor-preflight", board)).toBe("E-042");
    expect(board).toEqual([{ id: "E-042", title: "vend-doctor-preflight" }]);
  });
});
