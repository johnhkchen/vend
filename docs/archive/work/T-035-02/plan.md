# T-035-02 Plan — openai-compatible-executor

Ordered, independently-verifiable steps. Each step ends green (`tsc --noEmit` + `bun test`)
and is committable atomically. Testing strategy folded in per step.

## Step 1 — Adapter skeleton: config + types + timeout error

Create `src/executor/openai-compat.ts` with:
- imports (`ExecutorTimeoutError` value; `DispenseOptions`/`Executor`/`ResultMessage`/
  `StreamMessage` type-only; `createLineBuffer` from `claude.ts`)
- config consts (`OPENAI_*_ENV`, `DEFAULT_OPENAI_BASE_URL`, `OPENAI_EXECUTOR_ID`)
- local `OpenAIChunk`, `SseState`, `ChatRequestBody` types
- `OpenAICompatTimeoutError extends ExecutorTimeoutError`

**Verify:** `tsc --noEmit` clean (unused-but-exported consts are fine).
**Test:** none yet (no behavior).

## Step 2 — Pure helpers

Add to the module:
- `buildChatRequest(opts, env = process.env)` — base-url (trim trailing `/`) + path; headers
  (Bearer only when key set); body with `messages` (system-then-user), `stream: true`,
  `stream_options: { include_usage: true }`, `model` only when resolvable.
- `parseSseData(line)` — trim; `""`/non-`data:` → `null`; strip `data:`; `[DONE]` sentinel;
  else `parseStreamJsonLine`-style `JSON.parse` (null on throw).
- `adaptChunk(chunk)` — first choice's `delta.content` → `{ type:"assistant", subtype:"delta",
  text, ...(model) }`; else `null`.
- `mapUsage(u)` — four-field shape, prompt→input / completion→output / caches→0, `num`-coerced.
- `makeSseConsumer(onMessage)` — `createLineBuffer` over `parseSseData`; fill `SseState`;
  call `onMessage` per adapted message in order.
- `synthesizeResult(state, fallbackModel)` — empty-guard → null; else build `ResultMessage`.

Use a private `num(v)` coercer (copy the run-log/budget idiom — keep the module dependency-free).

**Verify:** `tsc --noEmit` clean.
**Test:** deferred to Step 4 (helpers are exported; tested together).

## Step 3 — Impure verb + Executor class

- `dispenseOpenAICompat(opts, env = process.env)`:
  - `const { url, headers, body } = buildChatRequest(opts, env)`
  - `AbortController`; `timer = timeoutMs>0 ? setTimeout(() => { timedOut=true; ctrl.abort() }, timeoutMs) : null`
  - `makeSseConsumer(opts.onMessage)`
  - `fetch(url, { method:"POST", headers, body: JSON.stringify(body), signal })`
  - `!res.ok` → read `res.text()`, throw `Error` with status + body snippet (real failure)
  - `!res.body` → throw `Error` (no stream)
  - reader loop: `getReader()` + `TextDecoder` → `buffer.push(decode(value,{stream:true}))`;
    `buffer.flush()` after `done`
  - `catch`: `timedOut || name==="AbortError"` → throw `OpenAICompatTimeoutError(timeoutMs, url)`;
    else throw wrapped `Error`
  - `finally`: `clearTimeout(timer)`
  - `const result = synthesizeResult(state, opts.model ?? env[OPENAI_MODEL_ENV])`;
    `if (!result) throw new Error("...produced no result...")`; return it
- `class OpenAICompatExecutor implements Executor { id = OPENAI_EXECUTOR_ID; dispense = delegate }`

**Verify:** `tsc --noEmit` clean.
**Test:** `dispenseOpenAICompat` is the single UNTESTED impure verb (mirrors `dispense`) —
its byte-handling is the pure helpers, covered in Step 4.

## Step 4 — Unit tests (`openai-compat.test.ts`)

Cover every pure helper + the fixture (see structure.md §"Test file layout"):
1. `buildChatRequest` — default url; model precedence (opt > env); system message present/
   absent; Authorization present-iff-key; body has `stream:true` + `stream_options`.
2. `parseSseData` — blank/non-data/`[DONE]`/valid/garbage.
3. `mapUsage` — mapping + cache-zeros + coercion.
4. `adaptChunk` — content → message; role-only/empty → null.
5. Fixture: build a realistic SSE string (role frame, two content frames, a blank line, a
   garbage line, a finish frame, the usage chunk, `[DONE]`); push through
   `makeSseConsumer().buffer`; assert (a) `onMessage` got the ordered content deltas, (b)
   `state.text` is the concatenation, (c) `synthesizeResult` → `usage` equals the fixture's
   mapped `usage`, `model` stamped, `result` = full text, `subtype:"success"`,
   `type:"result"`.
6. Empty stream → `synthesizeResult` returns null.
7. `OpenAICompatTimeoutError` instanceof `ExecutorTimeoutError` + `code === "ETIMEDOUT_OPENAI"`.

**Verify:** `bun test src/executor/openai-compat.test.ts` green.

## Step 5 — Register in selector + selector tests

- `select.ts`: import `OpenAICompatExecutor`; add `"openai-compat": () => new OpenAICompatExecutor()`
  to `builtinExecutors`; update the slice comment.
- `select.test.ts`: add
  - `executorFor({}, { VEND_EXECUTOR: "openai-compat" })` → instanceof `OpenAICompatExecutor`,
    `id === "openai-compat"`.
  - `builtinExecutors["openai-compat"]?.()` is an `OpenAICompatExecutor`.
  - a guard test that no-env STILL defaults to Claude (Claude stays default — AC2).

**Verify:** `bun test src/executor/` green; full `bun run check` green.

## Step 6 — Final gate + artifacts

- `bun run check` (baml:gen + typecheck + full suite) green.
- Write `progress.md` (running) and `review.md` (handoff).

## Testing strategy summary

- **Unit (pure, deterministic, free):** all helpers + the fixture path — the AC's
  "unit-tested against a recorded SSE fixture; ordered StreamMessages + a ResultMessage whose
  Usage matches; `[DONE]`/blank/garbage tolerated; empty stream throws (via null synth)".
- **Not tested (by design):** `dispenseOpenAICompat` (the fetch verb) — its logic is the
  tested pure helpers, exactly as `dispense` is the one untested function in `claude.ts`.
- **Deferred (human):** the live smoke against a running Ollama (env + a model pulled) — the
  one manual step, recorded in `review.md`, not over-claimed as open-model parity.

## Commit plan

Atomic commits map to steps: (1) adapter skeleton + helpers + verb + class (one coherent new
module is easiest to land green together — Steps 1-3), (2) tests (Step 4), (3) selector wiring
+ tests (Step 5). Each ends `bun run check` green.
