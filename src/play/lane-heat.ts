// Pure lane-heat reader (T-071-02-01, T-082-02-02) — infer a default routing seat
// from local ledger evidence without loading the ledger or inventing provider quota facts.
//
// Complete learned reset-window facts rank lanes by current quota fraction. Until every known
// lane has that denominator, the append-ordered record tail retains E-071's byte-compatible
// relative-burn fallback.

import { totalTokens, type RunRecord } from "../log/run-log.ts";
import { KNOWN_SEATS, type AgentSeat } from "./agent-seat.ts";
import {
  learnLaneCapacities,
  type LaneCapacity,
  type LearnedLaneCapacity,
} from "./lane-capacity.ts";

/** Number of append-ordered ledger records considered recent. Mirrors the repository's
 * established bounded-tail recency convention without claiming a provider reset duration. */
export const LANE_HEAT_WINDOW = 100;

/** Minimum hottest:coolest burn multiple that counts as decisive relative heat.
 * Smaller differences remain unrouted: the current substrate cannot distinguish them
 * from ordinary measurement variation or prove either lane is near an absolute quota. */
export const HOT_LANE_RATIO = 2;

/** A conservative inferred default plus the ledger evidence suitable for provenance. */
export interface InferredSeat {
  readonly seat: AgentSeat;
  readonly reason: string;
}

interface LaneBurn {
  readonly seat: AgentSeat;
  burn: number;
}

/** Render a stable evidence string while keeping fractional cost-weighted burn honest. */
function heatReason(hottest: LaneBurn, coolest: LaneBurn): string {
  const comparison =
    coolest.burn === 0
      ? "positive burn vs zero"
      : String(hottest.burn / coolest.burn) + "x hotter";
  return (
    "recent cost-weighted burn (last " + String(LANE_HEAT_WINDOW) + " records): " +
    hottest.seat + "=" + String(hottest.burn) + " vs " +
    coolest.seat + "=" + String(coolest.burn) + "; " + comparison
  );
}

/** E-071's byte-compatible fallback over relative recent cost-weighted burn. */
function inferByRelativeBurn(records: readonly RunRecord[]): InferredSeat | null {
  const burns: LaneBurn[] = KNOWN_SEATS.map((seat) => ({ seat, burn: 0 }));

  for (const record of records.slice(-LANE_HEAT_WINDOW)) {
    const lane = burns.find(({ seat }) => seat === record.seatOfExecution);
    if (lane !== undefined) lane.burn += totalTokens(record);
  }

  if (burns.length < 2) return null;

  const ranked = burns.slice().sort((a, b) => a.burn - b.burn);
  const coolest = ranked[0]!;
  const hottest = ranked[ranked.length - 1]!;

  // All-zero and exact ties contain no routing evidence. With future 3+ seat registries,
  // require both extrema to be unique rather than selecting an incidental registry order.
  if (hottest.burn === 0 || hottest.burn === coolest.burn) return null;
  if (ranked[1]!.burn === coolest.burn) return null;
  if (ranked[ranked.length - 2]!.burn === hottest.burn) return null;

  if (hottest.burn < coolest.burn * HOT_LANE_RATIO) return null;

  return Object.freeze({ seat: coolest.seat, reason: heatReason(hottest, coolest) });
}

function isLearned(capacity: LaneCapacity): capacity is LearnedLaneCapacity {
  return capacity.status === "learned";
}

/** Stable, locale-independent display only; the ranking retains the unclamped fraction. */
function quotaPercentage(quotaFraction: number): string {
  return String(Math.round(quotaFraction * 100));
}

function quotaReason(
  capacities: readonly LearnedLaneCapacity[],
  selected: AgentSeat,
): string {
  const evidence = capacities.map(({ seat, quotaFraction }) =>
    seat + " at ~" + quotaPercentage(quotaFraction) + "% of learned window"
  ).join("; ");
  return "learned quota fraction: " + evidence + "; routing to " + selected;
}

/** Choose the unique known lane with the most learned reset-window headroom. */
function inferByQuotaFraction(
  capacities: readonly LearnedLaneCapacity[],
): InferredSeat | null {
  if (capacities.length < 2) return null;

  const ranked = capacities.slice().sort((a, b) => a.quotaFraction - b.quotaFraction);
  const coolest = ranked[0]!;

  // Registry order must never break an equal-headroom tie. A unique minimum is sufficient:
  // hotter lanes may tie without making the coolest routing choice ambiguous.
  if (ranked[1]!.quotaFraction === coolest.quotaFraction) return null;

  return Object.freeze({
    seat: coolest.seat,
    reason: quotaReason(capacities, coolest.seat),
  });
}

/**
 * Infer the uniquely coolest known routing seat from local per-lane ledger evidence.
 *
 * PURE/TOTAL — callers supply already-loaded records; this function uses no fs, current clock,
 * executor, or mutable shared state. When every known lane has learned reset-window capacity,
 * the unique lowest current quota fraction wins. If any lane is unlearned, the function preserves
 * E-071's relative recent-burn policy and exact provenance bytes rather than inventing a quota.
 *
 * Records with absent or currently unknown raw seatOfExecution values do not contribute to known
 * lanes. The registry and cost definition remain single-sourced through KNOWN_SEATS and totalTokens.
 */
export function inferDefaultSeat(records: readonly RunRecord[]): InferredSeat | null {
  const capacities = learnLaneCapacities(records);
  if (!capacities.every(isLearned)) return inferByRelativeBurn(records);
  return inferByQuotaFraction(capacities);
}
