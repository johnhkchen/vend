// We never actually CALL this client. Vend uses BAML for AUTHORING ONLY — `b.request.*`
// renders the prompt from typed inputs and `b.parse.*` SAP-parses the reply; the dispense
// itself rides the `claude -p` subscription seam (src/executor/claude.ts), NOT BAML's
// transport. The client exists only to shape `.request`. Its `api_key` is read to BUILD the
// request object and is never sent — render-only call sites set a dummy key and delete it.
// Mirrors the verified pattern in mc-design-eval/baml_src/clients.baml (E-001: BAML-on-Bun
// verified, 2026-06-18).
client<llm> ClaudeStub {
  provider anthropic
  options {
    model "claude-opus-4-8"
    api_key env.ANTHROPIC_API_KEY
    max_tokens 32000
  }
}

// Same render-only discipline as ClaudeStub: we NEVER actually CALL this client. It is the
// open-model render target — `b.request.*(..., { client: "OpenModelStub" })` shapes the prompt in
// openai-generic format (POST {base_url}/chat/completions: flat string content, no max_tokens) for
// the agentic open-model path. The dispense itself rides E-035's Executor seam
// (src/executor/openai-compat.ts), NOT BAML's transport. The env names match E-035 exactly
// (VEND_OPENAI_BASE_URL / VEND_EXECUTOR_MODEL / VEND_OPENAI_API_KEY) so the authoring and dispatch
// layers agree. `api_key` is read only to BUILD the request object and is never sent — render-only
// call sites set a dummy key (most local endpoints need none). openai-generic has no built-in
// endpoint, so `base_url` must be present at render time; render-only call sites default it.
client<llm> OpenModelStub {
  provider openai-generic
  options {
    base_url env.VEND_OPENAI_BASE_URL
    model env.VEND_EXECUTOR_MODEL
    api_key env.VEND_OPENAI_API_KEY
  }
}
