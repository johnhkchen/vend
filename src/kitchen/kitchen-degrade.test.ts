import { afterEach, describe, expect, test } from "bun:test";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { runInit } from "../init/init-effect.ts";
import { readProjectMcpServers } from "../engine/mcp-registry.ts";
import { resolveTools, toolFlags } from "../engine/cast-core.ts";
import { castPlay } from "../engine/cast.ts";
import { DECOMPOSE_TOOLS } from "../play/decompose-epic-core.ts";
import { AUTONOMOUS_DENY } from "../play/autonomous-deny.ts";
import { reviveRecord } from "../log/run-log.ts";
import type { Play } from "../engine/play.ts";
import type { Budget } from "../budget/budget.ts";
import type { DispenseOptions, Executor, ResultMessage, StreamMessage } from "../executor/executor.ts";

// T-062-03-02: the E-060 graceful-degrade seam, end to end ON THE MATERIALIZED KITCHEN SEED with
// codebase-memory-mcp ABSENT — the expected state of a fresh, brew-installed cook repo. The existing
// coverage proves the MECHANISM with substitutes: cast-core.test.ts resolves a HAND-BUILT
// `{optionalMcp:["a"]}`, and cast.test.ts casts a HAND-MIRRORED `groundedEchoPlay` under an AD-HOC
// empty temp dir. This file closes both substitutions at once: it scaffolds the REAL `vend init
// --template kitchen` workspace and feeds its ACTUAL registry state into the REAL exported
// `DECOMPOSE_TOOLS` declaration (the only play in steer→work that declares an optional MCP). So the
// claim graded here is the AC's: on the shipped seed, the cold-start path DEGRADES (strict, read-only,
// reducedGrounding:true) instead of firing the missing-capability andon. Guarded-live, the
// init-kitchen.test.ts + cast.test.ts discipline: real mkdtemp/runInit/castPlay, torn down in
// afterEach, no mocks. The real `decomposeEpicPlay` (BAML addon) is never imported — only its tool
// CONTRACT (`DECOMPOSE_TOOLS`), which is all the capability seam reads.

const CMM = "codebase-memory-mcp";

const tmps: string[] = [];
afterEach(async () => {
  await Promise.all(tmps.splice(0).map((d) => rm(d, { recursive: true, force: true })));
});

/** Scaffold a fresh `vend init --template kitchen` workspace into a throwaway dir and return its root.
 *  Exactly the state a brew-installed cook lands in: standalone seed, NO `.mcp.json`. */
async function scaffoldKitchen(): Promise<string> {
  const root = await mkdtemp(join(tmpdir(), "vend-kitchen-degrade-"));
  tmps.push(root);
  const outcome = await runInit(root, "kitchen");
  expect(outcome.kind).toBe("scaffolded");
  return root;
}

describe("T-062-03-02 — the materialized kitchen seed leaves codebase-memory-mcp absent", () => {
  test("a freshly scaffolded kitchen workspace ships no MCP registry (cold-start state is real)", async () => {
    const root = await scaffoldKitchen();

    // The scaffold writes no `.mcp.json` (neither the base manifest nor the kitchen overlay carries
    // one), so the project registry reports an EMPTY server set — codebase-memory-mcp genuinely absent,
    // exactly as a fresh cook repo lands. This is the premise the degrade reads.
    const { available } = await readProjectMcpServers(root);
    expect(available).toEqual([]);
    expect(available).not.toContain(CMM);
  });
});

describe("T-062-03-02 — DECOMPOSE_TOOLS degrades against the scaffolded registry (no andon)", () => {
  test("the real DECOMPOSE_TOOLS resolves to strict read-only with reducedGrounding, never the andon", async () => {
    const root = await scaffoldKitchen();
    const { available, path } = await readProjectMcpServers(root);

    // The decompose play's REAL exported tool contract, resolved against the scaffold's ACTUAL empty
    // registry. The optional codebase-memory-mcp is DROPPED (not andon'd): ok:true, the scoped `mcp` is
    // empty, the read-only built-ins survive, and the honest reduced-grounding flag flips on.
    const resolved = resolveTools(DECOMPOSE_TOOLS, available);
    expect(resolved).toEqual({
      ok: true,
      strict: true,
      mcp: [],
      allowedTools: ["Read", "Grep", "Glob"],
      deny: [...AUTONOMOUS_DENY],
      reducedGrounding: true,
    });
    // Explicitly: this is NOT the missing-capability refusal (the `ok:false` branch).
    expect(resolved.ok).toBe(true);

    // The argv projection is the "reduced-grounding read-only tools" the AC names: strict scoping, the
    // three built-ins, the autonomous denylist — and NO `--mcp-config` (no server left to load).
    const flags = toolFlags(resolved, path);
    expect(flags.allowedTools).toEqual(["Read", "Grep", "Glob"]);
    expect(flags.strictMcp).toBe(true);
    expect(flags.disallowedTools).toEqual([...AUTONOMOUS_DENY]);
    expect("mcpConfig" in flags).toBe(false);
  });
});

// ── the cast-level proof: a stub executor (cast.test.ts seam) drives a play carrying the REAL
//    DECOMPOSE_TOOLS against the REAL scaffolded root, so the whole readProjectMcpServers → resolveTools
//    → dispense → parse → gate → effect → appendRunLog pipeline runs offline, on the seed. ───────────

/** A high envelope so the cast clears on the gate, not the budget. */
const BIG_BUDGET: Budget = { timeMs: 60_000, tokens: 1_000_000 };

const SAMPLE_STREAM: StreamMessage[] = [
  { type: "system", subtype: "init", session_id: "s1" },
  { type: "assistant", message: { role: "assistant", model: "stub-model-1", usage: { input_tokens: 7 } } },
  { type: "result", subtype: "success", result: "hello from stub", usage: { input_tokens: 7, output_tokens: 3 } },
];

/** A stub Executor: streams the sample messages in order, returns a success result (cast.test.ts). */
function stubExecutor(): Executor {
  return {
    id: "stub",
    async dispense(opts: DispenseOptions): Promise<ResultMessage> {
      for (const m of SAMPLE_STREAM) opts.onMessage?.(m);
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

/** A thin echo play whose ONLY real ingredient is the REAL DECOMPOSE_TOOLS contract — so the cast reads
 *  the same `play.tools` the live decompose would, without loading the BAML addon. */
function degradeProbePlay(): Play<{ topic: string }, { text: string }> {
  return {
    name: "decompose-degrade-probe",
    summary: "echo fixture carrying the real DECOMPOSE_TOOLS contract (test)",
    render: (inputs) => `decompose: ${inputs.topic}`,
    parse: (text) => ({ text }),
    gates: () => ({ status: "clear" }),
    effect: async () => ({ ok: true, produced: "probe-artifact", detail: "wrote nothing (fixture)" }),
    budget: BIG_BUDGET,
    tools: DECOMPOSE_TOOLS,
    card: { color: ["blue"], type: "sorcery", rarity: "common" },
  };
}

describe("T-062-03-02 — casting DECOMPOSE_TOOLS on the scaffolded seed clears with the flag, no andon", () => {
  test("driving a cast on the materialized seed completes success and records reducedGrounding:true", async () => {
    const root = await scaffoldKitchen();
    const runLogPath = join(root, "runs.jsonl");

    const summary = await castPlay(degradeProbePlay(), { topic: "kitchen" }, BIG_BUDGET, {
      subject: "T-062-03-02-degrade",
      projectRoot: root,
      transcriptDir: root,
      runLogPath,
      executor: stubExecutor(), // the injection seam — no spawn, no Claude, no token spend
    });

    // Completes (NOT the missing-capability andon) and the effect landed.
    expect(summary.outcome).toBe("success");
    expect(summary.materialized).toBe(true);

    // Exactly one run record, carrying the honest one-way marker — a degraded clear is COUNTABLE.
    const lines = (await readFile(runLogPath, "utf8")).trim().split("\n");
    expect(lines).toHaveLength(1);
    const rec = JSON.parse(lines[0]!);
    expect(rec.outcome).toBe("success");
    expect(rec.outcome).not.toBe("missing-capability");
    expect(rec.reducedGrounding).toBe(true);

    // …and the marker survives the run-log revive/normalize read boundary.
    const revived = reviveRecord(rec);
    expect(revived).not.toBeNull();
    expect(revived!.reducedGrounding).toBe(true);
  });
});
