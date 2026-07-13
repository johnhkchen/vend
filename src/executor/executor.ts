// The abstract executor seam (T-035-01) — the contract `castPlay` depends on, lifted out
// of the Claude implementation so a second executor (T-035-02, an OpenAI-compatible
// adapter) can slot in behind the SAME interface. This module is SEAM-FREE: it spawns
// nothing and value-imports nothing. Its only imports from `./claude.ts` are TYPE-ONLY
// (the transport shapes), which `verbatimModuleSyntax` erases — so there is no runtime
// edge back into `claude.ts`, and therefore no cycle when `claude.ts` (and `select.ts`)
// import values FROM here. Keeping the contract in its own module is the "first executor
// behind an interface" promise from docs/knowledge/vision.md + stack.md.

import type { DispenseOptions, ResultMessage } from "./claude.ts";

// Re-export the transport types from the seam module so adapters and consumers depend on
// THIS contract rather than reaching into the Claude implementation for them. Type-only
// re-exports ⇒ no runtime dependency is introduced.
export type { DispenseOptions, ResultMessage, StreamMessage } from "./claude.ts";

/**
 * Typed error raised when an executor exceeds its wall-clock budget and is aborted — the
 * GENERALIZED form of the Claude seam's `ClaudeTimeoutError` (T-035-01). A CLASS (not a
 * string sniff) so a caller can branch its degrade path on `instanceof` regardless of which
 * executor was running: `castPlay`'s timeout check keys on THIS base, so a Claude timeout
 * (the `ClaudeTimeoutError` subclass) and any future executor's timeout both classify as
 * `timed-out`. Carries the budget that was exceeded; `code` defaults to a generic sentinel
 * that a subclass may override (Claude keeps its historical `ETIMEDOUT_CLAUDE`).
 */
export class ExecutorTimeoutError extends Error {
  readonly code: string = "ETIMEDOUT_EXECUTOR";
  readonly timeoutMs: number;
  constructor(timeoutMs: number, message: string) {
    super(message);
    this.name = "ExecutorTimeoutError";
    this.timeoutMs = timeoutMs;
  }
}

/**
 * The shallow, unmetered answer to "can this executor dispense from this environment?".
 * Expected environment failures are returned data: callers can surface the named reason and
 * actionable hint without turning a preflight into a raw stack.
 */
export interface ExecutorProbeResult {
  readonly ok: boolean;
  readonly reason?: string;
  readonly hint?: string;
}

/**
 * An executor: the one boundary `castPlay` uses to turn a prompt into a metered
 * `ResultMessage`. Implementations dispense a prompt, stream every `StreamMessage` to
 * `opts.onMessage` IN ORDER (before any throw), and **throw {@link ExecutorTimeoutError}
 * on wall-clock timeout**. `id` is the stable handle the selector keys on and the run-log
 * records.
 *
 * The UNIVERSAL core every executor honors is `prompt` + `timeoutMs` + `onMessage` +
 * `model` → a metered `ResultMessage` (usage / cost). The AGENTIC options on
 * {@link DispenseOptions} (`maxTurns`, `mcpConfig`, `allowedTools`, `strictMcp`) are
 * **hints an executor honors WHEN IT CAN**: the Claude executor maps them to `claude -p`
 * flags; a non-agentic completion adapter (T-035-02) ignores them — documented, not
 * silently dropped. The transport surface (`DispenseOptions`/`ResultMessage`) is kept
 * deliberately identical to today's `dispense` so `ClaudeExecutor` is a pure delegate and
 * existing casts stay byte-identical.
 */
export interface Executor {
  /** Stable id for selection ({@link executorFor}) and the run-log record. */
  readonly id: string;
  /**
   * Check config/auth/endpoint reachability without dispensing or spending tokens. This is a
   * shallow capability probe, not proof of a live metered model turn.
   */
  probe(): Promise<ExecutorProbeResult>;
  /**
   * Dispense one prompt and return the terminal `result` message. Streams to
   * `opts.onMessage` in order; throws {@link ExecutorTimeoutError} if the wall-clock budget
   * (`opts.timeoutMs`) is exceeded.
   */
  dispense(opts: DispenseOptions): Promise<ResultMessage>;
}
