import { describe, expect, test } from "bun:test";
import { epicPathFor, isMenuStale, planRuns } from "./press-core.ts";
import { stateHash } from "./gather.ts";
import { MENU_CACHE_VERSION, type Action, type MenuCache } from "./menu.ts";
import type { Budget } from "../budget/budget.ts";

// T-003-04 press core: the PURE helpers. Imports ONLY press-core.ts (+ pure peers) —
// never decompose-epic.ts's value side — so this test loads no BAML native addon, the
// same discipline decompose-epic-core.test / gates.test follow.

const B: Budget = { timeMs: 7_200_000, tokens: 50_000 };
const OVERRIDE: Budget = { timeMs: 1000, tokens: 2000 };

function action(id: string, overrides: Partial<Action> = {}): Action {
  return { id, title: id.toLowerCase(), tier: "high", readiness: "ready", budget: B, ...overrides };
}

/** Build a MenuCache whose stateHash is the REAL hash of the given inputs — so tests
 *  assert the rehash-and-compare contract, not a frozen hex literal. */
function cacheOf(demand: string, lisa: string, all: boolean, actions: Action[]): MenuCache {
  return {
    version: MENU_CACHE_VERSION,
    generatedAt: "2026-06-18T00:00:00.000Z",
    stateHash: stateHash({ demand, lisa, all }),
    all,
    actions,
  };
}

describe("epicPathFor", () => {
  test("derives <root>/docs/active/epic/<id>.md", () => {
    expect(epicPathFor("/r", "E-003")).toBe("/r/docs/active/epic/E-003.md");
  });
  test("handles a nested root", () => {
    expect(epicPathFor("/a/b/c", "E-012")).toBe("/a/b/c/docs/active/epic/E-012.md");
  });
});

describe("isMenuStale", () => {
  const cache = cacheOf("DEMAND", "LISA", false, [action("E-002")]);

  test("fresh inputs reproducing the stamped hash → not stale", () => {
    expect(isMenuStale(cache, { demand: "DEMAND", lisa: "LISA" }, false)).toBe(false);
  });
  test("changed demand → stale", () => {
    expect(isMenuStale(cache, { demand: "DEMAND-edited", lisa: "LISA" }, false)).toBe(true);
  });
  test("changed lisa → stale", () => {
    expect(isMenuStale(cache, { demand: "DEMAND", lisa: "LISA-edited" }, false)).toBe(true);
  });
  test("mode mismatch (cache all:false, press all:true) → stale via the fold", () => {
    expect(isMenuStale(cache, { demand: "DEMAND", lisa: "LISA" }, true)).toBe(true);
  });
  test("matching mode for an all:true cache → not stale", () => {
    const allCache = cacheOf("DEMAND", "LISA", true, [action("E-002")]);
    expect(isMenuStale(allCache, { demand: "DEMAND", lisa: "LISA" }, true)).toBe(false);
  });
  test("schema-version drift → stale regardless of hash", () => {
    const old = { ...cache, version: (MENU_CACHE_VERSION + 1) as typeof MENU_CACHE_VERSION };
    expect(isMenuStale(old, { demand: "DEMAND", lisa: "LISA" }, false)).toBe(true);
  });
});

describe("planRuns", () => {
  const actions = [action("E-001"), action("E-002"), action("E-003", { budget: { timeMs: 5, tokens: 6 } })];
  const cache = cacheOf("d", "l", false, actions);

  test("resolves indices to ids/epicPaths in order, default budget = action budget", () => {
    const runs = planRuns(cache, [1, 3], "/r");
    expect(runs).toEqual([
      { id: "E-001", epicPath: "/r/docs/active/epic/E-001.md", budget: B },
      { id: "E-003", epicPath: "/r/docs/active/epic/E-003.md", budget: { timeMs: 5, tokens: 6 } },
    ]);
  });
  test("override budget supersedes every pick's warranted envelope", () => {
    const runs = planRuns(cache, [1, 2, 3], "/r", OVERRIDE);
    expect(runs.map((r) => r.budget)).toEqual([OVERRIDE, OVERRIDE, OVERRIDE]);
  });
  test("does not mutate the input indices or cache actions", () => {
    const indices = Object.freeze([2]);
    expect(() => planRuns(cache, indices, "/r")).not.toThrow();
    expect(actions[1]).toEqual(action("E-002")); // cache action untouched
  });
});
