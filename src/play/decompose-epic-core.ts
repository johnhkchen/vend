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
import type { PlayTools } from "../engine/play.ts";
import { AUTONOMOUS_DENY } from "./autonomous-deny.ts";

/**
 * Logged when no real model id was observed on the stream and the caller pinned
 * none; the seam omits `--model` in that case. Lives in the pure core (not the
 * impure orchestrator) so the fallback resolver below is testable without loading
 * the BAML addon; re-exported from decompose-epic.ts via its `export *`.
 */
export const DEFAULT_MODEL = "claude-cli-default";

/**
 * DecomposeEpic's WARRANTED DEFAULT agentic turn cap (T-015-02), set on
 * `decomposeEpicPlay.maxTurns` and resolved by the cast loop as
 * `resolveMaxTurns(opts.maxTurns, play.maxTurns)` (the per-cast override still wins).
 * Lives in the addon-free core so its value is unit-testable without loading BAML.
 *
 * JUDGMENT, not a frozen guess:
 *  - clean decompose runs land at 1–7 turns (live transcripts; `num_turns` 1,2,2,3,4,7);
 *  - the ~85–95k token tail (E-014's E2 probe, 2026-06-19) is agentic WANDERING, not input
 *    size — `claude -p` is the full agent (A2's tiny fixture once burned 119k);
 *  - 15 ≈ 2× the observed clean-run ceiling — generous enough that no legitimate run is cut
 *    off (a false andon is worse than one tail through — the ticket's tie-breaker; AC4),
 *    tight enough to bound the unbounded wander behind the tail (AC3).
 *
 * It is a SEED, not a constant frozen forever: `turnsUsed` is now logged on every run
 * (T-015-02 AC2), so a later iteration replaces 15 with a p95-of-clean number read from the
 * ledger (the E-014 / IA-14 measure-then-tighten discipline). See work/T-015-02/design.md D2.
 */
export const DECOMPOSE_MAX_TURNS = 15;

/**
 * DecomposeEpic's per-play TOOL declaration (E-032, T-032-02) — set on `decomposeEpicPlay.tools`
 * and resolved at cast by `resolveTools(play.tools, available)` against the project `.mcp.json`.
 * Lives in the addon-free core (the `DECOMPOSE_MAX_TURNS` precedent) so the live-proof argv test
 * reads it WITHOUT loading the BAML addon.
 *
 *  - `optionalMcp: ["codebase-memory-mcp"]` — the codebase-memory grounding server the E-031 tickets
 *    wired by hand into context. RECLASSIFIED from required to OPTIONAL (E-060 #3, T-060-01-01):
 *    present ⇒ the cast scopes exactly it in (byte-identical to the prior required behavior); ABSENT
 *    ⇒ the cast DEGRADES — it proceeds with the read-only built-ins below and flips the resolution's
 *    `reducedGrounding` flag rather than firing the missing-capability andon. The make-or-break
 *    steer→board path never needs the MCP, and requiring it raised fresh-seed onboarding friction
 *    against P2/P5, so a fresh seed without the server now clears with reduced grounding.
 *  - `allow: ["Read", "Grep", "Glob"]` — read-only built-ins. The decompose agent reasons by
 *    READING the board/epic/charter and searching the codebase ("go and see"); the play's WRITES
 *    are its own `effect` (materialize), not the agent's. Least privilege: read to reason, the
 *    harness writes.
 *  - `deny: AUTONOMOUS_DENY` (E-051) — make AskUserQuestion UNAVAILABLE: decompose is an autonomous
 *    cast run headless via `claude -p` with no answerer, and E-049 stalled when the agent improvised
 *    a mid-decompose question. The subtractive denylist rides alongside the strict allowlist above.
 */
export const DECOMPOSE_TOOLS: PlayTools = {
  optionalMcp: ["codebase-memory-mcp"],
  allow: ["Read", "Grep", "Glob"],
  deny: AUTONOMOUS_DENY,
};

/**
 * Pick the model id to stamp on the run log: the REAL id observed on the dispense
 * stream, else the caller's pinned id (`opts.model`), else the {@link DEFAULT_MODEL}
 * sentinel (T-005-01). PURE — the sentinel tail guarantees the non-empty string the
 * run log requires even on a timed-out run that returned no result.
 */
export function resolveLoggedModel(real: string | undefined, opt: string | undefined): string {
  return real ?? opt ?? DEFAULT_MODEL;
}

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
