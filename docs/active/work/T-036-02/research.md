# T-036-02 — Research: open-model path coherence + parse agnosticism + boundary

Descriptive map of the territory. No solutions — those are `design.md`. This ticket builds ON
T-036-01 (the `OpenModelStub` client + a render that can target a selectable client) and E-035
(the `Executor` seam + `OpenAICompatExecutor`). Its job is to make the two agree, prove the parse
half needs no change, and record the honest boundary.

## What the ticket asks (three parts)

1. **Render-client follows the executor.** When `VEND_EXECUTOR=openai-compat`, the render must
   target `OpenModelStub`; default ⇒ `ClaudeStub`, byte-identical. Reuse E-035's
   `executorFor`/`VEND_EXECUTOR` selection — do **not** invent a parallel switch. One coherent
   open-model path: render (BAML, open-model client) → dispense (E-035 executor) → parse (BAML).
2. **Parse is provider-agnostic (the proof).** Show `b.parse.DecomposeEpic` SAP-parses a canned
   *open-model-style* reply into the **same** typed `WorkPlan` as a Claude reply — it parses text,
   not a provider. Via the subprocess bridge, no live model. This half needs **no code change**;
   the test makes the neutrality explicit.
3. **Record the boundary.** Update `docs/knowledge/stack.md`: open-model support is now config-level
   at both layers (authoring = this epic; execution = E-035). State the deferred remainder plainly:
   the **live agentic open-model runtime** is not built.

Non-goals (named): no transport through BAML, no change to SAP-parse logic, no agentic runtime.

## The executor selection seam (E-035) — the thing render must follow

`src/executor/select.ts` is the single selection authority:

- `executorFor(opts, env, registry)` (`:55`) resolves the id with precedence
  `opts.executor ?? env[EXECUTOR_ENV] ?? DEFAULT_EXECUTOR_ID`, looks it up in `builtinExecutors`,
  constructs it. Unknown id ⇒ loud throw (never silent fallback).
- Constants: `DEFAULT_EXECUTOR_ID = "claude"` (`:25`), `EXECUTOR_ENV = "VEND_EXECUTOR"` (`:28`).
- `builtinExecutors` (`:36`) = `{ claude, "openai-compat" }`.
- **The id-resolution one-liner is currently inline inside `executorFor`** — not separately
  exported. Following the SAME selection means reusing that resolution, so it wants extracting.

`src/executor/openai-compat.ts` exports the names this ticket reuses verbatim:
`OPENAI_EXECUTOR_ID = "openai-compat"` (`:36`), `OPENAI_BASE_URL_ENV = "VEND_OPENAI_BASE_URL"`
(`:28`), `DEFAULT_OPENAI_BASE_URL = "http://localhost:11434/v1"` (`:34`). Note the
asymmetry: the **executor** defaults base_url to localhost (`buildChatRequest`, `:106`); the BAML
**client** reads `env.VEND_OPENAI_BASE_URL` with *no* default (openai-generic has no built-in
endpoint), so a render against `OpenModelStub` throws if base_url is absent.

`src/engine/cast.ts` (`:205`) resolves the executor per cast:
`opts.executor ?? executorFor(opts.executorId ? { executor: opts.executorId } : {})` — an explicit
instance wins (the **test-injection seam**, `:78`), else id/env via `executorFor`. The prompt is
**rendered before** the executor is constructed; both read the same `process.env`.

## The render path — where the client gets selected

Two render sites, same BAML function, different process model:

- **Production:** `src/play/decompose-epic.ts:168` — `decomposeEpicPlay.render` calls
  `b.request.DecomposeEpic(i.epic, i.charter, i.project)` **in-process** (no subprocess; the
  one-call-per-process addon limit is `bun test`-specific) and pipes it through `extractPromptText`.
  The `Play.render` contract is `(inputs: I) => string` (`play.ts:162`) — **no `CastContext`**, so
  render cannot see cast opts; it can only read `process.env`.
- **Test-only:** `src/baml/decompose-bridge.ts` — the subprocess bridge. `runOp` (`:90`) already
  accepts an optional `client` on a render op and threads it as `{ client }` into
  `b.request.DecomposeEpic(...)` (T-036-01). Its entry point (`:116`) defaults the render-only env
  (`ANTHROPIC_API_KEY`, `VEND_OPENAI_BASE_URL`, `VEND_EXECUTOR_MODEL`, `VEND_OPENAI_API_KEY`) with
  `??=` so an openai-generic render can build in the short-lived child.

The **client-selection contract is confirmed** (T-036-01 research, sync_request.ts:29-56):
`b.request.Fn(args, { client: "OpenModelStub" })` — BAML builds a `ClientRegistry` and
`setPrimary` internally. Omitting the option ⇒ the function default (`ClaudeStub`), byte-identical.

## The parse path — already provider-neutral

`b.parse.DecomposeEpic(text)` (`decompose-bridge.ts:93`, `decompose-epic.ts:171`) is
**schema-aligned parsing** over *text*. It has no provider parameter — it reads a string and
coerces to `WorkPlan`. The existing tests prove two facts the agnosticism proof builds on:

- A canned reply with lisa-token aliases parses to a typed `WorkPlan`
  (`decompose.test.ts:104`), enum aliases mapping back to member names.
- A malformed reply degrades to an EMPTY plan, never throws (`:137`) — `WorkPlan` is all-array, so
  SAP is lenient. (Downstream treats empty as malformed; the value gate is the real check.)

So the "open-model reply" only needs to be *text that carries the same data, styled differently*
(e.g. markdown-fenced JSON with chatty preamble — the common open-model output shape). SAP extracts
the embedded structure regardless of the wrapping. Nothing in parse keys on the provider.

## The test harness (the proof's vehicle)

`src/baml/decompose.test.ts` — all BAML imports TYPE-ONLY (a value import loads the addon into the
test process and reintroduces once-driven flakiness). `runBridge(ops)` (`:31`) spawns the bridge
once, batches every op (parse + malformed + render-default + render-OpenModelStub, `:97`), asserts
on the JSON. The render-shape tests (`:168`) already prove `OpenModelStub` renders openai-generic
format and the prompt text is identical across clients. **The parse-agnosticism op is a new entry
in this same batch** — one more `{ mode: "parse" }` with an open-model-style reply.

`src/executor/select.test.ts` is the pure (no-addon) unit suite for selection — the natural home
for unit tests of the new render-client resolver (it is pure, reads only opts/env).

## The boundary doc

`docs/knowledge/stack.md` — the canonical toolchain record. The "Executor (first)" row (`:17`)
says "Abstracted behind an executor interface so open models slot in later." After E-035/E-036 that
is now *partly realized* (config-level at both layers) with a clearly-deferred remainder. The doc
has no section yet stating where open-model support actually stands — part 3 adds it.

## Constraints & assumptions surfaced

- **Byte-identical default.** No env ⇒ `claude` ⇒ render omits the `{ client }` option entirely
  (NOT `{ client: "ClaudeStub" }`) ⇒ provably the exact request shipped today.
- **`render` has no ctx.** Coherence with selection must come from reading `VEND_EXECUTOR` at render
  time (the live path), not from threading through the cast. The explicit `executorId`/instance opts
  in `cast.ts` are test-injection seams that do not render real BAML — accepted boundary, documented.
- **base_url asymmetry.** A production render against `OpenModelStub` needs `VEND_OPENAI_BASE_URL`
  present (openai-generic has no built-in endpoint). The executor defaults it to localhost; the BAML
  client does not. To keep render and dispatch coherent, the render call site must default it the
  same way (reuse `DEFAULT_OPENAI_BASE_URL`) — render-only, `??=`, never dispatched from BAML.
- **No live model anywhere.** Render builds the request; parse coerces canned text; the dispense is
  E-035's seam. This ticket touches neither transport.
- **`baml_client/` is gitignored** — verified against generated code, only `baml_src/` + `src/` +
  docs are committed; `bun run check` runs `baml:gen` first.
