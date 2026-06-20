# T-036-01 — Review: open-model-baml-client

Handoff doc. What changed, how it's covered, what a reviewer should check, open concerns.

## What changed

Two commits, three source files (plus the gitignored regenerated `baml_client/`).

### `baml_src/clients.baml` (+18, addition-only) — `415cce3`

Declares `OpenModelStub`: `provider openai-generic`, options `base_url env.VEND_OPENAI_BASE_URL`,
`model env.VEND_EXECUTOR_MODEL`, `api_key env.VEND_OPENAI_API_KEY` — the E-035 env names verbatim.
A header comment mirrors `ClaudeStub`'s render-only discipline ("NEVER actually CALL this client";
the dispense rides `src/executor/openai-compat.ts`, not BAML) and notes openai-generic needs a
`base_url` at render time. `ClaudeStub` is byte-for-byte untouched.

### `src/baml/decompose-bridge.ts` — `1bf570c`

- `BridgeOp` render variant gains optional `client?: string`.
- New PURE `requestShape(req): RequestShape` — reads the format fingerprint off a built request:
  `url`, `endsWithChatCompletions`, `hasMaxTokens`, `firstRole`, `contentIsString`. Narrowly typed
  reach-in, same discipline as `extractPromptText`. No native call.
- `BridgeResult` render variant carries `shape: RequestShape` alongside the existing `prompt`.
- `runOp` threads `{ client }` into `b.request.DecomposeEpic` (spread only when set, so the default
  call is unchanged) and widens the cast to reach `url`.
- Entry point adds three render-only `??=` env defaults for the openai vars.

### `src/baml/decompose.test.ts` — `1bf570c`

- A 4th batched op renders the same inputs against `OpenModelStub`.
- New `describe` (3 tests): default stays anthropic format; `OpenModelStub` is openai-generic
  format; and the proof is on **shape** while `prompt` is byte-identical across clients.

## Acceptance criteria

| AC | status | evidence |
|---|---|---|
| `OpenModelStub` declared (openai-generic, env, render-only/no-secret), `baml:gen` green, `ClaudeStub`/defaults unchanged | ✅ | `clients.baml` diff addition-only; `baml:gen` "Wrote 14 files"; comment mirrors ClaudeStub |
| Render bridge targets a selectable client; `OpenModelStub` builds openai-generic format, asserted on **shape** (distinct from anthropic), via the subprocess bridge; client-selection API confirmed in artifact | ✅ | 3 shape tests pass; `{ client }` contract confirmed in `design.md` D2 / `progress.md` |
| Deterministic, no live model; `bun run check:*` green | ✅ | render-only env dummies, no `fetch`; `bun run check` → 988 pass / 0 fail |

## Test coverage

- **`requestShape` extractor** — covered on **real** BAML requests for **both** providers via bridge
  ops [2] (anthropic) and [3] (openai-generic). Stronger than fabricated inputs.
- **Client selection** — proven end-to-end: the same inputs render two distinct provider formats
  selected purely by the `{ client }` option.
- **Format fingerprint** — four orthogonal fields asserted per provider (endpoint, max_tokens
  presence, first role, content encoding), so the proof survives any single field shifting.
- **Back-compat** — the default-client test pins the anthropic shape; `clients.baml` is addition-only;
  full 988-test suite green (no regression in the other five bridges or elsewhere).
- **Determinism** — render-only; no network; one native call per process (subprocess bridge).

### Gaps (flagged, by design)

- **No pure standalone unit test for `requestShape`.** Intentional — value-importing it into the
  test file would load the BAML native addon into the `bun test` process (the documented one-call
  flakiness). It is instead exercised on real requests through the bridge. See `progress.md`
  deviation 1. If a reviewer wants an isolated pure test, the clean path is extracting `requestShape`
  into a BAML-free module — deferred as not worth a new file for this slice.
- **No live-endpoint smoke.** Out of scope (render-only ticket). The live OpenAI-compat dispatch is
  E-035's `OpenAICompatExecutor`; wiring render to follow `VEND_EXECUTOR` is T-036-02.

## Open concerns / notes for the reviewer

1. **The `baml_client/` is gitignored.** The `{ client }` contract is verified against generated
   code (`sync_request.ts:29-56`) and exercised in tests, but CI regenerates it (`bun run check`
   runs `baml:gen` first). A BAML `version` bump in `generators.baml` could in principle change the
   call-option surface — the test would catch it (it would fail to select the client). Low risk,
   pinned at `0.222.0`.
2. **openai-generic render requires `base_url`.** Unlike `provider anthropic` (built-in endpoint),
   a render against `OpenModelStub` with no `VEND_OPENAI_BASE_URL` set will fail. Handled by the
   bridge's `??=` defaults; any *new* render call site for `OpenModelStub` must do the same. Worth a
   glance when T-036-02 adds the executor-coherent render selection.
3. **Format fingerprint is BAML-version-coupled.** `firstRole === "system"` and `contentIsString`
   reflect how BAML 0.222.0 renders openai-generic; the endpoint + `max_tokens` checks are the most
   stable. If a future BAML changes the role mapping, those two assertions (not the endpoint one)
   are the ones to revisit.
4. **No change to the dispatch/transport layer.** This ticket is authoring-only; nothing here sends
   a byte to any model. The "never called" discipline is preserved and re-documented.

## Verdict

Scope met, gate green, back-compat preserved, the one external contract confirmed against the
generated client and proven end-to-end. Ready for T-036-02 (render-follows-`VEND_EXECUTOR` +
parse-agnosticism proof + `stack.md` boundary), which depends on this client + render seam.
