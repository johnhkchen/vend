// The single metered seam (T-001-02): dispense a prompt to Claude via the
// `claude -p` headless CLI, authenticated by the SUBSCRIPTION (not a metered API
// key). Spawns `claude -p --output-format stream-json --verbose`, writes the prompt
// to stdin, parses the newline-delimited stream-json messages, calls a caller hook
// per message in order (so a runner can log the transcript + per-turn usage), and
// returns the terminal `result` message (carrying `usage`, `total_cost_usd`,
// `subtype`).
//
// Ported from the proven pattern in mc-design-eval/src/sdk-binding.mjs — the
// spawn → stream → capture spine plus the wall-clock timeout latch
// (`awaitChildClose` / `ClaudeTimeoutError`). TEXT PATH ONLY: no image/multimodal,
// no schema-enforced output, no artifact re-validation (those are out of scope for
// this slice). The seam is BUDGET-AGNOSTIC (T-001-02 AC #4): it accepts `timeoutMs`
// as its one wall-clock guard but owns no token/cost budget — the runner (T-001-03)
// composes that and meters on the returned `result.usage` / `result.total_cost_usd`.
//
// Most of this module is PURE (arg building, stream-json line parsing, line
// buffering, message routing, the timeout latch) and is unit-tested with sample
// lines and a fake child — no live `claude` spawn. Only `dispense` spawns a process;
// it is the single untested function (mirrors the reference's test rule).

import { spawn } from "node:child_process";

/** The Claude headless CLI binary; overridable for tests / non-standard installs. */
export const CLAUDE_CLI = process.env.CLAUDE_CLI || "claude";

/** One parsed stream-json message. External JSON: a known `type` discriminant over an open record. */
export type StreamMessage = { type: string } & Record<string, unknown>;

/**
 * The terminal `result` message the CLI emits last. Carries the fields the runner
 * meters on. Other fields ride along in the open record (it extends StreamMessage).
 */
export type ResultMessage = StreamMessage & {
  type: "result";
  subtype: string;
  result?: string;
  usage?: Record<string, unknown>;
  total_cost_usd?: number;
  /**
   * Agentic turns the run took, carried on the terminal `result`. Typed here so a caller
   * can read it off the result without a cast (T-015-02 surfaces it on the run record and
   * the live line to calibrate the turn cap). Absent when the stream named none.
   */
  num_turns?: number;
  /**
   * The REAL model id observed on the dispense stream (the assistant message's
   * `message.model`, or the system/init message's top-level `model`) — NOT carried
   * by the terminal `result` itself, so {@link dispense} attaches it here. Absent
   * when the stream named no model (e.g. an early failure with no assistant turn).
   */
  model?: string;
};

/**
 * The minimal child-process surface {@link awaitChildClose} needs. A real
 * `node:child_process` ChildProcess satisfies it structurally, and so does a tiny
 * fake child (a callback registry + a `kill` spy) — which is what makes the timeout
 * latch unit-testable without spawning anything.
 */
export interface ChildLike {
  on(event: "error", cb: (err: Error) => void): unknown;
  on(event: "close", cb: (code: number | null) => void): unknown;
  // Widened to `string | number` so a real node `ChildProcess` (`NodeJS.Signals |
  // number`) is structurally assignable, while `"SIGKILL"` and a fake child's spy
  // both still satisfy it.
  kill(signal?: string | number): unknown;
}

/** Options for {@link dispense}. Text path only. */
export interface DispenseOptions {
  /** The prompt, written to the CLI's stdin. */
  prompt: string;
  /** Pinned model id → `--model`. Omitted ⇒ no flag ⇒ CLI default. */
  model?: string;
  /** Reasoning-effort level → `--effort`. Omitted ⇒ no flag. */
  effort?: string;
  /** Grounding/persona system prompt → `--system-prompt`. Omitted ⇒ no flag. */
  system?: string;
  /** Agentic turn cap → `--max-turns <n>`. Omitted ⇒ no flag ⇒ turns unbounded. */
  maxTurns?: number;
  /**
   * Called once per stream-json message in order, before any throw, so the runner
   * can capture the transcript and per-turn usage. Must not mutate the message.
   */
  onMessage?: (msg: StreamMessage) => void;
  /**
   * Wall-clock budget in ms. A non-returning child is SIGKILLed at this deadline and
   * the call rejects with {@link ClaudeTimeoutError}. Undefined / ≤ 0 ⇒ no timer.
   */
  timeoutMs?: number;
}

/**
 * Typed error raised when a `claude -p` child exceeds its wall-clock budget and is
 * killed. A CLASS (not a string sniff) so a caller can branch its degrade path
 * cleanly — `e.code === "ETIMEDOUT_CLAUDE"` distinguishes an infra hang from any
 * other failure. Carries the budget that was exceeded.
 */
export class ClaudeTimeoutError extends Error {
  readonly code = "ETIMEDOUT_CLAUDE";
  readonly timeoutMs: number;
  constructor(timeoutMs: number, cli: string) {
    super(`\`${cli} -p\` exceeded ${timeoutMs}ms wall-clock and was killed (non-returning subprocess)`);
    this.name = "ClaudeTimeoutError";
    this.timeoutMs = timeoutMs;
  }
}

/**
 * Build the `claude -p` argv for the text path. PURE. Base flags always present;
 * `--model`/`--effort`/`--system-prompt`/`--max-turns` are appended only when supplied
 * (omitting a flag leaves the CLI default path unchanged).
 *
 * Per-play tool scoping (E-032, T-032-01): `mcpConfig` → `--mcp-config <path>`,
 * `allowedTools` → `--allowedTools <comma-joined list>`, `strictMcp` → `--strict-mcp-config`
 * (flag spellings verified against `claude -p --help`; `--allowedTools` accepts a comma- or
 * space-separated list — we comma-join into ONE argv element so the variadic flag cannot
 * swallow a following flag). All three are appended after `--max-turns` and guarded so that
 * when none are supplied the argv is BYTE-IDENTICAL to before E-032 (the no-tools path; the
 * resolved values are threaded in at cast by T-032-02). An empty `allowedTools` array emits
 * no flag.
 */
export function buildArgs(
  {
    model,
    effort,
    system,
    maxTurns,
    mcpConfig,
    allowedTools,
    strictMcp,
  }: {
    model?: string;
    effort?: string;
    system?: string;
    maxTurns?: number;
    mcpConfig?: string;
    allowedTools?: readonly string[];
    strictMcp?: boolean;
  } = {},
): string[] {
  const args = ["-p", "--output-format", "stream-json", "--verbose"];
  if (model) args.push("--model", model);
  if (effort) args.push("--effort", String(effort));
  if (system) args.push("--system-prompt", system);
  if (maxTurns) args.push("--max-turns", String(maxTurns));
  if (mcpConfig) args.push("--mcp-config", mcpConfig);
  if (allowedTools && allowedTools.length > 0) args.push("--allowedTools", allowedTools.join(","));
  if (strictMcp) args.push("--strict-mcp-config");
  return args;
}

/**
 * Parse one stream-json line into a message. PURE. Trims, JSON-parses, and returns
 * `null` for a blank line or any non-JSON noise on the stream (tolerated, skipped).
 */
export function parseStreamJsonLine(line: string): StreamMessage | null {
  const trimmed = line.trim();
  if (!trimmed) return null;
  try {
    return JSON.parse(trimmed) as StreamMessage;
  } catch {
    return null;
  }
}

/**
 * Pull the REAL model id out of one stream message. PURE and TOTAL — never throws
 * on an unknown/odd `type` (the stream is external JSON; tolerate noise). The id
 * rides on the `assistant` message (nested `message.model` — the id that generated
 * the reply, preferred) and on the `system`/init message (top-level `model`); this
 * checks the nested shape first, then the top-level, and returns `undefined` for
 * neither / a non-string / an empty string. The terminal `result` does NOT carry it,
 * which is why the seam must harvest it off earlier messages.
 */
export function extractModelId(msg: StreamMessage): string | undefined {
  const inner = (msg as { message?: unknown }).message;
  if (inner && typeof inner === "object") {
    const m = (inner as { model?: unknown }).model;
    if (typeof m === "string" && m) return m;
  }
  const top = (msg as { model?: unknown }).model;
  if (typeof top === "string" && top) return top;
  return undefined;
}

/**
 * A newline splitter that tolerates chunk boundaries. PURE (closes over a buffer).
 * `push` appends a chunk and emits every complete `\n`-terminated line via `onLine`;
 * `flush` emits a final non-empty unterminated line (then clears the buffer).
 */
export function createLineBuffer(onLine: (line: string) => void): { push(chunk: string): void; flush(): void } {
  let buf = "";
  return {
    push(chunk: string): void {
      buf += chunk;
      let idx: number;
      while ((idx = buf.indexOf("\n")) >= 0) {
        onLine(buf.slice(0, idx));
        buf = buf.slice(idx + 1);
      }
    },
    flush(): void {
      if (buf.trim()) onLine(buf);
      buf = "";
    },
  };
}

/**
 * Compose {@link createLineBuffer} + {@link parseStreamJsonLine} into the canonical
 * routing the seam runs on every stdout chunk: parse each line, stream it to
 * `onMessage` IN ORDER, capture the terminal `result` message into `state`, and
 * capture the REAL model id ({@link extractModelId}) as it goes by — last non-empty
 * wins, so a later assistant id overrides an earlier system-init id and an absent
 * later id never clobbers an earlier capture. PURE — this is exactly what
 * {@link dispense} feeds bytes into, so testing it tests the real
 * parse/route/capture path without spawning.
 */
export function makeStreamConsumer(onMessage?: (msg: StreamMessage) => void): {
  buffer: ReturnType<typeof createLineBuffer>;
  state: { result: ResultMessage | null; model?: string };
} {
  const state: { result: ResultMessage | null; model?: string } = { result: null };
  const buffer = createLineBuffer((line) => {
    const msg = parseStreamJsonLine(line);
    if (!msg) return;
    onMessage?.(msg);
    const id = extractModelId(msg);
    if (id) state.model = id;
    if (msg.type === "result") state.result = msg as ResultMessage;
  });
  return { buffer, state };
}

/**
 * Await a spawned child's terminal event with an optional WALL-CLOCK timeout. The
 * latch: exactly one of {timeout, close, error} settles the promise, and the timer
 * is cleared on settle so it never dangles past the call. On timeout the child is
 * SIGKILLed and the promise rejects with {@link ClaudeTimeoutError}; `timeoutMs`
 * undefined / ≤ 0 ⇒ no timer ⇒ behaviour identical to an un-guarded spawn.
 * Dependency-free and typed against {@link ChildLike}, so it is UNIT-TESTABLE with a
 * fake child (no `claude` spawn, no live hang).
 */
export function awaitChildClose(
  child: ChildLike,
  { cli = CLAUDE_CLI, timeoutMs }: { cli?: string; timeoutMs?: number } = {},
): Promise<number | null> {
  return new Promise((resolve, reject) => {
    let settled = false;
    let timer: ReturnType<typeof setTimeout> | null = null;
    const settle = (action: () => void): void => {
      if (settled) return;
      settled = true;
      if (timer) clearTimeout(timer);
      action();
    };
    if (timeoutMs && timeoutMs > 0) {
      timer = setTimeout(() => {
        try {
          child.kill("SIGKILL");
        } catch {
          // a child that already exited / can't be signalled — the reject below still surfaces the timeout
        }
        settle(() => reject(new ClaudeTimeoutError(timeoutMs, cli)));
      }, timeoutMs);
    }
    child.on("error", (err) =>
      settle(() => reject(new Error(`failed to launch \`${cli} -p\` (${err.message}) — is it installed/logged in?`))),
    );
    child.on("close", (code) => settle(() => resolve(code)));
  });
}

/**
 * Dispense one prompt to Claude via the `claude -p` subscription shim and return the
 * terminal `result` message. LIVE and METERED (subscription credits). Not
 * unit-tested — the byte-handling it relies on lives in the PURE helpers above.
 *
 * Spawns the CLI (no shell), writes the prompt to stdin and closes it, streams every
 * stream-json message to `onMessage` in order, and returns the terminal `result`
 * (carrying `usage` / `total_cost_usd` / `subtype`). The result is returned for ANY
 * `subtype` — including error subtypes — so the caller can meter and branch on it;
 * only a genuinely absent terminal result (the process emitted none) throws.
 */
export async function dispense({ prompt, model, effort, system, maxTurns, onMessage, timeoutMs }: DispenseOptions): Promise<ResultMessage> {
  const args = buildArgs({ model, effort, system, maxTurns });
  const child = spawn(CLAUDE_CLI, args, { stdio: ["pipe", "pipe", "pipe"] });
  child.stdin?.end(prompt);

  const { buffer, state } = makeStreamConsumer(onMessage);
  let stderr = "";
  child.stdout?.on("data", (chunk) => buffer.push(chunk.toString()));
  child.stderr?.on("data", (chunk) => {
    stderr += chunk.toString();
  });

  const exitCode = await awaitChildClose(child, { timeoutMs });
  buffer.flush(); // flush a final unterminated line, if any

  if (state.result === null) {
    throw new Error(
      `\`${CLAUDE_CLI} -p\` produced no result message (exit ${exitCode})` +
        (stderr.trim() ? `:\n${stderr.trim()}` : ""),
    );
  }
  // Surface the real model id observed on the stream (system/assistant) on the
  // returned result — a fresh object so the by-reference message handed to
  // `onMessage` is never mutated. Only when the result didn't already carry one,
  // so a future CLI that stamps `model` on the terminal result wins untouched.
  if (state.result.model === undefined && state.model !== undefined) {
    state.result = { ...state.result, model: state.model };
  }
  return state.result;
}
