import { afterEach, expect, test } from "bun:test";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { Budget } from "../budget/budget.ts";
import type {
  DispenseOptions,
  Executor,
  ResultMessage,
} from "../executor/executor.ts";
import type { ExecutorRegistry } from "../executor/select.ts";
import { castPlay } from "./cast.ts";
import type { Play } from "./play.ts";

// T-073-02-02 — the story's contrastive end-to-end proof. Both casts traverse the real
// effect → Git diff capture → complement review → settlement → JSONL path. Only the vendor
// transports are replaced by free, primed executors; there is no human approval in the loop.

const temporaryProjects: string[] = [];

afterEach(async () => {
  await Promise.all(
    temporaryProjects.splice(0).map((path) => rm(path, { recursive: true, force: true })),
  );
});

async function git(root: string, args: readonly string[]): Promise<void> {
  const process = Bun.spawn(["git", ...args], {
    cwd: root,
    stdout: "pipe",
    stderr: "pipe",
  });
  const [exitCode, stderr] = await Promise.all([
    process.exited,
    new Response(process.stderr).text(),
  ]);
  if (exitCode !== 0) throw new Error(`git ${args.join(" ")} failed: ${stderr.trim()}`);
}

async function temporaryGitProject(): Promise<string> {
  const root = await mkdtemp(join(tmpdir(), "vend-cross-review-e2e-"));
  temporaryProjects.push(root);
  await git(root, ["init", "--quiet"]);
  await git(root, [
    "-c",
    "user.name=Vend Test",
    "-c",
    "user.email=vend-test@example.invalid",
    "commit",
    "--allow-empty",
    "--quiet",
    "-m",
    "baseline",
  ]);
  return root;
}

const PROOF_BUDGET: Budget = { timeMs: 60_000, tokens: 1_000_000 };

interface ProofOutput {
  readonly quality: "bad" | "good";
}

/** A small authored loop whose effect produces the concrete patch the complement reviews. */
function refusalProofPlay(): Play<{ readonly case: string }, ProofOutput> {
  return {
    name: "cross-review-refusal-proof",
    summary: "land only changes whose independent cross-vendor review accepts their proof",
    render: ({ case: fixtureCase }) => `produce the ${fixtureCase} fixture change`,
    parse: (text) => JSON.parse(text) as ProofOutput,
    gates: () => ({ status: "clear", cleared: ["fixture-contract"] }),
    effect: async ({ quality }, ctx) => {
      const artifact = join(ctx.projectRoot, "src", "acceptance-proof.ts");
      await mkdir(join(ctx.projectRoot, "src"), { recursive: true });
      const proof = quality === "bad"
        ? "export const acceptanceProof = false; // intentionally missing required proof\n"
        : "export const acceptanceProof = true; // required proof present\n";
      await writeFile(artifact, proof, "utf8");
      return {
        ok: true,
        detail: `wrote ${quality} acceptance evidence`,
        artifacts: [artifact],
      };
    },
    budget: PROOF_BUDGET,
    card: { color: ["blue", "white"], type: "sorcery", rarity: "common" },
  };
}

/** The authoring lane is deterministic and free; its parsed output selects the fixture bytes. */
function authorExecutor(quality: ProofOutput["quality"]): Executor {
  return {
    id: "claude",
    async probe() { return { ok: true }; },
    dispense(): Promise<ResultMessage> {
      return Promise.resolve({
        type: "result",
        subtype: "success",
        result: JSON.stringify({ quality }),
        usage: {},
        total_cost_usd: 0,
        model: "author-stub",
      } as ResultMessage);
    },
  };
}

interface PrimedReviewFixture {
  readonly calls: DispenseOptions[];
  readonly registry: ExecutorRegistry;
}

/** A two-seat capability set whose complement returns the supplied verdicts in cast order. */
function primedReviewRegistry(replies: readonly string[]): PrimedReviewFixture {
  const calls: DispenseOptions[] = [];
  let replyIndex = 0;
  const registry: ExecutorRegistry = {
    claude: () => authorExecutor("good"),
    "openai-compat": () => ({
      id: "openai-compat",
      async probe() { return { ok: true }; },
      dispense(opts: DispenseOptions): Promise<ResultMessage> {
        calls.push(opts);
        const reply = replies[replyIndex++];
        if (reply === undefined) throw new Error("cross-review fixture exhausted primed replies");
        return Promise.resolve({
          type: "result",
          subtype: "success",
          result: reply,
          usage: {},
          total_cost_usd: 0,
          model: "review-stub",
        } as ResultMessage);
      },
    }),
  };
  return { calls, registry };
}

test("bad diff is refused and blocked while a good diff clears with both verdicts on the ledger", async () => {
  const root = await temporaryGitProject();
  const runLogPath = join(root, ".vend", "runs.jsonl");
  const reviews = primedReviewRegistry([
    '{"verdict":"fail","reason":"required acceptance proof is false"}',
    '{"verdict":"pass"}',
  ]);

  const bad = await castPlay(refusalProofPlay(), { case: "intentionally bad" }, PROOF_BUDGET, {
    subject: "T-073-02-02-bad",
    projectRoot: root,
    runLogPath,
    runId: "cross-review-bad",
    executor: authorExecutor("bad"),
    crossReviewRegistry: reviews.registry,
  });

  expect(bad.outcome).toBe("gate-failed");
  expect(bad.outcome).not.toBe("success");
  expect(bad.capturedDiff).toBe(join(".vend", "artifacts", "cross-review-bad.diff"));

  const good = await castPlay(refusalProofPlay(), { case: "good" }, PROOF_BUDGET, {
    subject: "T-073-02-02-good",
    projectRoot: root,
    runLogPath,
    runId: "cross-review-good",
    executor: authorExecutor("good"),
    crossReviewRegistry: reviews.registry,
  });

  expect(good.outcome).toBe("success");
  expect(good.capturedDiff).toBe(join(".vend", "artifacts", "cross-review-good.diff"));

  expect(reviews.calls).toHaveLength(2);
  expect(reviews.calls[0]?.maxTurns).toBe(1);
  expect(reviews.calls[0]?.prompt).toContain(
    "export const acceptanceProof = false; // intentionally missing required proof",
  );
  expect(reviews.calls[1]?.maxTurns).toBe(1);
  expect(reviews.calls[1]?.prompt).toContain(
    "export const acceptanceProof = true; // required proof present",
  );
  for (const call of reviews.calls) {
    expect(call.prompt).toContain(
      "Authored purpose: land only changes whose independent cross-vendor review accepts their proof",
    );
  }

  const records = (await readFile(runLogPath, "utf8"))
    .trim()
    .split("\n")
    .map((line) => JSON.parse(line));
  expect(records).toHaveLength(2);

  expect(records[0]).toMatchObject({
    runId: "cross-review-bad",
    outcome: "gate-failed",
    seatOfExecution: "claude",
    capturedDiff: join(".vend", "artifacts", "cross-review-bad.diff"),
    crossVendorVerdict: {
      authoringSeat: "claude",
      reviewingSeat: "codex",
      verdict: "fail",
      detail: "required acceptance proof is false",
    },
    gateResults: [
      { gate: "fixture-contract", passed: true },
      {
        gate: "cross-vendor-review",
        passed: false,
        detail: "required acceptance proof is false",
      },
    ],
  });
  expect(records[0]?.outcome).not.toBe("success");

  expect(records[1]).toMatchObject({
    runId: "cross-review-good",
    outcome: "success",
    seatOfExecution: "claude",
    capturedDiff: join(".vend", "artifacts", "cross-review-good.diff"),
    crossVendorVerdict: {
      authoringSeat: "claude",
      reviewingSeat: "codex",
      verdict: "pass",
    },
    gateResults: [
      { gate: "fixture-contract", passed: true },
      { gate: "cross-vendor-review", passed: true },
    ],
  });
  expect(records[1]?.crossVendorVerdict).not.toHaveProperty("detail");
});
