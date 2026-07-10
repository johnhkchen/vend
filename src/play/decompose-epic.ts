// The DecomposeEpic play (T-002-03 → registered onto the engine in T-007-03).
//
// Once the hardcoded, welded runner; now the FIRST registry entry of the casting engine
// (E-007). The six per-play variation points that used to be spread through
// `runDecomposeEpic`'s body — render, parse, gates, effect, budget, card — are collected
// into one `Play<DecomposeInputs, WorkPlan>` (`decomposeEpicPlay`), registered onto the
// shelf-wide `registry`. The generic `castPlay` loop (src/engine/cast.ts) now owns the
// fixed spine (dispense → meter → classify → transcript → run log); this module owns only
// the play-specific judgment. `runDecomposeEpic` is reimplemented as `castPlay` over the
// entry (AC#2) — behaviour-preserving — and the name-based dispatcher lives in
// ./dispatch.ts.
//
// DEPENDENCY DIRECTION (E-007 keystone): a concrete play depends UP onto the engine. This
// module imports `castPlay` + the `Play` contract from src/engine/; the engine never
// imports src/play/. That is what keeps the graph acyclic.
//
// PURITY (house pattern): the play's `render`/`parse`/`gates` are pure-ish leaves
// (render/parse call BAML in-process; gates is the pure `clear`); `decomposeEffect` is the
// one async, world-touching member (materialize + lisaValidate). `assembleAndCast` /
// `runDecomposeEpic` are the IMPURE verbs (read fs, spawn) — NOT unit-tested, their logic
// is the engine's tested pure core, proven live in T-007-04's second-play proof and the
// T-007-03 registration smoke.
//
// BAML in-process: `b.request`/`b.parse` are called directly inside the play's closures
// (no subprocess bridge). The addon's one-call-per-process limit is `bun test`-specific
// (memory 20232); a plain `bun` process — which the CLI/press are — runs both calls fine,
// which is also why no bun-test file value-imports this module.

import { join } from "node:path";
import { b } from "../../baml_client/sync_client.ts";
import type { WorkPlan } from "../../baml_client/index.ts";
import { extractPromptText } from "../baml/decompose-bridge.ts";
import { renderClientFor } from "../baml/render-client.ts";
import { DEFAULT_OPENAI_BASE_URL, OPENAI_BASE_URL_ENV } from "../executor/openai-compat.ts";
import { clear } from "../gate/gates.ts";
import {
  registry,
  type AnyPlay,
  type CastContext,
  type Card,
  type EffectResult,
  type Play,
} from "../engine/play.ts";
import { castPlay } from "../engine/cast.ts";
import {
  blockEntryTicketsAfter,
  DECOMPOSE_MAX_TURNS,
  DECOMPOSE_TOOLS,
  epicIdFromDoc,
  graphIntegrityViolations,
  renumberPlanToEpic,
  stripNonGoalAdvances,
} from "./decompose-epic-core.ts";
import type { Budget } from "../budget/budget.ts";
import { assembleInputs, listIdsIn, type DecomposeInputs } from "./project-context.ts";
import { materialize, BareCodeError, IdCollisionError } from "./materialize.ts";

/** The play name — the registry key and the value stamped on every run-log record. */
export const PLAY = "decompose-epic";

/** `RunSummary` is the engine's cast result (`{runId, outcome, materialized}`). Re-exported
 *  here so `src/shelf/press-core.ts` / `press.ts` keep resolving the type from this module
 *  (TYPE-ONLY for them — never loads the addon). */
export type { RunSummary } from "../engine/cast.ts";
import type { RunSummary } from "../engine/cast.ts";

/** Options for {@link runDecomposeEpic} / {@link assembleAndCast} — the per-run values the
 *  play itself does not carry. A subset of the engine's `CastOptions` plus the epic path. */
export interface RunOptions {
  readonly epicPath: string;
  readonly budget: Budget;
  /** Repo root the snapshot is gathered from and lisa files are written under. */
  readonly projectRoot?: string;
  /** Pinned model id; omitted ⇒ CLI default (and the engine's `DEFAULT_MODEL` logged). */
  readonly model?: string;
  /** Stable run id; derived if omitted. */
  readonly runId?: string;
  /** Override the transcript dir (default `<root>/.vend/transcripts`). */
  readonly transcriptDir?: string;
  /** The E1 trust bit (T-014-01): did the author step in mid-run? Forwarded to the cast's
   *  single end-of-run append; absent ⇒ unknown. The `vend run --intervened` self-report. */
  readonly intervened?: boolean;
  /** The E2 run mode (T-014-02): skip the gate phase so the output materializes ungated. The
   *  `vend run --no-gates` switch; absent/false ⇒ the gated path is unchanged. */
  readonly skipGates?: boolean;
  /** Born-blocked mint (`--after`, field fix #3): existing board ticket id(s) the minted epic's
   *  ENTRY tickets are born depending on, so queuing behind a live loop is race-free. Threaded to
   *  `assembleInputs`; the effect validates against the board + applies. Absent ⇒ a bare mint. */
  readonly after?: readonly string[];
}

/** The result of spawning `lisa validate` (the final structural poka-yoke). */
export interface ValidateResult {
  readonly ok: boolean;
  readonly output: string;
}

/**
 * Spawn `lisa validate --path <root>` — the final structural poka-yoke run after the files
 * are written. IMPURE verb. Tolerates `lisa` being absent (returns `ok: false` with the
 * reason rather than crashing the run record), so a missing binary degrades to a logged
 * validate-failure, not an unhandled throw.
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

/** Pull a lisa id out of the epic's frontmatter (`id: E-001`), else the file basename. The
 *  cast's `subject` — the run-log `epic` field. */
export function epicIdOf(epic: string, epicPath: string): string {
  const m = epic.match(/^\s*id:\s*(\S+)/m);
  if (m?.[1]) return m[1];
  const base = epicPath.split("/").pop() ?? epicPath;
  return base.replace(/\.md$/, "") || epicPath;
}

/**
 * The play's EFFECT — land the cleared plan in the world. The one async, impure member of
 * the contract. A faithful re-encoding of the welded runner's materialize/validate/relabel
 * block (T-007-03 D4):
 *
 *  - `materialize` runs its cross-board collision guard FIRST and throws `IdCollisionError`
 *    BEFORE any write; we catch it and RELABEL the outcome to `id-collision` as DATA (the
 *    house "returned data, not exception" rule the `EffectResult.outcome` field exists for),
 *    so the cast loop logs it without a throw crossing the orchestration boundary.
 *  - `materialize`'s second pre-write guard (T-067-01-03) throws `BareCodeError` when a
 *    rendered body would carry a bare policed code the charter cannot resolve — caught and
 *    relabeled to `bare-code` the same way, still before any write (zero partial output).
 *  - `lisaValidate` never throws; a validate FAILURE leaves the run `success` but reports
 *    `ok:false` (⇒ `materialized:false`), exactly as the welded runner did (it relabeled
 *    ONLY on collision).
 *  - any OTHER throw (a genuine fs failure) propagates — not a clean outcome, mirroring the
 *    runner's `else throw e`.
 */
const decomposeEffect = async (plan: WorkPlan, ctx: CastContext<DecomposeInputs>): Promise<EffectResult> => {
  const root = ctx.projectRoot;

  // Canonicalize ids, then PROVE the board before writing (E-061 retro #8). The model emits ids
  // (its prompt shows the old flat `T-002-01` form), but vend OWNS the board's identifiers: derive
  // the epic from the epic doc and renumber every story/ticket onto the nested `S-<epic>-<NN>` /
  // `T-<epic>-<NN>-<MM>` convention the graph model requires, remapping all cross-refs. Then run
  // vend's OWN `buildGraph` over the would-be board fragment; on any violation, refuse with a
  // relabeled `graph-invalid` andon BEFORE the first write (no partial materialization), so the play
  // can never land a board `bun run check` would reject — the exact failure of the flat E-061 mint
  // that passed `lisa validate` but failed the strict gate. A doc with no parseable `id:` skips both
  // (degrade, not regress); gates already cleared the plan's value/allocation/bounds/structural.
  const epicId = epicIdFromDoc(ctx.inputs.epic);
  let finalPlan = epicId ? renumberPlanToEpic(plan, epicId) : plan;
  if (epicId) {
    const violations = graphIntegrityViolations(finalPlan, epicId);
    if (violations.length > 0) {
      return {
        ok: false,
        outcome: "graph-invalid",
        detail: `graph-invalid — the plan would not materialize to a valid board:\n- ${violations.join("\n- ")}`,
      };
    }
  }

  // Born-blocked mint (`--after`, field fix #3): once the INTERNAL net has proven the plan's own
  // graph, block the epic's ENTRY tickets on the requested existing board ticket(s) so queuing
  // behind a live loop is race-free. The targets live OUTSIDE the plan fragment (other epics'
  // tickets), so (a) they are validated here against the LIVE board — a dangling `--after` would
  // write a graph-red board the fragment-only net cannot see, refused as `graph-invalid` before any
  // write — and (b) the edge is added AFTER the net, which would otherwise flag the external ref.
  const after = ctx.inputs.after ?? [];
  if (after.length > 0) {
    const boardTickets = new Set(await listIdsIn(join(root, "docs", "active", "tickets")));
    const missing = [...new Set(after)].filter((id) => !boardTickets.has(id));
    if (missing.length > 0) {
      return {
        ok: false,
        outcome: "graph-invalid",
        detail: `--after names ticket(s) not on the board: ${missing.join(", ")} — nothing materialized`,
      };
    }
    finalPlan = blockEntryTicketsAfter(finalPlan, after);
  }

  try {
    // The charter is the same string `gates` fed ClearContext — materialize snapshots it once
    // per cut so every written body carries its codes' cut-time text (T-067-01-02).
    const { storyFiles, ticketFiles } = await materialize(
      finalPlan,
      {
        storiesDir: join(root, "docs", "active", "stories"),
        ticketsDir: join(root, "docs", "active", "tickets"),
      },
      ctx.inputs.charter,
    );
    const validated = await lisaValidate(root);
    return {
      ok: validated.ok,
      detail: validated.ok ? "lisa validate ✓" : `lisa validate ✗\n${validated.output}`,
      artifacts: [...storyFiles, ...ticketFiles],
    };
  } catch (e) {
    if (e instanceof IdCollisionError) {
      return { ok: false, outcome: "id-collision", detail: `id-collision — reused board id(s): ${e.collisions.join(", ")}` };
    }
    if (e instanceof BareCodeError) {
      const where = e.hits.map((h) => `${h.file}: ${h.codes.join(", ")}`).join("; ");
      return { ok: false, outcome: "bare-code", detail: `bare-code — charter cannot resolve cited code(s): ${where}` };
    }
    throw e;
  }
};

/**
 * DecomposeEpic as a {@link Play} — the six variation points the cast loop plugs into its
 * fixed orchestration:
 *  - `render`  : `b.request.DecomposeEpic(epic, charter, project)` → prompt text.
 *  - `parse`   : `b.parse.DecomposeEpic(text)` → `WorkPlan` (SAP-parsed).
 *  - `gates`   : `clear(plan, {epic, charter})` — gates.ts's `GateResult` is structurally
 *                assignable to `GateVerdict`, and its `cleared` echo lets a successful cast
 *                log the four passed rows the welded runner wrote (T-007-03 D3).
 *  - `effect`  : {@link decomposeEffect}.
 *  - `budget`  : the warranted default envelope (high-tier 2h/120k — recalibrated from measured
 *                use, E-014/E-015, not a cold guess). Both dispatch sites pass
 *                an explicit budget (CLI `--budget`; press `budgetForTier`), so this is the
 *                fallback. Inlined (not imported from the shelf's `TIER_BUDGET`) to keep the
 *                play from depending UP onto the shelf — that edge would cycle (press → play).
 *  - `card`    : Azorius (WU) permanent, mythic — the keystone planning play (card-model.md).
 */
export const decomposeEpicPlay: Play<DecomposeInputs, WorkPlan> = {
  name: PLAY,
  summary: "clear an epic into ready stories and tickets",
  // Render FOLLOWS the executor selection (T-036-02): `VEND_EXECUTOR=openai-compat` ⇒ render via
  // `OpenModelStub` (openai-generic), default ⇒ omit the option ⇒ `ClaudeStub`, byte-identical.
  // Reuses E-035's `VEND_EXECUTOR` (the live selection) — `render` has no `CastContext`, so it
  // reads env, the same env `cast.ts` resolves the executor from moments later. (The cast's explicit
  // `executorId`/instance opts are test-injection seams that never render real BAML — accepted
  // boundary, see work/T-036-02/design.md D5.)
  render: (i) => {
    const client = renderClientFor();
    // openai-generic has no built-in endpoint, so a render against OpenModelStub needs base_url
    // present. Default it to E-035's local default so render and dispatch AGREE (the executor
    // defaults the same). `??=` respects a real endpoint a developer set. Render-only — BAML never
    // dispatches; mirrors decompose-bridge.ts's entry guard.
    if (client) process.env[OPENAI_BASE_URL_ENV] ??= DEFAULT_OPENAI_BASE_URL;
    return extractPromptText(
      b.request.DecomposeEpic(i.epic, i.charter, i.project, ...(client ? [{ client }] : [])) as unknown as {
        body: { json: () => { messages?: unknown[] } };
      },
    );
  },
  // Parse, then NORMALIZE: strip non-goal (`N\d+`) codes the model recurrently mis-tags onto a
  // ticket's `advances` before anything gates or materializes (honey-kitchen field fix #1). The
  // cast loop feeds this one parsed plan to both `gates` and `effect`, so the board never carries
  // the bogus code and the bounds gate stops babysitting the generator's noise.
  parse: (text) => stripNonGoalAdvances(b.parse.DecomposeEpic(text)),
  gates: (plan, ctx) => clear(plan, { epic: ctx.inputs.epic, charter: ctx.inputs.charter }),
  effect: decomposeEffect,
  // RE-recalibrated 2026-06-30 from a SUSTAINED real drive (honey-kitchen, 14 epics / 38 casts —
  // tooling-feedback #4). The budget meters TOTAL tokens (input + output + cache reads), and the
  // "go-and-see" read tail scales with the project: the prior 250k (tuned 2026-06-29 to the vend
  // repo's ~192k tail) still FALSE-ANDON'd a legitimate DENSE epic (honey-kitchen E-009 budget-
  // exhausted at 300k, minted first-try only at 500k), so 500k is now the field's standing default.
  // A false andon is worse than one fat tail through (the T-015-02 tie-breaker): the ceiling is a
  // detect-after wall (P7), so headroom over the observed upper tail costs nothing on the common run
  // and buys the dense outlier a clean mint. Wall-clock was never the limit (runs finish in minutes),
  // so timeMs is unchanged. (E-013's loop should set this from the log's p95 once it warms; by hand here.)
  budget: { timeMs: 7_200_000, tokens: 500_000 },
  // The warranted DEFAULT turn cap (T-015-02) — the mid-flight bound on the agentic wandering
  // behind decompose's ~85–95k token tail (E-014 E2). Generous over the 1–7-turn clean band;
  // the per-cast override (CastOptions.maxTurns) still wins. Justified at DECOMPOSE_MAX_TURNS.
  maxTurns: DECOMPOSE_MAX_TURNS,
  // Per-play tool provisioning (E-032, T-032-02): scope this cast to the codebase-memory MCP
  // (OPTIONAL grounding, E-060 #3) + read-only built-ins (strict least privilege). Resolved at
  // cast by `resolveTools`; a project registry missing codebase-memory-mcp does NOT andon — the
  // cast degrades, proceeding with the read-only built-ins and a reduced-grounding flag (so a
  // fresh seed still clears). See DECOMPOSE_TOOLS.
  tools: DECOMPOSE_TOOLS,
  card: { color: ["blue", "white"], type: "permanent", rarity: "mythic" } satisfies Card,
};

// Self-register at module load: any module that value-imports this one (the CLI/press
// dispatch via ./dispatch.ts) populates the singleton. Pure tests import
// ./decompose-epic-core.ts instead, so they never load this module and never register.
registry.register(decomposeEpicPlay);

/**
 * Assemble DecomposeEpic's typed inputs from an epic path and cast the given play. The
 * SINGLE site of the play-specific input assembly (`assembleInputs` + `epicIdOf`), shared
 * by {@link runDecomposeEpic} (the entry directly) and {@link dispatch.runPlay} (the
 * registry-resolved play). IMPURE — reads the epic/charter files and walks the board.
 *
 * Takes `play: AnyPlay` because today there is exactly ONE input shape, so the assembly is
 * shared across whatever play the registry resolves; T-007-04's second play reveals the
 * seam to generalize assembly per play. NOT unit-tested (its logic is the engine's pure
 * core); proven by the registration smoke + T-007-04.
 */
export async function assembleAndCast(play: AnyPlay, opts: RunOptions): Promise<RunSummary> {
  const root = opts.projectRoot ?? process.cwd();
  const inputs = await assembleInputs({ epicPath: opts.epicPath, projectRoot: root, after: opts.after });
  return castPlay(play, inputs, opts.budget, {
    subject: epicIdOf(inputs.epic, opts.epicPath),
    projectRoot: root,
    model: opts.model,
    runId: opts.runId,
    transcriptDir: opts.transcriptDir,
    intervened: opts.intervened,
    skipGates: opts.skipGates,
  });
}

/**
 * Run the DecomposeEpic play end to end — now `castPlay` OVER the registry entry (AC#2): no
 * orchestration of its own, the play-specific logic lives on `decomposeEpicPlay`. Kept as
 * the canonical direct cast of the entry; `vend run` / the press route by name through
 * ./dispatch.ts's `runPlay`, which reaches the same `assembleAndCast`.
 */
export async function runDecomposeEpic(opts: RunOptions): Promise<RunSummary> {
  return assembleAndCast(decomposeEpicPlay, opts);
}
