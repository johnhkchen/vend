import { expect, test } from "bun:test";
import { OPENAI_EXECUTOR_ID } from "../executor/openai-compat.ts";
import { OPEN_MODEL_CLIENT, RENDER_CLIENT_BY_EXECUTOR, renderClientFor } from "./render-client.ts";

// T-036-02 render-client selection: a PURE projection of E-035's executor selection onto the BAML
// render client, so the render FOLLOWS `VEND_EXECUTOR` (no parallel switch). No BAML import here —
// these are addon-free unit tests with injected opts/env. The whole point of part 1's selection
// logic lives here; the production render closure just calls renderClientFor() and reads env.

// ── default ⇒ undefined (omit the {client} option ⇒ byte-identical ClaudeStub) ───────────────────

test("renderClientFor: no opts/env ⇒ undefined (default ⇒ ClaudeStub, byte-identical)", () => {
  expect(renderClientFor({}, {})).toBeUndefined();
});

test("renderClientFor: VEND_EXECUTOR=claude ⇒ undefined (explicit default ⇒ ClaudeStub)", () => {
  expect(renderClientFor({}, { VEND_EXECUTOR: "claude" })).toBeUndefined();
});

// ── openai-compat ⇒ OpenModelStub (render follows the executor) ───────────────────────────────────

test("renderClientFor: VEND_EXECUTOR=openai-compat ⇒ OpenModelStub", () => {
  expect(renderClientFor({}, { VEND_EXECUTOR: "openai-compat" })).toBe(OPEN_MODEL_CLIENT);
});

test("renderClientFor: explicit opt executor=openai-compat ⇒ OpenModelStub", () => {
  expect(renderClientFor({ executor: "openai-compat" }, {})).toBe(OPEN_MODEL_CLIENT);
});

// ── precedence (reused from executorFor): explicit opt beats env ─────────────────────────────────

test("renderClientFor: explicit opt beats env (opt openai-compat, env claude ⇒ OpenModelStub)", () => {
  expect(renderClientFor({ executor: "openai-compat" }, { VEND_EXECUTOR: "claude" })).toBe(OPEN_MODEL_CLIENT);
});

test("renderClientFor: env selects the open model when no opt", () => {
  expect(renderClientFor({}, { VEND_EXECUTOR: OPENAI_EXECUTOR_ID })).toBe(OPEN_MODEL_CLIENT);
});

// ── unknown id ⇒ undefined (renders default; fails loudly later at the executor seam) ─────────────

test("renderClientFor: unknown executor id ⇒ undefined (default render; executorFor throws at dispense)", () => {
  expect(renderClientFor({}, { VEND_EXECUTOR: "nope" })).toBeUndefined();
});

// ── the map is keyed by the real executor id (guards against id drift) ────────────────────────────

test("RENDER_CLIENT_BY_EXECUTOR maps the real OPENAI_EXECUTOR_ID to OpenModelStub", () => {
  expect(RENDER_CLIENT_BY_EXECUTOR[OPENAI_EXECUTOR_ID]).toBe(OPEN_MODEL_CLIENT);
  // claude is deliberately absent ⇒ default path omits the option.
  expect(RENDER_CLIENT_BY_EXECUTOR.claude).toBeUndefined();
});
