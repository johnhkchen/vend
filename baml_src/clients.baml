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
