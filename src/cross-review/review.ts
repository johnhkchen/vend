// Impure cross-review shell (S-073-01): hand a context-complete review prompt to the already
// resolved complement Executor, validate its terminal reply, and attach trusted seat provenance.

import type { ComplementExecutor } from "./resolve-complement.ts";
import {
  buildReviewPrompt,
  type CrossReviewVerdict,
  parseReviewVerdict,
  REVIEW_SYSTEM_PROMPT,
} from "./review-core.ts";

export interface DispenseReviewOptions {
  readonly reviewer: ComplementExecutor;
  /** Complete captured Git patch text. Loading an artifact reference belongs to the caller. */
  readonly capturedDiff: string;
  /** Acceptance criteria, gate results, or other authored review context. */
  readonly rubricContext: string;
  /** Optional wall-clock latch forwarded to the executor unchanged. */
  readonly timeoutMs?: number;
}

/** The complement replied, but did not provide the contracted pass/fail JSON value. */
export class CrossReviewResponseError extends Error {
  readonly executorId: string;

  constructor(executorId: string) {
    super(`Cross-review executor "${executorId}" returned no valid pass/fail verdict`);
    this.name = "CrossReviewResponseError";
    this.executorId = executorId;
  }
}

/** Dispense one adversarial review on the resolved complement seat and return its parsed verdict. */
export async function dispenseReviewVerdict({
  reviewer,
  capturedDiff,
  rubricContext,
  timeoutMs,
}: DispenseReviewOptions): Promise<CrossReviewVerdict> {
  const result = await reviewer.executor.dispense({
    prompt: buildReviewPrompt({ capturedDiff, rubricContext }),
    system: REVIEW_SYSTEM_PROMPT,
    maxTurns: 1,
    ...(timeoutMs !== undefined ? { timeoutMs } : {}),
  });

  const parsed = parseReviewVerdict(result.result ?? "");
  if (parsed === null) throw new CrossReviewResponseError(reviewer.executor.id);

  return parsed.verdict === "pass"
    ? { verdict: "pass", reviewingSeat: reviewer.seat }
    : { verdict: "fail", reviewingSeat: reviewer.seat, reason: parsed.reason };
}

