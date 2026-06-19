// The generic cast loop (T-007-02) — the play-agnostic spine extracted from
// `runDecomposeEpic` (src/play/decompose-epic.ts). One fixed orchestration every play is
// cast through: render(play) → dispense (the `claude -p` seam, under a wall-clock budget)
// → meter (budget.check) → parse(play) → gates(play) → classify → on pass effect(play) →
// appendRunLog. The loop branches on the SAME pure `classify` verdict (timeout / budget /
// gate) the runner used; the play-specific bits all come from the `Play` interface
// (T-007-01). Every stream message fans to BOTH surfaces (live stdout + a durable per-run
// transcript); the run's outcome is logged once, countably (one appendRunLog call per cast).
//
// PLAY-AGNOSTIC (AC#2): this module imports the seam, budget, the run log, and the `Play`
// INTERFACE only — NO `src/play/`, NO gates.ts, NO BAML. That is what makes it generic, and
// it keeps the dependency graph acyclic: a concrete play depends UP onto the engine
// (T-007-03 registers DecomposeEpic and calls `castPlay`), so the engine must never depend
// down into `src/play/`.
//
// PURITY (house pattern, mirrors `runDecomposeEpic`): the JUDGMENT is pure and tested in
// ./cast-core.ts (classify, castGateRows, the stream sink, the model resolver). `castPlay`
// is the IMPURE shell — it spawns `claude` (via `dispense`), touches fs (transcript + run
// log), and calls the play's own impure `effect`; it is the single UNTESTED verb (its logic
// lives in the pure core), proven live in T-007-03 when a real play is registered and cast.

import { appendFile, mkdir } from "node:fs/promises";
import { basename, dirname, join } from "node:path";
import { ClaudeTimeoutError, dispense, type ResultMessage } from "../executor/claude.ts";
import { check, timeoutMsFor, type Budget, type BudgetOutcome, type Usage } from "../budget/budget.ts";
import { appendRunLog, type RunOutcome } from "../log/run-log.ts";
import type { CastContext, GateVerdict, Play } from "./play.ts";
import { classify, makeStreamSink, resolveLoggedModel, resolveMaxTurns, resolveTurnsUsed } from "./cast-core.ts";

// Re-export the pure core so callers (T-007-03) have one engine entry for the cast surface.
export * from "./cast-core.ts";

/** Options for {@link castPlay} — the per-cast runtime values the play itself does not carry. */
export interface CastOptions {
  /**
   * The cast's target identifier, stamped on the run-log record's `epic` field. Play-generic
   * (DecomposeEpic supplies its epic id; another play supplies its own subject). Required +
   * non-empty — an empty one is a caller wiring error surfaced by `appendRunLog`'s assert.
   */
  readonly subject: string;
  /** Repo root the transcript + run log are written under, and the effect's `projectRoot`. */
  readonly projectRoot?: string;
  /** Stable project identifier stamped on the run-log record (T-013-03), so the Ledger can
   *  bias-correct per project (IA-16). Defaults to the repo-root basename — the local-first
   *  project id (charter P5; a cross-project corpus is a documented follow-up). */
  readonly project?: string;
  /** Pinned model id; omitted ⇒ CLI default (and {@link DEFAULT_MODEL} logged). */
  readonly model?: string;
  /** Agentic turn cap (IA-8, the mid-flight bound) → threaded to the seam as `--max-turns`.
   *  Omitted ⇒ no flag ⇒ a run bounded only by the wall-clock latch + token/cost budget. */
  readonly maxTurns?: number;
  /** Stable run id; derived from `startedAt` if omitted. */
  readonly runId?: string;
  /** Override the transcript dir (default `<root>/.vend/transcripts`). */
  readonly transcriptDir?: string;
  /** Override the run-log ledger path (default `appendRunLog`'s `.vend/runs.jsonl`). */
  readonly runLogPath?: string;
  /** The E1 trust bit (T-014-01): did the author step in mid-run (`true`) or let it clear
   *  (`false`)? Self-reported at the cast command; threaded straight to the single end-of-cast
   *  append (pass-through data, exactly like `project`). Absent ⇒ field omitted ⇒ unknown. */
  readonly intervened?: boolean;
  /**
   * Skip the play's gate phase — the E2 / `--no-gates` run mode (T-014-02). When set, the
   * parsed output is materialized WITHOUT clearing: `gateVerdict` stays null, so `classify`
   * sees no stop and returns `success` → the effect lands ungated. Absent/false ⇒ the gated
   * path is byte-for-byte unchanged. An ungated run logs `gateResults: []` (no gates ran —
   * honest, the same shape a timed-out/exhausted run logs). The enabler for the variance
   * probe (PRD KR3): casting one play ±gates on a fixed input to measure gate-driven
   * variance reduction. NOT a quality bypass for normal use.
   */
  readonly skipGates?: boolean;
}

/** What a cast returns to its caller (which maps a non-`success` outcome to a non-zero exit). */
export interface RunSummary {
  readonly runId: string;
  readonly outcome: RunOutcome;
  /** Did the effect land (the play-generic analogue of the welded runner's `materialized`). */
  readonly materialized: boolean;
  /**
   * The artifact reference this cast produced (lifted off `EffectResult.produced`), surfaced so
   * a chain (T-011-01) can thread it into the next play's input. Present ONLY on a materialized
   * cast whose effect set it; `undefined` otherwise (a STOP never runs the effect; an effect may
   * surface nothing threadable). A `castChain` halts rather than thread an `undefined`.
   */
  readonly produced?: string;
}

/**
 * Cast a play end to end. The single IMPURE orchestrator — composes the seam, budget, the
 * play's render/parse/gates/effect, and the log, branching on the pure `classify` verdict.
 * Generic over the play's typed inputs `I` and output `O`. NOT unit-tested (its logic is the
 * pure core in ./cast-core.ts); the live proof is T-007-03.
 */
export async function castPlay<I, O>(
  play: Play<I, O>,
  inputs: I,
  budget: Budget,
  opts: CastOptions,
): Promise<RunSummary> {
  const root = opts.projectRoot ?? process.cwd();
  // The stable project id for the record — the repo-root basename unless overridden.
  const project = opts.project ?? basename(root);
  const startedAt = new Date().toISOString();
  const runId = opts.runId ?? `run-${startedAt.replace(/[:.]/g, "-")}`;

  // Render the prompt from the play's typed inputs — never the transport, just the text.
  const prompt = play.render(inputs);

  // Both surfaces: live stdout + a durable per-run transcript.
  const transcriptPath = join(opts.transcriptDir ?? join(root, ".vend", "transcripts"), `${runId}.jsonl`);
  await mkdir(dirname(transcriptPath), { recursive: true });
  const onMessage = makeStreamSink({
    write: (line) => process.stdout.write(`${line}\n`),
    // fire-and-forget append; ordering within a run is preserved by the seam's in-order
    // onMessage and append's O_APPEND.
    sink: (raw) => void appendFile(transcriptPath, `${raw}\n`, "utf8"),
  });

  // The effective turn cap (T-015-02): the per-cast override (T-015-01) wins, else the play's
  // warranted default (`play.maxTurns`), else undefined ⇒ the seam omits `--max-turns` ⇒ turns
  // bounded only by the wall-clock latch + token budget. The number is calibrated from data
  // (turnsUsed, logged below), not frozen.
  const maxTurns = resolveMaxTurns(opts.maxTurns, play.maxTurns);

  let timedOut = false;
  let result: ResultMessage | null = null;
  try {
    result = await dispense({
      prompt,
      model: opts.model, // undefined ⇒ no --model flag ⇒ CLI default
      maxTurns, // override ?? play default ?? undefined (no flag ⇒ unbounded turns)
      onMessage,
      timeoutMs: timeoutMsFor(budget),
    });
  } catch (e) {
    if (e instanceof ClaudeTimeoutError) timedOut = true;
    else throw e; // a genuine launch/absent-result failure is not a clean outcome
  }

  // The context both gates and effect receive — assembled once.
  const ctx: CastContext<I> = { inputs, projectRoot: root };

  // After the seam: meter tokens, then (if in budget) parse + gate via the play. With the
  // `--no-gates` run mode (T-014-02) the gate call is skipped — `gateVerdict` stays null, which
  // `classify` reads as "no stop", so the output materializes ungated (the E2 probe's control
  // arm). The gated path is unchanged when the flag is absent.
  let budgetOutcome: BudgetOutcome | null = null;
  let gateVerdict: GateVerdict | null = null;
  let output: O | null = null;
  if (!timedOut && result) {
    budgetOutcome = check(budget, (result.usage ?? {}) as Usage);
    if (budgetOutcome.status === "ok") {
      output = play.parse(result.result ?? "");
      if (opts.skipGates) process.stdout.write("· gates skipped (--no-gates)\n");
      gateVerdict = opts.skipGates ? null : play.gates(output, ctx);
    }
  }

  const verdict = classify({ timedOut, budgetOutcome, gateVerdict });

  // On a CLEAR verdict the play's effect lands the output in the world. The effect REPORTS
  // back as data (`EffectResult` — T-007-01 design D3): `ok` whether it landed, and an
  // optional `outcome` RELABEL (e.g. an id-collision refusal → "id-collision") the loop
  // logs without the effect having to throw across this boundary. An UNCONTRACTED throw
  // (a genuine fs failure, not the expected relabel) propagates — it is a real bug, not a
  // clean outcome, mirroring the seam's non-timeout handling above.
  let materialized = false;
  let produced: string | undefined;
  let outcome: RunOutcome = verdict.outcome;
  if (verdict.materialize && output !== null) {
    const eff = await play.effect(output, ctx);
    materialized = eff.ok;
    // Surface the produced reference ONLY when the effect actually landed — a chain threads it
    // into the next play (T-011-01); a failed (e.g. id-collision) effect surfaces nothing.
    produced = eff.ok ? eff.produced : undefined;
    if (eff.outcome) outcome = eff.outcome;
    process.stdout.write(`· effect ${eff.ok ? "✓" : "✗"}${eff.detail ? ` ${eff.detail}` : ""}\n`);
  } else if (verdict.outcome !== "success") {
    process.stdout.write(`· andon: ${verdict.outcome}${stopReason(gateVerdict, budgetOutcome)}\n`);
  }

  // Resolve the logged model id DOWNSTREAM of dispense, so the real id the stream reported
  // (on `result.model`) is in scope: real id → pinned `opts.model` → sentinel. On timeout
  // `result` is null and this falls back cleanly.
  const loggedModel = resolveLoggedModel(result?.model, opts.model);

  // Harvest the agentic turns the run took off the terminal result's `num_turns` (T-015-02):
  // the signal the warranted turn cap is calibrated from. Absent on a timed-out run (no
  // result) or a stream that named none ⇒ the run-log field is omitted (reads unknown).
  const turnsUsed = resolveTurnsUsed(result?.num_turns);
  if (turnsUsed !== undefined) process.stdout.write(`· turns: ${turnsUsed}${maxTurns ? ` / ${maxTurns} cap` : ""}\n`);

  await appendRunLog(
    {
      runId,
      play: play.name,
      epic: opts.subject,
      model: loggedModel,
      // The allocated envelope this cast ran under — recorded so cost-vs-budget is
      // recoverable from the ledger (T-013-01, IA-12/13). `Budget` duck-types onto the
      // log's local `Envelope` (no src/budget ↔ src/log import — the decoupling holds).
      envelope: budget,
      // The project this cast ran against — groups the record for two-level bias correction
      // (T-013-03, IA-16); the repo-root basename unless the caller overrode it.
      project,
      // The E1 trust bit (T-014-01) — pass-through; spread only when supplied, so an
      // unreported cast (and every pre-T-014-01 record) leaves the field off, reading unknown.
      ...(opts.intervened !== undefined ? { intervened: opts.intervened } : {}),
      // The agentic turns the cast took (T-015-02) — pass-through, spread only when known so a
      // timed-out run (no result) leaves the field off, exactly like `intervened`.
      ...(turnsUsed !== undefined ? { turnsUsed } : {}),
      outcome,
      usage: (result?.usage ?? {}) as Usage,
      costUsd: typeof result?.total_cost_usd === "number" ? result.total_cost_usd : 0,
      gateResults: verdict.gateLog,
      startedAt,
      endedAt: new Date().toISOString(),
    },
    opts.runLogPath ? { path: opts.runLogPath } : {},
  );

  return { runId, outcome, materialized, produced };
}

/** A short andon suffix for stdout — names the gate/budget reason when there is one. Pure;
 *  kept private here (cosmetic stdout) exactly as the runner's `stopReason` is. */
function stopReason(gate: GateVerdict | null, budget: BudgetOutcome | null): string {
  if (gate?.status === "stop") return ` — gate '${gate.gate}' stopped at ${gate.unit}: ${gate.reason}`;
  if (budget?.status === "exhausted") return ` — spent ${budget.spent}/${budget.ceiling} tokens (over by ${budget.overage})`;
  return "";
}
