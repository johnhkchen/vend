// Cross-review routing (S-073-01): resolve the OTHER configured executor seat from the
// lane that authored a run. This module owns workflow policy while reusing the two existing
// sources of truth: cast-core's executor-id -> seat projection and executor/select's lazy
// registry/factory seam. It never dispenses, reads env, or knows a concrete transport.

import { resolveSeatOfExecution } from "../engine/cast-core.ts";
import type { Executor } from "../executor/executor.ts";
import { builtinExecutors, executorFor, type ExecutorRegistry } from "../executor/select.ts";
import type { AgentSeat } from "../play/agent-seat.ts";

/** The complement lane together with the invokable executor configured for that lane. */
export interface ComplementExecutor {
  readonly seat: AgentSeat;
  readonly executor: Executor;
}

/**
 * Resolve the sole configured seat other than `seatOfExecution` and construct its executor.
 *
 * The registry is the configured capability set. Executor ids become seats only through
 * {@link resolveSeatOfExecution}; unknown ids cannot honestly participate in cross-review.
 * The authoring seat must itself be configured, and there must be exactly one different seat.
 * Any absent, stale, incomplete, or future-ambiguous configuration returns `null`, leaving
 * cross-review inert rather than guessing.
 *
 * Passing `{}` as executorFor's env is deliberate: the complement id is an explicit routing
 * decision and must not be influenced by the process-wide default executor selector.
 */
export function resolveComplementExecutor(
  seatOfExecution: string | undefined,
  registry: ExecutorRegistry = builtinExecutors,
): ComplementExecutor | null {
  const configured = new Map<AgentSeat, string>();
  for (const executorId of Object.keys(registry)) {
    const seat = resolveSeatOfExecution(executorId);
    if (seat !== undefined) configured.set(seat, executorId);
  }

  const authoringSeat = [...configured.keys()].find((seat) => seat === seatOfExecution);
  if (authoringSeat === undefined) return null;

  const complements = [...configured].filter(([seat]) => seat !== authoringSeat);
  if (complements.length !== 1) return null;

  const complement = complements[0];
  if (complement === undefined) return null;
  const [seat, executorId] = complement;
  return {
    seat,
    executor: executorFor({ executor: executorId }, {}, registry),
  };
}
