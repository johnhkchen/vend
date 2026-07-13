// Pure lane-capacity learner (T-082-02-01) — turn local cap-window ledger evidence into
// a sourced per-lane reset-window capacity and current quota fraction.
//
// Adjacent, strictly time-ordered cap markers bound observed windows. Their duration and
// canonical cost-weighted burn are averaged; current burn uses the same learned duration
// ending at the ledger's latest valid event. No fs, current clock, provider lookup, or
// hard-coded quota participates. Where the records cannot prove a positive denominator,
// the result is explicitly unlearned and carries no numeric capacity fields.

import { totalTokens, type RunRecord } from "../log/run-log.ts";
import { KNOWN_SEATS, type AgentSeat } from "./agent-seat.ts";

/** A lane fact backed by one or more observed cap-to-cap windows. All burn values use
 * run-log's cost-weighted token-equivalent numeraire and remain unrounded. */
export interface LearnedLaneCapacity {
  readonly seat: AgentSeat;
  readonly status: "learned";
  /** Mean observed duration between adjacent cap markers. */
  readonly windowMs: number;
  /** Mean observed cost-weighted burn in those cap-to-cap windows. */
  readonly windowCapacity: number;
  /** Cost-weighted burn in `(ledgerAsOf - windowMs, ledgerAsOf]`. */
  readonly currentBurn: number;
  /** `currentBurn / windowCapacity`; deliberately not clamped at 1. */
  readonly quotaFraction: number;
  /** Number of adjacent positive-duration cap intervals backing the means. */
  readonly samples: number;
}

/** Why a known lane has no defensible numeric reset-window fact. */
export type UnlearnedLaneCapacityReason =
  | "insufficient-cap-evidence"
  | "non-positive-capacity";

/** Explicit honest-empty result. Numeric learned fields are absent, not zero/defaulted. */
export interface UnlearnedLaneCapacity {
  readonly seat: AgentSeat;
  readonly status: "unlearned";
  readonly reason: UnlearnedLaneCapacityReason;
}

export type LaneCapacity = LearnedLaneCapacity | UnlearnedLaneCapacity;

interface TimedRecord {
  readonly record: RunRecord;
  readonly at: number;
  readonly index: number;
}

interface WindowSample {
  readonly durationMs: number;
  readonly burn: number;
}

/** Build a time-ordered view without mutating the append-ordered caller input. Invalid
 * timestamps are unusable as cadence/window evidence and are therefore omitted. */
function timedRecords(records: readonly RunRecord[]): readonly TimedRecord[] {
  const timed: TimedRecord[] = [];
  for (const [index, record] of records.entries()) {
    const at = Date.parse(record.endedAt);
    if (Number.isFinite(at)) timed.push({ record, at, index });
  }
  return timed.sort((a, b) => a.at - b.at || a.index - b.index);
}

/** Sum one lane's burn in the half-open/closed interval `(lower, upper]`. The same
 * boundary ownership is used for learned samples and the current rolling numerator. */
function burnBetween(
  records: readonly TimedRecord[],
  lowerExclusive: number,
  upperInclusive: number,
): number {
  let burn = 0;
  for (const timed of records) {
    if (timed.at > lowerExclusive && timed.at <= upperInclusive) {
      burn += totalTokens(timed.record);
    }
  }
  return burn;
}

/** Each adjacent, positive-time cap pair is one directly observed reset-window sample.
 * The earlier cap is the exclusive boundary; the later cap row belongs to the window it
 * exhausted and is included in that window's burn. */
function windowSamples(records: readonly TimedRecord[]): readonly WindowSample[] {
  const caps = records.filter(({ record }) => record.capWindowExhausted !== undefined);
  const samples: WindowSample[] = [];

  for (let index = 1; index < caps.length; index += 1) {
    const previous = caps[index - 1]!;
    const current = caps[index]!;
    const durationMs = current.at - previous.at;
    if (durationMs <= 0) continue;
    samples.push({
      durationMs,
      burn: burnBetween(records, previous.at, current.at),
    });
  }

  return samples;
}

function mean(values: readonly number[]): number {
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function unlearned(
  seat: AgentSeat,
  reason: UnlearnedLaneCapacityReason,
): UnlearnedLaneCapacity {
  return Object.freeze({ seat, status: "unlearned", reason });
}

function learnLaneCapacity(
  seat: AgentSeat,
  records: readonly TimedRecord[],
  ledgerAsOf: number,
): LaneCapacity {
  const samples = windowSamples(records);
  if (samples.length === 0) return unlearned(seat, "insufficient-cap-evidence");

  const windowMs = mean(samples.map(({ durationMs }) => durationMs));
  const windowCapacity = mean(samples.map(({ burn }) => burn));
  if (!Number.isFinite(windowCapacity) || windowCapacity <= 0) {
    return unlearned(seat, "non-positive-capacity");
  }

  const currentBurn = burnBetween(records, ledgerAsOf - windowMs, ledgerAsOf);
  return Object.freeze({
    seat,
    status: "learned",
    windowMs,
    windowCapacity,
    currentBurn,
    quotaFraction: currentBurn / windowCapacity,
    samples: samples.length,
  });
}

/**
 * Learn a reset-window capacity fact for every canonical routing lane.
 *
 * PURE/TOTAL — callers supply already-loaded records. The global latest valid `endedAt`
 * is the common ledger-as-of point, so inactive lanes age against later local evidence
 * without consulting a wall clock. Raw unknown seats contribute no known-lane burn, while
 * their valid timestamps may advance that shared observation point. Output order follows
 * `KNOWN_SEATS`; both the array and its members are frozen.
 */
export function learnLaneCapacities(
  records: readonly RunRecord[],
): readonly LaneCapacity[] {
  const timed = timedRecords(records);
  const ledgerAsOf = timed.at(-1)?.at ?? 0;
  const capacities = KNOWN_SEATS.map((seat) =>
    learnLaneCapacity(
      seat,
      timed.filter(({ record }) => record.seatOfExecution === seat),
      ledgerAsOf,
    ),
  );
  return Object.freeze(capacities);
}
