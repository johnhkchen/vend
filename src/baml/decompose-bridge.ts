// Standalone BAML render/parse bridge for DecomposeEpic (T-002-01) — AUTHORING ONLY.
//
// WHY THIS EXISTS: the BAML native addon allows exactly ONE successful native call per
// `bun test` process — the addon's async runtime reactor is driven by bun's event loop
// only once, so a second `b.parse`/`b.request` hangs until the per-test timeout. A plain
// `bun` child process has no such limit (many calls run fine). So the test spawns THIS
// script in a child `bun` process, which performs all the render/parse ops and emits the
// results as JSON on stdout. Render-only: `b.request` builds the prompt and `b.parse`
// SAP-parses canned text; NOTHING is ever dispatched to a model from here (the live seam
// is src/executor/claude.ts). Mirrors the subprocess-bridge pattern in
// mc-design-eval/src/baml/bridge.mts.
//
// Protocol: read `{ ops: Op[] }` from stdin, write `{ results: OpResult[] }` to stdout,
// one result per op, in order. A failing op yields `{ ok: false, error }` rather than
// crashing the batch.

import { b } from "../../baml_client/sync_client.ts";
import type { WorkPlan } from "../../baml_client/index.ts";

/**
 * A render op renders the prompt from the three inputs; a parse op SAP-parses a reply. An optional
 * `client` selects the BAML client at render time (the generated `{ client }` call option →
 * `ClientRegistry.setPrimary`); absent ⇒ the function default (`ClaudeStub`), byte-identical.
 */
export type BridgeOp =
  | { mode: "render"; epic: string; charter: string; project: string; client?: string }
  | { mode: "parse"; text: string };

export type BridgeResult =
  | { ok: true; mode: "render"; prompt: string; shape: RequestShape }
  | { ok: true; mode: "parse"; plan: WorkPlan }
  | { ok: false; error: string };

/**
 * Structural fingerprint of a built request — the provider FORMAT, independent of prompt text (the
 * text may be identical across clients; the SHAPE is what differs). openai-generic renders
 * `POST {base}/chat/completions` with flat string content and no `max_tokens`; anthropic renders
 * `/v1/messages` with content BLOCKS and a `max_tokens`. These four orthogonal fields pin that.
 */
export type RequestShape = {
  /** Full endpoint URL. */
  url: string;
  /** openai-generic ⇒ true (`…/chat/completions`); anthropic ⇒ false (`…/v1/messages`). */
  endsWithChatCompletions: boolean;
  /** anthropic carries `max_tokens`; openai-generic omits it. */
  hasMaxTokens: boolean;
  /** First message role — anthropic `"user"`, openai-generic `"system"`. */
  firstRole: string | undefined;
  /** openai-generic content is a scalar string; anthropic content is a blocks array. */
  contentIsString: boolean;
};

/**
 * Read the format fingerprint off a built request. PURE — inspects the already-built request
 * object (url + body), no native call. Narrowly typed reach-in, same discipline as
 * {@link extractPromptText} (BAML does not publicly type the request body).
 */
export function requestShape(req: {
  url: string;
  body: { json: () => { max_tokens?: unknown; messages?: Array<{ role?: unknown; content?: unknown }> } };
}): RequestShape {
  const body = req.body.json();
  const first = (body.messages ?? [])[0];
  return {
    url: req.url,
    endsWithChatCompletions: req.url.endsWith("/chat/completions"),
    hasMaxTokens: body.max_tokens !== undefined,
    firstRole: typeof first?.role === "string" ? first.role : undefined,
    contentIsString: typeof first?.content === "string",
  };
}

/**
 * Pull the rendered prompt text out of a BAML request. PURE. Mirrors mc's bridge.mts:
 * `.body.json().messages` carries the provider payload; we keep the text blocks and join.
 * BAML does not publicly type the request body, so the reach-in is narrowly typed here.
 */
export function extractPromptText(req: { body: { json: () => { messages?: unknown[] } } }): string {
  const content = (req.body.json().messages ?? []).flatMap((m) => {
    const c = (m as { content: unknown }).content;
    return Array.isArray(c) ? c : [{ type: "text", text: c }];
  });
  return content
    .filter((c) => (c as { type: string }).type === "text")
    .map((c) => (c as { text: string }).text)
    .join("\n");
}

/** Run one op. Render reads the env key only to BUILD the request (never sent). */
export function runOp(op: BridgeOp): BridgeResult {
  try {
    if (op.mode === "parse") {
      return { ok: true, mode: "parse", plan: b.parse.DecomposeEpic(op.text) };
    }
    // The optional `client` selects the render client at runtime (verified contract: the generated
    // `{ client }` call option, sync_request.ts — BAML builds a ClientRegistry + setPrimary under
    // the hood). Absent ⇒ the function default (ClaudeStub). The cast reaches `url` + `body` for
    // both the prompt text and the format fingerprint; neither dispatches anything.
    const req = b.request.DecomposeEpic(
      op.epic,
      op.charter,
      op.project,
      ...(op.client ? [{ client: op.client }] : []),
    ) as unknown as {
      url: string;
      body: { json: () => { max_tokens?: unknown; messages?: Array<{ role?: unknown; content?: unknown }> } };
    };
    return { ok: true, mode: "render", prompt: extractPromptText(req), shape: requestShape(req) };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
}

// Entry point: only runs when executed directly (not when imported by a test for its
// pure helpers). Render-only key guard set process-wide for this short-lived child.
if (import.meta.main) {
  process.env.ANTHROPIC_API_KEY ??= "baml-render-only";
  // openai-generic has no built-in endpoint, so a render against OpenModelStub needs base_url
  // present. Render-only dummies, confined to this short-lived child; `??=` respects any real env
  // a developer set (a future live smoke needs no code change). Never dispatched.
  process.env.VEND_OPENAI_BASE_URL ??= "http://localhost:11434/v1";
  process.env.VEND_EXECUTOR_MODEL ??= "baml-render-only";
  process.env.VEND_OPENAI_API_KEY ??= "baml-render-only";
  const input = JSON.parse(await Bun.stdin.text()) as { ops: BridgeOp[] };
  const results = (input.ops ?? []).map(runOp);
  await Bun.write(Bun.stdout, JSON.stringify({ results }));
}
