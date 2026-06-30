import { describe, expect, test } from "bun:test";
import type { BudgetOutcome } from "../budget/budget.ts";
import type { GateResult } from "../gate/gates.ts";
import type { StreamMessage } from "../executor/claude.ts";
import {
  classify,
  DECOMPOSE_MAX_TURNS,
  DEFAULT_MODEL,
  epicIdFromDoc,
  epicNumOf,
  formatMessage,
  gateRowsFor,
  graphIntegrityViolations,
  makeStreamSink,
  renumberPlanToEpic,
  resolveLoggedModel,
} from "./decompose-epic-core.ts";
// TYPE-ONLY import (erased under verbatimModuleSyntax) — value-importing baml_client would load the
// native addon into this `bun test` process and trip the once-per-process reactor hang this whole
// file is built to avoid (see the header note). The four enum fields are written as string literals
// `as` their enum type — runtime-identical (the enums are string-valued), zero addon load.
import type { DraftPhase, DraftPriority, DraftStatus, DraftType, StoryDraft, TicketDraft, WorkPlan } from "../../baml_client/index.ts";

// T-002-03 runner: the PURE decision core. We import ./decompose-epic-core.ts (NOT
// ./decompose-epic.ts) so this `bun test` process never value-imports `b` from
// baml_client — the orchestrator's BAML native addon stays off the test path (the
// once-driven reactor would make the suite flaky). `runDecomposeEpic`/`lisaValidate`
// are the impure verbs and are not exercised here; their logic is this tested core,
// proven live in T-002-04.

const okBudget: BudgetOutcome = { status: "ok", spent: 100, ceiling: 1000, remaining: 900 };
const exhausted: BudgetOutcome = { status: "exhausted", code: "EBUDGET_EXHAUSTED", spent: 1200, ceiling: 1000, overage: 200 };
const cleared: GateResult = { status: "clear", cleared: ["value", "allocation", "bounds", "structural"] };
const stopped: GateResult = { status: "stop", gate: "value", unit: "<plan>", reason: "plan has no tickets" };

describe("classify — terminal outcome + materialize decision", () => {
  test("timeout outranks everything; no materialize", () => {
    const v = classify({ timedOut: true, budgetOutcome: null, gateResult: null });
    expect(v.outcome).toBe("timed-out");
    expect(v.materialize).toBe(false);
  });

  test("budget exhaustion beats a CLEAR gate (P7: contract breach stops the line)", () => {
    // a sound, cleared plan from an over-budget run must NOT materialize (Design D2)
    const v = classify({ timedOut: false, budgetOutcome: exhausted, gateResult: cleared });
    expect(v.outcome).toBe("budget-exhausted");
    expect(v.materialize).toBe(false);
  });

  test("a gate STOP (in budget) → gate-failed, no materialize", () => {
    const v = classify({ timedOut: false, budgetOutcome: okBudget, gateResult: stopped });
    expect(v.outcome).toBe("gate-failed");
    expect(v.materialize).toBe(false);
    expect(v.gateLog).toEqual([{ gate: "value", passed: false, detail: "<plan>: plan has no tickets" }]);
  });

  test("cleared + in budget → success + materialize", () => {
    const v = classify({ timedOut: false, budgetOutcome: okBudget, gateResult: cleared });
    expect(v.outcome).toBe("success");
    expect(v.materialize).toBe(true);
    expect(v.gateLog.every((r) => r.passed)).toBe(true);
    expect(v.gateLog).toHaveLength(4);
  });
});

describe("gateRowsFor — the two-GateResult-types translator (T-002-02 #1)", () => {
  test("STOP → one failed row carrying gate, unit, and reason", () => {
    expect(gateRowsFor(stopped)).toEqual([{ gate: "value", passed: false, detail: "<plan>: plan has no tickets" }]);
  });
  test("CLEAR → one passed row per cleared gate", () => {
    expect(gateRowsFor(cleared)).toEqual([
      { gate: "value", passed: true },
      { gate: "allocation", passed: true },
      { gate: "bounds", passed: true },
      { gate: "structural", passed: true },
    ]);
  });
  test("null (never gated) → []", () => {
    expect(gateRowsFor(null)).toEqual([]);
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

describe("resolveLoggedModel — real id → pinned → sentinel (T-005-01)", () => {
  test("the real stream id wins when present (even over a pin)", () => {
    expect(resolveLoggedModel("claude-opus-4-8[1m]", "claude-opus-4-8")).toBe("claude-opus-4-8[1m]");
  });
  test("falls back to the caller's pinned id when no real id was observed", () => {
    expect(resolveLoggedModel(undefined, "claude-sonnet-4-6")).toBe("claude-sonnet-4-6");
  });
  test("falls back to the DEFAULT_MODEL sentinel when neither is present (e.g. a timed-out run)", () => {
    expect(resolveLoggedModel(undefined, undefined)).toBe(DEFAULT_MODEL);
  });
});

describe("DECOMPOSE_MAX_TURNS — the warranted default turn cap (T-015-02 AC #1)", () => {
  test("is 15 — the documented judgment (≈2× the 1–7-turn clean band; pinned against drift)", () => {
    expect(DECOMPOSE_MAX_TURNS).toBe(15);
  });
  test("is a positive integer (a usable --max-turns value the seam can stringify)", () => {
    expect(Number.isInteger(DECOMPOSE_MAX_TURNS)).toBe(true);
    expect(DECOMPOSE_MAX_TURNS).toBeGreaterThan(0);
  });
});

// ── nested-id canonicalization + graph-integrity net (E-061 retro #8) ──────────────────────────

const story = (id: string, tickets: string[]): StoryDraft => ({
  id, title: `story-${id}`, type: "Task" as DraftType, status: "Open" as DraftStatus,
  priority: "High" as DraftPriority, tickets,
});
const ticket = (id: string, storyId: string, depends_on: string[] = []): TicketDraft => ({
  id, story: storyId, title: `ticket-${id}`, type: "Task" as DraftType, status: "Open" as DraftStatus,
  priority: "High" as DraftPriority, phase: "Ready" as DraftPhase, depends_on, purpose: "p",
  advances: ["P3"], doneSignal: "a check passes",
});

/** The exact bug shape the E-061 mint emitted: FLAT story ids for one epic, so `S-062` derives a
 *  non-existent `E-062`. One cross-story `depends_on` edge to prove the remap rewires it. */
const flatPlan = (): WorkPlan => ({
  stories: [story("S-061", ["T-061-01"]), story("S-062", ["T-062-01"]), story("S-063", ["T-063-01"])],
  tickets: [
    ticket("T-061-01", "S-061"),
    ticket("T-062-01", "S-062", ["T-061-01"]),
    ticket("T-063-01", "S-063", ["T-062-01"]),
  ],
});

describe("epicNumOf / epicIdFromDoc — pinning the epic the plan belongs to", () => {
  test("epicNumOf strips E- to the digit block; null on a non-epic id", () => {
    expect(epicNumOf("E-061")).toBe("061");
    expect(epicNumOf("S-061-01")).toBeNull();
    expect(epicNumOf("E61")).toBeNull();
  });
  test("epicIdFromDoc reads `id:` out of epic frontmatter; null when absent", () => {
    expect(epicIdFromDoc("---\nid: E-061\ntitle: x\n---\nbody")).toBe("E-061");
    expect(epicIdFromDoc("---\ntitle: no-id-here\n---")).toBeNull();
  });
});

describe("renumberPlanToEpic — vend OWNS the ids (flat → nested convention)", () => {
  test("rewrites every story/ticket id onto S-<epic>-<NN> / T-<epic>-<NN>-<MM>", () => {
    const out = renumberPlanToEpic(flatPlan(), "E-061");
    expect(out.stories.map((s) => s.id)).toEqual(["S-061-01", "S-061-02", "S-061-03"]);
    expect(out.tickets.map((t) => t.id)).toEqual(["T-061-01-01", "T-061-02-01", "T-061-03-01"]);
  });
  test("remaps ALL cross-refs: story.tickets, ticket.story, and depends_on edges", () => {
    const out = renumberPlanToEpic(flatPlan(), "E-061");
    expect(out.stories[1]!.tickets).toEqual(["T-061-02-01"]);
    expect(out.tickets[1]!.story).toBe("S-061-02");
    // the S-062→S-061 cross-story edge T-062-01 depends_on T-061-01 is rewired to the new ids
    expect(out.tickets[1]!.depends_on).toEqual(["T-061-01-01"]);
    expect(out.tickets[2]!.depends_on).toEqual(["T-061-02-01"]);
  });
  test("is a no-op for a non-E-<digits> epic id (degrade, don't invent)", () => {
    const p = flatPlan();
    expect(renumberPlanToEpic(p, "not-an-epic")).toEqual(p);
  });
});

describe("graphIntegrityViolations — vend's own buildGraph as the pre-write net", () => {
  test("FLAT plan is rejected — S-062/S-063 resolve to epics that don't exist", () => {
    const v = graphIntegrityViolations(flatPlan(), "E-061");
    expect(v.length).toBeGreaterThan(0);
    expect(v.join("\n")).toContain("E-062");
  });
  test("the RENUMBERED plan is graph-valid — the bug is closed end to end", () => {
    const v = graphIntegrityViolations(renumberPlanToEpic(flatPlan(), "E-061"), "E-061");
    expect(v).toEqual([]);
  });
  test("catches a dangling depends_on the gates' DAG check would miss across the board", () => {
    const p: WorkPlan = {
      stories: [story("S-061-01", ["T-061-01-01"])],
      tickets: [ticket("T-061-01-01", "S-061-01", ["T-061-09-09"])], // depends on a ghost
    };
    const v = graphIntegrityViolations(p, "E-061");
    expect(v.join("\n")).toContain("T-061-09-09");
  });
});
