import { describe, expect, test } from "bun:test";
import type { BudgetOutcome } from "../budget/budget.ts";
import type { GateVerdict } from "./play.ts";
import type { StreamMessage } from "../executor/claude.ts";
import { buildArgs } from "../executor/claude.ts";
import type { PlayTools } from "./play.ts";
import { DECOMPOSE_TOOLS } from "../play/decompose-epic-core.ts";
import { AUTONOMOUS_DENY } from "../play/autonomous-deny.ts";
import {
  castGateRows,
  classify,
  DEFAULT_MODEL,
  formatMessage,
  makeStreamSink,
  resolveLoggedModel,
  resolveMaxTurns,
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
  test("timeout outranks everything; no materialize", () => {
    const v = classify({ timedOut: true, budgetOutcome: null, gateVerdict: null });
    expect(v.outcome).toBe("timed-out");
    expect(v.materialize).toBe(false);
    expect(v.gateLog).toEqual([]);
  });

  test("budget exhaustion beats a CLEAR verdict (P7: contract breach stops the line)", () => {
    const v = classify({ timedOut: false, budgetOutcome: exhausted, gateVerdict: cleared });
    expect(v.outcome).toBe("budget-exhausted");
    expect(v.materialize).toBe(false);
  });

  test("a gate STOP (in budget) → gate-failed, no materialize, one failed gate row", () => {
    const v = classify({ timedOut: false, budgetOutcome: okBudget, gateVerdict: stopped });
    expect(v.outcome).toBe("gate-failed");
    expect(v.materialize).toBe(false);
    expect(v.gateLog).toEqual([{ gate: "value", passed: false, detail: "<plan>: plan has no tickets" }]);
  });

  test("cleared (opaque) + in budget → success + materialize; logs no per-gate rows", () => {
    const v = classify({ timedOut: false, budgetOutcome: okBudget, gateVerdict: cleared });
    expect(v.outcome).toBe("success");
    expect(v.materialize).toBe(true);
    expect(v.gateLog).toEqual([]);
  });

  test("a clear that echoes `cleared` logs one passed row per gate (T-007-03 D3)", () => {
    const v = classify({ timedOut: false, budgetOutcome: okBudget, gateVerdict: clearedNamed });
    expect(v.outcome).toBe("success");
    expect(v.materialize).toBe(true);
    expect(v.gateLog).toEqual([
      { gate: "value", passed: true },
      { gate: "allocation", passed: true },
      { gate: "bounds", passed: true },
      { gate: "structural", passed: true },
    ]);
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
    });
  });

  test("declared + a required mcp absent ⇒ andon listing the missing ids in declared order", () => {
    expect(resolveTools({ mcp: ["a", "z"] }, ["a"])).toEqual({ ok: false, missing: ["z"] });
    expect(resolveTools({ mcp: ["z", "a", "y"] }, ["a"])).toEqual({ ok: false, missing: ["z", "y"] });
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

  test("ABSENT MCP (registry lacks codebase-memory) ⇒ the missing-capability andon, no flags", () => {
    const resolved = resolveTools(DECOMPOSE_TOOLS, []); // empty/unbound project registry
    expect(resolved).toEqual({ ok: false, missing: ["codebase-memory-mcp"] });
    // and the defensive projection emits nothing (castPlay andons before dispense)
    expect(buildArgs(toolFlags(resolved, PATH))).toEqual(["-p", "--output-format", "stream-json", "--verbose"]);
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
});
