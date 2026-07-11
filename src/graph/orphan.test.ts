import { describe, expect, test } from "bun:test";
import { buildGraph, type RawNode } from "./model.ts";
import { findOrphanEpics, isOrphanEpic } from "./orphan.ts";

// T-068-03-01 — the PURE orphan-epic detector, covered to both AC branches with in-memory
// buildGraph fixtures (no fs; the impure board load + doctor Check surface is T-068-03-02).
// Fixtures go through the REAL buildGraph so the detector binds to the genuine frozen WorkGraph
// shape, not a hand-mocked object — the same discipline model.test.ts follows.

// A RawNode straight from a frontmatter mapping + (optional) body — what parseFrontmatter emits.
const raw = (file: string, data: Record<string, unknown>, body = ""): RawNode => ({ data, body, file });

const epic = (id: string): RawNode => raw(`${id}.md`, { id, title: `e-${id}`, status: "open", advances: ["P1"] });
const story = (id: string, tickets: string[]): RawNode =>
  raw(`${id}.md`, { id, title: `s-${id}`, type: "story", status: "open", priority: "high", tickets });
const ticket = (id: string, story: string, deps: string[] = []): RawNode =>
  raw(`${id}.md`, {
    id,
    story,
    title: `t-${id}`,
    type: "task",
    status: "open",
    priority: "high",
    phase: "ready",
    depends_on: deps,
  });

describe("findOrphanEpics", () => {
  test("AC: a childless epic on the board is returned by id", () => {
    // E-001 fully populated (story + ticket); E-002 is the half-minted orphan (no stories/tickets).
    const g = buildGraph(
      [epic("E-001"), epic("E-002")],
      [story("S-001-01", ["T-001-01"])],
      [ticket("T-001-01", "S-001-01")],
    );
    expect(findOrphanEpics(g)).toEqual(["E-002"]);
  });

  test("AC: a fully-populated board returns []", () => {
    const g = buildGraph(
      [epic("E-001"), epic("E-002")],
      [story("S-001-01", ["T-001-01"]), story("S-002-01", ["T-002-01"])],
      [ticket("T-001-01", "S-001-01"), ticket("T-002-01", "S-002-01")],
    );
    expect(findOrphanEpics(g)).toEqual([]);
  });

  test("multiple orphans are returned in id-sorted order (follows buildGraph's sort)", () => {
    // Declared out of order (E-003 epic listed before E-001) — output must still be id-sorted.
    const g = buildGraph(
      [epic("E-003"), epic("E-002"), epic("E-001")],
      [story("S-002-01", ["T-002-01"])],
      [ticket("T-002-01", "S-002-01")],
    );
    expect(findOrphanEpics(g)).toEqual(["E-001", "E-003"]);
  });

  test("an empty board returns [] (vacuous, never throws)", () => {
    const g = buildGraph([], [], []);
    expect(findOrphanEpics(g)).toEqual([]);
  });

  test("an epic whose only story is ticketless is NOT an orphan (it has a child story)", () => {
    // The AND-collapse boundary: this is a DIFFERENT partial-mint (a story exists), out of slice.
    const g = buildGraph([epic("E-001")], [story("S-001-01", [])], []);
    expect(findOrphanEpics(g)).toEqual([]);
  });

  test("pure + total: repeated calls are deterministic and it never throws", () => {
    const g = buildGraph([epic("E-001"), epic("E-002")], [story("S-001-01", ["T-001-01"])], [ticket("T-001-01", "S-001-01")]);
    expect(() => findOrphanEpics(g)).not.toThrow();
    expect(findOrphanEpics(g)).toEqual(findOrphanEpics(g));
  });
});

describe("isOrphanEpic", () => {
  test("true for a storyless epic node, false for one with a child story", () => {
    const g = buildGraph(
      [epic("E-001"), epic("E-002")],
      [story("S-001-01", ["T-001-01"])],
      [ticket("T-001-01", "S-001-01")],
    );
    const populated = g.epics.find((e) => e.id === "E-001")!;
    const orphan = g.epics.find((e) => e.id === "E-002")!;
    expect(isOrphanEpic(populated)).toBe(false);
    expect(isOrphanEpic(orphan)).toBe(true);
  });
});
