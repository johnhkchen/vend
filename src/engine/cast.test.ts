import { afterEach, expect, spyOn, test } from "bun:test";
import { mkdir, mkdtemp, readFile, readdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type {
  DraftPhase,
  DraftPriority,
  DraftStatus,
  DraftType,
  WorkPlan,
} from "../../baml_client/index.ts";
import { castPlay } from "./cast.ts";
import { reviveRecord, totalTokens } from "../log/run-log.ts";
import type { Play } from "./play.ts";
import type { Budget } from "../budget/budget.ts";
import { ExecutorTimeoutError, type DispenseOptions, type Executor, type ResultMessage, type StreamMessage } from "../executor/executor.ts";
import { decomposeEffect } from "../play/decompose-effect.ts";
import type { DecomposeInputs } from "../play/project-context.ts";

// Integration proof for the executor seam (T-035-01, AC#3): a STUB executor injected through
// `castPlay` casts a play end to end — onMessage fires, a ResultMessage flows back, and the
// cast parses/gates/effects/logs. This is the whole point of the abstraction: the
// parse→gate→effect→log pipeline is executor-agnostic, provable WITHOUT spawning `claude`.

const tmps: string[] = [];
afterEach(async () => {
  await Promise.all(tmps.splice(0).map((d) => rm(d, { recursive: true, force: true })));
});
async function tmp(): Promise<string> {
  const d = await mkdtemp(join(tmpdir(), "vend-cast-"));
  tmps.push(d);
  return d;
}

/** A high envelope so nothing exhausts — the cast clears on the gate, not the budget. */
const BIG_BUDGET: Budget = { timeMs: 60_000, tokens: 1_000_000 };

/** A trivial play: render → parse (echo) → gates clear → effect reports it landed. */
function echoPlay(effectLog: string[]): Play<{ topic: string }, { text: string }> {
  return {
    name: "echo",
    summary: "echo the model reply back as the parsed output (test fixture)",
    render: (inputs) => `echo: ${inputs.topic}`,
    parse: (text) => ({ text }),
    gates: () => ({ status: "clear" }),
    effect: async (out) => {
      effectLog.push(out.text);
      return { ok: true, produced: "echo-artifact", detail: "wrote nothing (fixture)" };
    },
    budget: BIG_BUDGET,
    card: { color: ["blue"], type: "sorcery", rarity: "common" },
  };
}

/** A play that declares the OPTIONAL grounding MCP (mirrors decompose's DECOMPOSE_TOOLS) — its
 *  presence/absence in the project `.mcp.json` is what flips `resolveTools`' `reducedGrounding`,
 *  so casting it proves the reduced-grounding marker threads onto the run record (T-060-01-02). */
function groundedEchoPlay(effectLog: string[]): Play<{ topic: string }, { text: string }> {
  return {
    ...echoPlay(effectLog),
    tools: { optionalMcp: ["codebase-memory-mcp"], allow: ["Read", "Grep", "Glob"] },
  };
}

const SAMPLE_STREAM: StreamMessage[] = [
  { type: "system", subtype: "init", session_id: "s1" },
  { type: "assistant", message: { role: "assistant", model: "stub-model-1", usage: { input_tokens: 7 } } },
  { type: "result", subtype: "success", result: "hello from stub", usage: { input_tokens: 7, output_tokens: 3 } },
];

/** A stub Executor: streams the sample messages to onMessage in order, returns a success result. */
function stubExecutor(seen: StreamMessage[], resultText = "hello from stub"): Executor {
  return {
    id: "stub",
    async dispense(opts: DispenseOptions): Promise<ResultMessage> {
      for (const m of SAMPLE_STREAM) {
        seen.push(m);
        opts.onMessage?.(m);
      }
      return {
        type: "result",
        subtype: "success",
        result: resultText,
        usage: { input_tokens: 7, output_tokens: 3 },
        total_cost_usd: 0.001,
        model: "stub-model-1",
      } as ResultMessage;
    },
  };
}

interface BoardPlanFixture {
  readonly story: { readonly id: string; readonly title: string };
  readonly ticket: { readonly id: string; readonly story: string; readonly title: string };
}

/** A BAML-free, decompose-shaped fixture: a cleared parsed plan writes one story and one ticket.
 *  The production materializer has its own tests; this isolates cast authorization + persistence. */
function boardPlanPlay(): Play<{ epic: string }, BoardPlanFixture> {
  return {
    name: "board-plan-fixture",
    summary: "materialize a canned story and ticket after its fixture gate clears",
    render: (inputs) => `decompose fixture: ${inputs.epic}`,
    parse: (text) => JSON.parse(text) as BoardPlanFixture,
    gates: () => ({ status: "clear", cleared: ["fixture-contract"] }),
    effect: async (plan, ctx) => {
      const storiesDir = join(ctx.projectRoot, "docs", "active", "stories");
      const ticketsDir = join(ctx.projectRoot, "docs", "active", "tickets");
      await Promise.all([mkdir(storiesDir, { recursive: true }), mkdir(ticketsDir, { recursive: true })]);
      const storyPath = join(storiesDir, `${plan.story.id}.md`);
      const ticketPath = join(ticketsDir, `${plan.ticket.id}.md`);
      await Promise.all([
        writeFile(storyPath, `---\nid: ${plan.story.id}\n---\n\n# ${plan.story.title}\n`, "utf8"),
        writeFile(ticketPath, `---\nid: ${plan.ticket.id}\nstory: ${plan.ticket.story}\n---\n\n# ${plan.ticket.title}\n`, "utf8"),
      ]);
      return { ok: true, detail: "wrote story + ticket (fixture)", artifacts: [storyPath, ticketPath] };
    },
    budget: BIG_BUDGET,
    card: { color: ["blue", "white"], type: "sorcery", rarity: "common" },
  };
}

const SEAT_CHARTER = "- **P4 — Autonomy by default, not supervision.** Work proceeds against gates.\n";

/** A complete addon-free decompose plan: every story contract field and ticket field the real
 *  materializer consumes is present, while generated BAML symbols remain type-only. */
const SEAT_PLAN: WorkPlan = {
  stories: [{
    id: "S-070-99",
    title: "default-an-unknown-seat",
    type: "Task" as DraftType,
    status: "Open" as DraftStatus,
    priority: "High" as DraftPriority,
    tickets: ["T-070-99-01"],
    scope: "Preserve a cleared board when a requested routing seat is unknown (P4).",
    storyAcceptance: "The full board lands with honest requested-versus-default provenance.",
    honestBoundary: "Fixture-proven and token-free; no live executor is used.",
    waveRationale: "One ticket owns the complete cast-boundary proof.",
    outOfSlice: "Adding seats or changing Lisa dispatch.",
  }],
  tickets: [{
    id: "T-070-99-01",
    story: "S-070-99",
    title: "record-the-default",
    type: "Task" as DraftType,
    status: "Open" as DraftStatus,
    priority: "High" as DraftPriority,
    phase: "Ready" as DraftPhase,
    depends_on: [],
    purpose: "Keep autonomous materialization available under a safe default (P4).",
    advances: ["P4"],
    doneSignal: "The default-byte ticket lands and its run record names the fallback.",
  }],
};

/** A BAML-free decompose-shaped play that drives the REAL effect/materializer. Lisa validation is
 *  injected as a successful fixture, so the only executor is castPlay's token-free stub. */
function seatDefaultPlay(): Play<DecomposeInputs, WorkPlan> {
  return {
    name: "seat-default-fixture",
    summary: "materialize a complete fixture plan through the decompose effect",
    render: (inputs) => `decompose fixture: ${inputs.epic}`,
    parse: (text) => JSON.parse(text) as WorkPlan,
    gates: () => ({ status: "clear", cleared: ["fixture-contract"] }),
    effect: (plan, ctx) => decomposeEffect(plan, ctx, async () => ({ ok: true, output: "" })),
    budget: BIG_BUDGET,
    card: { color: ["blue", "white"], type: "sorcery", rarity: "common" },
  };
}

/** Capture process-global cast output for one awaited action and always restore the writer. */
async function captureStdout<T>(action: () => Promise<T>): Promise<{ result: T; stdout: string }> {
  const chunks: string[] = [];
  const write = spyOn(process.stdout, "write").mockImplementation((chunk) => {
    chunks.push(String(chunk));
    return true;
  });
  try {
    return { result: await action(), stdout: chunks.join("") };
  } finally {
    write.mockRestore();
  }
}

test("castPlay: a stub executor injected through castPlay casts a play end to end", async () => {
  const root = await tmp();
  const seen: StreamMessage[] = [];
  const effectLog: string[] = [];
  const runLogPath = join(root, "runs.jsonl");

  const summary = await castPlay(echoPlay(effectLog), { topic: "vend" }, BIG_BUDGET, {
    subject: "T-035-01-stub",
    projectRoot: root,
    transcriptDir: root,
    runLogPath,
    executor: stubExecutor(seen), // the injection seam — no spawn, no Claude
  });

  // onMessage fired (the stub received a working callback and streamed through it).
  expect(seen.map((m) => m.type)).toEqual(["system", "assistant", "result"]);

  // A ResultMessage flowed back through the executor-agnostic pipeline: parse → gate (clear)
  // → effect landed → logged success.
  expect(summary.outcome).toBe("success");
  expect(summary.materialized).toBe(true);
  expect(summary.produced).toBe("echo-artifact");
  expect(effectLog).toEqual(["hello from stub"]); // effect saw the parsed output
  expect(summary.actuals?.usage).toEqual({ input_tokens: 7, output_tokens: 3 });

  // Exactly one run-log record, stamped with the stub's model id (proves the result's
  // metering fields propagate regardless of which executor produced them).
  const lines = (await readFile(runLogPath, "utf8")).trim().split("\n");
  expect(lines).toHaveLength(1);
  const rec = JSON.parse(lines[0]!);
  expect(rec.play).toBe("echo");
  expect(rec.outcome).toBe("success");
  expect(rec.model).toBe("stub-model-1");
  expect(rec.overEnvelope).toBeUndefined();
});

test("castPlay: a gates-cleared token overshoot writes story/ticket files and logs a warned clear (T-068-02-03 AC)", async () => {
  const root = await tmp();
  const runLogPath = join(root, "runs.jsonl");
  const plan: BoardPlanFixture = {
    story: { id: "S-068-99", title: "warned clear fixture" },
    ticket: { id: "T-068-99-01", story: "S-068-99", title: "materialize the overshoot" },
  };

  // The stub reports 7 input + 3 output tokens. Under the cost-weighted meter that is 22
  // input-token-equivalents, deliberately above this fixture's 10-token ceiling.
  const summary = await castPlay(boardPlanPlay(), { epic: "E-068" }, { timeMs: 60_000, tokens: 10 }, {
    subject: "E-068",
    projectRoot: root,
    transcriptDir: root,
    runLogPath,
    executor: stubExecutor([], JSON.stringify(plan)),
  });

  expect(summary.outcome).toBe("success");
  expect(summary.outcome).not.toBe("budget-exhausted");
  expect(summary.materialized).toBe(true);
  expect(summary.overEnvelope).toBe(true);
  expect(summary.actuals?.usage).toEqual({ input_tokens: 7, output_tokens: 3 });

  const story = await readFile(join(root, "docs", "active", "stories", "S-068-99.md"), "utf8");
  const ticket = await readFile(join(root, "docs", "active", "tickets", "T-068-99-01.md"), "utf8");
  expect(story).toContain("id: S-068-99");
  expect(story).toContain("warned clear fixture");
  expect(ticket).toContain("id: T-068-99-01");
  expect(ticket).toContain("story: S-068-99");

  const lines = (await readFile(runLogPath, "utf8")).trim().split("\n");
  expect(lines).toHaveLength(1);
  const rec = JSON.parse(lines[0]!);
  expect(rec.outcome).toBe("success");
  expect(rec.outcome).not.toBe("budget-exhausted");
  expect(rec.overEnvelope).toBe(true);
  expect(rec.gateResults).toEqual([{ gate: "fixture-contract", passed: true }]);
  expect(rec.envelope.tokens).toBe(10);
  const revived = reviveRecord(rec);
  expect(revived?.overEnvelope).toBe(true);
  expect(totalTokens(revived!)).toBeGreaterThan(revived!.envelope!.tokens);
});

test("castPlay: an unknown requested seat materializes the default-byte board, records it, and warns (T-070-01-03 AC)", async () => {
  const baselineRoot = await tmp();
  const degradedRoot = await tmp();
  const baselineLog = join(baselineRoot, "runs.jsonl");
  const degradedLog = join(degradedRoot, "runs.jsonl");
  const resultText = JSON.stringify(SEAT_PLAN);
  const baselineInputs: DecomposeInputs = {
    epic: "E-070 fixture",
    charter: SEAT_CHARTER,
    project: "fixture project",
  };

  const baseline = await castPlay(seatDefaultPlay(), baselineInputs, BIG_BUDGET, {
    subject: "E-070",
    projectRoot: baselineRoot,
    transcriptDir: baselineRoot,
    runLogPath: baselineLog,
    executor: stubExecutor([], resultText),
  });
  const degraded = await captureStdout(() => castPlay(
    seatDefaultPlay(),
    { ...baselineInputs, agent: "kodex" },
    BIG_BUDGET,
    {
      subject: "E-070",
      projectRoot: degradedRoot,
      transcriptDir: degradedRoot,
      runLogPath: degradedLog,
      executor: stubExecutor([], resultText),
    },
  ));

  expect(baseline.outcome).toBe("success");
  expect(baseline.materialized).toBe(true);
  expect(degraded.result.outcome).toBe("success");
  expect(degraded.result.materialized).toBe(true);

  const storyDir = join("docs", "active", "stories");
  const ticketDir = join("docs", "active", "tickets");
  expect(await readdir(join(baselineRoot, storyDir))).toEqual(["S-070-99.md"]);
  expect(await readdir(join(baselineRoot, ticketDir))).toEqual(["T-070-99-01.md"]);
  expect(await readdir(join(degradedRoot, storyDir))).toEqual(["S-070-99.md"]);
  expect(await readdir(join(degradedRoot, ticketDir))).toEqual(["T-070-99-01.md"]);

  const baselineStory = await readFile(join(baselineRoot, storyDir, "S-070-99.md"), "utf8");
  const degradedStory = await readFile(join(degradedRoot, storyDir, "S-070-99.md"), "utf8");
  const baselineTicket = await readFile(join(baselineRoot, ticketDir, "T-070-99-01.md"), "utf8");
  const degradedTicket = await readFile(join(degradedRoot, ticketDir, "T-070-99-01.md"), "utf8");
  expect(degradedStory).toBe(baselineStory);
  expect(degradedTicket).toBe(baselineTicket);
  expect(degradedTicket).not.toContain("\nagent:");

  const baselineRecord = JSON.parse((await readFile(baselineLog, "utf8")).trim());
  expect("seatDefaulted" in baselineRecord).toBe(false);
  const degradedRecord = JSON.parse((await readFile(degradedLog, "utf8")).trim());
  expect(degradedRecord.outcome).toBe("success");
  expect(degradedRecord.seatDefaulted).toEqual({
    requested: "kodex",
    applied: "claude",
    reason: "unknown-seat",
  });
  expect(reviveRecord(degradedRecord)?.seatDefaulted).toEqual(degradedRecord.seatDefaulted);
  expect(degraded.stdout).toContain(
    "· seat defaulted — requested 'kodex'; using 'claude' (unknown-seat; proceeding, recorded)\n",
  );
});

test("castPlay: a cast WITHOUT codebase-memory-mcp writes the reduced-grounding marker into runs.jsonl (T-060-01-02 AC)", async () => {
  const root = await tmp(); // no .mcp.json under root ⇒ readProjectMcpServers ⇒ available: []
  const runLogPath = join(root, "runs.jsonl");

  const summary = await castPlay(groundedEchoPlay([]), { topic: "vend" }, BIG_BUDGET, {
    subject: "T-060-01-02-degraded",
    projectRoot: root,
    transcriptDir: root,
    runLogPath,
    executor: stubExecutor([]),
  });

  // The optional MCP was absent ⇒ the cast DEGRADED rather than andon'd: it still cleared.
  expect(summary.outcome).toBe("success");
  expect(summary.materialized).toBe(true);

  // The run record carries the honest one-way marker, so a degraded clear is COUNTABLE.
  const line = (await readFile(runLogPath, "utf8")).trim();
  const rec = JSON.parse(line);
  expect(rec.reducedGrounding).toBe(true);

  // …and the marker survives the run-log revive/normalize read boundary (the AC's read half).
  const revived = reviveRecord(rec);
  expect(revived).not.toBeNull();
  expect(revived!.reducedGrounding).toBe(true);
});

test("castPlay: a cast WITH codebase-memory-mcp present writes NO reduced-grounding marker (T-060-01-02 AC)", async () => {
  const root = await tmp();
  // The project registry declares the optional server ⇒ fully grounded ⇒ no marker.
  await writeFile(join(root, ".mcp.json"), JSON.stringify({ mcpServers: { "codebase-memory-mcp": { command: "x" } } }), "utf8");
  const runLogPath = join(root, "runs.jsonl");

  const summary = await castPlay(groundedEchoPlay([]), { topic: "vend" }, BIG_BUDGET, {
    subject: "T-060-01-02-grounded",
    projectRoot: root,
    transcriptDir: root,
    runLogPath,
    executor: stubExecutor([]),
  });

  expect(summary.outcome).toBe("success");
  const rec = JSON.parse((await readFile(runLogPath, "utf8")).trim());
  expect("reducedGrounding" in rec).toBe(false);
  expect(reviveRecord(rec)!.reducedGrounding).toBeUndefined();
});

test("castPlay: an executor that throws ExecutorTimeoutError classifies as timed-out", async () => {
  const root = await tmp();
  const runLogPath = join(root, "runs.jsonl");
  const timeoutExecutor: Executor = {
    id: "stub-timeout",
    dispense(_opts: DispenseOptions): Promise<ResultMessage> {
      return Promise.reject(new ExecutorTimeoutError(5, "stub executor timed out"));
    },
  };

  const summary = await castPlay(echoPlay([]), { topic: "vend" }, BIG_BUDGET, {
    subject: "T-035-01-timeout",
    projectRoot: root,
    transcriptDir: root,
    runLogPath,
    executor: timeoutExecutor,
  });

  expect(summary.outcome).toBe("timed-out");
  expect(summary.materialized).toBe(false);
  const lines = (await readFile(runLogPath, "utf8")).trim().split("\n");
  expect(lines).toHaveLength(1);
  expect(JSON.parse(lines[0]!).outcome).toBe("timed-out");
});
