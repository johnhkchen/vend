import { expect, mock, test } from "bun:test";
import {
  awaitChildClose,
  buildArgs,
  type ChildLike,
  ClaudeTimeoutError,
  createLineBuffer,
  extractModelId,
  makeStreamConsumer,
  parseStreamJsonLine,
  type StreamMessage,
} from "./claude.ts";

// Unit tests for the PURE seam helpers + the timeout latch (T-001-02 AC #3). No
// live `claude` spawn anywhere — the timeout latch is exercised with a fake child
// and the stream parsing with sample stream-json lines. `dispense` (the one impure,
// process-spawning function) is intentionally not unit-tested.

// ── buildArgs ───────────────────────────────────────────────────────────────

test("buildArgs: base flags with no options", () => {
  expect(buildArgs()).toEqual(["-p", "--output-format", "stream-json", "--verbose"]);
  expect(buildArgs({})).toEqual(["-p", "--output-format", "stream-json", "--verbose"]);
});

test("buildArgs: appends model/effort/system when supplied", () => {
  expect(buildArgs({ model: "claude-opus-4-8", effort: "high", system: "be terse" })).toEqual([
    "-p",
    "--output-format",
    "stream-json",
    "--verbose",
    "--model",
    "claude-opus-4-8",
    "--effort",
    "high",
    "--system-prompt",
    "be terse",
  ]);
});

test("buildArgs: omits each flag independently", () => {
  expect(buildArgs({ model: "m" })).toEqual([
    "-p", "--output-format", "stream-json", "--verbose", "--model", "m",
  ]);
  expect(buildArgs({ effort: "low" })).toEqual([
    "-p", "--output-format", "stream-json", "--verbose", "--effort", "low",
  ]);
  expect(buildArgs({ system: "s" })).toEqual([
    "-p", "--output-format", "stream-json", "--verbose", "--system-prompt", "s",
  ]);
});

test("buildArgs: appends max-turns when supplied, composes with all flags (last, stringified)", () => {
  expect(buildArgs({ model: "m", effort: "low", system: "s", maxTurns: 5 })).toEqual([
    "-p", "--output-format", "stream-json", "--verbose",
    "--model", "m", "--effort", "low", "--system-prompt", "s", "--max-turns", "5",
  ]);
});

test("buildArgs: max-turns alone", () => {
  expect(buildArgs({ maxTurns: 3 })).toEqual([
    "-p", "--output-format", "stream-json", "--verbose", "--max-turns", "3",
  ]);
});

test("buildArgs: max-turns absent ⇒ no flag (argv identical to today)", () => {
  expect(buildArgs()).not.toContain("--max-turns");
  expect(buildArgs({ model: "m" })).not.toContain("--max-turns");
});

test("buildArgs: max-turns 0 is treated as absent (falsy guard)", () => {
  expect(buildArgs({ maxTurns: 0 })).toEqual(["-p", "--output-format", "stream-json", "--verbose"]);
});

// ── buildArgs tool scoping (E-032, T-032-01) ─────────────────────────────────

test("buildArgs: mcpConfig alone appends --mcp-config <path>", () => {
  expect(buildArgs({ mcpConfig: ".vend/mcp.json" })).toEqual([
    "-p", "--output-format", "stream-json", "--verbose", "--mcp-config", ".vend/mcp.json",
  ]);
});

test("buildArgs: allowedTools comma-joins into ONE argv element", () => {
  expect(buildArgs({ allowedTools: ["Read", "Grep"] })).toEqual([
    "-p", "--output-format", "stream-json", "--verbose", "--allowedTools", "Read,Grep",
  ]);
});

test("buildArgs: empty allowedTools array emits no flag (length guard)", () => {
  expect(buildArgs({ allowedTools: [] })).toEqual(["-p", "--output-format", "stream-json", "--verbose"]);
  expect(buildArgs({ allowedTools: [] })).not.toContain("--allowedTools");
});

test("buildArgs: strictMcp true appends --strict-mcp-config; false omits it", () => {
  expect(buildArgs({ strictMcp: true })).toEqual([
    "-p", "--output-format", "stream-json", "--verbose", "--strict-mcp-config",
  ]);
  expect(buildArgs({ strictMcp: false })).not.toContain("--strict-mcp-config");
});

test("buildArgs: all tool flags compose after model/effort/system/max-turns, in order", () => {
  expect(
    buildArgs({
      model: "m",
      effort: "low",
      system: "s",
      maxTurns: 5,
      mcpConfig: "cfg.json",
      allowedTools: ["Read", "Bash(git *)"],
      strictMcp: true,
    }),
  ).toEqual([
    "-p", "--output-format", "stream-json", "--verbose",
    "--model", "m", "--effort", "low", "--system-prompt", "s", "--max-turns", "5",
    "--mcp-config", "cfg.json", "--allowedTools", "Read,Bash(git *)", "--strict-mcp-config",
  ]);
});

test("buildArgs: no tool options ⇒ argv byte-identical to today (back-compat)", () => {
  const base = buildArgs({ model: "m" });
  expect(base).not.toContain("--mcp-config");
  expect(base).not.toContain("--allowedTools");
  expect(base).not.toContain("--strict-mcp-config");
  expect(buildArgs()).toEqual(["-p", "--output-format", "stream-json", "--verbose"]);
});

// ── parseStreamJsonLine ──────────────────────────────────────────────────────

test("parseStreamJsonLine: parses a valid JSON object", () => {
  expect(parseStreamJsonLine('{"type":"assistant","x":1}')).toEqual({ type: "assistant", x: 1 });
});

test("parseStreamJsonLine: blank / whitespace → null", () => {
  expect(parseStreamJsonLine("")).toBeNull();
  expect(parseStreamJsonLine("   \t ")).toBeNull();
});

test("parseStreamJsonLine: non-JSON noise → null", () => {
  expect(parseStreamJsonLine("not json")).toBeNull();
  expect(parseStreamJsonLine("[warn] something happened")).toBeNull();
});

// ── createLineBuffer ─────────────────────────────────────────────────────────

test("createLineBuffer: two complete lines in one chunk, in order", () => {
  const lines: string[] = [];
  const b = createLineBuffer((l) => lines.push(l));
  b.push("a\nb\n");
  expect(lines).toEqual(["a", "b"]);
});

test("createLineBuffer: a line split across pushes is emitted once, whole", () => {
  const lines: string[] = [];
  const b = createLineBuffer((l) => lines.push(l));
  b.push("hel");
  expect(lines).toEqual([]); // nothing complete yet
  b.push("lo\nworld\n");
  expect(lines).toEqual(["hello", "world"]);
});

test("createLineBuffer: flush emits a trailing unterminated line, then nothing", () => {
  const lines: string[] = [];
  const b = createLineBuffer((l) => lines.push(l));
  b.push("tail-no-newline");
  expect(lines).toEqual([]);
  b.flush();
  expect(lines).toEqual(["tail-no-newline"]);
  b.flush(); // buffer cleared — second flush emits nothing
  expect(lines).toEqual(["tail-no-newline"]);
});

test("createLineBuffer: flush on empty/blank buffer emits nothing", () => {
  const lines: string[] = [];
  const b = createLineBuffer((l) => lines.push(l));
  b.flush();
  b.push("   ");
  b.flush();
  expect(lines).toEqual([]);
});

// ── makeStreamConsumer (the real parse/route/capture path) ───────────────────

const SAMPLE_LINES = [
  '{"type":"system","subtype":"init","session_id":"s1"}',
  '{"type":"assistant","message":{"role":"assistant","usage":{"input_tokens":10,"output_tokens":3}}}',
  '{"type":"result","subtype":"success","result":"hi","usage":{"input_tokens":10,"output_tokens":3},"total_cost_usd":0.002}',
];

test("makeStreamConsumer: routes every message in order and captures terminal result", () => {
  const seen: string[] = [];
  const { buffer, state } = makeStreamConsumer((m) => seen.push(m.type));
  buffer.push(SAMPLE_LINES.join("\n") + "\n");
  expect(seen).toEqual(["system", "assistant", "result"]);
  expect(state.result).not.toBeNull();
  expect(state.result?.subtype).toBe("success");
  expect(state.result?.total_cost_usd).toBe(0.002);
  expect(state.result?.usage).toEqual({ input_tokens: 10, output_tokens: 3 });
});

test("makeStreamConsumer: lines split across chunk boundaries still route correctly", () => {
  const seen: StreamMessage[] = [];
  const { buffer, state } = makeStreamConsumer((m) => seen.push(m));
  const whole = SAMPLE_LINES.join("\n"); // note: no trailing newline → last line needs flush
  buffer.push(whole.slice(0, 20));
  buffer.push(whole.slice(20));
  buffer.flush();
  expect(seen.map((m) => m.type)).toEqual(["system", "assistant", "result"]);
  expect(state.result?.subtype).toBe("success");
});

test("makeStreamConsumer: noise lines are skipped, not routed", () => {
  const seen: string[] = [];
  const { buffer, state } = makeStreamConsumer((m) => seen.push(m.type));
  buffer.push("garbage line\n");
  buffer.push('{"type":"result","subtype":"success"}\n');
  buffer.push("trailing noise\n");
  expect(seen).toEqual(["result"]);
  expect(state.result?.subtype).toBe("success");
});

test("makeStreamConsumer: no result line leaves state.result null", () => {
  const { buffer, state } = makeStreamConsumer();
  buffer.push('{"type":"system"}\n{"type":"assistant"}\n');
  expect(state.result).toBeNull();
});

// ── extractModelId + model capture (T-005-01) ────────────────────────────────

test("extractModelId: assistant message.model is read", () => {
  expect(extractModelId({ type: "assistant", message: { role: "assistant", model: "claude-opus-4-8[1m]" } })).toBe(
    "claude-opus-4-8[1m]",
  );
});

test("extractModelId: system top-level model is read", () => {
  expect(extractModelId({ type: "system", subtype: "init", model: "claude-opus-4-8[1m]" })).toBe("claude-opus-4-8[1m]");
});

test("extractModelId: nested message.model wins over top-level model", () => {
  expect(extractModelId({ type: "assistant", model: "top", message: { model: "nested" } })).toBe("nested");
});

test("extractModelId: no model anywhere → undefined", () => {
  expect(extractModelId({ type: "assistant", message: { role: "assistant" } })).toBeUndefined();
  expect(extractModelId({ type: "user" })).toBeUndefined();
});

test("extractModelId: empty-string model is ignored (not a real id)", () => {
  expect(extractModelId({ type: "system", model: "" })).toBeUndefined();
  expect(extractModelId({ type: "assistant", message: { model: "" } })).toBeUndefined();
});

const MODEL_LINES = [
  '{"type":"system","subtype":"init","session_id":"s1"}',
  '{"type":"assistant","message":{"role":"assistant","model":"claude-opus-4-8[1m]","usage":{"input_tokens":10}}}',
  '{"type":"result","subtype":"success","result":"hi","usage":{"input_tokens":10,"output_tokens":3}}',
];

test("makeStreamConsumer: captures the real model id off the stream (not the terminal result)", () => {
  const { buffer, state } = makeStreamConsumer();
  buffer.push(MODEL_LINES.join("\n") + "\n");
  expect(state.model).toBe("claude-opus-4-8[1m]");
  expect(state.result).not.toBeNull();
  expect(state.result?.model).toBeUndefined(); // the terminal result line carried none
});

test("makeStreamConsumer: last non-empty model wins (assistant after system)", () => {
  const { buffer, state } = makeStreamConsumer();
  buffer.push('{"type":"system","subtype":"init","model":"sys-model"}\n');
  buffer.push('{"type":"assistant","message":{"model":"asst-model"}}\n');
  expect(state.model).toBe("asst-model");
});

test("makeStreamConsumer: a model-less stream leaves state.model undefined", () => {
  const { buffer, state } = makeStreamConsumer();
  buffer.push(SAMPLE_LINES.join("\n") + "\n");
  expect(state.model).toBeUndefined();
});

// ── awaitChildClose (fake child = ChildLike) ─────────────────────────────────

/** A minimal fake child satisfying ChildLike: a callback registry + a kill spy. */
function fakeChild() {
  let onError: ((e: Error) => void) | undefined;
  let onClose: ((code: number | null) => void) | undefined;
  const kill = mock((_signal?: string | number) => {});
  const child: ChildLike = {
    on(event: "error" | "close", cb: (arg: never) => void) {
      if (event === "error") onError = cb as (e: Error) => void;
      else onClose = cb as (code: number | null) => void;
      return child;
    },
    kill,
  };
  return {
    child,
    kill,
    emitError: (e: Error) => onError?.(e),
    emitClose: (code: number | null) => onClose?.(code),
  };
}

test("awaitChildClose: resolves with exit code on close", async () => {
  const f = fakeChild();
  const p = awaitChildClose(f.child);
  f.emitClose(0);
  expect(await p).toBe(0);
});

test("awaitChildClose: rejects with a launch-failure error on 'error'", async () => {
  const f = fakeChild();
  const p = awaitChildClose(f.child, { cli: "claude" });
  f.emitError(new Error("ENOENT"));
  await expect(p).rejects.toThrow(/failed to launch .*ENOENT/);
});

test("awaitChildClose: timeout SIGKILLs the child and rejects ClaudeTimeoutError", async () => {
  const f = fakeChild(); // never closes
  let caught: unknown;
  await awaitChildClose(f.child, { timeoutMs: 5 }).catch((e) => {
    caught = e;
  });
  expect(caught).toBeInstanceOf(ClaudeTimeoutError);
  expect(f.kill).toHaveBeenCalledWith("SIGKILL");
  const err = caught as ClaudeTimeoutError;
  expect(err.code).toBe("ETIMEDOUT_CLAUDE");
  expect(err.timeoutMs).toBe(5);
});

test("awaitChildClose: latch — close wins, a later timeout does not re-settle or kill", async () => {
  const f = fakeChild();
  const p = awaitChildClose(f.child, { timeoutMs: 50 });
  f.emitClose(0); // settles before the timer
  expect(await p).toBe(0);
  // wait past the original deadline; the timer must have been cleared on settle
  await new Promise((r) => setTimeout(r, 70));
  expect(f.kill).not.toHaveBeenCalled();
});

test("awaitChildClose: no timeoutMs — resolves on close with no kill, no dangling timer", async () => {
  const f = fakeChild();
  const p = awaitChildClose(f.child);
  f.emitClose(3);
  expect(await p).toBe(3);
  expect(f.kill).not.toHaveBeenCalled();
});

// ── ClaudeTimeoutError ───────────────────────────────────────────────────────

test("ClaudeTimeoutError: typed fields and message", () => {
  const e = new ClaudeTimeoutError(1234, "claude");
  expect(e).toBeInstanceOf(Error);
  expect(e.name).toBe("ClaudeTimeoutError");
  expect(e.code).toBe("ETIMEDOUT_CLAUDE");
  expect(e.timeoutMs).toBe(1234);
  expect(e.message).toContain("1234ms");
  expect(e.message).toContain("claude -p");
});
