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
import { castChain } from "./chain.ts";
import {
  buildRunRecord,
  DEFAULT_RUN_LOG_PATH,
  reviveRecord,
  serializeRunRecord,
  totalTokens,
} from "../log/run-log.ts";
import type { Play } from "./play.ts";
import type { Budget } from "../budget/budget.ts";
import { ExecutorTimeoutError, type DispenseOptions, type Executor, type ResultMessage, type StreamMessage } from "../executor/executor.ts";
import { decomposeEffect } from "../play/decompose-effect.ts";
import type { DecomposeInputs } from "../play/project-context.ts";
import type { ExecutorRegistry } from "../executor/select.ts";

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

async function git(root: string, args: readonly string[]): Promise<void> {
  const process = Bun.spawn(["git", ...args], { cwd: root, stdout: "pipe", stderr: "pipe" });
  const [exitCode, stderr] = await Promise.all([
    process.exited,
    new Response(process.stderr).text(),
  ]);
  if (exitCode !== 0) throw new Error(`git ${args.join(" ")} failed: ${stderr.trim()}`);
}

/** Give a temp project a real HEAD without depending on the developer's global Git identity. */
async function initGitRepo(root: string): Promise<void> {
  await git(root, ["init", "--quiet"]);
  await git(root, [
    "-c", "user.name=Vend Test", "-c", "user.email=vend-test@example.invalid",
    "commit", "--allow-empty", "--quiet", "-m", "baseline",
  ]);
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
  { type: "assistant", message: { id: "stub-turn-1", role: "assistant", model: "stub-model-1", usage: { input_tokens: 7 } } },
  { type: "result", subtype: "success", result: "hello from stub", usage: { input_tokens: 7, output_tokens: 3 } },
];

/** A stub Executor: streams the sample messages to onMessage in order, returns a success result. */
function stubExecutor(seen: StreamMessage[], resultText = "hello from stub", id = "stub"): Executor {
  return {
    id,
    async probe() { return { ok: true }; },
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

/** A configured two-seat registry whose complement is a recording, primed reviewer. */
function crossReviewRegistry(resultText: string, calls: DispenseOptions[]): ExecutorRegistry {
  return {
    claude: () => stubExecutor([], "unused author factory", "claude"),
    "openai-compat": () => ({
      id: "openai-compat",
      async probe() { return { ok: true }; },
      async dispense(opts: DispenseOptions): Promise<ResultMessage> {
        calls.push(opts);
        return {
          type: "result",
          subtype: "success",
          result: resultText,
          usage: {},
          total_cost_usd: 0,
          model: "review-stub",
        } as ResultMessage;
      },
    }),
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
    tickets: ["T-070-99-01", "T-070-99-02"],
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
  }, {
    id: "T-070-99-02",
    story: "S-070-99",
    title: "record-the-default-on-every-ticket",
    type: "Task" as DraftType,
    status: "Open" as DraftStatus,
    priority: "High" as DraftPriority,
    phase: "Ready" as DraftPhase,
    depends_on: ["T-070-99-01"],
    purpose: "Prove one gesture applies its routing decision to the complete ticket set (P4).",
    advances: ["P4"],
    doneSignal: "The second ticket carries the same gesture-level routing seat.",
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

/** Write pre-cast execution heat to the production project ledger the decompose effect reads. */
async function writeLaneHeat(root: string, claudeTokens: number, codexTokens: number): Promise<void> {
  const ledgerPath = join(root, DEFAULT_RUN_LOG_PATH);
  await mkdir(join(root, ".vend"), { recursive: true });
  const record = (runId: string, seatOfExecution: string, inputTokens: number) =>
    serializeRunRecord(buildRunRecord({
      runId,
      play: "heat-fixture",
      epic: "E-071",
      model: "fixture",
      outcome: "success",
      usage: { input_tokens: inputTokens },
      seatOfExecution,
      startedAt: "2026-07-12T00:00:00.000Z",
      endedAt: "2026-07-12T00:00:01.000Z",
    }));
  await writeFile(
    ledgerPath,
    record("heat-claude", "claude", claudeTokens) + record("heat-codex", "codex", codexTokens),
    "utf8",
  );
}

/** First chain step: lands a threadable reference so the real decompose-shaped second step runs. */
function producingPlay(): Play<{ signal: string }, string> {
  return {
    name: "producer-fixture",
    summary: "produce a threadable fixture reference",
    render: ({ signal }) => signal,
    parse: (text) => text,
    gates: () => ({ status: "clear" }),
    effect: async () => ({ ok: true, produced: "fixture-epic.md" }),
    budget: BIG_BUDGET,
    card: { color: ["blue"], type: "sorcery", rarity: "common" },
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
    executor: stubExecutor(seen, "hello from stub", "claude"), // known lane, still no spawn/tokens
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
  expect(rec.seatOfExecution).toBe("claude");
  expect(rec.overEnvelope).toBeUndefined();
});

test("castPlay: a file-writing effect captures a routable Git diff reference on summary and record (T-073-01-01 AC)", async () => {
  const root = await tmp();
  await initGitRepo(root);
  const runLogPath = join(root, "runs.jsonl");
  const runId = "captured-diff-fixture";
  const plan: BoardPlanFixture = {
    story: { id: "S-073-99", title: "captured diff fixture" },
    ticket: { id: "T-073-99-01", story: "S-073-99", title: "route this patch" },
  };

  const summary = await castPlay(boardPlanPlay(), { epic: "E-073" }, BIG_BUDGET, {
    subject: "T-073-01-01",
    projectRoot: root,
    transcriptDir: root,
    runLogPath,
    runId,
    executor: stubExecutor([], JSON.stringify(plan)),
  });

  expect(summary.outcome).toBe("success");
  expect(summary.materialized).toBe(true);
  expect(summary.capturedDiff).toBe(join(".vend", "artifacts", `${runId}.diff`));

  const patch = await readFile(join(root, summary.capturedDiff!), "utf8");
  expect(patch.length).toBeGreaterThan(0);
  expect(patch).toContain("docs/active/stories/S-073-99.md");
  expect(patch).toContain("docs/active/tickets/T-073-99-01.md");

  const raw = JSON.parse((await readFile(runLogPath, "utf8")).trim());
  expect(raw.capturedDiff).toBe(summary.capturedDiff);
  expect(reviveRecord(raw)?.capturedDiff).toBe(summary.capturedDiff);
});

test("castPlay: a refusing complement verdict blocks clear as gate-failed and stays attached", async () => {
  const root = await tmp();
  await initGitRepo(root);
  const runLogPath = join(root, "runs.jsonl");
  const calls: DispenseOptions[] = [];
  const plan: BoardPlanFixture = {
    story: { id: "S-073-97", title: "refused cross review" },
    ticket: { id: "T-073-97-01", story: "S-073-97", title: "missing required proof" },
  };

  const summary = await castPlay(boardPlanPlay(), { epic: "E-073" }, BIG_BUDGET, {
    subject: "T-073-02-01-fail",
    projectRoot: root,
    transcriptDir: root,
    runLogPath,
    runId: "cross-review-fail",
    executor: stubExecutor([], JSON.stringify(plan), "claude"),
    crossReviewRegistry: crossReviewRegistry(
      '{"verdict":"fail","reason":"acceptance proof is missing"}',
      calls,
    ),
  });

  expect(summary.outcome).toBe("gate-failed");
  expect(summary.outcome).not.toBe("success");
  // Review happens over the captured landed patch, so materialized remains an honest effect fact.
  expect(summary.materialized).toBe(true);
  expect(summary.capturedDiff).toBe(join(".vend", "artifacts", "cross-review-fail.diff"));
  expect(calls).toHaveLength(1);
  expect(calls[0]!.prompt).toContain("docs/active/tickets/T-073-97-01.md");
  expect(calls[0]!.prompt).toContain("Authored purpose: materialize a canned story and ticket");
  expect(calls[0]!.maxTurns).toBe(1);

  const raw = JSON.parse((await readFile(runLogPath, "utf8")).trim());
  expect(raw.outcome).toBe("gate-failed");
  expect(raw.crossVendorVerdict).toEqual({
    authoringSeat: "claude",
    reviewingSeat: "codex",
    verdict: "fail",
    detail: "acceptance proof is missing",
  });
  expect(raw.gateResults).toEqual([
    { gate: "fixture-contract", passed: true },
    { gate: "cross-vendor-review", passed: false, detail: "acceptance proof is missing" },
  ]);
  expect(reviveRecord(raw)?.crossVendorVerdict).toEqual(raw.crossVendorVerdict);
});

test("castPlay: a passing complement verdict clears with verdict and gate evidence attached", async () => {
  const root = await tmp();
  await initGitRepo(root);
  const runLogPath = join(root, "runs.jsonl");
  const calls: DispenseOptions[] = [];
  const plan: BoardPlanFixture = {
    story: { id: "S-073-96", title: "passing cross review" },
    ticket: { id: "T-073-96-01", story: "S-073-96", title: "proven patch" },
  };

  const summary = await castPlay(boardPlanPlay(), { epic: "E-073" }, BIG_BUDGET, {
    subject: "T-073-02-01-pass",
    projectRoot: root,
    transcriptDir: root,
    runLogPath,
    runId: "cross-review-pass",
    executor: stubExecutor([], JSON.stringify(plan), "claude"),
    crossReviewRegistry: crossReviewRegistry('{"verdict":"pass"}', calls),
  });

  expect(summary.outcome).toBe("success");
  expect(summary.materialized).toBe(true);
  expect(calls).toHaveLength(1);
  const raw = JSON.parse((await readFile(runLogPath, "utf8")).trim());
  expect(raw.outcome).toBe("success");
  expect(raw.crossVendorVerdict).toEqual({
    authoringSeat: "claude",
    reviewingSeat: "codex",
    verdict: "pass",
  });
  expect(raw.gateResults.at(-1)).toEqual({ gate: "cross-vendor-review", passed: true });
});

test("castPlay: a single configured seat clears unchanged with cross-review inert", async () => {
  const root = await tmp();
  await initGitRepo(root);
  const runLogPath = join(root, "runs.jsonl");
  const plan: BoardPlanFixture = {
    story: { id: "S-073-95", title: "single seat" },
    ticket: { id: "T-073-95-01", story: "S-073-95", title: "ordinary clear" },
  };

  const summary = await castPlay(boardPlanPlay(), { epic: "E-073" }, BIG_BUDGET, {
    subject: "T-073-02-01-single-seat",
    projectRoot: root,
    transcriptDir: root,
    runLogPath,
    runId: "cross-review-inert",
    executor: stubExecutor([], JSON.stringify(plan), "claude"),
    crossReviewRegistry: { claude: () => stubExecutor([], "unused", "claude") },
  });

  expect(summary.outcome).toBe("success");
  expect(summary.materialized).toBe(true);
  const raw = JSON.parse((await readFile(runLogPath, "utf8")).trim());
  expect(raw.outcome).toBe("success");
  expect(raw.gateResults).toEqual([{ gate: "fixture-contract", passed: true }]);
  expect("crossVendorVerdict" in raw).toBe(false);
});

test("castPlay: a no-op effect omits captured diff evidence (T-073-01-01 AC)", async () => {
  const root = await tmp();
  await initGitRepo(root);
  const runLogPath = join(root, "runs.jsonl");
  const runId = "empty-diff-fixture";

  const summary = await castPlay(echoPlay([]), { topic: "vend" }, BIG_BUDGET, {
    subject: "T-073-01-01-no-op",
    projectRoot: root,
    transcriptDir: root,
    runLogPath,
    runId,
    executor: stubExecutor([]),
  });

  expect(summary.outcome).toBe("success");
  expect(summary.materialized).toBe(true);
  expect(summary.capturedDiff).toBeUndefined();
  const raw = JSON.parse((await readFile(runLogPath, "utf8")).trim());
  expect("capturedDiff" in raw).toBe(false);
  expect(reviveRecord(raw)?.capturedDiff).toBeUndefined();
  expect(await Bun.file(join(root, ".vend", "artifacts", `${runId}.diff`)).exists()).toBe(false);
});

test("castPlay: stub stream refreshes one progress line and preserves every raw transcript message (T-072-02-02 AC)", async () => {
  const root = await tmp();
  const runId = "live-progress-fixture";
  const clock = [1_000, 13_999, 35_000, 57_000];
  let clockIndex = 0;

  const captured = await captureStdout(() => castPlay(echoPlay([]), { topic: "vend" }, BIG_BUDGET, {
    subject: "T-072-02-02-live-line",
    projectRoot: root,
    transcriptDir: root,
    runLogPath: join(root, "runs.jsonl"),
    runId,
    executor: stubExecutor([]),
    now: () => clock[clockIndex++] ?? clock.at(-1)!,
  }));

  expect(captured.result.outcome).toBe("success");
  const live = captured.stdout.split("· effect", 1)[0]!;
  expect(live).toBe(
    "\r\x1b[2Kelapsed 12s · 0/1000k · turn 0" +
      "\r\x1b[2Kelapsed 34s · 7/1000k · turn 1" +
      "\r\x1b[2Kelapsed 56s · 7/1000k · turn 1\n",
  );
  expect(live.match(/\n/g)).toHaveLength(1);
  expect(captured.stdout).not.toContain("· system");
  expect(captured.stdout).not.toContain("· assistant");
  expect(captured.stdout).not.toContain("· result");

  const transcript = await readFile(join(root, `${runId}.jsonl`), "utf8");
  const rawLines = transcript.trimEnd().split("\n");
  expect(rawLines).toEqual(SAMPLE_STREAM.map((message) => JSON.stringify(message)));
  expect(rawLines.map((line) => JSON.parse(line))).toEqual(SAMPLE_STREAM);
});

test("castPlay: a lane-less executor omits seatOfExecution like other unknown facts", async () => {
  const root = await tmp();
  const runLogPath = join(root, "runs.jsonl");

  const summary = await castPlay(echoPlay([]), { topic: "vend" }, BIG_BUDGET, {
    subject: "T-071-01-02-lane-less",
    projectRoot: root,
    transcriptDir: root,
    runLogPath,
    executor: stubExecutor([]),
  });

  expect(summary.outcome).toBe("success");
  const rec = JSON.parse((await readFile(runLogPath, "utf8")).trim());
  expect("seatOfExecution" in rec).toBe(false);
  expect(rec.seatOfExecution).toBeUndefined();
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
  expect((await readdir(join(baselineRoot, ticketDir))).sort()).toEqual(["T-070-99-01.md", "T-070-99-02.md"]);
  expect(await readdir(join(degradedRoot, storyDir))).toEqual(["S-070-99.md"]);
  expect((await readdir(join(degradedRoot, ticketDir))).sort()).toEqual(["T-070-99-01.md", "T-070-99-02.md"]);

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

test("castPlay: omitted agent infers the cooler seat, stamps every ticket, and records provenance (T-071-02-03 AC)", async () => {
  const root = await tmp();
  await writeLaneHeat(root, 300, 100);
  const outputLog = join(root, "cast-output.jsonl");

  const summary = await castPlay(
    seatDefaultPlay(),
    { epic: "E-071 fixture", charter: SEAT_CHARTER, project: "fixture project" },
    BIG_BUDGET,
    {
      subject: "E-071",
      projectRoot: root,
      transcriptDir: root,
      runLogPath: outputLog,
      executor: stubExecutor([], JSON.stringify(SEAT_PLAN)),
    },
  );

  expect(summary.outcome).toBe("success");
  for (const id of ["T-070-99-01", "T-070-99-02"]) {
    const ticket = await readFile(join(root, "docs", "active", "tickets", `${id}.md`), "utf8");
    expect(ticket).toContain("priority: high\nagent: codex\nphase: ready");
    expect(ticket.match(/^agent: codex$/gm)).toHaveLength(1);
  }

  const record = JSON.parse((await readFile(outputLog, "utf8")).trim());
  expect(record.seatInferred).toEqual({
    seat: "codex",
    reason: "recent cost-weighted burn (last 100 records): claude=300 vs codex=100; 3x hotter",
  });
  expect(reviveRecord(record)?.seatInferred).toEqual(record.seatInferred);
  expect("seatDefaulted" in record).toBe(false);
});

test("castPlay: both-cool evidence preserves unrouted board bytes and emits no inference marker (T-071-02-03 AC)", async () => {
  const baselineRoot = await tmp();
  const coolRoot = await tmp();
  await writeLaneHeat(coolRoot, 100, 100);
  const inputs: DecomposeInputs = {
    epic: "E-071 fixture",
    charter: SEAT_CHARTER,
    project: "fixture project",
  };

  await castPlay(seatDefaultPlay(), inputs, BIG_BUDGET, {
    subject: "E-071-baseline",
    projectRoot: baselineRoot,
    transcriptDir: baselineRoot,
    runLogPath: join(baselineRoot, "cast-output.jsonl"),
    executor: stubExecutor([], JSON.stringify(SEAT_PLAN)),
  });
  await castPlay(seatDefaultPlay(), inputs, BIG_BUDGET, {
    subject: "E-071-cool",
    projectRoot: coolRoot,
    transcriptDir: coolRoot,
    runLogPath: join(coolRoot, "cast-output.jsonl"),
    executor: stubExecutor([], JSON.stringify(SEAT_PLAN)),
  });

  for (const kind of ["stories", "tickets"] as const) {
    const relative = join("docs", "active", kind);
    const files = await readdir(join(baselineRoot, relative));
    expect(await readdir(join(coolRoot, relative))).toEqual(files);
    for (const file of files) {
      expect(await readFile(join(coolRoot, relative, file), "utf8")).toBe(
        await readFile(join(baselineRoot, relative, file), "utf8"),
      );
    }
  }
  const coolTicket = await readFile(join(coolRoot, "docs", "active", "tickets", "T-070-99-01.md"), "utf8");
  expect(coolTicket).not.toContain("\nagent:");
  const record = JSON.parse((await readFile(join(coolRoot, "cast-output.jsonl"), "utf8")).trim());
  expect("seatInferred" in record).toBe(false);
});

test("castPlay: explicit agent overrides hot-lane inference and emits no inferred marker (T-071-02-03 AC)", async () => {
  const root = await tmp();
  await writeLaneHeat(root, 300, 100);
  const outputLog = join(root, "cast-output.jsonl");

  await castPlay(
    seatDefaultPlay(),
    { epic: "E-071 fixture", charter: SEAT_CHARTER, project: "fixture project", agent: "claude" },
    BIG_BUDGET,
    {
      subject: "E-071-explicit",
      projectRoot: root,
      transcriptDir: root,
      runLogPath: outputLog,
      executor: stubExecutor([], JSON.stringify(SEAT_PLAN)),
    },
  );

  for (const id of ["T-070-99-01", "T-070-99-02"]) {
    const ticket = await readFile(join(root, "docs", "active", "tickets", `${id}.md`), "utf8");
    expect(ticket).toContain("priority: high\nagent: claude\nphase: ready");
  }
  const record = JSON.parse((await readFile(outputLog, "utf8")).trim());
  expect("seatInferred" in record).toBe(false);
});

test("castChain: the decompose step exercises the same inferred-seat injection (T-071-02-03 AC)", async () => {
  const root = await tmp();
  await writeLaneHeat(root, 300, 100);
  const outputLog = join(root, "chain-output.jsonl");

  const result = await castChain([
    {
      play: producingPlay(),
      budget: BIG_BUDGET,
      opts: {
        runId: "chain-producer",
        subject: "signal",
        projectRoot: root,
        transcriptDir: root,
        runLogPath: outputLog,
        executor: stubExecutor([], "threaded"),
      },
      adapt: () => ({ signal: "signal" }),
    },
    {
      play: seatDefaultPlay(),
      budget: BIG_BUDGET,
      opts: {
        runId: "chain-decompose",
        subject: "E-071-chain",
        projectRoot: root,
        transcriptDir: root,
        runLogPath: outputLog,
        executor: stubExecutor([], JSON.stringify(SEAT_PLAN)),
      },
      adapt: () => ({ epic: "E-071 fixture", charter: SEAT_CHARTER, project: "fixture project" }),
    },
  ]);

  expect(result.outcome).toBe("success");
  const ticket = await readFile(join(root, "docs", "active", "tickets", "T-070-99-02.md"), "utf8");
  expect(ticket).toContain("agent: codex");
  const records = (await readFile(outputLog, "utf8")).trim().split("\n").map((line) => JSON.parse(line));
  expect(records).toHaveLength(2);
  expect(records[0]!.seatInferred).toBeUndefined();
  expect(records[1]!.seatInferred?.seat).toBe("codex");
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
    async probe() { return { ok: true }; },
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
