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

/** A render op renders the prompt from the three inputs; a parse op SAP-parses a reply. */
export type BridgeOp =
  | { mode: "render"; epic: string; charter: string; project: string }
  | { mode: "parse"; text: string };

export type BridgeResult =
  | { ok: true; mode: "render"; prompt: string }
  | { ok: true; mode: "parse"; plan: WorkPlan }
  | { ok: false; error: string };

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
    const req = b.request.DecomposeEpic(op.epic, op.charter, op.project) as unknown as {
      body: { json: () => { messages?: unknown[] } };
    };
    return { ok: true, mode: "render", prompt: extractPromptText(req) };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
}

// Entry point: only runs when executed directly (not when imported by a test for its
// pure helpers). Render-only key guard set process-wide for this short-lived child.
if (import.meta.main) {
  process.env.ANTHROPIC_API_KEY ??= "baml-render-only";
  const input = JSON.parse(await Bun.stdin.text()) as { ops: BridgeOp[] };
  const results = (input.ops ?? []).map(runOp);
  await Bun.write(Bun.stdout, JSON.stringify({ results }));
}
