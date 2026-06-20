// Render-client selection (T-036-02) — makes the BAML render client FOLLOW E-035's executor
// selection so the open-model path is coherent end to end:
//   render (BAML, open-model client) → dispense (E-035 OpenAICompatExecutor) → parse (BAML).
//
// This is a PURE projection of "which executor is selected" onto "which BAML render client to
// target". It reuses E-035's id resolution (`resolveExecutorId`) verbatim — there is no parallel
// switch and no new env var; `VEND_EXECUTOR=openai-compat` drives BOTH the dispatch executor and
// the render client. The value (`OpenModelStub`) is the BAML client declared in
// baml_src/clients.baml (T-036-01). The default (Claude / unknown ids) maps to `undefined`, which
// the render call site turns into "omit the { client } option" ⇒ byte-identical default render.
//
// DEPENDENCY DIRECTION: this module (src/baml) imports the executor *id* (a selection fact) and
// owns the projection to the BAML authoring name. The executor module never imports baml — keeping
// the graph acyclic and keeping BAML client names out of the executor layer.

import { resolveExecutorId, type ExecutorSelection } from "../executor/select.ts";
import { OPENAI_EXECUTOR_ID } from "../executor/openai-compat.ts";

/** The open-model render client declared in baml_src/clients.baml (T-036-01, openai-generic). */
export const OPEN_MODEL_CLIENT = "OpenModelStub";

/**
 * executor id → BAML render-client name. Only the open-model executor maps to a non-default client;
 * every other id (claude + any unknown) is absent ⇒ {@link renderClientFor} returns `undefined` ⇒
 * the render omits the `{ client }` option ⇒ the byte-identical default (`ClaudeStub`). Keyed by the
 * exported `OPENAI_EXECUTOR_ID` (not a literal) so an executor-id rename moves this mapping with it.
 */
export const RENDER_CLIENT_BY_EXECUTOR: Readonly<Record<string, string>> = {
  [OPENAI_EXECUTOR_ID]: OPEN_MODEL_CLIENT,
};

/**
 * The BAML client the render should target so it FOLLOWS the executor selection (E-035). Resolves
 * the executor id through the SAME function {@link executorFor} uses, then projects it to the render
 * client name. `undefined` ⇒ omit the `{ client }` option ⇒ byte-identical default render. An
 * unknown id also returns `undefined` (renders default, then fails loudly at the executor seam —
 * `executorFor` throws — so the render layer need not re-throw).
 */
export function renderClientFor(
  opts: ExecutorSelection = {},
  env: Record<string, string | undefined> = process.env,
): string | undefined {
  return RENDER_CLIENT_BY_EXECUTOR[resolveExecutorId(opts, env)];
}
