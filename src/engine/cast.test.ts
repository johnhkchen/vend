import { afterEach, expect, spyOn, test } from "bun:test";
import { rmSync } from "node:fs";
import { mkdir, mkdtemp, readFile, readdir, rm, writeFile } from "node:fs/promises";
import { createServer } from "node:net";
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
import type { CastContext, Play } from "./play.ts";
import type { Budget } from "../budget/budget.ts";
import { ExecutorTimeoutError, type DispenseOptions, type Executor, type ResultMessage, type StreamMessage } from "../executor/executor.ts";
import { buildArgs } from "../executor/claude.ts";
import { decomposeEffect } from "../play/decompose-effect.ts";
import { DECOMPOSE_MAX_TURNS } from "../play/decompose-epic-core.ts";
import type { DecomposeInputs } from "../play/project-context.ts";
import type { ExecutorRegistry } from "../executor/select.ts";
import { dispenseOpenAICompat, OPENAI_BASE_URL_ENV } from "../executor/openai-compat.ts";
import {
  appendDecomposeDraft,
  DEFAULT_DECOMPOSE_DRAFT_PATH,
  latestDecomposeDraft,
  loadDecomposeDrafts,
} from "./decompose-draft.ts";

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

/** Reserve an OS-selected loopback port, close it, and return its now-unreachable API base. */
async function closedLoopbackOpenAIBaseUrl(): Promise<string> {
  const server = createServer();
  await new Promise<void>((resolve, reject) => {
    const onError = (error: Error): void => reject(error);
    server.once("error", onError);
    server.listen(0, "127.0.0.1", () => {
      server.off("error", onError);
      resolve();
    });
  });

  const address = server.address();
  await new Promise<void>((resolve, reject) => {
    server.close((error) => error ? reject(error) : resolve());
  });
  if (address === null || typeof address === "string") {
    throw new Error("loopback test server did not receive an IP port");
  }
  return `http://127.0.0.1:${address.port}/v1`;
}

/** A high envelope so nothing exhausts — the cast clears on the gate, not the budget. */
const BIG_BUDGET: Budget = { timeMs: 60_000, tokens: 1_000_000 };

/** A trivial play: render → parse (echo) → gates clear → effect reports it landed. */
function echoPlay(
  effectLog: string[],
  parseContexts?: CastContext<{ topic: string }>[],
): Play<{ topic: string }, { text: string }> {
  return {
    name: "echo",
    summary: "echo the model reply back as the parsed output (test fixture)",
    render: (inputs) => `echo: ${inputs.topic}`,
    parse: (text, ctx) => {
      parseContexts?.push(ctx);
      return { text };
    },
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

/** A configured reviewer whose live dispense fails after complement resolution succeeds. */
function throwingCrossReviewRegistry(error: unknown, calls: DispenseOptions[]): ExecutorRegistry {
  return {
    claude: () => stubExecutor([], "unused author factory", "claude"),
    "openai-compat": () => ({
      id: "openai-compat",
      async probe() { return { ok: true }; },
      async dispense(opts: DispenseOptions): Promise<ResultMessage> {
        calls.push(opts);
        throw error;
      },
    }),
  };
}

/** A provisioned reviewer that uses the real fetch transport against a known closed endpoint. */
function unreachableOpenAIReviewRegistry(baseUrl: string, calls: DispenseOptions[]): ExecutorRegistry {
  return {
    claude: () => stubExecutor([], "unused author factory", "claude"),
    "openai-compat": () => ({
      id: "openai-compat",
      async probe() { return { ok: true }; },
      async dispense(opts: DispenseOptions): Promise<ResultMessage> {
        calls.push(opts);
        return dispenseOpenAICompat(opts, { [OPENAI_BASE_URL_ENV]: baseUrl });
      },
    }),
  };
}

/** Remove the captured patch after complement resolution but before castPlay reads it. */
function disappearingDiffRegistry(root: string, runId: string, calls: DispenseOptions[]): ExecutorRegistry {
  return {
    claude: () => stubExecutor([], "unused author factory", "claude"),
    "openai-compat": () => {
      rmSync(join(root, ".vend", "artifacts", `${runId}.diff`));
      return {
        id: "openai-compat",
        async probe() { return { ok: true }; },
        async dispense(opts: DispenseOptions): Promise<ResultMessage> {
          calls.push(opts);
          return {
            type: "result",
            subtype: "success",
            result: '{"verdict":"pass"}',
            usage: {},
            total_cost_usd: 0,
            model: "review-stub",
          } as ResultMessage;
        },
      };
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
  const parseContexts: CastContext<{ topic: string }>[] = [];
  const runLogPath = join(root, "runs.jsonl");

  const summary = await castPlay(echoPlay(effectLog, parseContexts), { topic: "vend" }, BIG_BUDGET, {
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
  expect(parseContexts).toEqual([{ inputs: { topic: "vend" }, projectRoot: root }]);
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

test("castPlay: an unreachable executor andons before dispense with one zero-spend record", async () => {
  const root = await tmp();
  const effectLog: string[] = [];
  const runLogPath = join(root, "runs.jsonl");
  const transcriptDir = join(root, "transcripts");
  const runId = "executor-unreachable-fixture";
  let probeCalls = 0;
  let dispenseCalls = 0;
  const executor: Executor = {
    id: "claude",
    async probe() {
      probeCalls += 1;
      return {
        ok: false,
        reason: "claude config store/Keychain is unreadable",
        hint: "run `claude login`; grant the sandbox access to the Keychain",
      };
    },
    async dispense(): Promise<ResultMessage> {
      dispenseCalls += 1;
      throw new Error("dispense must not run after a failed executor probe");
    },
  };

  const { result: summary, stdout } = await captureStdout(() =>
    castPlay(echoPlay(effectLog), { topic: "vend" }, BIG_BUDGET, {
      subject: "T-074-01-03",
      projectRoot: root,
      transcriptDir,
      runLogPath,
      runId,
      executor,
    }));

  expect(probeCalls).toBe(1);
  expect(dispenseCalls).toBe(0);
  expect(effectLog).toEqual([]);
  expect(summary.outcome).toBe("missing-capability");
  expect(summary.materialized).toBe(false);
  expect(summary.actuals?.usage).toEqual({});
  expect(stdout).toContain("· andon: missing-capability");
  expect(stdout).toContain("executor 'claude' unreachable");
  expect(stdout).toContain("claude config store/Keychain is unreadable");
  expect(stdout).toContain("run `claude login`; grant the sandbox access to the Keychain");
  expect(stdout).not.toContain("Error:");
  expect(await Bun.file(join(transcriptDir, `${runId}.jsonl`)).exists()).toBe(false);

  const lines = (await readFile(runLogPath, "utf8")).trim().split("\n");
  expect(lines).toHaveLength(1);
  const rec = JSON.parse(lines[0]!);
  expect(rec.outcome).toBe("missing-capability");
  expect(rec.usage).toEqual({
    input_tokens: 0,
    output_tokens: 0,
    cache_read_input_tokens: 0,
    cache_creation_input_tokens: 0,
  });
  expect(rec.costUsd).toBe(0);
  expect(rec.gateResults).toEqual([]);
  expect(rec.seatOfExecution).toBe("claude");
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
  expect("crossReviewSkipped" in raw).toBe(false);
  expect(reviveRecord(raw)?.capturedDiff).toBe(summary.capturedDiff);
  expect(reviveRecord(raw)?.crossReviewSkipped).toBeUndefined();
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
  expect("crossReviewSkipped" in raw).toBe(false);
  expect(raw.gateResults).toEqual([
    { gate: "fixture-contract", passed: true },
    { gate: "cross-vendor-review", passed: false, detail: "acceptance proof is missing" },
  ]);
  expect(reviveRecord(raw)?.crossVendorVerdict).toEqual(raw.crossVendorVerdict);
});

test("castPlay: a throwing reviewer settles as a named missing-capability andon without a stack", async () => {
  const root = await tmp();
  await initGitRepo(root);
  const runLogPath = join(root, "runs.jsonl");
  const calls: DispenseOptions[] = [];
  const runId = "cross-review-unreachable";
  const plan: BoardPlanFixture = {
    story: { id: "S-076-99", title: "reviewer failure fixture" },
    ticket: { id: "T-076-99-01", story: "S-076-99", title: "record the andon" },
  };

  // Awaiting the whole cast to a value is the no-unhandled-rejection assertion: the reviewer's
  // rejected promise is consumed at settlement rather than escaping this action.
  const { result: summary, stdout } = await captureStdout(() =>
    castPlay(boardPlanPlay(), { epic: "E-076" }, BIG_BUDGET, {
      subject: "T-076-02-01",
      projectRoot: root,
      transcriptDir: root,
      runLogPath,
      runId,
      executor: stubExecutor([], JSON.stringify(plan), "claude"),
      crossReviewRegistry: throwingCrossReviewRegistry(
        new Error("ConnectionRefused while dialing the configured review service"),
        calls,
      ),
    }));

  expect(calls).toHaveLength(1);
  expect(summary.outcome).toBe("missing-capability");
  expect(summary.materialized).toBe(true);
  expect(summary.capturedDiff).toBe(join(".vend", "artifacts", `${runId}.diff`));
  expect(stdout).toContain("· andon: missing-capability");
  expect(stdout).toContain("reviewer seat 'codex'");
  expect(stdout).toContain("OpenAI-compatible endpoint");
  expect(stdout).toContain("ConnectionRefused while dialing the configured review service");
  expect(stdout).toContain("VEND_OPENAI_BASE_URL");
  expect(stdout).toContain("run `vend doctor`");
  expect(stdout).not.toContain("· andon: gate-failed — cross-vendor review");
  expect(stdout).not.toContain("Error:");
  expect(stdout).not.toContain("\n    at ");

  const patch = await readFile(join(root, summary.capturedDiff!), "utf8");
  expect(patch.length).toBeGreaterThan(0);
  const lines = (await readFile(runLogPath, "utf8")).trim().split("\n");
  expect(lines).toHaveLength(1);
  const raw = JSON.parse(lines[0]!);
  expect(raw.outcome).toBe("missing-capability");
  expect(raw.capturedDiff).toBe(summary.capturedDiff);
  expect(raw.usage.input_tokens).toBe(7);
  expect(raw.usage.output_tokens).toBe(3);
  expect(raw.costUsd).toBe(0.001);
  expect(raw.gateResults).toEqual([{ gate: "fixture-contract", passed: true }]);
  expect("crossVendorVerdict" in raw).toBe(false);
  expect("crossReviewSkipped" in raw).toBe(false);
});

test("castPlay: a non-reviewer settlement throw writes an errored row and records a missing diff discrepancy", async () => {
  const root = await tmp();
  await initGitRepo(root);
  const runLogPath = join(root, "runs.jsonl");
  const calls: DispenseOptions[] = [];
  const runId = "settlement-read-failure";
  const expectedReference = join(".vend", "artifacts", `${runId}.diff`);
  const plan: BoardPlanFixture = {
    story: { id: "S-076-98", title: "settlement failure fixture" },
    ticket: { id: "T-076-98-01", story: "S-076-98", title: "preserve the ledger" },
  };

  const cast = castPlay(boardPlanPlay(), { epic: "E-076" }, BIG_BUDGET, {
    subject: "T-076-02-02",
    projectRoot: root,
    transcriptDir: root,
    runLogPath,
    runId,
    executor: stubExecutor([], JSON.stringify(plan), "claude"),
    crossReviewRegistry: disappearingDiffRegistry(root, runId, calls),
  });

  await expect(cast).rejects.toMatchObject({ code: "ENOENT" });
  expect(calls).toHaveLength(0);

  const lines = (await readFile(runLogPath, "utf8")).trim().split("\n");
  expect(lines).toHaveLength(1);
  const raw = JSON.parse(lines[0]!);
  expect(raw.runId).toBe(runId);
  expect(raw.outcome).toBe("errored");
  expect(raw.usage.input_tokens).toBe(7);
  expect(raw.usage.output_tokens).toBe(3);
  expect(raw.costUsd).toBe(0.001);
  expect(raw.gateResults).toEqual([{ gate: "fixture-contract", passed: true }]);
  expect("capturedDiff" in raw).toBe(false);
  expect(raw.artifactDiscrepancy).toEqual({
    reference: expectedReference,
    reason: "captured-diff-unavailable-at-settlement",
  });
  expect(reviveRecord(raw)?.artifactDiscrepancy).toEqual(raw.artifactDiscrepancy);
  expect("crossVendorVerdict" in raw).toBe(false);
  expect("crossReviewSkipped" in raw).toBe(false);
  expect(await Bun.file(join(root, expectedReference)).exists()).toBe(false);
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
  expect("crossReviewSkipped" in raw).toBe(false);
  expect(raw.gateResults.at(-1)).toEqual({ gate: "cross-vendor-review", passed: true });
});

test("castPlay: default config needs no 11434 reviewer and records a consistent skipped-review clear (T-076-02-03 AC)", async () => {
  const root = await tmp();
  await initGitRepo(root);
  const runLogPath = join(root, "runs.jsonl");
  const runId = "default-no-network-review";
  const expectedReference = join(".vend", "artifacts", `${runId}.diff`);
  const plan: BoardPlanFixture = {
    story: { id: "S-076-97", title: "default review stays inert" },
    ticket: { id: "T-076-97-01", story: "S-076-97", title: "keep the offline clear" },
  };

  // No crossReviewRegistry: this is the shipped default resolver, not a reviewer/fetch mock.
  const summary = await castPlay(boardPlanPlay(), { epic: "E-076" }, BIG_BUDGET, {
    subject: "T-076-02-03-default",
    projectRoot: root,
    transcriptDir: root,
    runLogPath,
    runId,
    executor: stubExecutor([], JSON.stringify(plan), "claude"),
  });

  expect(summary.outcome).toBe("success");
  expect(summary.materialized).toBe(true);
  expect(summary.capturedDiff).toBe(expectedReference);

  const patch = await readFile(join(root, expectedReference), "utf8");
  expect(patch).toContain("docs/active/stories/S-076-97.md");
  expect(patch).toContain("docs/active/tickets/T-076-97-01.md");

  const lines = (await readFile(runLogPath, "utf8")).trim().split("\n");
  expect(lines).toHaveLength(1);
  const raw = JSON.parse(lines[0]!);
  expect(raw.outcome).toBe("success");
  expect(raw.capturedDiff).toBe(summary.capturedDiff);
  expect("artifactDiscrepancy" in raw).toBe(false);
  expect(raw.gateResults).toEqual([{ gate: "fixture-contract", passed: true }]);
  expect("crossVendorVerdict" in raw).toBe(false);
  expect(raw.crossReviewSkipped).toEqual({
    reason: "no-complement-reviewer-resolved",
    bindsWhen: "author-and-exactly-one-complement-reviewer-provisioned",
  });
  const revived = reviveRecord(raw);
  expect(revived?.capturedDiff).toBe(summary.capturedDiff);
  expect(revived?.crossReviewSkipped).toEqual(raw.crossReviewSkipped);
});

test("castPlay: a provisioned unreachable reviewer uses real fetch and settles with ledger intact (T-076-02-03 AC)", async () => {
  const root = await tmp();
  await initGitRepo(root);
  const baseUrl = await closedLoopbackOpenAIBaseUrl();
  const runLogPath = join(root, "runs.jsonl");
  const calls: DispenseOptions[] = [];
  const runId = "real-fetch-review-unreachable";
  const expectedReference = join(".vend", "artifacts", `${runId}.diff`);
  const plan: BoardPlanFixture = {
    story: { id: "S-076-96", title: "unreachable reviewer outcome" },
    ticket: { id: "T-076-96-01", story: "S-076-96", title: "retain the settled evidence" },
  };

  // Awaiting the complete cast to a value proves the real fetch rejection is consumed inside
  // reviewer settlement instead of escaping as a rejected cast or unhandled promise.
  const { result: summary, stdout } = await captureStdout(() =>
    castPlay(boardPlanPlay(), { epic: "E-076" }, BIG_BUDGET, {
      subject: "T-076-02-03-unreachable",
      projectRoot: root,
      transcriptDir: root,
      runLogPath,
      runId,
      executor: stubExecutor([], JSON.stringify(plan), "claude"),
      crossReviewRegistry: unreachableOpenAIReviewRegistry(baseUrl, calls),
    }));

  expect(calls).toHaveLength(1);
  expect(calls[0]!.prompt).toContain("docs/active/stories/S-076-96.md");
  expect(calls[0]!.prompt).toContain("docs/active/tickets/T-076-96-01.md");
  expect(calls[0]!.maxTurns).toBe(1);
  expect(summary.outcome).toBe("missing-capability");
  expect(summary.materialized).toBe(true);
  expect(summary.capturedDiff).toBe(expectedReference);
  expect(stdout).toContain("· andon: missing-capability");
  expect(stdout).toContain("reviewer seat 'codex'");
  expect(stdout).toContain("OpenAI-compatible endpoint");
  expect(stdout).toContain(OPENAI_BASE_URL_ENV);
  expect(stdout).toContain("run `vend doctor`");
  expect(stdout).not.toContain("Error:");
  expect(stdout).not.toContain("\n    at ");

  const patch = await readFile(join(root, expectedReference), "utf8");
  expect(patch).toContain("docs/active/stories/S-076-96.md");
  expect(patch).toContain("docs/active/tickets/T-076-96-01.md");

  const lines = (await readFile(runLogPath, "utf8")).trim().split("\n");
  expect(lines).toHaveLength(1);
  const raw = JSON.parse(lines[0]!);
  expect(raw.outcome).toBe("missing-capability");
  expect(raw.capturedDiff).toBe(summary.capturedDiff);
  expect(raw.usage.input_tokens).toBe(7);
  expect(raw.usage.output_tokens).toBe(3);
  expect(raw.costUsd).toBe(0.001);
  expect(raw.gateResults).toEqual([{ gate: "fixture-contract", passed: true }]);
  expect("artifactDiscrepancy" in raw).toBe(false);
  expect("crossVendorVerdict" in raw).toBe(false);
  expect("crossReviewSkipped" in raw).toBe(false);
  expect(reviveRecord(raw)?.capturedDiff).toBe(summary.capturedDiff);
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
    executor: stubExecutor([], "hello from stub", "claude"),
  });

  expect(summary.outcome).toBe("success");
  expect(summary.materialized).toBe(true);
  expect(summary.capturedDiff).toBeUndefined();
  const raw = JSON.parse((await readFile(runLogPath, "utf8")).trim());
  expect("capturedDiff" in raw).toBe(false);
  expect("crossReviewSkipped" in raw).toBe(false);
  expect(reviveRecord(raw)?.capturedDiff).toBeUndefined();
  expect(reviveRecord(raw)?.crossReviewSkipped).toBeUndefined();
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
    "\r\x1b[2Kelapsed 12s · 0/1000k tokens · turn 0" +
      "\r\x1b[2Kelapsed 34s · 7/1000k tokens · turn 1" +
      "\r\x1b[2Kelapsed 56s · 7/1000k tokens · turn 1\n",
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

test("castPlay: a gate-failed decompose leaves its parsed draft readable under .vend (T-077-04-01 AC)", async () => {
  const root = await tmp();
  const runId = "decompose-failed-checkpoint";
  const parsedDraft = {
    stories: [{ id: "S-077-99", title: "resumable fixture" }],
    tickets: [{ id: "T-077-99-01", story: "S-077-99" }],
  };
  const gateFindings = {
    status: "stop",
    gate: "structural",
    unit: "T-077-99-01",
    reason: "missing required field `phase`",
  } as const;
  const effects: string[] = [];
  const play: Play<{ epic: string }, typeof parsedDraft> = {
    name: "decompose-epic",
    summary: "leave a resumable fixture when decompose gates stop",
    render: ({ epic }) => `decompose fixture: ${epic}`,
    parse: () => parsedDraft,
    gates: () => gateFindings,
    effect: async () => {
      effects.push("called");
      return { ok: true };
    },
    budget: BIG_BUDGET,
    card: { color: ["blue", "white"], type: "sorcery", rarity: "common" },
  };

  const summary = await castPlay(play, { epic: "E-077" }, BIG_BUDGET, {
    subject: "E-077",
    projectRoot: root,
    transcriptDir: root,
    runLogPath: join(root, "runs.jsonl"),
    runId,
    executor: stubExecutor([]),
  });

  expect(summary.outcome).toBe("gate-failed");
  expect(summary.materialized).toBe(false);
  expect(effects).toEqual([]);

  const drafts = await loadDecomposeDrafts({ path: join(root, DEFAULT_DECOMPOSE_DRAFT_PATH) });
  expect(drafts.skipped).toBe(0);
  expect(drafts.records).toHaveLength(1);
  expect(drafts.records[0]).toEqual({
    v: 1,
    runId,
    epic: "E-077",
    parsedDraft,
    gateFindings,
    nextRepairAction: {
      kind: "repair-gate",
      gate: "structural",
      unit: "T-077-99-01",
      reason: "missing required field `phase`",
      cause: "gate-stop",
    },
    createdAt: expect.any(String),
  });
});

test("castPlay: a timed-out decompose preserves an already-readable draft (T-077-04-02 AC)", async () => {
  const root = await tmp();
  const draftPath = join(root, DEFAULT_DECOMPOSE_DRAFT_PATH);
  const parsedDraft = {
    stories: [{ id: "S-077-98", title: "timeout recovery fixture" }],
    tickets: [{ id: "T-077-98-01", story: "S-077-98" }],
  };
  await appendDecomposeDraft({
    runId: "decompose-before-timeout",
    epic: "E-077",
    parsedDraft,
    gateFindings: { status: "clear", cleared: ["structural"] },
    nextRepairAction: { kind: "resume-at-gates", cause: "post-gate-interruption" },
    createdAt: "2026-07-13T12:00:00.000Z",
  }, { path: draftPath });

  const calls: string[] = [];
  const play: Play<{ epic: string }, typeof parsedDraft> = {
    name: "decompose-epic",
    summary: "retain an existing resumable fixture when a later dispense times out",
    render: ({ epic }) => `decompose fixture: ${epic}`,
    parse: () => {
      calls.push("parse");
      return parsedDraft;
    },
    gates: () => {
      calls.push("gates");
      return { status: "clear" };
    },
    effect: async () => {
      calls.push("effect");
      return { ok: true };
    },
    budget: BIG_BUDGET,
    card: { color: ["blue", "white"], type: "sorcery", rarity: "common" },
  };
  const timeoutExecutor: Executor = {
    id: "stub-timeout",
    async probe() { return { ok: true }; },
    async dispense(): Promise<ResultMessage> {
      throw new ExecutorTimeoutError(5, "stub decompose executor timed out");
    },
  };

  const summary = await castPlay(play, { epic: "E-077" }, BIG_BUDGET, {
    subject: "E-077",
    projectRoot: root,
    transcriptDir: root,
    runLogPath: join(root, "runs.jsonl"),
    runId: "decompose-timeout",
    executor: timeoutExecutor,
  });

  expect(summary.outcome).toBe("timed-out");
  expect(summary.materialized).toBe(false);
  expect(calls).toEqual([]);
  const drafts = await loadDecomposeDrafts({ path: draftPath });
  expect(drafts.skipped).toBe(0);
  expect(drafts.records).toHaveLength(1);
  expect(drafts.records[0]).toMatchObject({
    runId: "decompose-before-timeout",
    epic: "E-077",
    parsedDraft,
  });
});

test("castPlay: resume gates and materializes the stored draft without a new executor dispense, then clears it (T-077-04-04 AC)", async () => {
  const root = await tmp();
  const draftPath = join(root, DEFAULT_DECOMPOSE_DRAFT_PATH);
  const runLogPath = join(root, "runs.jsonl");
  const materializedPath = join(root, "materialized-from-draft.txt");
  const parsedDraft = { marker: "paid-output-is-reused" };
  await appendDecomposeDraft({
    runId: "decompose-interrupted-after-gates",
    epic: "E-077",
    parsedDraft,
    gateFindings: { status: "clear", cleared: ["fixture-contract"] },
    nextRepairAction: { kind: "resume-at-gates", cause: "post-gate-interruption" },
    createdAt: "2026-07-13T12:00:00.000Z",
  }, { path: draftPath });
  const active = await loadDecomposeDrafts({ path: draftPath });
  const resumeDraft = latestDecomposeDraft(active.records, "E-077");
  expect(resumeDraft).not.toBeNull();

  const calls: string[] = [];
  const play: Play<{ epic: string }, typeof parsedDraft> = {
    name: "decompose-epic",
    summary: "resume a persisted decompose fixture at gates and effect",
    render: () => {
      calls.push("render");
      throw new Error("resume must not render");
    },
    parse: () => {
      calls.push("parse");
      throw new Error("resume must not parse a regenerated result");
    },
    gates: (draft) => {
      calls.push(`gates:${draft.marker}`);
      return { status: "clear", cleared: ["fixture-contract"] };
    },
    effect: async (draft) => {
      calls.push(`effect:${draft.marker}`);
      await writeFile(materializedPath, draft.marker, "utf8");
      return { ok: true, detail: "materialized the stored draft" };
    },
    budget: BIG_BUDGET,
    card: { color: ["blue", "white"], type: "sorcery", rarity: "common" },
  };
  const forbiddenExecutor: Executor = {
    id: "resume-must-bypass-this-executor",
    async probe() {
      calls.push("probe");
      throw new Error("resume must not probe an executor");
    },
    async dispense(): Promise<ResultMessage> {
      calls.push("dispense");
      throw new Error("resume must not dispense an executor");
    },
  };

  const summary = await castPlay(play, { epic: "E-077" }, BIG_BUDGET, {
    subject: "E-077",
    projectRoot: root,
    runLogPath,
    decomposeDraftPath: draftPath,
    runId: "decompose-resumed-from-draft",
    executor: forbiddenExecutor,
    resumeDraft: resumeDraft!,
  });

  expect(calls).toEqual([
    "gates:paid-output-is-reused",
    "effect:paid-output-is-reused",
  ]);
  expect(summary).toMatchObject({
    runId: "decompose-resumed-from-draft",
    outcome: "success",
    materialized: true,
    actuals: { usage: {} },
  });
  expect(await readFile(materializedPath, "utf8")).toBe("paid-output-is-reused");
  expect(await loadDecomposeDrafts({ path: draftPath })).toEqual({ records: [], skipped: 0 });

  const rawDraftRows = (await readFile(draftPath, "utf8"))
    .trimEnd()
    .split("\n")
    .map((line) => JSON.parse(line));
  expect(rawDraftRows).toHaveLength(2);
  expect(rawDraftRows[0]).toMatchObject({
    runId: "decompose-interrupted-after-gates",
    parsedDraft,
  });
  expect(rawDraftRows[1]).toEqual({
    v: 1,
    kind: "settled",
    runId: "decompose-resumed-from-draft",
    epic: "E-077",
    settledAt: expect.any(String),
  });
});

test("castPlay: decompose cap-hit reaches Claude argv and records unlike turn units at the live seam (T-077-01-01 AC)", async () => {
  const root = await tmp();
  const runId = "decompose-max-turns-cap-hit";
  const runLogPath = join(root, "runs.jsonl");
  const effectLog: string[] = [];
  let argv: string[] = [];

  const assistantTurns: StreamMessage[] = Array.from(
    { length: DECOMPOSE_MAX_TURNS },
    (_, index): StreamMessage => ({
      type: "assistant",
      message: {
        id: `cap-turn-${index + 1}`,
        role: "assistant",
        model: "stub-model-cap-hit",
        usage: { input_tokens: 1 },
      },
    }),
  );
  const capHit: ResultMessage = {
    type: "result",
    subtype: "error_max_turns",
    result: "cap-hit fixture",
    usage: { input_tokens: DECOMPOSE_MAX_TURNS, output_tokens: 1 },
    total_cost_usd: 0.001,
    model: "stub-model-cap-hit",
    num_turns: 23,
  };
  const stream: StreamMessage[] = [
    { type: "system", subtype: "init", session_id: "cap-hit-session" },
    ...assistantTurns.slice(0, 7),
    assistantTurns[6]!, // repeated block for one assistant response: same id must count once
    ...assistantTurns.slice(7),
    capHit,
  ];

  const play: Play<{ epic: string }, { text: string }> = {
    name: "decompose-epic",
    summary: "characterize the decompose executor turn-cap seam",
    render: ({ epic }) => `decompose fixture: ${epic}`,
    parse: (text) => ({ text }),
    gates: () => ({ status: "clear", cleared: ["fixture-contract"] }),
    effect: async ({ text }) => {
      effectLog.push(text);
      return { ok: true, detail: "recorded cap-hit fixture result" };
    },
    maxTurns: DECOMPOSE_MAX_TURNS,
    budget: BIG_BUDGET,
    card: { color: ["blue", "white"], type: "sorcery", rarity: "common" },
  };
  const executor: Executor = {
    id: "claude",
    async probe() { return { ok: true }; },
    async dispense(opts: DispenseOptions): Promise<ResultMessage> {
      argv = buildArgs(opts);
      for (const message of stream) opts.onMessage?.(message);
      return capHit;
    },
  };

  const captured = await captureStdout(() => castPlay(play, { epic: "E-077" }, BIG_BUDGET, {
    subject: "E-077",
    projectRoot: root,
    transcriptDir: root,
    runLogPath,
    runId,
    executor,
  }));

  expect(argv).toEqual([
    "-p",
    "--output-format",
    "stream-json",
    "--verbose",
    "--max-turns",
    "15",
  ]);
  expect(captured.stdout).toContain("· agent turns: 15 / 15 cap; executor conversation events: 23");
  expect(captured.stdout).not.toContain("23 / 15 cap");

  const transcript = (await readFile(join(root, `${runId}.jsonl`), "utf8"))
    .trimEnd()
    .split("\n")
    .map((line) => JSON.parse(line) as StreamMessage);
  const assistantIds = transcript
    .filter((message) => message.type === "assistant")
    .map((message) => (message.message as { id: string }).id);
  expect(assistantIds).toHaveLength(DECOMPOSE_MAX_TURNS + 1);
  expect(new Set(assistantIds).size).toBe(DECOMPOSE_MAX_TURNS);
  expect(transcript.at(-1)).toMatchObject({
    type: "result",
    subtype: "error_max_turns",
    num_turns: 23,
  });

  expect(captured.result.outcome).toBe("success");
  expect(captured.result.materialized).toBe(true);
  expect(effectLog).toEqual(["cap-hit fixture"]);
  const record = JSON.parse((await readFile(runLogPath, "utf8")).trim());
  expect(record.play).toBe("decompose-epic");
  expect(record.turnsUsed).toBe(23);
  expect(record.outcome).toBe("success");

  const drafts = await loadDecomposeDrafts({ path: join(root, DEFAULT_DECOMPOSE_DRAFT_PATH) });
  expect(drafts).toEqual({ records: [], skipped: 0 });

  const rawDraftRows = (await readFile(join(root, DEFAULT_DECOMPOSE_DRAFT_PATH), "utf8"))
    .trimEnd()
    .split("\n")
    .map((line) => JSON.parse(line));
  expect(rawDraftRows).toHaveLength(2);
  expect(rawDraftRows[0]).toMatchObject({
    v: 1,
    runId,
    epic: "E-077",
    nextRepairAction: {
      kind: "resume-at-gates",
      cause: "executor-max-turns",
    },
  });
  expect(rawDraftRows[1]).toEqual({
    v: 1,
    kind: "settled",
    runId,
    epic: "E-077",
    settledAt: expect.any(String),
  });
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
