# T-036-01 — Structure: file-level blueprint

The shape of the code, not the code. Three source files touched, one test extended. No new files.

## Files changed

| file | change | what |
|---|---|---|
| `baml_src/clients.baml` | **modify** | add `OpenModelStub` client block + render-only comment |
| `src/baml/decompose-bridge.ts` | **modify** | render op gains optional `client`; return a `requestShape` fingerprint; entry-point env defaults |
| `src/baml/decompose.test.ts` | **modify** | add openai-format render assertions (shape, not text) |
| `baml_client/**` | regenerated | build product (`baml:gen`); not committed (gitignored) |

No files created or deleted. `ClaudeStub`, `generators.baml`, the other six bridges, and every
function's default client are untouched (back-compat).

## 1 — `baml_src/clients.baml` (modify)

Append after the existing `ClaudeStub` block:

```
// (comment, mirroring ClaudeStub) Render-only, NEVER called. The open-model render target:
// `b.request.*(..., { client: "OpenModelStub" })` shapes the prompt in openai-generic format
// (POST {base}/chat/completions) for the agentic open-model path. The dispense itself rides
// E-035's Executor seam (src/executor/openai-compat.ts), NOT BAML. Env names match E-035 exactly
// (VEND_OPENAI_BASE_URL / VEND_EXECUTOR_MODEL / VEND_OPENAI_API_KEY). The api_key is read only to
// BUILD the request and is never sent — render-only call sites set a dummy key and delete it.
client<llm> OpenModelStub {
  provider openai-generic
  options {
    base_url env.VEND_OPENAI_BASE_URL
    model env.VEND_EXECUTOR_MODEL
    api_key env.VEND_OPENAI_API_KEY
  }
}
```

- **Boundary:** declaration only. No behavior; `baml:gen` consumes it to emit a selectable client.
- **Invariant:** the `ClaudeStub` block above it is byte-for-byte unchanged.

## 2 — `src/baml/decompose-bridge.ts` (modify)

Four edits, all additive (existing default path unchanged).

### 2a — `BridgeOp` render variant gains an optional client

```ts
export type BridgeOp =
  | { mode: "render"; epic: string; charter: string; project: string; client?: string }
  | { mode: "parse"; text: string };
```
- Absent `client` ⇒ default render (`ClaudeStub`), byte-identical to today.

### 2b — A request-shape fingerprint type + extractor (new PURE helper)

```ts
/** Structural fingerprint of a built request — provider FORMAT, independent of prompt text. */
export type RequestShape = {
  url: string;              // full endpoint
  endsWithChatCompletions: boolean;  // openai-generic ⇒ true; anthropic ⇒ false
  hasMaxTokens: boolean;    // anthropic ⇒ true; openai ⇒ false
  firstRole: string | undefined;     // anthropic "user" / openai "system"
  contentIsString: boolean; // openai scalar content ⇒ true; anthropic blocks[] ⇒ false
};

export function requestShape(req: {
  url: string;
  body: { json: () => { max_tokens?: unknown; messages?: Array<{ role?: unknown; content?: unknown }> } };
}): RequestShape { /* read url + body.json(); no native call */ }
```
- **PURE** — reads the already-built request object; unit-testable on a fabricated request.
- Narrowly typed reach-in, the same discipline as `extractPromptText`.

### 2c — `BridgeResult` render variant carries the shape

```ts
export type BridgeResult =
  | { ok: true; mode: "render"; prompt: string; shape: RequestShape }
  | { ok: true; mode: "parse"; plan: WorkPlan }
  | { ok: false; error: string };
```
- `prompt` retained (proves text can be identical); `shape` added (proves format differs).

### 2d — `runOp` threads the client through the generated option

```ts
const req = b.request.DecomposeEpic(
  op.epic, op.charter, op.project,
  ...(op.client ? [{ client: op.client }] : []),   // selectable client (verified contract)
) as unknown as { url: string; body: { json: () => { messages?: unknown[] } } };
return { ok: true, mode: "render", prompt: extractPromptText(req), shape: requestShape(req) };
```
- The cast widens to include `url` (needed by `requestShape`) alongside the existing `body` reach.

### 2e — Entry point: render-only env defaults (additive)

```ts
if (import.meta.main) {
  process.env.ANTHROPIC_API_KEY ??= "baml-render-only";
  process.env.VEND_OPENAI_BASE_URL ??= "http://localhost:11434/v1"; // render-only; never dispatched
  process.env.VEND_EXECUTOR_MODEL ??= "baml-render-only";
  process.env.VEND_OPENAI_API_KEY ??= "baml-render-only";
  // …unchanged: read ops, map runOp, write results
}
```
- `??=` preserves any real env. Confines dummies to the child.

- **Public interface of the bridge** (consumed by the test): `BridgeOp`, `BridgeResult`,
  `RequestShape`, and the pure helpers `extractPromptText`, `requestShape`, `runOp`.

## 3 — `src/baml/decompose.test.ts` (modify)

Extend, do not rewrite. The existing parse/render assertions stay.

### 3a — Add a client-targeted render op to the single batched spawn

```ts
const RESULTS = runBridge([
  { mode: "parse", text: CANNED },
  { mode: "parse", text: "this is not a work plan at all" },
  { mode: "render", epic: EPIC, charter: CHARTER, project: PROJECT },                       // [2] default
  { mode: "render", epic: EPIC, charter: CHARTER, project: PROJECT, client: "OpenModelStub" }, // [3] openai
]);
```
- One spawn, one native-addon process — the limit still honored (the limit is per *process*; the
  child handles many calls fine).

### 3b — New `describe` block: render targets a selectable client (openai-generic format)

Assertions on **shape**, paired against the default:

- default `[2].shape`: `endsWithChatCompletions === false`, `hasMaxTokens === true`,
  `firstRole === "user"`, `contentIsString === false` (anthropic format, unchanged).
- openai `[3].shape`: `endsWithChatCompletions === true`, `hasMaxTokens === false`,
  `firstRole === "system"`, `contentIsString === true` (openai-generic format).
- url assertion: `[3].shape.url` ends with `/chat/completions`; `[2].shape.url` ends `/v1/messages`.
- **text-identical / shape-different** pin (optional, strong): `[2].prompt === [3].prompt` while
  `[2].shape.endsWithChatCompletions !== [3].shape.endsWithChatCompletions` — proves the assertion
  is on format, not contrived text.

### 3c — A pure unit test for `requestShape` (no bridge spawn)

Feed `requestShape` two fabricated request objects (one anthropic-like, one openai-like) and assert
the fingerprint fields. Pure, fast, no native addon — guards the extractor independently of BAML.

## Ordering of changes

1. `clients.baml` (declare) → `baml:gen` green → confirms the client compiles before any TS touches it.
2. `decompose-bridge.ts` (`BridgeOp`/`RequestShape`/`requestShape`/`runOp`/env) → typecheck green.
3. `decompose.test.ts` (assertions) → `bun test` green.
4. Full `bun run check` (`baml:gen` + typecheck + test) green.

Each step is independently verifiable; 1 and 3 are the natural commit boundaries (declaration, then
the proof). See `plan.md` for the commit sequence.

## Out of scope (explicit)

- No live dispatch / no `Executor` change (E-035 owns transport).
- No SAP-parse change (T-036-02 proves parse is provider-agnostic).
- No render-follows-`VEND_EXECUTOR` wiring (T-036-02).
- No `stack.md` boundary note (T-036-02).
- The other five bridges are not touched — `DecomposeEpic` is the single proof vehicle.
