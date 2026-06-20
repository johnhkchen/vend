# T-035-02 Review — openai-compatible-executor

Handoff for a human reviewer. What changed, how it's covered, what is honestly deferred.

## What changed

**Created**
- `src/executor/openai-compat.ts` (~270 lines) — the second `Executor`. An OpenAI-compatible /
  local-model adapter: env config, pure helpers, one impure `fetch` verb, the `Executor` class.
  Mirrors `claude.ts`'s purity split exactly.
- `src/executor/openai-compat.test.ts` (~190 lines) — pure-helper + fixture-driven unit tests.

**Modified**
- `src/executor/select.ts` — `builtinExecutors` gains `"openai-compat": () => new OpenAICompatExecutor()`;
  comment updated. `DEFAULT_EXECUTOR_ID` unchanged (`"claude"`).
- `src/executor/select.test.ts` — three added tests: the builtin factory, env selection of the
  new id, and a guard that no-env STILL defaults to Claude.

**Untouched (by design):** `executor.ts` (the seam was already general — T-035-01), `cast.ts`
(routes through `executorFor` already), `run-log.ts` (duck-typed `usage` — no import needed).

## How the acceptance criteria are met

- **AC1 — implements `Executor`, streaming request, SSE → StreamMessages, ResultMessage with
  API-mapped usage + real model id, agentic options ignored.** `OpenAICompatExecutor.dispense`
  delegates to `dispenseOpenAICompat`, which builds a streaming `/chat/completions` request
  (`buildChatRequest`), consumes the SSE body (`makeSseConsumer` over the reused
  `createLineBuffer`) handing each delta to `onMessage` in order, and synthesizes the terminal
  `ResultMessage` (`synthesizeResult`) with `usage` mapped from the API block (`mapUsage`,
  IA-8) and the real model id off the stream. Agentic options are accepted (shared
  `DispenseOptions`) and ignored, documented in the module header and the class doc.
- **AC2 — selectable via `VEND_EXECUTOR=openai-compat`; Claude stays default.** Registered in
  `builtinExecutors`; `executorFor({}, { VEND_EXECUTOR: "openai-compat" })` returns it. A
  dedicated test asserts no-env still yields `ClaudeExecutor`.
- **AC3 — unit-tested against a recorded SSE fixture.** `SSE_FIXTURE` (role frame, two content
  deltas, a blank separator, a garbage line, the finish frame, the terminal usage chunk,
  `[DONE]`) drives two tests: ordered content `StreamMessage`s reach `onMessage` and the text
  accumulates; `synthesizeResult` yields a `ResultMessage` whose `usage` equals the fixture's
  mapped usage with the real model + full text. `[DONE]`/blank/garbage frames are tolerated
  (skipped); an empty stream → `synthesizeResult` returns null → the verb throws.
- **AC4 — non-agentic gap + deferred live smoke recorded; `bun run check:*` green.** Recorded
  below and in the module header. Full gate green: typecheck clean, **985 tests pass**.

## Test coverage

- **Covered (unit, deterministic, free):** `buildChatRequest` (default url, slash-trim, model
  precedence, system message, Bearer-iff-key, `stream`/`stream_options`); `parseSseData`
  (blank/comment/`[DONE]`/valid/garbage); `mapUsage` (mapping + cache-zeros + coercion);
  `adaptChunk` (content vs role-only/empty/usage-only); the fixture path end-to-end; the empty
  stream null; the model fallback; the `OpenAICompatTimeoutError` instanceof + `code`.
- **Not covered (by design):** `dispenseOpenAICompat` — the single impure `fetch` verb.
  Justification: every byte it processes flows through the tested pure helpers, exactly as
  `dispense` is the one untested function in `claude.ts`. The `fetch`/`AbortController`/reader
  mechanics it adds are thin orchestration.

## Open concerns / known limitations

1. **Single-completion, NOT agentic — the headline non-over-claim.** A `/chat/completions`
   call is one turn. This proves the interface + transport + token metering are pluggable for
   **context-complete** plays (the prompt carries its context). It is **not** open-model
   parity: read-the-repo / run-tools plays (survey/steer/work) need the downstream agentic
   open-model runner, out of scope here. The agentic options are deliberately ignored.
2. **Live smoke is the one deferred human step.** All proof is fixture-based; no live model
   runs in CI. To smoke against a real endpoint: start Ollama (`ollama serve`), pull a model
   (`ollama pull llama3.1`), then `VEND_EXECUTOR=openai-compat VEND_EXECUTOR_MODEL=llama3.1
   vend run <context-complete play>`. `VEND_OPENAI_BASE_URL` / `VEND_OPENAI_API_KEY` override
   the local default for vLLM / a remote OpenAI-compatible endpoint. Not yet run.
3. **No dollar cost.** An OpenAI-compatible endpoint reports no `total_cost_usd`, so the field
   is omitted (defaults to 0 downstream). Tokens (truth from the API) and wall-clock (the
   timeout latch) are the two honest denominations (IA-8); per-token dollar pricing for remote
   endpoints is a separate, deliberate non-goal — fabricating it would corrupt the ledger.
4. **`stream_options.include_usage` assumption.** We always request it. OpenAI/vLLM honor it;
   Ollama emits usage on its final chunk regardless. An endpoint that emits NO usage block
   still produces a valid result (text present, `usage` → all-zeros via `mapUsage`) — honest,
   not a crash, but the ledger would under-count tokens for such an endpoint. No such endpoint
   is in scope; flagged for the live-smoke step to confirm.
5. **Cache token fields are always 0.** The OpenAI-compat usage shape has no cache breakdown.
   Correct for the shape; if a future endpoint surfaces cache reads, `mapUsage` is the single
   place to extend.

## Nothing requires blocking human attention

The work is green and self-contained behind the existing seam; the default path (Claude) is
byte-unchanged. The deferred live smoke (concern #2) is the expected next manual validation,
not a defect.
