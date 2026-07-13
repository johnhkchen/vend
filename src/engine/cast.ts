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

import { access, appendFile, mkdir, readFile } from "node:fs/promises";
import { basename, dirname, join } from "node:path";
import { type ResultMessage } from "../executor/claude.ts";
import { ExecutorTimeoutError } from "../executor/executor.ts";
import type { Executor, ExecutorProbeResult } from "../executor/executor.ts";
import { executorFor, type ExecutorRegistry } from "../executor/select.ts";
import { check, timeoutMsFor, type Budget, type BudgetOutcome, type Usage } from "../budget/budget.ts";
import {
  appendRunLog,
  type ArtifactDiscrepancy,
  type CrossReviewSkipped,
  type CrossVendorVerdict,
  type DegradeDisposition,
  type GateResult as LogGate,
  type RunOutcome,
} from "../log/run-log.ts";
import {
  type ComplementExecutor,
  resolveComplementExecutor,
} from "../cross-review/resolve-complement.ts";
import { dispenseReviewVerdict } from "../cross-review/review.ts";
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
  settleCrossReview,
  settleCrossReviewFailure,
  toolFlags,
} from "./cast-core.ts";
import { readProjectMcpServers } from "./mcp-registry.ts";
import { captureEffectDiff } from "./cast-diff.ts";
import {
  appendDecomposeDraft,
  DEFAULT_DECOMPOSE_DRAFT_PATH,
  nextDecomposeRepairAction,
  RESUMABLE_DECOMPOSE_PLAY,
} from "./decompose-draft.ts";

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
  /** Override the resumable decompose checkpoint ledger (default
   *  `<root>/.vend/decompose-drafts.jsonl`). Ignored by every other play. */
  readonly decomposeDraftPath?: string;
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
  /** Optional complement-executor registry injection for hermetic cross-review tests or a
   *  restricted configured capability set. Omitted uses the built-in executor registry. */
  readonly crossReviewRegistry?: ExecutorRegistry;
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
  /** Ordered editorial charter-cite dispositions reported by the landed effect. Omitted for a
   *  clean cast; the CLI derives its honest degraded count from this same occurrence list. */
  readonly degrades?: readonly DegradeDisposition[];
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

/** Human-facing facts for a resolved reviewer that could not return a valid verdict. */
interface CrossReviewFailure {
  readonly reviewingSeat: string;
  readonly endpointCategory: string;
  readonly cause: string;
  readonly hint: string;
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

  // Resolve and probe the exact executor instance this cast would use BEFORE rendering, transcript
  // setup, or dispense. Selection precedence is unchanged; an injected instance still wins over
  // id/env resolution. The shallow probe spends no tokens and returns expected environment failure
  // as data, which the pure classifier turns into the existing missing-capability amber andon.
  const executor = opts.executor ?? executorFor(opts.executorId ? { executor: opts.executorId } : {});
  const seatOfExecution = resolveSeatOfExecution(executor.id);
  const executorProbe = await executor.probe();
  const probeVerdict = classify({
    executorProbe,
    timedOut: false,
    budgetOutcome: null,
    gateVerdict: null,
  });
  if (probeVerdict.outcome === "missing-capability") {
    const endedAt = new Date().toISOString();
    process.stdout.write(`· andon: missing-capability — ${executorProbeDetail(executor.id, executorProbe)}\n`);
    // Exactly one countable zero-spend refusal. The immediate return prevents transcript creation,
    // dispense/effect, and the ordinary terminal append below.
    await appendRunLog(
      {
        runId,
        play: play.name,
        epic: opts.subject,
        model: resolveLoggedModel(undefined, opts.model),
        envelope: budget,
        project,
        ...(opts.intervened !== undefined ? { intervened: opts.intervened } : {}),
        ...(seatOfExecution !== undefined ? { seatOfExecution } : {}),
        outcome: probeVerdict.outcome,
        usage: {} as Usage,
        costUsd: 0,
        gateResults: probeVerdict.gateLog,
        startedAt,
        endedAt,
      },
      opts.runLogPath ? { path: opts.runLogPath } : {},
    );
    return {
      runId,
      outcome: probeVerdict.outcome,
      materialized: probeVerdict.materialize,
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
    output = play.parse(result.result ?? "", ctx);
    if (opts.skipGates) process.stdout.write("· gates skipped (--no-gates)\n");
    gateVerdict = opts.skipGates ? null : play.gates(output, ctx);
    // A decompose checkpoint lands at the first point where all recovery facts exist and before
    // classification/effect can fail or be interrupted. Keep the generic engine independent of
    // the concrete BAML play by keying on its stable registry identity. Ungated casts have no gate
    // findings and therefore cannot claim a resumable post-gate checkpoint.
    if (gateVerdict !== null && play.name === RESUMABLE_DECOMPOSE_PLAY) {
      await appendDecomposeDraft(
        {
          runId,
          epic: opts.subject,
          parsedDraft: output as object,
          gateFindings: gateVerdict,
          nextRepairAction: nextDecomposeRepairAction(gateVerdict, result.subtype),
          createdAt: new Date().toISOString(),
        },
        { path: opts.decomposeDraftPath ?? join(root, DEFAULT_DECOMPOSE_DRAFT_PATH) },
      );
    }
  }

  const verdict = classify({ executorProbe, timedOut, budgetOutcome, gateVerdict });

  // Primary execution facts are complete before settlement begins. Keep them in scope for the
  // finally append so a later patch read, resolver, settlement, or presentation throw cannot erase
  // the spend from the ledger.
  const loggedModel = resolveLoggedModel(result?.model, opts.model);
  const turnsUsed = resolveTurnsUsed(result?.num_turns);
  const usage = (result?.usage ?? {}) as Usage;
  const costUsd = typeof result?.total_cost_usd === "number" ? result.total_cost_usd : 0;
  const reducedGrounding = "reducedGrounding" in resolved && resolved.reducedGrounding;

  // The effect boundary remains unchanged: an uncontracted effect throw is not a settlement
  // failure because the shell cannot know whether that ambiguous effect landed. Once the effect
  // resolves, everything through the terminal append is guarded below.
  let reported: EffectResult | undefined;
  if (verdict.materialize && output !== null) reported = await play.effect(output, ctx);

  let materialized = false;
  let produced: string | undefined;
  let capturedDiff: string | undefined;
  let artifactDiscrepancy: ArtifactDiscrepancy | undefined;
  let degrades: readonly DegradeDisposition[] | undefined;
  let seatDefaulted: SeatDefaulted | undefined;
  let seatInferred: SeatInferred | undefined;
  let crossReviewSkipped: CrossReviewSkipped | undefined;
  let crossVendorVerdict: CrossVendorVerdict | undefined;
  let crossReviewFailure: CrossReviewFailure | undefined;
  let outcome: RunOutcome = verdict.outcome;
  let settledVerdict = verdict;
  let settlementThrew = false;
  let settlementError: unknown;
  let endedAt = "";

  try {
    if (reported !== undefined) {
      // Preserve authoritative effect facts before diff capture: a capture error happens after the
      // effect landed and must not erase its outcome/routing disposition from the terminal row.
      materialized = reported.ok;
      degrades = reported.ok && reported.degrades !== undefined && reported.degrades.length > 0
        ? reported.degrades
        : undefined;
      seatDefaulted = reported.seatDefaulted;
      seatInferred = reported.seatInferred;
      produced = reported.ok ? reported.produced : undefined;
      if (reported.outcome) outcome = reported.outcome;

      // The generic impure shell owns Git capture. Atomic publication in cast-diff.ts ensures a
      // failed write cannot expose the final artifact name before this call returns its reference.
      const effectDiff = reported.ok
        ? await captureEffectDiff({ projectRoot: root, runId, artifacts: reported.artifacts })
        : undefined;
      const eff: EffectResult = effectDiff === undefined
        ? reported
        : { ...reported, capturedDiff: effectDiff };
      capturedDiff = eff.capturedDiff;
      process.stdout.write(`· effect ${eff.ok ? "✓" : "✗"}${eff.detail ? ` ${eff.detail}` : ""}\n`);

      // A complement can review only concrete landed patch bytes from a known author lane. A valid
      // reviewer dispense failure remains the named T-076-02-01 andon; unrelated operations such as
      // this patch read fall through to the outer settlement guard.
      if (!opts.skipGates && eff.ok && capturedDiff !== undefined && seatOfExecution !== undefined) {
        const reviewer = opts.crossReviewRegistry === undefined
          ? resolveComplementExecutor(seatOfExecution)
          : resolveComplementExecutor(seatOfExecution, opts.crossReviewRegistry);
        if (reviewer !== null) {
          const patch = await readFile(join(root, capturedDiff), "utf8");
          const elapsedMs = Math.max(0, Date.now() - Date.parse(startedAt));
          try {
            const review = await dispenseReviewVerdict({
              reviewer,
              capturedDiff: patch,
              rubricContext: crossReviewRubric(play.name, play.summary, verdict.gateLog),
              timeoutMs: Math.max(1, timeoutMsFor(budget) - elapsedMs),
            });
            crossVendorVerdict = {
              authoringSeat: seatOfExecution,
              reviewingSeat: review.reviewingSeat,
              verdict: review.verdict,
              ...(review.verdict === "fail" ? { detail: review.reason } : {}),
            };
          } catch (error) {
            crossReviewFailure = describeCrossReviewFailure(reviewer, error);
          }
        } else {
          crossReviewSkipped = {
            reason: "no-complement-reviewer-resolved",
            bindsWhen: "author-and-exactly-one-complement-reviewer-provisioned",
          };
        }
      }
    } else if (verdict.outcome !== "success") {
      process.stdout.write(`· andon: ${verdict.outcome}${stopReason(gateVerdict, budgetOutcome)}\n`);
    }

    // The initial verdict authorized the effect; cross-review decides whether the landed run may
    // settle as cleared. A later presentation throw retains this already-observed gate evidence.
    settledVerdict = crossReviewFailure === undefined
      ? settleCrossReview({ ...verdict, outcome }, crossVendorVerdict)
      : settleCrossReviewFailure({ ...verdict, outcome });
    outcome = settledVerdict.outcome;
    if (crossReviewFailure !== undefined) {
      process.stdout.write(
        `· andon: missing-capability — reviewer seat '${crossReviewFailure.reviewingSeat}' failed at ` +
          `${crossReviewFailure.endpointCategory}: ${crossReviewFailure.cause} — ${crossReviewFailure.hint}\n`,
      );
    } else if (crossVendorVerdict?.verdict === "fail") {
      process.stdout.write(`· andon: gate-failed — cross-vendor review: ${crossVendorVerdict.detail ?? "refused"}\n`);
    }

    if (seatDefaulted !== undefined) {
      process.stdout.write(
        `· seat defaulted — requested '${seatDefaulted.requested}'; using '${seatDefaulted.applied}' ` +
          `(${seatDefaulted.reason}; proceeding, recorded)\n`,
      );
    }

    if (settledVerdict.outcome === "success" && settledVerdict.overEnvelope && budgetOutcome?.status === "exhausted") {
      process.stdout.write(
        `· settle warning: over-envelope — spent ${budgetOutcome.spent}/${budgetOutcome.ceiling} tokens ` +
          `(over by ${budgetOutcome.overage}); gates cleared, output retained\n`,
      );
    }

    const turnSummary = formatTurnSummary({
      ...(progress.turns > 0 ? { agentTurns: progress.turns } : {}),
      ...(maxTurns !== undefined ? { maxTurns } : {}),
      ...(turnsUsed !== undefined ? { executorReportedTurns: turnsUsed } : {}),
    });
    if (turnSummary !== undefined) process.stdout.write(`${turnSummary}\n`);

    if (reducedGrounding) {
      process.stdout.write("· reduced grounding — optional codebase-memory MCP absent; proceeding (degraded, recorded)\n");
    }
  } catch (error) {
    // Unexpected settlement defects remain visible to the caller, but no longer pre-empt the
    // ledger. Mark the durable row honestly, retain facts settled before the throw, then rethrow
    // the original value only after the finally append succeeds.
    settlementThrew = true;
    settlementError = error;
    outcome = "errored";
    settledVerdict = { ...settledVerdict, outcome };
  } finally {
    const artifactState = await reconcileCapturedDiff(root, capturedDiff);
    capturedDiff = artifactState.capturedDiff;
    artifactDiscrepancy = artifactState.artifactDiscrepancy;

    // Stamp the end once and reuse it for both ledger and successful returned actuals.
    endedAt = new Date().toISOString();
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
        // still available at final settlement supplies a reference.
        ...(capturedDiff !== undefined ? { capturedDiff } : {}),
        // If a previously observed reference is unavailable, omit the false reference and retain
        // an explicit countable discrepancy instead (T-076-02-02).
        ...(artifactDiscrepancy !== undefined ? { artifactDiscrepancy } : {}),
        // Honest inert-gate provenance (T-076-01-02): this path had a known author lane and concrete
        // patch bytes, but complement resolution returned null. Irrelevant or reviewed paths omit
        // the complete marker so their existing ledger shape is unchanged.
        ...(crossReviewSkipped !== undefined ? { crossReviewSkipped } : {}),
        // The reduced-grounding marker (T-060-01-02, E-060 #3) — one-way, spread only when the cast
        // degraded (an optional MCP was absent) so a fully-grounded cast (and every pre-T-060-01-02
        // record) leaves the field off, byte-identical. Makes a degraded clear countable in the ledger.
        ...(reducedGrounding ? { reducedGrounding: true } : {}),
        // Exact occurrence-level editorial cite evidence from the successful effect. Empty/absent
        // reports omit the field so clean and historical records retain their existing shape.
        ...(degrades !== undefined ? { degrades } : {}),
        // One authoritative warning fact (T-068-02-03): forward the classifier marker rather than
        // re-deriving it from meter/gate state. Unmarked casts omit the key (one-way record contract).
        ...(settledVerdict.overEnvelope ? { overEnvelope: true } : {}),
        // The effect's authoritative routing disposition (T-070-01-03). Forward the exact report;
        // absence omits the key so ordinary and historical records retain their existing shape.
        ...(seatDefaulted !== undefined ? { seatDefaulted } : {}),
        // The effect is the sole inference-policy boundary. Preserve its chosen seat and evidence
        // verbatim; an explicit or ambiguous/unrouted cast omits the one-way marker.
        ...(seatInferred !== undefined ? { seatInferred } : {}),
        // Attached reviewer verdict: absent when no review ran (with crossReviewSkipped distinguishing
        // a relevant null resolution from an irrelevant path); present for both pass and fail so the
        // final outcome is auditable from the same ledger line.
        ...(crossVendorVerdict !== undefined ? { crossVendorVerdict } : {}),
        outcome,
        usage,
        costUsd,
        gateResults: settledVerdict.gateLog,
        startedAt,
        endedAt,
      },
      opts.runLogPath ? { path: opts.runLogPath } : {},
    );
  }

  if (settlementThrew) throw settlementError;

  // Surface the cast's measured actuals (T-024-02) for the macro-wallet spend loop: the tokens the
  // seam reported (`{}` ⇒ 0 on a timed-out run, honestly nothing metered) and the wall-clock span
  // (non-negative by construction). The wallet debits by this; the predicted envelope only gates
  // authorization (P7).
  const wallMs = Math.max(0, Date.parse(endedAt) - Date.parse(startedAt));
  return {
    runId,
    outcome,
    materialized,
    ...(settledVerdict.overEnvelope ? { overEnvelope: true } : {}),
    ...(degrades !== undefined ? { degrades } : {}),
    produced,
    capturedDiff,
    actuals: { usage, wallMs },
  };
}

/** Reconcile the artifact claim at the terminal append boundary. A row carries either the usable
 * reference or an explicit discrepancy, never a `capturedDiff` path this cast already knows is
 * unavailable. Filesystem policy stays in the impure cast shell; the run log preserves only data. */
async function reconcileCapturedDiff(
  root: string,
  reference: string | undefined,
): Promise<{ capturedDiff?: string; artifactDiscrepancy?: ArtifactDiscrepancy }> {
  if (reference === undefined) return {};
  try {
    await access(join(root, reference));
    return { capturedDiff: reference };
  } catch {
    return {
      artifactDiscrepancy: {
        reference,
        reason: "captured-diff-unavailable-at-settlement",
      },
    };
  }
}

/** Render the authored judgment available to the generic engine without inventing a new
 * per-playbook rubric surface (explicitly deferred by S-073-02). */
function crossReviewRubric(play: string, summary: string, gates: readonly LogGate[]): string {
  const gateLines = gates.length === 0
    ? ["- no named play-gate rows were reported"]
    : gates.map((gate) => `- ${gate.gate}: ${gate.passed ? "PASS" : "FAIL"}${gate.detail ? ` — ${gate.detail}` : ""}`);
  return [`Play: ${play}`, `Authored purpose: ${summary}`, "Play gate evidence:", ...gateLines].join("\n");
}

/** A short andon suffix for stdout — names the gate/budget reason when there is one. Pure;
 *  kept private here (cosmetic stdout) exactly as the runner's `stopReason` is. */
function stopReason(gate: GateVerdict | null, budget: BudgetOutcome | null): string {
  if (gate?.status === "stop") return ` — gate '${gate.gate}' stopped at ${gate.unit}: ${gate.reason}`;
  if (budget?.status === "exhausted") return ` — spent ${budget.spent}/${budget.ceiling} tokens (over by ${budget.overage})`;
  return "";
}

/** Render a total, actionable cast-time explanation from the executor-neutral probe contract. */
function executorProbeDetail(executorId: string, result: ExecutorProbeResult): string {
  const reason = result.reason?.trim() || `${executorId} executor is not dispensable from this environment`;
  const hint = result.hint?.trim() || `check the ${executorId} executor's local configuration, authentication, and reachability`;
  return `executor '${executorId}' unreachable: ${reason} — ${hint}`;
}

/** Plain provider category for reviewer failure copy; total over future executor ids. */
function crossReviewEndpointCategory(executorId: string): string {
  if (executorId === "openai-compat") return "OpenAI-compatible endpoint";
  if (executorId === "claude") return "Claude Code executor";
  const id = oneLine(executorId);
  return id.length > 0 ? `executor '${id}' endpoint` : "reviewer endpoint";
}

/** Reduce an arbitrary rejection to one safe line. Error stacks are deliberately never read. */
function crossReviewFailureCause(error: unknown): string {
  if (error instanceof Error) {
    return oneLine(error.message) || "review dispense failed without an error message";
  }
  try {
    return oneLine(String(error)) || "review dispense failed without an error message";
  } catch {
    return "review dispense failed without an error message";
  }
}

/** Build actionable andon copy from locally trusted reviewer routing facts. */
function describeCrossReviewFailure(
  reviewer: ComplementExecutor,
  error: unknown,
): CrossReviewFailure {
  const endpointCategory = crossReviewEndpointCategory(reviewer.executor.id);
  const hint = reviewer.executor.id === "openai-compat"
    ? "verify VEND_OPENAI_BASE_URL is reachable and VEND_OPENAI_API_KEY contains valid bearer auth when required; run `vend doctor`"
    : `check the ${reviewer.seat} reviewer's local configuration, authentication, and endpoint reachability; run \`vend doctor\``;
  return {
    reviewingSeat: reviewer.seat,
    endpointCategory,
    cause: crossReviewFailureCause(error),
    hint,
  };
}

/** Collapse untrusted external prose to one trimmed terminal line. */
function oneLine(value: string): string {
  return value.trim().replace(/\s+/g, " ");
}
