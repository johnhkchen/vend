import { describe, expect, test } from "bun:test";
import { buildRunRecord, type RunOutcome, type RunRecord, type RunRecordInput } from "../log/run-log.ts";
import type { Budget } from "../budget/budget.ts";
import type { Card, Play, Rarity } from "../engine/play.ts";
import { RARITY_TIER, shelfRows, tierForRarity } from "./shelf-row.ts";

// T-030-01 shelf-row core: the PURE worth + warranted-budget composition. No fs/clock/spawn
// and NO BAML — fixtures build Play STUBS directly (the play.test.ts precedent) and fabricate
// RunRecords via the exported pure writer (the recalibrate.test.ts precedent), so the suite
// stays addon-free. `recalibrate`'s own math is covered by recalibrate.test.ts; here we pin
// only the composition: tier-from-rarity, measured-vs-default confidence, cold-start-to-budget,
// and worth riding through verbatim.

/** A minimal, valid Play stub — no model call, no addon. Worth/budget/rarity overridable. */
const makeStubPlay = (
  name: string,
  over: { summary?: string; budget?: Budget; rarity?: Rarity } = {},
): Play<unknown, unknown> => {
  const { summary = `worth of ${name}`, budget = { timeMs: 1000, tokens: 1000 }, rarity = "rare" } = over;
  const card: Card = { color: ["blue"], type: "permanent", rarity };
  return {
    name,
    summary,
    render: () => "",
    parse: () => ({}),
    gates: () => ({ status: "clear" }),
    effect: async () => ({ ok: true }),
    budget,
    card,
  };
};

/** A run record for `play` with a chosen token total / wall-clock duration / outcome. */
const recordOf = (
  over: { play?: string; tokens?: number; durationMs?: number; outcome?: RunOutcome } & Partial<RunRecordInput> = {},
): RunRecord => {
  const { play = "p", tokens = 1000, durationMs = 60_000, outcome = "success", ...rest } = over;
  const start = "2026-06-18T00:00:00.000Z";
  const end = new Date(Date.parse(start) + durationMs).toISOString();
  return buildRunRecord({
    runId: "r",
    play,
    epic: "E-001",
    model: "m",
    outcome,
    usage: { input_tokens: tokens },
    startedAt: start,
    endedAt: end,
    ...rest,
  });
};

describe("tierForRarity / RARITY_TIER — the shelf-boundary mapping", () => {
  test("each rarity maps to its order-preserving tier", () => {
    expect(tierForRarity("mythic")).toBe("keystone");
    expect(tierForRarity("rare")).toBe("high");
    expect(tierForRarity("uncommon")).toBe("standard");
    expect(tierForRarity("common")).toBe("leaf");
  });

  test("RARITY_TIER covers all four rarities (no gaps)", () => {
    expect(Object.keys(RARITY_TIER).sort()).toEqual(["common", "mythic", "rare", "uncommon"]);
  });
});

describe("shelfRows — measured envelope when a play has history (AC #3a)", () => {
  // 5 successes for "alpha", tokens 1000·k for k=1..5 → a real sample to bound.
  const records = Array.from({ length: 5 }, (_, i) => recordOf({ play: "alpha", tokens: 1000 * (i + 1) }));

  test("a play with ≥ cold-start successes → measured + the success count", () => {
    const play = makeStubPlay("alpha", { rarity: "rare" }); // rare → high → p92
    const [row] = shelfRows([play], records);
    expect(row?.confidence).toEqual({ kind: "measured", runs: 5 });
    // p92 of 1000..5000 (nearest-rank ceil): ceil(0.92·5)-1 = 4 → 5000. Measured, not the prior.
    expect(row?.envelope.tokens).toBe(5000);
    expect(row?.envelope.tokens).not.toBe(play.budget.tokens);
  });

  test("rarity actually flows into the percentile — mythic (p95) vs common (p75) on the same sample", () => {
    const mythic = shelfRows([makeStubPlay("alpha", { rarity: "mythic" })], records)[0];
    const common = shelfRows([makeStubPlay("alpha", { rarity: "common" })], records)[0];
    // p95 → ceil(4.75)-1 = 4 → 5000 (fattest tail); p75 → ceil(3.75)-1 = 3 → 4000 (tighter).
    expect(mythic?.envelope.tokens).toBe(5000);
    expect(common?.envelope.tokens).toBe(4000);
  });
});

describe("shelfRows — cold-start default never dressed as measured (AC #3b, E-026)", () => {
  test("no records → default, envelope IS the play's authored budget verbatim", () => {
    const budget: Budget = { timeMs: 7_200_000, tokens: 120_000 };
    const play = makeStubPlay("beta", { budget });
    const [row] = shelfRows([play], []);
    expect(row?.confidence).toEqual({ kind: "default" });
    expect(row?.envelope).toEqual(budget);
  });

  test("below the cold-start threshold (2 successes) → still default, not measured", () => {
    const budget: Budget = { timeMs: 5000, tokens: 9999 };
    const records = [recordOf({ play: "beta", tokens: 100 }), recordOf({ play: "beta", tokens: 200 })];
    const [row] = shelfRows([makeStubPlay("beta", { budget })], records);
    expect(row?.confidence).toEqual({ kind: "default" });
    expect(row?.envelope).toEqual(budget);
  });
});

describe("shelfRows — worth, keys, order, and per-play isolation", () => {
  test("the row carries the play's worth and name verbatim", () => {
    const play = makeStubPlay("gamma", { summary: "read the project into a ranked demand board" });
    const [row] = shelfRows([play], []);
    expect(row?.name).toBe("gamma");
    expect(row?.summary).toBe("read the project into a ranked demand board");
  });

  test("one row per play, in input order; records for one play don't bleed into another's row", () => {
    const withHistory = Array.from({ length: 4 }, (_, i) => recordOf({ play: "alpha", tokens: 1000 * (i + 1) }));
    const plays = [makeStubPlay("alpha"), makeStubPlay("beta"), makeStubPlay("gamma")];
    const rows = shelfRows(plays, withHistory);
    expect(rows.map((r) => r.name)).toEqual(["alpha", "beta", "gamma"]);
    // alpha has history → measured; beta/gamma have none → default (no bleed-through).
    expect(rows[0]?.confidence.kind).toBe("measured");
    expect(rows[1]?.confidence).toEqual({ kind: "default" });
    expect(rows[2]?.confidence).toEqual({ kind: "default" });
  });

  test("empty plays → empty rows; inputs are not mutated", () => {
    const records = [recordOf()];
    expect(shelfRows([], records)).toEqual([]);
    expect(records.length).toBe(1);
  });
});
