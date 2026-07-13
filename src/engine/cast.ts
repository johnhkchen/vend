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
import { type ResultMessage } from "../executor/claude.ts";
import { ExecutorTimeoutError } from "../executor/executor.ts";
import type { Executor } from "../executor/executor.ts";
import { executorFor } from "../executor/select.ts";
import { check, timeoutMsFor, type Budget, type BudgetOutcome, type Usage } from "../budget/budget.ts";
import { appendRunLog, type RunOutcome } from "../log/run-log.ts";
import type { CastContext, EffectResult, GateVerdict, Play, SeatDefaulted, SeatInferred } from "./play.ts";
import {
  accumulateCastProgress,
  classify,
  EMPTY_CAST_PROGRESS,
  formatCastProgress,
  formatTurnSummary,
  makeStreamSink,
  resolveLoggedModel,
  resolveMaxTurns,
  resolveSeatOfExecution,
  resolveTools,
  resolveTurnsUsed,
  toolFlags,
} from "./cast-core.ts";
import { readProjectMcpServers } from "./mcp-registry.ts";
import { captureEffectDiff } from "./cast-diff.ts";

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
  /**
   * An explicit {@link Executor} INSTANCE to cast through (T-035-01) — highest precedence,
   * bypassing {@link executorFor}. The injection seam: a test casts a play through a stub
   * executor to prove the parse→gate→effect→log pipeline is executor-agnostic, and a caller
   * that pre-resolved an executor can hand it straight in. Absent ⇒ resolved via the selector.
   */
  readonly executor?: Executor;
  /**
   * An executor id to resolve via {@link executorFor} (T-035-01) — the env/opt selection path.
   * Lower precedence than {@link executor} (the instance). Absent ⇒ `executorFor()` ⇒
   * `VEND_EXECUTOR` ⇒ Claude (so no opt and no env ⇒ Claude ⇒ byte-identical to today).
   */
  readonly executorId?: string;
  /**
   * Millisecond clock for the live progress line. Omitted ⇒ {@link Date.now}. Injected by the
   * stub-executor harness so elapsed refreshes are deterministic; durable run-log timestamps keep
   * their established wall-clock path.
   */
  readonly now?: () => number;
}

/** The cast's MEASURED actuals (T-024-02) — what it actually cost, surfaced so the macro-wallet
 *  spend loop (`spendDown`) debits the wallet by the real burn rather than the predicted envelope.
 *  The two IA-8 denominations kept separate: `usage` (tokens — the seam's terminal `result.usage`,
 *  `{}` ⇒ 0 on a timed-out run) and `wallMs` (wall-clock the cast took, `endedAt − startedAt`). */
export interface CastActuals {
  readonly usage: Usage;
  readonly wallMs: number;
}

/** What a cast returns to its caller (which maps a non-`success` outcome to a non-zero exit). */
export interface RunSummary {
  readonly runId: string;
  readonly outcome: RunOutcome;
  /** Did the effect land (the play-generic analogue of the welded runner's `materialized`). */
  readonly materialized: boolean;
  /** One-way settlement warning: present only when a token-exhausted cast explicitly cleared
   *  its gates and was therefore allowed to materialize (T-068-02-03). */
  readonly overEnvelope?: true;
  /**
   * The artifact reference this cast produced (lifted off `EffectResult.produced`), surfaced so
   * a chain (T-011-01) can thread it into the next play's input. Present ONLY on a materialized
   * cast whose effect set it; `undefined` otherwise (a STOP never runs the effect; an effect may
   * surface nothing threadable). A `castChain` halts rather than thread an `undefined`.
   */
  readonly produced?: string;
  /** Repository-relative reference to the non-empty Git patch a landed effect produced.
   *  Omitted when no effect ran, the effect failed, or its reported artifacts have no diff. */
  readonly capturedDiff?: string;
  /**
   * The cast's measured cost (T-024-02). Populated on every REAL cast (`castPlay` always meters
   * both denominations); optional only so a hand-built `RunSummary` fake (chain-core.test.ts)
   * stays valid and so the spend loop's documented log-read fallback has a "surfaced none" case.
   * The autonomous spend loop debits the wallet by this.
   */
  readonly actuals?: CastActuals;
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

  // Per-play tool provisioning (E-032, T-032-02): resolve the play's declared `tools` against the
  // project MCP registry (`<root>/.mcp.json`) BEFORE rendering or dispensing. An UNDECLARED play
  // → passthrough (no flags, byte-identical to today). A DECLARED play missing a required MCP
  // server → the missing-capability ANDON: an IA-9 amber refusal that halts the cast here —
  // nothing rendered, nothing dispensed, nothing materialized. A required capability absent is a
  // STOP, not a silent blind run on the wrong tool set (IA-17).
  const { available, path: mcpConfigPath } = await readProjectMcpServers(root);
  const resolved = resolveTools(play.tools, available);
  if (!resolved.ok) {
    const endedAt = new Date().toISOString();
    process.stdout.write(`· andon: missing-capability — required MCP absent from project registry: ${resolved.missing.join(", ")}\n`);
    // Log the refusal so it is countable in the ledger (IA-10 — the andon rate is gates working),
    // surfaced exactly like the other honest refusals. Nothing was metered: usage {}, cost 0, no
    // gates. This early-return is the ONLY log call on this path (the end-of-cast append is below).
    await appendRunLog(
      {
        runId,
        play: play.name,
        epic: opts.subject,
        model: resolveLoggedModel(undefined, opts.model),
        envelope: budget,
        project,
        ...(opts.intervened !== undefined ? { intervened: opts.intervened } : {}),
        outcome: "missing-capability",
        usage: {} as Usage,
        costUsd: 0,
        gateResults: [],
        startedAt,
        endedAt,
      },
      opts.runLogPath ? { path: opts.runLogPath } : {},
    );
    return {
      runId,
      outcome: "missing-capability",
      materialized: false,
      actuals: { usage: {} as Usage, wallMs: Math.max(0, Date.parse(endedAt) - Date.parse(startedAt)) },
    };
  }
  // The resolved scoping flags threaded into `dispense` below (passthrough ⇒ {} ⇒ no flags).
  const tflags = toolFlags(resolved, mcpConfigPath);

  // Render the prompt from the play's typed inputs — never the transport, just the text.
  const prompt = play.render(inputs);

  // The effective turn cap (T-015-02): the per-cast override (T-015-01) wins, else the play's
  // warranted default (`play.maxTurns`), else undefined ⇒ the seam omits `--max-turns` ⇒ turns
  // bounded only by the wall-clock latch + token budget. Resolve it before the live sink because
  // the refreshing line carries the same effective cap handed to the executor.
  const maxTurns = resolveMaxTurns(opts.maxTurns, play.maxTurns);

  // Both surfaces: ONE refreshing stdout line + a durable per-run transcript. The executor-facing
  // wrapper owns the impure clock/terminal control while the existing pure sink remains the single
  // raw-JSON serializer. Appends are chained so callback order is preserved and an awaited cast has
  // durably finished every transcript write before returning.
  const transcriptPath = join(opts.transcriptDir ?? join(root, ".vend", "transcripts"), `${runId}.jsonl`);
  await mkdir(dirname(transcriptPath), { recursive: true });
  let transcriptWrites: Promise<void> = Promise.resolve();
  const transcriptSink = makeStreamSink({
    // The wrapper below replaces the legacy per-event label with the progress row. Keeping this
    // edge suppressed lets makeStreamSink retain ownership of exact raw serialization.
    write: () => {},
    sink: (raw) => {
      transcriptWrites = transcriptWrites.then(() => appendFile(transcriptPath, `${raw}\n`, "utf8"));
    },
  });
  const now = opts.now ?? Date.now;
  const progressStartedAt = now();
  let progress = EMPTY_CAST_PROGRESS;
  let progressLineWritten = false;
  const onMessage = (message: Parameters<typeof transcriptSink>[0]): void => {
    progress = accumulateCastProgress(progress, message);
    const elapsedMs = Math.max(0, now() - progressStartedAt);
    const line = formatCastProgress(progress, { elapsedMs, tokenEnvelope: budget.tokens, maxTurns });
    process.stdout.write(`\r\x1b[2K${line}`);
    progressLineWritten = true;
    transcriptSink(message);
  };

  // Resolve the executor for this cast (T-035-01): an explicit instance wins; else the
  // selector picks by id/env, defaulting to Claude. No instance, no id, no env ⇒
  // `executorFor()` ⇒ `ClaudeExecutor` ⇒ the same `dispense` with the same args ⇒
  // byte-identical to before the interface existed.
  const executor = opts.executor ?? executorFor(opts.executorId ? { executor: opts.executorId } : {});
  // Execution provenance (T-071-01-02): map the instance ACTUALLY selected/injected to the
  // KNOWN_SEATS lane it burns. Unknown executor ids stay undefined and are omitted below rather
  // than being falsely charged to a default lane. Resolve before dispense so timeouts still name
  // the executor lane on which work was attempted.
  const seatOfExecution = resolveSeatOfExecution(executor.id);

  let timedOut = false;
  let result: ResultMessage | null = null;
  try {
    result = await executor.dispense({
      prompt,
      model: opts.model, // undefined ⇒ no --model flag ⇒ CLI default
      maxTurns, // override ?? play default ?? undefined (no flag ⇒ unbounded turns)
      ...tflags, // E-032 scoping flags — {} for a passthrough (undeclared) play ⇒ argv unchanged
      onMessage,
      timeoutMs: timeoutMsFor(budget),
    });
  } catch (e) {
    // The generalized timeout (T-035-01): a Claude timeout is a `ClaudeTimeoutError`, an
    // `ExecutorTimeoutError` subclass, so keying on the base catches every executor's timeout.
    if (e instanceof ExecutorTimeoutError) timedOut = true;
    else throw e; // a genuine launch/absent-result failure is not a clean outcome
  } finally {
    await transcriptWrites;
    // End the single refreshing row exactly once before any existing post-run surface writes.
    if (progressLineWritten) process.stdout.write("\n");
  }

  // The context both gates and effect receive — assembled once.
  const ctx: CastContext<I> = { inputs, projectRoot: root };

  // After the seam: meter tokens, then parse + gate every returned result — including a detect-
  // after token overshoot. The gates must see that already-paid-for output so `classify` can retain
  // it ONLY on an explicit CLEAR and attach the over-envelope warning (T-068-02-03); a STOP still
  // discards it. With `--no-gates` the gate call is skipped and `gateVerdict` stays null, so an
  // exhausted ungated result remains budget-exhausted while the in-budget E2 control still lands.
  let budgetOutcome: BudgetOutcome | null = null;
  let gateVerdict: GateVerdict | null = null;
  let output: O | null = null;
  if (!timedOut && result) {
    budgetOutcome = check(budget, (result.usage ?? {}) as Usage);
    output = play.parse(result.result ?? "");
    if (opts.skipGates) process.stdout.write("· gates skipped (--no-gates)\n");
    gateVerdict = opts.skipGates ? null : play.gates(output, ctx);
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
  let capturedDiff: string | undefined;
  let seatDefaulted: SeatDefaulted | undefined;
  let seatInferred: SeatInferred | undefined;
  let outcome: RunOutcome = verdict.outcome;
  if (verdict.materialize && output !== null) {
    const reported = await play.effect(output, ctx);
    // The effect reports the files it wrote; the generic impure shell owns Git capture. Enriching
    // the result here keeps capturedDiff on the EffectResult → RunRecord path without requiring
    // every concrete play to know about Git or `.vend` storage.
    const effectDiff = reported.ok
      ? await captureEffectDiff({ projectRoot: root, runId, artifacts: reported.artifacts })
      : undefined;
    const eff: EffectResult = effectDiff === undefined
      ? reported
      : { ...reported, capturedDiff: effectDiff };
    materialized = eff.ok;
    // Preserve the effect's authoritative routing disposition. The generic cast loop does not
    // inspect play-specific inputs or re-run seat policy; it only surfaces and records the report.
    seatDefaulted = eff.seatDefaulted;
    seatInferred = eff.seatInferred;
    // Surface the produced reference ONLY when the effect actually landed — a chain threads it
    // into the next play (T-011-01); a failed (e.g. id-collision) effect surfaces nothing.
    produced = eff.ok ? eff.produced : undefined;
    capturedDiff = eff.capturedDiff;
    if (eff.outcome) outcome = eff.outcome;
    process.stdout.write(`· effect ${eff.ok ? "✓" : "✗"}${eff.detail ? ` ${eff.detail}` : ""}\n`);
  } else if (verdict.outcome !== "success") {
    process.stdout.write(`· andon: ${verdict.outcome}${stopReason(gateVerdict, budgetOutcome)}\n`);
  }

  // The honest seat-default signal (T-070-01-03): an unknown requested routing seat did not
  // discard the cleared board. Name requested versus applied at cast time and make clear that the
  // successful degradation continues into the durable record below.
  if (seatDefaulted !== undefined) {
    process.stdout.write(
      `· seat defaulted — requested '${seatDefaulted.requested}'; using '${seatDefaulted.applied}' ` +
        `(${seatDefaulted.reason}; proceeding, recorded)\n`,
    );
  }

  // The live Settle warning (T-068-02-03): presence comes ONLY from the pure classifier; the
  // exhausted outcome contributes factual meter detail, not a second warning decision.
  if (verdict.overEnvelope && budgetOutcome?.status === "exhausted") {
    process.stdout.write(
      `· settle warning: over-envelope — spent ${budgetOutcome.spent}/${budgetOutcome.ceiling} tokens ` +
        `(over by ${budgetOutcome.overage}); gates cleared, output retained\n`,
    );
  }

  // Resolve the logged model id DOWNSTREAM of dispense, so the real id the stream reported
  // (on `result.model`) is in scope: real id → pinned `opts.model` → sentinel. On timeout
  // `result` is null and this falls back cleanly.
  const loggedModel = resolveLoggedModel(result?.model, opts.model);

  // Preserve the terminal result's `num_turns` (T-015-02) as raw executor evidence. Claude's
  // value counts conversation events (initial event + emitted user/tool-result messages), NOT
  // the model-loop iterations bounded by `--max-turns`; parallel tool calls can therefore make
  // it exceed that cap without an enforcement failure. The final formatter pairs the cap only
  // with the stream's distinct-assistant count and labels this external counter separately.
  const turnsUsed = resolveTurnsUsed(result?.num_turns);
  const turnSummary = formatTurnSummary({
    ...(progress.turns > 0 ? { agentTurns: progress.turns } : {}),
    ...(maxTurns !== undefined ? { maxTurns } : {}),
    ...(turnsUsed !== undefined ? { executorReportedTurns: turnsUsed } : {}),
  });
  if (turnSummary !== undefined) process.stdout.write(`${turnSummary}\n`);

  // The honest reduced-grounding signal (E-060 #3, T-060-01-02): `resolved.reducedGrounding` exists
  // only on the strict variant, so the `in` check narrows the resolved union and the `&&` collapses
  // the strict-but-fully-grounded case to false. One-way — only a DEGRADE is surfaced/recorded
  // (the andon early-return above is a different condition and never reaches here). The marker rides
  // onto the run record below so a degraded clear is countable, not invisible; the stdout note makes
  // it visible at cast time too (a designer watching the cast SEES the degrade, not only the ledger).
  const reducedGrounding = "reducedGrounding" in resolved && resolved.reducedGrounding;
  if (reducedGrounding) {
    process.stdout.write("· reduced grounding — optional codebase-memory MCP absent; proceeding (degraded, recorded)\n");
  }

  // Stamp the end ONCE and reuse it for both the log record and the returned actuals (T-024-02),
  // so the wall-clock the wallet debits is exactly the span the ledger records.
  const endedAt = new Date().toISOString();

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
      // The resolved executor's accounting lane (T-071-01-02). The pure core owns the explicit
      // executor-id mapping; spread only when known so an unmapped/lane-less executor leaves the
      // key off, exactly like `turnsUsed`, rather than fabricating provenance.
      ...(seatOfExecution !== undefined ? { seatOfExecution } : {}),
      // Durable patch evidence (T-073-01-01): only a landed effect with a non-empty Git diff
      // supplies a reference. The ledger stays compact; the reviewing seat loads the artifact.
      ...(capturedDiff !== undefined ? { capturedDiff } : {}),
      // The reduced-grounding marker (T-060-01-02, E-060 #3) — one-way, spread only when the cast
      // degraded (an optional MCP was absent) so a fully-grounded cast (and every pre-T-060-01-02
      // record) leaves the field off, byte-identical. Makes a degraded clear countable in the ledger.
      ...(reducedGrounding ? { reducedGrounding: true } : {}),
      // One authoritative warning fact (T-068-02-03): forward the classifier marker rather than
      // re-deriving it from meter/gate state. Unmarked casts omit the key (one-way record contract).
      ...(verdict.overEnvelope ? { overEnvelope: true } : {}),
      // The effect's authoritative routing disposition (T-070-01-03). Forward the exact report;
      // absence omits the key so ordinary and historical records retain their existing shape.
      ...(seatDefaulted !== undefined ? { seatDefaulted } : {}),
      // The effect is the sole inference-policy boundary. Preserve its chosen seat and evidence
      // verbatim; an explicit or ambiguous/unrouted cast omits the one-way marker.
      ...(seatInferred !== undefined ? { seatInferred } : {}),
      outcome,
      usage: (result?.usage ?? {}) as Usage,
      costUsd: typeof result?.total_cost_usd === "number" ? result.total_cost_usd : 0,
      gateResults: verdict.gateLog,
      startedAt,
      endedAt,
    },
    opts.runLogPath ? { path: opts.runLogPath } : {},
  );

  // Surface the cast's measured actuals (T-024-02) for the macro-wallet spend loop: the tokens the
  // seam reported (`{}` ⇒ 0 on a timed-out run, honestly nothing metered) and the wall-clock span
  // (non-negative by construction). The wallet debits by this; the predicted envelope only gates
  // authorization (P7).
  const wallMs = Math.max(0, Date.parse(endedAt) - Date.parse(startedAt));
  const usage = (result?.usage ?? {}) as Usage;
  return {
    runId,
    outcome,
    materialized,
    ...(verdict.overEnvelope ? { overEnvelope: true } : {}),
    produced,
    capturedDiff,
    actuals: { usage, wallMs },
  };
}

/** A short andon suffix for stdout — names the gate/budget reason when there is one. Pure;
 *  kept private here (cosmetic stdout) exactly as the runner's `stopReason` is. */
function stopReason(gate: GateVerdict | null, budget: BudgetOutcome | null): string {
  if (gate?.status === "stop") return ` — gate '${gate.gate}' stopped at ${gate.unit}: ${gate.reason}`;
  if (budget?.status === "exhausted") return ` — spent ${budget.spent}/${budget.ceiling} tokens (over by ${budget.overage})`;
  return "";
}
