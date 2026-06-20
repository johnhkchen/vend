# T-035-02 Progress — openai-compatible-executor

Status: **Implement complete, gate green.** Plan followed with no material deviations.

## Steps

- [x] **Step 1-3 — adapter module** `src/executor/openai-compat.ts` (one coherent new module,
  landed green together as planned). Config consts, local structural types,
  `OpenAICompatTimeoutError`, the pure helpers (`buildChatRequest`, `parseSseData`,
  `adaptChunk`, `mapUsage`, `makeSseConsumer`, `synthesizeResult`), the one impure verb
  `dispenseOpenAICompat`, and the `OpenAICompatExecutor` class.
- [x] **Step 4 — unit tests** `src/executor/openai-compat.test.ts` — every pure helper +
  the recorded SSE fixture path + the empty-stream-null + the timeout-subclass instanceof.
- [x] **Step 5 — selector wiring** `select.ts` registers `"openai-compat"`; `select.test.ts`
  adds builtin-factory, env-selection, and Claude-stays-default tests.
- [x] **Step 6 — gate** `bun run check` green (typecheck clean, **985 tests pass**, +22 over
  the 963 baseline at T-035-01 close).

## Commits

- `87b5b59` feat(executor): OpenAICompatExecutor — SSE adapter + executorFor register
- `c85a82f` test(executor): fixture-based SSE adapter tests + selector wiring

## Deviations from plan

1. **`adaptChunk` return type widened to `(StreamMessage & { text: string }) | null`** (from
   plain `StreamMessage | null`). Reason: `StreamMessage`'s `Record<string, unknown>` index
   makes `msg.text` `unknown`, so the consumer's `state.text += msg.text` and the test's
   `m.text` both needed an unsafe cast (`tsc` TS2352, since `StreamMessage` doesn't overlap
   `{ text: string }`). Carrying `text` in the return type is the typed, cast-free fix and
   leaves the value still assignable to `StreamMessage` everywhere it flows. No behavior
   change.

No other deviations. The purity split, the env config, the usage mapping, the timeout latch,
and the empty-stream throw all landed as designed.

## Verification done

- `bun run check`: baml:gen + `tsc --noEmit` + full `bun test` — all green.
- The fixture test proves the AC's core: a recorded SSE stream (incl. a blank line, a garbage
  line, the terminal usage chunk, `[DONE]`) yields the two ordered content `StreamMessage`s and
  a `ResultMessage` whose `usage` equals the fixture's mapped usage, with the real model id and
  full completion text. Empty stream → `synthesizeResult` returns null (the verb throws).

## Not done (by design — see review.md)

- `dispenseOpenAICompat` (the live `fetch` verb) is not unit-tested — its byte-handling is the
  tested pure helpers (mirrors `dispense`).
- The live smoke against a running Ollama is the deferred human step.
