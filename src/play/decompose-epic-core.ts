// The DecomposeEpic runner's PURE decision core (T-002-03).
//
// Split out from decompose-epic.ts (the impure orchestrator) for ONE reason: the
// orchestrator value-imports `b` from baml_client/sync_client, which loads the BAML
// native addon. The addon's once-driven runtime reactor makes a `bun test` process
// flaky (memory 20213/20218). Keeping the runner's judgment in this baml-free module
// lets decompose-epic.test.ts exercise it as an ordinary pure-function test — no
// native addon ever loaded into the test process (the same discipline gates.test.ts
// and materialize.test.ts follow). Every import here is a TYPE, or a value from a
// pure module (`isStop` from gates.ts, which imports baml type-only).
//
// PURE: classify (the outcome decision), gateRowsFor (the GateResult translator),
// formatMessage + makeStreamSink (the two-surface stream formatter). No fs, clock,
// network, process, or native addon.

import type { StreamMessage } from "../executor/claude.ts";
import type { BudgetOutcome } from "../budget/budget.ts";
import { isStop, type GateResult } from "../gate/gates.ts";
import type { GateResult as LogGate, RunOutcome } from "../log/run-log.ts";

/** The inputs to the pure outcome decision. */
export interface ClassifyInput {
  /** The seam threw `ClaudeTimeoutError` (no result, nothing parsed/gated). */
  readonly timedOut: boolean;
  /** The token check after the seam returned; null when timed out. */
  readonly budgetOutcome: BudgetOutcome | null;
  /** The gate verdict; null when the run never reached gating (timeout/exhausted). */
  readonly gateResult: GateResult | null;
}

/** The pure decision: the terminal outcome, whether to materialize, the log rows. */
export interface Verdict {
  readonly outcome: RunOutcome;
  readonly materialize: boolean;
  readonly gateLog: readonly LogGate[];
}

/**
 * Translate a gate verdict into run-log per-gate rows (the two distinct `GateResult`
 * types — gates' whole-plan verdict vs. run-log's per-gate record — meet here;
 * T-002-02 handoff #1). A STOP → one failed row naming gate/unit/reason; a CLEAR →
 * one passed row per cleared gate; null (never gated) → `[]`.
 */
export function gateRowsFor(g: GateResult | null): readonly LogGate[] {
  if (g === null) return [];
  if (isStop(g)) return [{ gate: g.gate, passed: false, detail: `${g.unit}: ${g.reason}` }];
  return g.cleared.map((gate) => ({ gate, passed: true }));
}

/**
 * Decide the run's outcome. PURE. First-match priority (Design D2): a TIMEOUT or a
 * BUDGET exhaustion outranks the gate verdict — a run that breached its budget
 * contract (P7) stops the line even if the plan would have cleared. Materialize ONLY
 * on `success` (cleared, in-budget, returned).
 */
export function classify(i: ClassifyInput): Verdict {
  const gateLog = gateRowsFor(i.gateResult);
  if (i.timedOut) return { outcome: "timed-out", materialize: false, gateLog };
  if (i.budgetOutcome?.status === "exhausted") {
    return { outcome: "budget-exhausted", materialize: false, gateLog };
  }
  if (i.gateResult !== null && isStop(i.gateResult)) {
    return { outcome: "gate-failed", materialize: false, gateLog };
  }
  return { outcome: "success", materialize: true, gateLog };
}

/**
 * Format one stream-json message into a compact human line for the live surface.
 * PURE and TOTAL — never throws on an unknown `type` (the stream is external JSON;
 * tolerate noise). Keeps the line short: the full message goes to the transcript.
 */
export function formatMessage(msg: StreamMessage): string {
  const type = typeof msg.type === "string" ? msg.type : "?";
  if (type === "result") {
    const sub = typeof msg.subtype === "string" ? msg.subtype : "";
    return `· result${sub ? ` (${sub})` : ""}`;
  }
  if (type === "system") {
    const subtype = typeof msg.subtype === "string" ? msg.subtype : "";
    return `· system${subtype ? ` (${subtype})` : ""}`;
  }
  return `· ${type}`;
}

/**
 * Build the seam's `onMessage` hook, fanning each message to BOTH surfaces (AC#4):
 * a human line to `write` (live stdout) and the raw JSON to `sink` (the durable
 * per-run transcript). PURE given its injected edges, so it is testable with a fake
 * writer/sink — the edges (real stdout / file append) are owned by the caller.
 */
export function makeStreamSink(opts: {
  write: (line: string) => void;
  sink: (raw: string) => void;
}): (msg: StreamMessage) => void {
  return (msg) => {
    opts.write(formatMessage(msg));
    opts.sink(JSON.stringify(msg));
  };
}
