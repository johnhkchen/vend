// The generic cast loop's PURE decision core (T-007-02) — the play-agnostic mirror of
// src/play/decompose-epic-core.ts.
//
// Split out from cast.ts (the impure orchestrator) for the same reason the runner's core
// is split: cast.ts value-imports the executor seam (which spawns) and touches fs, so it
// is an impure verb. Keeping the JUDGMENT here — classify (the outcome decision), the
// gate-row translation, the two-surface stream formatter, the model resolver — lets
// cast-core.test.ts exercise it as an ordinary pure-function test. Every import is a
// TYPE (erased under verbatimModuleSyntax); no fs, clock, network, process, or native
// addon ever loads into the test process (the gates.test.ts / decompose-epic.test.ts
// discipline).
//
// WHY NOT REUSE decompose-epic-core.ts: that module lives in src/play/. The engine is the
// generic foundation a concrete play depends UP onto (T-007-03 makes decompose-epic.ts
// import castPlay), so an engine → play import would be a cycle. `classify` here also
// operates on the play-generic `GateVerdict` (gate: string, opaque on clear), NOT gates.ts's
// DecomposeEpic-bound `GateResult` — they are not assignable. So this core mirrors the
// runner's split and decision logic rather than importing it; `formatMessage` /
// `makeStreamSink` / `resolveLoggedModel` are re-implemented identically (already fully
// play-agnostic). A later kaizen can DRY the duplication once T-007-03 has fixed the
// dependency direction (play → engine).

import type { StreamMessage } from "../executor/claude.ts";
import type { BudgetOutcome } from "../budget/budget.ts";
import type { GateVerdict } from "./play.ts";
import type { GateResult as LogGate, RunOutcome } from "../log/run-log.ts";

/**
 * Logged when no real model id was observed on the stream and the caller pinned none
 * (the seam omits `--model` in that case). Lives in the pure core so the resolver below
 * is testable without the BAML addon. Mirrors decompose-epic-core's sentinel (T-005-01).
 */
export const DEFAULT_MODEL = "claude-cli-default";

/**
 * Pick the model id to stamp on the run log: the REAL id observed on the dispense stream,
 * else the caller's pinned id (`opts.model`), else the {@link DEFAULT_MODEL} sentinel.
 * PURE — the sentinel tail guarantees the non-empty string the run log requires even on a
 * timed-out run that returned no result.
 */
export function resolveLoggedModel(real: string | undefined, opt: string | undefined): string {
  return real ?? opt ?? DEFAULT_MODEL;
}

/** The inputs to the pure outcome decision (the play-generic analogue of the runner's). */
export interface ClassifyInput {
  /** The seam threw `ClaudeTimeoutError` (no result, nothing parsed/gated). */
  readonly timedOut: boolean;
  /** The token check after the seam returned; null when timed out. */
  readonly budgetOutcome: BudgetOutcome | null;
  /** The play's clearing verdict; null when the run never reached gating (timeout/exhausted). */
  readonly gateVerdict: GateVerdict | null;
}

/** The pure decision: the terminal outcome, whether to effect, the run-log gate rows. */
export interface Verdict {
  readonly outcome: RunOutcome;
  readonly materialize: boolean;
  readonly gateLog: readonly LogGate[];
}

/**
 * Translate a play's {@link GateVerdict} into run-log per-gate rows. A STOP → one failed
 * row naming the (real) gate/unit/reason the play reported. A CLEAR → `[]`: the
 * play-generic verdict is OPAQUE on clear (T-007-01 design D2 — `{status:"clear"}` carries
 * no list of cleared gate names, unlike gates.ts's `GateClear.cleared`), so the loop has no
 * gate names to record; the record's top-level `outcome: "success"` conveys the pass, and
 * fabricating a synthetic gate name the play never declared would be misleading data in an
 * append-only ledger. `null` (never gated) → `[]`.
 */
export function castGateRows(g: GateVerdict | null): readonly LogGate[] {
  if (g === null) return [];
  if (g.status === "stop") return [{ gate: g.gate, passed: false, detail: `${g.unit}: ${g.reason}` }];
  return [];
}

/**
 * Decide the run's outcome. PURE. First-match priority (mirrors the runner's `classify`): a
 * TIMEOUT or a BUDGET exhaustion outranks the gate verdict — a run that breached its budget
 * contract (charter P7) stops the line even if the output would have cleared. Materialize
 * ONLY on `success` (cleared, in-budget, returned).
 */
export function classify(i: ClassifyInput): Verdict {
  const gateLog = castGateRows(i.gateVerdict);
  if (i.timedOut) return { outcome: "timed-out", materialize: false, gateLog };
  if (i.budgetOutcome?.status === "exhausted") {
    return { outcome: "budget-exhausted", materialize: false, gateLog };
  }
  if (i.gateVerdict?.status === "stop") {
    return { outcome: "gate-failed", materialize: false, gateLog };
  }
  return { outcome: "success", materialize: true, gateLog };
}

/**
 * Format one stream-json message into a compact human line for the live surface. PURE and
 * TOTAL — never throws on an unknown `type` (the stream is external JSON; tolerate noise).
 * Keeps the line short: the full message goes to the transcript.
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
 * Build the seam's `onMessage` hook, fanning each message to BOTH surfaces (AC#1): a human
 * line to `write` (live stdout) and the raw JSON to `sink` (the durable per-run transcript).
 * PURE given its injected edges, so it is testable with a fake writer/sink — the edges (real
 * stdout / file append) are owned by the caller (cast.ts).
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
