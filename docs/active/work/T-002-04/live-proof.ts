// T-002-04 live-dispense-proof — the driver (spike apparatus, NOT product code).
//
// Runs the REAL `runDecomposeEpic` orchestrator (no doubles) across four scenarios,
// each in its own `lisa init`-ed sandbox so a live run can never touch the repo's
// active board (T-002-03 review concern #5, closed structurally). One countable
// ledger at the repo `.vend/runs.jsonl` (the runner's cwd-relative default; this
// driver is launched from the repo root). Transcripts co-located under
// `.vend/transcripts/<runId>.jsonl`.
//
//   A1  E-001 (the real, hand-cleared epic), generous budget   → success + materialize + lisa validate   (AC1 + AC4)
//   A2  tiny epic, tokens:1                                     → budget-exhausted, no materialize          (AC2 token dim)
//   A3  under-specified epic, generous budget                  → gate-failed (named), no materialize        (AC3)
//   A4  tiny epic, timeMs:1                                     → timed-out, no materialize                  (AC2 time dim)
//
// IMPURE apparatus composed of tested impure verbs — untested by the house rule,
// exactly like the CLI `import.meta.main` dispatch. It must never weaken a gate or
// write to the repo's own docs/active board (only sandbox roots). Re-runnable: run
// `bun docs/active/work/T-002-04/live-proof.ts` from the repo root any time to re-prove.

import { cp, mkdir, readFile, readdir, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { runDecomposeEpic, type RunSummary } from "../../../../src/play/decompose-epic.ts";
import { countTokens, type Budget } from "../../../../src/budget/budget.ts";

const REPO = process.cwd();
const HERE = join(REPO, "docs/active/work/T-002-04");
const SANDBOX_BASE = join(REPO, ".vend/live-proof");
const TRANSCRIPTS = join(REPO, ".vend/transcripts");
const RESULTS = join(HERE, "results");

interface Scenario {
  readonly id: string;
  readonly ac: string;
  readonly epicPath: string;
  readonly budget: Budget;
  readonly expect: string;
}

interface ScenarioResult {
  readonly id: string;
  readonly ac: string;
  readonly expect: string;
  readonly outcome: string;
  readonly matchedExpectation: boolean;
  readonly materialized: boolean;
  readonly wallMs: number;
  readonly model: string;
  readonly tokensCounted: number;
  readonly usage: Record<string, unknown>;
  readonly costUsd: number;
  readonly runId: string;
  readonly sandbox: string;
  readonly error?: string;
}

/** Prepare an isolated, lisa-init'd sandbox with the REAL charter copied in (so the
 *  bounds gate greps the live P#/N#). Returns the absolute sandbox root. */
async function prepSandbox(name: string): Promise<string> {
  const root = join(SANDBOX_BASE, name);
  await rm(root, { recursive: true, force: true });
  await mkdir(root, { recursive: true });
  const init = Bun.spawn(["lisa", "init", "--path", root], { stdout: "pipe", stderr: "pipe" });
  const code = await init.exited;
  if (code !== 0) {
    const err = await new Response(init.stderr).text();
    throw new Error(`lisa init failed for ${name} (exit ${code}): ${err}`);
  }
  await mkdir(join(root, "docs/knowledge"), { recursive: true });
  await cp(join(REPO, "docs/knowledge/charter.md"), join(root, "docs/knowledge/charter.md"));
  return root;
}

/** Read the terminal `result` message out of a run's transcript to recover the TRUE
 *  model id + usage + cost (the runner logs a sentinel model by default — review
 *  concern #4; here we read the real one rather than thread it through). */
async function readTerminal(runId: string): Promise<{ model: string; usage: Record<string, unknown>; costUsd: number }> {
  const path = join(TRANSCRIPTS, `${runId}.jsonl`);
  let text: string;
  try {
    text = await readFile(path, "utf8");
  } catch {
    return { model: "(no transcript)", usage: {}, costUsd: 0 };
  }
  let model = "(unknown)";
  let usage: Record<string, unknown> = {};
  let costUsd = 0;
  for (const line of text.split("\n")) {
    const t = line.trim();
    if (!t) continue;
    let msg: Record<string, unknown>;
    try {
      msg = JSON.parse(t) as Record<string, unknown>;
    } catch {
      continue;
    }
    if (typeof msg.model === "string") model = msg.model; // system init carries it
    if (msg.type === "result") {
      if (msg.usage && typeof msg.usage === "object") usage = msg.usage as Record<string, unknown>;
      if (typeof msg.total_cost_usd === "number") costUsd = msg.total_cost_usd;
    }
  }
  return { model, usage, costUsd };
}

/** Did the run materialize files into the sandbox board? (Belt-and-suspenders over the
 *  RunSummary flag — proves AC2/AC3 "no partial materialization" by inspecting disk.) */
async function countMaterialized(sandbox: string): Promise<number> {
  const dirs = [join(sandbox, "docs/active/stories"), join(sandbox, "docs/active/tickets")];
  let n = 0;
  for (const d of dirs) {
    try {
      const entries = await readdir(d);
      n += entries.filter((e) => e.endsWith(".md")).length;
    } catch {
      /* dir absent ⇒ 0 */
    }
  }
  return n;
}

async function runScenario(s: Scenario, sandbox: string): Promise<ScenarioResult> {
  console.log(`\n━━━ ${s.id} (${s.ac}) — epic=${s.epicPath.replace(REPO + "/", "")} budget=${s.budget.timeMs}ms,${s.budget.tokens}tok`);
  const started = Date.now();
  let summary: RunSummary | null = null;
  let error: string | undefined;
  try {
    summary = await runDecomposeEpic({
      epicPath: s.epicPath,
      budget: s.budget,
      projectRoot: sandbox,
      runId: s.id,
      transcriptDir: TRANSCRIPTS,
    });
  } catch (e) {
    error = e instanceof Error ? e.message : String(e);
    console.log(`  ✗ threw: ${error}`);
  }
  const wallMs = Date.now() - started;
  const term = await readTerminal(s.id);
  const matCount = await countMaterialized(sandbox);
  const outcome = summary?.outcome ?? "(threw)";
  const result: ScenarioResult = {
    id: s.id,
    ac: s.ac,
    expect: s.expect,
    outcome,
    matchedExpectation: outcome === s.expect,
    materialized: (summary?.materialized ?? false) || matCount > 0,
    wallMs,
    model: term.model,
    tokensCounted: countTokens(term.usage as never),
    usage: term.usage,
    costUsd: term.costUsd,
    runId: s.id,
    sandbox: sandbox.replace(REPO + "/", ""),
    error,
  };
  console.log(
    `  outcome=${outcome} (expected ${s.expect}${result.matchedExpectation ? " ✓" : " ✗"}) ` +
      `materialized=${result.materialized} files=${matCount} wall=${wallMs}ms ` +
      `tokens=${result.tokensCounted} cost=$${result.costUsd} model=${term.model}`,
  );
  return result;
}

async function main(): Promise<void> {
  await mkdir(RESULTS, { recursive: true });
  console.log("T-002-04 live-dispense-proof — preparing sandboxes…");
  const [sbA1, sbA2, sbA3, sbA4] = await Promise.all([
    prepSandbox("A1"),
    prepSandbox("A2"),
    prepSandbox("A3"),
    prepSandbox("A4"),
  ]);

  const scenarios: Array<[Scenario, string]> = [
    [{ id: "A1", ac: "AC1+AC4", epicPath: join(REPO, "docs/active/epic/E-001.md"), budget: { timeMs: 600_000, tokens: 400_000 }, expect: "success" }, sbA1!],
    [{ id: "A2", ac: "AC2-tokens", epicPath: join(HERE, "fixtures/tiny.md"), budget: { timeMs: 600_000, tokens: 1 }, expect: "budget-exhausted" }, sbA2!],
    [{ id: "A3", ac: "AC3", epicPath: join(HERE, "fixtures/underspecified.md"), budget: { timeMs: 600_000, tokens: 400_000 }, expect: "gate-failed" }, sbA3!],
    [{ id: "A4", ac: "AC2-time", epicPath: join(HERE, "fixtures/tiny.md"), budget: { timeMs: 1, tokens: 400_000 }, expect: "timed-out" }, sbA4!],
  ];

  const results: ScenarioResult[] = [];
  for (const [s, sandbox] of scenarios) {
    results.push(await runScenario(s, sandbox));
  }

  // A1's machine WorkPlan → a readable artifact for the AC4 by-hand-vs-machine diff.
  try {
    const a1 = join(sbA1!, "docs/active");
    const stories = await readdir(join(a1, "stories")).catch(() => [] as string[]);
    const tickets = await readdir(join(a1, "tickets")).catch(() => [] as string[]);
    const lines: string[] = ["# A1 — machine decomposition of E-001 (materialized files)", ""];
    for (const f of stories.filter((f) => f.endsWith(".md")).sort()) {
      lines.push(`## stories/${f}`, "", "```", (await readFile(join(a1, "stories", f), "utf8")).trim(), "```", "");
    }
    for (const f of tickets.filter((f) => f.endsWith(".md")).sort()) {
      lines.push(`## tickets/${f}`, "", "```", (await readFile(join(a1, "tickets", f), "utf8")).trim(), "```", "");
    }
    await writeFile(join(RESULTS, "e001-machine-plan.md"), lines.join("\n"), "utf8");
  } catch (e) {
    console.log(`  (could not snapshot A1 plan: ${e instanceof Error ? e.message : String(e)})`);
  }

  await writeFile(
    join(RESULTS, "summary.json"),
    JSON.stringify(
      { note: "T-002-04 live-dispense-proof; ledger at .vend/runs.jsonl (gitignored)", ledger: ".vend/runs.jsonl", runs: results },
      null,
      2,
    ),
    "utf8",
  );

  console.log("\n━━━ summary");
  for (const r of results) {
    console.log(`  ${r.id} ${r.ac}: ${r.outcome} (${r.matchedExpectation ? "as expected" : "DEVIATION"}), tokens=${r.tokensCounted}, cost=$${r.costUsd}, wall=${r.wallMs}ms`);
  }
  console.log(`\n  results/summary.json written. Run: wc -l .vend/runs.jsonl`);
}

if (import.meta.main) await main();
