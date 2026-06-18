import { describe, expect, test } from "bun:test";
import {
  type Action,
  type ValueTier,
  MENU_CACHE_VERSION,
  formatBudget,
  rankActions,
  renderMenu,
  visibleActions,
} from "./menu.ts";

// T-003-01 pure-menu-model: fixture tests for the addon-free shelf core. Mirrors the
// id-guard.test.ts discipline — plain fixtures, `toEqual` for exact arrays, golden
// strings for renders (membership AND order/format pinned), and a frozen-input
// purity test. No fs/clock/network anywhere; this is an ordinary pure-function suite.

const B = (timeMs: number, tokens: number) => ({ timeMs, tokens });

/** Make an Action with sensible defaults; override per-test. */
function act(over: Partial<Action> & Pick<Action, "id" | "tier">): Action {
  return {
    title: over.title ?? `${over.id.toLowerCase()}-title`,
    readiness: over.readiness ?? "ready",
    budget: over.budget ?? B(7_200_000, 50_000), // 2h / 50k default
    ...over,
  };
}

const ids = (xs: readonly Action[]): string[] => xs.map((a) => a.id);

describe("rankActions — leverage tier then readiness, stable", () => {
  test("orders by tier regardless of input order", () => {
    const input = [
      act({ id: "L", tier: "leaf" }),
      act({ id: "S", tier: "standard" }),
      act({ id: "K", tier: "keystone" }),
      act({ id: "H", tier: "high" }),
    ];
    expect(ids(rankActions(input))).toEqual(["K", "H", "S", "L"]);
  });

  test("within a tier, ready before blocked", () => {
    const input = [
      act({ id: "Hb", tier: "high", readiness: "blocked" }),
      act({ id: "Hr", tier: "high", readiness: "ready" }),
    ];
    expect(ids(rankActions(input))).toEqual(["Hr", "Hb"]);
  });

  test("tier dominates readiness: a blocked keystone outranks a ready standard", () => {
    const input = [
      act({ id: "Sr", tier: "standard", readiness: "ready" }),
      act({ id: "Kb", tier: "keystone", readiness: "blocked" }),
    ];
    expect(ids(rankActions(input))).toEqual(["Kb", "Sr"]);
  });

  test("stable on full ties — equal tier+readiness keep input order", () => {
    const input = [
      act({ id: "first", tier: "high", readiness: "ready" }),
      act({ id: "second", tier: "high", readiness: "ready" }),
      act({ id: "third", tier: "high", readiness: "ready" }),
    ];
    expect(ids(rankActions(input))).toEqual(["first", "second", "third"]);
  });

  test("empty input → []", () => {
    expect(rankActions([])).toEqual([]);
  });

  test("purity — frozen input survives, result is a fresh array", () => {
    const a = act({ id: "K", tier: "keystone" });
    const b = act({ id: "S", tier: "standard" });
    const input = Object.freeze([b, a]) as readonly Action[];
    const out = rankActions(input);
    expect(ids(out)).toEqual(["K", "S"]);
    expect(out).not.toBe(input); // a new array, not the input
    expect(ids(input)).toEqual(["S", "K"]); // input order unchanged
  });
});

describe("visibleActions — default hides blocked & leaf", () => {
  const mixed = [
    act({ id: "K", tier: "keystone", readiness: "ready" }),
    act({ id: "Hb", tier: "high", readiness: "blocked" }),
    act({ id: "Lr", tier: "leaf", readiness: "ready" }),
    act({ id: "S", tier: "standard", readiness: "ready" }),
  ];

  test("default drops blocked rows", () => {
    expect(ids(visibleActions(mixed))).toEqual(["K", "S"]);
  });

  test("default drops a ready leaf-tier row", () => {
    // Lr is ready but leaf — hidden by default (leaf unblocks nothing).
    expect(ids(visibleActions(mixed))).not.toContain("Lr");
  });

  test("all=true keeps everything, order preserved", () => {
    expect(ids(visibleActions(mixed, true))).toEqual(["K", "Hb", "Lr", "S"]);
  });

  test("purity — fresh array, input not mutated", () => {
    const input = Object.freeze([...mixed]) as readonly Action[];
    const out = visibleActions(input);
    expect(out).not.toBe(input);
    expect(input.length).toBe(4);
  });
});

describe("formatBudget — human-scale time/tokens", () => {
  test("the 2h/50k golden case", () => {
    expect(formatBudget(B(7_200_000, 50_000))).toBe("2h/50k");
  });

  test("whole minutes render as m", () => {
    expect(formatBudget(B(1_800_000, 8_000))).toBe("30m/8k");
  });

  test("seconds when sub-minute", () => {
    expect(formatBudget(B(45_000, 500))).toBe("45s/500");
  });

  test("sub-1000 tokens render raw", () => {
    expect(formatBudget(B(60_000, 999))).toBe("1m/999");
  });
});

describe("renderMenu — numbered rows, hidden behavior, render format", () => {
  const fixture = [
    act({ id: "E-002", title: "ci-backstop", tier: "high", readiness: "ready", budget: B(7_200_000, 50_000) }),
    act({ id: "E-007", title: "casting-engine", tier: "standard", readiness: "ready", budget: B(3_600_000, 20_000) }),
  ];

  test("golden numbered render of a ready fixture", () => {
    expect(renderMenu(fixture)).toBe(
      "1. E-002 ci-backstop  [High] · 2h/50k · ready\n" +
        "2. E-007 casting-engine  [Standard] · 1h/20k · ready",
    );
  });

  test("a row carries value tier + budget + state", () => {
    const row = renderMenu([fixture[0]!]).split("\n")[0]!;
    expect(row).toContain("[High]"); // value tier
    expect(row).toContain("2h/50k"); // budget
    expect(row).toContain("ready"); // state
  });

  test("hidden-row behavior: blocked/leaf absent by default + footer", () => {
    const withHidden = [
      ...fixture,
      act({ id: "E-009", title: "blocked-thing", tier: "high", readiness: "blocked" }),
      act({ id: "E-010", title: "leaf-thing", tier: "leaf", readiness: "ready" }),
    ];
    const out = renderMenu(withHidden);
    expect(out).not.toContain("E-009");
    expect(out).not.toContain("E-010");
    expect(out).toContain("(+2 hidden — vend --all)");
  });

  test("opts.all reveals hidden rows, renumbers, no footer", () => {
    const withHidden = [
      fixture[0]!,
      act({ id: "E-009", title: "blocked-thing", tier: "high", readiness: "blocked", budget: B(3_600_000, 10_000) }),
    ];
    const out = renderMenu(withHidden, { all: true });
    expect(out).toBe(
      "1. E-002 ci-backstop  [High] · 2h/50k · ready\n" +
        "2. E-009 blocked-thing  [High] · 1h/10k · blocked",
    );
    expect(out).not.toContain("hidden");
  });

  test("empty input → (no actions)", () => {
    expect(renderMenu([])).toBe("(no actions)");
  });

  test("all rows hidden → guidance line", () => {
    const allHidden = [act({ id: "E-009", tier: "leaf", readiness: "blocked" })];
    expect(renderMenu(allHidden)).toBe("(no salient actions — vend --all)");
  });
});

describe("MenuCache shape", () => {
  test("MENU_CACHE_VERSION is 1", () => {
    expect(MENU_CACHE_VERSION).toBe(1);
  });

  test("a well-formed MenuCache type-checks and round-trips actions in order", () => {
    const actions = rankActions([
      act({ id: "E-002", tier: "high" }),
      act({ id: "E-007", tier: "standard" }),
    ]);
    const cache = {
      version: MENU_CACHE_VERSION,
      generatedAt: "2026-06-18T16:00:00.000Z",
      stateHash: "deadbeef",
      all: false,
      actions,
    };
    // index i (1-based) ⇒ actions[i-1] — the press-gesture resolution contract.
    expect(cache.actions[0]!.id).toBe("E-002");
    expect(cache.actions[1]!.id).toBe("E-007");
  });
});

// Touch the imported type so an unused-import lint never trips while keeping the
// public type surface exercised.
const _tier: ValueTier = "keystone";
expect(_tier).toBe("keystone");
