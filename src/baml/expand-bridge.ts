// Standalone BAML render/parse bridge for ExpandFragment (T-016-01) — AUTHORING ONLY. The
// fourth-play sibling of propose-bridge.ts / note-bridge.ts / decompose-bridge.ts, and for the same
// reason: the BAML native addon allows exactly ONE successful native call per `bun test` process
// (its once-driven runtime reactor hangs the second), so the test cannot call `b.request`/`b.parse`
// directly. Instead expand.test.ts spawns THIS script in a child `bun` process, which performs all
// render/parse ops and emits the results as JSON on stdout. Render-only: `b.request` builds the
// prompt and `b.parse` SAP-parses canned text; NOTHING is dispatched to a model from here (the live
// seam is src/executor/claude.ts). Mirrors propose-bridge.ts exactly; `extractPromptText` (the pure
// reach-in that pulls the rendered prompt out of the request body) is IMPORTED from
// decompose-bridge.ts, not re-implemented — it is already fully play-agnostic.
//
// Protocol: read `{ ops: ExpandBridgeOp[] }` from stdin, write `{ results: ExpandBridgeResult[] }`
// to stdout, one result per op, in order. A failing op yields `{ ok: false, error }` rather than
// crashing the batch.

import { b } from "../../baml_client/sync_client.ts";
import type { Signal } from "../../baml_client/index.ts";
import { extractPromptText } from "./decompose-bridge.ts";

/** A render op renders the prompt from the three inputs; a parse op SAP-parses a reply. */
export type ExpandBridgeOp =
  | { mode: "render"; fragment: string; charter: string; project: string }
  | { mode: "parse"; text: string };

export type ExpandBridgeResult =
  | { ok: true; mode: "render"; prompt: string }
  | { ok: true; mode: "parse"; signal: Signal }
  | { ok: false; error: string };

/** Run one op. Render reads the env key only to BUILD the request (never sent). */
export function runOp(op: ExpandBridgeOp): ExpandBridgeResult {
  try {
    if (op.mode === "parse") {
      return { ok: true, mode: "parse", signal: b.parse.ExpandFragment(op.text) };
    }
    const req = b.request.ExpandFragment(op.fragment, op.charter, op.project) as unknown as {
      body: { json: () => { messages?: unknown[] } };
    };
    return { ok: true, mode: "render", prompt: extractPromptText(req) };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
}

// Entry point: only runs when executed directly (not when imported by a test for its types).
// Render-only key guard set process-wide for this short-lived child.
if (import.meta.main) {
  process.env.ANTHROPIC_API_KEY ??= "baml-render-only";
  const input = JSON.parse(await Bun.stdin.text()) as { ops: ExpandBridgeOp[] };
  const results = (input.ops ?? []).map(runOp);
  await Bun.write(Bun.stdout, JSON.stringify({ results }));
}
