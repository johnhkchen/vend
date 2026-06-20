// The SECOND executor (T-035-02): an OpenAI-compatible / local-model adapter behind the
// T-035-01 `Executor` interface. The universal shape open models expose — Ollama, llama.cpp,
// vLLM all speak `POST {base}/v1/chat/completions` with SSE streaming — so one adapter proves
// the interface + transport + token metering are pluggable without a Claude dependency.
//
// HONEST, NAMED, DEFERRED: this is a SINGLE-COMPLETION adapter. A `/chat/completions` call is
// one turn, not an agent loop — so the agentic options on `DispenseOptions` (`maxTurns`,
// `mcpConfig`, `allowedTools`, `strictMcp`) are IGNORED here (documented, not silently
// dropped), honoring the interface's "honor when able" contract. It works for CONTEXT-COMPLETE
// plays (the prompt carries its own context). Read-the-repo / run-tools plays need the
// downstream agentic open-model runner — out of scope for this slice. The live smoke against a
// real endpoint (env + a running Ollama) is the one deferred human step; the proof here is
// FIXTURE-BASED.
//
// Mirrors `claude.ts`'s purity split: PURE helpers (request build, SSE line parse, chunk
// adapt, usage map, stream consume, result synth) are unit-tested with fabricated inputs; the
// ONE impure verb (`dispenseOpenAICompat`, which does `fetch` + body streaming + the wall-clock
// latch) is NOT unit-tested — every byte it touches flows through the tested pure helpers,
// exactly as `dispense` is the seam's single untested function.

import { createLineBuffer } from "./claude.ts";
import { ExecutorTimeoutError } from "./executor.ts";
import type { DispenseOptions, Executor, ResultMessage, StreamMessage } from "./executor.ts";

// ── Config (env, local-first, no committed secret) ──────────────────────────────────

/** Env naming the OpenAI-compatible base URL. Default is a LOCAL Ollama endpoint. */
export const OPENAI_BASE_URL_ENV = "VEND_OPENAI_BASE_URL";
/** Env naming the model id (shared with any executor that pins a default model). */
export const OPENAI_MODEL_ENV = "VEND_EXECUTOR_MODEL";
/** Env naming an OPTIONAL bearer key — emitted only when set (most local endpoints need none). */
export const OPENAI_API_KEY_ENV = "VEND_OPENAI_API_KEY";
/** Default base URL: local Ollama. Local-first ⇒ a bare `bun` + a running Ollama needs no config. */
export const DEFAULT_OPENAI_BASE_URL = "http://localhost:11434/v1";
/** The stable selector id ({@link executorFor}) and run-log handle for this executor. */
export const OPENAI_EXECUTOR_ID = "openai-compat";

// ── Local structural types (external JSON — open records over the fields we read) ────

/** One OpenAI streaming chunk (`object: "chat.completion.chunk"`). */
type OpenAIChunk = {
  model?: string;
  choices?: Array<{ delta?: { content?: string; role?: string }; finish_reason?: string | null }>;
  usage?: { prompt_tokens?: number; completion_tokens?: number; total_tokens?: number } | null;
};

/** The `/chat/completions` request body we build. */
interface ChatRequestBody {
  model?: string;
  messages: Array<{ role: "system" | "user"; content: string }>;
  stream: true;
  stream_options: { include_usage: true };
}

/** Accumulator the SSE consumer fills as frames arrive (the raw material for the result). */
interface SseState {
  /** Concatenated delta content → `ResultMessage.result`. */
  text: string;
  /** Last non-empty `chunk.model` — the REAL model id the endpoint served. */
  model?: string;
  /** The terminal `usage` block, when the endpoint emitted one. */
  usage?: OpenAIChunk["usage"];
  /** Last non-null `finish_reason` — carried onto the result as a passthrough field. */
  finishReason?: string;
  /** Count of payload chunks seen — the empty-stream guard (`0` ⇒ nothing was produced). */
  chunks: number;
}

/** Coerce a possibly-absent count to a finite number, defaulting to 0 (budget/run-log idiom,
 *  inlined to keep this module dependency-free of src/log and src/budget). */
function num(v: number | undefined): number {
  return typeof v === "number" && Number.isFinite(v) ? v : 0;
}

// ── Timeout latch error (the OpenAI-compat subclass of the generalized seam error) ──

/**
 * Raised when an OpenAI-compatible request exceeds its wall-clock budget and is aborted. A
 * SUBCLASS of {@link ExecutorTimeoutError} (code `ETIMEDOUT_OPENAI`) so `castPlay`'s timeout
 * `instanceof` keys on the base and classifies this as `timed-out` uniformly — the fetch
 * `AbortController` is the transport-native analog of Claude's SIGKILL-on-deadline.
 */
export class OpenAICompatTimeoutError extends ExecutorTimeoutError {
  override readonly code = "ETIMEDOUT_OPENAI";
  constructor(timeoutMs: number, url: string) {
    super(timeoutMs, `OpenAI-compatible request to ${url} exceeded ${timeoutMs}ms wall-clock and was aborted`);
    this.name = "OpenAICompatTimeoutError";
  }
}

// ── Pure helpers ────────────────────────────────────────────────────────────────────

/**
 * Build the `/chat/completions` request. PURE. The base URL comes from env (default local
 * Ollama), trailing slash trimmed so the path joins cleanly. The bearer header is emitted
 * ONLY when a key is configured (local endpoints need none — no committed secret). The model
 * is `opts.model` (the interface's pinned model) ?? the env default, omitted from the body
 * when neither is set (some endpoints serve a single model and ignore the field). A `system`
 * prompt becomes a leading system message; the prompt is the single user message. `stream` +
 * `stream_options.include_usage` ask the endpoint to emit the terminal `usage` block.
 */
export function buildChatRequest(
  opts: Pick<DispenseOptions, "prompt" | "system" | "model">,
  env: Record<string, string | undefined> = process.env,
): { url: string; headers: Record<string, string>; body: ChatRequestBody } {
  const base = (env[OPENAI_BASE_URL_ENV] || DEFAULT_OPENAI_BASE_URL).replace(/\/+$/, "");
  const url = `${base}/chat/completions`;

  const headers: Record<string, string> = { "Content-Type": "application/json" };
  const key = env[OPENAI_API_KEY_ENV];
  if (key) headers.Authorization = `Bearer ${key}`;

  const messages: ChatRequestBody["messages"] = [];
  if (opts.system) messages.push({ role: "system", content: opts.system });
  messages.push({ role: "user", content: opts.prompt });

  const model = opts.model ?? env[OPENAI_MODEL_ENV];
  const body: ChatRequestBody = {
    ...(model ? { model } : {}),
    messages,
    stream: true,
    stream_options: { include_usage: true },
  };
  return { url, headers, body };
}

/**
 * Parse one SSE line into a payload. PURE and TOTAL. Returns `null` for a blank line, a
 * non-`data:` line (SSE comments/event lines), or non-JSON noise — all tolerated/skipped. The
 * `data: [DONE]` terminator returns the `"[DONE]"` sentinel. Mirrors `parseStreamJsonLine`'s
 * "be total on noise" discipline, with the SSE `data:` framing on top.
 */
export function parseSseData(line: string): OpenAIChunk | "[DONE]" | null {
  const trimmed = line.trim();
  if (!trimmed || !trimmed.startsWith("data:")) return null;
  const payload = trimmed.slice("data:".length).trim();
  if (payload === "[DONE]") return "[DONE]";
  if (!payload) return null;
  try {
    return JSON.parse(payload) as OpenAIChunk;
  } catch {
    return null;
  }
}

/**
 * Adapt one chunk into a streamed {@link StreamMessage}, or `null` when it carries no content
 * to surface (a role-only opener, the empty finish frame, the usage-only chunk). PURE. A
 * content delta becomes a `type: "assistant"` message — `formatMessage` renders it as
 * `· assistant`, mirroring Claude's live line so the stdout + transcript surfaces are
 * identical downstream. The model rides along when the chunk named one.
 */
export function adaptChunk(chunk: OpenAIChunk): (StreamMessage & { text: string }) | null {
  const text = chunk.choices?.[0]?.delta?.content;
  if (typeof text !== "string" || text.length === 0) return null;
  return { type: "assistant", subtype: "delta", text, ...(chunk.model ? { model: chunk.model } : {}) };
}

/**
 * Map the API's `usage` block into the four-field {@link import("../log/run-log.ts").UsageInput}
 * shape the run-log / budget read (IA-8 — tokens are TRUTH FROM THE API, not a guess). PURE.
 * `prompt_tokens → input_tokens`, `completion_tokens → output_tokens`; an OpenAI-compatible
 * endpoint exposes no cache breakdown, so the cache counts are honest `0`s. `total_tokens`
 * then equals the sum the ledger already derives, so it is not stored separately.
 */
export function mapUsage(u: OpenAIChunk["usage"]): {
  input_tokens: number;
  output_tokens: number;
  cache_read_input_tokens: number;
  cache_creation_input_tokens: number;
} {
  return {
    input_tokens: num(u?.prompt_tokens),
    output_tokens: num(u?.completion_tokens),
    cache_read_input_tokens: 0,
    cache_creation_input_tokens: 0,
  };
}

/**
 * Compose {@link createLineBuffer} (reused verbatim — SSE frames ARE `\n`-terminated lines)
 * with {@link parseSseData} into the canonical SSE routing: per line, skip `[DONE]`/noise;
 * for a chunk capture the model / usage / finish_reason, count it, adapt it to a
 * `StreamMessage` streamed to `onMessage` IN ORDER, and append its text. PURE — this is
 * exactly what {@link dispenseOpenAICompat} feeds bytes into, so testing it (via a recorded
 * fixture) tests the real parse/route/capture path with no fetch.
 */
export function makeSseConsumer(onMessage?: (msg: StreamMessage) => void): {
  buffer: ReturnType<typeof createLineBuffer>;
  state: SseState;
} {
  const state: SseState = { text: "", chunks: 0 };
  const buffer = createLineBuffer((line) => {
    const parsed = parseSseData(line);
    if (parsed === null || parsed === "[DONE]") return;
    state.chunks++;
    if (parsed.model) state.model = parsed.model;
    if (parsed.usage) state.usage = parsed.usage;
    const finish = parsed.choices?.[0]?.finish_reason;
    if (typeof finish === "string" && finish) state.finishReason = finish;
    const msg = adaptChunk(parsed);
    if (msg) {
      onMessage?.(msg);
      state.text += msg.text;
    }
  });
  return { buffer, state };
}

/**
 * Synthesize the terminal {@link ResultMessage} the pipeline consumes. PURE. Returns `null`
 * when the stream produced NOTHING (no chunks and no usage) — the caller throws on that, like
 * Claude's "produced no result". Otherwise it stamps the metered `usage` (mapped from the API),
 * the full completion `text` as `result`, the REAL model id (the stream's, else the configured
 * fallback), `subtype: "success"`, and the `finish_reason` as a passthrough field. No
 * `total_cost_usd`: an OpenAI-compat endpoint reports no dollar cost — tokens + wall-clock are
 * the two honest denominations, and the field defaults to 0 downstream.
 */
export function synthesizeResult(state: SseState, fallbackModel?: string): ResultMessage | null {
  if (state.chunks === 0 && !state.usage) return null;
  const model = state.model ?? fallbackModel;
  return {
    type: "result",
    subtype: "success",
    result: state.text,
    usage: mapUsage(state.usage),
    ...(model ? { model } : {}),
    ...(state.finishReason ? { finish_reason: state.finishReason } : {}),
  };
}

// ── The impure verb (NOT unit-tested — its byte-handling is the pure helpers above) ──

/**
 * Dispense one prompt to an OpenAI-compatible endpoint and return the terminal `result`. LIVE
 * (a real `fetch`). Builds the streaming request, arms a wall-clock {@link AbortController}
 * latch (`timeoutMs` ≤ 0 / undefined ⇒ no timer — behaviour identical to an un-timed call),
 * streams the SSE body through {@link makeSseConsumer} so every delta reaches `onMessage` in
 * order, and synthesizes the metered result. A non-OK HTTP status or a missing body is a REAL
 * failure (thrown, rethrown by `castPlay`); an abort is the typed timeout; a genuinely empty
 * stream throws "produced no result", like Claude's seam.
 */
export async function dispenseOpenAICompat(
  opts: DispenseOptions,
  env: Record<string, string | undefined> = process.env,
): Promise<ResultMessage> {
  const { url, headers, body } = buildChatRequest(opts, env);
  const { buffer, state } = makeSseConsumer(opts.onMessage);

  const controller = new AbortController();
  const timeoutMs = opts.timeoutMs;
  let timedOut = false;
  const timer =
    timeoutMs && timeoutMs > 0
      ? setTimeout(() => {
          timedOut = true;
          controller.abort();
        }, timeoutMs)
      : null;

  try {
    const res = await fetch(url, {
      method: "POST",
      headers,
      body: JSON.stringify(body),
      signal: controller.signal,
    });
    if (!res.ok) {
      const detail = (await res.text().catch(() => "")).trim();
      throw new Error(`OpenAI-compatible request to ${url} failed: HTTP ${res.status}${detail ? `\n${detail}` : ""}`);
    }
    if (!res.body) throw new Error(`OpenAI-compatible request to ${url} returned no response body`);

    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      if (value) buffer.push(decoder.decode(value, { stream: true }));
    }
    buffer.flush(); // flush a final unterminated frame, if any
  } catch (e) {
    if (timedOut || (e as Error)?.name === "AbortError") {
      throw new OpenAICompatTimeoutError(timeoutMs ?? 0, url);
    }
    throw e instanceof Error ? e : new Error(`OpenAI-compatible request to ${url} failed: ${String(e)}`);
  } finally {
    if (timer) clearTimeout(timer);
  }

  const result = synthesizeResult(state, opts.model ?? env[OPENAI_MODEL_ENV]);
  if (result === null) {
    throw new Error(`OpenAI-compatible request to ${url} produced no result (empty stream)`);
  }
  return result;
}

/**
 * The second {@link Executor} (T-035-02): an OpenAI-compatible / local-model adapter. A pure
 * DELEGATE over {@link dispenseOpenAICompat}, selectable via `VEND_EXECUTOR=openai-compat`
 * through `executorFor`. It IGNORES the agentic options (a completion is not an agent —
 * documented above), honoring the interface's "honor when able" contract.
 */
export class OpenAICompatExecutor implements Executor {
  readonly id = OPENAI_EXECUTOR_ID;
  dispense(opts: DispenseOptions): Promise<ResultMessage> {
    return dispenseOpenAICompat(opts);
  }
}
