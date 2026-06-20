# T-035-01 — Research: the executor seam as it exists today

Descriptive map of the code the ticket touches. No solutions here — that is `design.md`.

## The ticket in one line

Extract the implicit seam `castPlay` leans on into a real `Executor` interface, put
`ClaudeExecutor` behind it, and route casts through an `executorFor(...)` selector that
defaults to Claude — with **no behavior change** for any existing cast.

## The seam as it is welded today

There is **no `Executor` abstraction**. The contract is implicit: `castPlay`
value-imports the free function `dispense` and the error class `ClaudeTimeoutError`
straight from `src/executor/claude.ts` and calls them directly.

```
src/engine/cast.ts:24   import { ClaudeTimeoutError, dispense, type ResultMessage } from "../executor/claude.ts";
src/engine/cast.ts:188  result = await dispense({ prompt, model, maxTurns, ...tflags, onMessage, timeoutMs });
src/engine/cast.ts:197  if (e instanceof ClaudeTimeoutError) timedOut = true;
```

The engine is therefore welded to Claude at exactly two points: the **call** (188) and
the **timeout `instanceof`** (197). Everything else in `castPlay` (render → meter → parse
→ gates → classify → effect → appendRunLog) is already executor-agnostic.

## The contract that must become the interface (`src/executor/claude.ts`)

- **`DispenseOptions`** (`:71`) — the input record. Universal core: `prompt`, `model?`,
  `effort?`, `system?`, `onMessage?` (called once per `StreamMessage`, in order, before any
  throw), `timeoutMs?` (wall-clock; `≤0`/undefined ⇒ no timer). **Agentic / Claude-only**:
  `maxTurns?`, `mcpConfig?`, `allowedTools?`, `strictMcp?` — these map to `claude -p` flags
  via `buildArgs`.
- **`ResultMessage`** (`:34`) — the return. `StreamMessage` + `type:"result"`, `subtype`,
  `result?`, `usage?`, `total_cost_usd?`, `num_turns?`, `model?` (the real id, harvested off
  the stream by `dispense` and stamped on a copy).
- **`StreamMessage`** (`:28`) — `{type:string} & Record<string,unknown>`. The per-message
  unit fanned to `onMessage`.
- **`dispense`** (`:296`) — the one impure, process-spawning verb. Spawns `claude -p`
  (`buildArgs` argv), writes prompt to stdin, streams via `makeStreamConsumer`, awaits
  `awaitChildClose` (the wall-clock latch), throws if no terminal result, else returns the
  result (with real model id attached). **Returns the result for ANY subtype** including
  error subtypes — only a genuinely absent terminal result throws.
- **`ClaudeTimeoutError`** (`:109`) — thrown by `awaitChildClose` (`:275`) on wall-clock
  kill. `readonly code = "ETIMEDOUT_CLAUDE"`, `readonly timeoutMs`, ctor `(timeoutMs, cli)`,
  `name = "ClaudeTimeoutError"`, message contains `<n>ms` and `<cli> -p`.
- Pure helpers (`buildArgs`, `parseStreamJsonLine`, `createLineBuffer`, `makeStreamConsumer`,
  `extractModelId`, `awaitChildClose`) — the byte-handling spine, fully unit-tested.

## Every caller of `dispense` (the blast radius)

Confirmed by grep over `src/` (value imports, not comments/type-only):

1. **`src/engine/cast.ts:188`** — `castPlay`. **This is the only call the ticket reroutes.**
2. **`src/probe/run-equivalence-judge.ts:38,315`** — the equivalence-judge harness casts a
   judge prompt with a bare `dispense(...)`. The ticket scopes the routing change to
   `castPlay` ("the routing change lands only at `castPlay` and nothing else regresses"), so
   this caller must keep working unchanged ⇒ **the free function `dispense` must stay
   exported**.

`ClaudeTimeoutError` value usages: `awaitChildClose` (throw site), `cast.ts:197`
(`instanceof`), and `claude.test.ts` (constructs + asserts). Named only in comments:
`decompose-epic-core.ts:81`, `cast-core.ts:146`, `shelf/select.ts:30`, `run-log.ts:40`,
`budget.ts:10`. So the **only** runtime `instanceof` to preserve is `cast.ts:197` plus the
test's direct assertions.

## What `castPlay` does around the seam (`src/engine/cast.ts`)

`castPlay<I,O>(play, inputs, budget, opts)` (`:112`): resolves project id + runId; resolves
per-play tools against `.mcp.json` (early missing-MCP andon, `:130`); renders the prompt;
opens the two-surface stream sink (stdout + transcript); resolves `maxTurns`; **calls
`dispense` in a try/catch** (`:188`), catching `ClaudeTimeoutError → timedOut=true` and
rethrowing anything else; meters tokens (`check`), parses + gates (unless `skipGates`),
`classify`s, runs `play.effect` on a clear verdict, and `appendRunLog`s exactly once.
`CastOptions` (`:35`) carries the per-cast runtime values (subject, projectRoot, model,
maxTurns, runId, transcriptDir, runLogPath, intervened, skipGates).

## The `Play<I,O>` contract the integration test must satisfy (`src/engine/play.ts:149`)

Required: `name`, `summary`, `render(inputs)→string`, `parse(text)→O`,
`gates(out,ctx)→GateVerdict`, `effect(out,ctx)→Promise<EffectResult>`, `budget: Budget`
(`{timeMs, tokens}`), `card: {color[],type,rarity}`. Optional: `maxTurns?`, `tools?`.
`GateVerdict` = `{status:"clear", cleared?}` | `{status:"stop", gate, unit, reason}`.
`EffectResult` = `{ok, outcome?, detail?, artifacts?, produced?}`.

## Constraints & house patterns observed

- **`tsconfig`**: `strict`, `noUncheckedIndexedAccess`, `verbatimModuleSyntax` (so type-only
  imports MUST use `import type`), `target/module: ESNext` (⇒ `useDefineForClassFields` on —
  class-field define semantics: a subclass field initializer runs after `super()` and wins).
- **Purity discipline**: impure verbs (`dispense`, `castPlay`) are thin; judgment lives in
  pure cores (`cast-core.ts`). New code should follow: the interface + selector are pure
  (types + a factory map), only `dispense` spawns.
- **Back-compat is the contract**: no env ⇒ Claude ⇒ existing casts byte-identical. The
  `parse→gate→effect→log` pipeline must not change.
- **Existing tests that must stay green**: `claude.test.ts` (constructs `ClaudeTimeoutError`,
  asserts `instanceof ClaudeTimeoutError`, `code`, `timeoutMs`, message). Whole suite ~949
  tests green at HEAD.

## Open assumptions to resolve in Design

- Where the `Executor` interface + `ExecutorTimeoutError` live (new file vs. inside
  `claude.ts`) given the runtime-cycle risk (`claude.ts` ↔ a selector that constructs it).
- How the selector exposes "select an alternate" testably **before** the OpenAI executor
  exists (T-035-02) — an injectable registry vs. a hard-coded switch.
- How a **stub executor** is injected through `castPlay` for the end-to-end pipeline proof.
