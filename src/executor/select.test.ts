import { expect, test } from "bun:test";
import { ClaudeExecutor, ClaudeTimeoutError, type DispenseOptions, type ResultMessage } from "./claude.ts";
import { ExecutorTimeoutError, type Executor } from "./executor.ts";
import { builtinExecutors, DEFAULT_EXECUTOR_ID, executorFor, type ExecutorRegistry } from "./select.ts";

// Pure unit tests for the executor selector + the generalized timeout error (T-035-01). No
// spawn anywhere — `ClaudeExecutor` is constructed but never dispenses (its delegate is
// proven by the cast integration test); selection logic is exercised with an injected
// registry so "selects an alternate when requested" holds before the second real executor
// (T-035-02) exists.

/** A do-nothing stub Executor — proves selection by identity, never dispenses for real. */
function stubExecutor(id = "stub"): Executor {
  return {
    id,
    dispense(_opts: DispenseOptions): Promise<ResultMessage> {
      return Promise.resolve({ type: "result", subtype: "success" } as ResultMessage);
    },
  };
}

// ── executorFor: default ─────────────────────────────────────────────────────

test("executorFor: no opts/env defaults to Claude", () => {
  const ex = executorFor({}, {});
  expect(ex).toBeInstanceOf(ClaudeExecutor);
  expect(ex.id).toBe("claude");
  expect(DEFAULT_EXECUTOR_ID).toBe("claude");
});

test("executorFor: no args at all defaults to Claude (reads real env, claude is default)", () => {
  // With VEND_EXECUTOR unset in the test env this resolves to the built-in default.
  const ex = executorFor();
  expect(ex.id).toBe("claude");
});

test("executorFor: VEND_EXECUTOR=claude selects Claude", () => {
  const ex = executorFor({}, { VEND_EXECUTOR: "claude" });
  expect(ex).toBeInstanceOf(ClaudeExecutor);
});

// ── executorFor: selects an alternate when requested ─────────────────────────

test("executorFor: an injected registry selects the requested alternate", () => {
  const stub = stubExecutor();
  const registry: ExecutorRegistry = { stub: () => stub };
  expect(executorFor({ executor: "stub" }, {}, registry)).toBe(stub);
});

test("executorFor: env can select an alternate from the registry", () => {
  const stub = stubExecutor("other");
  const registry: ExecutorRegistry = { claude: () => new ClaudeExecutor(), other: () => stub };
  expect(executorFor({}, { VEND_EXECUTOR: "other" }, registry)).toBe(stub);
});

// ── executorFor: precedence opt > env > default ──────────────────────────────

test("executorFor: explicit opt beats env", () => {
  const claudeStub = stubExecutor("claude");
  const stub = stubExecutor("stub");
  const registry: ExecutorRegistry = { claude: () => claudeStub, stub: () => stub };
  expect(executorFor({ executor: "stub" }, { VEND_EXECUTOR: "claude" }, registry)).toBe(stub);
});

test("executorFor: env beats default when no opt", () => {
  const stub = stubExecutor("stub");
  const registry: ExecutorRegistry = { claude: () => new ClaudeExecutor(), stub: () => stub };
  expect(executorFor({}, { VEND_EXECUTOR: "stub" }, registry)).toBe(stub);
});

// ── executorFor: unknown id is a loud error, never a silent fallback ──────────

test("executorFor: unknown id throws listing the known ids", () => {
  expect(() => executorFor({ executor: "nope" }, {}, { claude: () => new ClaudeExecutor() })).toThrow(
    /unknown executor "nope" — known: claude/,
  );
});

test("executorFor: empty registry throws with (none)", () => {
  expect(() => executorFor({ executor: "x" }, {}, {})).toThrow(/known: \(none\)/);
});

// ── builtinExecutors ─────────────────────────────────────────────────────────

test("builtinExecutors: claude factory yields a ClaudeExecutor", () => {
  expect(builtinExecutors.claude?.()).toBeInstanceOf(ClaudeExecutor);
});

// ── ExecutorTimeoutError generalization (the AC1 instanceof guarantee) ────────

test("ExecutorTimeoutError: base fields and message", () => {
  const e = new ExecutorTimeoutError(500, "executor timed out");
  expect(e).toBeInstanceOf(Error);
  expect(e.name).toBe("ExecutorTimeoutError");
  expect(e.code).toBe("ETIMEDOUT_EXECUTOR");
  expect(e.timeoutMs).toBe(500);
  expect(e.message).toBe("executor timed out");
});

test("ClaudeTimeoutError is an ExecutorTimeoutError (generalization holds)", () => {
  const e = new ClaudeTimeoutError(1234, "claude");
  expect(e).toBeInstanceOf(ExecutorTimeoutError); // the new general check (castPlay keys on this)
  expect(e).toBeInstanceOf(ClaudeTimeoutError); // the historical check still holds
  expect(e).toBeInstanceOf(Error);
  expect(e.code).toBe("ETIMEDOUT_CLAUDE"); // subclass override wins
  expect(e.timeoutMs).toBe(1234);
  expect(e.name).toBe("ClaudeTimeoutError");
});
