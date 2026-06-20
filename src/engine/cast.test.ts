import { afterEach, expect, test } from "bun:test";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { castPlay } from "./cast.ts";
import type { Play } from "./play.ts";
import type { Budget } from "../budget/budget.ts";
import { ExecutorTimeoutError, type DispenseOptions, type Executor, type ResultMessage, type StreamMessage } from "../executor/executor.ts";

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

const SAMPLE_STREAM: StreamMessage[] = [
  { type: "system", subtype: "init", session_id: "s1" },
  { type: "assistant", message: { role: "assistant", model: "stub-model-1", usage: { input_tokens: 7 } } },
  { type: "result", subtype: "success", result: "hello from stub", usage: { input_tokens: 7, output_tokens: 3 } },
];

/** A stub Executor: streams the sample messages to onMessage in order, returns a success result. */
function stubExecutor(seen: StreamMessage[]): Executor {
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
        result: "hello from stub",
        usage: { input_tokens: 7, output_tokens: 3 },
        total_cost_usd: 0.001,
        model: "stub-model-1",
      } as ResultMessage;
    },
  };
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
