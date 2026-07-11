// Canonical Lisa executor-routing seats for board-writing gestures (T-069-01-01).
//
// This is deliberately NOT the Vend executor registry (`executor/select.ts`): seats are
// allocation metadata written onto tickets for Lisa to dispatch, while executors run Vend
// plays. PURE and addon-free — downstream effects import this contract without pulling in fs,
// BAML, or an executor implementation.

/** The complete executor-seat vocabulary accepted on newly minted ticket frontmatter. */
export const KNOWN_SEATS = ["claude", "codex"] as const;

/** A routing seat after it has been checked against {@link KNOWN_SEATS}. */
export type AgentSeat = (typeof KNOWN_SEATS)[number];

/**
 * Return `seat` when it is outside {@link KNOWN_SEATS}, otherwise `null`.
 *
 * Exact matching is intentional: seats are canonical identifiers, so case or whitespace
 * normalization would silently expand the contract. The oracle does not throw; the write-side
 * effect owns the typed andon and the before-any-write refusal.
 */
export function findUnknownSeat(seat: string): string | null {
  for (const known of KNOWN_SEATS) {
    if (seat === known) return null;
  }
  return seat;
}
