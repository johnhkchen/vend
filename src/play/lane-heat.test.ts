import { describe, expect, test } from "bun:test";
import {
  HOT_LANE_RATIO,
  LANE_HEAT_WINDOW,
  inferDefaultSeat,
} from "./lane-heat.ts";
import { KNOWN_SEATS, type AgentSeat } from "./agent-seat.ts";
import {
  buildRunRecord,
  totalTokens,
  type RunRecord,
  type UsageInput,
} from "../log/run-log.ts";

// Pure fixtures only: no ledger fs, clock, executor, or addon. Deriving the test lanes from
// KNOWN_SEATS makes the registry the same source of truth exercised by the production reader.
const [FIRST, SECOND] = KNOWN_SEATS;
if (FIRST === undefined || SECOND === undefined) {
  throw new Error("lane-heat tests require at least two KNOWN_SEATS");
}

let sequence = 0;

function record(
  seatOfExecution: string | undefined,
  usage: UsageInput,
): RunRecord {
  sequence += 1;
  return buildRunRecord({
    runId: "heat-" + String(sequence),
    play: "decompose-epic",
    epic: "E-HEAT",
    model: "fixture",
    outcome: "success",
    usage,
    ...(seatOfExecution === undefined ? {} : { seatOfExecution }),
    startedAt: "2026-07-12T00:00:00.000Z",
    endedAt: "2026-07-12T00:00:01.000Z",
  });
}

function inputBurn(seat: AgentSeat, tokens: number): RunRecord {
  return record(seat, { input_tokens: tokens });
}

const QUOTA_BASE = Date.parse("2026-07-13T00:00:00.000Z");
const CAP_MARKER = {
  signal: "http-429",
  reason: "provider reset-window capacity exhausted",
} as const;

function quotaRecord(
  seatOfExecution: AgentSeat,
  minute: number,
  usage: UsageInput = {},
  capped = false,
): RunRecord {
  sequence += 1;
  const endedAt = new Date(QUOTA_BASE + minute * 60_000).toISOString();
  return buildRunRecord({
    runId: "quota-heat-" + String(sequence),
    play: "decompose-epic",
    epic: "E-QUOTA-HEAT",
    model: "fixture",
    outcome: capped ? "errored" : "success",
    usage,
    seatOfExecution,
    ...(capped ? { capWindowExhausted: CAP_MARKER } : {}),
    startedAt: endedAt,
    endedAt,
  });
}

function learnedQuotaRecords(
  firstCapacity: number,
  firstCurrent: number,
  secondCapacity: number,
  secondCurrent: number,
): readonly RunRecord[] {
  return [
    quotaRecord(FIRST, 0, {}, true),
    quotaRecord(SECOND, 0, {}, true),
    quotaRecord(FIRST, 100, { input_tokens: firstCapacity }, true),
    quotaRecord(SECOND, 100, { input_tokens: secondCapacity }, true),
    quotaRecord(FIRST, 200, { input_tokens: firstCurrent }),
    quotaRecord(SECOND, 200, { input_tokens: secondCurrent }),
  ];
}

describe("inferDefaultSeat — relative recent lane heat", () => {
  test("a clearly hot lane returns the cooler known seat plus a heat reason", () => {
    const result = inferDefaultSeat([
      inputBurn(FIRST, 200),
      inputBurn(FIRST, 100),
      inputBurn(SECOND, 100),
    ]);

    expect(result?.seat).toBe(SECOND);
    expect(result?.reason).toContain("recent cost-weighted burn");
    expect(result?.reason).toContain(FIRST + "=300");
    expect(result?.reason).toContain(SECOND + "=100");
    expect(result?.reason).toContain("3x hotter");
  });

  test("ranking is symmetric when the other known lane is clearly hot", () => {
    expect(
      inferDefaultSeat([
        inputBurn(FIRST, 50),
        inputBurn(SECOND, 50 * HOT_LANE_RATIO),
      ])?.seat,
    ).toBe(FIRST);
  });

  test("both active lanes read cool when neither decisively dominates", () => {
    expect(
      inferDefaultSeat([
        inputBurn(FIRST, 150),
        inputBurn(SECOND, 100),
      ]),
    ).toBeNull();
  });

  test("tied positive burn returns null", () => {
    expect(
      inferDefaultSeat([
        inputBurn(FIRST, 100),
        inputBurn(SECOND, 100),
      ]),
    ).toBeNull();
  });

  test("an empty ledger returns null", () => {
    expect(inferDefaultSeat([])).toBeNull();
  });

  test("unattributed and unknown raw seats do not become known-lane heat", () => {
    expect(
      inferDefaultSeat([
        record(undefined, { input_tokens: 10_000 }),
        record("future-lane/raw", { output_tokens: 10_000 }),
      ]),
    ).toBeNull();
  });
});

describe("inferDefaultSeat — canonical inputs", () => {
  test("uses run-log totalTokens cost weighting rather than raw token parity", () => {
    // FIRST has more raw tokens (100 vs 50). Cost weighting makes SECOND hotter:
    // 50 output tokens cost 250 input-token equivalents, a decisive 2.5x imbalance.
    const first = record(FIRST, { input_tokens: 100 });
    const second = record(SECOND, { output_tokens: 50 });

    expect(totalTokens(first)).toBe(100);
    expect(totalTokens(second)).toBe(250);
    expect(inferDefaultSeat([first, second])?.seat).toBe(FIRST);
  });

  test("only the bounded recent ledger tail contributes", () => {
    const oldHot = inputBurn(FIRST, 1_000_000);
    const recentBalanced = Array.from({ length: LANE_HEAT_WINDOW }, (_, index) =>
      inputBurn(index % 2 === 0 ? FIRST : SECOND, 10),
    );

    expect(inferDefaultSeat([oldHot, ...recentBalanced])).toBeNull();
  });

  test("KNOWN_SEATS values drive both aggregation and the returned AgentSeat", () => {
    const result = inferDefaultSeat([
      inputBurn(KNOWN_SEATS[0], 0),
      inputBurn(KNOWN_SEATS[1], 1),
    ]);

    expect(result).not.toBeNull();
    expect(result?.seat).toBe(KNOWN_SEATS[0]);
    expect(KNOWN_SEATS).toContain(result!.seat);
  });
});

describe("inferDefaultSeat — learned quota-fraction heat", () => {
  test("quota fraction outranks raw burn and renders stable learned-window evidence", () => {
    // Raw burn is FIRST=185 vs SECOND=1,200, which would route to FIRST. Learned fractions are
    // FIRST=85/100=85% vs SECOND=200/1,000=20%, so quota headroom routes to SECOND.
    const result = inferDefaultSeat(learnedQuotaRecords(100, 85, 1_000, 200));

    expect(result).toEqual({
      seat: SECOND,
      reason:
        "learned quota fraction: " + FIRST + " at ~85% of learned window; " +
        SECOND + " at ~20% of learned window; routing to " + SECOND,
    });
    expect(result?.reason).toContain(FIRST + " at ~85% of learned window");
    expect(Object.isFrozen(result)).toBe(true);
  });

  test("quota ranking is symmetric when the other lane has more learned headroom", () => {
    expect(inferDefaultSeat(learnedQuotaRecords(1_000, 100, 100, 80))?.seat).toBe(FIRST);
  });

  test("equal learned fractions stay unrouted even when absolute burn differs", () => {
    // Both are at 50%, while raw ledger burn differs by 10x.
    expect(inferDefaultSeat(learnedQuotaRecords(100, 50, 1_000, 500))).toBeNull();
  });

  test("one unlearned lane preserves the exact relative-burn fallback", () => {
    const result = inferDefaultSeat([
      quotaRecord(FIRST, 0, {}, true),
      quotaRecord(FIRST, 100, { input_tokens: 300 }, true),
      inputBurn(SECOND, 100),
    ]);

    expect(result).toEqual({
      seat: SECOND,
      reason:
        "recent cost-weighted burn (last 100 records): " + FIRST + "=300 vs " +
        SECOND + "=100; 3x hotter",
    });
  });

  test("over-cap fractions remain unclamped for ranking and provenance", () => {
    const result = inferDefaultSeat(learnedQuotaRecords(100, 120, 100, 100));

    expect(result?.seat).toBe(SECOND);
    expect(result?.reason).toContain(FIRST + " at ~120% of learned window");
    expect(result?.reason).toContain(SECOND + " at ~100% of learned window");
  });
});
