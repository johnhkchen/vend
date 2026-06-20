# T-035-02 Structure — openai-compatible-executor

The file-level blueprint. Two files created, one modified. No deletions.

## Files

| File | Change | Why |
|------|--------|-----|
| `src/executor/openai-compat.ts` | **create** | The adapter: config, pure helpers, impure verb, `Executor` class |
| `src/executor/openai-compat.test.ts` | **create** | Pure-helper + fixture unit tests |
| `src/executor/select.ts` | **modify** | Register `"openai-compat"` in `builtinExecutors` |
| `src/executor/select.test.ts` | **modify** | Two tests: builtin factory + env selection |

## `src/executor/openai-compat.ts` — public surface (top → bottom)

Mirror `claude.ts`'s ordering: config consts → types → pure helpers → impure verb → class.

### Config constants
```ts
export const OPENAI_BASE_URL_ENV = "VEND_OPENAI_BASE_URL";
export const OPENAI_MODEL_ENV    = "VEND_EXECUTOR_MODEL";
export const OPENAI_API_KEY_ENV  = "VEND_OPENAI_API_KEY";
export const DEFAULT_OPENAI_BASE_URL = "http://localhost:11434/v1"; // Ollama, local-first
export const OPENAI_EXECUTOR_ID = "openai-compat";
```

### Types (local, structural)
```ts
/** One parsed OpenAI streaming chunk. External JSON: open record over the fields we read. */
type OpenAIChunk = {
  model?: string;
  choices?: Array<{ delta?: { content?: string; role?: string }; finish_reason?: string | null }>;
  usage?: { prompt_tokens?: number; completion_tokens?: number; total_tokens?: number } | null;
};

/** Accumulator the SSE consumer fills as frames arrive. */
interface SseState {
  text: string;             // concatenated delta content → ResultMessage.result
  model?: string;           // last non-empty chunk.model
  usage?: OpenAIChunk["usage"]; // the terminal usage block, when present
  finishReason?: string;    // last non-null finish_reason
  chunks: number;           // count of payload chunks seen (empty-stream guard)
}
```

### Timeout error
```ts
export class OpenAICompatTimeoutError extends ExecutorTimeoutError {
  override readonly code = "ETIMEDOUT_OPENAI";
  constructor(timeoutMs: number, url: string) {
    super(timeoutMs, `OpenAI-compatible request to ${url} exceeded ${timeoutMs}ms wall-clock and was aborted`);
    this.name = "OpenAICompatTimeoutError";
  }
}
```

### Pure helpers
```ts
export function buildChatRequest(
  opts: Pick<DispenseOptions, "prompt" | "system" | "model">,
  env?: Record<string, string | undefined>,
): { url: string; headers: Record<string, string>; body: ChatRequestBody };
// url   = `${baseUrl}/chat/completions` (baseUrl from env, trailing slash trimmed)
// headers: Content-Type: application/json; + Authorization: Bearer <key> ONLY when key set
// body  : { model?, messages: [ {role:"system",...}?, {role:"user", content: prompt} ],
//          stream: true, stream_options: { include_usage: true } }
//          model = opts.model ?? env[OPENAI_MODEL_ENV]; omitted from body when neither set

export function parseSseData(line: string): OpenAIChunk | "[DONE]" | null;
// trim; "" / non-"data:" line → null; strip "data:" → "[DONE]" sentinel | JSON.parse | null

export function adaptChunk(chunk: OpenAIChunk): StreamMessage | null;
// content delta present → { type:"assistant", subtype:"delta", text, ...(model?{model}:{}) }
// no content (role-only / usage-only / empty) → null (not streamed)

export function mapUsage(u: OpenAIChunk["usage"]): {
  input_tokens: number; output_tokens: number;
  cache_read_input_tokens: number; cache_creation_input_tokens: number;
}; // prompt→input, completion→output, caches→0, each coerced finite-or-0

export function makeSseConsumer(onMessage?: (m: StreamMessage) => void): {
  buffer: ReturnType<typeof createLineBuffer>;
  state: SseState;
};
// per line: parseSseData → "[DONE]"/null skip; chunk → capture model/usage/finishReason,
//           bump chunks, adaptChunk → onMessage(msg) in order, append text

export function synthesizeResult(
  state: SseState, fallbackModel?: string,
): ResultMessage | null;
// state.chunks === 0 && !state.usage → null (empty stream)
// else { type:"result", subtype:"success", result: state.text, usage: mapUsage(state.usage),
//        model: state.model ?? fallbackModel, ...(finishReason ? {finish_reason} : {}) }
```

### Impure verb (NOT unit-tested — mirrors `dispense`)
```ts
export async function dispenseOpenAICompat(
  opts: DispenseOptions, env?: Record<string, string | undefined>,
): Promise<ResultMessage>;
// build request; AbortController + setTimeout(abort, timeoutMs>0); fetch(signal);
// !res.ok || !res.body → read text, throw Error (real failure); else getReader() loop →
//   TextDecoder → buffer.push(...); buffer.flush(); clearTimeout in finally;
// abort → throw OpenAICompatTimeoutError; other catch → throw wrapped Error;
// synthesizeResult(state, opts.model ?? env model) ?? throw "produced no result"
```

### Executor class
```ts
export class OpenAICompatExecutor implements Executor {
  readonly id = OPENAI_EXECUTOR_ID;
  dispense(opts: DispenseOptions): Promise<ResultMessage> { return dispenseOpenAICompat(opts); }
}
```

### Imports
```ts
import { ExecutorTimeoutError } from "./executor.ts";
import type { DispenseOptions, Executor, ResultMessage, StreamMessage } from "./executor.ts";
import { createLineBuffer } from "./claude.ts";
```
Type-only for the transport shapes (erased — no cycle); value import of
`ExecutorTimeoutError` (from the seam, like `claude.ts`) and `createLineBuffer` (from
`claude.ts` — `select.ts` already proves a value edge into `claude.ts` is acyclic).

## `src/executor/select.ts` — modification

```ts
import { OpenAICompatExecutor } from "./openai-compat.ts"; // + existing ClaudeExecutor import

export const builtinExecutors: ExecutorRegistry = {
  claude: () => new ClaudeExecutor(),
  "openai-compat": () => new OpenAICompatExecutor(),
};
```
`DEFAULT_EXECUTOR_ID` unchanged (`"claude"`). Comment updated: "T-035-02 adds `openai-compat`."

## Module boundary / dependency graph (acyclic, preserved)

```
select.ts ─▶ claude.ts ─────────▶ executor.ts
   │           ▲                      ▲
   ├─▶ openai-compat.ts ──(value: createLineBuffer)──┘ (to claude.ts)
   └─▶ openai-compat.ts ──(value: ExecutorTimeoutError, type: shapes)──▶ executor.ts
```
No new cycle: `openai-compat.ts` imports DOWN (claude.ts, executor.ts), never up into
`select.ts`. `executor.ts` stays seam-free.

## Test file layout (`openai-compat.test.ts`)

Sections, each fabricated-input pure tests:
1. `buildChatRequest` — default base-url; opt/env model precedence; system message
   inclusion/omission; Authorization header present-iff-key; `stream`/`stream_options` in body.
2. `parseSseData` — blank → null; non-`data:` → null; `data: [DONE]` → sentinel; valid → chunk;
   garbage JSON → null.
3. `mapUsage` — maps prompt/completion; zeros caches; coerces absent/non-finite → 0.
4. `adaptChunk` — content delta → assistant message; role-only/empty → null.
5. **Fixture** — a recorded multi-frame SSE string (incl. a blank line, a garbage line, the
   terminal usage chunk, `[DONE]`) pushed through `makeSseConsumer.buffer`; assert ordered
   `StreamMessage`s captured + `synthesizeResult` yields a `ResultMessage` whose `usage`
   matches the fixture and whose `model`/`result` are correct.
6. Empty stream → `synthesizeResult({chunks:0})` returns `null`.
7. `OpenAICompatTimeoutError` is an `ExecutorTimeoutError` (instanceof + `code`).

## Ordering of changes (for Plan)

1. Create `openai-compat.ts` (compiles standalone — only downward imports).
2. Register in `select.ts`.
3. Write `openai-compat.test.ts` + extend `select.test.ts`.
4. `bun run check` green.
