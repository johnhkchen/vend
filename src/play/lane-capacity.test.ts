import { describe, expect, test } from "bun:test";
import { learnLaneCapacities } from "./lane-capacity.ts";
import { KNOWN_SEATS, type AgentSeat } from "./agent-seat.ts";
import {
  buildRunRecord,
  type RunRecord,
  type UsageInput,
} from "../log/run-log.ts";

// Fabricated normalized ledger values only: no fs, current clock, executor, or provider.
const [FIRST, SECOND] = KNOWN_SEATS;
if (FIRST === undefined || SECOND === undefined) {
  throw new Error("lane-capacity tests require at least two KNOWN_SEATS");
}

const CAP_MARKER = {
  signal: "http-429",
  reason: "provider reset-window capacity exhausted",
} as const;

const BASE = Date.parse("2026-07-13T00:00:00.000Z");
let sequence = 0;

function atMinute(minute: number): string {
  return new Date(BASE + minute * 60_000).toISOString();
}

function record(
  seatOfExecution: string | undefined,
  minute: number,
  usage: UsageInput = {},
  capped = false,
): RunRecord {
  sequence += 1;
  const endedAt = atMinute(minute);
  return buildRunRecord({
    runId: "capacity-" + String(sequence),
    play: "decompose-epic",
    epic: "E-CAPACITY",
    model: "fixture",
    outcome: capped ? "errored" : "success",
    usage,
    ...(seatOfExecution === undefined ? {} : { seatOfExecution }),
    ...(capped ? { capWindowExhausted: CAP_MARKER } : {}),
    startedAt: endedAt,
    endedAt,
  });
}

function forSeat(records: readonly RunRecord[], seat: AgentSeat) {
  return learnLaneCapacities(records).find((capacity) => capacity.seat === seat)!;
}

describe("learnLaneCapacities — cap-marked ledger acceptance", () => {
  test("each lane exposes hand-computed window capacity and current quota fraction", () => {
    const records = [
      // Deliberately not chronological: the pure learner must order timestamp evidence itself.
      record(FIRST, 10, { output_tokens: 120 }, true), // 600; closes FIRST's 1,000 window
      record(SECOND, 25, { input_tokens: 500 }),
      record(FIRST, 0, { input_tokens: 100 }, true), // boundary burn excluded from next window
      record(SECOND, 10, { output_tokens: 200 }), // 1,000
      record(FIRST, 5, { input_tokens: 400 }),
      record(SECOND, 20, { input_tokens: 1_000 }, true), // closes SECOND's 2,000 window
      record(SECOND, 0, { input_tokens: 100 }, true),
      record(FIRST, 25, { input_tokens: 250 }),
      record(FIRST, 30, { output_tokens: 50 }), // 250; shared ledger as-of minute 30
    ];

    expect(forSeat(records, FIRST)).toEqual({
      seat: FIRST,
      status: "learned",
      windowMs: 10 * 60_000,
      windowCapacity: 1_000,
      currentBurn: 500,
      quotaFraction: 0.5,
      samples: 1,
    });
    expect(forSeat(records, SECOND)).toEqual({
      seat: SECOND,
      status: "learned",
      windowMs: 20 * 60_000,
      windowCapacity: 2_000,
      currentBurn: 1_500,
      quotaFraction: 0.75,
      samples: 1,
    });
  });

  test("multiple intervals average cadence and canonical cost-weighted burn", () => {
    const records = [
      record(FIRST, 30, { input_tokens: 300 }, true),
      record(FIRST, 0, {}, true),
      record(FIRST, 20, { cache_creation_input_tokens: 80 }), // 100 weighted
      record(FIRST, 10, { input_tokens: 100 }, true),
      record(FIRST, 5, { output_tokens: 20 }), // 100 weighted
    ];

    // Samples: (0,10] = 200 over 10m; (10,30] = 400 over 20m.
    expect(forSeat(records, FIRST)).toEqual({
      seat: FIRST,
      status: "learned",
      windowMs: 15 * 60_000,
      windowCapacity: 300,
      currentBurn: 400,
      quotaFraction: 4 / 3,
      samples: 2,
    });
  });
});

describe("learnLaneCapacities — honest unlearned branches", () => {
  test("a lane with no cap evidence is explicit unlearned and carries no numbers", () => {
    const capacities = learnLaneCapacities([
      record(FIRST, 1, { input_tokens: 10_000 }),
      record(SECOND, 2, { output_tokens: 10_000 }),
    ]);

    expect(capacities).toEqual(
      KNOWN_SEATS.map((seat) => ({
        seat,
        status: "unlearned",
        reason: "insufficient-cap-evidence",
      })),
    );
    for (const capacity of capacities) {
      expect("windowCapacity" in capacity).toBe(false);
      expect("quotaFraction" in capacity).toBe(false);
    }
  });

  test("one cap cannot invent cadence, and zero observed burn cannot become a denominator", () => {
    expect(forSeat([record(FIRST, 0, { input_tokens: 100 }, true)], FIRST)).toEqual({
      seat: FIRST,
      status: "unlearned",
      reason: "insufficient-cap-evidence",
    });

    expect(
      forSeat([
        record(FIRST, 0, {}, true),
        record(FIRST, 10, {}, true),
      ], FIRST),
    ).toEqual({
      seat: FIRST,
      status: "unlearned",
      reason: "non-positive-capacity",
    });
  });

  test("equal or invalid cap times cannot create a reset-window sample", () => {
    const invalid = buildRunRecord({
      runId: "capacity-invalid-time",
      play: "decompose-epic",
      epic: "E-CAPACITY",
      model: "fixture",
      outcome: "errored",
      usage: { input_tokens: 1_000 },
      seatOfExecution: FIRST,
      capWindowExhausted: CAP_MARKER,
      startedAt: "not-a-time",
      endedAt: "not-a-time",
    });

    expect(
      forSeat([
        record(FIRST, 10, { input_tokens: 100 }, true),
        record(FIRST, 10, { input_tokens: 100 }, true),
        invalid,
      ], FIRST),
    ).toEqual({
      seat: FIRST,
      status: "unlearned",
      reason: "insufficient-cap-evidence",
    });
  });
});

describe("learnLaneCapacities — canonical lanes and immutable values", () => {
  test("unknown raw seats never become output lanes or known-lane burn", () => {
    const capacities = learnLaneCapacities([
      record("future-lane/raw", 0, { input_tokens: 1_000 }, true),
      record("future-lane/raw", 10, { input_tokens: 1_000 }, true),
    ]);

    expect(capacities.map(({ seat }) => seat)).toEqual([...KNOWN_SEATS]);
    expect(capacities.every(({ status }) => status === "unlearned")).toBe(true);
  });

  test("timestamp sorting leaves caller order untouched and returns frozen canonical results", () => {
    const later = record(FIRST, 10, { input_tokens: 100 }, true);
    const earlier = record(FIRST, 0, {}, true);
    const records = [later, earlier];
    const originalIds = records.map(({ runId }) => runId);

    const capacities = learnLaneCapacities(records);

    expect(records.map(({ runId }) => runId)).toEqual(originalIds);
    expect(capacities.map(({ seat }) => seat)).toEqual([...KNOWN_SEATS]);
    expect(Object.isFrozen(capacities)).toBe(true);
    expect(capacities.every(Object.isFrozen)).toBe(true);
    expect(forSeat(records, FIRST)).toMatchObject({
      status: "learned",
      windowCapacity: 100,
      quotaFraction: 1,
    });
  });
});
