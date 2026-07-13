import { expect, test } from "bun:test";
import { ExecutorTimeoutError } from "./executor.ts";
import type { StreamMessage } from "./executor.ts";
import {
  adaptChunk,
  buildChatRequest,
  buildOpenAICompatProbeRequest,
  classifyOpenAICompatProbe,
  DEFAULT_OPENAI_BASE_URL,
  makeSseConsumer,
  mapUsage,
  OpenAICompatExecutor,
  OPENAI_COMPAT_PROBE_HINT,
  OpenAICompatTimeoutError,
  parseSseData,
  synthesizeResult,
} from "./openai-compat.ts";

// Unit tests for the PURE adapter helpers + the fixture-driven stream→result path (T-035-02).
// No live `fetch` anywhere — `dispenseOpenAICompat` (the one impure verb) is intentionally not
// unit-tested; its byte-handling is exactly these helpers, exercised here through a recorded SSE
// fixture (free, deterministic — no live model).

// ── dispensability probe (injected facts; no live fetch) ────────────────────

test("buildOpenAICompatProbeRequest: targets /models and carries optional bearer auth", () => {
  expect(buildOpenAICompatProbeRequest({ VEND_OPENAI_BASE_URL: "http://host:1/v1/" })).toEqual({
    url: "http://host:1/v1/models",
    headers: {},
  });
  expect(
    buildOpenAICompatProbeRequest({
      VEND_OPENAI_BASE_URL: "https://example.test/v1",
      VEND_OPENAI_API_KEY: "secret",
    }),
  ).toEqual({
    url: "https://example.test/v1/models",
    headers: { Authorization: "Bearer secret" },
  });
});

test("classifyOpenAICompatProbe: reachable endpoint/auth is dispensable", () => {
  expect(classifyOpenAICompatProbe({ reachable: true }, "http://host/v1/models")).toEqual({ ok: true });
});

test("classifyOpenAICompatProbe: rejected auth is a structured failure", () => {
  expect(classifyOpenAICompatProbe({ reachable: false, status: 401 }, "https://host/v1/models")).toEqual({
    ok: false,
    reason: "OpenAI-compatible endpoint https://host/v1/models rejected the probe (HTTP 401)",
    hint: OPENAI_COMPAT_PROBE_HINT,
  });
});

test("OpenAICompatExecutor.probe: classifies injected facts without fetching or dispensing", async () => {
  const readFacts = async () => ({
    endpoint: "http://host/v1/models",
    facts: { reachable: false as const, detail: "connection refused" },
  });
  const result = await new OpenAICompatExecutor(readFacts).probe();
  expect(result.ok).toBe(false);
  expect(result.reason).toContain("connection refused");
  expect(result.hint).toBe(OPENAI_COMPAT_PROBE_HINT);
});

// ── buildChatRequest ──────────────────────────────────────────────────────────

test("buildChatRequest: default base url, no key ⇒ no Authorization, prompt as user message", () => {
  const { url, headers, body } = buildChatRequest({ prompt: "hello" }, {});
  expect(url).toBe(`${DEFAULT_OPENAI_BASE_URL}/chat/completions`);
  expect(headers["Content-Type"]).toBe("application/json");
  expect(headers.Authorization).toBeUndefined();
  expect(body.messages).toEqual([{ role: "user", content: "hello" }]);
  expect(body.stream).toBe(true);
  expect(body.stream_options).toEqual({ include_usage: true });
  expect(body.model).toBeUndefined();
});

test("buildChatRequest: env base url is trailing-slash-trimmed and joined cleanly", () => {
  const { url } = buildChatRequest({ prompt: "x" }, { VEND_OPENAI_BASE_URL: "http://host:1/v1//" });
  expect(url).toBe("http://host:1/v1/chat/completions");
});

test("buildChatRequest: opt.model wins over env model", () => {
  const { body } = buildChatRequest({ prompt: "x", model: "llama3.1" }, { VEND_EXECUTOR_MODEL: "qwen2.5" });
  expect(body.model).toBe("llama3.1");
});

test("buildChatRequest: env model used when no opt model", () => {
  const { body } = buildChatRequest({ prompt: "x" }, { VEND_EXECUTOR_MODEL: "qwen2.5" });
  expect(body.model).toBe("qwen2.5");
});

test("buildChatRequest: system prompt becomes a leading system message", () => {
  const { body } = buildChatRequest({ prompt: "do it", system: "be terse" }, {});
  expect(body.messages).toEqual([
    { role: "system", content: "be terse" },
    { role: "user", content: "do it" },
  ]);
});

test("buildChatRequest: API key ⇒ Bearer Authorization header (only when set)", () => {
  const { headers } = buildChatRequest({ prompt: "x" }, { VEND_OPENAI_API_KEY: "sk-local" });
  expect(headers.Authorization).toBe("Bearer sk-local");
});

// ── parseSseData ──────────────────────────────────────────────────────────────

test("parseSseData: blank / non-data / comment lines ⇒ null (skipped)", () => {
  expect(parseSseData("")).toBeNull();
  expect(parseSseData("   ")).toBeNull();
  expect(parseSseData(": keep-alive comment")).toBeNull();
  expect(parseSseData("event: message")).toBeNull();
});

test("parseSseData: data: [DONE] ⇒ sentinel", () => {
  expect(parseSseData("data: [DONE]")).toBe("[DONE]");
});

test("parseSseData: valid data frame ⇒ parsed chunk", () => {
  const chunk = parseSseData('data: {"model":"m","choices":[{"delta":{"content":"hi"}}]}');
  expect(chunk).toEqual({ model: "m", choices: [{ delta: { content: "hi" } }] });
});

test("parseSseData: garbage JSON ⇒ null (tolerated)", () => {
  expect(parseSseData("data: {not json}")).toBeNull();
  expect(parseSseData("data:")).toBeNull();
});

// ── mapUsage ──────────────────────────────────────────────────────────────────

test("mapUsage: prompt→input, completion→output, caches zeroed", () => {
  expect(mapUsage({ prompt_tokens: 11, completion_tokens: 7, total_tokens: 18 })).toEqual({
    input_tokens: 11,
    output_tokens: 7,
    cache_read_input_tokens: 0,
    cache_creation_input_tokens: 0,
  });
});

test("mapUsage: absent / non-finite counts coerce to 0", () => {
  expect(mapUsage(undefined)).toEqual({
    input_tokens: 0,
    output_tokens: 0,
    cache_read_input_tokens: 0,
    cache_creation_input_tokens: 0,
  });
  expect(mapUsage({ prompt_tokens: Number.NaN }).input_tokens).toBe(0);
});

// ── adaptChunk ────────────────────────────────────────────────────────────────

test("adaptChunk: content delta ⇒ an assistant StreamMessage carrying the text + model", () => {
  expect(adaptChunk({ model: "m", choices: [{ delta: { content: "Hel" } }] })).toEqual({
    type: "assistant",
    subtype: "delta",
    text: "Hel",
    model: "m",
  });
});

test("adaptChunk: role-only / empty / usage-only chunks ⇒ null (not streamed)", () => {
  expect(adaptChunk({ choices: [{ delta: { role: "assistant" } }] })).toBeNull();
  expect(adaptChunk({ choices: [{ delta: {} }] })).toBeNull();
  expect(adaptChunk({ choices: [], usage: { prompt_tokens: 1 } })).toBeNull();
  expect(adaptChunk({})).toBeNull();
});

// ── Fixture: a recorded SSE stream → ordered messages + a metered result ─────────

/** A realistic Ollama/OpenAI SSE stream: role opener, two content deltas, a blank separator,
 *  a garbage line (tolerated), the finish frame, the terminal usage chunk, then [DONE]. */
const SSE_FIXTURE = [
  'data: {"model":"llama3.1","choices":[{"delta":{"role":"assistant"},"finish_reason":null}]}',
  "",
  'data: {"model":"llama3.1","choices":[{"delta":{"content":"Hello"},"finish_reason":null}]}',
  "",
  "data: {oops not json}",
  'data: {"model":"llama3.1","choices":[{"delta":{"content":", world"},"finish_reason":null}]}',
  "",
  'data: {"model":"llama3.1","choices":[{"delta":{},"finish_reason":"stop"}]}',
  'data: {"model":"llama3.1","choices":[],"usage":{"prompt_tokens":11,"completion_tokens":3,"total_tokens":14}}',
  "data: [DONE]",
  "",
].join("\n");

test("fixture: ordered StreamMessages reach onMessage and text accumulates", () => {
  const seen: StreamMessage[] = [];
  const { buffer, state } = makeSseConsumer((m) => seen.push(m));
  // push in two chunks to also prove chunk-boundary tolerance of the reused line buffer.
  const half = Math.floor(SSE_FIXTURE.length / 2);
  buffer.push(SSE_FIXTURE.slice(0, half));
  buffer.push(SSE_FIXTURE.slice(half));
  buffer.flush();

  // Only the two CONTENT deltas surfaced, in order — role/finish/usage/[DONE]/garbage skipped.
  expect(seen.map((m) => m.text)).toEqual(["Hello", ", world"]);
  expect(seen.every((m) => m.type === "assistant")).toBe(true);
  expect(state.text).toBe("Hello, world");
  expect(state.model).toBe("llama3.1");
  expect(state.finishReason).toBe("stop");
});

test("fixture: synthesizeResult yields a ResultMessage with API-mapped usage + real model", () => {
  const { buffer, state } = makeSseConsumer();
  buffer.push(SSE_FIXTURE);
  buffer.flush();

  const result = synthesizeResult(state, "fallback-model");
  expect(result).not.toBeNull();
  expect(result?.type).toBe("result");
  expect(result?.subtype).toBe("success");
  expect(result?.result).toBe("Hello, world");
  expect(result?.model).toBe("llama3.1"); // the stream's real id, not the fallback
  expect(result?.usage).toEqual({
    input_tokens: 11,
    output_tokens: 3,
    cache_read_input_tokens: 0,
    cache_creation_input_tokens: 0,
  });
  expect((result as { finish_reason?: string }).finish_reason).toBe("stop");
});

test("synthesizeResult: falls back to the configured model when the stream named none", () => {
  const { buffer, state } = makeSseConsumer();
  buffer.push('data: {"choices":[{"delta":{"content":"hi"}}]}\n');
  buffer.flush();
  expect(synthesizeResult(state, "fallback-model")?.model).toBe("fallback-model");
});

// ── Empty stream throws (via a null synth) ──────────────────────────────────────

test("synthesizeResult: an empty stream (no chunks, no usage) ⇒ null (caller throws)", () => {
  const { state } = makeSseConsumer();
  expect(synthesizeResult(state)).toBeNull();
});

// ── Timeout error generalization ────────────────────────────────────────────────

test("OpenAICompatTimeoutError is an ExecutorTimeoutError (castPlay keys on the base)", () => {
  const e = new OpenAICompatTimeoutError(500, "http://localhost:11434/v1/chat/completions");
  expect(e).toBeInstanceOf(ExecutorTimeoutError);
  expect(e).toBeInstanceOf(Error);
  expect(e.code).toBe("ETIMEDOUT_OPENAI");
  expect(e.timeoutMs).toBe(500);
  expect(e.name).toBe("OpenAICompatTimeoutError");
});
