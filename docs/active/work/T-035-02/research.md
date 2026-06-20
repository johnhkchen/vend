# T-035-02 Research — openai-compatible-executor

Descriptive map of the seam this ticket plugs into. No solutions here — just what exists,
where, and what shape the new adapter must satisfy.

## The contract to implement (T-035-01)

`src/executor/executor.ts` defines the seam:

- `interface Executor { readonly id: string; dispense(opts: DispenseOptions): Promise<ResultMessage> }`
- The universal core every executor honors: `prompt` + `timeoutMs` + `onMessage` + `model` →
  a metered `ResultMessage`. Agentic options (`maxTurns`, `mcpConfig`, `allowedTools`,
  `strictMcp`) are "honor when able" hints — a non-agentic completion adapter **ignores them,
  documented** (this ticket is exactly that case; the interface doc names T-035-02 as the
  example).
- `ExecutorTimeoutError extends Error` (`code` default `ETIMEDOUT_EXECUTOR`, carries
  `timeoutMs`). The seam's timeout latch must throw THIS (or a subclass) on wall-clock
  expiry — `castPlay` keys on `e instanceof ExecutorTimeoutError` to classify `timed-out`
  (`cast.ts:221`). Claude's `ClaudeTimeoutError` is the subclass precedent (`claude.ts:117`,
  code `ETIMEDOUT_CLAUDE`).
- `DispenseOptions`, `ResultMessage`, `StreamMessage` are re-exported from `executor.ts` but
  **defined** in `claude.ts` (type-only re-export, erased at runtime — no cycle).

## The transport shapes to produce (`src/executor/claude.ts`)

- `StreamMessage = { type: string } & Record<string, unknown>` — a discriminated-by-`type`
  open record. The only field consumers read structurally is `type` (+ `subtype` for
  `system`/`result`).
- `ResultMessage = StreamMessage & { type: "result"; subtype: string; result?: string;
  usage?: Record<string, unknown>; total_cost_usd?: number; num_turns?: number; model?: string }`.
  This terminal message is what the pipeline meters on.
- Claude's purity split is the house pattern to mirror: PURE helpers (`buildArgs`,
  `parseStreamJsonLine`, `createLineBuffer`, `makeStreamConsumer`, `extractModelId`) are unit
  tested; **one impure verb** (`dispense`, which spawns) is NOT unit tested — "the
  byte-handling it relies on lives in the PURE helpers above" (`claude.ts:291`).
- `createLineBuffer(onLine)` (`claude.ts:208`) is a `\n`-splitter tolerant of chunk
  boundaries — **reusable verbatim** for SSE (each `data:` frame is its own `\n`-terminated
  line; blank separator lines fall out as empty → skipped).
- `parseStreamJsonLine(line)` (`claude.ts:173`) trims + `JSON.parse`, returns `null` on
  blank/non-JSON. The "be total on noise" discipline the SSE parser must copy.

## What the pipeline reads off the result (`src/engine/cast.ts`)

The executor is resolved at `cast.ts:205` (`opts.executor ?? executorFor(...)`) and called at
`cast.ts:210`. Downstream the ONLY `ResultMessage` fields touched:

- `result.usage` → `check(budget, usage)` (`cast.ts:236`) and logged as `usage` (`:302`).
- `result.result` → `play.parse(...)` (`cast.ts:238`).
- `result.total_cost_usd` → logged `costUsd`, defaulting to `0` when not a number (`:303`).
- `result.model` → `resolveLoggedModel(result?.model, opts.model)` (`cast.ts:270`).
- `result.num_turns` → `resolveTurnsUsed` (`cast.ts:275`); absent ⇒ field omitted.
- `result.subtype` / `type` → only the live line via `formatMessage` (`cast-core.ts:200`).

So: produce a real `usage`, the completion text in `result`, a `model` id, a `subtype`, and
`type: "result"`. `total_cost_usd` / `num_turns` are legitimately absent for a single
completion (default-0 / omitted downstream — no special handling needed).

## The Usage shape (`src/log/run-log.ts`)

- `UsageInput` (`run-log.ts:62`): `input_tokens?`, `output_tokens?`,
  `cache_read_input_tokens?`, `cache_creation_input_tokens?` — all optional, each coerced
  `undefined/non-finite → 0` by `normalizeUsage` (`:205`).
- `totalTokens` (`:509`) sums the four; `check(budget, usage)` (budget) reads the same shape.
- This is the **target shape** for mapping the OpenAI `usage` block. The API gives
  `prompt_tokens` / `completion_tokens` / `total_tokens`; the natural map is
  `prompt → input_tokens`, `completion → output_tokens`, cache fields → `0`
  (an OpenAI-compat endpoint doesn't break out cache reads/creation). `total_tokens` then
  equals the sum the ledger already derives.
- `run-log.ts` imports NOTHING from `src/executor/` — duck-typing only. The adapter must
  produce the structural shape, not import a run-log type.

## The selector (`src/executor/select.ts`)

- `builtinExecutors: ExecutorRegistry = { claude: () => new ClaudeExecutor() }` (`select.ts:35`)
  — the registry to add an `"openai-compat"` factory to.
- `executorFor(opts, env, registry)` resolves `opts.executor ?? env.VEND_EXECUTOR ??
  DEFAULT_EXECUTOR_ID` and constructs from the registry; unknown id throws loudly.
  `DEFAULT_EXECUTOR_ID = "claude"` — **Claude must stay default**.
- `EXECUTOR_ENV = "VEND_EXECUTOR"`. The new id is selected by `VEND_EXECUTOR=openai-compat`.
- The selector value-imports `ClaudeExecutor` from `claude.ts`; adding `OpenAICompatExecutor`
  is the same edge (`select.ts → openai-compat.ts`). No cycle: the adapter only type-imports
  the transport shapes and value-imports `ExecutorTimeoutError` from `executor.ts`, exactly
  as `claude.ts` does.

## The OpenAI-compatible transport (external reality)

`POST {baseUrl}/chat/completions` with `stream: true` returns `text/event-stream`:

```
data: {"choices":[{"delta":{"role":"assistant"},"finish_reason":null}],"model":"..."}
data: {"choices":[{"delta":{"content":"Hel"}}]}
data: {"choices":[{"delta":{"content":"lo"}}]}
data: {"choices":[{"delta":{},"finish_reason":"stop"}]}
data: {"choices":[],"usage":{"prompt_tokens":11,"completion_tokens":2,"total_tokens":13}}
data: [DONE]
```

- Frames are `data: <json>\n`, separated by blank lines, terminated by `data: [DONE]`.
- The terminal `usage` block requires `stream_options: { include_usage: true }` in the
  request (OpenAI + vLLM honor it; Ollama emits usage on its final chunk regardless).
- `model` rides on each chunk (top-level `model`).
- Auth: `Authorization: Bearer <key>` — **only when a key is configured** (local Ollama
  needs none; this is local-first, no committed secret).

## Test infrastructure

- `bun:test`; pure helpers tested with fabricated inputs (`claude.test.ts`,
  `select.test.ts`). `select.test.ts` already proves selection with an injected registry and
  the `ExecutorTimeoutError`/`ClaudeTimeoutError` `instanceof` chain — the pattern the new
  timeout-subclass test follows.
- Gate: `bun run check:*` (`check:typecheck` = `tsc --noEmit`, `check:test` = `bun test`).
  `tsconfig` is strict (`noUncheckedIndexedAccess`, `verbatimModuleSyntax` — type imports
  must be `import type`).

## Constraints / assumptions surfaced

- **Single-completion, not agentic.** A `/chat/completions` call is one turn; agentic options
  are ignored by contract. Read-the-repo/run-tools plays are out of scope (deferred to a
  downstream agentic open-model runner).
- **Fixture-based proof only.** No live model in CI (free, deterministic). The live smoke
  (env + a running Ollama) is the one deferred human step.
- **Cost in dollars is unknown** for an OpenAI-compat endpoint (no `total_cost_usd` in the
  API) — tokens are the truth-from-API denomination (IA-8); dollar cost is legitimately
  omitted (defaults to 0 downstream). Wall-clock is the transport-universal denomination via
  the timeout latch.
- `fetch` + `AbortController` is the Bun-native transport (no dependency); the abort signal is
  the wall-clock latch analog to Claude's SIGKILL-on-deadline.
