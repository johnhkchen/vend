// Pure lane-heat reader (T-071-02-01) — infer a default routing seat from recent,
// cost-weighted ledger burn without loading the ledger or inventing provider quota facts.
//
// The append-ordered record tail is the only sourced recency signal in this slice. Heat is
// RELATIVE: a lane must have decisively more observed burn than the coolest known alternative.
// Absolute reset-window quotas and cap/429 signals are deliberately deferred by S-071-02.

import { totalTokens, type RunRecord } from "../log/run-log.ts";
import { KNOWN_SEATS, type AgentSeat } from "./agent-seat.ts";

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

/**
 * Infer the uniquely coolest known routing seat from recent per-lane ledger burn.
 *
 * PURE/TOTAL — callers supply already-loaded records; this function uses no fs, clock,
 * executor, or mutable shared state. Records with absent or currently unknown raw
 * seatOfExecution values do not contribute. Both the lane vocabulary and the cost
 * definition remain single-sourced through KNOWN_SEATS and run-log's totalTokens.
 *
 * Returns null for an empty/unattributed ledger, tied lanes, an ambiguous coolest or
 * hottest lane, or a non-decisive imbalance. This keeps a both-cool mint unrouted.
 */
export function inferDefaultSeat(records: readonly RunRecord[]): InferredSeat | null {
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

