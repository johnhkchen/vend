# T-036-01 — Design: open-model BAML client

One decision per section. Each grounded in `research.md`, not assumption.

## D1 — How to declare `OpenModelStub` (the client)

**Decision.** Add a second `client<llm>` block to `baml_src/clients.baml`, provider
`openai-generic`, options driven entirely by the E-035 env names, with a header comment mirroring
`ClaudeStub`'s render-only discipline:

```baml
client<llm> OpenModelStub {
  provider openai-generic
  options {
    base_url env.VEND_OPENAI_BASE_URL
    model env.VEND_EXECUTOR_MODEL
    api_key env.VEND_OPENAI_API_KEY
  }
}
```

**Why these options.**

- `provider openai-generic` — the universal OpenAI-compatible provider (Ollama/llama.cpp/vLLM),
  the *same* shape E-035's `OpenAICompatExecutor` targets (`research.md` E-035 section). The spike
  confirmed it renders `POST {base}/chat/completions`, the openai format.
- `base_url env.VEND_OPENAI_BASE_URL` — **env, not a literal default.** Considered a literal
  `base_url "http://localhost:11434/v1"` (the ticket allows "a local default if BAML allows").
  Rejected: it would (a) bake a transport endpoint into the authoring source, which is the *wrong
  layer* — the local default already lives in E-035's `DEFAULT_OPENAI_BASE_URL`, and duplicating it
  invites drift; (b) read as "this client gets called," undercutting the render-only story. Env
  keeps the client a pure render target and reuses E-035's exact contract. The render-only default
  belongs at the *call site* (the bridge), mirroring how the bridge already defaults
  `ANTHROPIC_API_KEY` — see D3.
- `model env.VEND_EXECUTOR_MODEL` — the E-035 model env, verbatim.
- `api_key env.VEND_OPENAI_API_KEY` — optional/dummy, **render-only, never sent.** Most local
  endpoints need none; openai-generic still wants the field present to build the request object.
  Read-to-build, never-dispatch — identical to `ClaudeStub`'s `api_key` story.

**Why a comment block.** The single most important property of this file is the "never CALL this
client" discipline. A reader seeing two clients must not assume the second one is live. The comment
re-states it for `OpenModelStub` and points at the E-035 seam that *does* dispatch.

**Rejected: a per-function `client` override in the `.baml` function defs.** That would change a
function's *default* client and break byte-identical back-compat (AC-1). Client selection must be a
*runtime* choice at the render call site, not a source-level default. → D2.

## D2 — How render targets a selectable client (the external contract)

**Decision.** Use the generated `BamlCallOptions.client?: string` option:
`b.request.DecomposeEpic(epic, charter, project, { client: "OpenModelStub" })`. Default (no option)
keeps `ClaudeStub`.

**Why — verified against the generated client** (`research.md`, sync_request.ts:29-56). Two
surfaces exist:

| surface | call | mechanism |
|---|---|---|
| **string name** (chosen) | `b.request.Fn(args, { client: "OpenModelStub" })` | BAML builds `new ClientRegistry()`, `setPrimary("OpenModelStub")` internally |
| `ClientRegistry` object | build registry, `addLlmClient(...)`/`setPrimary(...)`, pass `{ clientRegistry }` | caller re-declares the client in TS |

The string form **wins**: it needs no `@boundaryml/baml` value import (which would load the native
addon — forbidden in the test process, and unnecessary in the child), it reuses the client already
declared in `clients.baml` (single source of truth — no re-declaring base_url/model in TS), and it
is exactly the path BAML's own generated code funnels into. The `ClientRegistry` object is the
*underlying* mechanism; the `client` string is the public ergonomic surface. **This is the one
external contract the ticket said to confirm — confirmed, and recorded here + in `structure.md`.**

**Rejected: building a `ClientRegistry` in the bridge.** More code, a native-addon value import,
and it duplicates the client declaration. No benefit over the string option.

## D3 — Where the render-only env defaults live

**Decision.** The **bridge entry point** sets render-only defaults for the openai env vars, exactly
as it already does for `ANTHROPIC_API_KEY`:

```ts
process.env.ANTHROPIC_API_KEY ??= "baml-render-only";
process.env.VEND_OPENAI_BASE_URL ??= "http://localhost:11434/v1";  // render-only; never dispatched
process.env.VEND_EXECUTOR_MODEL ??= "baml-render-only";
process.env.VEND_OPENAI_API_KEY ??= "baml-render-only";
```

**Why.** openai-generic cannot render without a `base_url` (`research.md` constraints) — provider
`anthropic` has a built-in endpoint, openai-generic does not. Defaulting at the call site (not in
the `.baml`) keeps the source layer transport-free (D1) and confines the dummy values to the
short-lived child process, the established pattern. `??=` respects any real env a developer set,
so a future live smoke needs zero code change.

## D4 — How to assert "openai-generic format" (request shape, not text)

**Decision.** Add a **render op that carries a `client` selector**, return the **structural
fingerprint** of the built request, and assert the two clients differ on shape. The fingerprint is
the discriminating, text-independent fields the spike confirmed:

- `endsWithChatCompletions` — `req.url` ends `/chat/completions` (openai) vs `/v1/messages`
  (anthropic). **Primary discriminator.**
- `hasMaxTokens` — anthropic body carries `max_tokens: 32000`; openai body omits it.
- `firstRole` — openai `system` vs anthropic `user`.
- `contentIsString` — openai `messages[0].content` is a scalar string; anthropic is a blocks array.

**Why these four.** Each is a *format* property of the provider payload, independent of the prompt
text (which the ticket warns may be identical — do not contrive a text difference). Asserting on
four orthogonal fields (endpoint, body field presence, role, content encoding) makes the proof
robust to any one field shifting across a BAML version. The render still also returns the prompt
text (the existing `extractPromptText`) so the *text-identical / shape-different* property is
provable in one assertion pair if desired.

**Why extend `BridgeOp`, not add a new bridge.** The decompose bridge is the established precedent
the ticket names. Adding an optional `client?: string` to the render op (and a `requestShape`
return) keeps one bridge, one spawn, one native call per process — no new subprocess machinery.

**Rejected: assert on extracted prompt text differing.** Explicitly forbidden — the text can and
should be identical across clients; the *shape* is the contract.

## D5 — Which function to render against

**Decision.** Reuse **`DecomposeEpic`** (the decompose bridge's existing function). No new BAML
function, no second bridge.

**Why.** The ticket says extend "the `decompose-bridge.ts` pattern." `DecomposeEpic` is already
wired through the bridge with a working render op; adding client selection to it is the minimal,
on-precedent change. The proof is about the *client/provider* axis, which is function-agnostic —
any function rendered against `OpenModelStub` yields openai format, so the simplest existing one is
the right vehicle.

## Decision summary

1. Declare `OpenModelStub` (openai-generic, env base_url/model/api_key, render-only comment) in
   `clients.baml`; leave `ClaudeStub` + all function defaults untouched.
2. Select the client at render time via the generated `{ client: "OpenModelStub" }` option.
3. Default the openai render-only env in the bridge entry point (`??=`), like the anthropic key.
4. Prove openai format by a 4-field request-**shape** fingerprint, not prompt text.
5. Render `DecomposeEpic` through the existing decompose bridge — extend, don't add.
