import { describe, expect, test } from "bun:test";
import type { Budget } from "../budget/budget.ts";
import type { Card, Play } from "../engine/play.ts";
import { buildRunRecord, type RunRecord } from "../log/run-log.ts";
import { fundingWarningFor, withFundingCounter } from "./funding-counter.ts";

// Addon-free fixtures: a plain Play stub plus pure run-record construction. No concrete
// play, dispatcher, executor, or BAML client is imported into this test process.
const budget = (tokens: number, timeMs = 60_000): Budget => ({ tokens, timeMs });

function stubPlay(name = "steer"): Play<unknown, unknown> {
  const card: Card = { color: ["blue", "green"], type: "permanent", rarity: "rare" };
  return {
    name,
    summary: "read the project and propose a course-correction",
    render: () => "",
    parse: () => ({}),
    gates: () => ({ status: "clear" }),
    effect: async () => ({ ok: true }),
    budget: budget(400_000, 2_400_000),
    card,
  };
}

function success(play: string, tokens: number, n: number): RunRecord {
  const startedAt = `2026-07-12T00:00:0${n}.000Z`;
  return buildRunRecord({
    runId: `run-${n}`,
    play,
    epic: "steer of vend",
    model: "fixture",
    outcome: "success",
    usage: { input_tokens: tokens },
    startedAt,
    endedAt: new Date(Date.parse(startedAt) + 60_000).toISOString(),
  });
}

const measured400k = [success("steer", 400_000, 1), success("steer", 400_000, 2), success("steer", 400_000, 3)];

describe("fundingWarningFor — measured provenance only", () => {
  test("returns the settled field-report warning for 12.5k funded vs a 400k measured floor", () => {
    expect(fundingWarningFor(stubPlay(), budget(12_500), measured400k)).toBe(
      "⚠ underfunded: 12.5k tokens funded vs 400k measured floor; proceeding with funded budget",
    );
  });

  test("is silent for a cold-start play with no records", () => {
    expect(fundingWarningFor(stubPlay(), budget(12_500), [])).toBeNull();
  });

  test("is silent below the three-success measurement threshold", () => {
    expect(fundingWarningFor(stubPlay(), budget(12_500), measured400k.slice(0, 2))).toBeNull();
  });

  test("is silent when measured funding is adequate", () => {
    expect(fundingWarningFor(stubPlay(), budget(400_000), measured400k)).toBeNull();
  });

  test("isolates calibration by play name", () => {
    expect(fundingWarningFor(stubPlay("survey"), budget(12_500), measured400k)).toBeNull();
  });
});

describe("withFundingCounter — warn before dispatch, never block", () => {
  test("writes the warning before dispatch and returns the dispatch result unchanged", async () => {
    const events: string[] = [];
    const funded = budget(12_500);
    const result = await withFundingCounter(
      stubPlay(),
      funded,
      async () => {
        events.push("dispatch");
        expect(funded).toEqual(budget(12_500));
        return { kind: "ran" as const, id: "field-report" };
      },
      { records: measured400k, write: (text) => events.push(`write:${text}`) },
    );

    expect(events).toEqual([
      "write:⚠ underfunded: 12.5k tokens funded vs 400k measured floor; proceeding with funded budget\n",
      "dispatch",
    ]);
    expect(result).toEqual({ kind: "ran", id: "field-report" });
  });

  test("cold start writes zero bytes and still dispatches", async () => {
    const writes: string[] = [];
    let dispatched = 0;
    await withFundingCounter(
      stubPlay(),
      budget(12_500),
      async () => {
        dispatched += 1;
      },
      { records: [], write: (text) => writes.push(text) },
    );
    expect(writes).toEqual([]);
    expect(dispatched).toBe(1);
  });

  test("adequate measured funding writes zero bytes and still dispatches", async () => {
    const events: string[] = [];
    await withFundingCounter(
      stubPlay(),
      budget(400_000),
      async () => events.push("dispatch"),
      { records: measured400k, write: (text) => events.push(`write:${text}`) },
    );
    expect(events).toEqual(["dispatch"]);
  });
});
