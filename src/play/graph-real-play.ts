// The real-play graph — the IMPURE shell + live entry (T-047-01, story S-047-01, epic E-047). The
// FIRST real-play `castGraph` caller: the graph-scale analog of chain-propose-decompose.ts (which is
// to `castChain` what this module is to `castGraph`). Where E-046 proved the typed DAG substrate with
// STUB nodes, this carries REAL plays + REAL concurrency through it — a `survey → [propose ×2] →
// capture-note` diamond:
//
//   survey (project → board) ──┬─→ propose-epic (signal #1 → epic) ──┐
//                              └─→ propose-epic (signal #2 → epic) ──┴─→ capture-note (both epics → note)
//          FAN-OUT (the two proposes run CONCURRENTLY in castGraph's wave)        JOIN (multi-upstream)
//
// DEPENDENCY DIRECTION (E-007 keystone): this is the one site where the three concrete plays depend UP
// onto the graph primitive. A `src/play/` citizen, it imports the engine (`castGraph`) and the three
// plays (survey/propose/note + their `assemble*` helpers). The engine never imports this; the
// primitive never depends down on the plays. Acyclic, exactly as chain-propose-decompose.ts.
//
// THE LIVE, METERED SPEND (the headline, P7): casting this spawns ~4 real `claude -p` casts (survey +
// 2 proposes + note); the two proposes run concurrently. The human running `lisa loop` authorizes it;
// the per-node budgets bound it. NOT a free proof. The honest-on-outcome stance: the headline is the
// CONCURRENCY (two real casts overlapping) + the JOIN receiving both — a degraded run (a propose
// andon) is recorded with its cause, not hidden.
//
// PURITY: IMPURE. It value-imports the three plays (each loads the BAML native addon) and `castGraph`
// (which value-imports `castPlay` → spawns + logs). So NO `bun test` value-imports this module (the
// chain.ts / graph.ts discipline) — its WIRING judgment is the pure graph-real-play-core.ts (proven in
// graph-real-play-core.test.ts), and the concurrent cast is proven LIVE downstream (AC#3). The propose
// adapters read fs (the survey board), so they are `async`; `castGraph` awaits each `adapt` before
// casting.

import { readFile } from "node:fs/promises";
import { basename } from "node:path";
import type { Budget } from "../budget/budget.ts";
import { allocate } from "../budget/wallet.ts";
import { castGraph, type GraphResult, type PlayNode } from "../engine/graph.ts";
import type { NodeUpstreams } from "../engine/dag-core.ts";
import { surveyPlay, assembleSurveyInputs } from "./survey.ts";
import { proposeEpicPlay, assembleProposeEpicInputs } from "./propose-epic.ts";
import { captureNotePlay, assembleNoteInputs } from "./note.ts";
import {
  NOTE_NODE,
  PROPOSE_1_NODE,
  PROPOSE_2_NODE,
  REAL_PLAY_EDGES,
  SURVEY_NODE,
  buildConsolidationTopic,
  pickSignal,
  realPlayMacro,
  subjectForJoin,
  subjectForProposeSignal,
} from "./graph-real-play-core.ts";

/** Options for {@link castRealPlayGraph} — the per-cast values the graph does not carry. Each budget
 *  override falls back to the play's recalibrated default (the P7 measured floor). */
export interface GraphRealPlayOptions {
  /** Repo root the surveys/proposes/note read + write under (default `process.cwd()`). */
  readonly projectRoot?: string;
  /** Pinned model id; omitted ⇒ CLI default (and the engine's `DEFAULT_MODEL` logged). */
  readonly model?: string;
  /** Override the transcript dir (default `<root>/.vend/transcripts`). */
  readonly transcriptDir?: string;
  /** The E1 trust self-report — stamped on every node's record (pass-through, like the chain). */
  readonly intervened?: boolean;
  /** Per-node budget overrides; each omitted ⇒ that play's static default. */
  readonly surveyBudget?: Budget;
  readonly proposeBudget?: Budget;
  readonly noteBudget?: Budget;
  /** Override the ONE shared macro-wallet envelope the whole diamond draws from (E-052). Omitted ⇒
   *  `realPlayMacro(survey, propose, note)` — sized to cover survey + 2 proposes + note (NOT per-node),
   *  so both fan-out proposes debit one envelope and the 2-upstream JOIN runs. */
  readonly macroBudget?: Budget;
}

/**
 * Build the real-play `survey → [propose ×2] → capture-note` graph — the four {@link PlayNode}s plus
 * {@link REAL_PLAY_EDGES}. Each node's `adapt` pulls its upstream `produced` ref(s) out of the
 * {@link NodeUpstreams} join map and feeds the play's `assemble*` helper:
 *  - **survey** (source): no upstream → `assembleSurveyInputs` (reads the whole project).
 *  - **propose-1 / propose-2** (fan-out): read the survey's produced BOARD PATH, `pickSignal` #1/#2
 *    (the pure fan-out adapter), and `assembleProposeEpicInputs`. An honest degrade (< 2 signals) ⇒
 *    an empty signal, which the propose VALUE gate STOPs cleanly — the node does not proceed and the
 *    join skips (recorded), rather than the graph crashing.
 *  - **capture-note** (JOIN): read BOTH proposes' produced EPIC PATHS, `buildConsolidationTopic`
 *    referencing both, and `assembleNoteInputs`.
 *
 * Built (not cast) so a caller can inspect the spec; `castRealPlayGraph` casts it. The
 * `PlayNode<any, any>[]` type-erasure is the same documented one as `castChain`'s `PlayStep<any,
 * any>[]` — a graph is heterogeneous (Survey's `Board` vs ProposeEpic's `EpicCard` vs CaptureNote's
 * `Note`); type safety lives at each node's internally-consistent construction below.
 */
export function buildRealPlayGraph(opts: GraphRealPlayOptions = {}): {
  nodes: PlayNode<any, any>[];
  edges: readonly typeof REAL_PLAY_EDGES[number][];
} {
  const root = opts.projectRoot ?? process.cwd();
  const surveyBudget = opts.surveyBudget ?? surveyPlay.budget;
  const proposeBudget = opts.proposeBudget ?? proposeEpicPlay.budget;
  const noteBudget = opts.noteBudget ?? captureNotePlay.budget;
  const common = { projectRoot: root, model: opts.model, transcriptDir: opts.transcriptDir };

  // A fan-out branch: read the survey's produced board path, pick this branch's ranked signal, and
  // assemble the propose inputs. A degrade (< 2 signals) ⇒ empty signal ⇒ a clean propose gate STOP.
  const proposeNode = (id: string, index: number): PlayNode<any, any> => ({
    id,
    play: proposeEpicPlay,
    budget: proposeBudget,
    opts: (upstreams: NodeUpstreams) => ({
      subject: subjectForProposeSignal(signalFrom(upstreams, index)),
      intervened: opts.intervened,
      ...common,
    }),
    adapt: async (upstreams: NodeUpstreams) =>
      assembleProposeEpicInputs({
        signal: await signalFromAsync(upstreams, index),
        budget: proposeBudget,
        ...common,
      }),
  });

  // The board path threaded from the survey node — present + non-empty once survey proceeded.
  const boardPathFrom = (upstreams: NodeUpstreams): string => upstreams.get(SURVEY_NODE) ?? "";
  // Synchronous signal (for the opts subject) is best-effort: the board read is async, so the subject
  // derives from the picked signal only inside `adapt`; here we name the branch when unread.
  const signalFrom = (_upstreams: NodeUpstreams, index: number): string => `signal #${index + 1}`;
  const signalFromAsync = async (upstreams: NodeUpstreams, index: number): Promise<string> => {
    const path = boardPathFrom(upstreams);
    if (path === "") return "";
    const md = await readFile(path, "utf8");
    const sel = pickSignal(md, index);
    return sel.ok ? sel.signal : "";
  };

  const epicPathsFrom = (upstreams: NodeUpstreams): string[] =>
    [upstreams.get(PROPOSE_1_NODE), upstreams.get(PROPOSE_2_NODE)].filter((p): p is string => p !== undefined);

  const nodes: PlayNode<any, any>[] = [
    {
      id: SURVEY_NODE,
      play: surveyPlay,
      budget: surveyBudget,
      opts: { subject: `survey of ${basename(root)}`, intervened: opts.intervened, ...common },
      adapt: () => assembleSurveyInputs({ budget: surveyBudget, ...common }),
    },
    proposeNode(PROPOSE_1_NODE, 0),
    proposeNode(PROPOSE_2_NODE, 1),
    {
      id: NOTE_NODE,
      play: captureNotePlay,
      budget: noteBudget,
      opts: (upstreams: NodeUpstreams) => ({
        subject: subjectForJoin(epicPathsFrom(upstreams)),
        intervened: opts.intervened,
        ...common,
      }),
      adapt: (upstreams: NodeUpstreams) =>
        assembleNoteInputs({
          topic: buildConsolidationTopic(epicPathsFrom(upstreams)),
          budget: noteBudget,
          ...common,
        }),
    },
  ];

  return { nodes, edges: REAL_PLAY_EDGES };
}

/**
 * Cast the real-play graph LIVE through `castGraph` — the metered verb (~4 casts, the two proposes
 * concurrent). Returns the {@link GraphResult} (assembled in topo order, deterministic despite the
 * concurrent settle). IMPURE (assembles inputs, spawns); NOT unit-tested — its WIRING is the pure
 * graph-real-play-core.ts, proven in graph-real-play-core.test.ts; the concurrent cast is proven
 * LIVE (AC#3). The board mutation (minted epics + a note) is the ticket's authorized P7 spend.
 *
 * SHARED WALLET (E-052): allocates ONE shared {@link import("../budget/wallet.ts").Wallet} — sized by
 * `realPlayMacro` to cover survey + 2 proposes + note (or `opts.macroBudget`) — and passes it as
 * `castGraph`'s third arg, so BOTH fan-out proposes debit the SAME envelope and the 2-upstream JOIN
 * runs (in E-047 the per-node budgets leaked across the branches: propose-1 hit budget-exhausted, the
 * graph halted, and capture-note was skipped — the join stayed stub-proven only). The envelope is the
 * hard P7 wall under concurrency (`authorizeWave`/`debitWave`); the human running `lisa loop`
 * authorizes the spend.
 */
export async function castRealPlayGraph(opts: GraphRealPlayOptions = {}): Promise<GraphResult> {
  const { nodes, edges } = buildRealPlayGraph(opts);
  const macro = opts.macroBudget ?? realPlayMacro(
    opts.surveyBudget ?? surveyPlay.budget,
    opts.proposeBudget ?? proposeEpicPlay.budget,
    opts.noteBudget ?? captureNotePlay.budget,
  );
  return castGraph(nodes, edges, allocate(macro));
}

// The live entry (the ticket's "small entry"): `bun run src/play/graph-real-play.ts`. Casts against
// the cwd, prints each node's cast + the skips + the sink outputs, and exits non-zero on halt/fail —
// the src/probe/run-*.ts / attest-intervention.ts `import.meta.main` runnable pattern.
if (import.meta.main) {
  const result = await castRealPlayGraph({ projectRoot: process.cwd() });

  process.stdout.write("\n═ real-play graph — cast result ═\n");
  for (const [id, s] of result.nodes) {
    process.stdout.write(`  node ${id}: ${s.outcome} (materialized: ${s.materialized})${s.produced ? ` → ${s.produced}` : ""}\n`);
  }
  for (const sk of result.skipped) {
    process.stdout.write(`  node ${sk.id}: SKIPPED — ${sk.reason}\n`);
  }
  process.stdout.write(`  sinks (net output): ${JSON.stringify(Object.fromEntries(result.produced))}\n`);
  if (result.halted) process.stderr.write(`  graph halted: ${result.haltReason}\n`);

  process.exit(result.outcome === "success" && !result.halted ? 0 : 1);
}
