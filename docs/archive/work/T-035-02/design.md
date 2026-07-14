# T-035-02 Design — openai-compatible-executor

Decisions, grounded in the research. One adapter module mirroring `claude.ts`'s purity split,
wired into the existing selector.

## D1 — Module placement: a single new `src/executor/openai-compat.ts`

**Decision.** All adapter code (env config, pure helpers, the one impure verb, the
`Executor` class) lives in one new file `src/executor/openai-compat.ts`, paralleling
`claude.ts`. The selector (`select.ts`) gains one registry entry.

**Why.** `claude.ts` is the proven precedent: env constants + pure helpers + one impure
`dispense` + an `Executor` delegate, all in one module. Symmetry makes the second executor
legible against the first. The seam (`executor.ts`) stays untouched — the contract is
already general (T-035-01 did that work).

**Rejected.** (a) Splitting pure/impure into two files — `claude.ts` keeps them together and
the file stays ~250 lines; no benefit. (b) Putting config in a shared `executor-config.ts` —
the two executors share no config keys (CLI binary vs HTTP base-url); premature.

## D2 — Purity split mirrors Claude: pure helpers + one impure fetch verb

**Decision.** Pure, unit-tested helpers do all byte/shape work:

- `buildChatRequest(opts, env)` → `{ url, headers, body }` (request construction)
- `parseSseData(line)` → `OpenAIChunk | "[DONE]" | null` (one SSE line → payload)
- `adaptChunk(chunk)` → `StreamMessage | null` (one chunk → a streamed message)
- `mapUsage(usage)` → the `UsageInput` four-field shape
- `makeSseConsumer(onMessage)` → `{ buffer, state }` (reuses `createLineBuffer`)
- `synthesizeResult(state, model)` → `ResultMessage | null`

One impure verb `dispenseOpenAICompat(opts, env)` does only `fetch` + body streaming +
the timeout latch, then composes the pure helpers. It is **not unit-tested** — exactly as
`dispense` isn't — because every byte it touches flows through the tested pure helpers.

**Why.** This is the house pattern (`claude.ts:18-20`, run-log's two faces). It makes the
fixture-based AC reachable: the SSE→`StreamMessage`s→`ResultMessage` path is provable by
feeding a recorded fixture through `makeSseConsumer` + `synthesizeResult`, with no fetch.

**Rejected.** Injecting a fake `fetch` to test `dispenseOpenAICompat` end-to-end — it would
re-test what the pure consumer already covers and couple the test to fetch mechanics. The
fixture-through-consumer proof is stronger and matches the ticket's "fixture-based" mandate.

## D3 — Reuse `createLineBuffer`; write an SSE-aware payload parser

**Decision.** Import `createLineBuffer` from `claude.ts` verbatim for chunk-boundary-tolerant
`\n` splitting. Write a new `parseSseData` for the SSE framing (`data:` prefix strip + the
`[DONE]` sentinel), delegating the JSON parse to the same tolerate-noise discipline as
`parseStreamJsonLine`.

**Why.** SSE frames ARE `\n`-terminated lines; the line buffer is transport-agnostic and
already proven. Only the per-line grammar differs (a `data:` prefix and a `[DONE]` terminator
Claude's stream-json doesn't have), so only that needs new code. Blank separator lines and
comment (`:`-prefixed) lines return `null` → skipped, satisfying "be total on
blank/`[DONE]`/non-JSON (skip)".

**Rejected.** Generalizing `parseStreamJsonLine` to handle SSE — it would muddy a tested
Claude helper for a foreign grammar; a small dedicated parser is clearer and independently
testable.

## D4 — Usage mapping: prompt→input, completion→output, caches→0 (tokens are truth)

**Decision.** `mapUsage({ prompt_tokens, completion_tokens })` →
`{ input_tokens: prompt_tokens, output_tokens: completion_tokens,
cache_read_input_tokens: 0, cache_creation_input_tokens: 0 }`, each coerced finite-or-0.

**Why.** This is the `UsageInput` shape `run-log`/`budget` already read (IA-8: tokens are
**truth from the API**, not a guess). `total_tokens` then equals the sum `totalTokens`
already derives, so we don't store it separately. An OpenAI-compat endpoint exposes no cache
breakdown → honest `0`s, not invented values.

**Rejected.** Inventing a `total_cost_usd` from a hard-coded price table — local models are
free and remote per-token prices vary; a fabricated dollar figure would corrupt the ledger.
Omit `total_cost_usd` (downstream defaults it to 0). Tokens + wall-clock are the two honest
denominations.

## D5 — Timeout latch: `AbortController` + `setTimeout`, throwing a typed subclass

**Decision.** `dispenseOpenAICompat` arms `setTimeout(() => controller.abort(), timeoutMs)`
when `timeoutMs > 0`, passes `controller.signal` to `fetch`, and on an abort throws a new
`OpenAICompatTimeoutError extends ExecutorTimeoutError` (code `ETIMEDOUT_OPENAI`). The timer
is cleared in `finally`. `timeoutMs` undefined/≤0 ⇒ no timer.

**Why.** Exactly mirrors `awaitChildClose`'s latch (`claude.ts:261`): one wall-clock guard,
cleared on settle, throwing an `ExecutorTimeoutError` so `castPlay`'s `instanceof` check
classifies `timed-out` uniformly. `AbortController` is the fetch-native equivalent of
SIGKILL-on-deadline. A subclass (not the base) gives a distinguishable `code` like Claude's,
for symmetric degrade-path logging.

**Rejected.** Throwing the base `ExecutorTimeoutError` directly — works, but a per-executor
subclass with its own `code` is the established pattern and costs ~6 lines.

## D6 — Config: env, local-first, no committed secret

**Decision.** Three env vars, read in `buildChatRequest`:
`VEND_OPENAI_BASE_URL` (default `http://localhost:11434/v1` — Ollama),
`VEND_EXECUTOR_MODEL` (the model id; `opts.model` wins when set),
`VEND_OPENAI_API_KEY` (optional — `Authorization: Bearer` header emitted **only when set**).

**Why.** Local-first: a bare `bun` + a running Ollama needs zero secrets. The key is opt-in
for endpoints that require it, never committed. `opts.model ?? env.VEND_EXECUTOR_MODEL` honors
the interface's `model` core while letting a deployment pin a default.

**Rejected.** A required model env that throws when unset — some endpoints serve a single
model and ignore the field; we send what we have (`opts.model` → env → omit). If neither is
set and the endpoint needs one, the endpoint's own error surfaces (a real failure, rethrown).

## D7 — Agentic options ignored, documented; absent stream throws

**Decision.** `dispenseOpenAICompat` reads only `prompt`, `system`, `model`, `onMessage`,
`timeoutMs`. `maxTurns`/`mcpConfig`/`allowedTools`/`strictMcp` are accepted (the shared
`DispenseOptions`) and **ignored**, with a doc comment stating a completion is not an agent
(the interface's "honor when able"). A stream that produced no chunks and no usage →
`synthesizeResult` returns `null` → `dispenseOpenAICompat` throws (mirrors `dispense`'s
"produced no result" throw).

**Why.** Honest, named, deferred — the ticket's explicit non-over-claim. The throw-on-empty
keeps failure semantics identical to Claude's so `castPlay`'s non-timeout rethrow path is
unchanged.

## D8 — `subtype`: "success" for a completed stream

**Decision.** A synthesized result carries `subtype: "success"`. The chunk's `finish_reason`
(e.g. `"stop"`, `"length"`) is captured onto the result as a passthrough `finish_reason`
field (rides the open record) but does not change `subtype`.

**Why.** `subtype` only feeds the live line (`formatMessage`); a completed completion is a
success the pipeline meters and gates. Keeping `finish_reason` visible aids debugging without
inventing Claude-style error subtypes the transport doesn't have.
