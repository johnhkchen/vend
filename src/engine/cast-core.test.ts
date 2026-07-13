import { describe, expect, test } from "bun:test";
import type { BudgetOutcome } from "../budget/budget.ts";
import type { GateVerdict } from "./play.ts";
import type { StreamMessage } from "../executor/claude.ts";
import { buildArgs } from "../executor/claude.ts";
import type { PlayTools } from "./play.ts";
import { DECOMPOSE_TOOLS } from "../play/decompose-epic-core.ts";
import { AUTONOMOUS_DENY } from "../play/autonomous-deny.ts";
import {
  accumulateCastProgress,
  castGateRows,
  classify,
  DEFAULT_MODEL,
  EMPTY_CAST_PROGRESS,
  formatCastProgress,
  formatMessage,
  formatTurnSummary,
  makeStreamSink,
  resolveLoggedModel,
  resolveMaxTurns,
  resolveSeatOfExecution,
  settleCrossReview,
  resolveTools,
  resolveTurnsUsed,
  toolFlags,
} from "./cast-core.ts";

// T-007-02 generic cast loop: the PURE decision core. We import ONLY ./cast-core.ts (never
// ./cast.ts, which value-imports the executor seam, nor any baml module) so this `bun test`
// process loads no native addon and spawns nothing — an ordinary pure-function test (the
// gates.test.ts / decompose-epic.test.ts discipline). `castPlay` is the impure verb and is
// not exercised here; its logic is this tested core, proven live in T-007-03.

const okBudget: BudgetOutcome = { status: "ok", spent: 100, ceiling: 1000, remaining: 900 };
const exhausted: BudgetOutcome = { status: "exhausted", code: "EBUDGET_EXHAUSTED", spent: 1200, ceiling: 1000, overage: 200 };
const cleared: GateVerdict = { status: "clear" };
const clearedNamed: GateVerdict = { status: "clear", cleared: ["value", "allocation", "bounds", "structural"] };
const stopped: GateVerdict = { status: "stop", gate: "value", unit: "<plan>", reason: "plan has no tickets" };

describe("classify — terminal outcome + materialize decision (play-generic)", () => {
  test("an unreachable executor is missing-capability before timeout, budget, or gate classification", () => {
    const v = classify({
      executorProbe: {
        ok: false,
        reason: "claude config store/Keychain is unreadable",
        hint: "run `claude login`; grant the sandbox access to the Keychain",
      },
      timedOut: true,
      budgetOutcome: exhausted,
      gateVerdict: stopped,
    });
    expect(v.outcome).toBe("missing-capability");
    expect(v.materialize).toBe(false);
    expect(v.overEnvelope).toBeUndefined();
    expect(v.gateLog).toEqual([]);
  });

  test("timeout outranks everything; no materialize", () => {
    const v = classify({ timedOut: true, budgetOutcome: null, gateVerdict: null });
    expect(v.outcome).toBe("timed-out");
    expect(v.materialize).toBe(false);
    expect(v.overEnvelope).toBeUndefined();
    expect(v.gateLog).toEqual([]);
  });

  test("budget exhaustion + explicit CLEAR → success + materialize with an over-envelope warning", () => {
    const v = classify({ timedOut: false, budgetOutcome: exhausted, gateVerdict: cleared });
    expect(v.outcome).toBe("success");
    expect(v.materialize).toBe(true);
    expect(v.overEnvelope).toBe(true);
    expect(v.gateLog).toEqual([]);
  });

  test("a gate STOP still fails and discards when the budget is also exhausted", () => {
    const v = classify({ timedOut: false, budgetOutcome: exhausted, gateVerdict: stopped });
    expect(v.outcome).toBe("gate-failed");
    expect(v.materialize).toBe(false);
    expect(v.overEnvelope).toBeUndefined();
    expect(v.gateLog).toEqual([{ gate: "value", passed: false, detail: "<plan>: plan has no tickets" }]);
  });

  test("budget exhaustion without an explicit gate CLEAR remains censored and does not materialize", () => {
    const v = classify({ timedOut: false, budgetOutcome: exhausted, gateVerdict: null });
    expect(v.outcome).toBe("budget-exhausted");
    expect(v.materialize).toBe(false);
    expect(v.overEnvelope).toBeUndefined();
    expect(v.gateLog).toEqual([]);
  });

  test("a gate STOP (in budget) → gate-failed, no materialize, one failed gate row", () => {
    const v = classify({ timedOut: false, budgetOutcome: okBudget, gateVerdict: stopped });
    expect(v.outcome).toBe("gate-failed");
    expect(v.materialize).toBe(false);
    expect(v.overEnvelope).toBeUndefined();
    expect(v.gateLog).toEqual([{ gate: "value", passed: false, detail: "<plan>: plan has no tickets" }]);
  });

  test("cleared (opaque) + in budget → success + materialize; logs no per-gate rows", () => {
    const v = classify({ executorProbe: { ok: true }, timedOut: false, budgetOutcome: okBudget, gateVerdict: cleared });
    expect(v.outcome).toBe("success");
    expect(v.materialize).toBe(true);
    expect(v.overEnvelope).toBeUndefined();
    expect(v.gateLog).toEqual([]);
  });

  test("a clear that echoes `cleared` logs one passed row per gate (T-007-03 D3)", () => {
    const v = classify({ timedOut: false, budgetOutcome: okBudget, gateVerdict: clearedNamed });
    expect(v.outcome).toBe("success");
    expect(v.materialize).toBe(true);
    expect(v.overEnvelope).toBeUndefined();
    expect(v.gateLog).toEqual([
      { gate: "value", passed: true },
      { gate: "allocation", passed: true },
      { gate: "bounds", passed: true },
      { gate: "structural", passed: true },
    ]);
  });
});

describe("settleCrossReview — post-effect complement gate", () => {
  const base = classify({ timedOut: false, budgetOutcome: okBudget, gateVerdict: clearedNamed });

  test("an absent verdict is inert for a single-seat/no-diff cast", () => {
    expect(settleCrossReview(base, undefined)).toBe(base);
  });

  test("PASS preserves the clear and appends passed verdict evidence", () => {
    const settled = settleCrossReview(base, {
      authoringSeat: "claude",
      reviewingSeat: "codex",
      verdict: "pass",
    });

    expect(settled.outcome).toBe("success");
    expect(settled.materialize).toBe(true);
    expect(settled.gateLog.at(-1)).toEqual({ gate: "cross-vendor-review", passed: true });
    expect(settled.gateLog.slice(0, -1)).toEqual([...base.gateLog]);
  });

  test("FAIL blocks clear as gate-failed while preserving the honest landed-effect fact", () => {
    const settled = settleCrossReview(base, {
      authoringSeat: "claude",
      reviewingSeat: "codex",
      verdict: "fail",
      detail: "ticket acceptance is not proven",
    });

    expect(settled.outcome).toBe("gate-failed");
    expect(settled.materialize).toBe(true);
    expect(settled.gateLog.at(-1)).toEqual({
      gate: "cross-vendor-review",
      passed: false,
      detail: "ticket acceptance is not proven",
    });
    expect(settled.gateLog.slice(0, -1)).toEqual([...base.gateLog]);
  });
});

describe("castGateRows — GateVerdict → run-log rows", () => {
  test("STOP → one failed row carrying the real gate, unit, and reason", () => {
    expect(castGateRows(stopped)).toEqual([{ gate: "value", passed: false, detail: "<plan>: plan has no tickets" }]);
  });
  test("CLEAR with no `cleared` → [] (the verdict is opaque on clear by default)", () => {
    expect(castGateRows(cleared)).toEqual([]);
  });
  test("CLEAR echoing `cleared` → one passed row per named gate, in order", () => {
    expect(castGateRows(clearedNamed)).toEqual([
      { gate: "value", passed: true },
      { gate: "allocation", passed: true },
      { gate: "bounds", passed: true },
      { gate: "structural", passed: true },
    ]);
  });
  test("null (never gated) → []", () => {
    expect(castGateRows(null)).toEqual([]);
  });
});

describe("formatMessage — total, never throws", () => {
  test("names known types and an unknown one", () => {
    expect(formatMessage({ type: "assistant" })).toBe("· assistant");
    expect(formatMessage({ type: "result", subtype: "success" })).toBe("· result (success)");
    expect(formatMessage({ type: "system", subtype: "init" })).toBe("· system (init)");
    expect(formatMessage({} as StreamMessage)).toBe("· ?");
  });
});

describe("cast progress — per-turn weighted spend + humane line (T-072-02-01)", () => {
  const perTurnUsage = { input_tokens: 10_000, output_tokens: 4_000 }; // 10k + 4k·5 = 30k
  const assistant = (id: string): StreamMessage => ({
    type: "assistant",
    message: { id, usage: perTurnUsage, content: [{ type: "text", text: id }] },
  });

  test("fixture accumulates each assistant turn once and renders the acceptance line", () => {
    const fixture: StreamMessage[] = [
      { type: "system", subtype: "init" },
      assistant("turn-1"),
      // Claude repeats one nested message id for thinking/text/tool-use blocks. This must not
      // charge a second 30k or advance the turn count.
      assistant("turn-1"),
      { type: "user", message: { role: "user", content: "tool result" } },
      assistant("turn-2"),
      { type: "system", subtype: "thinking_tokens" },
      assistant("turn-3"),
      assistant("turn-4"),
      { type: "rate_limit_event" },
      assistant("turn-5"),
      assistant("turn-6"),
      assistant("turn-7"),
      // Terminal usage is cumulative/authoritative and is not an eighth incremental turn.
      { type: "result", subtype: "success", usage: { input_tokens: 210_000 } },
      // A future/unknown event cannot opt itself into assistant accounting with lookalike fields.
      { type: "future_event", message: { id: "turn-8", usage: perTurnUsage } },
    ];

    const progress = fixture.reduce(accumulateCastProgress, EMPTY_CAST_PROGRESS);

    expect(progress.weightedTokens).toBe(210_000);
    expect(progress.turns).toBe(7);
    expect(progress.seenMessageIds).toEqual([
      "turn-1",
      "turn-2",
      "turn-3",
      "turn-4",
      "turn-5",
      "turn-6",
      "turn-7",
    ]);
    expect(formatCastProgress(progress, { elapsedMs: 252_000, tokenEnvelope: 500_000, maxTurns: 15 })).toBe(
      "elapsed 4m12s · 210k/500k · turn 7/15",
    );
  });

  test("usage-less, malformed, unknown, and duplicate messages are total no-ops", () => {
    const first = accumulateCastProgress(EMPTY_CAST_PROGRESS, assistant("only-turn"));
    const noops: StreamMessage[] = [
      {} as StreamMessage,
      { type: "assistant" },
      { type: "assistant", message: null },
      { type: "assistant", message: [] },
      { type: "assistant", message: { usage: perTurnUsage } },
      { type: "assistant", message: { id: "no-usage" } },
      { type: "assistant", message: { id: "array-usage", usage: [] } },
      { type: "unknown", message: { id: "looks-valid", usage: perTurnUsage } },
      { type: "result", usage: perTurnUsage },
      assistant("only-turn"),
    ];

    const after = noops.reduce(accumulateCastProgress, first);
    expect(after).toBe(first);
    expect(after.weightedTokens).toBe(30_000);
    expect(after.turns).toBe(1);
  });

  test("formatter handles seconds, hours, small units, and an absent turn cap", () => {
    expect(formatCastProgress(EMPTY_CAST_PROGRESS, { elapsedMs: 12_999, tokenEnvelope: 999 })).toBe(
      "elapsed 12s · 0/999 · turn 0",
    );
    expect(formatCastProgress(EMPTY_CAST_PROGRESS, { elapsedMs: 3_723_000, tokenEnvelope: 500_000, maxTurns: 15 })).toBe(
      "elapsed 1h02m03s · 0/500k · turn 0/15",
    );
  });
});

describe("formatTurnSummary — cap honesty across unlike Claude counters (T-072-04-01)", () => {
  test("characterizes num_turns as conversation events separate from the capped agent turns", () => {
    const line = formatTurnSummary({ agentTurns: 9, maxTurns: 15, executorReportedTurns: 18 });

    expect(line).toBe("· agent turns: 9 / 15 cap; executor conversation events: 18");
    expect(line).not.toContain("18 / 15 cap");
  });

  test("an anomalous over-cap agent observation renders separate facts, never an over-cap fraction", () => {
    const line = formatTurnSummary({ agentTurns: 18, maxTurns: 15, executorReportedTurns: 18 });

    expect(line).toBe(
      "· agent turns observed: 18; configured agent-turn cap: 15; executor conversation events: 18",
    );
    expect(line).not.toContain("18 / 15 cap");
  });

  test("uncapped, unobserved, and empty shapes remain explicit and total", () => {
    expect(formatTurnSummary({ agentTurns: 3, executorReportedTurns: 4 })).toBe(
      "· agent turns: 3; executor conversation events: 4",
    );
    expect(formatTurnSummary({ maxTurns: 15, executorReportedTurns: 1 })).toBe(
      "· configured agent-turn cap: 15; executor conversation events: 1",
    );
    expect(formatTurnSummary({})).toBeUndefined();
  });
});

describe("makeStreamSink — fans each message to both surfaces in order", () => {
  test("write gets the human line; sink gets the raw JSON; once each per message", () => {
    const lines: string[] = [];
    const raws: string[] = [];
    const onMessage = makeStreamSink({ write: (l) => lines.push(l), sink: (r) => raws.push(r) });
    const msgs: StreamMessage[] = [{ type: "system", subtype: "init" }, { type: "assistant" }, { type: "result", subtype: "success" }];
    for (const m of msgs) onMessage(m);
    expect(lines).toEqual(["· system (init)", "· assistant", "· result (success)"]);
    expect(raws.map((r) => JSON.parse(r).type)).toEqual(["system", "assistant", "result"]);
  });
});

describe("resolveLoggedModel — real id → pinned → sentinel", () => {
  test("the real stream id wins when present (even over a pin)", () => {
    expect(resolveLoggedModel("claude-opus-4-8[1m]", "claude-opus-4-8")).toBe("claude-opus-4-8[1m]");
  });
  test("falls back to the caller's pinned id when no real id was observed", () => {
    expect(resolveLoggedModel(undefined, "claude-sonnet-4-6")).toBe("claude-sonnet-4-6");
  });
  test("falls back to the DEFAULT_MODEL sentinel when neither is present (a timed-out run)", () => {
    expect(resolveLoggedModel(undefined, undefined)).toBe(DEFAULT_MODEL);
  });
});

describe("resolveSeatOfExecution — resolved executor id → KNOWN_SEATS lane (T-071-01-02)", () => {
  test("the Claude executor burns the claude lane", () => {
    expect(resolveSeatOfExecution("claude")).toBe("claude");
  });

  test("the OpenAI-compatible executor burns the codex lane", () => {
    expect(resolveSeatOfExecution("openai-compat")).toBe("codex");
  });

  test("an unmapped executor stays lane-less rather than defaulting", () => {
    expect(resolveSeatOfExecution("stub")).toBeUndefined();
    expect(resolveSeatOfExecution("Claude")).toBeUndefined();
    expect(resolveSeatOfExecution("")).toBeUndefined();
  });
});

describe("resolveMaxTurns — per-cast override wins over the warranted default (T-015-02 AC #1)", () => {
  test("the override wins when present (even over a play default)", () => {
    expect(resolveMaxTurns(30, 15)).toBe(30);
  });
  test("the play's warranted default applies when no override is given", () => {
    expect(resolveMaxTurns(undefined, 15)).toBe(15);
  });
  test("neither ⇒ undefined (no cap ⇒ the seam omits --max-turns)", () => {
    expect(resolveMaxTurns(undefined, undefined)).toBeUndefined();
  });
  test("a 0 override is returned as-is (the seam's truthy guard folds it to absent downstream)", () => {
    expect(resolveMaxTurns(0, 15)).toBe(0);
  });
});

describe("resolveTurnsUsed — harvest num_turns, total, never lies (T-015-02 AC #2)", () => {
  test("a finite non-negative integer passes through", () => {
    expect(resolveTurnsUsed(7)).toBe(7);
    expect(resolveTurnsUsed(0)).toBe(0);
  });
  test("absent / NaN / negative / fractional / non-number ⇒ undefined (field omitted, reads unknown)", () => {
    expect(resolveTurnsUsed(undefined)).toBeUndefined();
    expect(resolveTurnsUsed(NaN)).toBeUndefined();
    expect(resolveTurnsUsed(-1)).toBeUndefined();
    expect(resolveTurnsUsed(2.5)).toBeUndefined();
    expect(resolveTurnsUsed("3")).toBeUndefined();
  });
});

describe("resolveTools — pure per-play MCP/tool resolution (T-032-01; E-051 deny)", () => {
  test("undeclared (tools undefined) ⇒ passthrough, no flags, empty deny (back-compat)", () => {
    expect(resolveTools(undefined, ["a", "b"])).toEqual({ ok: true, passthrough: true, deny: [] });
    expect(resolveTools(undefined, [])).toEqual({ ok: true, passthrough: true, deny: [] });
  });

  test("declared + all required mcp present ⇒ strict flags result (deny [] when none declared)", () => {
    const declared: PlayTools = { mcp: ["a"], allow: ["Read"] };
    expect(resolveTools(declared, ["a", "b"])).toEqual({
      ok: true,
      mcp: ["a"],
      allowedTools: ["Read"],
      deny: [],
      strict: true,
      reducedGrounding: false,
    });
  });

  test("declared + a required mcp absent ⇒ andon listing the missing ids in declared order", () => {
    expect(resolveTools({ mcp: ["a", "z"] }, ["a"])).toEqual({ ok: false, missing: ["z"] });
    expect(resolveTools({ mcp: ["z", "a", "y"] }, ["a"])).toEqual({ ok: false, missing: ["z", "y"] });
  });

  // ── Optional MCP grounding (E-060 #3, T-060-01-01) ───────────────────────────────────────
  test("optional mcp PRESENT ⇒ scoped in like a required one, reducedGrounding false", () => {
    expect(resolveTools({ optionalMcp: ["a"], allow: ["Read"] }, ["a", "b"])).toEqual({
      ok: true,
      mcp: ["a"],
      allowedTools: ["Read"],
      deny: [],
      strict: true,
      reducedGrounding: false,
    });
  });

  test("optional mcp ABSENT ⇒ dropped (NOT andon), strict with reducedGrounding true", () => {
    expect(resolveTools({ optionalMcp: ["a"], allow: ["Read"] }, [])).toEqual({
      ok: true,
      mcp: [],
      allowedTools: ["Read"],
      deny: [],
      strict: true,
      reducedGrounding: true,
    });
  });

  test("mix: required present + optional absent ⇒ strict, mcp=[required], reducedGrounding true", () => {
    expect(resolveTools({ mcp: ["a"], optionalMcp: ["z"], allow: ["Read"] }, ["a"])).toEqual({
      ok: true,
      mcp: ["a"],
      allowedTools: ["Read"],
      deny: [],
      strict: true,
      reducedGrounding: true,
    });
  });

  test("REQUIRED still andons even alongside an optional id (reclassification did not erase the STOP)", () => {
    expect(resolveTools({ mcp: ["z"], optionalMcp: ["a"] }, ["a"])).toEqual({ ok: false, missing: ["z"] });
  });

  test("optional-only declaration opts into strict (present ⇒ scoped; absent ⇒ degrade)", () => {
    expect(resolveTools({ optionalMcp: ["a"] }, ["a"])).toEqual({
      ok: true,
      mcp: ["a"],
      allowedTools: [],
      deny: [],
      strict: true,
      reducedGrounding: false,
    });
    expect(resolveTools({ optionalMcp: ["a"] }, [])).toEqual({
      ok: true,
      mcp: [],
      allowedTools: [],
      deny: [],
      strict: true,
      reducedGrounding: true,
    });
  });

  test("scopes-nothing declaration ({}) ⇒ passthrough (no mcp/allow ⇒ no strict lockdown), deny []", () => {
    // E-051: only declaring `mcp`/`allow` opts into strict least-privilege. An empty object scopes
    // nothing, so it inherits the global set — passthrough, not strict-empty.
    expect(resolveTools({}, ["a", "b"])).toEqual({ ok: true, passthrough: true, deny: [] });
  });

  test("allow only, no mcp ⇒ strict, nothing missing, deny []", () => {
    expect(resolveTools({ allow: ["Read", "Grep"] }, [])).toEqual({
      ok: true,
      mcp: [],
      allowedTools: ["Read", "Grep"],
      deny: [],
      strict: true,
      reducedGrounding: false,
    });
  });

  test("skills only (no mcp/allow) ⇒ passthrough (skills scoped nothing here), deny []", () => {
    // skills is carried on the contract but emits nothing (scope cut) and does not scope an
    // allowlist/MCP, so a skills-only declaration stays passthrough (E-051 discriminator).
    expect(resolveTools({ skills: ["decompose-epic"] }, [])).toEqual({ ok: true, passthrough: true, deny: [] });
  });

  test("deny only (no mcp/allow) ⇒ passthrough carrying deny — denies WITHOUT a strict lockdown", () => {
    // The propose-epic shape: a subtractive denylist that keeps the global MCP set.
    expect(resolveTools({ deny: ["AskUserQuestion"] }, ["a"])).toEqual({
      ok: true,
      passthrough: true,
      deny: ["AskUserQuestion"],
    });
  });

  test("mcp + allow + deny ⇒ strict result carrying the deny list (the decompose-epic shape)", () => {
    expect(resolveTools({ mcp: ["a"], allow: ["Read"], deny: ["AskUserQuestion"] }, ["a"])).toEqual({
      ok: true,
      mcp: ["a"],
      allowedTools: ["Read"],
      deny: ["AskUserQuestion"],
      strict: true,
      reducedGrounding: false,
    });
  });

  test("returned arrays are fresh — not aliases of the play's frozen literals (incl. deny)", () => {
    const declared: PlayTools = { mcp: ["a"], allow: ["Read"], deny: ["AskUserQuestion"] };
    const r = resolveTools(declared, ["a"]);
    if (!r.ok || !("strict" in r)) throw new Error("expected strict result");
    expect(r.mcp).not.toBe(declared.mcp);
    expect(r.allowedTools).not.toBe(declared.allow);
    expect(r.deny).not.toBe(declared.deny);
    expect(r.deny).toEqual(["AskUserQuestion"]);
  });
});

describe("toolFlags — resolved tools → seam argv flags (T-032-02)", () => {
  const PATH = "/repo/.mcp.json";

  test("passthrough ⇒ {} (no flags — byte-identical back-compat)", () => {
    expect(toolFlags(resolveTools(undefined, ["a"]), PATH)).toEqual({});
  });

  test("missing-capability (!ok) ⇒ {} (defensive — castPlay andons before reaching here)", () => {
    expect(toolFlags(resolveTools({ mcp: ["z"] }, ["a"]), PATH)).toEqual({});
  });

  test("strict w/ mcp+allow ⇒ mcpConfig + allow list PLUS mcp__<id> wildcards + strict", () => {
    const r = toolFlags(resolveTools({ mcp: ["codebase-memory-mcp"], allow: ["Read", "Grep"] }, ["codebase-memory-mcp"]), PATH);
    expect(r).toEqual({
      mcpConfig: PATH,
      allowedTools: ["Read", "Grep", "mcp__codebase-memory-mcp"],
      strictMcp: true,
    });
  });

  test("strict w/ allow only (no mcp) ⇒ strict + allow, NO mcpConfig, no mcp wildcard", () => {
    const r = toolFlags(resolveTools({ allow: ["Read"] }, []), PATH);
    expect(r).toEqual({ allowedTools: ["Read"], strictMcp: true });
    expect(r.mcpConfig).toBeUndefined();
  });

  test("scopes-nothing declaration ({}) ⇒ {} (passthrough, no deny ⇒ no flags)", () => {
    expect(toolFlags(resolveTools({}, ["a"]), PATH)).toEqual({});
  });

  test("degraded (optional mcp absent) ⇒ strict + allow, NO mcpConfig (E-060 #3)", () => {
    // reducedGrounding rides the resolution but does not change the argv projection: with the
    // optional server dropped, the scoped mcp set is empty so no --mcp-config is emitted.
    const r = toolFlags(resolveTools({ optionalMcp: ["a"], allow: ["Read"] }, []), PATH);
    expect(r).toEqual({ allowedTools: ["Read"], strictMcp: true });
    expect(r.mcpConfig).toBeUndefined();
  });

  test("multiple declared servers ⇒ one mcp__<id> wildcard each, in declared order", () => {
    const r = toolFlags(resolveTools({ mcp: ["a", "b"], allow: ["Read"] }, ["a", "b"]), PATH);
    expect(r.allowedTools).toEqual(["Read", "mcp__a", "mcp__b"]);
    expect(r.mcpConfig).toBe(PATH);
  });

  test("deny-only passthrough ⇒ disallowedTools ONLY (no allow/mcp/strict flags) — E-051", () => {
    const r = toolFlags(resolveTools({ deny: ["AskUserQuestion"] }, ["a"]), PATH);
    expect(r).toEqual({ disallowedTools: ["AskUserQuestion"] });
    expect(r.allowedTools).toBeUndefined();
    expect(r.strictMcp).toBeUndefined();
    expect(r.mcpConfig).toBeUndefined();
  });

  test("strict + deny ⇒ the strict flags PLUS disallowedTools (the decompose-epic shape)", () => {
    const r = toolFlags(
      resolveTools({ mcp: ["codebase-memory-mcp"], allow: ["Read"], deny: ["AskUserQuestion"] }, ["codebase-memory-mcp"]),
      PATH,
    );
    expect(r).toEqual({
      mcpConfig: PATH,
      allowedTools: ["Read", "mcp__codebase-memory-mcp"],
      strictMcp: true,
      disallowedTools: ["AskUserQuestion"],
    });
  });

  test("empty deny ⇒ no disallowedTools flag (empty-omitted discipline)", () => {
    expect(toolFlags(resolveTools({ deny: [] }, ["a"]), PATH)).toEqual({});
    expect(toolFlags(resolveTools({ allow: ["Read"], deny: [] }, []), PATH)).toEqual({
      allowedTools: ["Read"],
      strictMcp: true,
    });
  });
});

describe("decompose-epic tool-scoping LIVE PROOF — built argv, no cast (T-032-02 AC #5)", () => {
  const PATH = "/repo/.mcp.json";
  const AVAILABLE = ["codebase-memory-mcp"]; // what the committed .mcp.json yields

  test("DECLARED play (codebase-memory present) ⇒ argv carries all three scoping flags", () => {
    const argv = buildArgs(toolFlags(resolveTools(DECOMPOSE_TOOLS, AVAILABLE), PATH));
    expect(argv).toContain("--mcp-config");
    expect(argv).toContain(PATH);
    expect(argv).toContain("--strict-mcp-config");
    const i = argv.indexOf("--allowedTools");
    expect(i).toBeGreaterThan(-1);
    // one comma-joined element: the play's read built-ins + the codebase-memory wildcard
    expect(argv[i + 1]).toBe("Read,Grep,Glob,mcp__codebase-memory-mcp");
  });

  test("UNDECLARED play ⇒ passthrough ⇒ argv is the base, byte-identical to today", () => {
    const argv = buildArgs(toolFlags(resolveTools(undefined, AVAILABLE), PATH));
    expect(argv).toEqual(["-p", "--output-format", "stream-json", "--verbose"]);
  });

  test("ABSENT optional MCP (registry lacks codebase-memory) ⇒ DEGRADE w/ reduced grounding, NOT andon (E-060 #3)", () => {
    const resolved = resolveTools(DECOMPOSE_TOOLS, []); // fresh seed — no .mcp.json / no codebase-memory
    // The reclassification: codebase-memory-mcp is OPTIONAL, so its absence degrades rather than andoning.
    expect(resolved).toEqual({
      ok: true,
      mcp: [], // the optional server is dropped from the scoped set
      allowedTools: ["Read", "Grep", "Glob"], // the read-only built-ins still ground the cast
      deny: ["AskUserQuestion"],
      strict: true,
      reducedGrounding: true, // the honest flag the run record (T-060-01-02) threads
    });
    // The projected argv completes with the reduced-grounding tools: read-only built-ins + strict,
    // but NO --mcp-config and NO codebase-memory wildcard (the absent server is not scoped).
    const argv = buildArgs(toolFlags(resolved, PATH));
    const ai = argv.indexOf("--allowedTools");
    expect(ai).toBeGreaterThan(-1);
    expect(argv[ai + 1]).toBe("Read,Grep,Glob");
    expect(argv).toContain("--strict-mcp-config");
    expect(argv).not.toContain("--mcp-config");
    expect(argv.join(",")).not.toContain("mcp__codebase-memory-mcp");
  });
});

describe("autonomous-deny LIVE PROOF — built argv carries --disallowedTools (T-051-02 AC)", () => {
  const PATH = "/repo/.mcp.json";
  const AVAILABLE = ["codebase-memory-mcp"];

  // The denylist value as it reaches the argv: comma-joined into ONE element (buildArgs, T-051-01).
  const DENY_VALUE = AUTONOMOUS_DENY.join(",");

  /** Assert argv carries `--disallowedTools <DENY_VALUE>` as an adjacent flag+value pair. */
  const carriesDeny = (argv: readonly string[]): void => {
    const i = argv.indexOf("--disallowedTools");
    expect(i).toBeGreaterThan(-1);
    expect(argv[i + 1]).toBe(DENY_VALUE);
  };

  test("autonomous STRICT cast (mcp+allow+deny) ⇒ argv carries --disallowedTools AskUserQuestion", () => {
    // The decompose-epic shape: strict scoping AND the denylist together.
    const strictAutonomous: PlayTools = { mcp: ["codebase-memory-mcp"], allow: ["Read", "Grep", "Glob"], deny: AUTONOMOUS_DENY };
    const argv = buildArgs(toolFlags(resolveTools(strictAutonomous, AVAILABLE), PATH));
    carriesDeny(argv);
    expect(argv).toContain("AskUserQuestion");
    // deny is emitted AFTER the allowlist, BEFORE strict (the buildArgs order pinned by T-051-01).
    expect(argv.indexOf("--allowedTools")).toBeLessThan(argv.indexOf("--disallowedTools"));
    expect(argv.indexOf("--disallowedTools")).toBeLessThan(argv.indexOf("--strict-mcp-config"));
  });

  test("autonomous DENY-ONLY cast (passthrough) ⇒ --disallowedTools WITHOUT allow/strict flags", () => {
    // The propose-epic shape: denies the unanswerable tool while keeping the global MCP set.
    const denyOnly: PlayTools = { deny: AUTONOMOUS_DENY };
    const argv = buildArgs(toolFlags(resolveTools(denyOnly, AVAILABLE), PATH));
    carriesDeny(argv);
    expect(argv).not.toContain("--allowedTools");
    expect(argv).not.toContain("--strict-mcp-config");
    expect(argv).not.toContain("--mcp-config");
  });

  test("interactive/TUI cast (undeclared) ⇒ NO --disallowedTools, argv byte-identical to base", () => {
    const argv = buildArgs(toolFlags(resolveTools(undefined, AVAILABLE), PATH));
    expect(argv).not.toContain("--disallowedTools");
    expect(argv).toEqual(["-p", "--output-format", "stream-json", "--verbose"]);
  });

  test("WIRING GUARD: the policy and the decompose declaration actually carry AskUserQuestion", () => {
    // Pins the source of truth and the one play that declares tools directly (decompose). propose's
    // play object loads BAML, so its deny-only shape is proven by the deny-only argv test above.
    expect([...AUTONOMOUS_DENY]).toEqual(["AskUserQuestion"]);
    expect(DECOMPOSE_TOOLS.deny).toContain("AskUserQuestion");
    // and the real decompose tool-set resolves to an argv carrying the deny flag.
    carriesDeny(buildArgs(toolFlags(resolveTools(DECOMPOSE_TOOLS, AVAILABLE), PATH)));
  });
});
