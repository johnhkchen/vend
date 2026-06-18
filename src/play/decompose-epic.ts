// The DecomposeEpic runner (T-002-03) — the convergence node of E-001.
//
// Wires the hardcoded play end to end: assemble inputs → render (b.request) →
// dispense (the `claude -p` seam, under a wall-clock budget) → SAP-parse (b.parse) →
// clear (the four gates) → on PASS materialize lisa files + `lisa validate`; on any
// STOP write nothing but the run log. Every stream message fans to BOTH surfaces
// (live stdout + a durable per-run transcript); the run's outcome is logged once,
// countably (one appendRunLog call).
//
// PURITY (house pattern): the runner's JUDGMENT is pure and tested — `classify` maps
// (timeout, budget, gate) → an outcome + a materialize decision; `gateRowsFor`
// translates the gates' whole-plan verdict into run-log per-gate rows (T-002-02 #1);
// `formatMessage`/`makeStreamSink` format the transcript given injected edges. The
// ACTIONS (`runDecomposeEpic`, `lisaValidate`) are the IMPURE shell — they spawn
// `claude`/`lisa`, touch fs, and call BAML in-process; they are the single untested
// verbs (their logic lives in the pure cores), proven live in T-002-04.
//
// BAML in-process: render + parse are called DIRECTLY here (no subprocess bridge).
// The addon's one-call-per-process limit is `bun test`-runner-specific (memory 20232);
// a plain `bun` process — which the runner/CLI is — runs both calls fine.

import { appendFile, mkdir } from "node:fs/promises";
import { dirname, join } from "node:path";
import { b } from "../../baml_client/sync_client.ts";
import type { WorkPlan } from "../../baml_client/index.ts";
import { extractPromptText } from "../baml/decompose-bridge.ts";
import { ClaudeTimeoutError, dispense, type ResultMessage } from "../executor/claude.ts";
import { check, timeoutMsFor, type Budget, type BudgetOutcome, type Usage } from "../budget/budget.ts";
import { clear, isStop, type GateResult } from "../gate/gates.ts";
import { appendRunLog, type RunOutcome } from "../log/run-log.ts";
import { assembleInputs } from "./project-context.ts";
import { materialize, IdCollisionError } from "./materialize.ts";
import { classify, makeStreamSink, resolveLoggedModel } from "./decompose-epic-core.ts";

// The runner's PURE decision core lives in ./decompose-epic-core.ts (classify,
// gateRowsFor, formatMessage, makeStreamSink) — split out so its test never loads the
// BAML native addon this module value-imports. Re-export so callers have one entry.
export * from "./decompose-epic-core.ts";

/** The play name stamped on every run-log record. */
export const PLAY = "decompose-epic";
// DEFAULT_MODEL moved to ./decompose-epic-core.ts (re-exported via `export *` above)
// so the run-log model fallback is resolvable + testable without the BAML addon.

/** Options for {@link runDecomposeEpic}. */
export interface RunOptions {
  readonly epicPath: string;
  readonly budget: Budget;
  /** Repo root the snapshot is gathered from and lisa files are written under. */
  readonly projectRoot?: string;
  /** Pinned model id; omitted ⇒ CLI default (and {@link DEFAULT_MODEL} logged). */
  readonly model?: string;
  /** Stable run id; derived if omitted. */
  readonly runId?: string;
  /** Override the transcript dir (default `<root>/.vend/transcripts`). */
  readonly transcriptDir?: string;
}

/** What the runner returns to the CLI (which maps non-success → non-zero exit). */
export interface RunSummary {
  readonly runId: string;
  readonly outcome: RunOutcome;
  readonly materialized: boolean;
}

/** The result of spawning `lisa validate` (AC#6's final poka-yoke). */
export interface ValidateResult {
  readonly ok: boolean;
  readonly output: string;
}

/**
 * Spawn `lisa validate --path <root>` — the final structural poka-yoke run after the
 * files are written. IMPURE verb. Tolerates `lisa` being absent (returns `ok: false`
 * with the reason rather than crashing the run record), so a missing binary degrades
 * to a logged validate-failure, not an unhandled throw.
 */
export async function lisaValidate(projectRoot: string): Promise<ValidateResult> {
  try {
    const proc = Bun.spawn(["lisa", "validate", "--path", projectRoot], { stdout: "pipe", stderr: "pipe" });
    const [out, err, code] = await Promise.all([
      new Response(proc.stdout).text(),
      new Response(proc.stderr).text(),
      proc.exited,
    ]);
    return { ok: code === 0, output: `${out}${err}`.trim() };
  } catch (e) {
    return { ok: false, output: `lisa validate could not run: ${e instanceof Error ? e.message : String(e)}` };
  }
}

/** Pull a lisa id out of the epic's frontmatter (`id: E-001`), else the file basename. */
function epicIdOf(epic: string, epicPath: string): string {
  const m = epic.match(/^\s*id:\s*(\S+)/m);
  if (m?.[1]) return m[1];
  const base = epicPath.split("/").pop() ?? epicPath;
  return base.replace(/\.md$/, "") || epicPath;
}

/**
 * Run the hardcoded DecomposeEpic play end to end. The single IMPURE orchestrator —
 * composes the seam, budget, gates, materializer, and log, branching on the pure
 * `classify` verdict. NOT unit-tested (its logic is the pure cores above); the live
 * proof is T-002-04.
 */
export async function runDecomposeEpic(opts: RunOptions): Promise<RunSummary> {
  const root = opts.projectRoot ?? process.cwd();
  const startedAt = new Date().toISOString();
  const runId = opts.runId ?? `run-${startedAt.replace(/[:.]/g, "-")}`;

  const { epic, charter, project } = await assembleInputs({ epicPath: opts.epicPath, projectRoot: root });
  const epicId = epicIdOf(epic, opts.epicPath);

  // Render the prompt (BAML, in-process) — never the transport, just the text.
  const req = b.request.DecomposeEpic(epic, charter, project) as unknown as {
    body: { json: () => { messages?: unknown[] } };
  };
  const prompt = extractPromptText(req);

  // Both surfaces: live stdout + a durable per-run transcript.
  const transcriptPath = join(opts.transcriptDir ?? join(root, ".vend", "transcripts"), `${runId}.jsonl`);
  await mkdir(dirname(transcriptPath), { recursive: true });
  const onMessage = makeStreamSink({
    write: (line) => process.stdout.write(`${line}\n`),
    // fire-and-forget append; ordering within a run is preserved by the seam's
    // in-order onMessage and append's O_APPEND.
    sink: (raw) => void appendFile(transcriptPath, `${raw}\n`, "utf8"),
  });

  let timedOut = false;
  let result: ResultMessage | null = null;
  try {
    result = await dispense({
      prompt,
      model: opts.model, // undefined ⇒ no --model flag ⇒ CLI default
      onMessage,
      timeoutMs: timeoutMsFor(opts.budget),
    });
  } catch (e) {
    if (e instanceof ClaudeTimeoutError) timedOut = true;
    else throw e; // a genuine launch/absent-result failure is not a clean outcome
  }

  // After the seam: meter tokens, then (if in budget) parse + clear.
  let budgetOutcome: BudgetOutcome | null = null;
  let gateResult: GateResult | null = null;
  let plan: WorkPlan | null = null;
  if (!timedOut && result) {
    budgetOutcome = check(opts.budget, (result.usage ?? {}) as Usage);
    if (budgetOutcome.status === "ok") {
      plan = b.parse.DecomposeEpic(result.result ?? "");
      gateResult = clear(plan, { epic, charter });
    }
  }

  const verdict = classify({ timedOut, budgetOutcome, gateResult });

  let materialized = false;
  // The collision guard lives inside `materialize` (T-004-02) and refuses by throwing
  // BEFORE any write, so a re-minted id never reaches here as a CLEAR-then-clobber. A
  // refusal relabels an otherwise-`success` verdict to `id-collision` for the one
  // run-log record; the gates still genuinely passed, so `verdict.gateLog` is logged
  // unchanged. Any non-collision throw is a genuine fs failure, not a clean outcome —
  // re-raised, mirroring the seam's non-timeout handling above.
  let outcome: RunOutcome = verdict.outcome;
  if (verdict.materialize && plan) {
    try {
      await materialize(plan, {
        storiesDir: join(root, "docs", "active", "stories"),
        ticketsDir: join(root, "docs", "active", "tickets"),
      });
      const validated = await lisaValidate(root);
      materialized = validated.ok;
      process.stdout.write(
        validated.ok ? "· lisa validate ✓\n" : `· lisa validate ✗\n${validated.output}\n`,
      );
    } catch (e) {
      if (e instanceof IdCollisionError) {
        outcome = "id-collision";
        process.stdout.write(`· andon: id-collision — reused board id(s): ${e.collisions.join(", ")}\n`);
      } else {
        throw e;
      }
    }
  } else if (verdict.outcome !== "success") {
    process.stdout.write(`· andon: ${verdict.outcome}${stopReason(gateResult, budgetOutcome)}\n`);
  }

  // Resolve the logged model id DOWNSTREAM of dispense, so the real id the stream
  // reported (on `result.model`) is in scope: real id → pinned `opts.model` →
  // sentinel (T-005-01). On timeout `result` is null and this falls back cleanly.
  const loggedModel = resolveLoggedModel(result?.model, opts.model);

  await appendRunLog({
    runId,
    play: PLAY,
    epic: epicId,
    model: loggedModel,
    outcome,
    usage: (result?.usage ?? {}) as Usage,
    costUsd: typeof result?.total_cost_usd === "number" ? result.total_cost_usd : 0,
    gateResults: verdict.gateLog,
    startedAt,
    endedAt: new Date().toISOString(),
  });

  return { runId, outcome, materialized };
}

/** A short andon suffix for stdout — names the gate/budget reason when there is one. */
function stopReason(gate: GateResult | null, budget: BudgetOutcome | null): string {
  if (gate && isStop(gate)) return ` — gate '${gate.gate}' stopped at ${gate.unit}: ${gate.reason}`;
  if (budget?.status === "exhausted") return ` — spent ${budget.spent}/${budget.ceiling} tokens (over by ${budget.overage})`;
  return "";
}
