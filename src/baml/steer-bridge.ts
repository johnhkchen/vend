// Standalone BAML render/parse bridge for SteerProject-lite (T-018-01) — AUTHORING ONLY. The sixth-play
// sibling of propose-bridge.ts / note-bridge.ts / decompose-bridge.ts / expand-bridge.ts / survey-bridge.ts,
// and for the same reason: the BAML native addon allows exactly ONE successful native call per `bun test`
// process (its once-driven runtime reactor hangs the second), so the test cannot call `b.request`/`b.parse`
// directly. Instead steer.test.ts spawns THIS script in a child `bun` process, which performs all
// render/parse ops and emits the results as JSON on stdout. Render-only: `b.request` builds the prompt and
// `b.parse` SAP-parses canned text; NOTHING is dispatched to a model from here (the live seam is
// src/executor/claude.ts). Mirrors survey-bridge.ts exactly; `extractPromptText` (the pure reach-in that
// pulls the rendered prompt out of the request body) is IMPORTED from decompose-bridge.ts, not
// re-implemented — it is already fully play-agnostic.
//
// Protocol: read `{ ops: SteerBridgeOp[] }` from stdin, write `{ results: SteerBridgeResult[] }` to
// stdout, one result per op, in order. A failing op yields `{ ok: false, error }` rather than crashing
// the batch.

import { b } from "../../baml_client/sync_client.ts";
import type { Steer } from "../../baml_client/index.ts";
import { extractPromptText } from "./decompose-bridge.ts";

/** A render op renders the prompt from the two inputs; a parse op SAP-parses a reply into a Steer. */
export type SteerBridgeOp =
  | { mode: "render"; project: string; charter: string }
  | { mode: "parse"; text: string };

export type SteerBridgeResult =
  | { ok: true; mode: "render"; prompt: string }
  | { ok: true; mode: "parse"; steer: Steer }
  | { ok: false; error: string };

/** Run one op. Render reads the env key only to BUILD the request (never sent). */
export function runOp(op: SteerBridgeOp): SteerBridgeResult {
  try {
    if (op.mode === "parse") {
      return { ok: true, mode: "parse", steer: b.parse.SteerProject(op.text) };
    }
    const req = b.request.SteerProject(op.project, op.charter) as unknown as {
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
  const input = JSON.parse(await Bun.stdin.text()) as { ops: SteerBridgeOp[] };
  const results = (input.ops ?? []).map(runOp);
  await Bun.write(Bun.stdout, JSON.stringify({ results }));
}
