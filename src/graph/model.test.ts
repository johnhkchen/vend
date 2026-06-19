import { describe, expect, test } from "bun:test";
import {
  buildGraph,
  deepFreeze,
  epicIdForStory,
  GraphIntegrityError,
  GraphParseError,
  parseFrontmatter,
  type EpicNode,
  type RawNode,
  type StoryNode,
} from "./model.ts";

// T-021-01 — the PURE model core, covered to every branch with string/record fixtures (no fs;
// the impure directory walk is exercised in load.test.ts). `Bun.YAML.parse` is a deterministic
// runtime global, not the flaky BAML addon, so this stays an ordinary pure-function test.

// A RawNode straight from a frontmatter mapping + (optional) body — what parseFrontmatter emits.
const raw = (file: string, data: Record<string, unknown>, body = ""): RawNode => ({ data, body, file });

const ticket = (id: string, story: string, depends_on: string[] = []): RawNode =>
  raw(`${id}.md`, { id, story, title: `t-${id}`, type: "task", status: "open", priority: "high", phase: "ready", depends_on });
const story = (id: string, tickets: string[]): RawNode =>
  raw(`${id}.md`, { id, title: `s-${id}`, type: "story", status: "open", priority: "high", tickets });
const epic = (id: string): RawNode => raw(`${id}.md`, { id, title: `e-${id}`, status: "open", advances: ["P1"] });

describe("parseFrontmatter", () => {
  test("splits frontmatter from body and strips inline # comments", () => {
    const r = parseFrontmatter("---\nid: E-001\nstatus: active   # open | done\n---\nbody line\n", "E-001.md");
    expect(r.data["id"]).toBe("E-001");
    expect(r.data["status"]).toBe("active"); // the inline comment is stripped by Bun.YAML
    expect(r.body).toBe("body line\n");
    expect(r.file).toBe("E-001.md");
  });

  test("no leading fence → GraphParseError", () => {
    expect(() => parseFrontmatter("no frontmatter here", "x.md")).toThrow(GraphParseError);
  });

  test("frontmatter that is a sequence, not a mapping → GraphParseError", () => {
    expect(() => parseFrontmatter("---\n- a\n- b\n---\n", "x.md")).toThrow(GraphParseError);
  });
});

describe("epicIdForStory — the id-convention edge", () => {
  test("S-NNN-MM and S-NNN both map to E-NNN", () => {
    expect(epicIdForStory("S-021-01")).toBe("E-021");
    expect(epicIdForStory("S-001")).toBe("E-001");
  });
  test("a non-S id throws GraphParseError", () => {
    expect(() => epicIdForStory("T-001-01")).toThrow(GraphParseError);
  });
});

describe("buildGraph — happy path", () => {
  const g = buildGraph(
    [epic("E-001")],
    [story("S-001-01", ["T-001-01", "T-001-02"])],
    [ticket("T-001-01", "S-001-01"), ticket("T-001-02", "S-001-01", ["T-001-01"])],
  );

  test("links containment as objects, story order preserved", () => {
    expect(g.epics).toHaveLength(1);
    expect(g.epics[0]!.stories).toHaveLength(1);
    expect(g.epics[0]!.stories[0]!.tickets.map((t) => t.id)).toEqual(["T-001-01", "T-001-02"]);
  });

  test("epic resolved by convention; back-ref ids intact", () => {
    expect(g.stories[0]!.epicId).toBe("E-001");
    expect(g.tickets.find((t) => t.id === "T-001-02")!.storyId).toBe("S-001-01");
  });

  test("blocks is the derived inverse of depends_on", () => {
    expect(g.byId["T-001-01"]).toBeDefined();
    expect((g.byId["T-001-01"] as { blocks: readonly string[] }).blocks).toEqual(["T-001-02"]);
    expect((g.byId["T-001-02"] as { blocks: readonly string[] }).blocks).toEqual([]);
  });

  test("byId indexes every node kind", () => {
    expect(g.byId["E-001"]!.kind).toBe("epic");
    expect(g.byId["S-001-01"]!.kind).toBe("story");
    expect(g.byId["T-001-01"]!.kind).toBe("ticket");
  });
});

describe("buildGraph — integrity (every edge must resolve)", () => {
  const good = { e: [epic("E-001")], s: [story("S-001-01", ["T-001-01"])], t: [ticket("T-001-01", "S-001-01")] };

  test("ticket → missing story", () => {
    expect(() => buildGraph(good.e, good.s, [ticket("T-001-01", "S-999-99")])).toThrow(GraphIntegrityError);
  });
  test("story lists a missing ticket", () => {
    expect(() => buildGraph(good.e, [story("S-001-01", ["T-404-01"])], good.t)).toThrow(GraphIntegrityError);
  });
  test("dangling depends_on", () => {
    expect(() => buildGraph(good.e, good.s, [ticket("T-001-01", "S-001-01", ["T-404-01"])])).toThrow(GraphIntegrityError);
  });
  test("story with no epic", () => {
    expect(() => buildGraph([], good.s, good.t)).toThrow(GraphIntegrityError);
  });
  test("duplicate id", () => {
    expect(() => buildGraph([epic("E-001"), epic("E-001")], good.s, good.t)).toThrow(GraphIntegrityError);
  });
  test("the error lists ALL violations, not just the first", () => {
    try {
      buildGraph([], [story("S-001-01", ["T-404"])], [ticket("T-001-01", "S-999")]);
      throw new Error("expected throw");
    } catch (e) {
      expect(e).toBeInstanceOf(GraphIntegrityError);
      expect((e as GraphIntegrityError).violations.length).toBeGreaterThanOrEqual(3);
    }
  });
});

describe("buildGraph — coercion fails loud", () => {
  test("a node missing `id` → GraphParseError naming the file", () => {
    const bad = raw("broken.md", { title: "no id", status: "open", advances: [] });
    expect(() => buildGraph([bad], [], [])).toThrow(GraphParseError);
  });
  test("a wrong-typed list field → GraphParseError", () => {
    const bad = raw("S-001-01.md", { id: "S-001-01", title: "s", status: "open", priority: "high", tickets: "T-001-01" });
    expect(() => buildGraph([epic("E-001")], [bad], [])).toThrow(GraphParseError);
  });
});

describe("read-only / deep immutability (the AC)", () => {
  const g = buildGraph([epic("E-001")], [story("S-001-01", ["T-001-01"])], [ticket("T-001-01", "S-001-01")]);

  test("mutating a node field throws", () => {
    expect(() => {
      (g.tickets[0] as { title: string }).title = "hacked";
    }).toThrow();
  });
  test("pushing to a frozen child/top-level array throws", () => {
    expect(() => (g.epics as EpicNode[]).push({} as EpicNode)).toThrow();
    expect(() => (g.epics[0]!.stories as StoryNode[]).push({} as StoryNode)).toThrow();
  });
  test("assigning into the byId index throws", () => {
    expect(() => {
      (g.byId as Record<string, unknown>)["X-1"] = {};
    }).toThrow();
  });
  test("deepFreeze freezes nested objects and arrays", () => {
    const v = deepFreeze({ a: { b: [1] } });
    expect(Object.isFrozen(v)).toBe(true);
    expect(Object.isFrozen(v.a)).toBe(true);
    expect(Object.isFrozen(v.a.b)).toBe(true);
  });
});
